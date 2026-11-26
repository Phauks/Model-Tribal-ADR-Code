#!/usr/bin/env python3
"""Source records and stored copies for every Federal Register document of
the Indian affairs offices since 1994 (data tier 2; Trevor, Nov. 26, 2026:
"Start with tier 2. Work to completion"): the Bureau of Indian Affairs
(3,322 documents counted on Nov. 26, 2026), the National Indian Gaming
Commission (362), the Office of the Special Trustee for American Indians,
the Indian Arts and Crafts Board, the Navajo and Hopi Indian Relocation
Office and the Indian Trust Transition Office (counted in
research/analyses/2026-11-26-tier-2-and-3-data-sources.md, section 2.5).
Among them are the liquor ordinances, reservation proclamations, trust land
acquisitions, gaming compact notices, acknowledgment findings and the lists
of recognized nations.

The Federal Register API (https://www.federalregister.gov/developers/documentation/api/v1)
gives each document's number, citation, title, type, date, abstract and the
address of its PDF on GovInfo. Every document is a work of the United States
government, so the project keeps the GovInfo PDF in the bucket under
federal-register/<document number>.pdf and serves it. A document that
already has a record (the 819 the project held, keyed
federal-register-<document number> or named otherwise) keeps its record;
one whose PDF is already stored reuses that copy.

The title, date and citation come from the Federal Register itself. The
nations are matched by name in the title and the abstract
(scripts/law/nation_names.py).

Steps:
  fetch    Ask the API for every document of each office, year by year, and
           download each PDF not already stored. Writes --work/documents.json.
  file     Store each new PDF in the bucket and add it to the capture index.
  records  Write content/sources/f/federal-register-<number>.yaml for each
           document without a record.

Usage:
  python3 scripts/law/federal_register_documents.py fetch --work DIR
  python3 scripts/law/federal_register_documents.py file --work DIR
  python3 scripts/law/federal_register_documents.py records --work DIR
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
SESSION = "2026-11-26-federal-register-indian-affairs"
SCRIPT = "scripts/law/federal_register_documents.py"
API = "https://www.federalregister.gov/api/v1/documents.json"
UA = {"User-Agent": "Mozilla/5.0 (research script)"}
FIELDS = ["document_number", "citation", "title", "type", "publication_date", "pdf_url", "html_url", "agencies", "start_page", "end_page",
          "volume", "abstract", "signing_date", "effective_on", "cfr_references", "docket_ids"]
# The Indian affairs offices, as the API names them, and how a record names its author.
OFFICES = {
    "indian-affairs-bureau": "U.S. Department of the Interior, Bureau of Indian Affairs",
    "national-indian-gaming-commission": "National Indian Gaming Commission",
    "special-trustee-for-american-indians-office": "U.S. Department of the Interior, Office of the Special Trustee for American Indians",
    "indian-arts-and-crafts-board": "U.S. Department of the Interior, Indian Arts and Crafts Board",
    "navajo-and-hopi-indian-relocation-office": "Office of Navajo and Hopi Indian Relocation",
    "indian-trust-transition-office": "U.S. Department of the Interior, Indian Trust Transition Office",
}
MONTHS = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."]
RIGHTS = {"status": "no-permission-needed", "basis": "us-government-work",
          "basis_note": "A work of the United States government, not subject to copyright (17 U.S.C. § 105).",
          "redistribution": True}


def record_key(number: str) -> str:
    """federal-register-2013-05334; a correction's "C1-2013-05334" becomes federal-register-c1-2013-05334."""
    return "federal-register-" + re.sub(r"[^a-z0-9]+", "-", number.lower()).strip("-")


def dump(value) -> str:
    return yaml.safe_dump(value, allow_unicode=True, sort_keys=False, width=float("inf"))


def get(url: str) -> bytes:
    for attempt in range(5):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120) as response:
                return response.read()
        except Exception:  # noqa: BLE001 - retried, then raised
            if attempt == 4:
                raise
            time.sleep(5 * (attempt + 1))


def listing(office: str, year: int) -> list[dict]:
    """Every document of one office published in one year (the API pages at most 2,000 results, so a year at a time)."""
    params = [("conditions[agencies][]", office), ("conditions[publication_date][year]", str(year)), ("per_page", "1000"), ("order", "oldest")]
    params += [("fields[]", field) for field in FIELDS]
    url = API + "?" + urllib.parse.urlencode(params)
    found = []
    while url:
        page = json.loads(get(url))
        found += page.get("results", [])
        url = page.get("next_page_url")
    return found


def stored_by_number() -> dict[str, dict]:
    """PDFs of Federal Register documents already in the bucket, by document number."""
    stored = {}
    for row in csv.DictReader(CAPTURE_INDEX.open(encoding="utf-8")):
        if not row["key"].endswith(".pdf") or row["redistribution"] != "yes":
            continue
        for link in row["link"].split():
            match = re.search(r"govinfo\.gov/content/pkg/FR-[\d-]+/pdf/([\w-]+)\.pdf$", link)
            if match:
                stored.setdefault(match.group(1), {"storage_key": row["key"], "checksum": row["sha256"], "media_type": row["media_type"], "bytes": int(row["bytes"])})
    return stored


def fetch(args) -> None:
    work = Path(args.work)
    (work / "pdf").mkdir(parents=True, exist_ok=True)
    documents: dict[str, dict] = {}
    this_year = dt.date.today().year
    jobs = [(office, year) for office in OFFICES for year in range(1994, this_year + 1)]
    with concurrent.futures.ThreadPoolExecutor(4) as pool:
        for (office, year), found in zip(jobs, pool.map(lambda job: listing(*job), jobs)):
            for document in found:
                entry = documents.setdefault(document["document_number"], document)
                entry.setdefault("offices", [])
                if office not in entry["offices"]:
                    entry["offices"].append(office)
    stored = stored_by_number()

    def download(document: dict) -> str | None:
        number = document["document_number"]
        target = work / "pdf" / f"{number}.pdf"
        if number in stored or (target.exists() and target.stat().st_size > 0) or not document.get("pdf_url"):
            return None
        try:
            data = get(document["pdf_url"])
        except Exception as problem:  # noqa: BLE001 - reported
            return f"{number}: {problem}"
        if not data.startswith(b"%PDF"):
            return f"{number}: not a PDF"
        target.write_bytes(data)
        return None

    with concurrent.futures.ThreadPoolExecutor(6) as pool:
        problems = [p for p in pool.map(download, documents.values()) if p]
    for problem in problems:
        print("FAILED", problem, file=sys.stderr)
    (work / "documents.json").write_text(json.dumps(sorted(documents.values(), key=lambda d: (d["publication_date"], d["document_number"])), indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"{len(documents)} documents; {len(problems)} downloads failed")


def file(args) -> None:
    sys.path.insert(0, str(ROOT / "scripts/captures"))
    import mirror_captures  # noqa: E402

    work = Path(args.work)
    documents = json.loads((work / "documents.json").read_text(encoding="utf-8"))
    rows = mirror_captures.load_index()
    filed = {row["key"] for row in rows}
    stored = stored_by_number()
    s3 = mirror_captures.client()
    bucket = mirror_captures.bucket_name()
    existing = existing_records()

    def put(document: dict):
        number = document["document_number"]
        key = f"federal-register/{number}.pdf"
        path = work / "pdf" / f"{number}.pdf"
        if number in stored or key in filed or not path.exists():
            return None
        digest = mirror_captures.sha256_of(path)
        if mirror_captures.remote_state(s3, bucket, key) != (path.stat().st_size, digest):
            s3.upload_file(str(path), bucket, key, ExtraArgs={"ContentType": "application/pdf", "Metadata": {"sha256": digest, "captured": dt.date.today().isoformat()}})
            if mirror_captures.remote_state(s3, bucket, key) != (path.stat().st_size, digest):
                return ("failed", key)
        return ("ok", mirror_captures.index_row(
            key=key, size=path.stat().st_size, digest=digest, media="application/pdf", topic="federal-register", title=document["title"], nations="",
            obtained="downloaded from GovInfo (Federal Register) by script", links=[document["pdf_url"], document["html_url"]],
            record=existing.get(number, record_key(number)), redistribution="yes",
            rights="United States government work (17 U.S.C. § 105).", existing_keys=filed))

    added = 0
    with concurrent.futures.ThreadPoolExecutor(8) as pool:
        for result in pool.map(put, documents):
            if not result:
                continue
            if result[0] == "failed":
                print("verification failed", result[1], file=sys.stderr)
                continue
            rows.append(result[1])
            added += 1
    mirror_captures.write_index(rows)
    print(f"filed {added}")


def existing_records() -> dict[str, str]:
    """The records that already cite a Federal Register document, by document number."""
    found = {}
    for path in SOURCES.rglob("*.yaml"):
        text = path.read_text(encoding="utf-8")
        if "federalregister.gov" not in text and "FR Doc" not in text and "/FR-" not in text:
            continue
        if SESSION in text:
            continue  # this script's own records are rewritten, not kept
        key = re.search(r"^key: (.+)$", text, re.M).group(1).strip()
        # Document numbers such as 2013-05334, E7-5220 (an executive document) or C1-2013-05334 (a correction).
        number_pattern = r"((?:[A-Z]\d-)?[0-9]{2,4}-[0-9]+|[A-Z]\d-[0-9]+)"
        for number in set(re.findall(rf"FR Doc\.? {number_pattern}", text) + re.findall(rf"federalregister\.gov/documents/\d{{4}}/\d{{2}}/\d{{2}}/{number_pattern}/", text)
                          + re.findall(rf"/FR-[\d-]+/pdf/{number_pattern}\.pdf", text)):
            # A list of recognized nations or a case record that cites a notice is not the notice's own record; prefer the federal-register-<number> key.
            if number not in found or key == record_key(number):
                found[number] = key
    return found


def record_for(document: dict, copy: dict | None, nations: list[str]) -> dict:
    year, month, day = (int(part) for part in document["publication_date"].split("-"))
    volume, page = document.get("volume"), document.get("start_page")
    authors = [OFFICES[office] for office in document["offices"]]
    citation = {"type": "legislation", "title": document["title"].strip(), "container-title": "Federal Register", "container-title-short": "Fed. Reg.",
                "volume": str(volume), "page": str(page), "author": [{"literal": author} for author in authors],
                "number": f"FR Doc. {document['document_number']}", "genre": document["type"],
                "URL": document["html_url"], "issued": {"date-parts": [[year, month, day]]}, "accessed": {"date-parts": [[2026, 11, 26]]}}
    notes = (f"Indigo Book citation: {volume} Fed. Reg. {page} ({MONTHS[month - 1]} {day}, {year}). "
             f"{document['type']} of the {' and the '.join(a.split(', ')[-1] for a in authors)}. "
             f"Title, citation, date and kind from the Federal Register API (federalregister.gov/api/v1); nations matched by name in the title and abstract. "
             f"Generated by {SCRIPT}; not yet read by a person (Unverified).")
    record = {"key": record_key(document["document_number"]), "kind": "federal-register-notice", "citation": citation,
              "original_link": document["html_url"], "retrieved": "2026-11-26"}
    if copy:
        record["file"] = copy
    record["rights"] = RIGHTS
    record["jurisdictions"] = [{"level": "federal"}]
    if nations:
        record["tribes"] = nations
    record.update({"access": {"open": True, "pull_from": ["free-web"]}, "found_in": [SESSION], "notes": notes,
                   "review": {"status": "unverified", "by": SCRIPT, "date": "2026-11-26",
                              "checks": [{"check": "citation", "result": "missing", "detail": f"Federal Register API only: {document.get('citation', '')}, published {document['publication_date']}"}]}})
    return record


def records(args) -> None:
    sys.path.insert(0, str(ROOT / "scripts/law"))
    from nation_names import NationNames  # noqa: E402

    work = Path(args.work)
    documents = json.loads((work / "documents.json").read_text(encoding="utf-8"))
    names = NationNames()
    existing = existing_records()
    stored = stored_by_number()
    written = 0
    for document in documents:
        number = document["document_number"]
        if number in existing and existing[number] != record_key(number):
            stale = SOURCES / "f" / f"{record_key(number)}.yaml"
            if stale.exists() and SESSION in stale.read_text(encoding="utf-8"):
                stale.unlink()  # an earlier run's record for a notice another record already covers
            continue
        path = SOURCES / "f" / f"{record_key(number)}.yaml"
        if path.exists() and SESSION not in path.read_text(encoding="utf-8"):
            continue
        nations = names.find(f"{document['title']}. {document.get('abstract') or ''}")
        path.write_text(dump(record_for(document, stored.get(number), nations)), encoding="utf-8")
        written += 1
    print(f"wrote {written} records")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    for name in ("fetch", "file", "records"):
        sub.add_parser(name).add_argument("--work", required=True)
    args = parser.parse_args()
    {"fetch": fetch, "file": file, "records": records}[args.command](args)


if __name__ == "__main__":
    main()
