#!/usr/bin/env python3
"""Build the source library: a full-text search index over every document in
the private bucket, for Claude and other writers to find passages with the
page they are on.

The library is one SQLite file with a full-text index (FTS5). It holds the
text of every document page by page, so a search result names the document,
the page to cite and the source records that cite the document. The text is
never committed to git and never served on the website: the file lives in the
private bucket at `_library/library.sqlite.gz`, next to the documents
themselves (decision record 0051). scripts/library/library.py downloads it and
searches it.

The usual command, after files are added to the bucket:

  update    List the bucket, download only the files the published library
            has not read, read them, rebuild and publish. It does nothing
            when there are no new files, so it is safe to run on a schedule.
            Add --ocr to read scanned pages of the new files.

The steps it runs, which can also be run one at a time (for a full rebuild):

  sync      Download every text-bearing object in the bucket (PDFs, saved web
            pages, plain text, Word files) to a work folder. Skips files
            already there with the same size, so it can be re-run.
  extract   Read the text of each downloaded document, page by page, into a
            cache of one gzipped JSON file per SHA-256 (so a duplicate is read
            once). PDF pages without a text layer are read by optical
            character recognition (Tesseract) with --ocr. A document already
            in the published library is not read again (--seed).
  index     Write the SQLite library from the cache, with the capture index's
            metadata (title, nations, topic, rights, citing records) and the
            tribal court opinions index's case names and citations.
  publish   Upload the library to the bucket with a manifest that
            library.py checks to know when its copy is out of date.

Credentials come from the environment, never from a file in the repository:
R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and CLOUDFLARE_ACCOUNT_ID (or
R2_ACCOUNT_ID). Needs boto3, pymupdf and lxml (pip install boto3 pymupdf
lxml) and, for --ocr, the tesseract program.

Usage:
  python3 scripts/library/build_library.py update --ocr
  python3 scripts/library/build_library.py sync --work ~/library-work
  python3 scripts/library/build_library.py extract --work ~/library-work [--ocr] [--seed]
  python3 scripts/library/build_library.py index --work ~/library-work
  python3 scripts/library/build_library.py publish --work ~/library-work
"""

from __future__ import annotations

import argparse
import concurrent.futures
import csv
import datetime as dt
import gzip
import hashlib
import json
import os
import re
import shutil
import sqlite3
import subprocess
import sys
import urllib.parse
import zipfile
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
CAPTURE_INDEX = REPO / "research" / "capture-index.csv"
OPINIONS_INDEX = REPO / "research" / "tribal-court-opinions" / "opinions.csv"
DEFAULT_BUCKET = "model-tribal-adr-code-sources"
LIBRARY_PREFIX = "_library/"
LIBRARY_OBJECT = LIBRARY_PREFIX + "library.sqlite.gz"
MANIFEST_OBJECT = LIBRARY_PREFIX + "manifest.json"
SCHEMA_VERSION = 2

# Objects left out. Some hold no prose to search: map tiles, seals and logos,
# the malware scanner's test files and archives (an archive's files are in
# the bucket on their own as well). The rest are the website's own files,
# which are not sources and some of which are private to the people who sent
# them: proof sent with nations' requests, files people upload, profile
# pictures, essay drafts and their versions, page versions, mail and the
# printed book's own files. A key with no file extension is left out too,
# since the website names its private files that way.
SKIPPED_PREFIXES = ("map-tiles/", "nation-images/", "scanner-check/", LIBRARY_PREFIX,
                    "requests/", "uploads/", "profile-pictures/", "essays/", "page-versions/", "mail/",
                    "events/", "offline/", "books/current/", "event-recordings/", "sponsors/",
                    "nation-pages/")
SKIPPED_SUFFIXES = (".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ico", ".pbf",
                    ".pmtiles", ".zip", ".epub", ".bin", ".ics", ".raw")
# A fetch record next to a saved Tribal law page ({"link": ..., "status": ...})
# is metadata, not text.
METADATA_JSON = re.compile(r"^tribal-law/documents/[0-9a-f]+\.json$")

# A page with fewer characters than this has no usable text layer.
EMPTY_PAGE_CHARACTERS = 40
# Long pages and pageless texts are split into passages of about this size, so
# a search result points at a short stretch of text.
PASSAGE_CHARACTERS = 3000


# ---------------------------------------------------------------- bucket


def bucket_client():
    try:
        import boto3
        from botocore.config import Config
    except ImportError:
        sys.exit("Install boto3 first: pip install boto3")
    account = os.environ.get("R2_ACCOUNT_ID") or os.environ.get("CLOUDFLARE_ACCOUNT_ID")
    key_id = os.environ.get("R2_ACCESS_KEY_ID")
    secret = os.environ.get("R2_SECRET_ACCESS_KEY")
    if not (account and key_id and secret):
        sys.exit("Set R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and CLOUDFLARE_ACCOUNT_ID first.")
    return boto3.client(
        "s3",
        endpoint_url=f"https://{account}.r2.cloudflarestorage.com",
        aws_access_key_id=key_id,
        aws_secret_access_key=secret,
        region_name="auto",
        config=Config(retries={"max_attempts": 8}, max_pool_connections=32),
    )


def bucket_name() -> str:
    return os.environ.get("R2_BUCKET", DEFAULT_BUCKET)


def wanted(key: str) -> bool:
    lowered = key.lower()
    if key.startswith(SKIPPED_PREFIXES) or lowered.endswith(SKIPPED_SUFFIXES):
        return False
    if "." not in key.rsplit("/", 1)[-1]:
        return False
    return not METADATA_JSON.match(key)


def list_bucket(client) -> list[dict]:
    objects = []
    for page in client.get_paginator("list_objects_v2").paginate(Bucket=bucket_name()):
        for item in page.get("Contents", []):
            objects.append({"key": item["Key"], "bytes": item["Size"],
                            "modified": item["LastModified"].isoformat()})
    return objects


def download_objects(client, objects_folder: Path, targets: list[dict]) -> int:
    """Download each target object into the work folder, skipping files
    already there with the same size. Returns the bytes fetched."""

    def download(item: dict) -> int:
        path = objects_folder / item["key"]
        if path.exists() and path.stat().st_size == item["bytes"]:
            return 0
        path.parent.mkdir(parents=True, exist_ok=True)
        partial = path.with_name(path.name + ".part")
        client.download_file(bucket_name(), item["key"], str(partial))
        partial.replace(path)
        return item["bytes"]

    fetched = 0
    with concurrent.futures.ThreadPoolExecutor(24) as pool:
        for number, size in enumerate(pool.map(download, targets), 1):
            fetched += size
            if number % 1000 == 0:
                print(f"{number}/{len(targets)} checked, {fetched / 1e9:.2f} GB fetched", flush=True)
    return fetched


def save_listing(work: Path, client) -> list[dict]:
    listing = list_bucket(client)
    work.mkdir(parents=True, exist_ok=True)
    (work / "bucket-listing.json").write_text(json.dumps(listing), encoding="utf-8")
    return listing


def command_sync(arguments) -> None:
    work = Path(arguments.work).expanduser()
    client = bucket_client()
    listing = save_listing(work, client)
    targets = [item for item in listing if wanted(item["key"])]
    fetched = download_objects(client, work / "objects", targets)
    print(f"{len(targets)} documents in the work folder ({len(listing)} objects in the bucket); "
          f"{fetched / 1e9:.2f} GB fetched this run.")


# ---------------------------------------------------------------- extraction


def clean(text: str) -> str:
    text = text.replace("­", "").replace("\x00", "")
    text = re.sub(r"[ \t ]+", " ", text)
    text = re.sub(r"\n[ \t]+", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def split_passages(text: str, size: int = PASSAGE_CHARACTERS) -> list[str]:
    """Split text at paragraph breaks into passages of about `size` characters."""
    text = clean(text)
    if len(text) <= size:
        return [text] if text else []
    passages, current = [], ""
    for paragraph in re.split(r"\n\s*\n|\n(?=[A-Z0-9§(])", text):
        paragraph = paragraph.strip()
        if not paragraph:
            continue
        while len(paragraph) > size:
            cut = paragraph.rfind(" ", 0, size)
            cut = cut if cut > size // 2 else size
            if current:
                passages.append(current)
                current = ""
            passages.append(paragraph[:cut].strip())
            paragraph = paragraph[cut:].strip()
        if current and len(current) + len(paragraph) + 2 > size:
            passages.append(current)
            current = paragraph
        else:
            current = f"{current}\n\n{paragraph}" if current else paragraph
    if current:
        passages.append(current)
    return passages


def ocr_page(page) -> str:
    """Read one PDF page's picture with Tesseract."""
    import pymupdf

    pixmap = page.get_pixmap(dpi=200, colorspace=pymupdf.csGRAY)
    environment = dict(os.environ, OMP_THREAD_LIMIT="1")
    result = subprocess.run(
        ["tesseract", "stdin", "stdout", "-l", "eng", "--psm", "3"],
        input=pixmap.tobytes("png"), capture_output=True, env=environment, timeout=300,
    )
    return result.stdout.decode("utf-8", "replace")


def extract_pdf(path: Path, use_ocr: bool) -> dict:
    import pymupdf

    pages, ocr_pages, empty_pages = [], 0, 0
    with pymupdf.open(path) as document:
        pdf_title = ((document.metadata or {}).get("title") or "").strip() or None
        if pdf_title and (len(pdf_title) < 4 or re.match(r"(?i)^(untitled|microsoft word|document\d*|\S+\.(docx?|pdf))", pdf_title)):
            pdf_title = None
        for number, page in enumerate(document, 1):
            text = clean(page.get_text("text", sort=True))
            method = "text-layer"
            if len(text) < EMPTY_PAGE_CHARACTERS:
                if use_ocr and page.get_images():
                    try:
                        text = clean(ocr_page(page))
                        method = "ocr"
                        ocr_pages += 1
                    except Exception as error:  # a broken page should not stop the document
                        print(f"  OCR failed on {path} page {number}: {error}", file=sys.stderr)
                if len(text) < EMPTY_PAGE_CHARACTERS:
                    empty_pages += 1
            pages.append({"page": number, "label": page.get_label() or None,
                          "method": method, "text": text})
    return {"pages": pages, "page_count": len(pages), "ocr_pages": ocr_pages,
            "empty_pages": empty_pages, "ocr_done": use_ocr, "pdf_title": pdf_title}


def remove_keeping_tail(element) -> None:
    """Remove an element but keep the text that follows it."""
    parent = element.getparent()
    if parent is None:
        return
    tail, previous = element.tail, element.getprevious()
    parent.remove(element)
    if tail:
        if previous is not None:
            previous.tail = (previous.tail or "") + tail
        else:
            parent.text = (parent.text or "") + tail


def html_text(element) -> str:
    """Text of an HTML element with line breaks at block boundaries."""
    from lxml import etree

    for removed in element.xpath(".//script|.//style|.//noscript|.//nav|.//svg|.//template|.//iframe|.//comment()"):
        remove_keeping_tail(removed)
    blocks = {"p", "div", "br", "li", "tr", "h1", "h2", "h3", "h4", "h5", "h6", "section",
              "article", "blockquote", "pre", "table", "dd", "dt", "header", "footer", "main"}
    for node in element.iter():
        if isinstance(node.tag, str) and node.tag.lower() in blocks:
            node.tail = "\n" + (node.tail or "")
    return etree.tostring(element, method="text", encoding="unicode")


def extract_html(path: Path, key: str) -> dict:
    import lxml.html

    raw = path.read_bytes()
    try:
        root = lxml.html.document_fromstring(raw)
    except Exception:
        return {"pages": [{"page": None, "label": None, "method": "html", "text": clean(raw.decode("utf-8", "replace"))}]}
    if key.startswith("caselaw-access-project/"):
        return extract_opinion(root)
    title = clean(" ".join(root.xpath("//title//text()")))
    body = root.find("body") if root.find("body") is not None else root
    # Leave out a site's menus, banners and footers, and read its main
    # content when the page marks one with enough text in it.
    for chrome in body.xpath(".//header|.//footer|.//aside|.//nav|.//*[@role='navigation' or @role='banner' or @role='contentinfo']"):
        remove_keeping_tail(chrome)
    for candidate in body.xpath(".//main|.//*[@role='main']|.//article"):
        if len(candidate.text_content().strip()) >= 500:
            body = candidate
            break
    text = clean(html_text(body))
    return {"pages": [{"page": None, "label": None, "method": "html", "text": text}], "html_title": title}


def extract_opinion(root) -> dict:
    """A Caselaw Access Project opinion, split at its star pages (*2, *3) so a
    passage carries the reporter page to cite."""
    from lxml import etree

    body = root.xpath("//section[contains(@class,'casebody')]")
    body = body[0] if body else root
    for label in body.xpath(".//a[contains(@class,'page-label')]"):
        marker = etree.Element("span")
        marker.text = f"\ue000{label.get('data-label') or ''}\ue000"
        marker.tail = label.tail
        label.getparent().replace(label, marker)
    text = html_text(body)
    pieces = text.split("\ue000")
    pages = [{"page": None, "label": "first", "method": "html", "text": clean(pieces[0])}]
    for index in range(1, len(pieces) - 1, 2):
        pages.append({"page": None, "label": pieces[index], "method": "html", "text": clean(pieces[index + 1])})
    return {"pages": [page for page in pages if page["text"]]}


def extract_word(path: Path) -> dict:
    with zipfile.ZipFile(path) as archive:
        xml = archive.read("word/document.xml").decode("utf-8", "replace")
    xml = re.sub(r"</w:p>", "\n", xml)
    xml = re.sub(r"<w:tab/>", "\t", xml)
    text = re.sub(r"<[^>]+>", "", xml)
    import html

    return {"pages": [{"page": None, "label": None, "method": "word", "text": clean(html.unescape(text))}]}


def extract_plain(path: Path) -> dict:
    raw = path.read_bytes()
    text = raw.decode("utf-8", "replace")
    if path.suffix.lower() == ".json":
        try:
            text = json.dumps(json.loads(text), indent=1, ensure_ascii=False)
        except ValueError:
            pass
    # pdftotext output keeps form feeds between pages.
    if "\f" in text:
        return {"pages": [{"page": number, "label": None, "method": "plain", "text": clean(part)}
                          for number, part in enumerate(text.split("\f"), 1) if clean(part)]}
    return {"pages": [{"page": None, "label": None, "method": "plain", "text": clean(text)}]}


def sniff(path: Path) -> str:
    with path.open("rb") as handle:
        head = handle.read(512)
    if head.startswith(b"%PDF") or b"%PDF-" in head[:64]:
        return "pdf"
    if head.startswith(b"PK"):
        return "word"
    lowered = head.lower()
    if b"<html" in lowered or b"<!doctype html" in lowered or b"<head" in lowered or b"<body" in lowered:
        return "html"
    return "plain"


def extract_one(job: tuple[str, str, str, bool]) -> tuple[str, str, dict | None, str | None]:
    key, path_text, sha256, use_ocr = job
    path = Path(path_text)
    try:
        kind = sniff(path)
        if kind == "pdf":
            result = extract_pdf(path, use_ocr)
        elif kind == "html":
            result = extract_html(path, key)
        elif kind == "word":
            result = extract_word(path)
        else:
            result = extract_plain(path)
        result["format"] = kind
        result["characters"] = sum(len(page["text"]) for page in result["pages"])
        return key, sha256, result, None
    except Exception as error:
        return key, sha256, None, f"{type(error).__name__}: {error}"


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1 << 20), b""):
            digest.update(block)
    return digest.hexdigest()


def load_capture_index() -> dict[str, dict]:
    with CAPTURE_INDEX.open(encoding="utf-8", newline="") as handle:
        return {row["key"]: row for row in csv.DictReader(handle)}


def known_files(work: Path) -> dict[tuple[str, int], str]:
    """The files an earlier library read, as (key, bytes) -> SHA-256, from
    the copy of the library in the work folder."""
    database = library_path(work)
    if not database.exists():
        return {}
    connection = sqlite3.connect(database)
    try:
        return {(key, size): sha256 for key, size, sha256 in connection.execute(
            "SELECT key, bytes, sha256 FROM bucket_files WHERE sha256 IS NOT NULL")}
    except sqlite3.OperationalError:
        return {}
    finally:
        connection.close()


def inventory(work: Path, captures: dict[str, dict]) -> list[dict]:
    """Every text-bearing object in the bucket listing, with its SHA-256 when
    known (from an earlier library, the capture index or the downloaded file)
    and its local path when downloaded. A text extract the capture index
    lists as derived from another file is marked, since the other file is
    read instead."""
    listing_file = work / "bucket-listing.json"
    if not listing_file.exists():
        sys.exit("No bucket listing in the work folder: run sync or update first.")
    listing = json.loads(listing_file.read_text(encoding="utf-8"))
    derived = {row["key"] for row in captures.values() if row.get("derived_from")}
    known = known_files(work)
    objects_folder = work / "objects"
    files = []
    for item in listing:
        key, size = item["key"], item["bytes"]
        if not wanted(key):
            continue
        path = objects_folder / key
        path = path if path.is_file() and path.stat().st_size == size else None
        row = captures.get(key) or {}
        sha256 = known.get((key, size))
        if not sha256 and row.get("sha256") and str(size) == row.get("bytes"):
            sha256 = row["sha256"]
        if not sha256 and path:
            sha256 = file_sha256(path)
        files.append({"key": key, "bytes": size, "sha256": sha256, "path": path,
                      "derived": key in derived})
    return files


def extract_cache_path(work: Path, sha256: str) -> Path:
    return work / "extracts" / sha256[:2] / f"{sha256}.json.gz"


def fetch_published(work: Path, client=None) -> Path | None:
    """Put the published library in the work folder, unless the copy there is
    already the published one. Returns its path, or None if none is published."""
    client = client or bucket_client()
    database = library_path(work)
    stamp = work / "library.manifest.json"
    try:
        manifest = json.loads(client.get_object(Bucket=bucket_name(), Key=MANIFEST_OBJECT)["Body"].read())
    except Exception:
        return database if database.exists() else None
    if database.exists() and stamp.exists():
        if json.loads(stamp.read_text(encoding="utf-8")).get("sha256") == manifest.get("sha256"):
            return database
    work.mkdir(parents=True, exist_ok=True)
    compressed = Path(str(database) + ".download.gz")
    print(f"Downloading the published library (built {manifest.get('built')})...", flush=True)
    client.download_file(bucket_name(), LIBRARY_OBJECT, str(compressed))
    with gzip.open(compressed, "rb") as source, database.open("wb") as target:
        shutil.copyfileobj(source, target, 1 << 22)
    compressed.unlink()
    stamp.write_text(json.dumps(manifest, indent=1), encoding="utf-8")
    return database


def seed_from_library(work: Path) -> int:
    """Write cache files from the library in the work folder (fetching the
    published one first), so documents read in an earlier build, including
    their OCR, are not read again."""
    database = fetch_published(work)
    if database is None:
        print("No published library to seed from.")
        return 0
    return seed_cache_from(work, database)


def seed_cache_from(work: Path, database: Path, replace: bool = False) -> int:
    """Write a cache file for each document in a library. The library keeps
    passages, not whole pages, so each page's passages are kept as they are
    (with the page count and character count the library recorded): the
    next build then gives the document the same passages, the same text
    digest and the same numbers, and the website's copy sees no change.
    (Before this, the passages were seeded as if each were a page, which
    renumbered every document with more than one passage on a page.)"""
    connection = sqlite3.connect(database)
    seeded = 0
    for document_id, sha256, extraction, page_count, characters in connection.execute(
            "SELECT document_id, sha256, extraction, page_count, characters FROM documents"):
        cache = extract_cache_path(work, sha256)
        if cache.exists() and not replace:
            continue
        result = json.loads(extraction)
        result["page_count"] = page_count
        result["characters"] = characters
        pages: list[dict] = []
        for page, label, part, method, text in connection.execute(
                "SELECT page, label, part, method, text FROM pages WHERE document_id = ? ORDER BY sequence",
                (document_id,)):
            if pages and part > 1 and pages[-1]["page"] == page:
                pages[-1]["passages"].append(text)
            else:
                pages.append({"page": page, "label": label, "method": method, "passages": [text]})
        for page in pages:
            page["text"] = "\n\n".join(page["passages"])
        result["pages"] = pages
        cache.parent.mkdir(parents=True, exist_ok=True)
        with gzip.open(cache, "wt", encoding="utf-8") as handle:
            json.dump(result, handle, ensure_ascii=False)
        seeded += 1
    connection.close()
    return seeded


def command_extract(arguments) -> None:
    work = Path(arguments.work).expanduser()
    if arguments.seed:
        print(f"Seeded {seed_from_library(work)} documents from the published library.")
    captures = load_capture_index()
    jobs, seen = [], set()
    for item in inventory(work, captures):
        key, path, sha256 = item["key"], item["path"], item["sha256"]
        if item["derived"] or path is None or sha256 in seen:
            continue
        seen.add(sha256)
        cache = extract_cache_path(work, sha256)
        if cache.exists():
            if not arguments.ocr:
                continue
            with gzip.open(cache, "rt", encoding="utf-8") as handle:
                previous = json.load(handle)
            # Read again only a PDF with empty pages that has not had OCR yet.
            if previous.get("format") != "pdf" or previous.get("ocr_done") or not previous.get("empty_pages"):
                continue
        jobs.append((key, str(path), sha256, arguments.ocr))
    if arguments.limit:
        jobs = jobs[: arguments.limit]
    # Small files first, so most of the library is ready early.
    jobs.sort(key=lambda job: Path(job[1]).stat().st_size)
    print(f"{len(jobs)} documents to read ({len(seen)} distinct files).", flush=True)
    failures = []
    with concurrent.futures.ProcessPoolExecutor(arguments.workers) as pool:
        for number, (key, sha256, result, error) in enumerate(
                pool.map(extract_one, jobs, chunksize=4), 1):
            if error:
                failures.append({"key": key, "error": error})
            else:
                cache = extract_cache_path(work, sha256)
                cache.parent.mkdir(parents=True, exist_ok=True)
                with gzip.open(cache, "wt", encoding="utf-8") as handle:
                    json.dump(result, handle, ensure_ascii=False)
            if number % 250 == 0:
                print(f"{number}/{len(jobs)} read, {len(failures)} failed", flush=True)
    (work / "extract-failures.json").write_text(json.dumps(failures, indent=1), encoding="utf-8")
    print(f"Done: {len(jobs) - len(failures)} read, {len(failures)} failed (extract-failures.json).")


# ---------------------------------------------------------------- index


SCHEMA = """
CREATE TABLE meta (name TEXT PRIMARY KEY, value TEXT);
CREATE TABLE documents (
  document_id INTEGER PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,          -- the object key in the bucket (first of its copies)
  other_keys TEXT,                   -- JSON list of other keys with the same bytes
  sha256 TEXT NOT NULL UNIQUE,
  bytes INTEGER,
  format TEXT,                       -- pdf, html, word, plain
  media_type TEXT,
  topic TEXT,
  title TEXT,
  citation TEXT,                     -- a case citation, for court opinions
  court TEXT,
  decided TEXT,
  nations TEXT,                      -- semicolon-separated nation record ids
  records TEXT,                      -- semicolon-separated records that cite the document
  record_kinds TEXT,
  link TEXT,                         -- where the document was published
  captured TEXT,
  obtained TEXT,
  rights TEXT,
  redistribution TEXT,
  served INTEGER NOT NULL DEFAULT 0, -- 1 when the website serves it at /copies/<key>
  page_count INTEGER,
  characters INTEGER,
  ocr_pages INTEGER NOT NULL DEFAULT 0,
  empty_pages INTEGER NOT NULL DEFAULT 0,
  text_status TEXT,                  -- full, partial, none
  text_digest TEXT,                  -- changes when the passages change (OCR, a new reader)
  metadata_digest TEXT,              -- changes when the title, nations, records or rights change
  extraction TEXT                    -- JSON: the extraction summary, without the text
);
CREATE TABLE pages (
  passage_id INTEGER PRIMARY KEY,
  document_id INTEGER NOT NULL REFERENCES documents(document_id),
  sequence INTEGER NOT NULL,         -- order within the document
  page INTEGER,                      -- the PDF page number, from 1; null for pageless text
  label TEXT,                        -- printed page label or reporter star page, when known
  part INTEGER NOT NULL DEFAULT 1,   -- passage number within a long page
  method TEXT,                       -- text-layer, ocr, html, plain, word
  text TEXT NOT NULL
);
CREATE INDEX pages_by_document ON pages(document_id, sequence);
CREATE TABLE citing_records (record TEXT NOT NULL, document_id INTEGER NOT NULL);
CREATE INDEX citing_records_by_record ON citing_records(record);
CREATE TABLE bucket_files (
  key TEXT PRIMARY KEY,
  bytes INTEGER,
  sha256 TEXT,
  document_id INTEGER,               -- the document holding this file's text
  status TEXT                        -- document, same-file-as-document, text-extract-of-another-file, not-read
);
CREATE TABLE document_nations (nation TEXT NOT NULL, document_id INTEGER NOT NULL);
CREATE INDEX document_nations_by_nation ON document_nations(nation);
CREATE VIRTUAL TABLE pages_search USING fts5(
  text, content='pages', content_rowid='passage_id',
  tokenize='porter unicode61 remove_diacritics 2'
);
CREATE VIRTUAL TABLE documents_search USING fts5(
  title, citation, nations, key, content='documents', content_rowid='document_id',
  tokenize='porter unicode61 remove_diacritics 2'
);
"""


TRIBAL_LAW_CATALOG = REPO / "research" / "tribal-law" / "documents.json"


def load_catalog_titles() -> dict[str, str]:
    """Titles for the Tribal law captures, by SHA-256, from the collection's
    catalog: the title a profile cites the document by, else the page's own."""
    if not TRIBAL_LAW_CATALOG.exists():
        return {}
    titles = {}
    for entry in json.loads(TRIBAL_LAW_CATALOG.read_text(encoding="utf-8")):
        cited = []
        for citation in entry.get("cited_by") or []:
            if citation.get("title") and citation["title"] not in cited:
                cited.append(citation["title"])
        title = "; ".join(cited[:2]) or (entry.get("page_title") or "").strip()
        if entry.get("sha256") and title:
            titles[entry["sha256"]] = title
    return titles


def title_from_link(link: str | None) -> str | None:
    """A readable name from the last part of an address, such as
    titles-1---23.pdf -> "titles 1 23"."""
    if not link:
        return None
    name = urllib.parse.unquote(link.rstrip("/").rsplit("/", 1)[-1])
    name = re.sub(r"\.(pdf|html?|aspx?|php|docx?)$", "", name, flags=re.IGNORECASE)
    name = re.sub(r"[-_+]+", " ", name).strip()
    return name if len(name) >= 4 and not re.fullmatch(r"[0-9a-f ]+", name) else None


def load_opinions() -> dict[str, dict]:
    if not OPINIONS_INDEX.exists():
        return {}
    with OPINIONS_INDEX.open(encoding="utf-8", newline="") as handle:
        return {row["copy_key"]: row for row in csv.DictReader(handle) if row.get("copy_key")}


def library_path(work: Path) -> Path:
    return work / "library.sqlite"


def guess_topic(key: str) -> str:
    return key.split("/", 1)[0]


def previous_identities(database: Path) -> tuple[dict, int, int]:
    """The document and passage numbers an earlier library gave each version
    of a document, so a rebuild keeps them: (sha256, text digest) ->
    (document_id, [passage_id, ...]), with the highest numbers used."""
    if not database.exists():
        return {}, 0, 0
    connection = sqlite3.connect(database)
    try:
        identities = {}
        for document_id, sha256, text_digest in connection.execute(
                "SELECT document_id, sha256, text_digest FROM documents"):
            passages = [row[0] for row in connection.execute(
                "SELECT passage_id FROM pages WHERE document_id = ? ORDER BY sequence", (document_id,))]
            identities[(sha256, text_digest)] = (document_id, passages)
        highest_document = connection.execute("SELECT COALESCE(MAX(document_id), 0) FROM documents").fetchone()[0]
        highest_passage = connection.execute("SELECT COALESCE(MAX(passage_id), 0) FROM pages").fetchone()[0]
        return identities, highest_document, highest_passage
    except sqlite3.OperationalError:  # a library from before stable numbers
        return {}, 0, 0
    finally:
        connection.close()


DOCUMENT_COLUMNS = ("document_id", "key", "other_keys", "sha256", "bytes", "format", "media_type", "topic",
                    "title", "citation", "court", "decided", "nations", "records", "record_kinds", "link",
                    "captured", "obtained", "rights", "redistribution", "served", "page_count", "characters",
                    "ocr_pages", "empty_pages", "text_status", "text_digest", "metadata_digest", "extraction")


def command_index(arguments) -> None:
    work = Path(arguments.work).expanduser()
    captures = load_capture_index()
    opinions = load_opinions()
    catalog_titles = load_catalog_titles()
    files = inventory(work, captures)
    by_hash: dict[str, list[str]] = {}
    for item in files:
        if item["sha256"] and not item["derived"]:
            by_hash.setdefault(item["sha256"], []).append(item["key"])

    database = library_path(work)
    identities, highest_document, highest_passage = previous_identities(database)
    temporary = database.with_suffix(".building")
    temporary.unlink(missing_ok=True)
    connection = sqlite3.connect(temporary)
    connection.execute("PRAGMA journal_mode = OFF")
    connection.execute("PRAGMA synchronous = OFF")
    connection.executescript(SCHEMA)

    sizes = {item["key"]: item["bytes"] for item in files}
    document_of_hash: dict[str, int] = {}
    documents = pages_written = missing = kept = 0
    for sha256, keys in sorted(by_hash.items(), key=lambda item: item[1][0]):
        # Prefer the copy a record cites, then the shortest key.
        keys.sort(key=lambda key: (not (captures.get(key) or {}).get("records"), len(key), key))
        key = keys[0]
        cache = extract_cache_path(work, sha256)
        if not cache.exists():
            missing += 1
            continue
        with gzip.open(cache, "rt", encoding="utf-8") as handle:
            result = json.load(handle)
        row = {}
        for candidate in keys:  # merge metadata across copies
            for field, value in (captures.get(candidate) or {}).items():
                if value and not row.get(field):
                    row[field] = value
        records = sorted({record for candidate in keys
                          for record in (captures.get(candidate) or {}).get("records", "").split(";") if record})
        nations = sorted({nation for candidate in keys
                          for nation in (captures.get(candidate) or {}).get("nations", "").split(";") if nation})
        opinion = opinions.get(key, {})
        if opinion.get("nations"):
            nations = sorted(set(nations) | set(opinion["nations"].split(";")))
        title = (opinion.get("name") or row.get("title") or catalog_titles.get(sha256) or result.get("html_title")
                 or result.get("pdf_title") or title_from_link(row.get("link")) or key.rsplit("/", 1)[-1])
        page_list = result["pages"]
        # A page seeded from an earlier library carries its passages and the
        # character count that library recorded (seed_cache_from).
        characters = result.get("characters")
        if characters is None:
            characters = sum(len(page["text"]) for page in page_list)
        empty = result.get("empty_pages", 0)
        page_count = result.get("page_count") or len(page_list)
        if characters < EMPTY_PAGE_CHARACTERS:
            status = "none"
        elif result.get("format") == "pdf" and empty and empty / max(page_count, 1) > 0.1:
            status = "partial"
        else:
            status = "full"
        media_type = row.get("media_type") or {"pdf": "application/pdf", "html": "text/html"}.get(result.get("format"), "")
        served = int(row.get("redistribution") == "yes" and media_type in ("application/pdf", "text/html"))
        summary = {name: value for name, value in result.items() if name != "pages"}

        first_page = None
        if opinion.get("citation"):
            match = re.search(r"(\d+)\s*$", opinion["citation"])
            first_page = match.group(1) if match else None
        passages = []
        for page in page_list:
            label = page.get("label")
            if label == "first":
                label = first_page
            texts = page["passages"] if "passages" in page else split_passages(page["text"])
            for part, text in enumerate(texts, 1):
                passages.append((page.get("page"), label, part, page.get("method"), text))
        text_digest = hashlib.sha256(json.dumps(passages, ensure_ascii=False).encode()).hexdigest()[:32]

        previous = identities.get((sha256, text_digest))
        if previous and len(previous[1]) == len(passages):
            document_id, passage_ids = previous
            kept += 1
        else:
            highest_document += 1
            document_id = highest_document
            passage_ids = list(range(highest_passage + 1, highest_passage + 1 + len(passages)))
            highest_passage += len(passages)

        values = {
            "document_id": document_id, "key": key,
            "other_keys": json.dumps(keys[1:]) if len(keys) > 1 else None, "sha256": sha256,
            "bytes": sizes.get(key), "format": result.get("format"), "media_type": media_type,
            "topic": row.get("topic") or guess_topic(key), "title": title,
            "citation": opinion.get("citation") or None, "court": opinion.get("court") or None,
            "decided": opinion.get("decision_date") or None, "nations": ";".join(nations),
            "records": ";".join(records), "record_kinds": row.get("record_kinds"),
            "link": row.get("link") or opinion.get("link"), "captured": row.get("captured"),
            "obtained": row.get("obtained"), "rights": row.get("rights"),
            "redistribution": row.get("redistribution"), "served": served, "page_count": page_count,
            "characters": characters, "ocr_pages": result.get("ocr_pages", 0), "empty_pages": empty,
            "text_status": status, "text_digest": text_digest, "extraction": json.dumps(summary),
        }
        values["metadata_digest"] = hashlib.sha256(json.dumps(
            [values[column] for column in DOCUMENT_COLUMNS if column not in ("metadata_digest", "extraction")],
            ensure_ascii=False).encode()).hexdigest()[:32]
        connection.execute(
            f"INSERT INTO documents ({', '.join(DOCUMENT_COLUMNS)}) VALUES ({', '.join('?' for _ in DOCUMENT_COLUMNS)})",
            [values[column] for column in DOCUMENT_COLUMNS])
        document_of_hash[sha256] = document_id
        documents += 1
        for record in records:
            connection.execute("INSERT INTO citing_records VALUES (?, ?)", (record, document_id))
        for nation in nations:
            connection.execute("INSERT INTO document_nations VALUES (?, ?)", (nation, document_id))
        connection.executemany(
            "INSERT INTO pages (passage_id, document_id, sequence, page, label, part, method, text) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            [(passage_id, document_id, sequence, *passage)
             for sequence, (passage_id, passage) in enumerate(zip(passage_ids, passages), 1)])
        pages_written += len(passages)
        if documents % 2000 == 0:
            print(f"{documents} documents, {pages_written} passages", flush=True)

    # Every text-bearing file in the bucket and what became of it, so an
    # update can tell new files from ones already read.
    primary_keys = dict(connection.execute("SELECT document_id, key FROM documents"))
    for item in files:
        document_id = document_of_hash.get(item["sha256"])
        if item["derived"]:
            status = "text-extract-of-another-file"
        elif document_id is None:
            status = "not-read"
        else:
            status = "document" if primary_keys[document_id] == item["key"] else "same-file-as-document"
        connection.execute("INSERT INTO bucket_files VALUES (?, ?, ?, ?, ?)",
                           (item["key"], item["bytes"], item["sha256"] if status != "not-read" else None,
                            document_id, status))
    connection.execute("INSERT INTO pages_search(pages_search) VALUES ('rebuild')")
    connection.execute("INSERT INTO documents_search(documents_search) VALUES ('rebuild')")
    built = dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()
    previous_build = None
    if database.exists():
        try:
            previous_connection = sqlite3.connect(database)
            previous_build = dict(previous_connection.execute("SELECT name, value FROM meta")).get("built")
            previous_connection.close()
        except sqlite3.OperationalError:
            previous_build = None
    for name, value in {"schema_version": SCHEMA_VERSION, "built": built, "previous_build": previous_build or "",
                        "documents": documents, "passages": pages_written, "files": len(files),
                        "not_yet_read": missing}.items():
        connection.execute("INSERT INTO meta VALUES (?, ?)", (name, str(value)))
    connection.commit()
    connection.execute("INSERT INTO pages_search(pages_search) VALUES ('optimize')")
    connection.commit()
    connection.execute("VACUUM")
    connection.close()
    if database.exists():
        database.replace(work / "library.previous.sqlite")
    temporary.replace(database)
    print(f"Wrote {database}: {documents} documents ({kept} unchanged from the last build), "
          f"{pages_written} passages, {missing} documents not yet read, {database.stat().st_size / 1e9:.2f} GB.")


# ---------------------------------------------------------------- the website's copy (D1)
#
# The workspace's library search (site/src/routes/workspace/library) reads a
# copy of the library in its own D1 database, model-tribal-adr-code-library.
# Each publish writes the changes since the last build as SQL files in the
# bucket under _library/d1/; the website's hourly run applies them in order
# (site/src/lib/server/source-library.ts). The first build, with nothing to
# compare against, writes the whole library as change files from an empty
# database, which the hourly runs load over a few hours. To reload the copy
# from scratch (after emptying the D1 database), run `publish --d1-whole`.
# `d1-sql` writes the whole library as one file for D1's own import instead,
# which is faster when a Cloudflare API token is at hand.

D1_PREFIX = LIBRARY_PREFIX + "d1/"
D1_PART_BYTES = 1_000_000
D1_STATEMENT_BYTES = 90_000
D1_TABLES = """
CREATE TABLE IF NOT EXISTS meta (name TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS documents (
  document_id INTEGER PRIMARY KEY, key TEXT NOT NULL, other_keys TEXT, sha256 TEXT NOT NULL, bytes INTEGER,
  format TEXT, media_type TEXT, topic TEXT, title TEXT, citation TEXT, court TEXT, decided TEXT, nations TEXT,
  records TEXT, record_kinds TEXT, link TEXT, captured TEXT, obtained TEXT, rights TEXT, redistribution TEXT,
  served INTEGER NOT NULL DEFAULT 0, page_count INTEGER, characters INTEGER, ocr_pages INTEGER NOT NULL DEFAULT 0,
  empty_pages INTEGER NOT NULL DEFAULT 0, text_status TEXT, text_digest TEXT, metadata_digest TEXT);
CREATE INDEX IF NOT EXISTS documents_by_key ON documents(key);
CREATE INDEX IF NOT EXISTS documents_by_topic ON documents(topic);
CREATE TABLE IF NOT EXISTS pages (
  passage_id INTEGER PRIMARY KEY, document_id INTEGER NOT NULL, sequence INTEGER NOT NULL, page INTEGER,
  label TEXT, part INTEGER NOT NULL DEFAULT 1, method TEXT, text TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS pages_by_document ON pages(document_id, sequence);
CREATE TABLE IF NOT EXISTS citing_records (record TEXT NOT NULL, document_id INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS citing_records_by_record ON citing_records(record);
CREATE INDEX IF NOT EXISTS citing_records_by_document ON citing_records(document_id);
CREATE TABLE IF NOT EXISTS document_nations (nation TEXT NOT NULL, document_id INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS document_nations_by_nation ON document_nations(nation);
CREATE INDEX IF NOT EXISTS document_nations_by_document ON document_nations(document_id);
CREATE VIRTUAL TABLE IF NOT EXISTS pages_search USING fts5(
  text, content='pages', content_rowid='passage_id', tokenize='porter unicode61 remove_diacritics 2');
CREATE VIRTUAL TABLE IF NOT EXISTS documents_search USING fts5(
  title, citation, nations, key, content='documents', content_rowid='document_id',
  tokenize='porter unicode61 remove_diacritics 2');
"""
D1_DOCUMENT_COLUMNS = tuple(column for column in DOCUMENT_COLUMNS if column != "extraction")


def sql_literal(value) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, (int, float)):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def d1_remove(document_id: int, keep_pages: bool = False) -> list[str]:
    """Statements that take a document out of the D1 copy (safe to repeat)."""
    statements = [
        "INSERT INTO documents_search(documents_search, rowid, title, citation, nations, key) "
        f"SELECT 'delete', document_id, title, citation, nations, key FROM documents WHERE document_id = {document_id};",
        f"DELETE FROM document_nations WHERE document_id = {document_id};",
        f"DELETE FROM citing_records WHERE document_id = {document_id};",
        f"DELETE FROM documents WHERE document_id = {document_id};",
    ]
    if not keep_pages:
        statements[1:1] = [
            "INSERT INTO pages_search(pages_search, rowid, text) "
            f"SELECT 'delete', passage_id, text FROM pages WHERE document_id = {document_id};",
            f"DELETE FROM pages WHERE document_id = {document_id};",
        ]
    return statements


def d1_add(connection: sqlite3.Connection, document_id: int, with_pages: bool = True) -> list[str]:
    """Statements that put a document from the library into the D1 copy."""
    row = connection.execute(
        f"SELECT {', '.join(D1_DOCUMENT_COLUMNS)} FROM documents WHERE document_id = ?", (document_id,)).fetchone()
    statements = [f"INSERT INTO documents ({', '.join(D1_DOCUMENT_COLUMNS)}) VALUES "
                  f"({', '.join(sql_literal(value) for value in row)});"]
    for (nation,) in connection.execute("SELECT nation FROM document_nations WHERE document_id = ?", (document_id,)):
        statements.append(f"INSERT INTO document_nations VALUES ({sql_literal(nation)}, {document_id});")
    for (record,) in connection.execute("SELECT record FROM citing_records WHERE document_id = ?", (document_id,)):
        statements.append(f"INSERT INTO citing_records VALUES ({sql_literal(record)}, {document_id});")
    statements.append("INSERT INTO documents_search(rowid, title, citation, nations, key) "
                      f"SELECT document_id, title, citation, nations, key FROM documents WHERE document_id = {document_id};")
    if with_pages:
        head = "INSERT INTO pages (passage_id, document_id, sequence, page, label, part, method, text) VALUES "
        values: list[str] = []
        size = len(head)
        for page_row in connection.execute(
                "SELECT passage_id, document_id, sequence, page, label, part, method, text FROM pages "
                "WHERE document_id = ? ORDER BY sequence", (document_id,)):
            value = "(" + ", ".join(sql_literal(item) for item in page_row) + ")"
            if values and size + len(value.encode()) + 2 > D1_STATEMENT_BYTES:
                statements.append(head + ", ".join(values) + ";")
                values, size = [], len(head)
            values.append(value)
            size += len(value.encode()) + 2
        if values:
            statements.append(head + ", ".join(values) + ";")
        statements.append("INSERT INTO pages_search(rowid, text) "
                          f"SELECT passage_id, text FROM pages WHERE document_id = {document_id};")
    return statements


def d1_change_statements(previous: Path | None, current: Path) -> list[list[str]]:
    """Groups of statements (one group per document) that turn the D1 copy
    of the previous library into the current one."""
    connection = sqlite3.connect(current)
    groups: list[list[str]] = [[part.strip() + ";" for part in D1_TABLES.split(";") if part.strip()]]
    now_documents = {document_id: (text_digest, metadata_digest) for document_id, text_digest, metadata_digest in
                     connection.execute("SELECT document_id, text_digest, metadata_digest FROM documents")}
    before: dict[int, tuple[str, str]] = {}
    if previous and previous.exists():
        old = sqlite3.connect(previous)
        try:
            before = {document_id: (text_digest, metadata_digest) for document_id, text_digest, metadata_digest in
                      old.execute("SELECT document_id, text_digest, metadata_digest FROM documents")}
        except sqlite3.OperationalError:
            before = {}
        old.close()
    for document_id in sorted(set(before) - set(now_documents)):
        groups.append(d1_remove(document_id))
    for document_id in sorted(now_documents):
        if document_id not in before:
            groups.append(d1_remove(document_id) + d1_add(connection, document_id))
        elif before[document_id][0] != now_documents[document_id][0]:
            groups.append(d1_remove(document_id) + d1_add(connection, document_id))
        elif before[document_id][1] != now_documents[document_id][1]:
            groups.append(d1_remove(document_id, keep_pages=True) + d1_add(connection, document_id, with_pages=False))
    connection.close()
    return groups


def d1_parts(groups: list[list[str]], build: str) -> list[str]:
    """Pack statement groups into parts of about D1_PART_BYTES, never
    splitting a document's group, and end with the build marker."""
    parts, current, size = [], [], 0
    for group in groups:
        text = "\n".join(group) + "\n"
        if current and size + len(text.encode()) > D1_PART_BYTES:
            parts.append("".join(current))
            current, size = [], 0
        current.append(text)
        size += len(text.encode())
    current.append(f"INSERT OR REPLACE INTO meta VALUES ('build', {sql_literal(build)});\n")
    parts.append("".join(current))
    return parts


def publish_d1_changes(work: Path, client, previous: Path | None, current: Path, full: bool = False) -> dict:
    connection = sqlite3.connect(current)
    meta = dict(connection.execute("SELECT name, value FROM meta"))
    connection.close()
    build = meta["built"]
    start = "" if full or previous is None else (meta.get("previous_build") or "")
    parts = d1_parts(d1_change_statements(None if full else previous, current), build)
    stamp = build.replace(":", "").replace("+", "Z")
    keys = []
    for number, text in enumerate(parts, 1):
        key = f"{D1_PREFIX}changes/{stamp}/part-{number:05d}.sql"
        client.put_object(Bucket=bucket_name(), Key=key, Body=text.encode("utf-8"), ContentType="application/sql")
        keys.append(key)
    change_set = {"from": start, "to": build, "parts": keys,
                  "bytes": sum(len(text.encode()) for text in parts)}
    try:
        latest = json.loads(client.get_object(Bucket=bucket_name(), Key=D1_PREFIX + "latest.json")["Body"].read())
    except Exception:
        latest = {"chain": []}
    chain = [link for link in latest.get("chain", []) if link["to"] != build] + [change_set]
    latest = {"build": build, "chain": chain[-60:]}
    client.put_object(Bucket=bucket_name(), Key=D1_PREFIX + "latest.json",
                      Body=json.dumps(latest, indent=1).encode(), ContentType="application/json")
    return {"from": start, "to": build, "parts": len(keys), "bytes": change_set["bytes"]}


def command_d1_sql(arguments) -> None:
    """Write the whole library as one SQL file for D1's import (first load)."""
    work = Path(arguments.work).expanduser()
    current = library_path(work)
    connection = sqlite3.connect(current)
    build = dict(connection.execute("SELECT name, value FROM meta"))["built"]
    connection.close()
    output = Path(arguments.out).expanduser()
    with output.open("w", encoding="utf-8") as handle:
        for part in d1_parts(d1_change_statements(None, current), build):
            handle.write(part)
    print(f"Wrote {output} ({output.stat().st_size / 1e9:.2f} GB) for build {build}.")


def command_publish(arguments) -> None:
    work = Path(arguments.work).expanduser()
    database = library_path(work)
    compressed = Path(str(database) + ".gz")
    with database.open("rb") as source, gzip.open(compressed, "wb", compresslevel=6) as target:
        shutil.copyfileobj(source, target, 1 << 22)
    connection = sqlite3.connect(database)
    meta = dict(connection.execute("SELECT name, value FROM meta"))
    connection.close()
    manifest = {**meta, "object": LIBRARY_OBJECT, "bytes": database.stat().st_size,
                "compressed_bytes": compressed.stat().st_size, "sha256": file_sha256(compressed)}
    client = bucket_client()
    client.upload_file(str(compressed), bucket_name(), LIBRARY_OBJECT,
                       ExtraArgs={"ContentType": "application/gzip",
                                  "Metadata": {"sha256": manifest["sha256"]}})
    client.put_object(Bucket=bucket_name(), Key=MANIFEST_OBJECT, Body=json.dumps(manifest, indent=1).encode(),
                      ContentType="application/json")
    (work / "library.manifest.json").write_text(json.dumps(manifest, indent=1), encoding="utf-8")
    previous = work / "library.previous.sqlite"
    manifest["d1_changes"] = publish_d1_changes(work, client, previous if previous.exists() else None, database,
                                                full=getattr(arguments, "d1_whole", False))
    print(json.dumps(manifest, indent=1))


def command_update(arguments) -> None:
    """List the bucket, read only the files no published library has read,
    rebuild and publish. Does nothing when the bucket has no new files."""
    work = Path(arguments.work).expanduser()
    client = bucket_client()
    listing = save_listing(work, client)
    fetch_published(work, client)
    known = known_files(work)
    captures = load_capture_index()
    derived = {row["key"] for row in captures.values() if row.get("derived_from")}
    new = [item for item in listing if wanted(item["key"]) and item["key"] not in derived
           and (item["key"], item["bytes"]) not in known]
    if not new and not arguments.force:
        print(f"The library is up to date: no new files among {len(listing)} objects in the bucket.")
        return
    print(f"{len(new)} new or changed files to read.", flush=True)
    download_objects(client, work / "objects", new)
    arguments.seed = True
    arguments.limit = 0
    command_extract(arguments)
    command_index(arguments)
    command_publish(arguments)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    commands = parser.add_subparsers(dest="command", required=True)
    d1_command = commands.add_parser("d1-sql")
    d1_command.add_argument("--work", default="~/library-work")
    d1_command.add_argument("--out", required=True, help="the SQL file to write")
    for name in ("update", "sync", "extract", "index", "publish"):
        command = commands.add_parser(name)
        command.add_argument("--work", default="~/library-work", help="work folder (outside the repository)")
        if name == "update":
            command.add_argument("--force", action="store_true", help="rebuild even with no new files")
        if name == "publish":
            command.add_argument("--d1-whole", action="store_true",
                                 help="write the whole library as change files from an empty database")
        if name in ("extract", "update"):
            command.add_argument("--ocr", action="store_true", help="read pages without a text layer with Tesseract")
            command.add_argument("--seed", action="store_true", help="reuse text from the published library")
            command.add_argument("--workers", type=int, default=os.cpu_count() or 2)
            command.add_argument("--limit", type=int, default=0)
    arguments = parser.parse_args()
    {"d1-sql": command_d1_sql, "update": command_update, "sync": command_sync, "extract": command_extract, "index": command_index,
     "publish": command_publish}[arguments.command](arguments)


if __name__ == "__main__":
    main()
