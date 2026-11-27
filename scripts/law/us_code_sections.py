#!/usr/bin/env python3
"""The official text of each United States Code section that has its own
source record (usc-<title>-<section> and us-code-title-<t>-section-<s>), from
the annual edition on GovInfo, stored in the bucket so the section's page can
show it (thread "Host the text of U.S. Code sections", Nov. 27, 2026).

Why: these records were made from Cornell's Legal Information Institute pages
(Nov. 21-23, 2026), and LII's page was the only copy kept. The Title 25 work
(scripts/law/title_25_records.py) stored a PDF for each chapter, not each
section, so a section's page showed either nothing (the LII copy is private)
or LII's whole web page. The Code is a work of the United States government
(17 U.S.C. § 105).

Source: GovInfo's link service,
https://www.govinfo.gov/link/uscode/<title>/<section>?year=<edition>&link-type=pdf,
which answers with the section's granule PDF (for example
USCODE-2024-title25-chap6-subchapI-sec232.pdf), the section's text with its
notes. A record that cites several sections gets one PDF made by joining the
sections' PDFs in order (pdfunite); a record that cites a whole chapter gets
the chapter's PDF.

Steps:
  fetch    Download the PDFs into --work and write research/raw/2026-11-27/us-code-sections.json.
  file     Store them in the bucket under united-states-code/<edition>/title-<t>-section-<s>.pdf
           with scripts/captures/mirror_captures.py (SHA-256 checked after upload).
  records  Give each record a `file` block (the stored copy) and a sentence in its notes.

Usage:
  python3 scripts/law/us_code_sections.py fetch --work DIR
  python3 scripts/law/us_code_sections.py file --work DIR --captures /mnt/project-files/research/captures
  python3 scripts/law/us_code_sections.py records
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
import re
import subprocess
import sys
import time
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "research/raw/2026-11-27/us-code-sections.json"
INDEX = ROOT / "research/capture-index.csv"
SOURCES = ROOT / "content/sources/u"
SESSION = "2026-11-27-us-code-sections"
EDITION = 2024
LINK = "https://www.govinfo.gov/link/uscode/{title}/{section}?year={year}&link-type=pdf"
CHAPTER = "https://www.govinfo.gov/content/pkg/USCODE-{year}-title{title}/pdf/USCODE-{year}-title{title}-chap{chapter}.pdf"
RIGHTS = "United States government work (17 U.S.C. § 105)."
# Sections GovInfo's link service answers with an error (400) though the granule is there.
GRANULES = {("5", "561"): "USCODE-{year}-title5-partI-chap5-subchapIII-sec561"}
GRANULE = "https://www.govinfo.gov/content/pkg/USCODE-{year}-title{title}/pdf/{granule}.pdf"

# What each record cites: a list of ("section", title, number) or ("chapter", title, number).
# Read from each record's citation; a record that cites a range names every section in it.
CITES: dict[str, list[tuple[str, str, str]]] = {
    "us-code-20-7512-native-hawaiian-education-findings": [("section", "20", "7512")],
    "us-code-title-18-section-1162": [("section", "18", "1162")],
    "us-code-title-18-section-3243": [("section", "18", "3243")],
    "us-code-title-25-section-232": [("section", "25", "232")],
    "us-code-title-25-section-233": [("section", "25", "233")],
    "usc-18-1151": [("section", "18", "1151")],
    "usc-18-1152": [("section", "18", "1152")],
    "usc-18-2265": [("section", "18", "2265")],
    "usc-20-5604": [("section", "20", "5604")],
    "usc-25-1322": [("section", "25", "1322")],
    "usc-25-1911": [("section", "25", "1911")],
    "usc-25-2710": [("section", "25", "2710")],
    "usc-25-5130": [("section", "25", "5130")],
    "usc-25-5304": [("section", "25", "5304")],
    "usc-25-5329-c-model-agreement-disputes": [("section", "25", "5329")],
    "usc-25-5331": [("section", "25", "5331")],
    "usc-28-1738": [("section", "28", "1738")],
    "usc-28-1738b": [("section", "28", "1738B")],
    "usc-28-471-473": [("section", "28", "471"), ("section", "28", "473")],
    "usc-28-651": [("section", "28", "651")],
    "usc-28-652": [("section", "28", "652")],
    "usc-28-654": [("section", "28", str(n)) for n in range(654, 659)],
    "usc-29-173": [("section", "29", "173")],
    "usc-41-7103-h": [("section", "41", "7103")],
    "usc-48-1421a": [("section", "48", "1421a")],
    "usc-48-1661": [("section", "48", "1661")],
    "usc-5-561": [("section", "5", "561")],
    "usc-5-571": [("section", "5", "571")],
    "usc-5-574": [("section", "5", "574")],
    "usc-9-1-commerce-territory": [("section", "9", "1")],
    "usc-9-2": [("section", "9", "2")],
    "usc-9-201-301": [("chapter", "9", "2"), ("chapter", "9", "3")],
    "usc-9-3-4": [("section", "9", "3"), ("section", "9", "4")],
    "usc-9-401-402": [("chapter", "9", "4")],
    "usc-9-9-11": [("section", "9", "9"), ("section", "9", "10"), ("section", "9", "11")],
    # The record is § 8077(b)-(d) of the Department of Defense Appropriations Act, 1991, which amended
    # 25 U.S.C. § 1301(2) and (4); the Code section shows the text as amended, with the Act in its notes.
    "usc-25-1301": [("section", "25", "1301")],
}


def fetch_pdf(url: str, path: Path) -> str:
    """Download url to path, following redirects; returns the final address."""
    for attempt in range(4):
        result = subprocess.run(["curl", "-gsfL", "-m", "180", "-A", "Mozilla/5.0", "-o", str(path),
                                 "-w", "%{url_effective}", url], capture_output=True, text=True)
        if result.returncode == 0 and path.read_bytes()[:5] == b"%PDF-":
            return result.stdout.strip()
        time.sleep(3 * (attempt + 1))
    sys.exit(f"could not download a PDF from {url}")


def label(cites: list[tuple[str, str, str]]) -> str:
    """The cite as the Indigo Book writes it: "25 U.S.C. § 232", "9 U.S.C. §§ 9, 10, 11", "9 U.S.C. chs. 2, 3"."""
    title = cites[0][1]
    if cites[0][0] == "chapter":
        numbers = [c[2] for c in cites]
        return f"{title} U.S.C. ch{'s' if len(numbers) > 1 else ''}. {', '.join(numbers)}"
    numbers = [c[2] for c in cites]
    return f"{title} U.S.C. §{'§' if len(numbers) > 1 else ''} {', '.join(numbers)}"


def file_name(key: str, cites: list[tuple[str, str, str]]) -> str:
    title = cites[0][1]
    kind = cites[0][0]
    numbers = [c[2].lower() for c in cites]
    # A run of sections is "654-658"; two sections that are not a run are "471-and-473".
    run = kind == "section" and len(numbers) > 2
    span = numbers[0] if len(numbers) == 1 else f"{numbers[0]}-{numbers[-1]}" if run else "-and-".join(numbers)
    return f"title-{title}-{kind}{'s' if len(numbers) > 1 else ''}-{span}.pdf"


def fetch(args) -> None:
    work = Path(args.work)
    (work / "parts").mkdir(parents=True, exist_ok=True)
    out = {"note": "Generated by scripts/law/us_code_sections.py.", "edition": EDITION,
           "read": dt.date.today().isoformat(), "records": {}}
    for key, cites in CITES.items():
        parts, links = [], []
        for kind, title, number in cites:
            if kind == "chapter":
                url = CHAPTER.format(year=EDITION, title=title, chapter=number)
            elif (title, number) in GRANULES:
                url = GRANULE.format(year=EDITION, title=title, granule=GRANULES[(title, number)].format(year=EDITION))
            else:
                url = LINK.format(title=title, section=number, year=EDITION)
            part = work / "parts" / f"{title}-{kind}-{number.lower()}.pdf"
            final = fetch_pdf(url, part)
            if f"USCODE-{EDITION}-title{title}" not in final:
                sys.exit(f"{key}: GovInfo answered with another edition or title: {final}")
            parts.append(part)
            links.append(final)
            time.sleep(0.5)
        name = file_name(key, cites)
        target = work / name
        if len(parts) == 1:
            target.write_bytes(parts[0].read_bytes())
        else:
            subprocess.run(["pdfunite", *map(str, parts), str(target)], check=True)
        out["records"][key] = {"cite": label(cites), "file": name, "links": links, "joined": len(parts) > 1}
        print(f"{key}: {name} ({target.stat().st_size:,} bytes)")
    RAW.parent.mkdir(parents=True, exist_ok=True)
    RAW.write_text(json.dumps(out, indent=1) + "\n", encoding="utf-8")


def file(args) -> None:
    sys.path.insert(0, str(ROOT / "scripts/captures"))
    import mirror_captures  # noqa: E402

    raw = json.loads(RAW.read_text(encoding="utf-8"))
    work = Path(args.work)
    topic = f"united-states-code/{raw['edition']}"
    filed = {row["key"] for row in csv.DictReader(INDEX.open(encoding="utf-8"))}
    for key, entry in raw["records"].items():
        if f"{topic}/{entry['file']}" in filed:
            continue
        obtained = ("joined by script from the sections' PDFs on GovInfo (United States Code)" if entry["joined"]
                    else "downloaded from GovInfo (United States Code) by script")
        mirror_captures.add(argparse.Namespace(
            captures=args.captures, files=[str(work / entry["file"])], topic=topic, name=entry["file"], record=key,
            obtained=obtained, title=f"{entry['cite']}, {raw['edition']} edition", link=entry["links"],
            redistribution="yes", nations="", rights=RIGHTS, keep_local=False))


def records(args) -> None:
    raw = json.loads(RAW.read_text(encoding="utf-8"))
    topic = f"united-states-code/{raw['edition']}"
    stored = {row["key"]: row for row in csv.DictReader(INDEX.open(encoding="utf-8"))}
    changed = 0
    for key, entry in raw["records"].items():
        row = stored.get(f"{topic}/{entry['file']}")
        if not row:
            sys.exit(f"{key}: not filed yet; run file first")
        path = SOURCES / f"{key}.yaml"
        text = path.read_text(encoding="utf-8")
        if "\nfile:\n" in text:
            continue
        block = (f"file:\n  storage_key: {row['key']}\n  checksum: {row['sha256']}\n"
                 f"  media_type: {row['media_type']}\n  bytes: {row['bytes']}\n")
        if "\nrights:\n" not in text:
            sys.exit(f"{key}: no rights block to put the file before")
        text = text.replace("\nrights:\n", "\n" + block + "rights:\n", 1)
        joined = " joined from GovInfo's section PDFs" if entry["joined"] and entry["cite"].count("§§") else ""
        sentence = (f"The stored copy is {entry['cite']} from the {raw['edition']} edition of the Code on GovInfo"
                    f"{joined} (the text with its notes), saved by scripts/law/us_code_sections.py.")
        notes = (yaml.safe_load(text).get("notes") or "").rstrip()
        line = "notes: " + quote(f"{notes} {sentence}".strip()) + "\n"
        # The notes block runs from "notes:" to the next top-level key (or the end), however it was wrapped.
        if re.search(r"^notes:", text, flags=re.M):
            text = re.sub(r"^notes:.*\n(?:(?![A-Za-z_]+:)[^\n]*\n)*", lambda _: line, text, count=1, flags=re.M)
        else:
            text = text.rstrip("\n") + "\n" + line
        text = re.sub(r"\nfound_in:\n((?:( *)- .*\n)+)", lambda m: f"\nfound_in:\n{m.group(1)}{m.group(2)}- {SESSION}\n", text, count=1)
        path.write_text(text, encoding="utf-8")
        changed += 1
    print(f"{changed} records given their stored copy")


def quote(value: str) -> str:
    return yaml.safe_dump({"v": value}, allow_unicode=True, width=float("inf"))[3:].rstrip("\n")


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
