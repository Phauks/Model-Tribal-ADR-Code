#!/usr/bin/env python3
"""Source records and stored copies for Congress's own documents on Indian
affairs (data tier 2; Trevor, Nov. 27, 2026: "work on those tier 2 gaps"):
committee hearings, committee reports, committee prints, and the legislative
history (the committee and conference reports) of each federal statute the
project holds since 1973.

Where they come from. GovInfo (https://api.govinfo.gov, which needs the free
api.data.gov key in DATA_GOV_API_KEY) holds:

- Congressional Hearings (CHRG), born digital since about 1995 and scanned
  before, and older hearings scanned with the Boston Public Library (GOVPUB).
- Congressional Reports (CRPT) since 1995 and the Congressional Serial Set
  (SERIALSET), the bound House and Senate reports back to the 15th Congress,
  which GovInfo is still scanning (not every volume is up yet).
- Congressional Committee Prints (CPRT).

A document is kept when a committee named for Indian, Native American or
Native Hawaiian affairs wrote it, when its title or subtitle names Indians,
tribes, Native Americans, Alaska Natives or Native Hawaiians, or a nation the
project has a page for (scripts/law/nation_names.py), or when GovInfo's own
subject headings for it are about Indians. Titles such as "Indian River
grapefruit" or "Indian Ocean" are not counted. What is left over is written
to the review file for a reading, never kept by guess.

Legislative histories come from Congress.gov (https://api.congress.gov, same
key): for each federal statute record with a public law number from the 93rd
Congress (1973) on, the bill that became the law and the reports its actions
name ("With written report No. 100-157"). Each report is then found on GovInfo
(CRPT since the 104th Congress, the Serial Set before) and gets a record that
names the law (legislative.laws), so the law's page can list it.

Every document is a work of the United States government (17 U.S.C. § 105), so
the project keeps GovInfo's PDF in the bucket under congress/<package>.pdf and
serves it.

Steps:
  search     Ask GovInfo's search for every candidate hearing, report and
             print. Writes --work/search.json.
  summaries  Read each candidate's GovInfo summary (and its MODS record when
             the summary names no committee). Cached in --work/summaries/.
  histories  Read Congress.gov for each statute's bill and reports, and find
             each report on GovInfo. Writes --work/histories.json.
  classify   Decide which candidates to keep. Writes --work/documents.json and
             research/reviews/2026-11-27-congressional-documents.csv.
  sizes      Ask GovInfo for the size of each kept document's PDF (a HEAD
             request). Writes --work/sizes.json.
  file       Download each kept document's PDF of 64 MB or less, store it in
             the bucket, add it to the capture index and delete the local file
             (so the Serial Set's large scans never fill the disk). A larger
             scan is linked at GovInfo, as the largest Acts are.
  records    Write content/sources/<letter>/<key>.yaml for each kept document.

Usage:
  python3 scripts/law/congressional_documents.py search --work DIR
  python3 scripts/law/congressional_documents.py summaries --work DIR
  python3 scripts/law/congressional_documents.py histories --work DIR
  python3 scripts/law/congressional_documents.py classify --work DIR
  python3 scripts/law/congressional_documents.py sizes --work DIR
  python3 scripts/law/congressional_documents.py file --work DIR
  python3 scripts/law/congressional_documents.py records --work DIR
"""
from __future__ import annotations

import argparse
import concurrent.futures
import csv
import datetime as dt
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
SOURCES = ROOT / "content/sources"
REVIEW = ROOT / "research/reviews/2026-11-27-congressional-documents.csv"
SESSION = "2026-11-27-congressional-documents"
SCRIPT = "scripts/law/congressional_documents.py"
GOVINFO = "https://api.govinfo.gov"
CONGRESS = "https://api.congress.gov/v3"
UA = {"User-Agent": "Mozilla/5.0 (research script)"}
TODAY = "2026-11-27"
MONTHS = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."]
RIGHTS = {"status": "no-permission-needed", "basis": "us-government-work",
          "basis_note": "A work of the United States government, not subject to copyright (17 U.S.C. § 105).",
          "redistribution": True}

# The words a title must hold to be about Native people (a nation's own name is found by nation_names.py).
NATIVE_TITLE = re.compile(r"\b(Indians?|tribal|tribes?|tribally|intertribal|Native Americans?|American Natives?|Alaska Natives?|Native Alaskans?|Native Hawaiians?|Hawaiian Home ?lands?|Rancherias?|Pueblos of|Pueblo of|Navajos?|Hopis?|Sioux|Choctaws?|Chickasaws?|Cherokees?|Seminoles?|Creek Nation|Creek Indians|Muscogee|Osages?|Kiowas?|Comanches?|Apaches?|Cheyennes?|Arapahoe?s?|Shoshones?|Paiutes?|Utes?|Chippewas?|Ojibwe?|Menominee|Oneidas?|Senecas?|Mohawks?|Pottawatomie|Potawatomi|Winnebagos?|Klamath|Yakima|Yakama|Nez Perces?|Blackfeet|Crows?\b(?= (?:Indians|Tribe|Reservation|Nation))|Flathead|Colville|Quinault|Lummi|Tlingit|Haida|Eskimos?|Aleuts?|Inupiat|Yup'ik)\b", re.I)
# Phrases that hold one of those words but are not about Native people.
NOT_NATIVE = re.compile(r"\b(Indian (Ocean|River|Head|Creek|Lakes?|Wells|Springs|Hill|Trail|Peaks?|Rocks?|Harbor|Point|Valley|Key|Island|Ridge|Mounds?)|West Indian?s?|East Indian?s?|Indian[- ]American|Indiana|USS Pueblo|U\.S\.S\. Pueblo|Pueblo, Colo|Apache helicopters?|Seminole County|Cherokee County|Osage County|Comanche County|Kiowa County|Crow Wing|Seneca Falls|Oneida County|Utes? (?=Pass)|Chippewa (?:National Forest|Falls|County|River)|U\.\s?S\.-India[n]?|India[n]?-U\.\s?S\.|India[n]? (?:Nuclear|Navy|Army|Prime Minister|Government of India|Elections?|Economy|Subcontinent|Earthquake|Tsunami)|[A-Z][a-z]+(?:,? (?:and )?[A-Z][a-z]+)* Count(?:y|ies))\b", re.I)
# A committee named for Indian, Native American or Native Hawaiian affairs.
NATIVE_COMMITTEE = re.compile(r"Indian|Native American|Native Hawaiian|Alaska Native", re.I)
# GovInfo subject headings (Library of Congress) about Native people.
NATIVE_SUBJECT = re.compile(r"\b(Indians|Indian (reservations|lands?|land transfers|courts|tribes|children|claims|gaming|title)|Indians of North America|Federally recognized Indian tribes|Alaska Natives|Eskimos|Aleuts|Hawaiians|Tribal)\b", re.I)


GENERIC_MATCH = {"tribe", "tribes", "nation", "nations", "band", "bands", "indians", "community", "the tribes", "the tribe", "the nation"}


def nations_in(names, text: str) -> list[str]:
    """The nations a title names, less a match on a generic word alone ("Indian Tribes" is not the Confederated Salish and
    Kootenai Tribes, whose profile carries the alias "the Tribes"; PR #551 guards nation_names.py itself)."""
    return [nation for nation, words in names.named(text) if words.strip().lower() not in GENERIC_MATCH]


def key_param() -> str:
    key = os.environ.get("DATA_GOV_API_KEY")
    if not key:
        sys.exit("Set DATA_GOV_API_KEY (the free api.data.gov key) first.")
    return key


def get(url: str, data: bytes | None = None, headers: dict | None = None, attempts: int = 6) -> bytes:
    for attempt in range(attempts):
        try:
            request = urllib.request.Request(url, data=data, headers={**UA, **(headers or {})})
            with urllib.request.urlopen(request, timeout=300) as response:
                return response.read()
        except urllib.error.HTTPError as problem:
            if problem.code in (404, 400):
                raise
            if attempt == attempts - 1:
                raise
            time.sleep(10 * (attempt + 1) if problem.code == 429 else 4 * (attempt + 1))
        except Exception:  # noqa: BLE001 - retried, then raised
            if attempt == attempts - 1:
                raise
            time.sleep(4 * (attempt + 1))
    raise RuntimeError("unreachable")


def govinfo(path: str) -> dict:
    joiner = "&" if "?" in path else "?"
    return json.loads(get(f"{GOVINFO}{path}{joiner}api_key={key_param()}"))


def congress_api(path: str) -> dict:
    joiner = "&" if "?" in path else "?"
    return json.loads(get(f"{CONGRESS}{path}{joiner}format=json&api_key={key_param()}"))


def search_all(query: str) -> list[dict]:
    found, mark = [], "*"
    while mark:
        body = json.dumps({"query": query, "pageSize": 1000, "offsetMark": mark, "sorts": [{"field": "dateIssued", "sortOrder": "ASC"}]}).encode()
        page = json.loads(get(f"{GOVINFO}/search?api_key={key_param()}", data=body, headers={"Content-Type": "application/json"}))
        results = page.get("results", [])
        found += results
        mark = page.get("offsetMark") if results else None
    return found


TITLE_TERMS = ('title:(Indian OR Indians OR tribal OR tribe OR tribes OR "Native American" OR "Native Americans" OR "Alaska Native" OR "Alaska Natives" '
               'OR "Native Hawaiian" OR "Native Hawaiians" OR Navajo OR Cherokee OR Sioux OR Pueblo OR Apache OR Hopi OR Choctaw OR Seminole OR Chickasaw '
               'OR Creek OR Ute OR Shoshone OR Rancheria OR reservation OR Eskimo OR Eskimos OR Osage OR Chippewa)')


def search(args) -> None:
    work = Path(args.work)
    work.mkdir(parents=True, exist_ok=True)
    candidates: dict[str, dict] = {}
    for collection in ("CHRG", "CRPT", "CPRT"):
        query = f'collection:{collection} AND (committee:(Indian) OR committee:("Native American") OR committee:("Native Hawaiian") OR {TITLE_TERMS})'
        results = search_all(query)
        for result in results:
            entry = candidates.setdefault(result["packageId"], result)
            entry.setdefault("asked", [])
            if collection not in entry["asked"]:
                entry["asked"].append(collection)
        print(f"{collection}: {len(results)}")
    (work / "search.json").write_text(json.dumps(list(candidates.values()), indent=0, ensure_ascii=False), encoding="utf-8")
    print(f"{len(candidates)} candidates")


def mods_committees(package: str) -> list[str]:
    """The committees a package's MODS record names (GovInfo's summary of a report often names none)."""
    try:
        text = get(f"{GOVINFO}/packages/{package}/mods?api_key={key_param()}").decode("utf-8", "replace")
    except Exception:  # noqa: BLE001 - a package without MODS names no committee
        return []
    names = re.findall(r"<congCommittee[^>]*>.*?<name type=\"authority-standard\">([^<]+)</name>", text, re.S)
    if not names:
        names = re.findall(r"<congCommittee[^>]*>.*?<name[^>]*>([^<]+)</name>", text, re.S)
    bills = re.findall(r'<bill [^>]*congress="(\d+)"[^>]*number="(\d+)"[^>]*type="([A-Za-z]+)"', text)
    bills += [(c, n, t) for t, n, c in re.findall(r'<bill [^>]*type="([A-Za-z]+)"[^>]*number="(\d+)"[^>]*congress="(\d+)"', text)]
    return sorted(set(n.strip() for n in names)) + [f"bill:{t.lower()}:{n}:{c}" for c, n, t in sorted(set(bills))]


def summary_of(work: Path, package: str) -> dict | None:
    path = work / "summaries" / f"{package}.json"
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    try:
        summary = govinfo(f"/packages/{package}/summary")
    except urllib.error.HTTPError as problem:
        if problem.code == 404:
            return None
        raise
    extra = mods_committees(package)
    summary["mods_committees"] = [name for name in extra if not name.startswith("bill:")]
    summary["mods_bills"] = [name[5:] for name in extra if name.startswith("bill:")]
    path.write_text(json.dumps(summary, ensure_ascii=False), encoding="utf-8")
    return summary


def summaries(args) -> None:
    work = Path(args.work)
    (work / "summaries").mkdir(parents=True, exist_ok=True)
    packages = [entry["packageId"] for entry in json.loads((work / "search.json").read_text(encoding="utf-8"))]
    with concurrent.futures.ThreadPoolExecutor(6) as pool:
        missing = sum(1 for summary in pool.map(lambda package: summary_of(work, package), packages) if summary is None)
    print(f"{len(packages)} summaries; {missing} missing")


# ---- Legislative histories ----------------------------------------------------------------

def statute_records() -> dict[str, str]:
    """Federal statute records with a public law number from the 93rd Congress on, by law number ("100-139")."""
    found = {}
    for path in sorted(SOURCES.glob("*/*.yaml")):
        text = path.read_text(encoding="utf-8")
        if "kind: federal-statute" not in text:
            continue
        match = re.search(r"Pub\. ?L\. (?:No\. )?(\d+)[-–](\d+)", text)
        if not match or int(match.group(1)) < 93:
            continue
        key = re.search(r"^key: (.+)$", text, re.M).group(1).strip()
        law = f"{int(match.group(1))}-{int(match.group(2))}"
        # The Act's own record (public-law-100-139) wins over a record that only cites it.
        if law not in found or key == f"public-law-{law}":
            found[law] = key
    return found


REPORT_IN_ACTION = re.compile(r"(?:(?:With written|Written) report|Report)\s+No\.?:?\s*(\d+)-(\d+)", re.I)
CONFERENCE_IN_ACTION = re.compile(r"[Cc]onference report\s+(?:H\.\s*Rept\.|S\.\s*Rept\.)?\s*(\d+)-(\d+)")
RPT_CITATION = re.compile(r"\b(H|S)\.\s*Rept\.\s*(\d+)-(\d+)")


def reports_of_bill(bill_path: str) -> list[tuple[str, int, int]]:
    """The reports a bill's actions name, as (chamber letter, congress, number)."""
    found: set[tuple[str, int, int]] = set()
    try:
        committee_reports = congress_api(f"{bill_path}/committee-reports?limit=250").get("reports", [])
    except Exception:  # noqa: BLE001 - older bills have no list
        committee_reports = []
    for report in committee_reports:
        match = RPT_CITATION.search(report.get("citation", ""))
        if match:
            found.add((match.group(1).lower(), int(match.group(2)), int(match.group(3))))
    offset = 0
    while True:
        page = congress_api(f"{bill_path}/actions?limit=250&offset={offset}")
        actions = page.get("actions", [])
        for action in actions:
            text = action.get("text", "")
            chamber = (action.get("sourceSystem", {}) or {}).get("name", "")
            for match in RPT_CITATION.finditer(text):
                found.add((match.group(1).lower(), int(match.group(2)), int(match.group(3))))
            for match in REPORT_IN_ACTION.finditer(text):
                # "Reported to Senate ... With written report No. 100-157" is the Senate's; "Reported to House ... Report No: 100-66" the House's.
                letter = "s" if re.search(r"\bSenate\b", text) and not re.search(r"\bto House\b|House Committee", text) else "h"
                if "Senate" in chamber:
                    letter = "s"
                elif "House" in chamber:
                    letter = "h"
                found.add((letter, int(match.group(1)), int(match.group(2))))
            for match in CONFERENCE_IN_ACTION.finditer(text):
                found.add(("h", int(match.group(1)), int(match.group(2))))
        if len(actions) < 250:
            break
        offset += 250
    return sorted(found)


def report_package(letter: str, congress: int, number: int) -> str | None:
    """The report's package on GovInfo: CRPT from the 104th Congress, else its Serial Set volume, else None."""
    if congress >= 104:
        package = f"CRPT-{congress}{letter}rpt{number}"
        try:
            govinfo(f"/packages/{package}/summary")
            return package
        except urllib.error.HTTPError as problem:
            if problem.code != 404:
                raise
    doc_class = "HRPT" if letter == "h" else "SRPT"
    label = f"{'H' if letter == 'h' else 'S'}. Rpt. {congress}-{number}"
    # A Serial Set report's package ends in its number: SERIALSET-13736_00_00-009-0157-0000 is S. Rpt. 100-157.
    for result in search_all(f'collection:SERIALSET AND congress:{congress} AND docClass:{doc_class} AND "{label}"'):
        package = result["packageId"]
        if re.search(rf"-\d{{3}}-0*{number}-\d{{4}}$", package):
            return package
    return None


def histories(args) -> None:
    work = Path(args.work)
    statutes = statute_records()
    out = json.loads((work / "histories.json").read_text(encoding="utf-8")) if (work / "histories.json").exists() else {}

    def one(item):
        law, key = item
        if law in out and "error" not in out[law]:
            return law, out[law]
        congress, number = law.split("-")
        try:
            bill = congress_api(f"/law/{congress}/pub/{number}").get("bill") or {}
        except urllib.error.HTTPError as problem:
            return law, {"record": key, "error": f"law not on Congress.gov ({problem.code})"}
        if not bill:
            return law, {"record": key, "error": "no bill"}
        bill_path = f"/bill/{bill['congress']}/{bill['type'].lower()}/{bill['number']}"
        reports = reports_of_bill(bill_path)
        found = []
        for letter, report_congress, report_number in reports:
            found.append({"chamber": letter, "congress": report_congress, "number": report_number, "package": report_package(letter, report_congress, report_number)})
        return law, {"record": key, "bill": f"{bill['type']} {bill['number']}", "bill_congress": bill["congress"], "bill_link": bill.get("legislationUrl", ""),
                     "policy_area": (bill.get("policyArea") or {}).get("name", ""), "reports": found}

    with concurrent.futures.ThreadPoolExecutor(4) as pool:
        for law, result in pool.map(one, sorted(statutes.items())):
            out[law] = result
    (work / "histories.json").write_text(json.dumps(out, indent=1, ensure_ascii=False), encoding="utf-8")
    reports = [report for entry in out.values() for report in entry.get("reports", [])]
    print(f"{len(out)} laws; {sum(1 for e in out.values() if e.get('reports'))} with reports; {len(reports)} reports, {sum(1 for r in reports if r['package'])} on GovInfo")


# ---- Classify --------------------------------------------------------------------------------

def committees_of(summary: dict) -> list[str]:
    names = [committee.get("committeeName", "") for committee in summary.get("committees") or []]
    names += summary.get("mods_committees") or []
    out = []
    for name in names:
        name = re.sub(r"\s+", " ", name).strip()
        if name and name.lower() != "missing" and name not in out:
            out.append(name)
    return out


_reservations: re.Pattern | None = None


def reservation_names() -> re.Pattern:
    """The Census Bureau's names of American Indian reservations ("Fort Hall Reservation and Off-Reservation Trust Land, ID" is
    "Fort Hall"), as a pattern that finds one followed by "Reservation" in a title, such as "Blackfoot Reservoir, Fort Hall
    Reservation, Idaho". A military, lighthouse or customhouse reservation is never one of them."""
    global _reservations
    if _reservations is None:
        cores = set()
        areas = ROOT / "research/census/acs-2020-2024-native-areas.csv"
        for row in csv.DictReader(areas.open(encoding="utf-8")):
            match = re.match(r"(.+?) (?:Indian )?(?:Reservation|Rancheria|Colony|Pueblo|Indian Community|Community)\b", row["name"])
            core = match.group(1).strip() if match else ""
            if len(core) >= 4 and core.lower() not in ("fort", "lake", "pine", "river", "rocky", "big", "red"):
                cores.add(core)
        _reservations = re.compile(r"\b(" + "|".join(sorted((re.escape(core) for core in cores), key=len, reverse=True)) + r")(?:'s)?(?: Indian)? Reservations?\b")
    return _reservations


def why_kept(summary: dict, names) -> str | None:
    title = f"{summary.get('title', '')}. {summary.get('subtitle', '')}"
    if any(NATIVE_COMMITTEE.search(name) for name in committees_of(summary)):
        return "committee"
    cleaned = NOT_NATIVE.sub(" ", title)
    if NATIVE_TITLE.search(cleaned):
        return "title"
    if nations_in(names, cleaned) or reservation_names().search(cleaned):
        return "nation named"
    topics = (summary.get("subjects") or {}).get("topics") or []
    if any(NATIVE_SUBJECT.search(topic) for topic in topics):
        return "subject"
    return None


def classify(args) -> None:
    sys.path.insert(0, str(ROOT / "scripts/law"))
    from nation_names import NationNames  # noqa: E402

    work = Path(args.work)
    names = NationNames()
    candidates = json.loads((work / "search.json").read_text(encoding="utf-8"))
    histories_found = json.loads((work / "histories.json").read_text(encoding="utf-8")) if (work / "histories.json").exists() else {}
    laws_of: dict[str, list[str]] = {}
    for law, entry in histories_found.items():
        for report in entry.get("reports", []):
            if report.get("package"):
                laws_of.setdefault(report["package"], [])
                if entry["record"] not in laws_of[report["package"]]:
                    laws_of[report["package"]].append(entry["record"])
    packages = {entry["packageId"]: entry for entry in candidates}
    for package in laws_of:
        packages.setdefault(package, {"packageId": package, "asked": ["history"]})
    kept, rows = [], []
    for package, entry in sorted(packages.items()):
        summary = summary_of(work, package)
        if summary is None:
            rows.append({"package": package, "decision": "missing", "reason": "no GovInfo summary", "title": entry.get("title", "")})
            continue
        reason = "legislative history" if package in laws_of else why_kept(summary, names)
        rows.append({"package": package, "decision": "kept" if reason else "left out", "reason": reason or "no Native term, committee, nation or subject",
                     "date": summary.get("dateIssued", ""), "title": summary.get("title", "")[:300]})
        if reason:
            summary["kept_because"] = reason
            summary["laws"] = laws_of.get(package, [])
            kept.append(summary)
    # The same hearing can be both a born-digital CHRG package and a scanned GOVPUB one; keep the born-digital one.
    by_number: dict[tuple, dict] = {}
    for summary in kept:
        number = document_identity(summary)
        if number is None:
            continue
        held = by_number.get(number)
        if held is None or (held["packageId"].startswith(("GOVPUB", "SERIALSET")) and not summary["packageId"].startswith(("GOVPUB", "SERIALSET"))):
            by_number[number] = summary
    winners = {id(summary) for summary in by_number.values()}
    deduplicated = []
    for summary in kept:
        if document_identity(summary) is None or id(summary) in winners:
            deduplicated.append(summary)
        else:
            other = by_number[document_identity(summary)]
            other["laws"] = sorted(set(other.get("laws", [])) | set(summary.get("laws", [])))
            for row in rows:
                if row["package"] == summary["packageId"]:
                    row.update(decision="duplicate", reason=f"same document as {other['packageId']}")
    (work / "documents.json").write_text(json.dumps(deduplicated, indent=0, ensure_ascii=False), encoding="utf-8")
    REVIEW.parent.mkdir(parents=True, exist_ok=True)
    with REVIEW.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["package", "decision", "reason", "date", "title"])
        writer.writeheader()
        writer.writerows(rows)
    counts: dict[str, int] = {}
    for summary in deduplicated:
        counts[genre_of(summary)] = counts.get(genre_of(summary), 0) + 1
    print(f"kept {len(deduplicated)} of {len(packages)}: {counts}; left out {sum(1 for r in rows if r['decision'] == 'left out')}")


def document_identity(summary: dict) -> tuple | None:
    """What makes two packages the same document: a report's chamber, Congress and number; a hearing's S. Hrg. or serial number."""
    genre = genre_of(summary)
    congress = summary.get("congress")
    if genre in ("House report", "Senate report") and congress and summary.get("documentNumber"):
        return (genre, int(congress), summary["documentNumber"].lstrip("0"))
    number = senate_hearing_number(summary)
    if number:
        return ("Senate hearing", number)
    return None


def senate_hearing_number(summary: dict) -> str | None:
    text = f"{summary.get('suDocClassNumber', '')} {summary.get('seriesTitle', '')}"
    match = re.search(r"S\.\s*HRG\.\s*(\d+)-(\d+)", text, re.I)
    return f"{int(match.group(1))}-{int(match.group(2))}" if match else None


# ---- Records ---------------------------------------------------------------------------------

def genre_of(summary: dict) -> str:
    doc_class = (summary.get("docClass") or summary.get("documentType") or "").upper()
    collection = summary.get("collectionCode", "")
    if collection == "CPRT" or doc_class in ("HPRT", "SPRT", "JPRT"):
        return "Committee print"
    if doc_class == "HRPT" or doc_class.startswith("HRPT"):
        return "House report"
    if doc_class == "SRPT" or doc_class.startswith("SRPT"):
        return "Senate report"
    if collection in ("CHRG", "GOVPUB") or doc_class in ("HHRG", "SHRG", "JHRG"):
        return "Hearing"
    if doc_class in ("HDOC", "SDOC"):
        return "House document" if doc_class == "HDOC" else "Senate document"
    return "Congressional document"


def ordinal(number: int) -> str:
    if 10 <= number % 100 <= 20:
        suffix = "th"
    else:
        suffix = {1: "st", 2: "d", 3: "d"}.get(number % 10, "th")
    return f"{number}{suffix}"


def clean_title(summary: dict) -> str:
    """The document's own title: the Serial Set's "Title. September 15, 1987. -- Ordered to be printed" loses its date and printing order."""
    title = re.sub(r"\s+", " ", summary.get("title", "")).strip()
    title = re.sub(r";U\.S\. Congressional Serial Set.*$", "", title)
    title = re.sub(r"\.?\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.? \d{1,2}(?: \((?:legislative|calendar) day[^)]*\))?, \d{4}\.?\s*(?:--|Read\b|Ordered\b|Referred\b|Committed\b|Laid\b|Printed\b|Mr\.|\(To accompany|$).*$", "", title)
    title = re.sub(r"\s*--\s*(Ordered|Referred|Committed|Laid).*$", "", title)
    # "In the Senate of the United States. January 12, 1888. -- Ordered to be printed. Mr. X, from the Committee on Y, submitted the following report: [To accompany bill S. 1.] The Committee ..."
    if re.match(r"In the (Senate|House)|\(To accompany|The (?:Select |Special )?Committee", title) or not title:
        title = described(summary.get("title", "")) or title
    if title.isupper():
        title = title.title().replace(" Of ", " of ").replace(" The ", " the ").replace(" And ", " and ").replace(" For ", " for ").replace(" To ", " to ").replace(" In ", " in ").replace(" On ", " on ")
    return title.rstrip(" .;:") or "Report"


def described(raw: str) -> str:
    """A title for an old report the Serial Set titles only by its heading ("In the Senate of the United States. February 9, 1852.
    Ordered to be printed. Mr. Atchison made the following report: (To accompany Bill S. No. 198.) The Committee on Indian
    Affairs have examined the claims of Lewis A. Thomas ..."): what the committee says it was sent, "Claims of Lewis A. Thomas ..."."""
    text = re.sub(r"\s+", " ", raw)
    lead = re.search(r"(?:made|submitted) the following (?:report|views)[:.]?\s*(.*)", text)
    rest = lead.group(1) if lead else re.sub(r"^In the (?:Senate|House)[^.]*\.\s*(?:[A-Z][a-z]+ \d{1,2}, \d{4}\.?\s*)?(?:--\s*)?(?:Ordered to be printed\.?\s*)?", "", text)
    rest = re.sub(r"^\((?:To accompany|To accompy)[^)]*\)\.?\s*", "", rest)
    rest = re.sub(r"^The (?:Select |Special |Joint )?Committee (?:on|of) [^,]*?,? (?:to (?:whom|which) (?:was|were|had been) referred|have (?:had under consideration|examined|considered|carefully considered)|having (?:had )?under consideration|who were instructed|to whom the subject was referred)\s+", "", rest)
    rest = re.split(r",? (?:respectfully )?(?:report|reports|submit|beg leave)\b|\.\.|,? hav(?:e|ing) had the same|,? have (?:carefully )?considered|,? having considered", rest)[0].strip(" .,:;")
    if len(rest) < 8:
        return ""
    if len(rest) > 180:
        rest = rest[:180].rsplit(" ", 1)[0].rstrip(" ,;:") + " …"
    return rest[0].upper() + rest[1:]


def committee_author(summary: dict) -> list[dict]:
    chamber = (summary.get("chamber") or summary.get("governmentAuthor2") or "").title()
    committees = committees_of(summary)
    house = {"House": "U.S. House of Representatives", "Senate": "U.S. Senate", "Joint": "U.S. Congress"}.get(chamber, "U.S. Congress")
    if committees:
        return [{"literal": f"{house}, {name}"} for name in committees[:3]]
    return [{"literal": house}]


def indigo_citation(summary: dict, title: str, year: int) -> str:
    genre = genre_of(summary)
    congress = int(summary["congress"]) if str(summary.get("congress", "")).isdigit() else None
    session = summary.get("session")
    number = (summary.get("documentNumber") or "").lstrip("0")
    chamber = "S." if genre.startswith("Senate") or (summary.get("chamber") or summary.get("governmentAuthor2") or "").upper() == "SENATE" else "H.R."
    committees = committees_of(summary)
    committee = committees[0] if committees else ""
    committee_short = re.sub(r"^(Permanent |Select |Special )*Committee on ", "Comm. on ", committee)
    committee_short = committee_short.replace("Subcommittee on", "Subcomm. on")
    if genre in ("House report", "Senate report") and number:
        if congress and congress >= 80:
            return f"{chamber} Rep. No. {congress}-{number} ({year})"
        place = f", {ordinal(congress)} Cong., {ordinal(int(session))} Sess." if congress and str(session).isdigit() and int(session) >= 1 else f", {ordinal(congress)} Cong." if congress else ""
        return f"{chamber} Rep. No. {number}{place} ({year})"
    if genre == "Hearing":
        chamber_name = "S." if chamber == "S." else "H."
        before = f": Hearing Before the {chamber_name} {committee_short}" if committee_short and "Hearing" not in title else ""
        return f"{title}{before}, {ordinal(congress)} Cong. ({year})" if congress else f"{title} ({year})"
    if genre == "Committee print":
        staff = f"Staff of {'S.' if chamber == 'S.' else 'H.'} {committee_short}, " if committee_short else ""
        return f"{staff}{ordinal(congress) + ' Cong., ' if congress else ''}{title} (Comm. Print {year})"
    return f"{title} ({year})"


def record_key_of(summary: dict) -> str:
    genre = genre_of(summary)
    congress = summary.get("congress") or ""
    number = (summary.get("documentNumber") or "").lstrip("0")
    package = summary["packageId"]
    if genre in ("House report", "Senate report") and congress and number:
        key = f"{'house' if genre.startswith('House') else 'senate'}-report-{congress}-{number}"
        if int(congress) < 80 and str(summary.get("session", "")).isdigit() and int(summary["session"]) >= 1:
            key += f"-session-{summary['session']}"
        return key
    hearing = senate_hearing_number(summary)
    if genre == "Hearing" and hearing:
        return f"senate-hearing-{hearing}"
    slug = re.sub(r"[^a-z0-9]+", "-", package.lower()).strip("-")
    if slug.startswith("govpub-"):
        slug = "govpub-" + slug.split("-")[-1][:12]
    return {"Hearing": "congressional-hearing-", "Committee print": "committee-print-"}.get(genre, "congressional-document-") + re.sub(r"^(chrg|cprt|serialset)-", "", slug)


def bills_of(summary: dict) -> list[str]:
    out = []
    for item in summary.get("mods_bills") or []:
        kind, number, congress = item.split(":")
        label = {"hr": "H.R.", "s": "S.", "hres": "H. Res.", "sres": "S. Res.", "hjres": "H.J. Res.", "sjres": "S.J. Res.", "hconres": "H. Con. Res.", "sconres": "S. Con. Res."}.get(kind, kind.upper())
        out.append(f"{label} {number} ({ordinal(int(congress))} Cong.)")
    if not out:
        text = f"{summary.get('title', '')} {summary.get('subtitle', '')}"
        for match in re.finditer(r"\b(H\.\s?R\.|S\.)\s?(\d{1,5})\b", text):
            label = f"{match.group(1).replace(' ', '')} {match.group(2)}".replace("H.R.", "H.R.")
            if label not in out:
                out.append(label)
    return out[:20]


def dump(value) -> str:
    return yaml.safe_dump(value, allow_unicode=True, sort_keys=False, width=float("inf"))


def stored_copies() -> dict[str, dict]:
    sys.path.insert(0, str(ROOT / "scripts/captures"))
    import mirror_captures  # noqa: E402

    out = {}
    for row in mirror_captures.load_index():
        if row["key"].startswith("congress/") and row["key"].endswith(".pdf"):
            out[row["key"][len("congress/"):-4]] = {"storage_key": row["key"], "checksum": row["sha256"], "media_type": row["media_type"], "bytes": int(row["bytes"])}
    return out


MAX_STORED = 64 * 1024 * 1024


def pdf_link(package: str) -> str:
    return f"https://www.govinfo.gov/content/pkg/{package}/pdf/{package}.pdf"


def file(args) -> None:
    sys.path.insert(0, str(ROOT / "scripts/captures"))
    import mirror_captures  # noqa: E402

    work = Path(args.work)
    (work / "pdf").mkdir(parents=True, exist_ok=True)
    documents = json.loads((work / "documents.json").read_text(encoding="utf-8"))
    # A scan over 64 MB (216 of them, 50 GB of the 70 GB, mostly scanned hearings) is linked at GovInfo, not stored, as for the
    # largest Acts of Congress (scripts/law/title_25_acts.py). Sizes come from a HEAD request to each PDF.
    sizes_path = work / "sizes.json"
    sizes = json.loads(sizes_path.read_text(encoding="utf-8")) if sizes_path.exists() else {}
    documents = [summary for summary in documents if sizes.get(summary["packageId"], 0) <= MAX_STORED]
    if args.limit:
        documents = documents[: args.limit]
    rows = mirror_captures.load_index()
    filed = {row["key"] for row in rows}
    s3 = mirror_captures.client()
    bucket = mirror_captures.bucket_name()
    problems: list[str] = []

    def put(summary: dict):
        package = summary["packageId"]
        key = f"congress/{package}.pdf"
        if key in filed:
            return None
        path = work / "pdf" / f"{package}.pdf"
        try:
            if not path.exists():
                data = get(f"{GOVINFO}/packages/{package}/pdf?api_key={key_param()}", attempts=4)
                if not data.startswith(b"%PDF"):
                    return ("failed", f"{package}: not a PDF")
                path.write_bytes(data)
            digest = mirror_captures.sha256_of(path)
            size = path.stat().st_size
            if mirror_captures.remote_state(s3, bucket, key) != (size, digest):
                s3.upload_file(str(path), bucket, key, ExtraArgs={"ContentType": "application/pdf", "Metadata": {"sha256": digest, "captured": dt.date.today().isoformat()}})
                if mirror_captures.remote_state(s3, bucket, key) != (size, digest):
                    return ("failed", f"{package}: verification failed")
        except Exception as problem:  # noqa: BLE001 - reported
            return ("failed", f"{package}: {problem}")
        finally:
            pass
        path.unlink(missing_ok=True)
        return ("ok", mirror_captures.index_row(
            key=key, size=size, digest=digest, media="application/pdf", topic="congress", title=clean_title(summary), nations="",
            obtained="downloaded from GovInfo by script", links=[pdf_link(package), summary.get("detailsLink") or f"https://www.govinfo.gov/app/details/{package}"],
            record=record_key_of(summary), redistribution="yes", rights="United States government work (17 U.S.C. § 105).", existing_keys=filed))

    added = 0
    started = time.time()
    with concurrent.futures.ThreadPoolExecutor(args.threads) as pool:
        for count, result in enumerate(pool.map(put, documents), 1):
            if result and result[0] == "failed":
                problems.append(result[1])
            elif result:
                rows.append(result[1])
                added += 1
            if count % 200 == 0:
                mirror_captures.write_index(rows)
                print(f"{count}/{len(documents)} done, {added} filed, {len(problems)} failed, {time.time() - started:.0f} s", flush=True)
    mirror_captures.write_index(rows)
    (work / "file-problems.txt").write_text("\n".join(problems), encoding="utf-8")
    print(f"filed {added}; {len(problems)} failed (listed in {work / 'file-problems.txt'})")


MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
CONGRESS_WORDS = {"First": 1, "Second": 2, "Third": 3, "Fourth": 4, "Fifth": 5, "Sixth": 6, "Seventh": 7, "Eighth": 8, "Ninth": 9, "Tenth": 10,
                  "Eleventh": 11, "Twelfth": 12, "Thirteenth": 13, "Fourteenth": 14, "Fifteenth": 15, "Sixteenth": 16, "Seventeenth": 17, "Eighteenth": 18, "Nineteenth": 19,
                  "Twentieth": 20, "Thirtieth": 30, "Fortieth": 40, "Fiftieth": 50, "Sixtieth": 60, "Seventieth": 70, "Eightieth": 80, "Ninetieth": 90}
TENS = {"Twenty": 20, "Thirty": 30, "Forty": 40, "Fifty": 50, "Sixty": 60, "Seventy": 70, "Eighty": 80, "Ninety": 90}


def congress_from_words(text: str) -> int | None:
    """"One Hundred Fourth Congress" is 104; "Ninety-sixth Congress" is 96."""
    match = re.search(r"\b((?:One Hundred(?: and)? )?(?:(?:Twenty|Thirty|Forty|Fifty|Sixty|Seventy|Eighty|Ninety)[- ])?[A-Z]?[a-z]+(?:th|st|nd|rd|d)) Congress\b", text, re.I)
    if not match:
        return None
    words = match.group(1).title().replace("-", " ").replace(" And ", " ").split()
    total = 0
    if words[:2] == ["One", "Hundred"]:
        total, words = 100, words[2:]
    if words and words[0] in TENS and len(words) > 1:
        total, words = total + TENS[words[0]], words[1:]
    if len(words) != 1 or words[0] not in CONGRESS_WORDS:
        return None
    return total + CONGRESS_WORDS[words[0]]


def fill_gaps(summary: dict) -> dict:
    """A scanned hearing's summary often lacks its Congress and the day it was held, which its S. Hrg. number and subtitle give."""
    if not str(summary.get("congress", "")).isdigit():
        number = senate_hearing_number(summary)
        congress = int(number.split("-")[0]) if number else congress_from_words(f"{summary.get('title', '')} {summary.get('subtitle', '')}")
        if congress:
            summary["congress"] = str(congress)
    if not summary.get("heldDates") and summary.get("packageId", "").startswith("GOVPUB"):
        text = f"{summary.get('subtitle', '')} {summary.get('title', '')}"
        days = [f"{year}-{MONTH_NAMES.index(month) + 1:02d}-{int(day):02d}" for month, day, year in re.findall(r"\b(" + "|".join(MONTH_NAMES) + r") (\d{1,2}), (\d{4})\b", text)]
        if days:
            summary["heldDates"] = days
    return summary


def sizes(args) -> None:
    work = Path(args.work)
    documents = json.loads((work / "documents.json").read_text(encoding="utf-8"))
    path = work / "sizes.json"
    known = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}

    def size(summary: dict) -> tuple[str, int]:
        package = summary["packageId"]
        if known.get(package, 0) > 0:
            return package, known[package]
        for _ in range(3):
            try:
                with urllib.request.urlopen(urllib.request.Request(pdf_link(package), method="HEAD", headers=UA), timeout=60) as response:
                    return package, int(response.headers.get("Content-Length") or 0)
            except Exception:  # noqa: BLE001 - retried, then counted as unknown
                time.sleep(2)
        return package, -1

    with concurrent.futures.ThreadPoolExecutor(16) as pool:
        known.update(dict(pool.map(size, documents)))
    path.write_text(json.dumps(known), encoding="utf-8")
    found = [value for value in known.values() if value > 0]
    print(f"{len(found)} sizes, {sum(found) / 1e9:.1f} GB; {sum(1 for value in found if value > MAX_STORED)} over 64 MB; {sum(1 for value in known.values() if value <= 0)} unknown")


def held_date(summary: dict) -> tuple[int, int, int] | None:
    dates = summary.get("heldDates") or []
    date = dates[0] if dates else summary.get("dateIssued", "")
    match = re.match(r"(\d{4})-(\d{2})-(\d{2})", date)
    if not match:
        return None
    year, month, day = (int(part) for part in match.groups())
    return year, month, day


def record_for(summary: dict, copy: dict | None, nations: list[str]) -> dict:
    summary = fill_gaps(summary)
    package = summary["packageId"]
    genre = genre_of(summary)
    title = clean_title(summary)
    date = held_date(summary)
    # A scanned hearing is dated by GovInfo to January 1 of its year: keep only the year.
    year_only = date and package.startswith("GOVPUB") and date[1:] == (1, 1)
    issued = {"date-parts": [[date[0]] if year_only else list(date)]} if date else None
    year = date[0] if date else None
    congress = int(summary["congress"]) if str(summary.get("congress", "")).isdigit() else None
    citation_text = indigo_citation(summary, title, year) if year else title
    details = summary.get("detailsLink") or f"https://www.govinfo.gov/app/details/{package}"
    citation = {"type": "hearing" if genre == "Hearing" else "report", "title": title, "genre": genre, "author": committee_author(summary),
                "publisher": summary.get("publisher") or "U.S. Government Publishing Office", "URL": details}
    if summary.get("subtitle") and genre != "House report" and genre != "Senate report":
        citation["title-short"] = title
    number = re.sub(r"\s*\(\d{4}\)$", "", citation_text) if genre in ("House report", "Senate report") else (f"S. Hrg. {senate_hearing_number(summary)}" if senate_hearing_number(summary) else None)
    if number:
        citation["number"] = number
    if summary.get("pages", "").isdigit():
        citation["number-of-pages"] = summary["pages"]
    if issued:
        citation["issued"] = issued
    citation["accessed"] = {"date-parts": [[2026, 11, 27]]}
    chamber = (summary.get("chamber") or summary.get("governmentAuthor2") or "").lower()
    legislative = {"chamber": chamber if chamber in ("house", "senate", "joint") else "congress"}
    if congress:
        legislative["congress"] = congress
    if str(summary.get("session", "")).isdigit() and 1 <= int(summary["session"]) <= 4:
        legislative["session"] = int(summary["session"])
    committees = committees_of(summary)
    if committees:
        legislative["committees"] = committees
    bills = bills_of(summary)
    if bills:
        legislative["bills"] = bills
    if summary.get("laws"):
        legislative["laws"] = sorted(summary["laws"])
    if summary.get("heldDates"):
        legislative["held"] = sorted(summary["heldDates"])
    legislative["govinfo_package"] = package
    why = {"committee": "written by a committee for Indian affairs", "title": "its title names Native people", "nation named": "its title names a Native nation",
           "subject": "GovInfo's subject headings for it are about Indians", "legislative history": "it is a report on a law the project holds"}[summary["kept_because"]]
    where = "Congressional Serial Set" if package.startswith("SERIALSET") else "GovInfo, scanned with the Boston Public Library" if package.startswith("GOVPUB") else "GovInfo"
    notes = (f"Indigo Book citation: {citation_text}. {genre}{' of the ' + committees[0] if committees else ''}"
             f"{', ' + ordinal(congress) + ' Congress' if congress else ''}. From {where} ({package}); kept because {why}. "
             f"Title, date, committee and numbers from GovInfo's summary and MODS record; nations matched by name in the title. "
             f"Generated by {SCRIPT}; not yet read by a person (Unverified).")
    record = {"key": record_key_of(summary), "kind": "congressional-document", "citation": citation, "original_link": details, "retrieved": TODAY}
    if copy:
        record["file"] = copy
    record["legislative"] = legislative
    record["rights"] = RIGHTS
    record["jurisdictions"] = [{"level": "federal"}]
    if nations:
        record["tribes"] = nations
    record.update({"access": {"open": True, "pull_from": ["free-web"]}, "found_in": [SESSION], "notes": notes,
                   "review": {"status": "unverified", "by": SCRIPT, "date": TODAY,
                              "checks": [{"check": "citation", "result": "missing", "detail": f"GovInfo metadata only: {package}"}]}})
    return record


def records(args) -> None:
    sys.path.insert(0, str(ROOT / "scripts/law"))
    from nation_names import NationNames  # noqa: E402

    work = Path(args.work)
    documents = json.loads((work / "documents.json").read_text(encoding="utf-8"))
    names = NationNames()
    stored = stored_copies()
    written, keys = 0, {}
    for summary in documents:
        key = record_key_of(summary)
        if key in keys:
            key = f"{key}-{re.sub(r'[^a-z0-9]+', '-', summary['packageId'].lower())[-10:].strip('-')}"
        keys[key] = summary["packageId"]
        path = SOURCES / key[0] / f"{key}.yaml"
        if path.exists() and SESSION not in path.read_text(encoding="utf-8"):
            continue
        nations = nations_in(names, NOT_NATIVE.sub(" ", f"{clean_title(summary)}. {summary.get('subtitle', '')}"))
        record = record_for(summary, stored.get(summary["packageId"]), nations)
        record["key"] = key
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(dump(record), encoding="utf-8")
        written += 1
    print(f"wrote {written} records")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    for name in ("search", "summaries", "histories", "classify", "sizes", "records"):
        sub.add_parser(name).add_argument("--work", required=True)
    filing = sub.add_parser("file")
    filing.add_argument("--work", required=True)
    filing.add_argument("--threads", type=int, default=4)
    filing.add_argument("--limit", type=int, default=0)
    args = parser.parse_args()
    {"search": search, "summaries": summaries, "histories": histories, "classify": classify, "sizes": sizes, "file": file, "records": records}[args.command](args)


if __name__ == "__main__":
    main()
