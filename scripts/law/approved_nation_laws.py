#!/usr/bin/env python3
"""Records, stored copies and nation-page facts for the Native nations' laws that federal agencies have approved
(new data source category 1; Trevor, Nov. 27, 2026: "grab 1,2,4").

Three lists:

HEARTH Act leasing regulations. The Helping Expedite and Advance Responsible Tribal Home Ownership Act of 2012
(25 U.S.C. § 415(h)) lets a nation lease its trust land under its own regulations once the Secretary of the
Interior approves them. The Bureau of Indian Affairs lists every approval by year, each linking to the nation's
regulations with the Assistant Secretary's approval page (https://www.bia.gov/service/HEARTH-Act/approved-regulations).
Each becomes a record of kind tribal-code (the nation's own law), with its stored copy, and a nation-page fact
(jurisdiction topic hearth-act-leasing-regulations, value approved).

Water quality standards. The Environmental Protection Agency lists each nation it has found eligible to set water
quality standards under Clean Water Act § 518 and § 303(c), with the date of that finding and the date it first
approved the nation's standards (https://www.epa.gov/wqs-tech/epa-actions-tribal-water-quality-standards-and-contacts).
Each nation's own page lists the standards in effect for Clean Water Act purposes. Each standards document becomes
a record of kind tribal-code, with its stored copy.

Treatment as a state. EPA's table of every nation approved for "treatment in a similar manner as a state" (TAS) to
run a regulatory program or perform an administrative function
(https://www.epa.gov/tribal/tribes-approved-treatment-state-tas). Each program a nation is approved for becomes a
nation-page fact (jurisdiction topic environmental-treatment-as-a-state, value the program), citing a record for
the EPA page. The water quality standards list's eligibility dates are added to those facts' as_of.

Nations are matched by name with scripts/law/nation_names.py. A name that matches no profile, or more than one,
is listed in research/approved-nation-laws/unmatched.csv and gets no tribes or facts until a person (or a Haiku
reader, for a long list) settles it in research/approved-nation-laws/nation-matches.csv, which the script reads
first. Every record and fact starts Unverified.

Steps:
  fetch    Read the three lists and each nation's standards page, download every linked document.
           Writes --work/lists.json and --work/files/.
  file     Store each document in the bucket (approved-nation-laws/...) and add it to the capture index.
  records  Write the source records and research/approved-nation-laws/*.csv.
  facts    Write research/jurisdiction/approved-nation-laws.json, a batch for scripts/jurisdiction/apply.py.

Usage:
  python3 scripts/law/approved_nation_laws.py fetch --work DIR
  python3 scripts/law/approved_nation_laws.py file --work DIR --captures /mnt/project-files/research/captures
  python3 scripts/law/approved_nation_laws.py records --work DIR
  python3 scripts/law/approved_nation_laws.py facts --work DIR
  python3 scripts/jurisdiction/apply.py research/jurisdiction/approved-nation-laws.json
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import hashlib
import html
import json
import re
import subprocess
import sys
import time
import urllib.parse
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts/law"))
from nation_names import NationNames  # noqa: E402

SOURCES = ROOT / "content/sources"
RESEARCH = ROOT / "research/approved-nation-laws"
INDEX = ROOT / "research/capture-index.csv"
BATCH = ROOT / "research/jurisdiction/approved-nation-laws.json"
SESSION = "2026-11-27-approved-nation-laws"
SCRIPT = "scripts/law/approved_nation_laws.py"
TODAY = "2026-11-27"
TOPIC = "approved-nation-laws"
AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
HEARTH = "https://www.bia.gov/service/HEARTH-Act/approved-regulations"
WQS = "https://www.epa.gov/wqs-tech/epa-actions-tribal-water-quality-standards-and-contacts"
TAS = "https://www.epa.gov/tribal/tribes-approved-treatment-state-tas"
EPA = "https://www.epa.gov"
MONTHS = "January|February|March|April|May|June|July|August|September|October|November|December"
SHORT = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."]
GOVERNMENT = {"status": "no-permission-needed", "basis": "us-government-work",
              "basis_note": "A work of the United States government, not subject to copyright (17 U.S.C. § 105).",
              "redistribution": True}
NATION_LAW = {"status": "no-permission-needed", "basis": "fact-only",
              "basis_note": "A Native nation's own law. Facts are recorded from it, and the copy is served on this site (decision record 0031); the nation can ask to have it taken down.",
              "redistribution": True}
# EPA's words in the treatment-as-a-state table, and the program each names (docs/data-model.md, Jurisdiction and federal ties).
PROGRAMS = [
    (r"\bWQS\b|Water Quality Standards", "clean-water-act-water-quality-standards", "Water quality standards (Clean Water Act §§ 303(c) and 401)"),
    (r"NPDES", "clean-water-act-discharge-permits", "Discharge permits (Clean Water Act § 402)"),
    (r"PWSS|Public Water System", "safe-drinking-water-act-public-water-systems", "Public water system supervision (Safe Drinking Water Act § 1413)"),
    (r"\bUIC\b|Underground Injection", "safe-drinking-water-act-underground-injection", "Underground injection control (Safe Drinking Water Act § 1425)"),
    (r"Lead Abatement|RRP|Renovat", "toxic-substances-control-act-lead-programs", "Lead abatement and renovation programs (Toxic Substances Control Act §§ 402, 404, 406)"),
    (r"\bTIP\b|Implementation Plan|§\s*110\b", "clean-air-act-implementation-plan", "Tribal implementation plan (Clean Air Act § 110)"),
    (r"NSPS|§\s*111\b", "clean-air-act-new-source-standards", "New source performance standards (Clean Air Act § 111)"),
    (r"NESHAP|§\s*112\b", "clean-air-act-hazardous-air-pollutants", "Hazardous air pollutant standards (Clean Air Act § 112)"),
    (r"Title V|Operating Permit", "clean-air-act-operating-permits", "Operating permits (Clean Air Act title V)"),
    (r"§\s*303\(d\)|Impaired", "clean-water-act-impaired-waters", "Impaired waters lists (Clean Water Act § 303(d))"),
]
# The table's "Administrative Functions" column lists Clean Air Act sections (notice of neighboring permits under § 505(a)(2),
# petitions under § 126 and others): one fact each, with EPA's own list of sections in the detail.
ADMINISTRATIVE = ("clean-air-act-administrative-functions", "Clean Air Act administrative functions")


def dump(value) -> str:
    return yaml.safe_dump(value, sort_keys=False, allow_unicode=True, width=float("inf"))


def curl(url: str, path: Path) -> bool:
    path.parent.mkdir(parents=True, exist_ok=True)
    for attempt in range(3):
        result = subprocess.run(["curl", "-sfL", "-m", "300", "-A", AGENT, "-o", str(path), "-w", "%{http_code}", url], capture_output=True, text=True)
        if result.returncode == 0 and path.exists() and path.stat().st_size > 0:
            return True
        time.sleep(3 * (attempt + 1))
    path.unlink(missing_ok=True)
    return False


def page(url: str, work: Path) -> str:
    path = work / "pages" / (hashlib.sha256(url.encode()).hexdigest()[:16] + ".html")
    if not path.exists():
        time.sleep(1)
        if not curl(url, path):
            raise SystemExit(f"could not read {url}")
    return path.read_text(encoding="utf-8", errors="replace")


def text(fragment: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", fragment)).replace("\xa0", " ")).strip()


def main_part(source: str) -> str:
    start = source.find("<main")
    end = source.find("</main>", start)
    body = source[start:end if end > 0 else None]
    return re.sub(r"(?is)<(script|style|svg|nav)[^>]*>.*?</\1>", " ", body)


def iso(date: str) -> str:
    date = re.sub(r"^(\w+),\s", r"\1 ", date.strip())
    date = re.sub(r"\s+", " ", date.replace(",", ", ")).replace(" ,", ",").strip()
    return dt.datetime.strptime(re.sub(r",\s+", ", ", date), "%B %d, %Y").date().isoformat()


def long_date(value: str) -> str:
    day = dt.date.fromisoformat(re.search(r"\d{4}-\d\d-\d\d", value).group(0))
    return f"{SHORT[day.month - 1]} {day.day}, {day.year}"


def slug(value: str, limit: int = 80) -> str:
    value = re.sub(r"[^a-z0-9]+", "-", value.lower().replace("&", " and ").replace("’", "").replace("'", "")).strip("-")
    return value[:limit].rstrip("-")


def file_name(url: str) -> str:
    name = urllib.parse.unquote(Path(urllib.parse.urlparse(url).path).name)
    return re.sub(r"[^A-Za-z0-9._-]+", "_", name)


# ---------------------------------------------------------------- fetch

def hearth_list(work: Path) -> list[dict]:
    """Each approval on the Bureau's page: the nation as the page names it, the kinds of lease, the date and the file."""
    body = main_part(page(HEARTH, work))
    items = []
    for section in re.split(r"(?i)<h2[^>]*>", body)[1:]:
        heading = text(section[: section.find("</h2>")])
        if not re.match(r"Approved in \d{4}", heading):
            continue
        for anchor in re.finditer(r'(?is)<a[^>]+href="([^"]+)"[^>]*>(.*?)</a>(.*?)(?=<a |</li>)', section):
            link, label, after = anchor.group(1), text(anchor.group(2)), text(anchor.group(3))
            if not re.search(r"\.pdf|media_document|/files/", link, re.I):
                continue
            label = re.sub(r"\s*;?\s*amended(?: on)?\s*$", "", f"{label} {after}".strip(" ,;"))
            date = re.search(rf"({MONTHS}),?\s+\d{{1,2}}\s*,?\s*\d{{4}}", label)
            link = urllib.parse.urljoin(HEARTH, html.unescape(link))
            if re.match(MONTHS, label) and items:
                # "Jamul Indian Village (Business), June 14, 2019; amended on May 28, 2025": the amendment's link, named by its date only.
                if any(item["link"] == link for item in items):
                    continue
                earlier = items[-1]
                items.append({**earlier, "kinds": f"Amended {earlier['kinds']}".strip(), "approved": iso(date.group(0)) if date else "", "label": f"{earlier['label']}; amended {label}",
                              "link": link, "amends": earlier["link"]})
                continue
            kinds = re.search(r"\(([^)]*)\)", label)
            name = re.split(r"\s*\(|,\s*(?:" + MONTHS + r")\b", label)[0].strip(" ,")
            items.append({"list_name": name, "kinds": kinds.group(1).strip() if kinds else "", "approved": iso(date.group(0)) if date else "",
                          "year_heading": heading, "label": label, "link": link})
    return items


def wqs_list(work: Path) -> list[dict]:
    """EPA's table: each nation found eligible to set water quality standards, and the documents on its own page."""
    body = main_part(page(WQS, work))
    rows = []
    for row in re.findall(r"(?is)<tr>(.*?)</tr>", body):
        cells = re.findall(r"(?is)<td[^>]*>(.*?)</td>", row)
        if len(cells) < 5:
            continue
        link = re.search(r'href="([^"]+)"', cells[0])
        rows.append({"list_name": text(cells[0]), "region": text(cells[1]), "eligible": text(cells[3]), "first_approved": text(cells[4]),
                     "page": urllib.parse.urljoin(EPA, html.unescape(link.group(1))) if link else ""})
    for row in rows:
        row["documents"] = []
        if not row["page"]:
            continue
        nation_page = main_part(page(row["page"], work))
        row["page_title"] = text(re.search(r"(?is)<h1[^>]*>(.*?)</h1>", nation_page).group(1)) if "<h1" in nation_page else ""
        authority = re.search(r"(?is)<h2[^>]*>\s*Authority to Administer.*?</h2>(.*?)(?=<h2)", nation_page)
        row["authority"] = text(re.sub(r"(?is)<h3.*", " ", re.sub(r"(?is)<li.*?</li>", " ", authority.group(1)))) if authority else ""
        standards = re.search(r"(?is)<h2[^>]*>\s*Tribal Standards in Effect.*?</h2>(.*?)(?=<h2)", nation_page)
        row["standards_note"] = text(re.sub(r"(?is)<ul.*?</ul>", " ", standards.group(1))) if standards else ""
        # The nation's standards in effect, and from the authority section only EPA's own decision on the nation's eligibility
        # (its decision document or approval letter), not press releases, maps or the nation's application.
        parts = [("standards", standards.group(1) if standards else "")]
        if authority:
            parts.append(("eligibility", re.sub(r"(?is)<h3.*", " ", authority.group(1))))
        for part, fragment in parts:
            for item in re.findall(r"(?is)<li[^>]*>(.*?)(?=<li|</ul>|$)", fragment):
                anchor = re.search(r'(?is)<a[^>]+href="([^"]+)"[^>]*>(.*?)</a>', item)
                if not anchor:
                    continue
                title = re.sub(r"\s*\((?:pdf|PDF)\)\s*$", "", text(anchor.group(2)))
                if part == "eligibility" and not re.search(r"Decision Document|Approval of|Approval Letter|Determination", title, re.I):
                    continue
                if not re.search(r"\.pdf$", anchor.group(1), re.I):
                    continue
                rest = text(item[anchor.end():])
                effective = re.search(rf"(?:Effective|effective|Approved|approved)?[^)]*?(({MONTHS})\s+\d{{1,2}}\s*,\s*\d{{4}})", rest)
                row["documents"].append({"title": title, "part": part, "link": urllib.parse.urljoin(EPA, html.unescape(anchor.group(1))), "after": rest,
                                         "effective": iso(effective.group(1)) if effective else ""})
    return rows


def tas_list(work: Path) -> list[dict]:
    """EPA's table of every nation approved for treatment as a state, by program column."""
    body = main_part(page(TAS, work))
    tables = re.findall(r"(?is)<table.*?</table>", body)
    table = next(table for table in tables if re.search(r"(?is)<th[^>]*>\s*Tribe\s*</th>", table))
    headers = [text(cell) for cell in re.findall(r"(?is)<th[^>]*>(.*?)</th>", table)]
    rows = []
    for row in re.findall(r"(?is)<tr>(.*?)</tr>", table):
        cells = [text(cell) for cell in re.findall(r"(?is)<td[^>]*>(.*?)</td>", row)]
        if not cells:
            continue
        rows.append({"list_name": cells[0], "columns": {headers[index]: cell for index, cell in enumerate(cells[1:], start=1) if cell}})
    updated = re.search(r"Last updated on ((?:" + MONTHS + r")\s+\d{1,2},\s*\d{4})", page(TAS, work))
    return rows, (iso(updated.group(1)) if updated else TODAY)


def fetch(args) -> None:
    work = Path(args.work)
    hearth = hearth_list(work)
    wqs = wqs_list(work)
    tas, tas_updated = tas_list(work)
    wqs_updated = re.search(r"Last updated on ((?:" + MONTHS + r")\s+\d{1,2},\s*\d{4})", page(WQS, work))
    hearth_updated = re.search(r"(?:Last Updated|Last updated)[^0-9A-Za-z]*([0-9/]+|(?:" + MONTHS + r")\s+\d{1,2},\s*\d{4})", page(HEARTH, work))
    problems = []
    for item in hearth + [document for row in wqs for document in row["documents"]]:
        item["file"] = f"files/{file_name(item['link'])}"
        path = work / item["file"]
        if not path.exists() and not curl(item["link"], path):
            problems.append(item["link"])
            item["file"] = ""
            continue
        time.sleep(0.5)
        if path.suffix.lower() == ".pdf" and b"%PDF" not in path.read_bytes()[:1024]:
            problems.append(f"not a PDF: {item['link']}")
    lists = {"hearth": hearth, "water_quality_standards": wqs, "treatment_as_a_state": tas,
             "updated": {"treatment_as_a_state": tas_updated, "water_quality_standards": iso(wqs_updated.group(1)) if wqs_updated else TODAY,
                         "hearth": hearth_updated.group(1) if hearth_updated else ""},
             "fetched": TODAY, "problems": problems}
    (work / "lists.json").write_text(json.dumps(lists, indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"{len(hearth)} HEARTH approvals, {len(wqs)} nations on the standards list "
          f"({sum(len(row['documents']) for row in wqs)} standards documents), {len(tas)} nations on the TAS table; {len(problems)} problem(s)")
    for problem in problems:
        print("  ", problem)


# ---------------------------------------------------------------- nations

def matcher():
    names = NationNames()
    overrides = {}
    path = RESEARCH / "nation-matches.csv"
    if path.exists():
        for row in csv.DictReader(path.open(encoding="utf-8")):
            overrides[row["list_name"]] = [nation for nation in row["nations"].split(";") if nation]
    unmatched: dict[str, str] = {}

    def nations_of(name: str, where: str) -> list[str]:
        if name in overrides:
            return overrides[name]
        bare = re.sub(r"\s*\((?:[A-Z]{2}(?:,\s*[A-Z]{2})*)\)\s*$", "", name)
        found = names.find(bare)
        # nation_names.py on main still lets "the Tribes" (the Salish and Kootenai Tribes' own word for themselves) match any
        # "Tribes"; PR #551 adds the guard. Until then, a Salish and Kootenai match needs one of their names in the text.
        found = [nation for nation in found if not (nation.startswith("confederated-salish") and not re.search(r"Salish|Kootenai|Flathead", bare))]
        if len(found) != 1:
            unmatched[name] = f"{where}: {'; '.join(found) or 'no match'}"
            return []
        return found
    return nations_of, unmatched, names


# ---------------------------------------------------------------- file

def stored_key(item: dict, folder: str) -> str:
    return f"{TOPIC}/{folder}/{Path(item['file']).name}"


def file(args) -> None:
    sys.path.insert(0, str(ROOT / "scripts/captures"))
    import mirror_captures  # noqa: E402

    work = Path(args.work)
    lists = json.loads((work / "lists.json").read_text(encoding="utf-8"))
    nations_of, _, _ = matcher()
    jobs = [(item, "hearth-act-leasing-regulations", item["list_name"], item["label"]) for item in lists["hearth"]]
    jobs += [(document, "water-quality-standards", row["list_name"], document["title"]) for row in lists["water_quality_standards"] for document in row["documents"]]
    known = {row["key"] for row in csv.DictReader(INDEX.open(encoding="utf-8"))}
    for item, folder, nation, title in jobs:
        if not item.get("file") or stored_key(item, folder) in known:
            continue
        mirror_captures.add(argparse.Namespace(
            captures=args.captures, files=[str(work / item["file"])], topic=f"{TOPIC}/{folder}", name=Path(item["file"]).name,
            record="", obtained=f"downloaded by {SCRIPT}", title=title, link=[item["link"]], redistribution="yes",
            nations=";".join(nations_of(nation, folder)),
            rights="A Native nation's own law (decision record 0031), with the federal approval where the file includes it; the nation can ask to have it taken down.",
            keep_local=False))


def copies() -> dict[str, dict]:
    out = {}
    for row in csv.DictReader(INDEX.open(encoding="utf-8")):
        out[row["key"]] = {"storage_key": row["key"], "checksum": row["sha256"], "media_type": row["media_type"], "bytes": int(row["bytes"])}
    return out


# ---------------------------------------------------------------- records

def date_parts(value: str) -> list[int]:
    return [int(part) for part in value.split("-")]


def write(record: dict) -> None:
    path = SOURCES / record["key"][0] / f"{record['key']}.yaml"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(dump(record), encoding="utf-8")


def review(detail: str) -> dict:
    return {"status": "unverified", "by": SCRIPT, "date": TODAY, "checks": [{"check": "listing", "result": "missing", "detail": detail}]}


def hearth_records(lists: dict, nations_of, names, stored: dict) -> list[dict]:
    records = []
    keys: set[str] = set()
    for item in lists["hearth"]:
        nations = nations_of(item["list_name"], "HEARTH")
        base = "hearth-act-leasing-regulations-" + slug(nations[0] if nations else item["list_name"], 60) + "-" + (item["approved"] or "undated")
        key, number = base, 2
        while key in keys:
            key, number = f"{base}-{number}", number + 1
        keys.add(key)
        kinds = f" ({item['kinds']})" if item["kinds"] else ""
        title = f"{item['list_name']} Leasing Regulations under the HEARTH Act{kinds}"
        citation = {"type": "legislation", "title": title, "author": [{"literal": names.names[nations[0]] if nations else item["list_name"]}],
                    "genre": "HEARTH Act leasing regulations"}
        if item["approved"]:
            citation["issued"] = {"date-parts": [date_parts(item["approved"])]}
        citation |= {"URL": item["link"], "accessed": {"date-parts": [[2026, 11, 27]]}}
        record = {"key": key, "kind": "tribal-code", "citation": citation, "original_link": item["link"], "retrieved": TODAY}
        copy = stored.get(stored_key(item, "hearth-act-leasing-regulations")) if item.get("file") else None
        if copy:
            record["file"] = copy
        record["rights"] = NATION_LAW
        if nations:
            record["tribes"] = nations
        record["jurisdictions"] = [{"level": "tribal"}]
        record["topics"] = ["hearth-act-leasing-regulations", TOPIC]
        record["access"] = {"open": True, "pull_from": ["free-web"]}
        record["found_in"] = [SESSION]
        approved = f"approved by the Assistant Secretary - Indian Affairs on {long_date(item['approved'])}" if item["approved"] else "approval date not given"
        record["notes"] = (f"Leasing regulations the nation adopted under the HEARTH Act, 25 U.S.C. § 415(h), {approved}, as the Bureau of Indian Affairs' list of approved regulations gives it "
                           f"(\"{item['label']}\", under \"{item['year_heading']}\"). The file is the one the list links, which the Bureau posts with the approval page. "
                           f"Generated by {SCRIPT}; the nation was matched by name, and nobody has checked the record against the document yet (Unverified).")
        record["review"] = review("Only the Bureau of Indian Affairs' list was read, not the regulations themselves")
        item["record"] = key
        records.append(record)
    return records


def wqs_records(lists: dict, nations_of, names, stored: dict) -> list[dict]:
    records = []
    keys: set[str] = set()
    for row in lists["water_quality_standards"]:
        nations = nations_of(row["list_name"], "water quality standards")
        for document in row["documents"]:
            base = "water-quality-standards-" + slug(nations[0] if nations else row["list_name"], 60) + "-" + (document["effective"] or slug(document["title"], 30))
            if document.get("part") == "eligibility":
                base = "treatment-as-a-state-decision-" + slug(nations[0] if nations else row["list_name"], 60) + ("-" + document["effective"] if document["effective"] else "")
            key, number = base, 2
            while key in keys:
                key, number = f"{base}-{number}", number + 1
            keys.add(key)
            government = document.get("part") == "eligibility" or bool(re.search(r"^(?:The )?(?:U\.\s?S\.?\s?EPA|EPA)\b|Technical Support Document|Decision Document|Action Letter", document["title"]))
            title = document["title"]
            bare = re.sub(r"\s*\((?:[A-Z]{2}(?:,\s*[A-Z]{2})*|formerly[^)]*)\)", "", row["list_name"]).strip()
            if not government and "water quality" not in title.lower():
                title = f"{title} Water Quality Standards" if re.sub(r"\W", "", title.lower()) in re.sub(r"\W", "", bare.lower()) or len(title.split()) <= 5 and not title.startswith(("Appendix", "Variances")) else title
            if not government and not any(word in title for word in re.findall(r"[A-Z][a-z’'-]{3,}", bare)[:2]):
                title = f"{bare} Water Quality Standards: {title}"
            genre = ("Treatment as a state decision" if document.get("part") == "eligibility" else "Water quality standards action") if government else "Water quality standards"
            citation = {"type": "report" if government else "legislation", "title": title,
                        "author": [{"literal": "U.S. Environmental Protection Agency"}] if government else [{"literal": names.names[nations[0]] if nations else re.sub(r"\s*\([A-Z, ]+\)$", "", row["list_name"])}],
                        "genre": genre}
            if document["effective"]:
                citation["issued"] = {"date-parts": [date_parts(document["effective"])]}
            citation |= {"URL": document["link"], "accessed": {"date-parts": [[2026, 11, 27]]}}
            record = {"key": key, "kind": "federal-agency-document" if government else "tribal-code", "citation": citation, "original_link": document["link"], "retrieved": TODAY}
            copy = stored.get(stored_key(document, "water-quality-standards")) if document.get("file") else None
            if copy:
                record["file"] = copy
            record["rights"] = GOVERNMENT if government else NATION_LAW
            if nations:
                record["tribes"] = nations
            record["jurisdictions"] = [{"level": "federal" if government else "tribal"}]
            record["topics"] = ["water-quality-standards" if document.get("part") != "eligibility" else "treatment-as-a-state", TOPIC]
            record["access"] = {"open": True, "pull_from": ["free-web"]}
            record["found_in"] = [SESSION]
            effective = f" EPA's page gives it as effective {long_date(document['effective'])}." if document["effective"] else ""
            heading = "Authority to Administer Standards Program" if document.get("part") == "eligibility" else "Tribal Standards in Effect for CWA Purposes"
            record["notes"] = (f"Listed by the Environmental Protection Agency under \"{heading}\" on its page for the nation ({row['page']}).{effective} "
                               f"The nation was found eligible to set water quality standards (Clean Water Act § 518(e)) on {row['eligible'] or 'a date EPA does not give'}"
                               f"{', and EPA first approved its standards on ' + row['first_approved'] if row['first_approved'] else ''}. "
                               "EPA notes that parts of a document may be disapproved or not in effect for Clean Water Act purposes; its page says which. "
                               f"Generated by {SCRIPT}; the nation was matched by name, and nobody has checked the record against the document yet (Unverified).")
            record["review"] = review("Only EPA's pages were read, not the standards themselves")
            document["record"] = key
            records.append(record)
    return records


def list_records(lists: dict) -> list[dict]:
    """The two EPA pages the facts cite."""
    out = []
    for key, title, link, updated, about in (
        ("epa-tribes-approved-for-treatment-as-a-state", "Tribes Approved for Treatment as a State (TAS)", TAS, lists["updated"]["treatment_as_a_state"],
         "EPA's table of each federally recognized Tribe approved for treatment in a similar manner as a state to run an environmental regulatory program or perform an administrative function under the Clean Air Act, Clean Water Act, Safe Drinking Water Act and Toxic Substances Control Act, and the count of Tribes approved for each program and grant."),
        ("epa-actions-on-tribal-water-quality-standards", "EPA Actions on Tribal Water Quality Standards and Contacts", WQS, lists["updated"]["water_quality_standards"],
         "EPA's table of each Tribe found eligible to administer a water quality standards program, with the date of the finding and of EPA's first approval of the Tribe's standards, linking a page for each Tribe that lists its standards in effect for Clean Water Act purposes."),
    ):
        citation = {"type": "webpage", "title": title, "author": [{"literal": "U.S. Environmental Protection Agency"}],
                    "issued": {"date-parts": [date_parts(updated)]}, "URL": link, "accessed": {"date-parts": [[2026, 11, 27]]}}
        out.append({"key": key, "kind": "web-page", "citation": citation, "original_link": link, "retrieved": TODAY, "rights": GOVERNMENT,
                    "jurisdictions": [{"level": "federal"}], "topics": [TOPIC], "access": {"open": True, "pull_from": ["free-web"]}, "found_in": [SESSION],
                    "notes": f"{about} Page last updated {long_date(updated)}. Read by {SCRIPT} (Unverified).",
                    "review": review("Read by script only")})
    return out


def records(args) -> None:
    work = Path(args.work)
    lists = json.loads((work / "lists.json").read_text(encoding="utf-8"))
    nations_of, unmatched, names = matcher()
    stored = copies()
    written = hearth_records(lists, nations_of, names, stored) + wqs_records(lists, nations_of, names, stored) + list_records(lists)
    for row in lists["treatment_as_a_state"]:
        nations_of(row["list_name"], "treatment as a state")
    for record in written:
        write(record)
    (work / "lists.json").write_text(json.dumps(lists, indent=1, ensure_ascii=False), encoding="utf-8")
    RESEARCH.mkdir(parents=True, exist_ok=True)
    with (RESEARCH / "hearth-act-approvals.csv").open("w", encoding="utf-8", newline="") as handle:
        out = csv.writer(handle)
        out.writerow(["approved", "list_name", "kinds", "nations", "record", "link"])
        for item in sorted(lists["hearth"], key=lambda item: (item["approved"], item["list_name"])):
            out.writerow([item["approved"], item["list_name"], item["kinds"], ";".join(nations_of(item["list_name"], "HEARTH")), item["record"], item["link"]])
    with (RESEARCH / "water-quality-standards.csv").open("w", encoding="utf-8", newline="") as handle:
        out = csv.writer(handle)
        out.writerow(["list_name", "nations", "epa_region", "found_eligible", "first_standards_approved", "documents", "records", "page"])
        for row in lists["water_quality_standards"]:
            out.writerow([row["list_name"], ";".join(nations_of(row["list_name"], "water quality standards")), row["region"], row["eligible"], row["first_approved"],
                          len(row["documents"]), ";".join(document.get("record", "") for document in row["documents"]), row["page"]])
    with (RESEARCH / "treatment-as-a-state.csv").open("w", encoding="utf-8", newline="") as handle:
        out = csv.writer(handle)
        out.writerow(["list_name", "nations", "column", "epa_words", "programs"])
        for row in lists["treatment_as_a_state"]:
            for column, words in row["columns"].items():
                found = [ADMINISTRATIVE] if column == "Administrative Functions" else programs_in(words)
                out.writerow([row["list_name"], ";".join(nations_of(row["list_name"], "treatment as a state")), column, words, ";".join(code for code, _ in found)])
    with (RESEARCH / "unmatched.csv").open("w", encoding="utf-8", newline="") as handle:
        out = csv.writer(handle)
        out.writerow(["list_name", "where_and_candidates"])
        for name, where in sorted(unmatched.items()):
            out.writerow([name, where])
    print(f"{len(written)} records; {len(unmatched)} list names not matched to one nation (research/approved-nation-laws/unmatched.csv)")


# ---------------------------------------------------------------- facts

def programs_in(words: str) -> list[tuple[str, str]]:
    found = []
    for part in re.split(r";|,(?![^()]*\))|\band\b(?=\s+(?:CAA|CWA|SDWA|TSCA|UIC|WQS|NPDES|PWSS))", words):
        for pattern, code, label in PROGRAMS:
            if re.search(pattern, part) and (code, label) not in found:
                found.append((code, label))
    return found


def facts(args) -> None:
    work = Path(args.work)
    lists = json.loads((work / "lists.json").read_text(encoding="utf-8"))
    nations_of, unmatched, _ = matcher()
    eligible = {}
    for row in lists["water_quality_standards"]:
        for nation in nations_of(row["list_name"], "water quality standards"):
            eligible[nation] = row
    batch = {"session": SESSION, "facts": [], "objects": [], "searches": []}
    seen = set()
    for item in lists["hearth"]:
        for nation in nations_of(item["list_name"], "HEARTH"):
            kinds = f" ({item['kinds']})" if item["kinds"] else ""
            fact = {"topic": "hearth-act-leasing-regulations", "value": "approved",
                    "detail": f"The Secretary of the Interior approved the leasing regulations{kinds} of the {item['list_name']}, as the Bureau of Indian Affairs' list names it, under the HEARTH Act, 25 U.S.C. § 415(h), on {long_date(item['approved'])}, so the nation can lease its trust land for those purposes under its own regulations without the Bureau of Indian Affairs approving each lease.",
                    "source": item["record"], "confidence": "high", "verification": "inferred", "as_of": item["approved"],
                    "locator": f"Bureau of Indian Affairs, Approved HEARTH Act Regulations, {item['year_heading']}"}
            batch["facts"].append({"profile": nation, "key": "jurisdiction", "fact": fact})
    for row in lists["treatment_as_a_state"]:
        for nation in nations_of(row["list_name"], "treatment as a state"):
            for column, words in row["columns"].items():
                found = [ADMINISTRATIVE] if column == "Administrative Functions" else programs_in(words)
                for code, label in found:
                    if (nation, code) in seen:
                        continue
                    seen.add((nation, code))
                    as_of = lists["updated"]["treatment_as_a_state"]
                    detail = f"EPA has approved the nation for treatment in a similar manner as a state for {label[0].lower() + label[1:]}."
                    if code == ADMINISTRATIVE[0]:
                        detail = f"EPA has approved the nation for treatment in a similar manner as a state to perform administrative functions under the Clean Air Act: {re.sub(r'^CAA ', '', words)}."
                    elif "(" in words and not re.fullmatch(r"[^()]*\([A-Z]+\)[^()]*", words) and code != "clean-water-act-water-quality-standards":
                        detail += f" EPA's table: \"{words}\"."
                    if "not authorized" in words:
                        detail += f" EPA's table adds: \"{re.search(r'\(([^)]*not authorized[^)]*)\)', words).group(1)}\"."
                    if code == "clean-water-act-water-quality-standards" and nation in eligible and re.match(r"\d{4}-\d\d-\d\d", eligible[nation]["eligible"]):
                        as_of = eligible[nation]["eligible"][:10]
                        detail = f"EPA found the nation eligible on {long_date(as_of)} to set water quality standards (treatment in a similar manner as a state under Clean Water Act § 518)"
                        detail += f", and first approved its standards on {long_date(eligible[nation]['first_approved'])}." if re.match(r"\d{4}-\d\d-\d\d", eligible[nation]["first_approved"]) else "; EPA's list gives no date of approved standards of the nation's own."
                    fact = {"topic": "environmental-treatment-as-a-state", "value": code, "detail": detail,
                            "source": "epa-actions-on-tribal-water-quality-standards" if as_of != lists["updated"]["treatment_as_a_state"] else "epa-tribes-approved-for-treatment-as-a-state",
                            "confidence": "high", "verification": "inferred", "as_of": as_of,
                            "locator": f"Table of approvals by Tribe, column \"{column}\": \"{words}\""}
                    batch["facts"].append({"profile": nation, "key": "jurisdiction", "fact": fact})
    BATCH.parent.mkdir(parents=True, exist_ok=True)
    BATCH.write_text(json.dumps(batch, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"{len(batch['facts'])} facts for {len({entry['profile'] for entry in batch['facts']})} nations in {BATCH.relative_to(ROOT)}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    for name in ("fetch", "file", "records", "facts"):
        command = sub.add_parser(name)
        command.add_argument("--work", required=True)
        if name == "file":
            command.add_argument("--captures", default="/mnt/project-files/research/captures")
    args = parser.parse_args()
    {"fetch": fetch, "file": file, "records": records, "facts": facts}[args.command](args)


if __name__ == "__main__":
    main()
