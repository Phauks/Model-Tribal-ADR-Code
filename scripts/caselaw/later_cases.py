#!/usr/bin/env python3
"""List the later cases that treated a case negatively, by kind of treatment, on its record.

Trevor, Nov. 27, 2026: a case's Treatment should name the cases, not count
them ("Later courts have declined to extend it twice and distinguished it six
times"). The names come from the hand-pulled Westlaw prints in the private
captures (bucket key westlaw/...): each print ends with an appended
"Negative Treatment" list that names every negative citing reference, with
its kind ("Declined to Extend by", "Distinguished by"), title, citation,
court and date. Only those facts are read. The publisher's summaries
(headnotes) beside each entry are never copied.

For each entry the script writes an Indigo Book citation and where it can be
read:

1. `case`: the key of a case record this project holds, matched by citation
   (the case page, /cases/<key>);
2. `copy`: the key of an opinion copy this site serves, matched by the
   Caselaw Access Project's path (/copies/view/<key>);
3. `link`: the case on case.law, when the Caselaw Access Project has it;
4. none: the citation is shown as plain text.

The Caselaw Access Project's metadata (static.case.law) also gives the
reporter's case name, the court's abbreviation and the docket number. A
Supreme Court decision cited to the Supreme Court Reporter is cited to the
United States Reports when the Supreme Court Database or the Court's own
preliminary prints give the page.

"Overruling Risk" entries are left out: Westlaw lists there the decisions
that undercut authority the case relied on, not later treatment of the case.

The list goes on the record as `case_box.later_cases` (schemas/source.schema.json),
which the case page, the essays and the print book show under Treatment
(site/src/lib/essays/record-boxes.ts, pdf/pipeline/record-boxes.mjs).

    python3 scripts/caselaw/later_cases.py --cache ~/caselaw-cache          # plan: prints what it would write
    python3 scripts/caselaw/later_cases.py --cache ~/caselaw-cache --apply  # write the records

Credentials for the private bucket come from the environment, as for
scripts/captures/mirror_captures.py (R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
CLOUDFLARE_ACCOUNT_ID).
"""

from __future__ import annotations

import argparse
import csv
import datetime
import io
import json
import os
import re
import sys
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
SOURCES = ROOT / "content" / "sources"
CAPTURE_INDEX = ROOT / "research" / "capture-index.csv"
CAP = "https://static.case.law"
CASE_LAW_VIEWER = "https://case.law/caselaw/"
SCDB = "http://scdb.wustl.edu/_brickFiles"
SCDB_FILES = ["2026_01/SCDB_2026_01_caseCentered_Citation", "Legacy_07/SCDB_Legacy_07_caseCentered_Citation"]
COPY_TOPICS = {"caselaw-access-project", "state-court-opinions", "federal-court-opinions"}

# Hand-pulled Westlaw items that are not case prints.
NOT_PRINTS = ("westlaw/blacks-law-dictionary-12/",)
PULL_BATCH = 20

# Supreme Court decisions the Supreme Court Database (through the October 2024
# Term) does not yet give a United States Reports page for, read from the
# Court's preliminary prints (supremecourt.gov/opinions/USReports.aspx).
UNITED_STATES_REPORTS = {
    "140 S. Ct. 1649": "590 U.S. 448",  # preliminary print, vol. 590 part 2, table of cases, p. 448
    "142 S. Ct. 2486": "597 U.S. 629",  # the project's record, content/sources/o/oklahoma-v-castro-huerta.yaml
}

# Westlaw's long titles, shortened as the Indigo Book's case names are (the parties' names only).
NAMES = {
    "Alliance to Save the Mattaponi v. Commonwealth, Dept. of Environmental Quality ex rel. State Water Control Bd.": "Alliance to Save the Mattaponi v. Commonwealth",
    "Oneida Indian Nation of New York v. Madison County, Oneida County, N.Y.": "Oneida Indian Nation of New York v. Madison County",
    "Oneida Tribe of Indians of Wis. v. Village of Hobart, Wis.": "Oneida Tribe of Indians of Wisconsin v. Village of Hobart",
    "U.S. v. State of Tex.": "United States v. Texas",
}

# The kinds of treatment, most serious first, as the page shows them.
KINDS = [
    ("Overruling Recognized by", "Overruling recognized"),
    ("Abrogation Recognized by", "Abrogation recognized"),
    ("Superseded by Statute as Stated in", "Superseded by statute"),
    ("Called into Doubt by Statute as Stated in", "Called into doubt by statute"),
    ("Called into Doubt by", "Called into doubt"),
    ("Limitation of Holding Recognized by", "Limitation of holding recognized"),
    ("Modification Recognized by", "Modification recognized"),
    ("Declined to Follow by", "Declined to follow"),
    ("Not Followed as Dicta", "Not followed as dicta"),
    ("Disagreement Recognized by", "Disagreement recognized"),
    ("Declined to Extend by", "Declined to extend"),
    ("Followed with Reservations by", "Followed with reservations"),
    ("Distinguished by", "Distinguished"),
]
KIND_NAMES = dict(KINDS)
KIND_ORDER = {shown: index for index, (_, shown) in enumerate(KINDS)}

# ---------------------------------------------------------------- reading the prints

NOISE = re.compile(r"^(.+\s\d{1,2}/\d{1,2}/\d{2,4}$|For Educational Use Only|.*Thomson Reuters|Treatment Title Date Type Depth|Treatment Referenced Title|The KeyCited document|proceedings:|litigation or proceedings)")
MONTHS = "Jan|Feb|Mar|Apr|May|June|July|Aug|Sept|Sep|Oct|Nov|Dec"
DATE = rf"(?:{MONTHS})[a-z]*\.? \d{{1,2}},\s*\d{{4}}"
TYPES = r"(Case|Statute|Administrative Decision|Trial Court Order|Regulation)"
LABEL = re.compile(r"(Declined to (?:Extend|Follow)|Distinguished|Disagreement Recognized|Disagreed With|Called into Doubt|Followed with Reservations|Superseded|Overruling|Overruled|Abrogation Recognized|Abrogated|Not Followed|Limitation of Holding|Modification Recognized|Holding Limited|Questioned|Criticized)")
NUMBERED = re.compile(r"^(.*?)\s*(\d+)\.\s+(.*)$")


def print_text(path: Path) -> str:
    if path.suffix == ".txt":
        return path.read_text(encoding="utf-8", errors="replace")
    import logging  # noqa: PLC0415
    import pypdf  # noqa: PLC0415
    logging.getLogger("pypdf").setLevel(logging.ERROR)
    return "\n".join(page.extract_text() or "" for page in pypdf.PdfReader(str(path)).pages)


def negative_entries(text: str) -> tuple[int, list[dict]]:
    """The 'Negative Citing References (N)' list: its stated count and its entries."""
    match = re.search(r"^Negative Citing References \((\d+)\)\n(.*?)(?=^Overruling Risk \(\d+\)\n|^Table of Authorities|^History \(|\Z)", text, re.S | re.M)
    if not match:
        return 0, []
    lines = [line.strip() for line in match.group(2).split("\n")]
    lines = [line for line in lines if line and not NOISE.match(line)]
    entries: list[dict] = []
    before: list[str] = []
    current: dict | None = None
    stage = "between"
    for line in lines:
        numbered = NUMBERED.match(line)
        if numbered and stage == "between" and int(numbered.group(2)) == len(entries) + 1:
            if numbered.group(1):
                before.append(numbered.group(1))
            joined = " ".join(before)
            starts = list(LABEL.finditer(joined))
            label = joined[starts[-1].start():].strip() if starts else joined.strip()
            current = {"label": label, "title": [numbered.group(3)], "cite": None, "rest": []}
            entries.append(current)
            before, stage = [], "title"
            continue
        if stage == "title":
            if " , " in line or re.match(r"^\d{4} WL \d+", line):
                current["cite"], stage = line, "rest"
            else:
                current["title"].append(line)
            continue
        if stage == "rest":
            current["rest"].append(line)
            if re.search(rf"(^|\s){TYPES}(\s+(—.*|\d+))?$", line):
                stage = "between"
            continue
        before.append(line)
    for entry in entries:
        entry["title"] = re.sub(r"\s+", " ", " ".join(entry["title"])).strip()
        rest = " ".join(entry.pop("rest"))
        dated = re.findall(rf"({DATE})\s+{TYPES}", rest)
        entry["date"] = dated[-1][0] if dated else (re.findall(DATE, rest) or [None])[-1]
        kinds = re.findall(TYPES, rest)
        entry["type"] = kinds[-1] if kinds else ""
    return int(match.group(1)), entries


def parse_date(text: str) -> datetime.date:
    text = re.sub(r"\s+", " ", text).replace("Sept", "Sep")
    month, day, year = re.match(r"([A-Za-z]+)\.? (\d+), (\d{4})", text).groups()
    return datetime.datetime.strptime(f"{month[:3]} {day} {year}", "%b %d %Y").date()


# ---------------------------------------------------------------- citations

REPORTER_FORMS = [
    (r"S\.Ct\.", "S. Ct."), (r"L\.Ed\.2d", "L. Ed. 2d"), (r"F\.Supp\.3d", "F. Supp. 3d"), (r"F\.Supp\.2d", "F. Supp. 2d"),
    (r"F\.Supp\.", "F. Supp."), (r"Fed\.Cl\.", "Fed. Cl."), (r"So\.3d", "So. 3d"), (r"So\.2d", "So. 2d"),
    (r"Cal\.Rptr\.3d", "Cal. Rptr. 3d"), (r"Cal\.Rptr\.2d", "Cal. Rptr. 2d"), (r"NLRB", "N.L.R.B."),
]

BLUEBOOK_MONTHS = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."]

STATES = {
    "Ark.": "Ark.", "Colo.": "Colo.", "Del.": "Del.", "Iowa": "Iowa", "Kan.": "Kan.", "Ky.": "Ky.", "La.": "La.", "Miss.": "Miss.", "Mo.": "Mo.",
    "Ohio": "Ohio", "Pa.": "Pa.", "Tenn.": "Tenn.", "Vt.": "Vt.", "W.Va.": "W. Va.", "Ala.": "Ala.", "Alaska": "Alaska", "Ariz.": "Ariz.", "Cal.": "Cal.", "Conn.": "Conn.", "Fla.": "Fla.", "Ga.": "Ga.", "Hawai'i": "Haw.",
    "Idaho": "Idaho", "Ill.": "Ill.", "Ind.": "Ind.", "Mass.": "Mass.", "Md.": "Md.", "Me.": "Me.", "Mich.": "Mich.", "Minn.": "Minn.",
    "Mont.": "Mont.", "N.C.": "N.C.", "N.D.": "N.D.", "N.H.": "N.H.", "N.J.": "N.J.", "N.M.": "N.M.", "N.Y.": "N.Y.", "Neb.": "Neb.",
    "Nev.": "Nev.", "Okla.": "Okla.", "Or.": "Or.", "R.I.": "R.I.", "S.C.": "S.C.", "S.D.": "S.D.", "Tex.": "Tex.", "Utah": "Utah",
    "D.C.": "D.C.", "Va.": "Va.", "Wash.": "Wash.", "Wis.": "Wis.", "Wyo.": "Wyo.", "Puerto Rico": "P.R.", "Virgin Islands": "V.I.", "Guam": "Guam",
}

# Westlaw's court names, as the Indigo Book abbreviates them. "" is the Supreme Court of the United States.
COURTS = {
    "8th Cir.BAP": "B.A.P. 8th Cir.", "D.C.Cir.": "D.C. Cir.", "Fed.Cir.": "Fed. Cir.", "Fed.Cl.": "Fed. Cl.", "Ct.Cl.": "Ct. Cl.",
    "Va.": "Va.", "Ariz.": "Ariz.", "Alaska": "Alaska", "Wyo.": "Wyo.", "Idaho": "Idaho", "Okla.": "Okla.", "N.C.": "N.C.", "Ala.": "Ala.",
    "Okla.Crim.App.": "Okla. Crim. App.", "Miss.App.": "Miss. Ct. App.", "Wis.App.": "Wis. Ct. App.", "Mich.App.": "Mich. Ct. App.",
    "N.Y.Co.Ct.": "N.Y. Cnty. Ct.", "N.J.Super.L.": "N.J. Super. Ct. Law Div.", "WASC": "Sup. Ct. W. Austl.",
    "Nev. Inter-Tribal C.A.": "Nev. Inter-Tribal Ct. App.", "N.L.R.B.": "N.L.R.B.",
}


def reporter_cite(text: str) -> str:
    for pattern, replacement in REPORTER_FORMS:
        text = re.sub(pattern, replacement, text)
    return re.sub(r"\s+", " ", text).strip()


def court_name(westlaw: str) -> str:
    court = re.sub(r"\s+", " ", westlaw).strip()
    if court.startswith("U.S."):
        return ""
    court = re.sub(r" ?\([^)]*\)$", "", court)
    if court in COURTS:
        return COURTS[court]
    circuit = re.match(r"^(\d+)(?:st|nd|rd|th) Cir\.", court)
    if circuit:
        number = int(circuit.group(1))
        suffix = {1: "st", 2: "d", 3: "d"}.get(number, "th")
        return f"{number}{suffix} Cir."
    appeal = re.match(r"^(Cal|La|Fla|Ohio|Ill)\.? ?App\.", court)
    if appeal:
        return {"Cal": "Cal. Ct. App.", "La": "La. Ct. App.", "Fla": "Fla. Dist. Ct. App.", "Ohio": "Ohio Ct. App.", "Ill": "Ill. App. Ct."}[appeal.group(1)]
    district = re.match(r"^([NSEWMC]\.D\.|D\.)(.+)$", court)
    if district and district.group(2) in STATES:
        state = STATES[district.group(2)]
        spaced = not re.fullmatch(r"(?:[A-Z]\.)+", state)
        return f"{district.group(1)}{' ' if spaced else ''}{state}"
    raise ValueError(f"no abbreviation for the court {westlaw!r}")


def cite_key(cite: str) -> str:
    return re.sub(r"[\s.,]", "", cite or "").lower()


def bluebook_date(day: datetime.date) -> str:
    return f"{BLUEBOOK_MONTHS[day.month - 1]} {day.day}, {day.year}"


def tidy_name(name: str) -> str:
    name = re.sub(r"\s+", " ", name).strip().rstrip(",")
    name = NAMES.get(name, name)
    name = re.sub(r"^U\. ?S\. v\.", "United States v.", name)
    name = re.sub(r"\bv\. U\. ?S\.$", "v. United States", name)
    name = re.sub(r"^Commonwealth of Puerto Rico v\.", "Puerto Rico v.", name)
    return name


# ---------------------------------------------------------------- where each case can be read

def fetch(url: str, path: Path) -> Path:
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        request = urllib.request.Request(url, headers={"User-Agent": "tribal-law-project later_cases.py"})
        with urllib.request.urlopen(request, timeout=120) as response:
            path.write_bytes(response.read())
    return path


class CaselawAccessProject:
    """The Project's metadata by reporter and volume, cached."""

    def __init__(self, cache: Path) -> None:
        self.cache = cache / "cap-metadata"
        reporters = json.loads(fetch(f"{CAP}/ReportersMetadata.json", self.cache / "ReportersMetadata.json").read_text())
        self.slugs: dict[str, list[str]] = {}
        for reporter in reporters:
            self.slugs.setdefault(cite_key(reporter["short_name"]), []).append(reporter["slug"])
        self.volumes: dict[str, list[dict] | None] = {}

    def volume(self, slug: str, number: str) -> list[dict]:
        name = f"{slug}/{number}"
        if name not in self.volumes:
            path = self.cache / slug / f"{number}.json"
            try:
                fetch(f"{CAP}/{slug}/{number}/CasesMetadata.json", path)
                self.volumes[name] = json.loads(path.read_text())
            except Exception:  # noqa: BLE001 - a volume the Project does not have
                self.volumes[name] = []
        return self.volumes[name] or []

    def find(self, cite: str) -> tuple[str, str, dict] | None:
        """(reporter slug, volume, case metadata) for a reporter citation."""
        match = re.match(r"^(\d+) (.+?) (\d+)$", cite)
        if not match:
            return None
        volume, reporter, page = match.groups()
        for slug in self.slugs.get(cite_key(reporter), []):
            for case in self.volume(slug, volume):
                if any(cite_key(c["cite"]) == cite_key(cite) for c in case.get("citations", [])):
                    return slug, volume, case
        return None


class SupremeCourtDatabase:
    """Supreme Court Reporter pages to United States Reports pages."""

    def __init__(self, cache: Path) -> None:
        self.reports: dict[str, str] = dict(UNITED_STATES_REPORTS)
        for name in SCDB_FILES:
            archive = fetch(f"{SCDB}/{name}.csv.zip", cache / "scdb" / (Path(name).name + ".csv.zip"))
            with zipfile.ZipFile(archive) as handle:
                with handle.open(handle.namelist()[0]) as raw:
                    for row in csv.DictReader(io.TextIOWrapper(raw, encoding="latin-1")):
                        if row.get("sctCite") and row.get("usCite"):
                            self.reports.setdefault(row["sctCite"], row["usCite"])

    def united_states(self, cite: str) -> str | None:
        return self.reports.get(cite)


# Reporter names some records spell out.
REPORTER_ALIASES = {"United States Reports": "U.S."}

CAP_LINK = re.compile(r"static\.case\.law/([^/]+)/([^/]+)/(?:html|cases)/([^/.]+)\.(?:html|json)")


TITLES: dict[str, str] = {}


def held_cases() -> tuple[dict[str, str], dict[str, str]]:
    """This project's case records by citation and by the Caselaw Access Project's path, as scripts/caselaw/copy_links.py finds them."""
    by_cite: dict[str, str] = {}
    by_path: dict[str, str] = {}
    for path in sorted(SOURCES.glob("*/*.yaml")):
        text = path.read_text(encoding="utf-8")
        if "legal_case" not in text:
            continue
        record = yaml.safe_load(text) or {}
        citation = record.get("citation") or {}
        if citation.get("type") != "legal_case" or not citation.get("title"):
            continue
        TITLES[record["key"]] = citation["title"]
        cites = []
        if citation.get("volume") and citation.get("container-title") and citation.get("page"):
            reporter = REPORTER_ALIASES.get(citation["container-title"], citation["container-title"])
            cites.append(f"{citation['volume']} {reporter} {citation['page']}")
        published = re.match(r"Published at (.+?)\. Decided by", str(record.get("notes") or ""))
        if published:
            cites += [cite.strip() for cite in published.group(1).split(";")]
        if (record.get("courtlistener") or {}).get("citation"):
            cites.append(record["courtlistener"]["citation"])
        for cite in cites:
            by_cite.setdefault(cite_key(cite), record["key"])
        for url in (record.get("original_link") or "", citation.get("URL") or ""):
            match = CAP_LINK.search(url)
            if match:
                by_path.setdefault("/".join(match.groups()), record["key"])
    return by_cite, by_path


def served_copies() -> dict[str, str]:
    """The opinion copies this site serves, by the Caselaw Access Project's path (reporter/volume/case)."""
    found: dict[str, str] = {}
    with CAPTURE_INDEX.open(encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            if row["topic"] not in COPY_TOPICS or row["media_type"] != "text/html" or row["redistribution"] != "yes":
                continue
            parts = row["key"].removesuffix(".html").split("/")
            if len(parts) == 4:
                found.setdefault("/".join(parts[1:]), row["key"])
    return found


# ---------------------------------------------------------------- one entry

def resolve(entry: dict, project: CaselawAccessProject, court: SupremeCourtDatabase, held: tuple[dict[str, str], dict[str, str]], copies: dict[str, str]) -> dict:
    cite_text, _, court_text = entry["cite"].partition(" , ")
    cite = reporter_cite(cite_text)
    day = parse_date(entry["date"])
    westlaw_court = court_text.strip()
    if westlaw_court.startswith("U.S."):
        westlaw_court = "U.S."
    if entry["type"] == "Administrative Decision":
        westlaw_court = "N.L.R.B."
    abbreviation = court_name(westlaw_court)
    unreported = " WL " in f" {cite} " or cite.startswith("---")
    name = tidy_name(entry["title"])
    reporter_page = cite
    if westlaw_court == "U.S." and " S. Ct. " in cite:
        cite = court.united_states(cite) or cite
    found = None if unreported else (project.find(cite) or (project.find(reporter_page) if reporter_page != cite else None))
    out: dict = {"treatment": KIND_NAMES[entry["label"]]}
    docket = None
    if found:
        slug, volume, case = found
        docket = case.get("docket_number")
        path = f"{slug}/{volume}/{case['file_name']}"
        if path in held[1]:
            out["case"] = held[1][path]
        elif path in copies:
            out["copy"] = copies[path]
        else:
            out["link"] = CASE_LAW_VIEWER + "?" + urllib.parse.urlencode({"reporter": slug, "volume": volume, "case": case["file_name"]})
    for candidate in (cite, reporter_page):
        if cite_key(candidate) in held[0]:
            out.pop("copy", None)
            out.pop("link", None)
            out["case"] = held[0][cite_key(candidate)]
    if False:
        out.pop("copy", None)
        out.pop("link", None)
        out["case"] = held[0][cite_key(cite)]
    if entry["type"] == "Administrative Decision":
        citation = f"{cite} ({day.year})"
    elif cite.startswith("---"):
        reporter = re.sub(r"-+", "", cite).strip()
        citation = f"___ {reporter} ___ ({abbreviation} {bluebook_date(day)})".replace("( ", "(")
    elif unreported:
        citation = f"{cite} ({abbreviation} {bluebook_date(day)})".replace("( ", "(")
    else:
        citation = f"{cite} ({abbreviation + ' ' if abbreviation else ''}{day.year})"
    if unreported and docket:
        citation = f"No. {docket}, {citation}"
    where = {k: out[k] for k in ("case", "copy", "link") if k in out}
    return {"treatment": out["treatment"], "name": TITLES.get(out.get("case"), name), "citation": citation, **where, "decided": day.isoformat()}


def sort_key(item: dict) -> tuple:
    return (KIND_ORDER[item["treatment"]], item["decided"], item["name"])


# ---------------------------------------------------------------- records

def later_cases_yaml(block: dict) -> str:
    dumped = yaml.safe_dump({"later_cases": block}, sort_keys=False, allow_unicode=True, width=10_000)
    return "".join("  " + line + "\n" if line.strip() else line + "\n" for line in dumped.splitlines())


def write_record(path: Path, block: dict) -> None:
    text = path.read_text(encoding="utf-8")
    lines = text.split("\n")
    addition = later_cases_yaml(block).rstrip("\n").split("\n")
    start = next((index for index, line in enumerate(lines) if line == "case_box:"), None)
    if start is None:
        at = next((index for index, line in enumerate(lines) if line.startswith("subjects:")), len(lines) - (1 if lines[-1] == "" else 0))
        lines[at:at] = ["case_box:", *addition]
    else:
        end = next((index for index in range(start + 1, len(lines)) if lines[index] and not lines[index].startswith(" ")), len(lines))
        while end > start + 1 and not lines[end - 1].strip():
            end -= 1
        # An earlier run's list is replaced.
        old = next((index for index in range(start + 1, end) if lines[index] == "  later_cases:"), None)
        if old is not None:
            stop = next((index for index in range(old + 1, end) if re.match(r"^  \S", lines[index])), end)
            del lines[old:stop]
            end -= stop - old
        lines[end:end] = addition
    path.write_text("\n".join(lines), encoding="utf-8")


def bucket_client():
    import boto3  # noqa: PLC0415
    account = os.environ.get("R2_ACCOUNT_ID") or os.environ.get("CLOUDFLARE_ACCOUNT_ID")
    return boto3.client("s3", endpoint_url=f"https://{account}.r2.cloudflarestorage.com",
                        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"], aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"], region_name="auto")


def indexed_prints() -> list[str]:
    """The hand-pulled Westlaw prints in the capture index (PDF or text)."""
    with CAPTURE_INDEX.open(encoding="utf-8", newline="") as handle:
        return [row["key"] for row in csv.DictReader(handle)
                if row["key"].startswith("westlaw/") and not row["key"].startswith(NOT_PRINTS) and row["key"].endswith((".pdf", ".txt"))]


def printed_citations(text: str) -> list[str]:
    """The case's citations from the print's "All Citations:" line."""
    match = re.search(r"^All Citations: (.+?)\n(?:Search Details|Goldsmith|.*\d{1,2}/\d{1,2}/\d{2,4}$)", text, re.M | re.S)
    if not match:
        return []
    return [reporter_cite(part) for part in re.sub(r"\s+", " ", match.group(1)).split(", ")]


def delivered_on(text: str) -> datetime.date | None:
    match = re.search(r"(\d{1,2})/(\d{1,2})/(\d{2,4})\s*\nFor Educational Use Only", text)
    if not match:
        return None
    month, day, year = (int(part) for part in match.groups())
    return datetime.date(year + 2000 if year < 100 else year, month, day)


def write_pull_list(path: Path, done: set[str], held: tuple[dict[str, str], dict[str, str]]) -> None:
    """The case records still waiting for a print with its Negative Treatment list, boxed cases first, then the Supreme Court's, in batches."""
    boxed, supreme = [], []
    for record_path in sorted(SOURCES.glob("*/*.yaml")):
        text = record_path.read_text(encoding="utf-8")
        if "legal_case" not in text or ("\ncase_box:" not in text and "\nsupreme_court:" not in text):
            continue
        record = yaml.safe_load(text) or {}
        citation = record.get("citation") or {}
        if record["key"] in done or citation.get("type") != "legal_case" or not citation.get("title"):
            continue
        if (record.get("citator") or {}).get("result") == "no-negative-treatment":
            continue
        reporter = REPORTER_ALIASES.get(citation.get("container-title", ""), citation.get("container-title", ""))
        cite = f"{citation.get('volume', '')} {reporter} {citation.get('page', '')}".strip()
        if not (citation.get("volume") and citation.get("page")):
            continue
        (boxed if record.get("case_box") else supreme).append((citation["title"], cite))
    lines = [
        "# Westlaw prints with Negative Treatment, still to pull",
        "",
        f"Written by `scripts/caselaw/later_cases.py --pull-list` on {datetime.date.today():%b. %-d, %Y}. Each batch is one paste into Westlaw's find-by-citation box. Deliver each case as a PDF with the Negative Treatment list appended, then upload the files on the Intake page. The script matches each print to its record by the citations on its first page.",
        "",
        f"Cases with a box in the essays: {len(boxed)}. Other Supreme Court cases: {len(supreme)}.",
    ]
    for heading, cases in (("Cases with a box in the essays", boxed), ("Supreme Court cases", supreme)):
        for start in range(0, len(cases), PULL_BATCH):
            batch = cases[start:start + PULL_BATCH]
            lines += ["", f"## {heading}, batch {start // PULL_BATCH + 1}", "", "Citations to paste:", "", "```", *[cite for _, cite in batch], "```", "", "Cases:", ""]
            lines += [f"- *{title}*, {cite}" for title, cite in batch]
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"\nWrote {path}: {len(boxed)} boxed cases, {len(supreme)} Supreme Court cases.")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--cache", type=Path, default=Path.home() / "caselaw-cache")
    parser.add_argument("--apply", action="store_true", help="write the lists into the records")
    parser.add_argument("--folder", type=Path, help="also read the prints in this folder (new downloads not yet filed)")
    parser.add_argument("--pull-list", type=Path, help="write the list of cases still waiting for a print to this Markdown file")
    parser.add_argument("--bucket", default=os.environ.get("R2_BUCKET", "tribal-law-project-files"))
    args = parser.parse_args()
    project = CaselawAccessProject(args.cache)
    court = SupremeCourtDatabase(args.cache)
    held, copies = held_cases(), served_copies()
    client = None
    prints: list[tuple[str, Path]] = []
    for bucket_key in indexed_prints():
        local = args.cache / "prints" / bucket_key
        if not local.exists():
            client = client or bucket_client()
            local.parent.mkdir(parents=True, exist_ok=True)
            client.download_file(args.bucket, bucket_key, str(local))
        prints.append((bucket_key, local))
    if args.folder:
        prints += [(f"(not filed) {path.name}", path) for path in sorted(args.folder.iterdir()) if path.suffix.lower() in (".pdf", ".txt")]
    problems = 0
    done: set[str] = set()
    for source, local in prints:
        text = print_text(local)
        if "Negative Citing References" not in text:
            continue
        key = next((held[0][cite_key(cite)] for cite in printed_citations(text) if cite_key(cite) in held[0]), None)
        record_path = next(SOURCES.glob(f"*/{key}.yaml"), None) if key else None
        if record_path is None:
            print(f"{source}: no case record has the citations {printed_citations(text)}; skipped")
            problems += 1
            continue
        stated, entries = negative_entries(text)
        if len(entries) != stated:
            print(f"{source}: the print lists {stated} negative citing references, {len(entries)} were read; skipped")
            problems += 1
            continue
        if source.startswith("(not filed)"):
            print(f"{source}: matched {key}; file it (Intake page) before writing its list")
            continue
        done.add(key)
        checked = delivered_on(text)
        listed = sorted((resolve(entry, project, court, held, copies) for entry in entries), key=sort_key)
        block = {"checked": checked, "source": source, "list": [{k: v for k, v in item.items() if k != "decided"} for item in listed]}
        print(f"\n{key} ({len(listed)}, read {checked})")
        for item in listed:
            where = f"/cases/{item['case']}" if "case" in item else f"/copies/view/{item['copy']}" if "copy" in item else item.get("link", "(text)")
            print(f"  {item['treatment']:<34} {item['name']}, {item['citation']}  ->  {where}")
        if args.apply:
            write_record(record_path, block)
    if args.pull_list:
        write_pull_list(args.pull_list, done, held)
    if problems:
        sys.exit(1)


if __name__ == "__main__":
    main()
