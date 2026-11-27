#!/usr/bin/env python3
"""Check the saved web pages in the capture index for two problems that make a copy unreadable on the website.

Subcommands:

  charsets  Read every saved web page the website serves (capture index rows
            with media type text/html and redistribution "yes") from the
            captures folder, or from the bucket when the file is not kept
            locally, and write research/copy-charsets.csv: the pages whose
            bytes are not UTF-8, with the encoding to serve them in
            (windows-1252, which browsers also use for pages that say
            iso-8859-1). The Worker serves every other saved page as UTF-8
            (site/src/lib/server/public-copy-serving.ts, copyContentType).
            On Nov. 27, 2026, 6,450 of the 6,456 pages in the bucket were
            UTF-8.

  failed    Write research/failed-captures.csv: saved web pages that are not
            the document but what the site answered when it was fetched, such
            as Cloudflare's "Just a moment..." check, "Attention Required!",
            a firewall block, "403 - Forbidden" or "Page not found", found by
            the page title in the capture index. Each needs to be pulled
            again, by hand or from the Wayback Machine. With --withhold, also
            sets "redistribution": "no" and a rights note for each (and for an
            empty file) in
            research/capture-index-overrides.json, so the website stops
            serving it, and updates the same rows of the capture index.

Credentials for the bucket come from the environment, as for
scripts/captures/mirror_captures.py.

Usage:
  python3 scripts/captures/check_saved_pages.py charsets [--captures /mnt/project-files/research/captures]
  python3 scripts/captures/check_saved_pages.py failed [--withhold]
"""

from __future__ import annotations

import argparse
import concurrent.futures
import csv
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import mirror_captures  # noqa: E402

REPO = mirror_captures.REPO
INDEX_CSV = mirror_captures.INDEX_CSV
OVERRIDES = REPO / "research" / "capture-index-overrides.json"
CHARSETS_CSV = REPO / "research" / "copy-charsets.csv"
FAILED_CSV = REPO / "research" / "failed-captures.csv"

# Titles of pages a site sends instead of the document, and what each one is.
FAILED_TITLES = [
    (re.compile(r"^just a moment\.*$", re.I), "a Cloudflare browser check (\"Just a moment...\")"),
    (re.compile(r"^attention required!? \| cloudflare$", re.I), "a Cloudflare block (\"Attention Required!\")"),
    (re.compile(r"^waf block\b", re.I), "a firewall block page"),
    (re.compile(r"^(403 - )?forbidden$|^access denied\b", re.I), "a \"403 Forbidden\" page"),
    (re.compile(r"^404( not found)?\b|^page not found\b|^custom404\b|^sf-error-pages$", re.I), "a \"Page not found\" page"),
    (re.compile(r"^error$|^yii\\base\\errorexception$", re.I), "a server error page"),
]


def index_rows() -> list[dict]:
    with INDEX_CSV.open(encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def served_pages(rows: list[dict]) -> list[dict]:
    return [r for r in rows if r["media_type"] == "text/html" and r["redistribution"] == "yes" and not r["derived_from"]]


def page_encoding(data: bytes) -> str:
    try:
        data.decode("utf-8")
        return "utf-8"
    except UnicodeDecodeError:
        return "windows-1252"


def charsets(args: argparse.Namespace) -> None:
    rows = served_pages(index_rows())
    captures = Path(args.captures) if args.captures else None
    s3 = None
    bucket = mirror_captures.bucket_name()

    def read(row: dict) -> tuple[str, str | None]:
        nonlocal s3
        local = captures / row["key"] if captures else None
        if local and local.exists():
            return row["key"], page_encoding(local.read_bytes())
        if s3 is None:
            s3 = mirror_captures.client()
        try:
            data = s3.get_object(Bucket=bucket, Key=row["key"])["Body"].read()
        except Exception as problem:  # noqa: BLE001 - a missing object is reported, not fatal
            print(f"  could not read {row['key']}: {problem}", file=sys.stderr)
            return row["key"], None
        return row["key"], page_encoding(data)

    if not captures:
        s3 = mirror_captures.client()
    with concurrent.futures.ThreadPoolExecutor(16) as pool:
        found = list(pool.map(read, rows))
    other = sorted((key, encoding) for key, encoding in found if encoding and encoding != "utf-8")
    with CHARSETS_CSV.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle, lineterminator="\n")
        writer.writerow(["key", "charset"])
        writer.writerows(other)
    read_count = sum(1 for _, encoding in found if encoding)
    print(f"{read_count} of {len(rows)} saved pages read; {len(other)} are not UTF-8 ({CHARSETS_CSV.relative_to(REPO)}).")


def failure_of(title: str, size: str = "1") -> str | None:
    if size == "0":
        return "an empty file"
    for pattern, what in FAILED_TITLES:
        if pattern.search(title.strip()):
            return what
    return None


def failed(args: argparse.Namespace) -> None:
    rows = index_rows()
    pages = [r for r in rows if r["media_type"] == "text/html" and not r["derived_from"] and failure_of(r["title"], r["bytes"])]
    with FAILED_CSV.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle, lineterminator="\n")
        writer.writerow(["key", "topic", "what_was_saved", "link", "nations", "records"])
        for r in sorted(pages, key=lambda r: r["key"]):
            writer.writerow([r["key"], r["topic"], failure_of(r["title"], r["bytes"]), r["link"], r["nations"], r["records"]])
    print(f"{len(pages)} saved pages are not documents ({FAILED_CSV.relative_to(REPO)}).")
    if not args.withhold:
        return
    overrides = json.loads(OVERRIDES.read_text(encoding="utf-8")) if OVERRIDES.exists() else {}
    withheld = {}
    for r in pages:
        note = (f"Not the document: the site answered with {failure_of(r['title'], r['bytes'])} when this was saved. "
                "Withheld until it is pulled again (research/failed-captures.csv).")
        entry = overrides.setdefault(r["key"], {})
        entry["redistribution"] = "no"
        entry["rights"] = note
        withheld[r["key"]] = note
    OVERRIDES.write_text(json.dumps(overrides, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    apply_to_index(rows, {key: ("no", note) for key, note in withheld.items()})
    print(f"Withheld {len(withheld)} in {OVERRIDES.relative_to(REPO)} and the capture index.")


def apply_to_index(rows: list[dict], changes: dict[str, tuple[str, str]]) -> None:
    """Set redistribution and rights for these keys and the text extracts made from them, as the next `index` run would."""
    for r in rows:
        change = changes.get(r["key"]) or changes.get(r["derived_from"])
        if change:
            r["redistribution"], r["rights"] = change
    mirror_captures.write_index(rows)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    p = sub.add_parser("charsets", help="write research/copy-charsets.csv")
    p.add_argument("--captures", help="the captures folder; files not there are read from the bucket")
    p.set_defaults(func=charsets)
    p = sub.add_parser("failed", help="write research/failed-captures.csv")
    p.add_argument("--withhold", action="store_true", help="also stop serving them (capture index overrides)")
    p.set_defaults(func=failed)
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
