"""Fetch candidate constitution documents for every federally recognized nation.

Starts from the seed list written by collect_seeds.py and, for each nation:

1. fetches every cited link (National Indian Law Library pages, University of
   Oklahoma Law Library pages, the nation's own pages; Library of Congress
   item pages refuse automated readers and are listed for reading by hand);
2. follows links on those pages whose text or address names a constitution,
   bylaws, articles of association or an amendment (two hops at most);
3. reads the nation's website home page and up to eight government, law or
   document pages linked from it, looking for the same kinds of links.

Every PDF, Word file or full-text page found is saved to the private capture
folder with its SHA-256 and extracted text. Nothing here decides whether a
document is a constitution; classify_documents.py and a reviewer do that.

Requests to any one host are spaced at least one second apart.

Usage:
  python3 scripts/constitutions/fetch_documents.py SEEDS.json CAPTURE_DIR OUTPUT.json
"""

import concurrent.futures
import hashlib
import json
import os
import re
import subprocess
import sys
import threading
import time
import urllib.parse

import requests
from bs4 import BeautifulSoup

USER_AGENT = (
    "Mozilla/5.0 (compatible; model-tribal-code-research/0.1; "
    "+https://github.com/Phauks/Model-Tribal-ADR-Code)"
)
DOCUMENT_WORDS = re.compile(
    r"constitut|by-?laws|articles\s+of\s+association|amendment|governing\s+document",
    re.I,
)
NAVIGATION_WORDS = re.compile(
    r"government|council|law|code|ordinance|legal|court|judicial|document|governance|"
    r"resolution|about|administration|departments|leadership|elections|enrollment",
    re.I,
)
SKIP_LINKS = re.compile(
    r"facebook|twitter|instagram|youtube|linkedin|mailto:|tel:|javascript:|\.jpg|\.png|"
    r"\.gif|\.mp4|\.mp3|google\.com/maps|x\.com/|tiktok|flickr|pinterest",
    re.I,
)
DOCUMENT_EXTENSIONS = (".pdf", ".doc", ".docx", ".rtf")
MAXIMUM_BYTES = 80 * 1024 * 1024
LIBRARY_OF_CONGRESS_ITEM = re.compile(r"loc\.gov/item/(\d+)")

host_locks = {}
host_last = {}
host_guard = threading.Lock()


def wait_for_host(url):
    host = urllib.parse.urlsplit(url).hostname or ""
    with host_guard:
        lock = host_locks.setdefault(host, threading.Lock())
    lock.acquire()
    try:
        gap = time.time() - host_last.get(host, 0)
        if gap < 1.0:
            time.sleep(1.0 - gap)
        host_last[host] = time.time()
    finally:
        lock.release()


def fetch(session, url):
    wait_for_host(url)
    try:
        response = session.get(url, timeout=40, stream=True, allow_redirects=True)
        chunks = []
        size = 0
        started = time.time()
        for chunk in response.iter_content(65536):
            if time.time() - started > 120:
                return {"url": url, "error": "too slow"}
            chunks.append(chunk)
            size += len(chunk)
            if size > MAXIMUM_BYTES:
                return {"url": url, "error": "too large"}
        return {
            "url": url,
            "final_url": response.url,
            "status": response.status_code,
            "content_type": response.headers.get("content-type", "").split(";")[0].strip().lower(),
            "body": b"".join(chunks),
        }
    except requests.RequestException as error:
        return {"url": url, "error": type(error).__name__}


def kind_of(result):
    content_type = result.get("content_type", "")
    path = urllib.parse.urlsplit(result.get("final_url", result["url"])).path.lower()
    body = result.get("body", b"")
    if body[:5] == b"%PDF-" or "pdf" in content_type:
        return "pdf"
    if "msword" in content_type or path.endswith(".doc"):
        return "doc"
    if "officedocument.wordprocessingml" in content_type or path.endswith(".docx"):
        return "docx"
    if "rtf" in content_type or path.endswith(".rtf"):
        return "rtf"
    if "html" in content_type or body[:200].lstrip().lower().startswith((b"<!doctype", b"<html")):
        return "html"
    return "other"


def pdf_text(path):
    try:
        text = subprocess.run(
            ["pdftotext", "-layout", path, "-"],
            capture_output=True,
            timeout=180,
        ).stdout.decode("utf-8", "replace")
    except subprocess.TimeoutExpired:
        text = ""
    pages = None
    try:
        info = subprocess.run(["pdfinfo", path], capture_output=True, timeout=60).stdout.decode(
            "utf-8", "replace"
        )
        match = re.search(r"^Pages:\s+(\d+)", info, re.M)
        pages = int(match.group(1)) if match else None
    except subprocess.TimeoutExpired:
        pass
    return text, pages


def html_text(body):
    soup = BeautifulSoup(body, "lxml")
    for tag in soup(["script", "style", "nav", "header", "footer", "noscript"]):
        tag.decompose()
    title = soup.title.get_text(" ", strip=True) if soup.title else ""
    text = soup.get_text("\n", strip=True)
    return title, text


def links_of(body, base):
    soup = BeautifulSoup(body, "lxml")
    found = []
    for anchor in soup.find_all("a", href=True):
        href = anchor["href"].strip()
        if not href or href.startswith("#") or SKIP_LINKS.search(href):
            continue
        absolute = urllib.parse.urljoin(base, href).split("#")[0]
        if not absolute.startswith("http"):
            continue
        text = anchor.get_text(" ", strip=True)
        found.append((absolute, text))
    return found


def looks_like_full_text(title, text):
    articles = len(re.findall(r"^\s*article\s+[ivxlc\d]+", text, re.I | re.M))
    return bool(re.search(r"constitut|by-?laws|articles of association", title + text[:3000], re.I)) and (
        articles >= 3 and len(text) > 6000
    )


def save(capture_dir, nation, result, kind):
    body = result["body"]
    digest = hashlib.sha256(body).hexdigest()
    folder = os.path.join(capture_dir, nation)
    os.makedirs(folder, exist_ok=True)
    extension = {"pdf": "pdf", "doc": "doc", "docx": "docx", "rtf": "rtf", "html": "html"}[kind]
    path = os.path.join(folder, f"{digest[:16]}.{extension}")
    if not os.path.exists(path):
        with open(path, "wb") as handle:
            handle.write(body)
    pages = None
    title = ""
    if kind == "pdf":
        text, pages = pdf_text(path)
    elif kind == "html":
        title, text = html_text(body)
    else:
        text = ""
    text_path = path.rsplit(".", 1)[0] + ".txt"
    with open(text_path, "w", encoding="utf-8") as handle:
        handle.write(text)
    return {
        "sha256": digest,
        "capture": os.path.relpath(path, capture_dir),
        "text_capture": os.path.relpath(text_path, capture_dir),
        "bytes": len(body),
        "pages": pages,
        "page_title": title,
        "text_characters": len(text.strip()),
    }


def crawl_nation(row, capture_dir, source_links):
    session = requests.Session()
    session.headers["User-Agent"] = USER_AGENT
    queue = []
    for seed in row["seeds"]:
        if LIBRARY_OF_CONGRESS_ITEM.search(seed["link"]):
            continue  # listed separately: the item pages refuse automated readers
        queue.append((seed["link"], 0, [f"seed:{seed['source']}"], seed.get("title") or ""))
    for key in sorted({seed["source"] for seed in row["seeds"] if seed.get("source")}):
        link = source_links.get(key, "")
        if "/nill/tribes/" in link:
            queue.append((link, 0, [f"library-page:{key}"], ""))
    for website in row["websites"]:
        queue.append((website, 0, ["website"], "home page"))
    seen = set()
    documents = []
    pages_visited = []
    navigation_budget = 8
    while queue:
        url, depth, chain, anchor = queue.pop(0)
        if url in seen:
            continue
        seen.add(url)
        result = fetch(session, url)
        visit = {"url": url, "depth": depth, "via": chain, "anchor": anchor}
        if "error" in result:
            visit["error"] = result["error"]
            pages_visited.append(visit)
            continue
        visit["status"] = result["status"]
        visit["final_url"] = result["final_url"]
        if result["status"] >= 400:
            pages_visited.append(visit)
            continue
        kind = kind_of(result)
        visit["kind"] = kind
        pages_visited.append(visit)
        if kind in ("pdf", "doc", "docx", "rtf"):
            record = save(capture_dir, row["nation"], result, kind)
            record.update({"url": url, "final_url": result["final_url"], "via": chain, "anchor": anchor, "format": kind})
            documents.append(record)
            continue
        if kind != "html":
            continue
        title, text = html_text(result["body"])
        host = urllib.parse.urlsplit(result["final_url"]).hostname or ""
        is_university_page = "thorpe" in host and "ou.edu" in host
        if is_university_page or looks_like_full_text(title, text):
            record = save(capture_dir, row["nation"], result, "html")
            record.update({"url": url, "final_url": result["final_url"], "via": chain, "anchor": anchor, "format": "html"})
            documents.append(record)
            if is_university_page:
                continue
        if depth >= 2:
            continue
        on_website = chain and chain[0] == "website"
        for link, text_of_link in links_of(result["body"], result["final_url"]):
            if link in seen:
                continue
            label = f"{text_of_link} {urllib.parse.unquote(link)}"
            link_host = urllib.parse.urlsplit(link).hostname or ""
            names_document = bool(DOCUMENT_WORDS.search(label)) and not re.search(
                r"compact|gaming", label, re.I
            )
            if LIBRARY_OF_CONGRESS_ITEM.search(link) or "loc.gov" in link_host:
                continue  # listed separately: the item pages refuse automated readers
            if names_document or "/nill/constitutions/" in link:
                queue.append((link, depth + 1, chain + [url], text_of_link))
            elif (
                on_website
                and depth == 0
                and navigation_budget > 0
                and link_host == host
                and NAVIGATION_WORDS.search(label)
                and not link.lower().endswith(DOCUMENT_EXTENSIONS)
            ):
                navigation_budget -= 1
                queue.append((link, 1, chain + [url], text_of_link))
    return {"nation": row["nation"], "documents": documents, "visited": pages_visited}


def main(seeds_path, capture_dir, output_path):
    with open(seeds_path, encoding="utf-8") as handle:
        rows = json.load(handle)
    source_links = {}
    import glob

    import yaml

    for path in glob.glob("content/sources/*/*.yaml"):
        with open(path, encoding="utf-8") as handle:
            record = yaml.safe_load(handle)
        source_links[record["key"]] = record.get("original_link") or (record.get("citation") or {}).get("URL", "")
    done = {}
    if os.path.exists(output_path):
        with open(output_path, encoding="utf-8") as handle:
            done = {row["nation"]: row for row in json.load(handle)}
    todo = [row for row in rows if row["nation"] not in done]
    print(f"{len(todo)} nations to crawl", flush=True)
    lock = threading.Lock()
    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
        futures = {pool.submit(crawl_nation, row, capture_dir, source_links): row["nation"] for row in todo}
        for count, future in enumerate(concurrent.futures.as_completed(futures), 1):
            nation = futures[future]
            try:
                done[nation] = future.result()
            except Exception as error:  # keep going; the row records the failure
                done[nation] = {"nation": nation, "documents": [], "visited": [], "error": repr(error)}
            with lock:
                if count % 10 == 0 or count == len(todo):
                    with open(output_path, "w", encoding="utf-8") as handle:
                        json.dump(sorted(done.values(), key=lambda r: r["nation"]), handle, indent=1)
                    print(f"{count}/{len(todo)} done", flush=True)


if __name__ == "__main__":
    main(*sys.argv[1:4])
