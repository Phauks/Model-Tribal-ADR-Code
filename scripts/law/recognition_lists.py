#!/usr/bin/env python3
"""Source records for every list of federally recognized Native nations the
Bureau of Indian Affairs has published in the Federal Register, from the
first in 1979 to today (data tier 1; Trevor, Nov. 24, 2026).

Since the Federally Recognized Indian Tribe List Act of 1994 the Bureau
publishes the list every year; before that it published one every year or
two from 1979. The lists since 1995 come from the Federal Register API
(https://www.federalregister.gov/developers/documentation/api/v1), with the
notice's PDF from GovInfo. The lists before 1995 are older than the API, so
EARLY names each by its Federal Register citation; `fetch` downloads the
issue from GovInfo (https://www.govinfo.gov/link/fr/<volume>/<page>), finds
the notice by its heading and the page number, and keeps only the notice's
pages. A citation whose page does not show a list heading is reported and
gets no record.

Each copy is stored in the bucket under recognition-lists/<key>.pdf. The
existing record of the Jan. 30, 2026 list (bia-recognized-entities-2026)
keeps its key and text and gains the stored copy.

Usage:
  python3 scripts/law/recognition_lists.py fetch --work DIR
  python3 scripts/law/recognition_lists.py file --work DIR --captures /mnt/project-files/research/captures
  python3 scripts/law/recognition_lists.py records
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import subprocess
import sys
import time
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "research/raw/2026-11-24/recognition-lists.json"
INDEX = ROOT / "research/capture-index.csv"
SOURCES = ROOT / "content/sources"
SESSION = "2026-11-24-federal-recognition-lists"
TODAY = "2026-11-24"
API = "https://www.federalregister.gov/api/v1/documents.json"
MONTHS = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."]
# Lists published before the Federal Register API's coverage starts (1994), by citation. 44 FR 7235 (1979),
# 53 FR 52829 (1988; the 1995 notice cites page 52832, inside it) and 58 FR 54364 (1993) are cited in the 1995
# list, 60 Fed. Reg. 9250; 47 FR 53130 (1982) is cited in the 1988 list; the others are the citations as commonly
# given. `fetch` checks each against the issue's text and drops any that does not show a list.
EARLY = [(44, 7235), (45, 27828), (46, 35360), (47, 53130), (48, 56862), (50, 6055), (51, 25115),
         (53, 52829), (58, 54364)]
# Matched against a page's letters only, lowercased, since the scans' text has stray spaces and digits.
HEADING = re.compile(r"indian(tribal)?enti[a-z]{1,4}(thathave|recognized)")


FILED = re.compile(r"\[\s*F\s?R\s+D\s?o\s?c")


def letters(text: str) -> str:
    return re.sub(r"[^a-z]", "", text.lower())
RIGHTS = {"status": "no-permission-needed", "basis": "us-government-work",
          "basis_note": "A work of the United States government, not subject to copyright (17 U.S.C. § 105).",
          "redistribution": True}


def dump(value) -> str:
    return yaml.safe_dump(value, allow_unicode=True, sort_keys=False, width=float("inf"))


def run(*command: str) -> subprocess.CompletedProcess:
    return subprocess.run(list(command), capture_output=True, text=True)


def long_date(value: str) -> str:
    year, month, day = (int(part) for part in value.split("-"))
    return f"{MONTHS[month - 1]} {day}, {year}"


def recent() -> list[dict]:
    fields = ["title", "citation", "publication_date", "document_number", "pdf_url", "html_url", "start_page", "end_page", "volume"]
    query = "&".join(["per_page=200", "order=oldest", "conditions[term]=%22Indian%20Entities%20Recognized%22"] + [f"fields[]={f}" for f in fields])
    results = json.loads(run("curl", "-gsf", "-A", "Mozilla/5.0", f"{API}?{query}").stdout)["results"]
    return [item for item in results if item["title"].lower().startswith("indian entities recognized")]


def early(volume: int, page: int, work: Path) -> dict:
    """Find a pre-1995 list in its Federal Register issue and keep only its pages."""
    resolved = run("curl", "-sIL", "-A", "Mozilla/5.0", "-o", "/dev/null", "-w", "%{url_effective}",
                   f"https://www.govinfo.gov/link/fr/{volume}/{page}?link-type=pdf").stdout.split("#")[0]
    found = {"volume": volume, "page": page, "issue_pdf": resolved, "result": "", "pdf_pages": ""}
    match = re.search(r"FR-(\d{4}-\d{2}-\d{2})\.pdf$", resolved)
    if not match:
        found["result"] = "no issue on GovInfo"
        return found
    found["publication_date"] = match.group(1)
    issue = work / "issues" / Path(resolved).name
    if not issue.exists():
        run("curl", "-sL", "-m", "600", "-A", "Mozilla/5.0", "-o", str(issue), resolved)
    pages = int(re.search(r"Pages:\s+(\d+)", run("pdfinfo", str(issue)).stdout).group(1))
    start = end = None
    for number in range(1, pages + 1):
        text = run("pdftotext", "-f", str(number), "-l", str(number), str(issue), "-").stdout
        # Skip the issue's table of contents, which names the notice too.
        heading = HEADING.search(letters(text)) if start is None and "contents" not in letters(text[:400]) else None
        if heading:
            # The notice may start below another notice's end: look for this notice's end after its heading.
            at = re.search(r"indian\W+(tribal\W+)?entities", text, re.I)
            start, text = number, text[at.start():] if at else text
        if start is not None and (FILED.search(text) or number - start > 40):
            end = number
            break
    if start is None:
        found["result"] = "no list heading in the issue"
        return found
    end = end or pages
    found["pdf_pages"] = f"{start}-{end}"
    found["result"] = "ok"
    words = HEADING.search(letters(run("pdftotext", "-f", str(start), "-l", str(start), str(issue), "-").stdout))
    found["title"] = ("Indian Tribal Entities That Have a Government-to-Government Relationship With the United States" if words.group(2) == "thathave"
                      else f"Indian {'Tribal ' if words.group(1) else ''}Entities Recognized and Eligible To Receive Services From the United States Bureau of Indian Affairs")
    out = work / "pdf" / f"bia-recognized-entities-{found['publication_date']}.pdf"
    from pypdf import PdfReader, PdfWriter
    reader, writer = PdfReader(issue), PdfWriter()
    for index in range(start - 1, end):
        writer.add_page(reader.pages[index])
    writer.write(out)
    if not out.exists():
        found["result"] = "could not extract pages"
    return found


def fetch(args) -> None:
    work = Path(args.work)
    for folder in ("issues", "pdf"):
        (work / folder).mkdir(parents=True, exist_ok=True)
    lists = recent()
    for item in lists:
        out = work / "pdf" / f"{item['document_number']}.pdf"
        if not out.exists():
            run("curl", "-sfL", "-m", "300", "-A", "Mozilla/5.0", "-o", str(out), item["pdf_url"])
            time.sleep(0.5)
    older = []
    for volume, page in EARLY:
        older.append(early(volume, page, work))
        print(older[-1])
    RAW.write_text(json.dumps({"generated": TODAY, "sources": [API, "https://www.govinfo.gov/link/fr/"],
                               "since_1995": lists, "before_1995": older}, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"since 1995: {len(lists)} notices; before 1995: {sum(1 for o in older if o['result'] == 'ok')} of {len(older)} found")


def plan() -> list[dict]:
    raw = json.loads(RAW.read_text(encoding="utf-8"))
    items = []
    for old in raw["before_1995"]:
        if old["result"] == "ok":
            items.append({"date": old["publication_date"], "volume": str(old["volume"]), "page": str(old["page"]), "document": "",
                          "title": old["title"], "link": old["issue_pdf"],
                          "local": f"bia-recognized-entities-{old['publication_date']}.pdf", "pdf_pages": old["pdf_pages"]})
    for item in raw["since_1995"]:
        items.append({"date": item["publication_date"], "volume": str(item["volume"]), "page": str(item["start_page"]),
                      "end": str(item["end_page"]), "document": item["document_number"], "title": item["title"],
                      "link": item["html_url"], "pdf": item["pdf_url"], "local": f"{item['document_number']}.pdf"})
    years: dict[str, int] = {}
    for item in items:
        years[item["date"][:4]] = years.get(item["date"][:4], 0) + 1
    for item in items:
        year = item["date"][:4]
        item["key"] = f"bia-recognized-entities-{year}" if years[year] == 1 else f"bia-recognized-entities-{item['date']}"
        if "Correction" in item["title"]:
            item["key"] += "-correction"
    for item in items:
        if item["document"] == "2026-01899":
            item["key"] = "bia-recognized-entities-2026"
    return items


def file(args) -> None:
    sys.path.insert(0, str(ROOT / "scripts/captures"))
    import mirror_captures  # noqa: E402

    filed = {row["key"] for row in csv.DictReader(INDEX.open(encoding="utf-8"))}
    for item in plan():
        local = Path(args.work) / "pdf" / item["local"]
        if f"recognition-lists/{item['key']}.pdf" in filed or not local.exists():
            continue
        mirror_captures.add(argparse.Namespace(
            captures=args.captures, files=[str(local)], topic="recognition-lists", name=f"{item['key']}.pdf", record=item["key"],
            obtained="downloaded from GovInfo (Federal Register) by script", title=f"{item['title']}, {item['volume']} Fed. Reg. {item['page']}",
            link=[item.get("pdf") or item["link"]], redistribution="yes", nations="",
            rights="United States government work (17 U.S.C. § 105).", keep_local=False))


def stored_copies() -> dict[str, dict]:
    """Stored copies by record key: this script's, and a list's PDF filed earlier for its record (such as the 2026 list under govinfo/)."""
    copies = {}
    for row in csv.DictReader(INDEX.open(encoding="utf-8")):
        block = {"storage_key": row["key"], "checksum": row["sha256"], "media_type": row["media_type"], "bytes": int(row["bytes"])}
        if row["key"].startswith("recognition-lists/"):
            copies[Path(row["key"]).stem] = block
        elif row["media_type"] == "application/pdf":
            for record in row["records"].split(";"):
                if record.strip().startswith("bia-recognized-entities-"):
                    copies.setdefault(record.strip(), block)
    return copies


def add_file_block(path: Path, block: dict) -> bool:
    text = path.read_text(encoding="utf-8")
    if "\nfile:\n" in text:
        return False
    text = text.replace("\nrights:\n", "\n" + dump({"file": block}) + "rights:\n", 1)
    text = re.sub(r"\nfound_in:\n((?:\s*- .*\n)+)", lambda m: f"\nfound_in:\n{m.group(1)}  - {SESSION}\n", text, count=1)
    path.write_text(text, encoding="utf-8")
    return True


def thousands(number: str) -> str:
    return f"{int(number):,}" if int(number) >= 10000 else number


def record_for(item: dict, copy: dict | None, previous: dict | None) -> dict:
    year, month, day = (int(part) for part in item["date"].split("-"))
    citation = {"type": "legislation", "title": item["title"], "container-title": "Federal Register", "container-title-short": "Fed. Reg.",
                "author": [{"literal": "U.S. Department of the Interior, Bureau of Indian Affairs"}], "volume": item["volume"],
                "page": f"{item['page']}-{item['end']}" if item.get("end") and item["end"] != item["page"] else item["page"]}
    if item["document"]:
        citation["number"] = f"FR Doc. {item['document']}"
    citation.update({"URL": item["link"], "issued": {"date-parts": [[year, month, day]]}, "accessed": {"date-parts": [[2026, 11, 24]]}})
    record = {"key": item["key"], "kind": "federal-register-notice", "citation": citation, "original_link": item["link"],
              "retrieved": TODAY, "archives": []}
    if copy:
        record["file"] = copy
    record["rights"] = RIGHTS
    record["jurisdictions"] = [{"level": "federal"}]
    record["found_in"] = [SESSION]
    indigo = f"{item['volume']} Fed. Reg. {thousands(item['page'])} ({long_date(item['date'])})"
    kind = "A correction to the list" if "Correction" in item["title"] else "The Bureau of Indian Affairs' list of federally recognized Native nations"
    after = f" It follows the list of {long_date(previous['date'])} ({previous['volume']} Fed. Reg. {thousands(previous['page'])})." if previous else " The first such list."
    where = (f" The stored copy is pages {item['pdf_pages']} of the day's issue on GovInfo ({item['link']})." if item.get("pdf_pages") else
             f" The stored copy is the notice's PDF on GovInfo ({item['pdf']})." if copy else "")
    record["notes"] = (f"Indigo Book citation: {item['title']}, {indigo}. {kind}, as published in the Federal Register.{after}{where} "
                       "Metadata generated by scripts/law/recognition_lists.py; the entries have not been compared with the nation records (Unverified).")
    return record


def records(args) -> None:
    copies = stored_copies()
    written = updated = 0
    previous = None
    for item in plan():
        path = SOURCES / item["key"][0] / f"{item['key']}.yaml"
        copy = copies.get(item["key"])
        if path.exists() and SESSION not in path.read_text(encoding="utf-8"):
            if item["key"] != "bia-recognized-entities-2026":
                sys.exit(f"key in use by another record: {item['key']}")
            updated += bool(copy and add_file_block(path, copy))
        else:
            path.write_text(dump(record_for(item, copy, previous)), encoding="utf-8")
            written += 1
        if "Correction" not in item["title"]:
            previous = item
    print(f"recognition lists: {written} records written, {updated} existing record given its copy")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    for name in ("fetch", "file", "records"):
        p = sub.add_parser(name)
        if name in ("fetch", "file"):
            p.add_argument("--work", required=True)
        if name == "file":
            p.add_argument("--captures", required=True)
    args = parser.parse_args()
    {"fetch": fetch, "file": file, "records": records}[args.command](args)


if __name__ == "__main__":
    main()
