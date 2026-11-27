#!/usr/bin/env python3
"""Source records and stored copies for every decision of the Interior Board
of Indian Appeals (data tier 2; Trevor, Nov. 26, 2026: "Start with tier 2.
Work to completion").

The Board's chronological index (one page per calendar year since 1970,
https://www.doi.gov/oha/organization/ibia/Chronological-Index-of-Decisions)
lists 4,879 decisions, 1 IBIA through 72 IBIA, each with a PDF on
oha.doi.gov. scripts/analysis/federal_agency_counts.py read it into
research/data-roadmap/2026-11-26-tier-2-and-3/ibia-decisions.csv (PR #519).
Every decision is a work of the United States government, so the project
keeps its own copy in the bucket under ibia-decisions/<file>.pdf and serves
it.

Each PDF starts with the Board's cover sheet: the decision's name, its
citation and date ("3 IBIA 180 (12/05/74)"), and notes such as "Also
published at 81 Interior Decisions 680" or "Judicial review of this case:".
The decision follows with its docket number and "Decided December 5, 1974".
The records take the name from the cover sheet and the date from the
decision's own "Decided" line, and the check step compares both with the
index.

A decision about a child or a protected person gets the handling the Tribal
court opinions about children got (decision record 0057): its copy is
stored but never served (redistribution "no"), no record is written, and no
name of its parties is written anywhere in the repository:
research/ibia/held-back.csv lists them by citation and date only. That is a
decision whose name speaks of a minor or a guardianship, and a probate
appeal ("Estate of ...") whose text is about a child or a protected person:
a minor heir or child, a guardian, a conservator, custody, child support,
or at least three mentions of adoption, the Indian Child Welfare Act or the
like (the rule the state court estate cases follow, PR #538). Trevor chose
on Nov. 26, 2026 to show the other probate appeals like any other decision
(project thread "Collect state court Indian law opinions and Oklahoma
compacts"); they were held until then.

Steps:
  fetch    Download every PDF into --work/pdf and extract its first two
           pages' text into --work/head.
  check    Read each cover sheet and compare it with the index, and read the
           whole text of each probate appeal for the child rule. Writes
           research/reviews/ibia-decisions-check.csv (no names for held-back
           decisions) and --work/decisions.json.
  file     Store each PDF in the bucket and add it to the capture index
           (research/capture-index.csv). A file already in the index whose
           held status changed gets its row updated; nothing is uploaded again.
  records  Write content/sources/<letter>/<key>.yaml for each decision shown
           and research/ibia/held-back.csv for the rest.

Usage:
  python3 scripts/law/ibia_decisions.py fetch --work DIR
  python3 scripts/law/ibia_decisions.py check --work DIR
  python3 scripts/law/ibia_decisions.py file --work DIR
  python3 scripts/law/ibia_decisions.py records --work DIR
"""
from __future__ import annotations

import argparse
import concurrent.futures
import csv
import datetime as dt
import json
import mimetypes
import re
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
INDEX = ROOT / "research/data-roadmap/2026-11-26-tier-2-and-3/ibia-decisions.csv"
CAPTURE_INDEX = ROOT / "research/capture-index.csv"
CHECK = ROOT / "research/reviews/ibia-decisions-check.csv"
HELD_BACK = ROOT / "research/ibia/held-back.csv"
SOURCES = ROOT / "content/sources"
SESSION = "2026-11-26-ibia-decisions"
TOPIC = "ibia-decisions"
BOARD = "Interior Board of Indian Appeals"
SCRIPT = "scripts/law/ibia_decisions.py"
MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
CITE = re.compile(r"^(\d+) IBIA (\d+[A-Z]?)\s*\((\d{1,2})/\s*(\d{1,2})/\s*(\d{2,4})\)\s*$")
DECIDED = re.compile(r"Decided:?\s+(" + "|".join(MONTHS) + r")\.?\s+(\d{1,2})\s*,\s*(\d{4})")
CAPTION_DATE = re.compile(r"^[:\s]*(" + "|".join(MONTHS) + r")\.?\s+(\d{1,2})\s*,\s*(\d{4})\s*$")
DOCKET = re.compile(r"\b(?:IBIA|Docket No\.?)\s+((?:IBIA\s+)?\d{2}-\d{1,4}(?:-[A-Z])?)")
# A decision about a minor or a guardianship names a child: held back like the probate appeals.
CHILD = re.compile(r"\b(minors?|conservator|guardianship|guardian ad litem|guardian of|juvenile)\b", re.IGNORECASE)
# A probate appeal is held when its text is about a child or a protected person: any of these words ...
CHILD_TEXT = re.compile(r"\bminor (?:child|children|heirs?|daughter|son|grandchild|grandchildren|beneficiar|at the time|when)\b|\bminors\b|"
                        r"\bguardian(?:ship)?\b|\bguardian ad litem\b|\bconservator\b|\bjuvenile\b|\bcustody\b|\bchild support\b", re.IGNORECASE)
# ... or three mentions of these, the state court estate cases' rule (scripts/caselaw/state_court_opinions.py, PR #538).
CHILD_CASE_TEXT = re.compile(r"Indian Child Welfare Act|\bICWA\b|termination of (?:the )?parental rights|\badoption\b|child custody|"
                             r"protective order|order of protection|protection order|juvenile court|youth court", re.IGNORECASE)
RIGHTS = {"status": "no-permission-needed", "basis": "us-government-work",
          "basis_note": "A work of the United States government, not subject to copyright (17 U.S.C. § 105).",
          "redistribution": True}
HELD_RIGHTS = ("United States government work (17 U.S.C. § 105). Held back for a privacy review: "
               "a decision about a child or a protected person, which names private people (decision record 0057).")


def dump(value) -> str:
    return yaml.safe_dump(value, allow_unicode=True, sort_keys=False, width=float("inf"))


def slug(text: str) -> str:
    text = text.replace("’", "").replace("'", "").replace("&", " and ")
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", text.lower())).strip("-")


def index_rows() -> list[dict]:
    rows = list(csv.DictReader(INDEX.open(encoding="utf-8")))
    for row in rows:
        row["link"] = re.sub(r"^http://", "https://", row["link"])
        row["file"] = file_name(row["link"])
        # The index has a few typed slips ("56 IBIA\xa096", "7 1 IBIA 119", "72 IBA 023"); then the PDF's name gives the citation.
        cited = re.sub(r"\s+", " ", row["citation"]).strip()
        cited = re.sub(r" IBIA 0+(\d)", r" IBIA \1", cited)
        if not re.fullmatch(r"\d+ IBIA \d+[A-Z]?", cited):
            volume, page = re.fullmatch(r"(\d+)ibia(\d+[a-z]?)\.pdf", row["file"]).groups()
            cited = f"{int(volume)} IBIA {page.lstrip('0').upper()}"
        row["citation"] = cited
    # A few rows link another decision's PDF (12 IBIA 116 links 12ibia119.pdf); the Board names each file by its citation.
    files = [row["file"] for row in rows]
    for row in rows:
        volume, page = row["citation"].split(" IBIA ")
        own = f"{int(volume):02d}ibia{int(re.sub(r'[A-Z]$', '', page)):03d}{page[-1].lower() if page[-1].isalpha() else ''}.pdf"
        if files.count(row["file"]) > 1 and own != row["file"]:
            row["link"] = row["link"].rsplit("/", 1)[0] + "/" + own
            row["file"] = own
    return rows


def file_name(link: str) -> str:
    """The PDF's name in the bucket and the work folder: 52ibia364.pdf."""
    return link.rsplit("/", 1)[1].lower()


# fetch ----------------------------------------------------------------------

def download(link: str, target: Path) -> str | None:
    if target.exists() and target.stat().st_size > 0:
        return None
    for attempt in range(4):
        try:
            request = urllib.request.Request(link, headers={"User-Agent": "Mozilla/5.0 (research script)"})
            with urllib.request.urlopen(request, timeout=120) as response:
                data = response.read()
            if not data.startswith(b"%PDF"):
                return f"not a PDF: {link}"
            part = target.with_suffix(".part")
            part.write_bytes(data)
            part.rename(target)
            return None
        except Exception as problem:  # noqa: BLE001 - retried, then reported
            last = problem
            time.sleep(3 * (attempt + 1))
    return f"{link}: {last}"


def fetch(args) -> None:
    work = Path(args.work)
    (work / "pdf").mkdir(parents=True, exist_ok=True)
    (work / "head").mkdir(exist_ok=True)
    rows = index_rows()
    links = sorted({row["link"] for row in rows})
    with concurrent.futures.ThreadPoolExecutor(8) as pool:
        problems = [p for p in pool.map(lambda link: download(link, work / "pdf" / file_name(link)), links) if p]
    for problem in problems:
        print("FAILED", problem, file=sys.stderr)
    for link in links:
        pdf = work / "pdf" / file_name(link)
        head = work / "head" / (pdf.stem + ".txt")
        if pdf.exists() and not head.exists():
            subprocess.run(["pdftotext", "-l", "2", "-enc", "UTF-8", str(pdf), str(head)], capture_output=True)
    print(f"{len(links) - len(problems)} of {len(links)} PDFs downloaded")


# check ----------------------------------------------------------------------

def index_date(value: str) -> str:
    month, day, year = value.split("/")
    return f"{int(year):04d}-{int(month):02d}-{int(day):02d}"


def cover_sheet(text: str) -> dict:
    """The cover sheet's name, citation, date and notes, and the decision's docket and Decided date."""
    lines = [line.strip() for line in text.splitlines()]
    found: dict = {}
    start = next((i for i, line in enumerate(lines) if line.upper().startswith("INTERIOR BOARD OF INDIAN APPEALS")), None)
    if start is None:
        return found
    name: list[str] = []
    for i in range(start + 1, min(start + 12, len(lines))):
        match = CITE.match(lines[i])
        if match:
            volume, page, month, day, year = match.groups()
            year = int(year)
            if year < 100:
                year += 1900 if year >= 50 else 2000
            found.update(name=" ".join(name).strip(), volume=volume, page=page, cover_date=f"{year:04d}-{int(month):02d}-{int(day):02d}")
            notes: list[str] = []
            for line in lines[i + 1:i + 40]:
                if line.startswith("United States Department of the Interior") or line.startswith("UNITED STATES DEPARTMENT"):
                    break
                if line:
                    notes.append(line)
            found["notes"] = notes
            break
        if lines[i]:
            name.append(lines[i])
    body = "\n".join(lines)
    decided = DECIDED.search(body)
    if not decided:
        # An order prints its date alone in the caption's right column (": December 3, 1975").
        caption = next((i for i, line in enumerate(lines) if i > start + 2 and line.upper().startswith(("UNITED STATES DEPARTMENT", "OFFICE OF HEARINGS"))), None)
        if caption is not None:
            decided = next(filter(None, (CAPTION_DATE.match(line) for line in lines[caption:caption + 60])), None)
    if decided:
        found["decided"] = f"{int(decided.group(3)):04d}-{MONTHS.index(decided.group(1)) + 1:02d}-{int(decided.group(2)):02d}"
    docket = DOCKET.search(body)
    if docket:
        number = docket.group(1)
        found["docket"] = number if number.startswith("IBIA") else f"IBIA {number}"
    return found


def note_text(notes: list[str]) -> str:
    """The cover sheet's notes as sentences: "Judicial review of this case: Affirmed, ..."."""
    out, current = [], ""
    for line in notes:
        if line.endswith(":") and not current.endswith(":"):
            if current:
                out.append(current)
            current = line
        elif re.match(r"\d+ IBIA \d+", line) and re.search(r"IBIA \d+[A-Z]?(?: \([\d/]+\))?$", current):
            current = f"{current}; {line}"
        else:
            current = f"{current} {line}".strip()
    if current:
        out.append(current)
    return "; ".join(out)


def about_a_child(work: Path, name: str) -> bool:
    """Whether a probate appeal's whole text is about a child or a protected person (the PDF's text, cached in --work/text)."""
    text_file = work / "text" / (Path(name).stem + ".txt")
    if not text_file.exists():
        text_file.parent.mkdir(exist_ok=True)
        subprocess.run(["pdftotext", "-q", "-enc", "UTF-8", str(work / "pdf" / name), str(text_file)], check=False)
    text = re.sub(r"\s+", " ", text_file.read_text(encoding="utf-8", errors="replace")) if text_file.exists() else ""
    return bool(CHILD_TEXT.search(text)) or len(CHILD_CASE_TEXT.findall(text)) >= 3


def check(args) -> None:
    work = Path(args.work)
    decisions = []
    rows = index_rows()
    files = [row["file"] for row in rows]
    listed_cites = {row["citation"] for row in rows}
    for row in rows:
        head = work / "head" / (Path(row["file"]).stem + ".txt")
        sheet = cover_sheet(head.read_text(encoding="utf-8", errors="replace")) if head.exists() else {}
        volume, page = row["citation"].split(" IBIA ")
        listed = index_date(row["decided"])
        probate = row["probate"] == "True" or bool(re.search(r"\bEstate of\b", sheet.get("name", "")))
        child = bool(CHILD.search(row["name"] + " " + sheet.get("name", "")))
        probate_child = probate and not child and about_a_child(work, row["file"])
        same_sheet = sheet.get("volume") == volume and sheet.get("page") == page
        decided = sheet.get("decided")
        checks = []
        checks.append({"check": "cite", "result": "agree" if same_sheet else ("missing" if not sheet.get("volume") else "differs"),
                       "detail": f"Index {row['citation']}; cover sheet " + (f"{sheet['volume']} IBIA {sheet['page']}" if sheet.get("volume") else "not read")})
        dates = {"index": listed, "cover sheet": sheet.get("cover_date"), "decision": decided}
        known = {k: v for k, v in dates.items() if v}
        checks.append({"check": "decided", "result": "agree" if len(set(known.values())) == 1 and len(known) >= 2 else ("missing" if len(known) < 2 else "differs"),
                       "detail": "; ".join(f"{k} {v}" for k, v in dates.items() if v) + "".join(f"; {k} not found" for k, v in dates.items() if not v)})
        # The decision's own "Decided" line, unless the cover sheet and the index agree on another day (a slip in the
        # decision, such as "1998" in a 1988 volume); else the cover sheet, else the index.
        values = list(known.values())
        majority = next((value for value in values if values.count(value) >= 2), None)
        date = majority or decided or sheet.get("cover_date") or listed
        date_from = ("the decision's own date" if date == decided else
                     "the Board's cover sheet and index, which agree" if date == majority else
                     "the Board's cover sheet" if date == sheet.get("cover_date") else "the Board's index")
        # The citation the decision itself prints, when it was read and no other decision has it.
        # The citation the file is named for, when the cover sheet prints it and the index does not (12 IBIA 119, not 116).
        named = re.fullmatch(r"(\d+)ibia(\d+)([a-z]?)\.pdf", row["file"])
        named_cite = f"{int(named[1])} IBIA {int(named[2])}{named[3].upper()}" if named else ""
        if sheet.get("volume") and not same_sheet and f"{sheet['volume']} IBIA {sheet['page']}" == named_cite and named_cite not in listed_cites:
            volume, page = sheet["volume"], sheet["page"]
        decisions.append({
            "citation": f"{volume} IBIA {page}", "volume": volume, "page": page, "file": row["file"], "link": row["link"],
            "name": sheet.get("name") or row["name"], "index_name": row["name"], "date": date, "date_from": date_from,
            "name_from": "the decision's cover sheet" if sheet.get("name") else "the Board's index",
            "docket": sheet.get("docket"), "notes": note_text(sheet.get("notes", [])),
            "probate": probate, "held": "minor" if child else ("probate about a child" if probate_child else ""), "checks": checks,
        })
    # Index rows that share one PDF: consolidated appeals decided in one decision, or a row linked to another decision's
    # file. Each file becomes one decision, under the citation and name its cover sheet prints; a row the file does not
    # print is set aside in the check file.
    by_file: dict[str, list[dict]] = {}
    for item in decisions:
        by_file.setdefault(item["file"], []).append(item)
    kept = []
    for file_items in by_file.values():
        if len(file_items) == 1:
            kept.extend(file_items)
            continue
        printed = [item for item in file_items if item["checks"][0]["result"] == "agree"] or file_items[:1]
        first = printed[0]
        first["held"] = next((item["held"] for item in file_items if item["held"]), first["held"])
        kept.append(first)
        for item in file_items:
            if item is not first:
                item["skipped"] = f"shares {first['citation']}'s PDF"
                print("set aside:", item["citation"], item["skipped"], file=sys.stderr)
    skipped = [item for item in decisions if item.get("skipped")]
    decisions = kept
    (work / "decisions.json").write_text(json.dumps(decisions, indent=1, ensure_ascii=False), encoding="utf-8")
    CHECK.parent.mkdir(parents=True, exist_ok=True)
    with CHECK.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["citation", "name", "held_back", "cite", "decided", "date_used", "detail"])
        for item in skipped:
            writer.writerow([item["citation"], "", item["held"], "set aside", "", "", item["skipped"]])
        for item in decisions:
            # A held-back decision's name stays out of the repository.
            writer.writerow([item["citation"], "" if item["held"] else item["name"], item["held"],
                             item["checks"][0]["result"], item["checks"][1]["result"], item["date"],
                             "" if item["held"] else " | ".join(c["detail"] for c in item["checks"] if c["result"] != "agree")])
    tally: dict = {}
    for item in decisions:
        for c in item["checks"]:
            tally[(c["check"], c["result"])] = tally.get((c["check"], c["result"]), 0) + 1
    print(json.dumps({f"{a} {b}": n for (a, b), n in sorted(tally.items())}, indent=1))
    print("held back:", sum(1 for d in decisions if d["held"]), "of", len(decisions))


# file -----------------------------------------------------------------------

def file(args) -> None:
    sys.path.insert(0, str(ROOT / "scripts/captures"))
    import mirror_captures  # noqa: E402

    work = Path(args.work)
    decisions = json.loads((work / "decisions.json").read_text(encoding="utf-8"))
    rows = mirror_captures.load_index()
    filed = {row["key"] for row in rows}
    s3 = mirror_captures.client()
    bucket = mirror_captures.bucket_name()
    by_file: dict[str, list[dict]] = {}
    for item in decisions:
        by_file.setdefault(item["file"], []).append(item)

    def described(name: str) -> dict:
        items = by_file[name]
        held = any(item["held"] for item in items)
        title = ("; ".join(f"Interior Board of Indian Appeals decision, {i['citation']}" for i in items) if held
                 else "; ".join(f"{i['name']}, {i['citation']} ({i['date'][:4]})" for i in items))
        record = "" if held else ";".join(record_key(i) for i in items)
        return {"title": title, "records": record, "record_kinds": "source" if record else "", "orphan": "no" if record else "yes",
                "redistribution": "no" if held else "yes",
                "rights": HELD_RIGHTS if held else "United States government work (17 U.S.C. § 105)."}

    def put(name: str):
        key = f"{TOPIC}/{name}"
        path = work / "pdf" / name
        if key in filed:
            return ("update", key, described(name))
        if not path.exists():
            return None
        digest = mirror_captures.sha256_of(path)
        if mirror_captures.remote_state(s3, bucket, key) != (path.stat().st_size, digest):
            s3.upload_file(str(path), bucket, key, ExtraArgs={"ContentType": "application/pdf", "Metadata": {
                "sha256": digest, "captured": dt.date.today().isoformat()}})
            if mirror_captures.remote_state(s3, bucket, key) != (path.stat().st_size, digest):
                return ("failed", key)
        fields = described(name)
        row = mirror_captures.index_row(
            key=key, size=path.stat().st_size, digest=digest, media="application/pdf", topic=TOPIC, title=fields["title"], nations="",
            obtained="downloaded from the Office of Hearings and Appeals (oha.doi.gov) by script", links=[by_file[name][0]["link"]],
            record=fields["records"], redistribution=fields["redistribution"], rights=fields["rights"], existing_keys=filed)
        return ("ok", row)

    by_key = {row["key"]: row for row in rows}
    added = failed = updated = 0
    with concurrent.futures.ThreadPoolExecutor(8) as pool:
        for result in pool.map(put, sorted(by_file)):
            if not result:
                continue
            if result[0] == "update":
                row = by_key[result[1]]
                if any(row[field] != value for field, value in result[2].items()):
                    row.update(result[2])
                    updated += 1
            elif result[0] == "failed":
                failed += 1
                print("verification failed", result[1], file=sys.stderr)
            else:
                rows.append(result[1])
                added += 1
    mirror_captures.write_index(rows)
    print(f"filed {added}, updated {updated}, failed {failed}")


# records --------------------------------------------------------------------

_keys: dict[str, str] = {}


def record_key(item: dict) -> str:
    """The decision's name, cut at a word near 70 characters, and its citation: smith-v-acting-...-52-ibia-364."""
    if item["citation"] in _keys:
        return _keys[item["citation"]]
    # The appellee is nearly always an official "..., Bureau of Indian Affairs": the key leaves that out.
    name = slug(re.sub(r",? Bureau of Indian Affairs\b.*$", "", item["name"]))
    if len(name) > 64:
        name = name[:64].rsplit("-", 1)[0]
    key = f"{name}-{item['volume']}-ibia-{item['page'].lower()}"
    _keys[item["citation"]] = key
    return key


def long_date(iso: str) -> str:
    year, month, day = iso.split("-")
    return f"{MONTHS[int(month) - 1]} {int(day)}, {year}"


GOVERNMENT_BEFORE = re.compile(r"\b(Council|Committee|Court|Board|Authority|Enterprises?|Corporation|Commission|Department|Chairman|Chairperson|Chairwoman|President|Governor|Office|Members|Housing)\s+of\s+(?:the\s+)?$", re.IGNORECASE)
GOVERNMENT_AFTER = re.compile(r"^\s*(?:Tribal|Business|General|Executive)?\s*(Council|Committee|Business Committee|Housing Authority|Court|Gaming|Enterprises?|Election Board|Corporation|Utility|Utilities|Department)\b", re.IGNORECASE)


def role_of(title: str, words: str) -> str:
    """party when the nation itself is named as a party; government when its council, court, agency or business arm is."""
    at = title.find(words)
    if at < 0:
        return "party"
    if GOVERNMENT_BEFORE.search(title[max(0, at - 60):at]) or GOVERNMENT_AFTER.match(title[at + len(words):]):
        return "government"
    return "party"


def record_for(item: dict, copy: dict | None, named: list[tuple[str, str]]) -> dict:
    year, month, day = (int(part) for part in item["date"].split("-"))
    citation = {"type": "legal_case", "title": item["name"], "container-title": "IBIA", "volume": item["volume"], "page": item["page"],
                "authority": BOARD}
    if item.get("docket"):
        citation["number"] = item["docket"]
    citation.update({"issued": {"date-parts": [[year, month, day]]}, "URL": item["link"],
                     "accessed": {"date-parts": [[2026, 11, 26]]}})
    notes = (f"Indigo Book citation: {item['name']}, {item['volume']} IBIA {item['page']} ({year}). "
             f"Decision of the {BOARD}, listed in the Board's chronological index. Name from {item['name_from']}; "
             f"date ({long_date(item['date'])}) from {item['date_from']}.")
    if item.get("notes"):
        notes += f" Cover sheet notes: {item['notes'].rstrip('.')}."
    notes += f" Generated by {SCRIPT}, with the nations matched by name in the decision's name; not yet read by a person (Unverified)."
    record = {"key": record_key(item), "kind": "federal-case", "citation": citation, "original_link": item["link"], "retrieved": "2026-11-26"}
    if copy:
        record["file"] = copy
    record.update({
        "rights": RIGHTS,
        "jurisdictions": [{"level": "federal"}],
        **({"tribes": [nation for nation, _ in named]} if named else {}),
        "nations_in_case": {"checked": "2026-11-26", "named": [{"nation": nation, "named_as": words, "role": role_of(item["name"], words)} for nation, words in named]},
        "access": {"open": True, "pull_from": ["free-web"]},
        "found_in": [SESSION],
        "notes": notes,
        "review": {"status": "unverified", "by": SCRIPT, "date": "2026-11-26", "checks": item["checks"]},
    })
    return record


def records(args) -> None:
    work = Path(args.work)
    decisions = json.loads((work / "decisions.json").read_text(encoding="utf-8"))
    copies = {}
    for row in csv.DictReader(CAPTURE_INDEX.open(encoding="utf-8")):
        if row["key"].startswith(f"{TOPIC}/"):
            copies[row["key"].split("/", 1)[1]] = {"storage_key": row["key"], "checksum": row["sha256"], "media_type": row["media_type"], "bytes": int(row["bytes"])}
    existing = {path.stem for path in SOURCES.rglob("*.yaml")}
    sys.path.insert(0, str(ROOT / "scripts/law"))
    from nation_names import NationNames  # noqa: E402
    names = NationNames()
    written = 0
    held = []
    for item in decisions:
        if item["held"]:
            held.append(item)
            continue
        key = record_key(item)
        path = SOURCES / (key[0] if key[0].isalpha() else "_other") / f"{key}.yaml"
        if key in existing and not path.read_text(encoding="utf-8").count(SESSION):
            print("key taken by another record, skipped:", key, file=sys.stderr)
            continue
        path.parent.mkdir(exist_ok=True)
        # The nations the decision's name gives as parties (a name match; Unverified like the rest of the record).
        path.write_text(dump(record_for(item, copies.get(item["file"]), names.named(item["name"]))), encoding="utf-8")
        written += 1
    HELD_BACK.parent.mkdir(parents=True, exist_ok=True)
    with HELD_BACK.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["citation", "decided", "reason"])
        for item in sorted(held, key=lambda i: (int(i["volume"]), i["page"])):
            writer.writerow([item["citation"], item["date"], item["held"]])
    print(f"wrote {written} records; {len(held)} held back")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    for name in ("fetch", "check", "file", "records"):
        sub.add_parser(name).add_argument("--work", required=True)
    args = parser.parse_args()
    {"fetch": fetch, "check": check, "file": file, "records": records}[args.command](args)


if __name__ == "__main__":
    main()
