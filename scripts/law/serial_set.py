#!/usr/bin/env python3
"""Records and stored copies for the Congressional Serial Set's documents on American Indians and Alaska Natives,
1817-1899 (new data source category 3; Trevor approved the selection on Nov. 27, 2026: "Approve, plus long
committee reports", about 18.8 GB).

The University of Oklahoma Law Library's index, "American Indian and Alaskan Native Documents in the Congressional
Serial Set: 1817-1899", lists 8,744 documents. Thread "Find new data sources beyond tiers 2 and 3" matched each to
its GovInfo Serial Set package (research/data-roadmap/2026-11-27-serial-set/oklahoma-index-matched-to-govinfo.csv)
and proposed which packages to host (proposed-selection.csv in the same folder). Trevor then chose, the same day, to
host every one of the 6,478 matched packages, annual reports and compendia included ("we will not be truncating
files"; "we can identify if we need to cut after we have everything"), so the "host" rows are stored first and the
rest after them. The 1,973 index entries with no GovInfo package (1,859 in volumes GovInfo does not hold, 85 whose
number did not match, 29 whose file name could not be read) get a record linking the university's copy, which
refuses automated downloads.

The files come from GovInfo's public address (https://www.govinfo.gov/content/pkg/<package>/pdf/<package>.pdf),
which needs no key. Each is streamed through a temporary file straight to the bucket (serial-set/<package>.pdf),
checked by size and SHA-256, and its local copy deleted, because a cloud session's disk is too small for the set.
The documents are public domain works of the United States government, so the site serves them.

Steps:
  file     Download and store each package to host. Resumable: --work/stored.jsonl lists what is in the bucket.
  index    Add the stored files to the capture index.
  records  Write one source record per GovInfo package, and one per index entry with no package. A package that
           already has a record (scripts/law/congressional_documents.py keeps Serial Set reports whose titles name
           Native people) is left to that record, so 918 packages get no second record.

Each record is a congressional-document, like the reports scripts/law/congressional_documents.py writes, with its
genre ("House report", "Senate executive document" and so on) and its chamber, Congress, session and package under
legislative. The site's "Congressional Serial Set, 1817-1899" collection lists every Serial Set document issued before
1900, whichever script wrote its record.

Usage:
  python3 scripts/law/serial_set.py file --work DIR [--workers 4]
  python3 scripts/law/serial_set.py index --work DIR
  python3 scripts/law/serial_set.py records --work DIR
"""
from __future__ import annotations

import argparse
import concurrent.futures
import csv
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
import threading
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts/captures"))
import mirror_captures  # noqa: E402

FOLDER = ROOT / "research/data-roadmap/2026-11-27-serial-set"
MATCHES = FOLDER / "oklahoma-index-matched-to-govinfo.csv"
SELECTION = FOLDER / "proposed-selection.csv"
SCRIPT = "scripts/law/serial_set.py"
TOPIC = "serial-set"
AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"


SOURCES = ROOT / "content/sources"
SESSION = "2026-11-27-serial-set"
TODAY = "2026-11-27"
GOVERNMENT = {"status": "no-permission-needed", "basis": "us-government-work",
              "basis_note": "A document of the United States Congress, not subject to copyright (17 U.S.C. § 105).",
              "redistribution": True}
# The index's document types, as the Indigo Book abbreviates them.
DOCUMENT_TYPES = {
    ("House", "Report"): "H.R. Rep.", ("House", "ReportCC"): "H.R. Rep.", ("House", "Executive"): "H.R. Exec. Doc.",
    ("House", "Miscellaneous"): "H.R. Misc. Doc.", ("House", "MIscellaneous"): "H.R. Misc. Doc.", ("House", "Document"): "H.R. Doc.",
    ("House", "Resolution"): "H.R. Res.", ("Senate", "Report"): "S. Rep.", ("Senate", "Executive"): "S. Exec. Doc.",
    ("Senate", "Miscellaneous"): "S. Misc. Doc.", ("Senate", "Document"): "S. Doc.", ("Senate", "Documentt"): "S. Doc.",
}


GENRES = {"Report": "report", "ReportCC": "report", "Executive": "executive document", "Miscellaneous": "miscellaneous document",
          "MIscellaneous": "miscellaneous document", "Document": "document", "Documentt": "document", "Resolution": "resolution"}


def genre(entry: dict) -> str:
    kind = GENRES.get(entry["document_type"])
    if not kind or entry["chamber"] not in ("House", "Senate"):
        return "Congressional document"
    return f"{entry['chamber']} {kind}"


def legislative(entry: dict, package: str | None) -> dict:
    out: dict = {"chamber": entry["chamber"].lower() if entry["chamber"] in ("House", "Senate") else "congress"}
    if entry["congress"].isdigit():
        out["congress"] = int(entry["congress"])
    if entry["session"].isdigit() and 1 <= int(entry["session"]) <= 4:
        out["session"] = int(entry["session"])
    if package:
        out["govinfo_package"] = package
    return out


def recorded_packages() -> dict[str, str]:
    """The Serial Set packages that already have a record written by another script, with that record's key."""
    found = {}
    for path in SOURCES.glob("*/*.yaml"):
        if path.name.startswith("serial-set-"):
            continue
        text = path.read_text(encoding="utf-8")
        for match in re.finditer(r"govinfo_package: (SERIALSET-\S+)", text):
            found[match.group(1)] = path.stem
    return found


def record_key(package: str) -> str:
    return "serial-set-" + package.removeprefix("SERIALSET-").lower().replace("_", "-")


def ordinal(number: str) -> str:
    value = int(number)
    if 10 <= value % 100 <= 20:
        return f"{value}th"
    return f"{value}" + {1: "st", 2: "d", 3: "d"}.get(value % 10, "th")


def cite(entry: dict) -> str:
    """The Indigo Book form, such as "H.R. Doc. No. 80, 24th Cong., 1st Sess. (1836)"."""
    kind = DOCUMENT_TYPES.get((entry["chamber"], entry["document_type"]))
    number = re.match(r"\d+", entry["document_number"])
    if not kind or not number or not entry["congress"].isdigit():
        return ""
    session = entry["session"].lower()
    session = ", Spec. Sess." if session == "sp" else f", {ordinal(session)} Sess." if session.isdigit() else ""
    # "1_Interior" is Executive Document No. 1 (the President's annual message and its papers), the Interior Department's
    # part, which the citation leaves to the title; "632_Pt2" is part 2.
    part = entry["document_number"][number.end():].strip("_").replace("_", " ")
    numbered = re.fullmatch(r"(?i)pt\.?\s*(\d+)", part)
    part = f", pt. {numbered.group(1)}" if numbered else ""
    return f"{kind} No. {number.group(0)}{part}, {ordinal(entry['congress'])} Cong.{session} ({entry['date'][:4]})"


def pdf_link(package: str) -> str:
    return f"https://www.govinfo.gov/content/pkg/{package}/pdf/{package}.pdf"


def selection() -> list[dict]:
    with SELECTION.open(encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def to_host() -> list[dict]:
    """Every package, the proposed "host" rows first. Trevor chose on Nov. 27, 2026 to host all of them
    (annual reports and compendia too) and decide later whether anything should be cut."""
    rows = selection()
    return [row for row in rows if row["proposed"].startswith("host")] + [row for row in rows if not row["proposed"].startswith("host")]


def stored(work: Path) -> dict[str, dict]:
    path = work / "stored.jsonl"
    out = {}
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            if line.strip():
                entry = json.loads(line)
                out[entry["package"]] = entry
    return out


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1 << 20), b""):
            digest.update(block)
    return digest.hexdigest()


def file(args) -> None:
    work = Path(args.work)
    work.mkdir(parents=True, exist_ok=True)
    done = stored(work)
    # A package scripts/law/congressional_documents.py already stored (congress/<package>.pdf) is not stored twice. On
    # Nov. 27, 2026, 903 copies stored here before that check were byte for byte the same as those, and were deleted.
    elsewhere = {row["key"].removeprefix("congress/").removesuffix(".pdf") for row in mirror_captures.load_index() if row["key"].startswith("congress/SERIALSET-")}
    rows = [row for row in to_host() if row["govinfo_package_id"] not in done and row["govinfo_package_id"] not in elsewhere]
    print(f"{len(done)} stored already, {len(elsewhere)} stored by the congressional documents script; {len(rows)} to store", flush=True)
    s3, bucket = mirror_captures.client(), mirror_captures.bucket_name()
    lock = threading.Lock()
    log = (work / "stored.jsonl").open("a", encoding="utf-8")
    failures = (work / "failed.jsonl").open("a", encoding="utf-8")
    temporary = Path(tempfile.mkdtemp(prefix="serial-set-", dir=work))
    counts = {"stored": 0, "failed": 0, "bytes": 0}

    def one(row: dict) -> None:
        package = row["govinfo_package_id"]
        path = temporary / f"{package}.pdf"
        problem = ""
        for attempt in range(4):
            result = subprocess.run(["curl", "-sfL", "-m", "900", "-A", AGENT, "-o", str(path), pdf_link(package)], capture_output=True, text=True)
            if result.returncode == 0 and path.exists() and path.read_bytes()[:5] == b"%PDF-":
                problem = ""
                break
            problem = f"curl exit {result.returncode}"
            time.sleep(5 * (attempt + 1))
        if problem:
            path.unlink(missing_ok=True)
            with lock:
                failures.write(json.dumps({"package": package, "problem": problem}) + "\n")
                failures.flush()
                counts["failed"] += 1
            return
        digest, size = sha256(path), path.stat().st_size
        key = f"{TOPIC}/{package}.pdf"
        s3.upload_file(str(path), bucket, key, ExtraArgs={"ContentType": "application/pdf", "Metadata": {"sha256": digest, "captured": time.strftime("%Y-%m-%d")}})
        if mirror_captures.remote_state(s3, bucket, key) != (size, digest):
            problem = "bucket copy does not match"
        path.unlink(missing_ok=True)
        with lock:
            if problem:
                failures.write(json.dumps({"package": package, "problem": problem}) + "\n")
                failures.flush()
                counts["failed"] += 1
                return
            log.write(json.dumps({"package": package, "key": key, "bytes": size, "sha256": digest, "captured": time.strftime("%Y-%m-%d")}) + "\n")
            log.flush()
            counts["stored"] += 1
            counts["bytes"] += size
            if counts["stored"] % 100 == 0:
                print(f"{counts['stored']} stored, {counts['bytes'] / 1e9:.2f} GB, {counts['failed']} failed", flush=True)

    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        list(pool.map(one, rows))
    print(f"done: {counts['stored']} stored ({counts['bytes'] / 1e9:.2f} GB), {counts['failed']} failed", flush=True)


def index(args) -> None:
    """Add every stored file to the capture index, in one write."""
    work = Path(args.work)
    titles = {row["govinfo_package_id"]: row["title"] for row in selection()}
    already = recorded_packages()
    prefill_page_counts(work)
    rows = mirror_captures.load_index()
    known = {row["key"] for row in rows}
    added = 0
    for package, entry in sorted(stored(work).items()):
        if entry["key"] in known:
            continue
        row = mirror_captures.index_row(
            key=entry["key"], size=entry["bytes"], digest=entry["sha256"], media="application/pdf", topic=TOPIC,
            title=titles.get(package, package), nations="", obtained=f"downloaded from GovInfo by {SCRIPT}, {entry['captured']}",
            links=[pdf_link(package)], record=already.get(package, record_key(package)), redistribution="yes",
            rights="Public domain: a document of the United States Congress, 1817-1899 (17 U.S.C. § 105).", existing_keys=known)
        row["captured"] = entry["captured"]
        rows.append(row)
        known.add(entry["key"])
        added += 1
    mirror_captures.write_index(rows)
    print(f"{added} files added to the capture index")


def prefill_page_counts(work: Path) -> None:
    """
    Give research/copy-pages.csv each stored file's page count from GovInfo's package list, so the capture index write
    does not download all 266 GB from the bucket to count them.
    """
    path = ROOT / "research/copy-pages.csv"
    with path.open(encoding="utf-8") as handle:
        counts = {row["sha256"]: row["pages"] for row in csv.DictReader(handle)}
    pages = {row["govinfo_package_id"]: row["pages"] for row in selection()}
    added = 0
    for package, entry in stored(work).items():
        if entry["sha256"] not in counts and pages.get(package, "").isdigit():
            counts[entry["sha256"]] = pages[package]
            added += 1
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle, lineterminator="\n")
        writer.writerow(["sha256", "pages"])
        for sha256 in sorted(counts):
            writer.writerow([sha256, counts[sha256]])
    print(f"{added} page counts taken from GovInfo")


def write(record: dict) -> None:
    import yaml

    path = SOURCES / record["key"][0] / f"{record['key']}.yaml"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(yaml.safe_dump(record, sort_keys=False, allow_unicode=True, width=float("inf")), encoding="utf-8")


def base_record(key: str, entry: dict, title: str, link: str, package: str | None = None) -> dict:
    citation = {"type": "report", "title": title, "genre": genre(entry),
                "author": [{"literal": f"United States {'House of Representatives' if entry['chamber'] == 'House' else 'Senate'}"}] if entry["chamber"] else [{"literal": "United States Congress"}]}
    number = cite(entry)
    if number:
        citation["number"] = number
    citation["container-title"] = "U.S. Congressional Serial Set"
    if entry["serial_number"]:
        citation["collection-number"] = entry["serial_number"]
    if entry["date"]:
        citation["issued"] = {"date-parts": [[int(part) for part in entry["date"].split("-")]]}
    citation |= {"URL": link, "accessed": {"date-parts": [[2026, 11, 27]]}}
    return {"key": key, "kind": "congressional-document", "citation": citation, "original_link": link, "retrieved": TODAY,
            "legislative": legislative(entry, package)}


def finish(record: dict, notes: str) -> dict:
    record["rights"] = GOVERNMENT
    record["jurisdictions"] = [{"level": "federal"}]
    record["topics"] = [TOPIC]
    record["access"] = {"open": True, "pull_from": ["free-web"]}
    record["found_in"] = [SESSION]
    record["notes"] = notes + f" Generated by {SCRIPT} from the index entry; nobody has read the document against the record yet (Unverified)."
    record["review"] = {"status": "unverified", "by": SCRIPT, "date": TODAY,
                        "checks": [{"check": "listing", "result": "missing", "detail": "Only the University of Oklahoma's index and GovInfo's package list were read, not the document"}]}
    return record


def records(args) -> None:
    import html

    work = Path(args.work)
    copies = stored(work)
    chosen = {row["govinfo_package_id"]: row for row in selection()}
    with MATCHES.open(encoding="utf-8") as handle:
        entries = list(csv.DictReader(handle))
    for entry in entries:
        entry["title"] = html.unescape(entry["title"]).strip()
    by_package: dict[str, list[dict]] = {}
    for entry in entries:
        if entry["govinfo_package_id"]:
            by_package.setdefault(entry["govinfo_package_id"], []).append(entry)
    already = recorded_packages()
    written = hosted = skipped = 0
    for package, listed in sorted(by_package.items()):
        if package in already:
            skipped += 1
            continue
        listed.sort(key=lambda entry: entry["date"])
        first = listed[0]
        row = chosen.get(package, {})
        record = base_record(record_key(package), first, row.get("title") or first["title"], f"https://www.govinfo.gov/app/details/{package}", package)
        if row.get("pages"):
            record["citation"]["number-of-pages"] = row["pages"]
        copy = copies.get(package)
        if copy:
            record["file"] = {"storage_key": copy["key"], "checksum": copy["sha256"], "media_type": "application/pdf", "bytes": copy["bytes"]}
            hosted += 1
        also = [entry["title"] for entry in listed[1:] if entry["title"] != first["title"]]
        notes = (f"Listed in the University of Oklahoma Law Library's index of American Indian and Alaska Native documents in the Serial Set, 1817-1899, as \"{first['title']}\" ({first['oklahoma_url']}); "
                 f"GovInfo's package {package}.")
        if also:
            notes += f" The index lists {len(also)} more parts of this package: " + "; ".join(f"\"{title}\"" for title in also[:10]) + ("; and others." if len(also) > 10 else ".")
        if row.get("annual_report_or_compendium") == "yes":
            notes += " An annual report or compendium, of which only some pages concern Native nations."
        write(finish(record, notes))
        written += 1
    linked = 0
    for entry in entries:
        if entry["govinfo_package_id"]:
            continue
        article = re.search(r"/article/(\d+)/", entry["oklahoma_url"])
        record = base_record(f"serial-set-oklahoma-{article.group(1)}", entry, entry["title"], entry["oklahoma_url"])
        reason = {"volume_not_on_govinfo": "GovInfo does not hold its volume", "volume_on_govinfo_number_not_matched": "its document number was not found in GovInfo's volume",
                  "file_name_not_parsed": "its file name could not be read"}.get(entry["match"], entry["match"])
        notes = (f"Listed in the University of Oklahoma Law Library's index of American Indian and Alaska Native documents in the Serial Set, 1817-1899. "
                 f"Linked to the university's copy, which refuses automated downloads; no copy is stored because {reason}.")
        write(finish(record, notes))
        linked += 1
    print(f"{written} package records ({hosted} with stored copies), {skipped} packages left to their existing records, "
          f"{linked} index entries linked to the university's copy")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    for name in ("file", "index", "records"):
        command = sub.add_parser(name)
        command.add_argument("--work", required=True)
        if name == "file":
            command.add_argument("--workers", type=int, default=4)
    args = parser.parse_args()
    {"file": file, "index": index, "records": records}[args.command](args)


if __name__ == "__main__":
    main()
