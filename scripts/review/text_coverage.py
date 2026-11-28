#!/usr/bin/env python3
"""How many records of each kind show their text on the page, how many only a
scan, and how many no copy at all (thread "Put full document text on the
site", Nov. 28, 2026: Trevor asked for these numbers by type of page, and for
updates as the text pass moves them).

It matches each source record in content/sources/ to the copies the site
serves the way the site does (site/src/lib/server/record-document.ts
recordCopies and textOfScan, site/src/lib/server/content.ts indexedCopies,
site/src/lib/public-copies.ts copiesByLink), from research/capture-index.csv:

  text   the Text card shows words: a transcription, a saved page, or the text
         taken from the record's scan (scripts/law/scan_texts.py)
  scan   the card shows a PDF only
  none   the card has no copy to show (a link, or None Identified)

Title 25 section pages are counted from content/law/title-25-sections.json.

Usage:
  python3 scripts/review/text_coverage.py [--csv research/reviews/text-coverage.csv]
"""
from __future__ import annotations

import argparse
import collections
import csv
import json
import re
import sys
from pathlib import Path

import yaml

REPO = Path(__file__).resolve().parents[2]
LOADER = getattr(yaml, "CSafeLoader", yaml.SafeLoader)
PREFERENCE = ["application/pdf", "text/plain", "image/jpeg", "text/html"]
TEXT_TYPES = {"text/plain", "text/html"}


def preference(media_type: str) -> int:
    return PREFERENCE.index(media_type) if media_type in PREFERENCE else len(PREFERENCE)


def for_matching(link: str) -> str | None:
    link = link.strip()
    if not re.match(r"^https?://", link):
        return None
    return "https://" + re.sub(r"^https?://", "", link).split("#")[0]


def served_copies() -> tuple[dict, dict, dict]:
    """Served copies by link (preferred kind first), by SHA-256, and the text taken from each scan, by the scan's key."""
    by_link: dict[str, tuple[str, str]] = {}
    by_digest: dict[str, tuple[str, str]] = {}
    scan_texts: dict[str, str] = {}
    with (REPO / "research" / "capture-index.csv").open(encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            if row["redistribution"] != "yes" or row["topic"] in ("westlaw", "articles") or row["key"].split("/")[0] in ("westlaw", "articles"):
                continue
            if row["derived_from"] and row["media_type"] != "text/plain":
                continue
            if not re.fullmatch(r"[0-9a-f]{64}", row["sha256"]):
                continue
            links = [link for link in (for_matching(part) for part in row["link"].split()) if link]
            if not links:
                continue
            if row["derived_from"]:
                scan_texts[row["derived_from"]] = row["key"]
            copy = (row["key"], row["media_type"])
            by_digest[row["sha256"]] = copy
            for link in links:
                held = by_link.get(link)
                if not held or preference(copy[1]) < preference(held[1]):
                    by_link[link] = copy
    return by_link, by_digest, scan_texts


def record_state(record: dict, by_link: dict, by_digest: dict, scan_texts: dict) -> str:
    citation = record.get("citation") or {}
    links = [entry.get("link", "") for entry in ((record.get("reading_links") or {}).get("links") or []) if entry.get("site") == "supremecourt"]
    links += [record.get("original_link") or "", citation.get("URL") or ""]
    copies = []
    for link in links:
        matching = for_matching(link) if link else None
        if matching and matching in by_link:
            copies.append(by_link[matching])
    digest = ((record.get("file") or {}).get("checksum") or "").lower()
    if digest in by_digest:
        copies.append(by_digest[digest])
    if any(media in TEXT_TYPES for _, media in copies):
        return "text"
    if any(media == "application/pdf" and key in scan_texts for key, media in copies):
        return "text"
    if any(media == "application/pdf" for _, media in copies):
        return "scan"
    return "none"


def group_of(record: dict) -> str:
    kind = record.get("kind", "?")
    if kind == "intergovernmental-agreement":
        return f"{kind}: {(record.get('citation') or {}).get('type', '?')}"
    return kind


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--csv", help="also write the counts to this CSV file")
    args = parser.parse_args()
    by_link, by_digest, scan_texts = served_copies()
    counts: dict[str, collections.Counter] = collections.defaultdict(collections.Counter)
    for path in sorted((REPO / "content" / "sources").rglob("*.yaml")):
        try:
            record = yaml.load(path.read_text(encoding="utf-8"), Loader=LOADER)
        except yaml.YAMLError as error:
            print(f"skipped {path.relative_to(REPO)}: {error}", file=sys.stderr)
            continue
        if isinstance(record, dict) and "kind" in record:
            counts[group_of(record)][record_state(record, by_link, by_digest, scan_texts)] += 1
    sections = json.loads((REPO / "content" / "law" / "title-25-sections.json").read_text(encoding="utf-8"))["code"]
    in_force = [section for chapter in sections.values() for section in chapter if section.get("inForce")]
    texts = {row_key for row_key in scan_texts.values()}
    rows = [(group, sum(c.values()), c["text"], c["scan"], c["none"]) for group, c in sorted(counts.items(), key=lambda item: -sum(item[1].values()))]
    total = [sum(row[i] for row in rows) for i in range(1, 5)]
    print("| Page type | Records | Text | Scan only | No copy |\n|---|---:|---:|---:|---:|")
    for row in rows:
        print(f"| {row[0]} | {row[1]:,} | {row[2]:,} | {row[3]:,} | {row[4]:,} |")
    print(f"| **All records** | **{total[0]:,}** | **{total[1]:,}** | **{total[2]:,}** | **{total[3]:,}** |")
    print(f"\nTitle 25 sections in force: {len(in_force):,}; scan texts in the index: {len(texts):,}")
    if args.csv:
        with open(args.csv, "w", newline="", encoding="utf-8") as handle:
            writer = csv.writer(handle)
            writer.writerow(["page_type", "records", "text", "scan_only", "no_copy"])
            writer.writerows(rows)


if __name__ == "__main__":
    main()
