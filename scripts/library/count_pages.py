#!/usr/bin/env python3
"""Count the pages of every PDF the website may serve, for the Statistics page
and nation pages, which give documents and their pages separately (Trevor,
Nov. 27, 2026: "in statistics, we should denote documents and pages
separately").

The counts go to research/copy-pages.csv, one row per file by SHA-256, so the
site can count pages while it is built without reaching the bucket. A file
the source library has read (scripts/library/library.py) takes its page count
from there; any other file is downloaded from the bucket, counted and thrown
away. Files already in the CSV are not counted again, so the script is safe to
re-run after new files are added to the capture index.

Only PDFs have pages here: a saved web page or a plain text file has no
printed pages, and a JPEG picture is counted as a picture, not a page.

Credentials come from the environment, never from a file in the repository:
R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and CLOUDFLARE_ACCOUNT_ID (or
R2_ACCOUNT_ID). Needs boto3 and pymupdf (pip install boto3 pymupdf).

Usage:
  python3 scripts/library/count_pages.py [--workers 16] [--no-library]
"""

from __future__ import annotations

import argparse
import concurrent.futures
import csv
import sqlite3
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import library  # noqa: E402  (scripts/library/library.py: the bucket client and the library's local copy)

ROOT = Path(__file__).resolve().parents[2]
CAPTURE_INDEX = ROOT / "research" / "capture-index.csv"
OUTPUT = ROOT / "research" / "copy-pages.csv"
PDF = "application/pdf"


def wanted_files() -> dict[str, str]:
    """Every PDF the capture index allows the website to serve, by SHA-256, with one key it is stored at."""
    files: dict[str, str] = {}
    with CAPTURE_INDEX.open(newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            if row["media_type"] == PDF and row["redistribution"] == "yes" and len(row["sha256"]) == 64:
                files.setdefault(row["sha256"].lower(), row["key"])
    return files


def read_existing() -> dict[str, int]:
    if not OUTPUT.exists():
        return {}
    with OUTPUT.open(newline="", encoding="utf-8") as handle:
        return {row["sha256"]: int(row["pages"]) for row in csv.DictReader(handle) if row["pages"].isdigit()}


def from_library(missing: set[str]) -> dict[str, int]:
    """Page counts the source library already has for these files."""
    path = library.fetch()
    connection = sqlite3.connect(path)
    counts = {}
    for sha256, pages in connection.execute("SELECT sha256, page_count FROM documents WHERE format = 'pdf' AND page_count > 0"):
        if sha256 in missing:
            counts[sha256] = pages
    return counts


def count_one(client, key: str) -> int | None:
    import pymupdf

    with tempfile.NamedTemporaryFile(suffix=".pdf") as handle:
        client.download_fileobj(library.bucket_name(), key, handle)
        handle.flush()
        try:
            with pymupdf.open(handle.name) as document:
                return document.page_count
        except Exception as error:  # a damaged file is reported and left uncounted
            print(f"  could not open {key}: {error}", file=sys.stderr)
            return None


def write(counts: dict[str, int]) -> None:
    temporary = OUTPUT.with_suffix(".csv.part")
    with temporary.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle, lineterminator="\n")
        writer.writerow(["sha256", "pages"])
        for sha256 in sorted(counts):
            writer.writerow([sha256, counts[sha256]])
    temporary.replace(OUTPUT)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--workers", type=int, default=16)
    parser.add_argument("--no-library", action="store_true", help="count every file from the bucket, ignoring the source library")
    arguments = parser.parse_args()

    files = wanted_files()
    counts = {sha256: pages for sha256, pages in read_existing().items() if sha256 in files}
    missing = set(files) - set(counts)
    if missing and not arguments.no_library:
        found = from_library(missing)
        counts.update(found)
        missing -= set(found)
        print(f"{len(found)} counts from the source library.", file=sys.stderr)
    print(f"{len(missing)} files to download and count.", file=sys.stderr, flush=True)

    client = library.bucket_client()
    done = 0
    with concurrent.futures.ThreadPoolExecutor(arguments.workers) as pool:
        futures = {pool.submit(count_one, client, files[sha256]): sha256 for sha256 in sorted(missing)}
        for future in concurrent.futures.as_completed(futures):
            sha256 = futures[future]
            try:
                pages = future.result()
            except Exception as error:
                print(f"  could not download {files[sha256]}: {error}", file=sys.stderr)
                pages = None
            if pages:
                counts[sha256] = pages
            done += 1
            if done % 500 == 0:
                write(counts)
                print(f"  {done} of {len(missing)} counted", file=sys.stderr, flush=True)
    write(counts)
    print(f"{len(counts)} of {len(files)} PDFs counted, {sum(counts.values()):,} pages, in {OUTPUT.relative_to(ROOT)}.", file=sys.stderr)


if __name__ == "__main__":
    main()
