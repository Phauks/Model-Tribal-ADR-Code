#!/usr/bin/env python3
"""Source records and stored copies for the small sets on the data roadmap (docs/data-roadmap.md): major federal
reports, land (Royce's cessions and the Census Bureau's tribal boundary files) and international documents
(Trevor, Nov. 24, 2026).

The documents are listed in research/data-roadmap/small-sets.yaml, one entry each; the file's header explains the
fields. To add a document, add an entry and run the three steps again: anything already downloaded, filed or written
is skipped.

  fetch    downloads each entry's file into WORK/<set>/ and checks that a PDF opens and a zip holds a shapefile.
  file     stores each file in the bucket under <topic>/<name> with scripts/captures/mirror_captures.py (a file
           already in the capture index, by SHA-256, is not stored twice). U.S. government and public domain works
           are marked for serving; link-only works are kept privately.
  records  writes a source record for each new entry, and gives an existing record its stored copy (and, where the
           entry says so, its corrected rights). Every record is Unverified: its notes say so.

Usage:
  python3 scripts/law/small_sets.py fetch --work DIR
  python3 scripts/law/small_sets.py file --work DIR --captures /mnt/project-files/research/captures
  python3 scripts/law/small_sets.py records
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import re
import subprocess
import sys
import time
import zipfile
from pathlib import Path
from urllib.parse import urlparse

import yaml

ROOT = Path(__file__).resolve().parents[2]
LIST = ROOT / "research/data-roadmap/small-sets.yaml"
INDEX = ROOT / "research/capture-index.csv"
SOURCES = ROOT / "content/sources"
SESSION = "2026-11-24-data-roadmap-first-sets"
TODAY = "2026-11-24"
AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
MONTHS = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."]
RIGHTS = {
    "government": {"status": "no-permission-needed", "basis": "us-government-work",
                   "basis_note": "A work of the United States government, not subject to copyright (17 U.S.C. § 105).",
                   "redistribution": True},
    "public-domain": {"status": "no-permission-needed", "basis": "public-domain", "redistribution": True},
    "link-only": {"status": "no-permission-needed", "basis": "link-only",
                  "basis_note": "Linked and cited with short quotations; a copy is kept privately for checking quotations and is not served.",
                  "redistribution": False},
}
LEVEL = {"reports": "federal", "land": "federal", "international": "international"}


def dump(value) -> str:
    return yaml.safe_dump(value, allow_unicode=True, sort_keys=False, width=float("inf"))


def entries() -> list[dict]:
    items = yaml.safe_load(LIST.read_text(encoding="utf-8"))
    keys = [item["key"] for item in items]
    duplicates = {key for key in keys if keys.count(key) > 1}
    if duplicates:
        sys.exit(f"keys listed twice: {sorted(duplicates)}")
    return items


def extension(item: dict) -> str:
    if item.get("name"):
        return Path(item["name"]).suffix
    path = urlparse(item["download"]).path
    if path.endswith((".pdf", ".zip", ".html", ".htm")):
        return Path(path).suffix.replace(".htm", ".html").replace(".htmll", ".html")
    return ".pdf"


def stored_name(item: dict) -> str:
    return item.get("name") or f"{item['key']}{extension(item)}"


def local(work: Path, item: dict) -> Path:
    return work / item["set"] / stored_name(item)


def check(path: Path) -> str:
    """Empty when the file looks right; otherwise what is wrong with it."""
    if not path.exists() or path.stat().st_size == 0:
        return "not downloaded"
    if path.suffix == ".pdf":
        info = subprocess.run(["pdfinfo", str(path)], capture_output=True, text=True)
        return "" if info.returncode == 0 and "Pages:" in info.stdout else "not a PDF"
    if path.suffix == ".zip":
        try:
            names = zipfile.ZipFile(path).namelist()
        except zipfile.BadZipFile:
            return "not a zip"
        return "" if any(name.endswith(".shp") for name in names) else "no shapefile in the zip"
    head = path.read_bytes()[:2000].lower()
    return "" if b"<html" in head or b"<!doctype" in head else "not a web page"


def fetch(args) -> None:
    work = Path(args.work)
    problems = 0
    for item in entries():
        if not item.get("download"):
            continue
        path = local(work, item)
        path.parent.mkdir(parents=True, exist_ok=True)
        if check(path):
            subprocess.run(["curl", "-sfL", "-m", "900", "-A", AGENT, "-o", str(path), item["download"]])
            time.sleep(1)
        problem = check(path)
        problems += bool(problem)
        print(f"{item['key']}: {problem or 'ok'} ({path.stat().st_size if path.exists() else 0} bytes)")
    print(f"{problems} problem(s)")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1 << 20), b""):
            digest.update(block)
    return digest.hexdigest()


def file(args) -> None:
    sys.path.insert(0, str(ROOT / "scripts/captures"))
    import mirror_captures  # noqa: E402

    for item in entries():
        if not item.get("download") or check(local(Path(args.work), item)):
            continue
        path = local(Path(args.work), item)
        served = item["rights"] != "link-only"
        title = item.get("title") or item["key"]
        mirror_captures.add(argparse.Namespace(
            captures=args.captures, files=[str(path)], topic=item["topic"], name=stored_name(item), record=item["key"],
            obtained="downloaded by scripts/law/small_sets.py", title=title, link=[item["download"]],
            redistribution="yes" if served else "no", nations="",
            rights=("United States government work (17 U.S.C. § 105)." if item["rights"] == "government" else
                    item.get("rights_note", "Public domain.") if item["rights"] == "public-domain" else
                    "Copyrighted or not assessed: kept privately, linked on the site."),
            keep_local=False))


def copies_by_hash() -> dict[str, dict]:
    copies = {}
    for row in csv.DictReader(INDEX.open(encoding="utf-8")):
        copies.setdefault(row["sha256"], {"storage_key": row["key"], "checksum": row["sha256"],
                                          "media_type": row["media_type"], "bytes": int(row["bytes"])})
    return copies


def long_date(parts: list[int]) -> str:
    if len(parts) == 3:
        return f"{MONTHS[parts[1] - 1]} {parts[2]}, {parts[0]}"
    if len(parts) == 2:
        return f"{MONTHS[parts[1] - 1]} {parts[0]}"
    return str(parts[0])


def author(name) -> dict:
    """A person as {family, given} in the list; an office or body as plain text."""
    return dict(name) if isinstance(name, dict) else {"literal": name}


def record_for(item: dict, copy: dict | None) -> dict:
    csl = {"type": item.get("csl_type") or ("dataset" if item["kind"] == "dataset" else "report" if item["kind"] == "report" else "document"),
           "title": item["title"], "author": [author(item["author"])]}
    if item.get("container"):
        csl["container-title"] = item["container"]
    if item.get("number"):
        csl["number"] = item["number"]
    for field, key in (("publisher", "publisher"), ("publisher-place", "place")):
        if item.get(key):
            csl[field] = item[key]
    csl["URL"] = item["link"]
    csl["issued"] = {"date-parts": [item["issued"]]}
    csl["accessed"] = {"date-parts": [[2026, 11, 24]]}
    record = {"key": item["key"], "kind": item["kind"], "citation": csl, "original_link": item["link"], "retrieved": TODAY,
              "archives": []}
    if copy:
        record["file"] = copy
    rights = dict(RIGHTS[item["rights"]])
    if item.get("rights_note"):
        rights["basis_note"] = item["rights_note"]
    record["rights"] = rights
    record["jurisdictions"] = [{"level": LEVEL[item["set"]]}]
    record["found_in"] = [SESSION]
    stored = (f" Stored copy: {item['copy_note']}" if copy and item.get("copy_note") else
              " No copy is stored: the publisher's site turns away automated requests, so a person must download it (pull list)." if not item.get("download") else "")
    record["notes"] = (f"Indigo Book citation: {item['indigo']}. {item['about']}{stored} "
                       "Metadata generated by scripts/law/small_sets.py from research/data-roadmap/small-sets.yaml; "
                       "nobody has checked it against the document yet (Unverified).")
    return record


def update_existing(path: Path, item: dict, copy: dict | None) -> bool:
    """Give an existing record its stored copy and, for public domain and government entries, its served rights."""
    text = path.read_text(encoding="utf-8")
    data = yaml.safe_load(text)
    changed = False
    if copy and "file" not in data:
        text = text.replace("\nrights:\n", "\n" + dump({"file": copy}) + "rights:\n", 1)
        changed = True
    if item["rights"] in ("government", "public-domain") and not data["rights"].get("redistribution"):
        rights = dict(RIGHTS[item["rights"]])
        if item.get("rights_note"):
            rights["basis_note"] = item["rights_note"]
        text = re.sub(r"\nrights:\n(?:  .*\n|    .*\n)+", "\n" + dump({"rights": rights}), text, count=1)
        changed = True
    if changed and SESSION not in text:
        text = re.sub(r"\nfound_in:\n((?:\s*- .*\n)+)", lambda m: f"\nfound_in:\n{m.group(1)}{'  ' if m.group(1).startswith('  ') else ''}- {SESSION}\n", text, count=1)
    if changed:
        yaml.safe_load(text)  # still valid YAML
        path.write_text(text, encoding="utf-8")
    return changed


def records(args) -> None:
    copies = copies_by_hash()
    work = Path(args.work) if args.work else None
    written = updated = 0
    for item in entries():
        path = SOURCES / item["key"][0] / f"{item['key']}.yaml"
        copy = None
        if item.get("download") and work and not check(local(work, item)):
            copy = copies.get(sha256(local(work, item)))
        if item.get("existing"):
            if not path.exists():
                sys.exit(f"existing record not found: {item['key']}")
            updated += update_existing(path, item, copy)
            continue
        if path.exists() and SESSION not in path.read_text(encoding="utf-8"):
            sys.exit(f"key in use by another record: {item['key']}")
        path.write_text(dump(record_for(item, copy)), encoding="utf-8")
        written += 1
    print(f"small sets: {written} records written, {updated} existing records updated")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    for name in ("fetch", "file", "records"):
        p = sub.add_parser(name)
        p.add_argument("--work", required=name != "records", help="download folder (records: to find each file's stored copy)")
        if name == "file":
            p.add_argument("--captures", required=True)
    args = parser.parse_args()
    {"fetch": fetch, "file": file, "records": records}[args.command](args)


if __name__ == "__main__":
    main()
