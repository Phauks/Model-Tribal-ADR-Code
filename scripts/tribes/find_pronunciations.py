"""List passages on nations' own websites that say how to pronounce something, for review by hand.

For every tribe profile with an official website (contacts, kind 'website'), the script reads
the home page, up to seven same-site pages whose links suggest about, history, culture or
language, and up to fifteen such pages from the site map. It writes every passage that
mentions pronunciation, and every linked audio file, to a JSON file.

It never writes to a profile. A person reads each passage and copies a pronunciation into
names.pronunciation only when it is the nation's own (or another authoritative source's)
pronunciation of one of its names, exactly as published (docs/data-model.md, "Names and
languages"). Most passages are language lessons and are not used.

Run from the repository root:
    python3 scripts/tribes/find_pronunciations.py candidates.json
Uses only the Python standard library and PyYAML (scripts/requirements.txt).
"""

import concurrent.futures
import html
import json
import pathlib
import re
import sys
import urllib.parse
import urllib.request

import yaml

HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; model-tribal-code research)"}
WANTED = re.compile(
    r"(about|history|culture|language|heritage|who-?we-?are|our-?story|our-?people|our-?name|pronoun)", re.I
)
MENTION = re.compile(r"pronounc|pronunciation", re.I)
AUDIO = re.compile(r"\.(mp3|m4a|wav|ogg|mp4)(\?|$)", re.I)
LINK = re.compile(r"""<(?:a|audio|source)\b[^>]*?(?:href|src)\s*=\s*["']([^"']+)["'][^>]*>(.*?)(?:</a>|>)""", re.I | re.S)
PAGES_FROM_LINKS = 7
PAGES_FROM_SITE_MAP = 15


def fetch(url: str) -> tuple[str, str] | None:
    """Return (final address, text) for an HTML or XML page, or None."""
    try:
        request = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(request, timeout=20) as response:
            kind = response.headers.get("content-type", "")
            if "html" not in kind and "xml" not in kind and "text" not in kind:
                return None
            return response.geturl(), response.read(3_000_000).decode("utf-8", "replace")
    except Exception:
        return None


def visible_text(page: str) -> str:
    page = re.sub(r"(?is)<(script|style|noscript)\b.*?</\1>", " ", page)
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"(?s)<[^>]+>", " ", page))).strip()


def same_site_links(base: str, page: str) -> list[str]:
    host = urllib.parse.urlparse(base).netloc
    found = []
    for href, label in LINK.findall(page):
        address = urllib.parse.urljoin(base, html.unescape(href)).split("#")[0]
        if urllib.parse.urlparse(address).netloc != host or address in found:
            continue
        if WANTED.search(address) or WANTED.search(visible_text(label)) or MENTION.search(label):
            found.append(address)
    return found


def site_map_links(base: str) -> list[str]:
    parts = urllib.parse.urlparse(base)
    root = f"{parts.scheme}://{parts.netloc}"
    queue = [root + "/sitemap.xml", root + "/sitemap_index.xml", root + "/wp-sitemap.xml"]
    robots = fetch(root + "/robots.txt")
    if robots:
        queue = re.findall(r"(?im)^sitemap:\s*(\S+)", robots[1]) + queue
    seen, pages = set(), []
    while queue and len(seen) < 12:
        address = queue.pop(0)
        if address in seen:
            continue
        seen.add(address)
        result = fetch(address)
        if not result:
            continue
        for location in re.findall(r"<loc>\s*([^<\s]+)\s*</loc>", result[1]):
            if re.search(r"\.xml(\?|$)", location):
                if re.search(r"page|post", location, re.I):
                    queue.append(location)
            elif WANTED.search(urllib.parse.urlparse(location).path):
                pages.append(location)
    pages.sort(key=lambda address: (0 if MENTION.search(address) else 1, len(address)))
    return pages


def passages(address: str, page: str) -> list[dict]:
    found = []
    text = visible_text(page)
    for match in MENTION.finditer(text):
        found.append({"page": address, "text": text[max(0, match.start() - 250) : match.end() + 250]})
    for href, label in LINK.findall(page):
        if AUDIO.search(href):
            found.append({"page": address, "audio": urllib.parse.urljoin(address, html.unescape(href)),
                          "label": visible_text(label)[:200]})
    return found


def search(profile: dict) -> dict:
    result = {"id": profile["id"], "name": profile["names"]["official"], "unreachable": [], "passages": []}
    for contact in profile.get("contacts", []):
        if contact.get("kind") != "website":
            continue
        home = fetch(contact["value"])
        if not home:
            result["unreachable"].append(contact["value"])
            continue
        base, page = home
        read = {base}
        addresses = same_site_links(base, page)[:PAGES_FROM_LINKS]
        addresses += [a for a in site_map_links(base) if a not in addresses][:PAGES_FROM_SITE_MAP]
        result["passages"] += passages(base, page)
        for address in addresses:
            if address in read:
                continue
            read.add(address)
            fetched = fetch(address)
            if fetched:
                result["passages"] += passages(*fetched)
    return result


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__)
        return 2
    profiles = [
        yaml.safe_load(path.read_text(encoding="utf-8"))
        for path in sorted(pathlib.Path("content/tribes").glob("*/*.yaml"))
    ]
    with_site = [p for p in profiles if any(c.get("kind") == "website" for c in p.get("contacts", []))]
    with concurrent.futures.ThreadPoolExecutor(max_workers=16) as pool:
        results = list(pool.map(search, with_site))
    results = [r for r in results if r["passages"] or r["unreachable"]]
    pathlib.Path(sys.argv[1]).write_text(json.dumps(results, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"{len(with_site)} sites read; {sum(1 for r in results if r['passages'])} with passages to review")
    return 0


if __name__ == "__main__":
    sys.exit(main())
