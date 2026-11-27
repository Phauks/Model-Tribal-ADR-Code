#!/usr/bin/env python3
"""Records and stored copies for the presidential documents on Indian policy
published in the Federal Register since 1994, beyond the reservation orders
(data tier 1; Trevor, Nov. 26, 2026: "add these to the data roadmap, attempt
to grab the high value and scriptables").

The Federal Register API lists every presidential document (executive
orders, proclamations, memoranda and the rest) since 1994. The script asks
for those whose text uses "Indian", "tribal", "tribe", "Native American",
"Alaska Native" or "Native Hawaiian" (779 on Nov. 26, 2026) and keeps those
whose title names Native people or nations (most of the rest are disaster
declarations that only mention tribal governments), plus the national
monument proclamations listed in MONUMENTS, which Native nations proposed or
help manage. Each is a work of the United States government, so the GovInfo
PDF is kept in the bucket under presidential-documents/<document number>.pdf
and served.

Records are of kind executive-order, as the project's reservation
proclamations already are, so they join the Executive Orders collection. An
executive order that already has a record (executive-order-<number>) keeps
it. Every new record starts Unverified.

Steps:
  fetch    Ask the API, choose the documents and download each PDF.
           Writes --work/documents.json.
  file     Store each PDF in the bucket and add it to the capture index.
  records  Write content/sources/<letter>/<key>.yaml for each new document.

Usage:
  python3 scripts/law/presidential_documents.py fetch --work DIR
  python3 scripts/law/presidential_documents.py file --work DIR
  python3 scripts/law/presidential_documents.py records --work DIR
"""
from __future__ import annotations

import argparse
import concurrent.futures
import csv
import datetime as dt
import hashlib
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
CAPTURE_INDEX = ROOT / "research/capture-index.csv"
SOURCES = ROOT / "content/sources"
SESSION = "2026-11-26-presidential-documents"
SCRIPT = "scripts/law/presidential_documents.py"
TOPIC = "presidential-documents"
API = "https://www.federalregister.gov/api/v1/documents.json"
TERMS = '(Indian|tribal|tribe|tribes|"Native American"|"Alaska Native"|"Native Hawaiian")'
FIELDS = ["document_number", "title", "subtype", "executive_order_number", "proclamation_number", "signing_date", "publication_date",
          "citation", "pdf_url", "html_url", "president"]
NATIVE = re.compile(r"\b(?:Indians?|Tribes?|Tribal|Native Americans?|Alaska Natives?|Native Hawaiians?|Indigenous|Pueblos?|Navajo|Sioux|Cherokee|American Indian)\b", re.I)
# A title that names Native people only by chance.
NOT_INDIAN_POLICY = re.compile(r"Indian Ocean", re.I)
# National monuments that Native nations proposed or help manage, by proclamation number.
MONUMENTS = {"7317": "Canyons of the Ancients", "9558": "Bears Ears", "10285": "Bears Ears", "11043": "Bears Ears",
             "10533": "Avi Kwa Ame", "10606": "Baaj Nwaavjo I'tah Kukveni", "10881": "Chuckwalla", "10882": "Sáttítla Highlands"}
RIGHTS = {"status": "no-permission-needed", "basis": "us-government-work",
          "basis_note": "A work of the United States government, not subject to copyright (17 U.S.C. § 105).",
          "redistribution": True}


def dump(value) -> str:
    return yaml.safe_dump(value, sort_keys=False, allow_unicode=True, width=10_000)


def get(url: str) -> bytes:
    for attempt in range(4):
        try:
            with urllib.request.urlopen(url, timeout=300) as response:
                return response.read()
        except Exception:  # noqa: BLE001 - retried, then raised
            if attempt == 3:
                raise
            time.sleep(5 * (attempt + 1))


def fetch(args) -> None:
    work = Path(args.work)
    (work / "files").mkdir(parents=True, exist_ok=True)
    query = [("per_page", "1000"), ("conditions[type][]", "PRESDOCU"), ("conditions[term]", TERMS)] + [("fields[]", field) for field in FIELDS]
    page = json.loads(get(f"{API}?{urllib.parse.urlencode(query)}"))
    found = page["results"]
    chosen = [document for document in found
              if (NATIVE.search(document["title"] or "") and not NOT_INDIAN_POLICY.search(document["title"]))
              or (document.get("proclamation_number") or "") in MONUMENTS]

    def download(document: dict) -> dict:
        path = work / "files" / f"{document['document_number']}.pdf"
        if not document.get("pdf_url"):
            document["problem"] = "no PDF listed"
            return document
        if not path.exists():
            data = get(document["pdf_url"])
            if not data.startswith(b"%PDF"):
                document["problem"] = "not a PDF"
                return document
            path.write_bytes(data)
        data = path.read_bytes()
        document.update(file=path.name, sha256=hashlib.sha256(data).hexdigest(), bytes=len(data))
        return document

    with concurrent.futures.ThreadPoolExecutor(4) as pool:
        chosen = list(pool.map(download, chosen))
    (work / "documents.json").write_text(json.dumps(chosen, indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"{page['count']} presidential documents use the terms; {len(chosen)} chosen, {sum(1 for d in chosen if d.get('file'))} downloaded")


def number_of(document: dict) -> str:
    if document.get("executive_order_number"):
        return f"Exec. Order No. {document['executive_order_number']}"
    if document.get("proclamation_number"):
        return f"Proclamation No. {document['proclamation_number']}"
    return ""


def record_key(document: dict) -> str:
    if document.get("executive_order_number"):
        return f"executive-order-{document['executive_order_number']}"
    if document.get("proclamation_number"):
        return f"proclamation-{document['proclamation_number']}"
    slug = re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", document["title"].lower())).strip("-")
    if len(slug) > 60:
        slug = slug[:60].rsplit("-", 1)[0]
    return f"presidential-memorandum-{document['signing_date'][:4]}-{slug}"


def thousands(number: str) -> str:
    return f"{int(number):,}" if number.isdigit() and len(number) > 4 else number


def short_date(value: str) -> str:
    day = dt.date.fromisoformat(value)
    month = {5: "May", 6: "June", 7: "July"}.get(day.month, f"{day:%b}.")
    return f"{month} {day.day}, {day.year}"


def record_for(document: dict, copy: dict | None, nations: list[str]) -> dict:
    kind = document["subtype"] or "Presidential document"
    number = number_of(document)
    title = (f"Executive Order {document['executive_order_number']}, {document['title']}" if document.get("executive_order_number")
             else f"Proclamation {document['proclamation_number']}, {document['title']}" if document.get("proclamation_number")
             else f"Memorandum, {document['title']}" if kind == "Memorandum" else document["title"])
    volume, _, page = document["citation"].partition(" FR ")
    signed = document.get("signing_date") or document["publication_date"]
    year, month, day = (int(part) for part in signed.split("-"))
    citation = {"type": "legislation", "title": title, "author": [{"literal": "United States"}], "container-title": "Federal Register",
                "volume": volume, "page": page}
    if number:
        citation["number"] = number
    citation.update({"genre": kind, "URL": document["html_url"], "issued": {"date-parts": [[year, month, day]]}, "accessed": {"date-parts": [[2026, 11, 26]]}})
    if document.get("executive_order_number"):
        indigo = f"Exec. Order No. {thousands(document['executive_order_number'])}, {volume} Fed. Reg. {thousands(page)} ({short_date(document['publication_date'])})"
    elif document.get("proclamation_number"):
        indigo = f"Proclamation No. {thousands(document['proclamation_number'])}, {volume} Fed. Reg. {thousands(page)} ({short_date(document['publication_date'])})"
    else:
        indigo = f"Memorandum on {document['title']}, {volume} Fed. Reg. {thousands(page)} ({short_date(document['publication_date'])})"
    president = (document.get("president") or {}).get("name", "")
    monument = MONUMENTS.get(document.get("proclamation_number") or "")
    notes = (f"Indigo Book citation: {indigo}. {kind} of the President published in the Federal Register ({document['citation']}, "
             f"{short_date(document['publication_date'])}; signed {short_date(signed)}"
             + (f"; PDF {document['pdf_url']})" if document.get("pdf_url") else "; GovInfo has no PDF of it, so no copy is stored)")
             + (f"; President: {president}" if president else "") + ". "
             + (f"Chosen because the {monument} National Monument is one that Native nations proposed or help manage. " if monument else "")
             + f"Title, number, dates and citation from the Federal Register API. Generated by {SCRIPT}, with the nations matched by name in the title; "
             "not yet read against the text (Unverified).")
    record = {"key": record_key(document), "kind": "executive-order", "citation": citation, "original_link": document["html_url"], "retrieved": "2026-11-26"}
    if copy:
        record["file"] = copy
    record["rights"] = RIGHTS
    record["jurisdictions"] = [{"level": "federal"}]
    if nations:
        record["tribes"] = nations
    record.update({"topics": ["presidential-document"], "access": {"open": True, "pull_from": ["free-web"]}, "found_in": [SESSION], "notes": notes,
                   "review": {"status": "unverified", "by": SCRIPT, "date": "2026-11-26",
                              "checks": [{"check": "listing", "result": "missing", "detail": f"Only the Federal Register API was read: {document['html_url']}"}]}})
    return record


def existing_keys() -> dict[str, Path]:
    return {path.stem: path for path in SOURCES.rglob("*.yaml")}


def file(args) -> None:
    sys.path.insert(0, str(ROOT / "scripts/captures"))
    import mirror_captures  # noqa: E402

    work = Path(args.work)
    documents = json.loads((work / "documents.json").read_text(encoding="utf-8"))
    existing = existing_keys()
    rows = mirror_captures.load_index()
    filed = {row["key"] for row in rows}
    by_digest = {row["sha256"]: row["key"] for row in rows}
    s3 = mirror_captures.client()
    bucket = mirror_captures.bucket_name()
    added = 0
    for document in documents:
        key = f"{TOPIC}/{document['document_number']}.pdf"
        if not document.get("file") or record_key(document) in existing and SESSION not in existing[record_key(document)].read_text(encoding="utf-8"):
            continue
        if key in filed or document["sha256"] in by_digest:
            continue
        path = work / "files" / document["file"]
        if mirror_captures.remote_state(s3, bucket, key) != (path.stat().st_size, document["sha256"]):
            s3.upload_file(str(path), bucket, key, ExtraArgs={"ContentType": "application/pdf", "Metadata": {
                "sha256": document["sha256"], "captured": dt.date.today().isoformat()}})
            if mirror_captures.remote_state(s3, bucket, key) != (path.stat().st_size, document["sha256"]):
                print("verification failed", key, file=sys.stderr)
                continue
        rows.append(mirror_captures.index_row(
            key=key, size=document["bytes"], digest=document["sha256"], media="application/pdf", topic=TOPIC,
            title=f"{document['subtype']}: {document['title']} ({document['citation']})", nations="",
            obtained="downloaded from GovInfo by script, chosen through the Federal Register API",
            links=[document["pdf_url"], document["html_url"]], record=record_key(document), redistribution="yes",
            rights="United States government work (17 U.S.C. § 105).", existing_keys=filed))
        filed.add(key)
        by_digest[document["sha256"]] = key
        added += 1
    mirror_captures.write_index(rows)
    print(f"filed {added}")


def records(args) -> None:
    sys.path.insert(0, str(ROOT / "scripts/law"))
    from nation_names import NationNames  # noqa: E402

    work = Path(args.work)
    # Three 1994 documents have no PDF on GovInfo; their records link the Federal Register's page and have no stored copy.
    documents = json.loads((work / "documents.json").read_text(encoding="utf-8"))
    copies = {row["sha256"]: {"storage_key": row["key"], "checksum": row["sha256"], "media_type": row["media_type"], "bytes": int(row["bytes"])}
              for row in csv.DictReader(CAPTURE_INDEX.open(encoding="utf-8"))}
    existing = existing_keys()
    names = NationNames()
    written = kept = 0
    for document in documents:
        key = record_key(document)
        if key in existing and SESSION not in existing[key].read_text(encoding="utf-8"):
            kept += 1
            continue
        path = SOURCES / key[0] / f"{key}.yaml"
        path.write_text(dump(record_for(document, copies.get(document.get("sha256", "")), names.find(document["title"]))), encoding="utf-8")
        written += 1
    print(f"wrote {written} records; {kept} already had a record")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    for name in ("fetch", "file", "records"):
        sub.add_parser(name).add_argument("--work", required=True)
    args = parser.parse_args()
    {"fetch": fetch, "file": file, "records": records}[args.command](args)


if __name__ == "__main__":
    main()
