#!/usr/bin/env python3
"""Source records and stored copies for the repatriation notices published in
the Federal Register under the Native American Graves Protection and
Repatriation Act since 1994 (data tier 2; Trevor, Nov. 26, 2026: "add these
to the data roadmap, attempt to grab the high value and scriptables").

The National Park Service publishes each notice of inventory completion,
notice of intent to repatriate, and the corrections to them, for the museum
or agency that holds the ancestors or objects. The notice names the Native
nations consulted and those that may claim them, so a nation's page can list
the repatriations that concern it. The Federal Register API gives each
notice's number, citation, title, date, abstract and GovInfo PDF (6,938
counted on Nov. 26, 2026, by the Act's name). Each is a work of the United
States government, so the PDF is kept in the bucket under
repatriation-notices/<document number>.pdf and served. The pages show the
notice and its facts; they describe ancestors' remains and sacred objects,
and the site adds no pictures.

The title and abstract rarely name a nation ("Indian Tribes in this
notice"), so the nations are read from the notice's own text in its PDF
(pdftotext). A Federal Register PDF holds whole pages, with the end of the
document before it and the start of the one after, so the text is cut from
the "[FR Doc." line of the document before to the notice's own one. When
the columns come out of order and the cut does not hold the notice's title,
only the title and abstract are matched. (federalregister.gov's own text
pages turn scripts away, so the PDF is read instead.)

This reuses scripts/law/federal_register_documents.py for the record's
shape, keys (federal-register-<document number>) and the check for notices
that already have a record. The nations are matched by name
(scripts/law/nation_names.py), as below. Every record starts Unverified.

Steps:
  fetch    Ask the API for the notices, year by year, and download each PDF.
           Writes --work/documents.json.
  file     Store each new PDF in the bucket and add it to the capture index.
  records  Write content/sources/f/federal-register-<number>.yaml for each
           notice without a record.

Usage:
  python3 scripts/law/repatriation_notices.py fetch --work DIR
  python3 scripts/law/repatriation_notices.py file --work DIR
  python3 scripts/law/repatriation_notices.py records --work DIR
"""
from __future__ import annotations

import argparse
import concurrent.futures
import datetime as dt
import json
import re
import subprocess
import sys
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts/law"))
import federal_register_documents as register  # noqa: E402

SESSION = "2026-11-26-repatriation-notices"
SCRIPT = "scripts/law/repatriation_notices.py"
TOPIC = "repatriation-notices"
AGENCY = "national-park-service"
AUTHOR = "U.S. Department of the Interior, National Park Service"
TERM = '"Native American Graves Protection"'


def listing(year: int) -> list[dict]:
    params = [("conditions[agencies][]", AGENCY), ("conditions[term]", TERM), ("conditions[publication_date][year]", str(year)),
              ("per_page", "1000"), ("order", "oldest")] + [("fields[]", field) for field in register.FIELDS]
    url = register.API + "?" + urllib.parse.urlencode(params)
    found = []
    while url:
        page = json.loads(register.get(url))
        found += page.get("results", [])
        url = page.get("next_page_url")
    return found


def fetch(args) -> None:
    work = Path(args.work)
    (work / "pdf").mkdir(parents=True, exist_ok=True)
    years = list(range(1994, dt.date.today().year + 1))
    documents: dict[str, dict] = {}
    with concurrent.futures.ThreadPoolExecutor(4) as pool:
        for found in pool.map(listing, years):
            for document in found:
                documents.setdefault(document["document_number"], document)
    stored = register.stored_by_number()

    def download(document: dict) -> str | None:
        number = document["document_number"]
        target = work / "pdf" / f"{number}.pdf"
        if number in stored or (target.exists() and target.stat().st_size > 0) or not document.get("pdf_url"):
            return None
        try:
            data = register.get(document["pdf_url"])
        except Exception as problem:  # noqa: BLE001 - reported
            return f"{number}: {problem}"
        if not data.startswith(b"%PDF"):
            return f"{number}: not a PDF"
        target.write_bytes(data)
        return None

    with concurrent.futures.ThreadPoolExecutor(6) as pool:
        problems = [problem for problem in pool.map(download, documents.values()) if problem]
    for problem in problems:
        print("FAILED", problem, file=sys.stderr)
    (work / "documents.json").write_text(json.dumps(sorted(documents.values(), key=lambda d: (d["publication_date"], d["document_number"])), indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"{len(documents)} notices; {len(problems)} downloads failed")


def file(args) -> None:
    sys.path.insert(0, str(ROOT / "scripts/captures"))
    import mirror_captures  # noqa: E402

    work = Path(args.work)
    documents = json.loads((work / "documents.json").read_text(encoding="utf-8"))
    rows = mirror_captures.load_index()
    filed = {row["key"] for row in rows}
    stored = register.stored_by_number()
    s3 = mirror_captures.client()
    bucket = mirror_captures.bucket_name()
    existing = register.existing_records()

    def put(document: dict):
        number = document["document_number"]
        key = f"{TOPIC}/{number}.pdf"
        path = work / "pdf" / f"{number}.pdf"
        if number in stored or key in filed or not path.exists():
            return None
        digest = mirror_captures.sha256_of(path)
        if mirror_captures.remote_state(s3, bucket, key) != (path.stat().st_size, digest):
            s3.upload_file(str(path), bucket, key, ExtraArgs={"ContentType": "application/pdf", "Metadata": {"sha256": digest, "captured": dt.date.today().isoformat()}})
            if mirror_captures.remote_state(s3, bucket, key) != (path.stat().st_size, digest):
                return ("failed", key)
        return ("ok", mirror_captures.index_row(
            key=key, size=path.stat().st_size, digest=digest, media="application/pdf", topic=TOPIC, title=document["title"], nations="",
            obtained="downloaded from GovInfo (Federal Register) by script", links=[document["pdf_url"], document["html_url"]],
            record=existing.get(number, register.record_key(number)), redistribution="yes",
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


FR_DOC = re.compile(r"\[FR\s*Doc\.?\s*([0-9A-Z]+(?:-[0-9A-Z]+)+)")


def plain(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", text.lower())


def own_text(work: Path, document: dict) -> str | None:
    """The notice's own words from its PDF, without the documents printed before and after it, or None."""
    number = document["document_number"]
    pdf, cached = work / "pdf" / f"{number}.pdf", work / "text" / f"{number}.txt"
    if not cached.exists():
        if not pdf.exists():
            return None
        cached.parent.mkdir(exist_ok=True)
        subprocess.run(["pdftotext", "-q", str(pdf), str(cached)], check=False)
        if not cached.exists():
            return None
    text = cached.read_text(encoding="utf-8", errors="replace").replace("\u2013", "-").replace("\u2014", "-")
    marks = [(mark.start(), mark.end(), mark.group(1)) for mark in FR_DOC.finditer(text)]
    own = [mark for mark in marks if mark[2] == number]
    if not own:
        return None
    end = own[0][0]
    before = [mark for mark in marks if mark[0] < end and mark[2] != number]
    start = 0
    if before:
        start = before[-1][1]
        billing = text.find("BILLING CODE", start, end)
        if billing != -1:
            start = text.find("\n", billing) + 1
    cut = re.sub(r"-\n(?=[a-z])", "", text[start:end])
    probe = " ".join(plain(document["title"].split(":", 1)[-1]).split()[:3])
    return cut if probe in plain(cut) or len(cut) >= 2500 else None


def record_for(document: dict, copy: dict | None, nations: list[str], from_text: bool = False) -> dict:
    document = {**document, "offices": []}
    record = register.record_for(document, copy, nations)
    record["citation"]["author"] = [{"literal": AUTHOR}]
    year, month, day = (int(part) for part in document["publication_date"].split("-"))
    record["notes"] = (f"Indigo Book citation: {document.get('volume')} Fed. Reg. {document.get('start_page')} ({register.MONTHS[month - 1]} {day}, {year}). "
                       f"{document['type']} of the National Park Service under the Native American Graves Protection and Repatriation Act. "
                       "Title, citation, date and kind from the Federal Register API (federalregister.gov/api/v1); "
                       + ("nations matched by name in the notice's text (its GovInfo PDF). " if from_text else "nations matched by name in the title and abstract. ")
                       + f"Generated by {SCRIPT}; not yet read by a person (Unverified).")
    record["found_in"] = [SESSION]
    record["review"]["by"] = SCRIPT
    position = list(record).index("access")
    items = list(record.items())
    items.insert(position, ("topics", ["repatriation"]))
    return dict(items)


def records(args) -> None:
    from nation_names import NationNames  # noqa: E402

    work = Path(args.work)
    documents = json.loads((work / "documents.json").read_text(encoding="utf-8"))
    names = NationNames()
    existing = register.existing_records()
    stored = register.stored_by_number()
    written = kept = 0
    for document in documents:
        number = document["document_number"]
        path = register.SOURCES / "f" / f"{register.record_key(number)}.yaml"
        if (number in existing and existing[number] != register.record_key(number)) or (path.exists() and SESSION not in path.read_text(encoding="utf-8")):
            kept += 1
            continue
        text = own_text(work, document)
        nations = names.find(f"{document['title']}. {document.get('abstract') or ''} {text or ''}")
        path.write_text(register.dump(record_for(document, stored.get(number), nations, text is not None)), encoding="utf-8")
        written += 1
    print(f"wrote {written} records; {kept} notices already had a record")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    for name in ("fetch", "file", "records"):
        sub.add_parser(name).add_argument("--work", required=True)
    args = parser.parse_args()
    {"fetch": fetch, "file": file, "records": records}[args.command](args)


if __name__ == "__main__":
    main()
