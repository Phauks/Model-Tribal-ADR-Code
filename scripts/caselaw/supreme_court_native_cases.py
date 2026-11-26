#!/usr/bin/env python3
"""Write a source record for every Supreme Court case involving Native nations or people.

The list of cases is research/supreme-court-coverage/native-cases-scdb.csv
(research/analyses/2026-11-24-supreme-court-native-cases-coverage.md). For each
case in it that has no source record yet, the script builds the record's
"tier 1" facts from free sources, compares them across those sources, and
writes content/sources/<letter>/<key>.yaml:

- citation and decision date: the Supreme Court Database (Washington
  University in St. Louis), the 2026_01 release for 1946 on and Legacy_07
  before, joined to the Caselaw Access Project's volume files by the
  "SCDB yyyy-nnn" citation the Project gives each case;
- caption, opinions (kind, writer and first page) and the printed dates
  ("Argued ... Decided ..."): the Caselaw Access Project's text of the
  United States Reports, checked against the text layer of the Library of
  Congress scan of the same pages, a separate reading of the printed report;
- the bench (`supreme_court`): Oyez where it has the votes, the Database's
  justice-centered file where it does not, each checked against the other
  and against the opinion writers;
- reading links, and the nations named in the caption (`nations_in_case`),
  matched to nation records only where a name matches one nation; other
  names go under not_linked for a person to settle.

Each record gets a `review` block listing the cross-checks and their results.
Where the sources disagree, the official report settles it (official_report.py):
the scan's pages are mapped to the report's printed pages, the opinion
headings, caption and date line are looked for on those pages (in the scan's
text layer, then in a fresh OCR of the page image), and a check the report
bears out becomes "confirmed", with the words it prints. Facts no script can
read are read from the page images into research/supreme-court-coverage/
report-readings.json, each with the lines it rests on; a reading counts only
when every one of its lines is found on its printed page. Where the Library
of Congress has no scan under a case's citation, or its scan can't be read for
a fact, research/supreme-court-coverage/other-scans.json names another copy of
the printed report (a lettered Library of Congress scan, the scan of an
earlier case that holds the pages, or the Internet Archive's scan of the
volume) and the page it starts on. The status stays
"unverified" unless every check agreed or was confirmed; even then it means
the sources and the report agree, not that a person has read the record. A
record whose review status a person has changed, or that has no review block,
is never written over.

Outputs research/reviews/2026-11-24-supreme-court-native-cases.csv (one row
per case, each check's result) and, with --disagreements FILE, a JSON list of
the cases where sources disagree, for a reader to settle.

Run from the repository root:

    python3 scripts/caselaw/supreme_court_native_cases.py --cache ~/caselaw-cache \
        [--write] [--max-volume 542] [--only KEY ...] [--disagreements FILE]

The cache holds scdb/*.csv, cap-us/<volume>.zip and loc/<name>.pdf; files
missing from it are downloaded. Oyez answers are cached in oyez/.
"""

from __future__ import annotations

import argparse
import csv
import datetime
import difflib
import html as html_lib
import json
import re
import subprocess
import sys
import tempfile
import time
import unicodedata
import urllib.request
import zipfile
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent))
import official_report  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
SOURCES = ROOT / "content" / "sources"
TRIBES = ROOT / "content" / "tribes"
CASE_LIST = ROOT / "research" / "supreme-court-coverage" / "native-cases-scdb.csv"
# Where the sources disagreed, an AI reader read the scan for the disputed facts only; its readings, with the
# line each relies on, by Database case ID. The record keeps status "unverified": a reading is not a check.
SETTLED = ROOT / "research" / "supreme-court-coverage" / "settled.json"
# Lines read from the official report's page images where the scripts could not settle a fact, by Database case ID:
# each line, with its printed page, is checked against the report's text before it confirms anything.
READINGS = ROOT / "research" / "supreme-court-coverage" / "report-readings.json"
# Other copies of the official report, by citation, where the Library of Congress has no scan under the case's citation
# ("use": "scan") or its scan can't be read for a fact ("use": "second copy", for the checks named).
OTHER_SCANS_PATH = ROOT / "research" / "supreme-court-coverage" / "other-scans.json"
TODAY = datetime.date.today().isoformat()
REPORT = ROOT / "research" / "reviews" / f"{TODAY}-supreme-court-native-cases.csv"
SESSION = "2026-11-24-supreme-court-native-cases"
SCRIPT = "scripts/caselaw/supreme_court_native_cases.py"
SCDB = "http://scdb.wustl.edu/_brickFiles"
SCDB_FILES = {"modern": "2026_01/SCDB_2026_01_justiceCentered_Citation", "legacy": "Legacy_07/SCDB_Legacy_07_justiceCentered_Citation"}
OYEZ = "https://api.oyez.org"
USER_AGENT = "model-tribal-adr-code research script (Supreme Court case records)"

MONTHS = {m: i for i, m in enumerate(["january", "february", "march", "april", "may", "june", "july", "august",
                                       "september", "october", "november", "december"], 1)}

MONTH_ABBREVIATIONS = {name[:3]: number for name, number in MONTHS.items()}
DATES_TABLE = "https://www.supremecourt.gov/opinions/datesofdecisions.pdf"
DATES_TABLE_KEY = "supreme-court-library-dates-of-decisions-1791-1882"

# ---------------------------------------------------------------- small helpers


def plain(text: str) -> str:
    """Lower-case letters and digits only, accents and punctuation dropped, single spaces."""
    text = unicodedata.normalize("NFKD", text or "").encode("ascii", "ignore").decode()
    text = text.replace("&", " and ").replace("’", "'")
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def slug(text: str) -> str:
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode().lower()
    text = text.replace("&", " and ").replace("'", "").replace("’", "")
    return re.sub(r"[^a-z0-9]+", "-", text).strip("-")


def fetch(url: str, target: Path | None = None) -> bytes:
    command = ["curl", "-sSfL", "--retry", "3", "-A", USER_AGENT, url]
    if target:
        target.parent.mkdir(parents=True, exist_ok=True)
        part = target.with_suffix(target.suffix + ".part")
        subprocess.run(command + ["-o", str(part)], check=True)
        part.replace(target)
        return b""
    return subprocess.run(command, capture_output=True, check=True).stdout


# Short names the Caselaw Access Project abbreviates, written out as the report's running head gives them.
TITLE_FIXES = {
    "570 U.S. 1": "Arizona v. Inter Tribal Council of Arizona, Inc.",
    # The Caselaw Access Project joins the two captions of the consolidated cases.
    "492 U.S. 408": "Brendale v. Confederated Tribes and Bands of Yakima Indian Nation",
}


def end_stop(text: str) -> str:
    """Spaces evened and a closing full stop dropped, unless it ends an abbreviation ("Inc.", "Co.")."""
    text = re.sub(r"\s+", " ", text).strip()
    return text if re.search(r"\b(Inc|Co|Corp|Ltd|Jr|Sr|Bros|al)\.$", text) else text.rstrip(".")


SMALL_WORDS = {"of", "the", "and", "v", "in", "on", "for", "at", "to", "a", "an", "et", "al", "ex", "rel"}


def caption_case(text: str) -> str:
    """A caption printed in capitals put in title case ("SIOUX NATION OF INDIANS" -> "Sioux Nation of Indians"), so the nation phrases can be found."""
    letters = [c for c in text if c.isalpha()]
    if not letters or sum(c.isupper() for c in letters) < 0.6 * len(letters):
        return text
    words = re.split(r"(\s+)", text.lower())
    return "".join(w if w.isspace() or re.sub(r"\W", "", w) in SMALL_WORDS and i else w[:1].upper() + w[1:] for i, w in enumerate(words))


def mdy(text: str) -> str | None:
    match = re.match(r"(\d+)/(\d+)/(\d{4})", text or "")
    return f"{match[3]}-{int(match[1]):02d}-{int(match[2]):02d}" if match else None


def similarity(one: str, other: str) -> float:
    return difflib.SequenceMatcher(None, plain(one), plain(other), autojunk=False).ratio()


def contains_fuzzy(needle: str, haystack: str) -> float:
    """How well the needle's words appear as a run in the haystack (0 to 1), allowing OCR slips."""
    words, hay = plain(needle).split(), plain(haystack).split()
    if not words or not hay:
        return 0.0
    target = " ".join(words)
    best = 0.0
    size = len(words)
    first = set(words[:3])
    for start in range(len(hay)):
        if hay[start] not in first and start:
            continue
        window = " ".join(hay[start:start + size])
        best = max(best, difflib.SequenceMatcher(None, target, window, autojunk=False).ratio())
        if best > 0.97:
            break
    return best


# ---------------------------------------------------------------- the Justices


class Justices:
    """The Court's list (content/supreme-court/justices.yaml): who served when, by family name."""

    def __init__(self) -> None:
        data = yaml.safe_load((ROOT / "content" / "supreme-court" / "justices.yaml").read_text(encoding="utf-8"))
        self.list = data["justices"]

    @staticmethod
    def family(name: str) -> str:
        name = re.sub(r",?\s+(Jr\.|Sr\.|II|III)$", "", name.strip())
        return plain(name.split()[-1]) if name.split() else ""

    def serving(self, day: str) -> list[dict]:
        return [j for j in self.list if j["oath"] <= day and (j.get("left") or "9999") >= day]

    def named(self, family: str, day: str, initial: str = "") -> dict | None:
        family = plain(family).replace(" ", "")
        found = [j for j in self.serving(day) if self.family(j["name"]).replace(" ", "") == family]
        if len(found) > 1 and initial:
            found = [j for j in found if plain(j["name"]).startswith(initial.lower())]
        return found[0] if len(found) == 1 else None

    def from_scdb(self, code: str, day: str) -> dict | None:
        """"HLBlack", "JHarlan1", "JMcReynolds": the family name is the end of the code. The Database lists the
        bench of the term, so a Justice who joined or left within a few months of the day is taken too."""
        code = re.sub(r"\d+$", "", code)
        found = self._scdb(code, self.serving(day))
        if found:
            return found
        year = int(day[:4])
        near = [j for j in self.list if j["oath"][:4] <= str(year + 1) and (j.get("left") or "9999")[:4] >= str(year - 1)]
        return self._scdb(code, near)

    def _scdb(self, code: str, candidates: list[dict]) -> dict | None:
        for justice in candidates:
            family = self.family(justice["name"]).replace(" ", "")
            if family and plain(code).replace(" ", "").endswith(family):
                return justice
        return None

    def from_author(self, author: str, day: str) -> dict | None:
        """"Mr. Chief Justice Marshall", "Justice O'Connor,", "Me. Justice Van Devantee": the Justice, allowing for OCR slips."""
        text = re.sub(r"(?i)\b(mr|me|mb|chief|justice|justices|delivered|the|opinion|of|court|with|whom)\b", " ", author or "")
        text = text.replace("’", "'").replace("M'", "Mc")
        words = [plain(w).replace(" ", "") for w in re.findall(r"[^\W\d_][\w'-]*", text) if len(w) > 1][:4]
        best, best_score = None, 0.0
        for justice in self.serving(day):
            family = self.family(justice["name"]).replace(" ", "")
            for index, word in enumerate(words):
                for candidate in (word, word + (words[index + 1] if index + 1 < len(words) else "")):
                    score = difflib.SequenceMatcher(None, family, candidate).ratio()
                    if score > best_score:
                        best, best_score = justice, score
        return best if best_score >= 0.75 else None

    def natural_court(self, day: str) -> tuple[str, str]:
        """The Court named for its Chief Justice, and the natural court (the bench between changes) as "X Court (1958-1962)"."""
        chief = next(j for j in self.serving(day) if j["role"] == "Chief Justice") if any(
            j["role"] == "Chief Justice" for j in self.serving(day)) else None
        if chief is None:  # between Chief Justices: the last one's Court
            chief = max((j for j in self.list if j["role"] == "Chief Justice" and j["oath"] <= day), key=lambda j: j["oath"])
        court = f"{self.family(chief['name']).title()} Court"
        court = court.replace("Mc", "Mc")
        events = sorted({j["oath"] for j in self.list} | {j["left"] for j in self.list if j.get("left")})
        start = max(e for e in events if e <= day)
        later = [e for e in events if e > day]
        end = later[0][:4] if later else ""
        return court, f"{court} ({start[:4]}-{end})"


# ---------------------------------------------------------------- the Supreme Court Database


def load_scdb(cache: Path) -> dict[str, list[dict]]:
    """Every justice-centered row of both releases, by case ID."""
    rows: dict[str, list[dict]] = {}
    for name in SCDB_FILES.values():
        path = cache / "scdb" / (Path(name).name + ".csv")
        if not path.exists():
            archive = cache / "scdb" / (Path(name).name + ".csv.zip")
            fetch(f"{SCDB}/{name}.csv.zip", archive)
            with zipfile.ZipFile(archive) as handle:
                handle.extractall(cache / "scdb")
        with path.open(encoding="latin-1") as handle:
            for row in csv.DictReader(handle):
                rows.setdefault(row["caseId"], []).append(row)
    return rows


DECISION_TYPES = {"1": "majority opinion", "2": "per curiam", "4": "decree", "5": "equally divided Court",
                  "6": "per curiam", "7": "judgment of the Court", "8": "seriatim"}


def scdb_bench(rows: list[dict], day: str, justices: Justices) -> dict:
    """The bench as the Database records it: who sat, majority or minority, and the part each wrote."""
    first_docket = rows[0]["docketId"]
    rows = [r for r in rows if r["docketId"] == first_docket and r["caseIssuesId"] == rows[0]["caseIssuesId"]]
    writer = rows[0]["majOpinWriter"]
    decision = DECISION_TYPES.get(rows[0]["decisionType"], "unknown")
    members, unmatched, outside = [], [], []
    for row in rows:
        justice = justices.from_scdb(row["justiceName"], day)
        if justice is None:
            unmatched.append(row["justiceName"])
            continue
        if not (justice["oath"] <= day <= (justice.get("left") or "9999")):
            outside.append(justice["name"])
            continue
        vote = {"2": "majority", "1": "minority"}.get(row["majority"], "not recorded")
        entry = {"name": justice["name"], "vote": vote}
        if row["opinion"] in ("2", "3"):
            code = row["vote"]
            if code == "1" and row["justice"] == writer:
                entry["opinion"] = "plurality" if decision == "judgment of the Court" else "majority"
            elif code == "5":
                entry["opinion"] = "judgment"
            elif code == "3":
                entry["opinion"] = "concurrence"
            elif code == "4":
                entry["opinion"] = "special concurrence"
            elif code in ("2", "6", "7"):
                entry["opinion"] = "dissent"
            else:
                entry["opinion"] = "concurrence"
        members.append(entry)
    members.sort(key=lambda m: next((j["oath"] for j in justices.list if j["name"] == m["name"]), ""))
    chief = [m for m in members if next((j for j in justices.list if j["name"] == m["name"]), {}).get("role") == "Chief Justice"]
    members = chief + [m for m in members if m not in chief]
    count = lambda value: int(value) if value and value.isdigit() else None
    return {"decision_type": decision, "vote": {"majority": count(rows[0]["majVotes"]), "minority": count(rows[0]["minVotes"])},
            "justices": members, "unmatched": unmatched, "outside": outside, "writer_code": writer, "us_cite": rows[0].get("usCite", ""),
            "writers": {justices.from_scdb(r["justiceName"], day)["name"] for r in rows
                        if r["opinion"] in ("2", "3") and justices.from_scdb(r["justiceName"], day)}}


# ---------------------------------------------------------------- Oyez


class Oyez:
    def __init__(self, cache: Path) -> None:
        self.folder = cache / "oyez"
        self.folder.mkdir(parents=True, exist_ok=True)

    def get(self, url: str):
        path = self.folder / (re.sub(r"[^A-Za-z0-9]+", "_", url.replace(OYEZ, "")) + ".json")
        if path.exists():
            return json.loads(path.read_text())
        for attempt in range(4):
            try:
                request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
                with urllib.request.urlopen(request, timeout=60) as response:
                    data = json.load(response)
                path.write_text(json.dumps(data))
                time.sleep(0.2)
                return data
            except Exception:
                if attempt == 3:
                    return None
                time.sleep(2 ** attempt)
        return None

    def find(self, volume: str, page: str, year: int) -> dict | None:
        for term in (year - 1, year, year - 2, year + 1):
            for case in self.get(f"{OYEZ}/cases?filter=term:{term}&per_page=0") or []:
                citation = case.get("citation") or {}
                if str(citation.get("volume")) == volume and str(citation.get("page")) == page:
                    return case
        return None

    def bench(self, case: dict) -> dict | None:
        data = self.get(case["href"])
        if not data:
            return None
        decisions = data.get("decisions") or []
        heard = data.get("heard_by") or data.get("decided_by") or []
        heard = [heard] if isinstance(heard, dict) else [c for c in heard if c]
        if not decisions or not heard:
            return None
        decision = decisions[0]
        justices = []
        for vote in decision.get("votes") or []:
            name = (vote.get("member") or {}).get("name")
            if name:
                entry = {"name": name, "vote": vote.get("vote") or "unknown"}
                if vote.get("opinion_type") and vote["opinion_type"] != "none":
                    entry["opinion"] = vote["opinion_type"]
                justices.append(entry)
        if not justices:
            return None
        natural = heard[0].get("name", "").strip()
        return {"court": re.sub(r"\s*\(.*\)\s*$", "", natural), "natural_court": natural,
                "decision_type": decision.get("decision_type") or "unknown",
                "vote": {"majority": decision.get("majority_vote"), "minority": decision.get("minority_vote")},
                "justices": justices, "source": case["href"]}

    @staticmethod
    def link(case: dict) -> str | None:
        term, docket = case.get("term"), case.get("docket_number")
        return f"https://www.oyez.org/cases/{term}/{docket}" if term and docket else None


# ---------------------------------------------------------------- the Caselaw Access Project


class Volumes:
    def __init__(self, cache: Path) -> None:
        self.cache = cache / "cap-us"
        self.loaded: dict[str, list[tuple[dict, str]]] = {}

    def cases(self, volume: str) -> list[tuple[dict, str]]:
        if volume not in self.loaded:
            path = self.cache / f"{volume}.zip"
            if not path.exists():
                fetch(f"https://static.case.law/us/{volume}.zip", path)
            found = []
            with zipfile.ZipFile(path) as handle:
                for name in handle.namelist():
                    if name.startswith("json/") and name.endswith(".json"):
                        case = json.loads(handle.read(name))
                        page = handle.read(name.replace("json/", "html/").replace(".json", ".html")).decode("utf-8")
                        found.append((case, page))
            self.loaded[volume] = found
        return self.loaded[volume]

    def find(self, case_id: str, volume: str, page: str) -> tuple[dict, str] | None:
        cases = self.cases(volume)
        for case, page_html in cases:
            if any(c["cite"] == f"SCDB {case_id}" for c in case.get("citations", [])):
                return case, page_html
        for case, page_html in cases:
            if any(c["cite"] == f"{volume} U.S. {page}" for c in case.get("citations", [])) and case["casebody"].get("opinions"):
                return case, page_html
        return None


def opinion_pages(page_html: str, first: int, last: int | None = None, unmarked_head: bool = False) -> list[int]:
    """The report page where each opinion starts: the highest page mark before it (footnotes repeat earlier marks)."""
    starts = []
    for match in re.finditer(r'<article class="opinion"', page_html):
        marks = [int(m) for m in re.findall(r'data-label="(\d+)"[^>]*class="page-label"', page_html[:match.start()])
                 if first <= int(m) <= (last or 10 ** 6)]
        # an opinion that opens a page carries that page's mark just inside the article, before its first words
        after = re.match(r'<article class="opinion"[^>]*>\s*<p[^>]*>\s*<a [^>]*data-label="(\d+)"[^>]*class="page-label"', page_html[match.start():])
        inside = int(after[1]) if after and first <= int(after[1]) <= (last or 10 ** 6) else None
        if inside is None and not marks and unmarked_head:
            # Head matter without page marks (the Court's own volumes): the first mark inside the opinion says where it is.
            for mark in re.finditer(r'data-label="(\d+)"[^>]*class="page-label"', page_html[match.start():]):
                if first <= int(mark[1]) <= (last or 10 ** 6):
                    words_before = re.sub(r"<[^>]+>", " ", page_html[match.start():match.start() + mark.start()])
                    inside = int(mark[1]) if len(words_before.split()) < 40 else int(mark[1]) - 1
                    break
        starts.append(inside or (max(marks) if marks else first))
    return starts


KIND_PATTERNS = [
    (r"concurring in part,? concurring in the judgment in part,? and dissenting in part", "concurrence in part, concurrence in the judgment in part, and dissent in part"),
    (r"concurring in part and dissenting in part", "concurrence in part and dissent in part"),
    (r"concurring in part,? concurring in the result in part,? and dissenting in part", "concurrence in part, concurrence in the result in part, and dissent in part"),
    (r"concurring in part and concurring in the judgment", "concurrence in part and in the judgment"),
    (r"concurring in part and concurring in the result", "concurrence in part and in the result"),
    (r"dissenting in part", "dissent in part"),
    (r"concurring in the judgment", "special concurrence"),
    (r"concurring in the result", "concurrence in the result"),
    (r"announced the judgment of the court", "judgment"),
    (r"delivered (?:an|the) opinion(?:,)? in which .{0,80}? join", "plurality"),
    (r"dissent", "dissent"),
    (r"concurr", "concurrence"),
]


def opinion_kind(opinion: dict) -> str:
    author = (opinion.get("author") or "")
    opening = author + " " + opinion.get("text", "")[:400]
    lowered = re.sub(r"\s+", " ", opening.lower())
    if re.search(r"per curiam", plain(author)) or (not author.strip() and re.match(r"\s*per curiam", lowered)):
        return "per curiam"
    if opinion["type"] == "majority":
        if "announced the judgment" in lowered:
            return "judgment"
        if re.search(r"delivered the opinion of the court", lowered) or not author.strip():
            return "majority" if author.strip() else "per curiam"
    head = lowered[:250]
    for pattern, kind in KIND_PATTERNS:
        if re.search(pattern, head):
            return kind
    return {"majority": "majority", "plurality": "plurality", "dissent": "dissent", "concurrence": "concurrence",
            "concurring-in-part-and-dissenting-in-part": "concurrence in part and dissent in part"}.get(opinion["type"], opinion["type"])


def printed_dates(head: str) -> str | None:
    """The "Argued ... Decided ..." line as the report prints it."""
    text = re.sub(r"\s+", " ", head)
    match = re.search(r"((?:Argued|Submitted|Reargued|Re-argued)\s.{0,200}?Decided\s+[A-Z][a-z]+\.?\s+\d{1,2},\s*\d{4}\.?)", text)
    if not match:
        match = re.search(r"(Decided\s+[A-Z][a-z]+\.?\s+\d{1,2},\s*\d{4}\.?)", text)
    return match[1].strip() if match else None


def parse_days(text: str) -> list[str]:
    """"November 29, 1977", "February 20, 21 and 23, 1832", "January 12-13, 1925", "April 30, May 1, 1928" -> ISO days."""
    days: list[str] = []
    year_match = re.search(r"(\d{4})", text)
    if not year_match:
        return days
    year = int(year_match[1])
    month = None
    for token in re.findall(r"[A-Za-z]+|\d{4}|\d{1,2}(?:\s*[-–]\s*\d{1,2})?", text):
        if token.lower()[:3] in MONTH_ABBREVIATIONS and (token.lower() in MONTHS or len(token) <= 5):
            month = MONTH_ABBREVIATIONS[token.lower()[:3]]
        elif re.fullmatch(r"\d{4}", token):
            continue
        elif month and re.match(r"\d", token):
            numbers = [int(n) for n in re.findall(r"\d+", token)]
            span = range(numbers[0], numbers[-1] + 1) if len(numbers) == 2 else numbers
            for day in span:
                try:
                    days.append(datetime.date(year, month, day).isoformat())
                except ValueError:
                    return []
    return days


def plausible_dates(block: dict | None, day: str) -> bool:
    """Argument dates fall on or before the decision and within a few years of it."""
    earlier = [d for key in ("argued", "submitted", "reargued") for d in (block or {}).get(key, [])]
    return all(f"{int(day[:4]) - 5}" <= d <= day for d in earlier)


def court_dates_block(line: str, source: str) -> dict | None:
    parts = re.split(r"\s*[—–-]{1,2}\s*(?=Decided)|\.?\s+(?=Decided)", line)
    block: dict = {}
    decided_year = re.search(r"Decided\s.*?(\d{4})", line)
    for part in parts:
        label = re.match(r"(Argued|Submitted|Reargued|Re-argued|Decided)", part.strip())
        if not label:
            return None
        if label[1] == "Decided":
            continue
        for piece in re.split(r"\s*[;—–]\s*|\.\s+(?=[A-Z])", part):
            inner = re.match(r"(Argued|Submitted|Reargued|Re-argued)\s+(.*)", piece.strip())
            if not inner:
                continue
            key = {"Argued": "argued", "Submitted": "submitted", "Reargued": "reargued", "Re-argued": "reargued"}[inner[1]]
            words = inner[2]
            if not re.search(r"\d{4}", words) and decided_year:  # "Argued October 19.—Decided November 9, 1903."
                words = f"{words.rstrip(' .')}, {decided_year[1]}"
                decided_days = parse_days(re.search(r"Decided\s+(.*)", line)[1])
                if decided_days and any(d > decided_days[0] for d in parse_days(words)):  # argued the year before
                    words = f"{words.rsplit(',', 1)[0]}, {int(decided_year[1]) - 1}"
            days = parse_days(words)
            if not days:
                return None
            block.setdefault(key, []).extend(days)
    block.update(printed=line, source=source, checked=TODAY)
    return block


def dates_table(cache: Path) -> dict[tuple[str, str], dict]:
    """The Supreme Court Library's "Dates of Supreme Court Decisions and Arguments" (volumes 2 to 107), from the
    Court's Engrossed Minutes, by volume and first page: the line as printed, argued and decided."""
    path = cache / "scotus" / "datesofdecisions.pdf"
    if not path.exists():
        fetch(DATES_TABLE, path)
    text = subprocess.run(["pdftotext", "-layout", str(path), "-"], capture_output=True, check=True).stdout.decode("utf-8", "replace")
    table, volume = {}, None
    date = r"\[?(?:[A-Z][a-z]{2,4}\.?\s+\d[\d,\s\-–]*\d{4}|[A-Z][a-z]+\.? term \d{4})\]?[*#]?"
    for line in text.splitlines():
        heading = re.match(r"\s{10,}(\d+) U\.\s?S\. Reports", line)
        if heading:
            volume = heading[1]
            continue
        entry = re.match(r"(\d+)\s+(.+?)\s*\.{2,}[.\s]*(" + date + r")?[.\s]*?(" + date + r")\s*$", line)
        if volume and entry:
            table[(volume, entry[1])] = {"name": entry[2].strip(" ."), "argued": entry[3] or "", "decided": entry[4]}
    return table


# ---------------------------------------------------------------- the Library of Congress scans


def loc_name(volume: str, page: str) -> str:
    return f"usrep{int(volume):03d}{int(page):03d}"


def loc_pdf(volume: str, page: str) -> str:
    name = loc_name(volume, page)
    return f"https://tile.loc.gov/storage-services/service/ll/usrep/usrep{int(volume):03d}/{name}/{name}.pdf"


def loc_pages(volume: str, page: str, cache: Path) -> list[str] | None:
    """The scan's text layer, one string per page, or None where the scan can't be had."""
    name = loc_name(volume, page)
    text_path = cache / "loc" / f"{name}.json"
    if text_path.exists():
        return json.loads(text_path.read_text())
    pdf = cache / "loc" / f"{name}.pdf"
    if not pdf.exists():
        try:
            fetch(loc_pdf(volume, page), pdf)
        except subprocess.CalledProcessError:
            return None
    result = subprocess.run(["pdftotext", "-enc", "UTF-8", str(pdf), "-"], capture_output=True)
    if result.returncode:
        return None
    pages = result.stdout.decode("utf-8", "replace").split("\f")
    if pages and not pages[-1].strip():
        pages.pop()
    text_path.write_text(json.dumps(pages))
    return pages


def bound_volume(volume: str) -> str:
    return f"https://www.supremecourt.gov/opinions/boundvolumes/{int(volume)}bv.pdf"


def official_pdf(volume: str, page: str) -> str:
    """The official report as a PDF: the Library of Congress scan through volume 542, the Court's bound volume after,
    or the copy other-scans.json names for the case."""
    other = other_scan(volume, page)
    if other:
        return other["pdf"]
    return loc_pdf(volume, page) if int(volume) <= 542 else bound_volume(volume)


def other_scan(volume: str, page: str, use: str = "scan") -> dict | None:
    entry = OTHER_SCANS.get(f"{int(volume)} U.S. {int(page)}")
    return entry if entry and entry["use"] == use else None


def other_scan_pages(entry: dict, volume: str, page: str, count: int, cache: Path) -> tuple[list[str], Path] | None:
    """The case's pages from another copy of the official report (other-scans.json), cut from it into a PDF of their
    own, so that a page's place in the list is its place in that PDF; with the cut PDF."""
    cut = cache / "other" / f"other-{int(volume)}-{int(page)}-{entry['use'].replace(' ', '-')}.pdf"
    text_path = cut.with_suffix(".json")
    if not text_path.exists():
        whole = cache / "other" / entry["pdf"].rsplit("/", 1)[1]
        if not whole.exists():
            try:
                fetch(entry["pdf"], whole)
            except subprocess.CalledProcessError:
                return None
        start = entry["first_scan_page"]
        with tempfile.TemporaryDirectory() as work:
            subprocess.run(["pdfseparate", "-f", str(start), "-l", str(start + count - 1), str(whole), f"{work}/page-%d.pdf"], check=True)
            subprocess.run(["pdfunite", *[f"{work}/page-{n}.pdf" for n in range(start, start + count)], str(cut)], check=True)
        result = subprocess.run(["pdftotext", "-enc", "UTF-8", str(cut), "-"], capture_output=True, check=True)
        pages = result.stdout.decode("utf-8", "replace").split("\f")
        if pages and not pages[-1].strip():
            pages.pop()
        text_path.write_text(json.dumps(pages))
    return json.loads(text_path.read_text()), cut


def bound_volume_pages(volume: str, first: int, last: int, cache: Path) -> list[str] | None:
    """The case's pages from the Court's bound volume (volumes 543 on), found by the page number each page prints at its head."""
    text_path = cache / "bound" / f"{volume}.json"
    if not text_path.exists():
        pdf = cache / "bound" / f"{volume}bv.pdf"
        if not pdf.exists():
            try:
                fetch(bound_volume(volume), pdf)
            except subprocess.CalledProcessError:
                return None
        result = subprocess.run(["pdftotext", "-enc", "UTF-8", str(pdf), "-"], capture_output=True)
        if result.returncode:
            return None
        text_path.write_text(json.dumps(result.stdout.decode("utf-8", "replace").split("\f")))
    pages = json.loads(text_path.read_text())
    printed: dict[int, int] = {}
    for index, text in enumerate(pages):
        head = [line.strip() for line in text.splitlines() if line.strip()][:4]
        for line in head:
            number = re.fullmatch(r"(\d{1,4})", line) or re.match(r"(\d{1,4})\s+[A-Z]", line) or re.search(r"[A-Za-z.]\s+(\d{1,4})$", line)
            if number and first <= int(number[1]) <= last and int(number[1]) not in printed:
                printed[int(number[1])] = index
                break
    if first not in printed and first + 1 in printed:
        printed[first] = printed[first + 1] - 1
    if first not in printed:
        return None
    start = printed[first]
    return pages[start:start + (last - first + 1)]


# ---------------------------------------------------------------- nations


class Nations:
    """Nation records by name, for proposing the nations a caption names."""

    GENERIC = {"indian", "indians", "tribe", "tribes", "nation", "nations", "band", "bands", "of", "the", "and", "community",
               "reservation", "confederated", "united", "states", "state", "county", "village", "native", "pueblo",
               "rancheria", "council", "inc", "et", "al", "v", "in", "people", "tribal", "business", "committee",
               "government", "sovereign", "indigenous", "corporation", "association", "chiefs", "town", "colony"}
    # State names place a nation ("of Oklahoma") but do not tell nations apart.
    GENERIC |= {"alabama", "alaska", "arizona", "california", "colorado", "connecticut", "florida", "idaho", "iowa", "kansas",
                "louisiana", "maine", "massachusetts", "michigan", "minnesota", "mississippi", "montana", "nebraska", "nevada",
                "mexico", "york", "carolina", "north", "south", "dakota", "oklahoma", "oregon", "texas", "utah", "washington",
                "wisconsin", "wyoming", "virginia", "rhode", "island", "indiana", "new"}

    def __init__(self) -> None:
        self.names: dict[str, set[str]] = {}
        self.words: dict[str, set[str]] = {}
        for path in TRIBES.rglob("*.yaml"):
            record = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
            names = record.get("names") or {}
            all_names = [names.get("official")] + list(names.get("alternate") or []) + list(names.get("former") or [])
            for name in all_names:
                if isinstance(name, dict):
                    name = name.get("name")
                if not name:
                    continue
                core = re.split(r",", name)[0]
                self.names.setdefault(plain(core), set()).add(record["id"])
                for word in plain(core).split():
                    if word not in self.GENERIC and len(word) > 3:
                        self.words.setdefault(word, set()).add(record["id"])

    def propose(self, caption: str) -> tuple[list[dict], list[dict]]:
        named, not_linked = [], []
        text = plain(caption)
        # A phrase naming a nation: "Cherokee Nation", "Menominee Tribe of Indians", "Sioux Nation of Indians", "Santa Clara Pueblo".
        phrases = re.findall(r"((?:[A-Z][\w'’.-]*\s+){0,5}(?:Nation|Tribes|Tribe|Bands|Band|Indians|Pueblo|Community|Rancheria|Village|Reservation)(?:\s+of\s+(?:the\s+)?(?:[A-Z][\w'’.-]*\s*){1,5})?)", caption)
        seen = set()
        for phrase in phrases:
            phrase = re.sub(r"^(?:The|And|Of|In|Et|Al|Inc)\s+", "", phrase.strip(" ,.;"))
            phrase = re.sub(r"\s+(?:et\s+al|Petitioners?|Respondents?|Appellants?|Appellees?|Plaintiffs?|Defendants?)\b.*$", "", phrase, flags=re.I)
            key = plain(phrase)
            if not key or key in seen or all(word in self.GENERIC for word in key.split()):
                continue
            seen.add(key)
            exact = self.names.get(key, set())
            distinctive = [w for w in key.split() if w in self.words]
            candidates = set.intersection(*(self.words[w] for w in distinctive)) if distinctive else set()
            if len(exact) == 1:
                nation = next(iter(exact))
                named.append({"nation": nation, "named_as": phrase, "role": "party",
                              "note": "Matched by the script to the nation record of the same name; not yet checked."})
            elif len(candidates) == 1:
                nation = next(iter(candidates))
                named.append({"nation": nation, "named_as": phrase, "role": "party", "historical": True,
                              "note": "Matched by the script to the only nation record sharing this name; not yet checked against the case's history."})
            elif candidates or exact:
                options = sorted(candidates or exact)
                listed = ", ".join(options[:6]) + (f" and {len(options) - 6} more" if len(options) > 6 else "")
                not_linked.append({"named_as": phrase, "reason": f"More than one of today's nations shares this name ({listed}); which the case concerns has not been checked."})
            else:
                not_linked.append({"named_as": phrase, "reason": "No nation record matches this name; it may be a historical name or a group that is not a recognized nation today."})
        named = [n for i, n in enumerate(named) if n["nation"] not in {m["nation"] for m in named[:i]}]
        return named, not_linked


# ---------------------------------------------------------------- existing records


def existing_records() -> tuple[dict[tuple[str, str], str], dict[str, dict], set[str]]:
    by_cite, records, keys = {}, {}, set()
    for path in SOURCES.rglob("*.yaml"):
        keys.add(path.stem)
        text = path.read_text(encoding="utf-8")
        if "container-title: U.S." not in text and "\nreview:" not in text:
            continue
        record = yaml.safe_load(text)
        citation = record.get("citation") or {}
        if citation.get("container-title") == "U.S.":
            by_cite[(str(citation.get("volume")), str(citation.get("page")))] = record["key"]
        records[record["key"]] = record
    for path in SOURCES.rglob("*.yaml"):
        head = path.read_text(encoding="utf-8")[:1500]
        if "kind: federal-case" not in head:
            continue
        for volume, page in re.findall(r"\b(\d{1,3}) U\.S\. (\d{1,4})\b", head) + re.findall(r"usrep(\d{3})(\d{3,4})\.pdf", head):
            by_cite.setdefault((str(int(volume)), str(int(page))), path.stem)
    return by_cite, records, keys


# ---------------------------------------------------------------- building one record


def ocr_writer(author: str, writers: set[str], justices: Justices) -> dict | None:
    """A badly scanned name ("Mr. Justice HELSOH") matched to the closest of the Justices the Database says wrote, when one is clearly closest."""
    words = [plain(w) for w in re.findall(r"[^\W\d_]{4,}", author or "") if plain(w) not in ("justice", "chief", "delivered", "opinion")]
    scored = sorted(((max((difflib.SequenceMatcher(None, Justices.family(name).replace(" ", ""), w).ratio() for w in words), default=0), name)
                     for name in writers), reverse=True)
    if scored and scored[0][0] >= 0.5 and (len(scored) == 1 or scored[0][0] - scored[1][0] >= 0.2):
        return next(j for j in justices.list if j["name"] == scored[0][1])
    return None


def bench_agreement(oyez: dict | None, scdb: dict, listing: list[dict], justices: Justices, day: str) -> tuple[str, str]:
    if scdb["unmatched"]:
        return "differs", f"Database codes with no Justice serving that day: {', '.join(scdb['unmatched'])}"
    if scdb["outside"]:
        return "differs", f"The Database lists {', '.join(scdb['outside'])}, not serving on the day of decision; left out of the bench"
    if oyez:
        def side(block):
            found = {}
            for member in block["justices"]:
                person = justices.named(Justices.family(member["name"]), day, plain(member["name"])[:1])
                vote = member["vote"]
                found[person["name"] if person else member["name"]] = "not recorded" if vote in ("none", "unknown", "not recorded") else vote
            return found
        mine, theirs = side(scdb), side(oyez)
        if mine == theirs:
            return "agree", "Oyez and the Database give the same Justices and votes"
        diff = sorted(n for n in set(mine) | set(theirs) if mine.get(n) != theirs.get(n))
        return "differs", "Oyez and the Database differ for " + ", ".join(f"{n} (Oyez {theirs.get(n, 'absent')}, Database {mine.get(n, 'absent')})" for n in diff)
    if not scdb["justices"]:
        return "missing", "The Database lists no Justices"
    sides = {m["name"]: m["vote"] for m in scdb["justices"]}
    wrong = [f"{Justices.family(e['justice']).title()} wrote a {e['kind']} but the Database counts a {sides.get(e['justice'], 'absent')} vote"
             for e in listing if e["justice"] != "The Court" and (
                 e["justice"] not in sides
                 or (e["kind"] in ("dissent", "dissent in part") and sides[e["justice"]] != "minority")
                 or (e["kind"] in ("majority", "judgment", "plurality") and sides[e["justice"]] != "majority"))]
    if wrong:
        return "differs", "No Oyez votes; " + "; ".join(wrong)
    return "agree", "No Oyez votes; each opinion writer in the report sits on the Database's bench on the side the opinion takes"


def build(row: dict, scdb_rows: dict, volumes: Volumes, oyez: Oyez, justices: Justices, nations: Nations, cache: Path) -> tuple[dict | None, list[dict], str]:
    """The record for one case, its checks, and a reason when there is no record."""
    citation = row["citation"]
    volume, page = citation.split(" U.S. ") if " U.S. " in citation else (None, None)
    if not volume:
        return None, [], "no U.S. Reports citation yet"
    rows = scdb_rows.get(row["scdb_case_id"])
    if not rows:
        return None, [], "not in the Supreme Court Database files"
    day = mdy(rows[0]["dateDecision"]) or mdy(row["decided"])
    found = volumes.find(row["scdb_case_id"], volume, page)
    if not found:
        return None, [], "not found in the Caselaw Access Project volume"
    cap, page_html = found
    checks: list[dict] = []

    # citation and name
    official = next((c["cite"] for c in cap["citations"] if c["type"] == "official"), "")
    name_ratio = similarity(cap["name_abbreviation"], rows[0]["caseName"])
    words_shared = set(plain(cap["name_abbreviation"]).split()) & set(plain(rows[0]["caseName"]).split())
    cite_ok = official == f"{volume} U.S. {page}" and (any(c["cite"] == f"SCDB {row['scdb_case_id']}" for c in cap["citations"]) or name_ratio > 0.8)
    checks.append({"check": "cite", "result": "agree" if cite_ok and (name_ratio > 0.5 or len(words_shared) >= 2) else "differs",
                   "detail": f"Caselaw Access Project {official} \"{cap['name_abbreviation']}\"; Database {rows[0]['usCite']} \"{rows[0]['caseName']}\""})

    # the Library of Congress scan
    last_page = int(cap["last_page"]) if str(cap.get("last_page", "")).isdigit() else int(page)
    other = other_scan(volume, page)
    if other:
        found_other = other_scan_pages(other, volume, page, last_page - int(page) + 1, cache)
        pages = found_other[0] if found_other else None
    else:
        pages = loc_pages(volume, page, cache) if int(volume) <= 542 else bound_volume_pages(volume, int(page), last_page, cache)
    first, last = int(cap["first_page"]), int(cap["last_page"]) if str(cap.get("last_page", "")).isdigit() else None
    if pages is None:
        checks.append({"check": "scan", "result": "missing", "detail": "No scan of the official report found"})
    else:
        expected = (last - first + 1) if last else None
        checks.append({"check": "scan", "result": "agree" if expected == len(pages) else "differs",
                       "detail": f"Scan has {len(pages)} pages; the report runs {first} to {last}"})

    # caption
    caption = end_stop(cap["name"])
    if pages:
        ratio = contains_fuzzy(caption, " ".join(pages[:2]))
        checks.append({"check": "caption", "result": "agree" if ratio >= 0.9 else "differs", "detail": f"Caption found in the scan's text at {ratio:.2f}"})

    # dates
    head = cap["casebody"].get("head_matter", "")
    line = printed_dates(head)
    court_dates = None
    scan_line = printed_dates(" ".join(pages[:3])) if pages else None
    decided_check = {"check": "decided", "result": "missing", "detail": f"Database {day}; no printed decision date"}
    if line:
        decided = parse_days(re.search(r"Decided\s+(.*)", line)[1])
        if decided and decided[0] == day:
            decided_check = {"check": "decided", "result": "agree", "detail": f"Printed and Database: {day}"}
        else:
            decided_check = {"check": "decided", "result": "differs", "detail": f"Printed \"{line}\"; Database {day}"}
        court_dates = court_dates_block(line, official_pdf(volume, page) if pages else f"https://static.case.law/us/{volume}/html/{cap['file_name']}.html")
        same = bool(pages) and contains_fuzzy(line, " ".join(pages[:3])) >= (0.75 if decided and decided[0] == day else 0.9)
        # the words may match while a figure is misread ("Argued December 14, 17, 1000."): the figures must match too
        same = same and (scan_line is None or official_report.numbers(line) == official_report.numbers(scan_line)) and plausible_dates(court_dates, day)
        checks.append({"check": "printed dates", "result": "agree" if same and court_dates else "differs",
                       "detail": f"Caselaw Access Project \"{line}\"; scan \"{scan_line or 'not found'}\""})
    elif (volume, page) in TABLE:
        entry = TABLE[(volume, page)]
        decided = parse_days(entry["decided"]) if re.fullmatch(r"[A-Z][a-z]{2,4}\.?\s+\d{1,2},\s*\d{4}\*?", entry["decided"]) else []
        marked = "*" in entry["decided"] or "#" in entry["decided"]
        decided_check = {"check": "decided", "result": "agree" if decided and decided[0] == day else "differs",
                         "detail": f"Supreme Court Library's table (from the Court's minutes{', docket' if '*' in entry['decided'] else ''}) {entry['decided']}; Database {day}"}
        argued = parse_days(entry["argued"]) if entry["argued"] and "term" not in entry["argued"] else []
        if decided and not marked:
            printed = (f"Argued {entry['argued']}; decided {entry['decided']}" if entry["argued"] else f"Decided {entry['decided']}")
            court_dates = {**({"argued": argued} if argued else {}), "printed": printed, "source": DATES_TABLE,
                           "note": "The report prints only the term. These dates are from the Supreme Court Library's table of decision and argument dates, which takes them from the Court's Engrossed Minutes.",
                           "checked": TODAY}
    elif len(cap.get("decision_date", "")) == 10:
        decided_check = {"check": "decided", "result": "agree" if cap["decision_date"] == day else "differs",
                         "detail": f"Caselaw Access Project {cap['decision_date']}; Database {day}"}
    checks.append(decided_check)

    # opinions
    scdb_writers_early = scdb_bench(rows, day, justices)["writers"]
    opinions = cap["casebody"].get("opinions", [])
    starts = opinion_pages(page_html, first, last, unmarked_head=int(volume) > 542)
    listing, writers, unknown = [], set(), []
    for opinion, start in zip(opinions, starts):
        if opinion["type"] in ("rehearing", "on-motion-to-strike-cost-bill", "on-the-merits"):
            unknown.append(opinion["type"])
            continue
        kind = opinion_kind(opinion)
        justice = None if kind == "per curiam" else justices.from_author(opinion.get("author") or opinion["text"][:120], day)
        if kind != "per curiam" and justice is None:
            justice = ocr_writer(opinion.get("author") or opinion["text"][:120], scdb_writers_early, justices)
        if kind != "per curiam" and justice is None:
            unknown.append(f"writer of a {kind} (\"{(opinion.get('author') or '')[:60]}\")")
            continue
        entry = {"kind": kind, "justice": "The Court" if kind == "per curiam" else justice["name"], "page": start}
        listing.append(entry)
        if justice:
            writers.add(justice["name"])
    page_checks = []
    if pages:
        for opinion, entry in zip([o for o in opinions], listing):
            body = opinion["text"][len(opinion.get("author") or ""):] if opinion["text"].startswith(opinion.get("author") or "\0") else opinion["text"]
            words = " ".join(plain(body).split()[3:17])
            scores = [contains_fuzzy(words, text) for text in pages]
            best = max(range(len(scores)), key=lambda i: scores[i]) if scores else 0
            page_checks.append((entry["page"], first + best, scores[best] if scores else 0))
    opinion_ok = bool(listing) and not unknown and all(a == b and s >= 0.75 for a, b, s in page_checks) if pages else False
    scdb = scdb_bench(rows, day, justices)
    scdb_writers = scdb["writers"]
    writers_ok = writers == scdb_writers or (not scdb_writers and not writers)
    checks.append({"check": "opinions", "result": "agree" if opinion_ok and writers_ok else "differs",
                   "detail": "; ".join(filter(None, [
                       f"Report: {', '.join(f'{e['kind']} {Justices.family(e['justice']).title()} p. {e['page']}' for e in listing) or 'none read'}",
                       f"Database writers: {', '.join(sorted(Justices.family(w).title() for w in scdb_writers)) or 'none'}",
                       f"scan pages {[(a, b) for a, b, s in page_checks if a != b or s < 0.75]}" if any(a != b or s < 0.75 for a, b, s in page_checks) else "",
                       f"not read: {', '.join(unknown)}" if unknown else ""]))})

    # bench
    oyez_case = oyez.find(volume, page, int(day[:4]))
    oyez_bench = oyez.bench(oyez_case) if oyez_case else None
    result, detail = bench_agreement(oyez_bench, scdb, listing, justices, day)
    checks.append({"check": "bench", "result": result, "detail": detail})
    court, natural = justices.natural_court(day)
    if oyez_bench:
        bench = {k: oyez_bench[k] for k in ("court", "natural_court", "decision_type", "vote", "justices", "source")}
    else:
        bench = {"court": court, "natural_court": natural, "decision_type": scdb["decision_type"], "vote": scdb["vote"],
                 "justices": scdb["justices"], "source": f"{SCDB}/{SCDB_FILES['modern' if int(day[:4]) >= 1946 else 'legacy']}.csv.zip",
                 "note": f"From the Supreme Court Database, case {row['scdb_case_id']}; Oyez has no votes for this case."}
    bench["checked"] = TODAY

    # nations
    named, not_linked = nations.propose(f'{caption_case(cap["name"])}; {cap["name_abbreviation"]}')

    # the record
    title = TITLE_FIXES.get(f"{volume} U.S. {page}") or end_stop(cap["name_abbreviation"])
    nominative = next((c["cite"] for c in cap["citations"] if c["type"] == "nominative"), None)
    year = day[:4]
    full = f"{volume} U.S. ({nominative}) {page} ({year})" if nominative else f"{volume} U.S. {page} ({year})"
    loc_item = other["item"] if other and pages else f"https://www.loc.gov/item/{loc_name(volume, page)}/"
    links = []
    if pages and other:
        links.append({"site": other["site"], "label": other["label"], "access": "official" if other["site"] == "library-of-congress" else "free", "link": other["item"]})
    elif pages and int(volume) <= 542:
        links.append({"site": "library-of-congress", "label": "Library of Congress", "access": "official", "link": loc_item})
    elif pages:
        links.append({"site": "supremecourt", "label": "Supreme Court of the United States", "access": "official", "link": bound_volume(volume)})
    links.append({"site": "justia", "label": "Justia", "access": "free", "link": f"https://supreme.justia.com/cases/federal/us/{volume}/{page}/", "unchecked": True})
    if oyez_case and Oyez.link(oyez_case):
        links.append({"site": "oyez", "label": "Oyez", "access": "free", "link": Oyez.link(oyez_case)})
    cite_q = f"{volume}%20U.S.%20{page}"
    links += [
        {"site": "google-scholar", "label": "Google Scholar", "access": "free", "link": f"https://scholar.google.com/scholar?hl=en&as_sdt=2006&q=%22{cite_q}%22", "unchecked": True},
        {"site": "westlaw", "label": "Westlaw", "access": "subscription", "link": f"https://1.next.westlaw.com/Link/Document/FullText?findType=Y&cite={cite_q}", "unchecked": True},
        {"site": "lexis", "label": "Lexis", "access": "subscription", "link": f"https://advance.lexis.com/api/search?q={cite_q}", "unchecked": True},
    ]
    report = official_pdf(volume, page) if pages else f"https://static.case.law/us/{volume}/html/{cap['file_name']}.html"
    status = "verified" if all(c["result"] == "agree" for c in checks) else "unverified"
    settled = SETTLED_READINGS.get(row["scdb_case_id"])
    if settled and status == "unverified":
        fixes = settled.get("corrections") or {}
        if fixes.get("caption"):
            caption = fixes["caption"]
        if fixes.get("opinions"):
            listing = fixes["opinions"]
        if fixes.get("court_dates_printed"):
            court_dates = court_dates_block(fixes["court_dates_printed"], official_pdf(volume, page) if pages else report) or court_dates
        if fixes.get("decided"):
            day = fixes["decided"]
        for verdict in settled.get("verdicts") or []:
            for check in checks:
                if check["check"] == verdict["check"] and check["result"] != "agree" and verdict["result"] in ("record right", "corrected"):
                    check["result"] = "settled"
                    check["detail"] += f". Read from the scan by an AI reader ({verdict['result']}): {verdict.get('evidence', '')}"
    scan_pages: dict[int, int] = {}
    if status == "unverified":
        listing, caption, court_dates, day, scan_pages = confirm_in_report(
            row, checks, listing, caption, court_dates, day, pages, first, last, volume, page, cap, volumes, scdb, oyez_bench, justices, cache)
        status = "verified" if all(c["result"] in ("agree", "confirmed") for c in checks) else "unverified"
    elif pages and int(volume) <= 542:
        scan_pages = scan_page_numbers(pages, first, last, listing)
    if pages and other:  # a page of another copy is linked by its place in that copy
        mapping, _ = official_report.page_map(pages, first, last)
        scan_pages = {e["page"]: other["first_scan_page"] + (mapping.index(e["page"]) if e["page"] in mapping else e["page"] - first)
                      for e in listing}
    for entry in listing:
        if entry["page"] in scan_pages:
            entry["scan_page"] = scan_pages[entry["page"]]
    record: dict = {
        "key": "",
        "kind": "federal-case",
        "citation": {"type": "legal_case", "title": title, "authority": "Supreme Court of the United States",
                     "container-title": "U.S.", "volume": volume, "page": page,
                     "issued": {"date-parts": [[int(x) for x in day.split("-")]]}, "URL": (loc_item if int(volume) <= 542 else report) if pages else report,
                     "accessed": {"date-parts": [[int(x) for x in TODAY.split("-")]]}},
        "caption": {"printed": caption, "source": report, "checked": TODAY},
    }
    if listing and bench["decision_type"] != "decree":  # a decree has no opinion
        record["opinions"] = {"source": report, "checked": TODAY, "list": listing}
    record.update({"original_link": (loc_item if int(volume) <= 542 else report) if pages else report, "retrieved": TODAY,
                   "history": {"status": "live", "last_checked": TODAY}})
    if court_dates:
        record["court_dates"] = court_dates
    record["supreme_court"] = bench
    record["reading_links"] = {"checked": TODAY, "links": links}
    record["rights"] = {"status": "no-permission-needed", "basis": "us-government-work",
                        "basis_note": "Opinions of federal courts are works of the U.S. government (17 U.S.C. § 105); the host site's own additions are not reproduced.",
                        "redistribution": True}
    record["found_in"] = [SESSION]
    record["notes"] = (f"Full citation: {full}. Official report scan: {report}. Written by {SCRIPT} from the Supreme Court Database "
                       f"(case {row['scdb_case_id']}), the Caselaw Access Project's text of the report and {'the Library of Congress scan' if int(volume) <= 542 else "the Court's bound volume"}; "
                       "not yet read by a person.")
    if pages and other:
        record["notes"] = record["notes"].replace("the Library of Congress scan;", f"the {other['label']} scan named in research/supreme-court-coverage/other-scans.json;") + f" {other['why']}"
    record["tribes"] = [n["nation"] for n in named]
    record["nations_in_case"] = {"checked": TODAY, "named": named}
    if not_linked:
        record["nations_in_case"]["not_linked"] = not_linked
    record["review"] = {"status": status, "by": SCRIPT, "date": TODAY, "checks": checks}
    return record, checks, ""


# ---------------------------------------------------------------- confirming disputed facts in the official report


def bound_volume_start(volume: str, pages: list[str], cache: Path) -> int:
    """Where the case's pages begin in the Court's bound volume (0-based), for reading a page image."""
    every = json.loads((cache / "bound" / f"{volume}.json").read_text())
    return next((i for i in range(len(every)) if every[i:i + len(pages)] == pages), 0)


def scan_page_numbers(pages: list[str], first: int, last: int | None, listing: list[dict]) -> dict[int, int]:
    """For opinions whose page is not where counting from the scan's first page puts it (an inserted map or blank
    leaf before it), the scan page (1-based) that holds it."""
    mapping, _ = official_report.page_map(pages, first, last)
    found = {}
    for entry in listing:
        if entry["page"] in mapping and mapping.index(entry["page"]) + 1 != entry["page"] - first + 1:
            found[entry["page"]] = mapping.index(entry["page"]) + 1
    return found


def confirm_in_report(row, checks, listing, caption, court_dates, day, pages, first, last, volume, page, cap, volumes, scdb, oyez_bench, justices, cache):
    """Settle each check the sources disagree on by what the official report prints.

    A check the report confirms becomes "confirmed", with the words it prints. Corrections read from the report's
    page images (READINGS) are applied first; each line they rest on must be found on its printed page of the
    report's text (its text layer or a fresh OCR of the page image), or nothing in that reading is used.
    """
    reading = READING_LINES.get(row["scdb_case_id"]) or {}
    facts = reading.get("facts") or {}
    scan_pages: dict[int, int] = {}
    if not pages:
        if facts:
            print(f"{row['scdb_case_id']}: no scan to check the reading against", file=sys.stderr)
        return listing, caption, court_dates, day, scan_pages
    other = other_scan(volume, page)
    bound = int(volume) > 542 and not other
    pdf = cache / "bound" / f"{volume}bv.pdf" if bound else cache / "loc" / f"{loc_name(volume, page)}.pdf"
    if other:
        pdf = other_scan_pages(other, volume, page, len(pages), cache)[1]
    base = bound_volume_start(volume, pages, cache) if bound else 0
    mapping, map_notes = official_report.page_map(pages, first, last)
    index_of = {printed: index for index, printed in enumerate(mapping) if printed is not None}

    def printed_on(line: str, printed: int) -> tuple[float, str]:
        index = index_of.get(printed)
        if index is None:
            return 0.0, "not in the scan"
        layer = official_report.best_run(line, pages[index])
        if layer >= 0.9:
            return layer, "text layer"
        fresh = official_report.best_run(line, official_report.ocr_page(pdf, base + index, cache))
        return (fresh, "fresh OCR") if fresh > layer else (layer, "text layer")

    def lines_hold(fact: dict) -> tuple[bool, str]:
        quoted = []
        for item in fact.get("lines") or []:
            score, how = printed_on(item["text"], item["page"])
            # a line in ornamental or small-capital type that no OCR reads well, checked by eye on the page image
            if score < (0.75 if item.get("ocr_poor") else 0.85):
                return False, f"p. {item['page']}: \"{item['text']}\" not found ({how}, {score:.2f})"
            quoted.append(f"p. {item['page']}: \"{item['text']}\"" + (" (the OCR reads this line poorly; checked on the page image)" if item.get("ocr_poor") else ""))
        return bool(quoted), "; ".join(quoted)

    # corrections read from the page images, used only when every line they rest on is printed where they say
    held = {}
    for name, fact in facts.items():
        held[name] = lines_hold(fact)
        if not held[name][0]:
            print(f"{row['scdb_case_id']} {name}: reading not confirmed: {held[name][1]}", file=sys.stderr)
            continue
        fix = fact.get("correct") or {}
        if "opinions" in fix:
            listing = fix["opinions"]
        if "caption" in fix:
            caption = fix["caption"]
        if "court_dates_printed" in fix:
            court_dates = court_dates_block(fix["court_dates_printed"], official_pdf(volume, page)) or court_dates
        if "court_dates" in fix:  # a heading the date parser can't read, such as a chain of decrees
            court_dates = {**fix["court_dates"], "source": official_pdf(volume, page), "checked": TODAY}
        if "decided" in fix:
            day = fix["decided"]

    def confirm(check: dict, how: str) -> None:
        check["result"] = "confirmed"
        check["detail"] = f"{check['detail']}. Confirmed: {how}"

    by_name = {c["check"]: c for c in checks}
    # the cite and bench checks rest on the caption and the decision date, so they come last
    for check in sorted(checks, key=lambda c: c["check"] in ("cite", "bench")):
        if check["result"] == "agree":
            continue
        name = check["check"]
        auto = None
        if name == "caption":
            score, how, index = official_report.find_text(caption, pages, [0, 1], pdf if not bound else None, cache)
            if score >= 0.9:
                auto = f"the report prints the caption \"{caption}\" on p. {mapping[index] if index is not None else first} ({how}, {score:.2f})"
        elif name in ("printed dates", "decided") and court_dates and court_dates.get("source", "").startswith(("https://tile.loc.gov", "https://www.supremecourt.gov/opinions/bound", "https://archive.org/")):
            line = court_dates["printed"]
            decided = parse_days(re.search(r"Decided\s+(.*)", line)[1]) if re.search(r"Decided\s+(.*)", line) else []
            score, how, index = official_report.find_text(line, pages, [0, 1, 2], pdf if not bound else None, cache)
            same_day = bool(decided) and decided[0] == day
            figures = index is not None and (official_report.has_numbers(line, pages[index]) or (not bound and official_report.has_numbers(line, official_report.ocr_page(pdf, index, cache))))
            if score >= 0.9 and figures and plausible_dates(court_dates, day) and (name == "printed dates" or same_day):
                auto = f"the report prints \"{line}\" on p. {mapping[index] if index is not None else first} ({how}, {score:.2f})"
            second = other_scan(volume, page, "second copy")
            if not auto and second and name in second.get("checks", []) and plausible_dates(court_dates, day) and (name == "printed dates" or same_day):
                copy_pages, copy_pdf = other_scan_pages(second, volume, page, min(3, len(pages)), cache)
                score, how, index = official_report.find_text(line, copy_pages, [0, 1, 2], copy_pdf, cache)
                if index is not None and score >= 0.9 and (official_report.has_numbers(line, copy_pages[index]) or official_report.has_numbers(line, official_report.ocr_page(copy_pdf, index, cache))):
                    auto = (f"the report prints \"{line}\" on p. {first + index} of the {second['label']}'s copy of the volume "
                            f"(scan page {second['first_scan_page'] + index}, {how}, {score:.2f}; {second['item']}). {second['why']}")
        elif name == "scan":
            shown, total, wrong = official_report.map_checks(pages, mapping)
            wanted = [e["page"] for e in listing]
            end = last or max(wanted + [first])
            missing = [p for p in range(first, end + 1) if p not in index_of]
            shared = None
            if missing == [end] and last:
                shared = next((c for c, _ in volumes.cases(volume) if str(c.get("first_page")) == str(last) and c["first_page"] != cap["first_page"]), None)
            if not wrong and total and shown >= 0.6 * total and all(p in index_of for p in wanted) and (not missing or shared):
                pieces = [f"the scan's pages are the report's pp. {first}-{max(index_of)} ({shown} of {total} pages show their page number or running head)"]
                pieces += map_notes
                if shared:
                    pieces.append(f"p. {last} is also the first page of {end_stop(shared['name_abbreviation'])}, and is in that case's scan")
                auto = "; ".join(pieces)
        elif name == "opinions":
            ok, how = official_report.confirm_opinions(listing, pages, mapping, day, justices, pdf, cache, last, base)
            if ok:
                auto = how or "the report prints no opinion"
        elif name == "cite":
            official = next((c["cite"] for c in cap["citations"] if c["type"] == "official"), "")
            if official == f"{volume} U.S. {page}" == scdb.get("us_cite") and by_name.get("caption", {}).get("result") in ("agree", "confirmed"):
                auto = f"both sources put the case at {official}, the report prints its caption there (the caption check), and the two names differ only in form"
        elif name == "bench":
            result, detail = bench_agreement(oyez_bench, scdb, listing, justices, day)
            if result == "agree":
                check.update(result="agree", detail=detail)
                continue
            if scdb["outside"] and not scdb["unmatched"] and by_name.get("decided", {}).get("result") in ("agree", "confirmed"):
                served = []
                for name_out in scdb["outside"]:
                    person = next((j for j in justices.list if j["name"] == name_out), None)
                    if person:
                        served.append(f"{name_out} served {person['oath']} to {person.get('left') or 'now'}")
                if len(served) == len(scdb["outside"]):
                    auto = f"the Court's list of Justices: {'; '.join(served)}, so not on the bench on {day}"
        if auto:
            confirm(check, auto)
        elif name in facts and held.get(name, (False,))[0]:
            confirm(check, f"the report prints (read from the page images) {held[name][1]}" + (f" ({facts[name]['note']})" if facts[name].get("note") else ""))
    if not bound:
        scan_pages = scan_page_numbers(pages, first, last, listing)
    return listing, caption, court_dates, day, scan_pages


# ---------------------------------------------------------------- writing


class Dumper(yaml.SafeDumper):
    pass


def _str(dumper, value):
    return dumper.represent_scalar("tag:yaml.org,2002:str", value, style="'" if re.fullmatch(r"\d{4}-\d{2}-\d{2}|\d+", value) else None)


Dumper.add_representer(str, _str)


def dump(record: dict) -> str:
    return yaml.dump(record, Dumper=Dumper, sort_keys=False, allow_unicode=True, width=10 ** 6, default_flow_style=False)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--cache", required=True, type=Path)
    parser.add_argument("--write", action="store_true", help="write the records (otherwise only the report)")
    parser.add_argument("--max-volume", type=int, default=572)
    parser.add_argument("--min-volume", type=int, default=1)
    parser.add_argument("--only", nargs="*", help="Database case IDs")
    parser.add_argument("--disagreements", type=Path)
    parser.add_argument("--file-captures", type=Path, metavar="CAPTURES",
                        help="file the source files in R2 and the capture index, using this local captures folder, and stop")
    args = parser.parse_args()
    cache = args.cache.expanduser()
    if args.file_captures:
        file_captures(cache, args.file_captures)
        return 0

    global TABLE, SETTLED_READINGS, READING_LINES, OTHER_SCANS
    OTHER_SCANS = json.loads(OTHER_SCANS_PATH.read_text(encoding="utf-8")) if OTHER_SCANS_PATH.exists() else {}
    TABLE = dates_table(cache)
    SETTLED_READINGS = json.loads(SETTLED.read_text(encoding="utf-8")) if SETTLED.exists() else {}
    READING_LINES = json.loads(READINGS.read_text(encoding="utf-8")) if READINGS.exists() else {}
    justices, nations = Justices(), Nations()
    scdb_rows = load_scdb(cache)
    volumes, oyez = Volumes(cache), Oyez(cache)
    by_cite, records, keys = existing_records()
    report_rows, disagreements, written = [], [], 0
    cases = list(csv.DictReader(CASE_LIST.open(encoding="utf-8")))
    claimed: dict[str, str] = {}
    pending: list[tuple[Path, dict]] = []
    generated = {k for k, r in records.items() if (r.get("review") or {}).get("by") == SCRIPT}
    for row in cases:
        if args.only and row["scdb_case_id"] not in args.only:
            continue
        volume = row["citation"].split(" U.S. ")[0] if " U.S. " in row["citation"] else ""
        if volume and not (args.min_volume <= int(volume) <= args.max_volume):
            continue
        if not volume and args.max_volume < 1000:
            continue
        existing = by_cite.get(tuple(row["citation"].split(" U.S. "))) if volume else None
        if row["our_record"] or (existing and "review" not in records.get(existing, {})):
            continue
        try:
            record, checks, reason = build(row, scdb_rows, volumes, oyez, justices, nations, cache)
        except Exception as error:  # one bad case must not stop the run
            record, checks, reason = None, [], f"error: {error!r}"
        if record is None:
            report_rows.append({"scdb_case_id": row["scdb_case_id"], "citation": row["citation"], "key": "", "status": "not written", "reason": reason})
            print(f"{row['scdb_case_id']} {row['citation']}: {reason}", file=sys.stderr)
            continue
        key = existing or slug(record["citation"]["title"])
        if existing in generated:
            key = existing
        else:
            if key in claimed.values() or key in keys:
                key = f"{key}-{record['citation']['issued']['date-parts'][0][0]}"
            if key in claimed.values() or key in keys:
                key = f"{key}-{record['citation']['volume']}-{record['citation']['page']}"
        claimed[row["scdb_case_id"]] = key
        record["key"] = key
        report_rows.append({"scdb_case_id": row["scdb_case_id"], "citation": row["citation"], "key": key,
                            "status": record["review"]["status"], "reason": "",
                            **{c["check"]: f"{c['result']}: {c['detail']}" for c in checks}})
        if record["review"]["status"] != "verified":
            disagreements.append({"key": key, "citation": row["citation"], "title": record["citation"]["title"],
                                  "checks": [c for c in checks if c["result"] != "agree"]})
        if args.write:
            path = SOURCES / key[0] / f"{key}.yaml"
            if path.exists():
                old = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
                if (old.get("review") or {}).get("by") != SCRIPT or (old.get("review") or {}).get("status") not in ("verified", "unverified"):
                    print(f"{key}: a person has worked on this record; left as it is", file=sys.stderr)
                    continue
                for kept in ("courtlistener", "archives", "citator"):
                    if kept in old:
                        record[kept] = old[kept]
            pending.append((path, record))
    # Cases in one of the Court's bound volumes share its address, as does a case whose pages are in another case's
    # scan (other-scans.json); records written before and not rerun count too.
    by_link: dict[str, list[str]] = {}
    for _, record in pending:
        by_link.setdefault(record["original_link"], []).append(record["key"])
    rerun = {record["key"] for _, record in pending}
    for key, earlier in records.items():
        if (earlier.get("review") or {}).get("by") == SCRIPT and key not in rerun and earlier.get("original_link") in by_link:
            by_link[earlier["original_link"]].append(key)
    other_items = {entry["item"] for entry in OTHER_SCANS.values()}
    for path, record in pending:
        others = [key for key in by_link[record["original_link"]] if key != record["key"]]
        if others and ("boundvolumes" in record["original_link"] or record["original_link"] in other_items
                       or any(r["original_link"] in other_items for _, r in pending if r["key"] in others)):
            record["shares_link_with"] = sorted(others)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(dump(order(record)), encoding="utf-8")
        written += 1
    fields = ["scdb_case_id", "citation", "key", "status", "reason", "cite", "scan", "caption", "printed dates", "decided", "opinions", "bench"]
    if args.only and REPORT.exists():  # a partial run updates its rows of the full report
        rerun = {r["scdb_case_id"]: r for r in report_rows}
        report_rows = [rerun.pop(r["scdb_case_id"], r) for r in csv.DictReader(REPORT.open(encoding="utf-8"))] + list(rerun.values())
    with REPORT.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        for report_row in report_rows:
            writer.writerow(report_row)
    if args.disagreements:
        args.disagreements.write_text(json.dumps(disagreements, indent=1, ensure_ascii=False))
    statuses = {}
    for report_row in report_rows:
        statuses[report_row["status"]] = statuses.get(report_row["status"], 0) + 1
    print(f"cases: {statuses}; written {written}; report {REPORT.relative_to(ROOT)}", file=sys.stderr)
    return 0


def file_captures(cache: Path, captures: Path) -> None:
    """Keep a private copy in R2 of every file the records are built from (project rule: a private copy of every directly cited source).

    The Caselaw Access Project volumes and the Database files are private archives (redistribution "no"); the
    Library of Congress scans are United States government works, filed for the website to serve as
    site/tools/fetch-public-copies.mjs files them. A file already filed with the same SHA-256 is skipped.
    """
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    import tribal_court_opinions as opinions  # noqa: PLC0415
    filed = opinions.filed_captures()
    opinions.VOLUME_RIGHTS = "Released by the Harvard Library Innovation Lab without restriction (Mar. 2024). Private archive of the volume; not redistributed."
    mirror = [sys.executable, str(ROOT / "scripts" / "captures" / "mirror_captures.py"), "add", "--captures", str(captures)]
    for path in sorted((cache / "cap-us").glob("*.zip"), key=lambda p: int(p.stem)):
        opinions.file_capture(path, {"slug": "us", "name": "United States Reports"},
                              {"volume_folder": path.stem, "volume_number": path.stem}, captures, filed)
    for path in sorted((cache / "scdb").glob("*.csv.zip")):
        if opinions.hashlib.sha256(path.read_bytes()).hexdigest() in filed:
            continue
        release = "2026_01" if "2026_01" in path.name else "Legacy_07"
        subprocess.run(mirror + ["--topic", "scdb.wustl.edu", "--name", f"{release}/{path.name}",
                                 "--title", f"Supreme Court Database, release {release}: {path.name}",
                                 "--obtained", "Supreme Court Database downloads (scdb.wustl.edu)",
                                 "--link", f"{SCDB}/{release}/{path.name}", "--redistribution", "no",
                                 "--rights", "Supreme Court Database (Washington University in St. Louis). Private research copy; not redistributed.",
                                 str(path)], check=True)
    for path in sorted((cache / "bound").glob("*bv.pdf")):
        if opinions.hashlib.sha256(path.read_bytes()).hexdigest() in filed:
            continue
        volume = path.name[:-6]
        subprocess.run(mirror + ["--topic", "supremecourt.gov", "--name", f"opinions/boundvolumes/{path.name}",
                                 "--title", f"United States Reports, volume {volume} (the Court's bound volume)",
                                 "--obtained", f"downloaded by {SCRIPT}", "--redistribution", "yes", "--link", bound_volume(volume),
                                 "--rights", "Official report of the Supreme Court of the United States; a work of the U.S. government (17 U.S.C. § 105).",
                                 str(path)], check=True)
    keys_by_citation = {row["citation"]: row["key"] for row in csv.DictReader(REPORT.open(encoding="utf-8")) if row["key"]}
    others = json.loads(OTHER_SCANS_PATH.read_text(encoding="utf-8")) if OTHER_SCANS_PATH.exists() else {}
    for citation, entry in others.items():  # the other copies of the report that records cite (other-scans.json)
        path = cache / "other" / entry["pdf"].rsplit("/", 1)[1]
        if not path.exists() or citation not in keys_by_citation or opinions.hashlib.sha256(path.read_bytes()).hexdigest() in filed:
            continue
        host, name = entry["pdf"].split("://", 1)[1].split("/", 1)
        subprocess.run(mirror + ["--topic", host, "--name", name,
                                 "--title", f"United States Reports: {entry['label']} scan holding {entry['case']}, {citation}",
                                 "--obtained", f"downloaded by {SCRIPT}", "--redistribution", "yes", "--link", entry["pdf"],
                                 "--record", keys_by_citation[citation],
                                 "--rights", "Official report of the Supreme Court of the United States; a work of the U.S. government (17 U.S.C. § 105).",
                                 str(path)], check=True)
    for row in csv.DictReader(REPORT.open(encoding="utf-8")):
        if not row["key"] or " U.S. " not in row["citation"]:
            continue
        volume, page = row["citation"].split(" U.S. ")
        pdf = cache / "loc" / f"{loc_name(volume, page)}.pdf"
        if int(volume) > 542 or not pdf.exists() or not (SOURCES / row["key"][0] / f"{row['key']}.yaml").exists() or opinions.hashlib.sha256(pdf.read_bytes()).hexdigest() in filed:
            continue
        link = loc_pdf(volume, page)
        record = yaml.safe_load((SOURCES / row["key"][0] / f"{row['key']}.yaml").read_text(encoding="utf-8"))
        subprocess.run(mirror + ["--topic", "tile.loc.gov", "--name", link.split("tile.loc.gov/", 1)[1],
                                 "--title", record["citation"]["title"], "--obtained", f"downloaded by {SCRIPT}",
                                 "--redistribution", "yes", "--link", link, "--record", row["key"],
                                 "--rights", f"From source record {row['key']}: status live, basis us-government-work, redistribution true.",
                                 str(pdf)], check=True)


TABLE: dict = {}
SETTLED_READINGS: dict = {}
READING_LINES: dict = {}
OTHER_SCANS: dict = {}

ORDER = ["key", "kind", "citation", "caption", "opinions", "original_link", "shares_link_with", "retrieved", "archives", "history", "court_dates",
         "supreme_court", "courtlistener", "reading_links", "rights", "citator", "found_in", "notes", "tribes", "nations_in_case", "review"]


def order(record: dict) -> dict:
    return {key: record[key] for key in ORDER if key in record}


if __name__ == "__main__":
    raise SystemExit(main())
