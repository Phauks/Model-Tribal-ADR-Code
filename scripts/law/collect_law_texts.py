"""Collect the full texts of tribal codes, court rules and dispute resolution laws.

The first research pass recorded links to Native nations' codes, court rules
and dispute resolution laws (National Indian Law Library and Tribal Law and
Policy Institute listings, the National Center on Restorative Justice
database, the Native American Rights Fund peacemaking law lists) but did not
open them. This script opens them so their dispute resolution provisions can
be read. It never changes a profile.

Steps:

  targets  Reads content/tribes/ and lists every link to a law code, court
           rules document, dispute resolution provision or database listing,
           with the nations that cite it.

  fetch    Downloads each link (depth 0). When a page is an index of a code
           (many links, little text), follows its links to documents on the
           same site (depth 1), up to a limit per page. Keeps the original
           file and an extracted plain-text copy in a private work folder
           (never committed; law texts and PDFs stay private), and writes a
           manifest with status, type, size and SHA-256 of every file.

  scan     Searches every text for dispute resolution terms and writes the
           passages around each match, grouped into review batches.

  merge    Combines reviewers' result files with the passages, checks every
           quote against the passage text, and writes the reviewable outputs
           (catalog of documents, provisions as JSON and CSV, counts).

Usage:
  python3 scripts/law/collect_law_texts.py targets --work WORK
  python3 scripts/law/collect_law_texts.py fetch --work WORK
  python3 scripts/law/collect_law_texts.py scan --work WORK
  python3 scripts/law/collect_law_texts.py merge --work WORK --output research/tribal-law

The method, limits and the brief that reviewers follow are in
research/tribal-law/README.md.
"""

import argparse
import collections
import concurrent.futures
import csv
import glob
import hashlib
import html
import json
import os
import re
import subprocess
import threading
import time
import unicodedata
import urllib.parse

import yaml

USER_AGENT = "Mozilla/5.0 (compatible; tribal-law-research; one request per second per site)"
GOVERNING_DOCUMENT_KINDS = {"law-code", "court-rules", "other"}
CHILD_LIMIT = 150
DOCUMENT_EXTENSIONS = (".pdf", ".doc", ".docx", ".rtf", ".htm", ".html", ".txt")
LAW_WORDS = re.compile(
    r"code|title|chapter|ordinance|rule|law|statute|section|article|act|resolution|"
    r"court|peace|mediat|arbitrat|dispute|judicial|civil|procedure|family|children|juvenile",
    re.IGNORECASE,
)
SKIP_LINK = re.compile(
    r"\.(jpg|jpeg|png|gif|svg|webp|mp3|mp4|zip|css|js)(\?|$)|^mailto:|^tel:|^javascript:|"
    r"facebook\.com|twitter\.com|instagram\.com|youtube\.com|linkedin\.com|/wp-login|/feed/?$|"
    r"[?&](share|replytocom)=",
    re.IGNORECASE,
)
SEARCH_TERMS = [
    ("mediation", r"\bmediat(?:e|ed|es|ing|ion|ions|or|ors)\b"),
    ("arbitration", r"\barbitrat(?:e|ed|es|ing|ion|ions|or|ors|ive)\b|\barbiter\b"),
    ("peacemaking", r"\bpeace\s*-?\s*mak(?:ing|er|ers)\b|\bpeace\s*-?\s*giv(?:ing|er|ers)\b"),
    ("conciliation", r"\bconciliat(?:e|ion|or|ors)\b"),
    ("alternative-dispute-resolution", r"\balternative\s+(?:means\s+of\s+)?dispute\s+resolution\b|\bADR\b"),
    ("dispute-resolution", r"\bdispute\s+resolution\b|\bresol(?:ve|ution\s+of)\s+(?:the\s+)?disputes?\b"),
    ("settlement-conference", r"\bsettlement\s+(?:conference|week|judge)s?\b"),
    ("circle", r"\b(?:talking|sentencing|healing|peace|restorative|family)\s+circles?\b"),
    ("family-group-conference", r"\bfamily\s+group\s+(?:conferenc\w*|decision\s*-?\s*making|meeting)\b"),
    ("restorative-justice", r"\brestorative\s+(?:justice|practices?|process\w*|conferenc\w*)\b"),
    ("elders", r"\belders?['’]?\s+(?:council|panel|court|circle|advisory|committee)\b|\bcouncil\s+of\s+elders\b"),
    ("traditional", r"\b(?:traditional|customary)\s+(?:dispute|court|forum|means|methods?|practices?|law|resolution|ways?)\b"),
    ("neutral", r"\bneutral\s+(?:third\s+part\w*|evaluat\w*|part\w*|fact\s*-?\s*find\w*)\b|\bombuds\w*\b"),
    ("diversion", r"\bdiver(?:sion|ted)\b"),
]
TERM_PATTERNS = [(name, re.compile(pattern, re.IGNORECASE)) for name, pattern in SEARCH_TERMS]
CORE_TERMS = {"mediation", "arbitration", "peacemaking", "conciliation", "alternative-dispute-resolution",
              "dispute-resolution", "settlement-conference", "circle", "family-group-conference",
              "restorative-justice", "elders", "traditional", "neutral"}
WINDOW_BEFORE = 900
WINDOW_AFTER = 1600
BATCH_CHARACTER_LIMIT = 90_000


# Targets --------------------------------------------------------------------

def read_targets(repository_root):
    targets = collections.OrderedDict()
    for path in sorted(glob.glob(os.path.join(repository_root, "content/tribes/*/*.yaml"))):
        with open(path, encoding="utf-8") as profile_file:
            profile = yaml.safe_load(profile_file)
        nation = profile["id"]
        records = []
        for index, document in enumerate(profile.get("governing_documents") or []):
            if document.get("kind") in GOVERNING_DOCUMENT_KINDS:
                records.append(("governing_documents", index, document))
        dispute_resolution = profile.get("dispute_resolution") or {}
        for field in ("provisions", "database_listings", "clauses"):
            for index, record in enumerate(dispute_resolution.get(field) or []):
                records.append((f"dispute_resolution.{field}", index, record))
        for field, index, record in records:
            link = (record.get("link") or "").split("#")[0].strip()
            if not link.startswith("http"):
                continue
            entry = targets.setdefault(link, {"url": link, "cited_by": []})
            entry["cited_by"].append({
                "nation": nation, "field": field, "index": index,
                "kind": record.get("kind"), "title": record.get("title"),
                "citation": record.get("citation"), "source": record.get("source"),
            })
    return list(targets.values())


def command_targets(arguments):
    os.makedirs(arguments.work, exist_ok=True)
    targets = read_targets(arguments.repository)
    with open(os.path.join(arguments.work, "targets.json"), "w", encoding="utf-8") as output:
        json.dump(targets, output, indent=1, ensure_ascii=False)
    nations = {cited["nation"] for target in targets for cited in target["cited_by"]}
    print(f"{len(targets)} links cited by {len(nations)} nations")


# Fetching -------------------------------------------------------------------

class HostPacer:
    """At most one request per second to any one site."""

    def __init__(self, interval=1.0):
        self.interval = interval
        self.locks = collections.defaultdict(threading.Lock)
        self.last = {}

    def wait(self, url):
        host = urllib.parse.urlparse(url).netloc.lower().removeprefix("www.")
        with self.locks[host]:
            delay = self.last.get(host, 0) + self.interval - time.time()
            if delay > 0:
                time.sleep(delay)
            self.last[host] = time.time()


def digest_of(url):
    return hashlib.sha1(url.encode("utf-8")).hexdigest()[:20]


def html_to_text(page):
    page = re.sub(r"(?is)<(script|style|nav|noscript|svg)[^>]*>.*?</\1>", "", page)
    page = re.sub(r"(?i)<br\s*/?>|</(p|div|li|h[1-6]|tr|section|article)>", "\n", page)
    text = html.unescape(re.sub(r"<[^>]+>", " ", page))
    text = re.sub(r"[ \t\r\f\v]+", " ", text)
    return re.sub(r"\n\s*\n+", "\n\n", text).strip()


def extract_text(raw_path, kind):
    try:
        if kind == "pdf":
            return subprocess.run(["pdftotext", "-layout", raw_path, "-"], capture_output=True,
                                  text=True, timeout=180).stdout
        if kind in ("docx", "doc", "rtf"):
            completed = subprocess.run(["pandoc", "-t", "plain", raw_path], capture_output=True,
                                       text=True, timeout=120)
            return completed.stdout
        with open(raw_path, "rb") as raw_file:
            raw = raw_file.read()
        page = raw.decode("utf-8", "replace")
        return html_to_text(page) if kind == "html" else page
    except (OSError, subprocess.SubprocessError):
        return ""


def kind_of(raw_head, content_type, url):
    lowered = (content_type or "").lower()
    path = urllib.parse.urlparse(url).path.lower()
    if raw_head[:4] == b"%PDF" or "pdf" in lowered:
        return "pdf"
    if raw_head[:2] == b"PK" or "wordprocessingml" in lowered or path.endswith(".docx"):
        return "docx"
    if raw_head[:4] == b"\xd0\xcf\x11\xe0" or "msword" in lowered:
        return "doc"
    if raw_head[:5] == b"{\\rtf":
        return "rtf"
    if "html" in lowered or b"<html" in raw_head.lower() or b"<!doctype" in raw_head.lower():
        return "html"
    return "text"


def fetch_one(work, url, pacer):
    folder = os.path.join(work, "documents")
    os.makedirs(folder, exist_ok=True)
    base = os.path.join(folder, digest_of(url))
    meta_path = base + ".json"
    if os.path.exists(meta_path):
        with open(meta_path, encoding="utf-8") as meta_file:
            return json.load(meta_file)
    pacer.wait(url)
    completed = subprocess.run(
        ["curl", "-sL", "--max-time", "90", "--max-filesize", "80000000", "-A", USER_AGENT,
         "-o", base + ".raw", "-w", "%{http_code}\t%{content_type}\t%{url_effective}", url],
        capture_output=True, text=True,
    )
    status, content_type, final_url = (completed.stdout.split("\t") + ["", "", ""])[:3]
    meta = {"url": url, "final_url": final_url or url, "http_status": status or "error",
            "content_type": content_type, "fetched": time.strftime("%Y-%m-%d")}
    if os.path.exists(base + ".raw"):
        with open(base + ".raw", "rb") as raw_file:
            raw = raw_file.read()
        kind = kind_of(raw[:2048], content_type, final_url or url)
        extension = {"html": ".html", "text": ".txt.raw"}.get(kind, "." + kind)
        os.replace(base + ".raw", base + extension)
        text = unicodedata.normalize("NFC", extract_text(base + extension, kind))
        with open(base + ".txt", "w", encoding="utf-8") as text_file:
            text_file.write(text)
        meta.update({"file_kind": kind, "file": os.path.basename(base + extension), "bytes": len(raw),
                     "sha256": hashlib.sha256(raw).hexdigest(), "characters": len(text),
                     "text_file": os.path.basename(base + ".txt")})
        if kind == "html":
            title = re.search(r"(?is)<title[^>]*>(.*?)</title>", raw.decode("utf-8", "replace"))
            meta["page_title"] = html.unescape(re.sub(r"\s+", " ", title.group(1))).strip()[:300] if title else None
    else:
        meta.update({"file_kind": None, "error": completed.stderr.strip()[:300] or "no file"})
    with open(meta_path, "w", encoding="utf-8") as meta_file:
        json.dump(meta, meta_file, ensure_ascii=False, indent=1)
    return meta


def child_links(work, meta, limit=CHILD_LIMIT):
    """Links on an index page to documents on the same site."""
    if meta.get("file_kind") != "html" or not str(meta.get("http_status", "")).startswith("2"):
        return []
    with open(os.path.join(work, "documents", meta["file"]), "rb") as raw_file:
        page = raw_file.read().decode("utf-8", "replace")
    base_url = meta["final_url"]
    base_host = urllib.parse.urlparse(base_url).netloc.lower().removeprefix("www.")
    base_path = urllib.parse.urlparse(base_url).path
    links = []
    for match in re.finditer(r"""(?is)<a\b[^>]*?href\s*=\s*["']([^"'#]+)["'][^>]*>(.*?)</a>""", page):
        href, anchor = html.unescape(match.group(1)).strip(), html_to_text(match.group(2))
        if SKIP_LINK.search(href):
            continue
        absolute = urllib.parse.urljoin(base_url, href).split("#")[0]
        parsed = urllib.parse.urlparse(absolute)
        host = parsed.netloc.lower().removeprefix("www.")
        same_site = host == base_host or host.endswith("." + base_host) or base_host.endswith("." + host)
        hosted_file = any(name in host for name in ("squarespace.com", "wixstatic.com", "amazonaws.com"))
        if not (same_site or hosted_file) or absolute.rstrip("/") == base_url.rstrip("/"):
            continue
        path = parsed.path.lower()
        is_document = path.endswith(DOCUMENT_EXTENSIONS[:4])
        below_index = parsed.path.startswith(base_path.rsplit("/", 1)[0] + "/") and len(parsed.path) > len(base_path.rsplit("/", 1)[0]) + 1
        if is_document or (LAW_WORDS.search(anchor + " " + path) and (below_index or path.endswith(DOCUMENT_EXTENSIONS))):
            links.append(absolute)
    return list(dict.fromkeys(links))[:limit]


def command_fetch(arguments):
    with open(os.path.join(arguments.work, "targets.json"), encoding="utf-8") as targets_file:
        targets = json.load(targets_file)
    pacer = HostPacer()
    manifest = {}

    def interleaved(urls):
        """Round-robin across sites so that the per-site pause does not idle the workers."""
        by_host = collections.defaultdict(list)
        for url in urls:
            by_host[urllib.parse.urlparse(url).netloc.lower()].append(url)
        queues = sorted(by_host.values(), key=len, reverse=True)
        ordered = []
        for position in range(max((len(queue) for queue in queues), default=0)):
            ordered.extend(queue[position] for queue in queues if position < len(queue))
        return ordered

    def run(urls, depth, parents):
        urls = interleaved(urls)
        results = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=arguments.workers) as executor:
            futures = {executor.submit(fetch_one, arguments.work, url, pacer): url for url in urls}
            for done, future in enumerate(concurrent.futures.as_completed(futures), 1):
                url = futures[future]
                try:
                    meta = future.result()
                except Exception as error:  # keep going; record the failure
                    meta = {"url": url, "http_status": "error", "error": str(error)[:300]}
                meta["depth"] = depth
                meta["parents"] = sorted(parents.get(url, []))
                manifest[url] = meta
                results.append(meta)
                if done % 50 == 0:
                    print(f"depth {depth}: {done}/{len(urls)}", flush=True)
        return results

    level_zero = run([target["url"] for target in targets], 0, {})
    parents = collections.defaultdict(set)
    for meta in level_zero:
        for link in child_links(arguments.work, meta, arguments.child_limit):
            if link not in manifest:
                parents[link].add(meta["url"])
    print(f"following {len(parents)} links from index pages", flush=True)
    run(sorted(parents), 1, parents)
    cited = {target["url"]: target["cited_by"] for target in targets}
    for url, meta in manifest.items():
        meta["cited_by"] = cited.get(url, [])
    with open(os.path.join(arguments.work, "manifest.json"), "w", encoding="utf-8") as output:
        json.dump(sorted(manifest.values(), key=lambda meta: (meta["depth"], meta["url"])), output,
                  indent=1, ensure_ascii=False)
    statuses = collections.Counter(str(meta.get("http_status")) for meta in manifest.values())
    print(f"{len(manifest)} files; statuses {dict(statuses)}")


# Scanning -------------------------------------------------------------------

def nations_for(meta, by_url):
    nations = {cited["nation"] for cited in meta.get("cited_by", [])}
    for parent in meta.get("parents", []):
        nations |= {cited["nation"] for cited in by_url.get(parent, {}).get("cited_by", [])}
    return sorted(nations)


def passages_in(text):
    matches = []
    for name, pattern in TERM_PATTERNS:
        for match in pattern.finditer(text):
            matches.append((match.start(), match.end(), name))
    matches.sort()
    windows = []
    for start, end, name in matches:
        low, high = max(0, start - WINDOW_BEFORE), min(len(text), end + WINDOW_AFTER)
        if windows and low <= windows[-1]["end"]:
            windows[-1]["end"] = max(windows[-1]["end"], high)
            windows[-1]["terms"].add(name)
        else:
            windows.append({"start": low, "end": high, "terms": {name}})
    return [window for window in windows if window["terms"] & CORE_TERMS or window["terms"] == {"diversion"}]


def command_scan(arguments):
    with open(os.path.join(arguments.work, "manifest.json"), encoding="utf-8") as manifest_file:
        manifest = json.load(manifest_file)
    by_url = {meta["url"]: meta for meta in manifest}
    passages, seen_hashes = [], {}
    for meta in manifest:
        if not meta.get("text_file") or not str(meta.get("http_status", "")).startswith("2"):
            continue
        sha = meta.get("sha256")
        if sha in seen_hashes:
            meta["duplicate_of"] = seen_hashes[sha]
            continue
        seen_hashes[sha] = meta["url"]
        with open(os.path.join(arguments.work, "documents", meta["text_file"]), encoding="utf-8") as text_file:
            text = text_file.read()
        for number, window in enumerate(passages_in(text)):
            passages.append({
                "id": f"{digest_of(meta['url'])}-{number}",
                "url": meta["final_url"] or meta["url"],
                "listed_url": meta["url"],
                "page_title": meta.get("page_title"),
                "file_kind": meta.get("file_kind"),
                "nations": nations_for(meta, by_url),
                "cited_as": [{key: cited.get(key) for key in ("nation", "field", "kind", "title", "citation")}
                             for cited in meta.get("cited_by", [])][:5],
                "terms": sorted(window["terms"]),
                "offset": window["start"],
                "text": text[window["start"]:window["end"]],
            })
    batch_folder = os.path.join(arguments.work, "batches")
    os.makedirs(batch_folder, exist_ok=True)
    for old in glob.glob(os.path.join(batch_folder, "batch-*.json")):
        os.remove(old)
    batches, current, size = [], [], 0
    for passage in passages:
        if current and size + len(passage["text"]) > BATCH_CHARACTER_LIMIT:
            batches.append(current)
            current, size = [], 0
        current.append(passage)
        size += len(passage["text"])
    if current:
        batches.append(current)
    for old in glob.glob(os.path.join(batch_folder, "batch-*.md")):
        os.remove(old)
    for number, batch in enumerate(batches, 1):
        with open(os.path.join(batch_folder, f"batch-{number:03d}.json"), "w", encoding="utf-8") as output:
            json.dump(batch, output, indent=1, ensure_ascii=False)
        with open(os.path.join(batch_folder, f"batch-{number:03d}.md"), "w", encoding="utf-8") as output:
            for passage in batch:
                cited = "; ".join(
                    f"{item['nation']} {item['field']} {item.get('kind') or ''}: "
                    f"{item.get('title') or ''} {item.get('citation') or ''}".strip()
                    for item in passage["cited_as"]) or "linked from an index page that a nation cites"
                output.write(
                    f"=== PASSAGE {passage['id']} ===\nurl: {passage['url']}\n"
                    f"nations: {', '.join(passage['nations'])}\ncited as: {cited}\n"
                    f"terms: {', '.join(passage['terms'])}\n\n{passage['text'].strip()}\n\n")
    with open(os.path.join(arguments.work, "passages.json"), "w", encoding="utf-8") as output:
        json.dump(passages, output, indent=1, ensure_ascii=False)
    documents = len({passage["url"] for passage in passages})
    print(f"{len(passages)} passages in {documents} documents; {len(batches)} batches")


# Merging --------------------------------------------------------------------

PROVISION_FIELDS = [
    "id", "nation", "document", "locator", "citation", "method", "setting", "subject_area", "entry",
    "outcome", "enforcement", "confidentiality", "immunity_waiver", "summary", "quote_check",
    "scope", "confidence", "peacemaking_features", "note", "duplicate_of", "url", "capture", "sha256", "passages",
    "verification", "reviewer", "lead_author_decision",
]
CAPTURE_ROOT = "research/captures/tribal-law/documents"


def squeeze(text):
    text = unicodedata.normalize("NFC", text or "")
    text = text.replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"')
    return re.sub(r"\s+", " ", text).strip()


def quote_check(quote, texts):
    if not quote or len(quote) < 20:
        return "missing"
    if any(quote in text for text in texts):
        return "exact"
    squeezed = squeeze(quote)
    if any(squeezed in squeeze(text) for text in texts):
        return "whitespace"
    if any(squeezed.lower() in squeeze(text).lower() for text in texts):
        return "case"
    return "failed"


def site_owners(repository_root):
    """Sites that exactly one nation lists as its own in its profile contacts."""
    owners = collections.defaultdict(set)
    for path in glob.glob(os.path.join(repository_root, "content/tribes/*/*.yaml")):
        with open(path, encoding="utf-8") as profile_file:
            profile = yaml.safe_load(profile_file)
        for contact in profile.get("contacts") or []:
            for value in contact.values():
                if isinstance(value, str) and value.startswith("http"):
                    owners[urllib.parse.urlparse(value).netloc.lower().removeprefix("www.")].add(profile["id"])
    return {host: next(iter(nations)) for host, nations in owners.items() if len(nations) == 1}


def command_merge(arguments):
    work = arguments.work
    owners = site_owners(arguments.repository)
    with open(os.path.join(work, "manifest.json"), encoding="utf-8") as manifest_file:
        manifest = json.load(manifest_file)
    with open(os.path.join(work, "passages.json"), encoding="utf-8") as passages_file:
        passages = {passage["id"]: passage for passage in json.load(passages_file)}
    by_url = {meta["url"]: meta for meta in manifest}
    by_final = {meta.get("final_url") or meta["url"]: meta for meta in manifest}
    kept_path = os.path.join(work, "copy-list.txt")
    kept = set(open(kept_path, encoding="utf-8").read().split()) if os.path.exists(kept_path) else None

    def capture_of(meta):
        """Private copy path, only for files kept in private storage."""
        if not meta.get("file") or (kept is not None and meta["file"] not in kept):
            return None
        return f"{CAPTURE_ROOT}/{meta['file']}"

    provisions, no_provision, missing_batches = [], [], []
    seen_passages = set()
    for batch_path in sorted(glob.glob(os.path.join(work, "batches", "batch-*.json"))):
        name = os.path.basename(batch_path)[:-5]
        result_path = os.path.join(work, "results", name + ".json")
        if not os.path.exists(result_path):
            missing_batches.append(name)
            continue
        with open(result_path, encoding="utf-8") as result_file:
            result = json.load(result_file)
        for item in result.get("provisions", []):
            ids = [pid for pid in item.get("passages", []) if pid in passages]
            seen_passages.update(ids)
            if not ids:
                continue
            first = passages[ids[0]]
            meta = by_final.get(first["url"]) or by_url.get(first["listed_url"]) or {}
            record = {key: item.get(key) for key in PROVISION_FIELDS if key in item}
            record["quote"] = item.get("quote")
            record["quote_check"] = quote_check(item.get("quote"), [passages[pid]["text"] for pid in ids])
            record.update({
                "url": first["url"], "passages": ids, "sha256": meta.get("sha256"),
                "capture": capture_of(meta),
                "verification": "read-in-full" if record["quote_check"] != "failed" else "title-only",
                "reviewer": "machine pass (Haiku), quote checked by script",
                "lead_author_decision": None,
            })
            owner = owners.get(urllib.parse.urlparse(first["url"]).netloc.lower().removeprefix("www."))
            if owner and record.get("nation") != owner:
                record["note"] = ((record.get("note") or "") + f" Nation changed from {record.get('nation')} by script: the document is on {owner}'s own website.").strip()
                record["nation"] = owner
            elif record["nation"] not in first["nations"] and first["nations"]:
                record["note"] = ((record.get("note") or "") + " Nation not among the document's citing profiles.").strip()
            provisions.append(record)
        for item in result.get("no_provision", []):
            if item.get("passage") in passages:
                seen_passages.add(item["passage"])
                no_provision.append({**item, "url": passages[item["passage"]]["url"],
                                     "nations": passages[item["passage"]]["nations"]})
    unparsed = sorted(set(passages) - seen_passages)
    provisions.sort(key=lambda record: (record.get("nation") or "", record["url"], record.get("locator") or ""))
    first_seen = {}
    for number, record in enumerate(provisions, 1):
        record["id"] = f"{record.get('nation')}#{number}"
        record.setdefault("lead_author_decision", None)
        # The same section often appears in two copies of a code (a nation's
        # site and the National Indian Law Library, or two editions). Keep
        # both rows but point the later one at the first.
        key = (record.get("nation"), squeeze(record.get("quote")).lower())
        record["duplicate_of"] = first_seen.get(key) if record.get("quote") else None
        first_seen.setdefault(key, record["id"])
    output = arguments.output
    os.makedirs(output, exist_ok=True)
    provision_count = collections.Counter(record["url"] for record in provisions)
    passage_count = collections.Counter(passage["url"] for passage in passages.values())
    documents = []
    for meta in manifest:
        final = meta.get("final_url") or meta["url"]
        documents.append({
            "url": meta["url"], "final_url": final if final != meta["url"] else None,
            "depth": meta.get("depth"), "parents": meta.get("parents") or [],
            "nations": nations_for(meta, by_url),
            "cited_by": [{key: cited.get(key) for key in ("nation", "field", "index", "kind", "title")}
                         for cited in meta.get("cited_by", [])],
            "http_status": meta.get("http_status"), "file_kind": meta.get("file_kind"),
            "page_title": meta.get("page_title"), "bytes": meta.get("bytes"),
            "characters": meta.get("characters"), "sha256": meta.get("sha256"),
            "capture": capture_of(meta), "text_layer": (meta.get("characters") or 0) >= 500 if meta.get("file_kind") == "pdf" else None,
            "duplicate_of": meta.get("duplicate_of"), "fetched": meta.get("fetched"),
            "passages": passage_count.get(final, 0), "provisions": provision_count.get(final, 0),
        })
    # Tribal legal texts are link-only by default (docs/data-model.md,
    # "Permission statuses"), so quotations stay in the private copy.
    os.makedirs(arguments.private_output, exist_ok=True)
    with open(os.path.join(arguments.private_output, "provisions-with-quotes.json"), "w", encoding="utf-8") as output_file:
        json.dump(provisions, output_file, indent=1, ensure_ascii=False)
        output_file.write("\n")
    public = [{key: value for key, value in record.items() if key != "quote"} for record in provisions]
    files = {
        "documents.json": documents,
        "provisions.json": public,
        "no-provision-passages.json": no_provision,
    }
    for file_name, data in files.items():
        # Page titles come from the fetched pages, which are not always NFC.
        with open(os.path.join(output, file_name), "w", encoding="utf-8") as output_file:
            output_file.write(unicodedata.normalize("NFC", json.dumps(data, indent=1, ensure_ascii=False)) + "\n")
    with open(os.path.join(output, "provisions.csv"), "w", encoding="utf-8", newline="") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=PROVISION_FIELDS, lineterminator="\n")
        writer.writeheader()
        for record in public:
            row = {key: record.get(key) for key in PROVISION_FIELDS}
            row["passages"] = " ".join(record["passages"])
            row["peacemaking_features"] = " ".join(record.get("peacemaking_features") or [])
            writer.writerow(row)
    counts = {
        "documents": len(documents),
        "documents_by_status": dict(collections.Counter(str(d["http_status"])[:1] + "xx" if str(d["http_status"])[:1].isdigit() else str(d["http_status"]) for d in documents)),
        "documents_with_text": sum(1 for d in documents if (d["characters"] or 0) > 200),
        "documents_with_provisions": sum(1 for d in documents if d["provisions"]),
        "passages": len(passages), "passages_unparsed": len(unparsed), "batches_missing": missing_batches,
        "provisions": len(provisions),
        "provisions_not_duplicates": sum(1 for record in provisions if not record.get("duplicate_of")),
        "nations_with_provisions": len({record.get("nation") for record in provisions}),
        "by_method": dict(collections.Counter(record.get("method") for record in provisions).most_common()),
        "by_scope": dict(collections.Counter(record.get("scope") for record in provisions)),
        "by_setting": dict(collections.Counter(record.get("setting") for record in provisions).most_common()),
        "by_subject_area": dict(collections.Counter(record.get("subject_area") for record in provisions).most_common()),
        "by_quote_check": dict(collections.Counter(record["quote_check"] for record in provisions)),
        "by_confidence": dict(collections.Counter(record.get("confidence") for record in provisions)),
        "no_provision_reasons": dict(collections.Counter(item.get("reason") for item in no_provision).most_common()),
    }
    with open(os.path.join(output, "counts.json"), "w", encoding="utf-8") as output_file:
        json.dump(counts, output_file, indent=1, ensure_ascii=False)
        output_file.write("\n")
    print(json.dumps(counts, indent=1))


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("command", choices=["targets", "fetch", "scan", "merge"])
    parser.add_argument("--work", required=True, help="private work folder (never committed)")
    parser.add_argument("--repository", default=os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    parser.add_argument("--workers", type=int, default=12)
    parser.add_argument("--child-limit", type=int, default=CHILD_LIMIT, help="fetch: most links followed from one index page")
    parser.add_argument("--output", default="research/tribal-law", help="merge: folder for the reviewable outputs")
    parser.add_argument("--private-output", default="/mnt/project-files/research/tribal-law/", help="merge: private folder for outputs that quote law text")
    arguments = parser.parse_args()
    {"targets": command_targets, "fetch": command_fetch, "scan": command_scan, "merge": command_merge}[arguments.command](arguments)


if __name__ == "__main__":
    main()
