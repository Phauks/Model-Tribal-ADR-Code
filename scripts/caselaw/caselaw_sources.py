"""Shared helpers for the free case law sources (research/analyses/2026-11-23-free-legal-information-sources.md).

Two sources are used, both without an account or key:

- CourtListener's quarterly bulk files (Free Law Project), published with a
  Public Domain Mark at https://com-courtlistener-storage.s3-us-west-2.amazonaws.com/
  under bulk-data/. Each release is a full snapshot named by its date, such as
  citations-2026-09-30.csv.bz2. `latest_release()` finds the newest date for
  which every file a script needs exists, so the scripts pick up each new
  quarter on their own.
- The Caselaw Access Project's static files (Harvard Library Innovation Lab) at
  https://static.case.law/, released without restriction in March 2024: one
  folder per reporter, with ReportersMetadata.json, VolumesMetadata.json,
  CasesMetadata.json per volume and one zip per volume.

Downloads go to a cache folder outside the repository and are reused while
their size matches the server's, so a re-run only fetches what changed.
"""

from __future__ import annotations

import bz2
import csv
import json
import re
import subprocess
import sys
import urllib.parse
from pathlib import Path
from typing import Iterator

COURTLISTENER_BULK = "https://com-courtlistener-storage.s3-us-west-2.amazonaws.com"
CASELAW_ACCESS_PROJECT = "https://static.case.law"
USER_AGENT = "model-tribal-adr-code research script (free legal information sources)"

csv.field_size_limit(sys.maxsize)


def fetch_bytes(url: str) -> bytes:
    """GET a URL with curl, which uses the environment's proxy settings and certificates."""
    result = subprocess.run(["curl", "-sSfL", "-A", USER_AGENT, url], capture_output=True, check=True)
    return result.stdout


def fetch_json(url: str):
    return json.loads(fetch_bytes(url))


def remote_size(url: str) -> int | None:
    result = subprocess.run(["curl", "-sSfIL", "-A", USER_AGENT, url], capture_output=True, text=True)
    sizes = re.findall(r"(?im)^content-length:\s*(\d+)", result.stdout)
    return int(sizes[-1]) if sizes else None


def download(url: str, target: Path) -> Path:
    """Download url to target unless a file of the same size is already there."""
    size = remote_size(url)
    if target.exists() and size is not None and target.stat().st_size == size:
        return target
    target.parent.mkdir(parents=True, exist_ok=True)
    partial = target.with_suffix(target.suffix + ".part")
    subprocess.run(["curl", "-sSfL", "-A", USER_AGENT, "-o", str(partial), url], check=True)
    partial.replace(target)
    return target


# ---------------------------------------------------------------- CourtListener bulk data

def bulk_files() -> dict[str, int]:
    """Every file under bulk-data/ with its size in bytes."""
    files: dict[str, int] = {}
    token = None
    while True:
        query = {"list-type": "2", "prefix": "bulk-data/", "max-keys": "1000"}
        if token:
            query["continuation-token"] = token
        text = fetch_bytes(f"{COURTLISTENER_BULK}/?{urllib.parse.urlencode(query)}").decode("utf-8")
        for key, size in re.findall(r"<Key>(.*?)</Key>.*?<Size>(\d+)</Size>", text, re.S):
            files[key] = int(size)
        match = re.search(r"<NextContinuationToken>(.*?)</NextContinuationToken>", text)
        if "<IsTruncated>true</IsTruncated>" not in text or not match:
            return files
        token = match.group(1)


def latest_release(names: list[str]) -> str:
    """The newest release date (YYYY-MM-DD) for which every named table (such as "citations") exists."""
    files = bulk_files()
    dates = None
    for name in names:
        found = {m.group(1) for key in files if (m := re.fullmatch(rf"bulk-data/{re.escape(name)}-(\d{{4}}-\d{{2}}-\d{{2}})\.csv\.bz2", key))}
        dates = found if dates is None else dates & found
    if not dates:
        sys.exit(f"no CourtListener release has all of: {', '.join(names)}")
    return max(dates)


def bulk_url(name: str, release: str) -> str:
    return f"{COURTLISTENER_BULK}/bulk-data/{name}-{release}.csv.bz2"


def read_bulk_csv(path: Path) -> Iterator[dict]:
    """Rows of a downloaded bulk file: PostgreSQL COPY output (FORMAT csv, ESCAPE '\\', HEADER), as the Free Law Project's load script reads it."""
    with bz2.open(path, "rt", encoding="utf-8", newline="") as handle:
        yield from csv.DictReader(handle, escapechar="\\", doublequote=False)


# ---------------------------------------------------------------- Caselaw Access Project

def cap_reporters() -> list[dict]:
    return fetch_json(f"{CASELAW_ACCESS_PROJECT}/ReportersMetadata.json")


def cap_volumes(reporter: str) -> list[dict]:
    return fetch_json(f"{CASELAW_ACCESS_PROJECT}/{reporter}/VolumesMetadata.json")


def cap_volume_zip(reporter: str, volume_folder: str, cache: Path) -> Path:
    return download(f"{CASELAW_ACCESS_PROJECT}/{reporter}/{volume_folder}.zip", cache / reporter / f"{volume_folder}.zip")


def cap_case_link(reporter: str, volume_folder: str, file_name: str) -> str:
    """The readable page of one case on case.law's static site."""
    return f"{CASELAW_ACCESS_PROJECT}/{reporter}/{volume_folder}/html/{file_name}.html"


# ---------------------------------------------------------------- citations

# Spelled-out reporter names some records use, mapped to the abbreviations
# CourtListener's citations table uses (from the Free Law Project's reporters-db).
REPORTER_NAMES = {
    "United States Reports": "U.S.",
    "American Samoa Reports, Third Series": "Am. Samoa 3d",
    "American Samoa Reports, Second Series": "Am. Samoa 2d",
    "American Samoa Reports": "Am. Samoa",
}

# A citation: volume, reporter and first page, such as "436 U.S. 49",
# "163 F. Supp. 3d 769" or the neutral "2000 WI 79". Matches that are not
# real citations simply find nothing in the citations table.
CITATION = re.compile(r"\b(\d{1,4}) ((?:[A-Z][A-Za-z.']*|\d(?:d|th|st|nd|rd))(?: (?:[A-Z][A-Za-z.']*|\d(?:d|th|st|nd|rd)))*) (\d{1,6})\b")
NOT_REPORTERS = {"WL", "LEXIS", "No.", "Nos.", "U.S.C.", "C.F.R.", "Stat.", "Fed. Reg.", "U.S.C.A."}


def normalize_reporter(reporter: str) -> str:
    reporter = REPORTER_NAMES.get(reporter.strip(), reporter.strip())
    return re.sub(r"\s+", " ", reporter)


def citations_in(text: str) -> list[tuple[str, str, str]]:
    """(volume, reporter, page) for each citation-shaped phrase in text."""
    found = []
    for volume, reporter, page in CITATION.findall(text or ""):
        reporter = normalize_reporter(reporter)
        if reporter in NOT_REPORTERS or reporter.endswith(" WL"):
            continue
        found.append((volume, reporter, page))
    return found


def record_citations(record: dict) -> list[tuple[str, str, str]]:
    """Every citation a case source record gives: the structured one first, then any in its notes."""
    cites: list[tuple[str, str, str]] = []
    citation = record.get("citation") or {}
    container = str(citation.get("container-title") or "")
    if citation.get("volume") and citation.get("page") and container:
        cites.append((str(citation["volume"]), normalize_reporter(container), str(citation["page"])))
    elif container:
        cites.extend(citations_in(container))
    for text in (record.get("notes") or "", str(citation.get("title") or "")):
        for cite in citations_in(text):
            if cite not in cites:
                cites.append(cite)
    return cites


def party_words(name: str) -> set[str]:
    """Distinctive words of a case name, for comparing two spellings of it."""
    common = {"v", "vs", "the", "of", "and", "in", "re", "et", "al", "inc", "co", "corp", "llc", "ex", "rel",
              "united", "states", "state", "tribe", "tribes", "nation", "indians", "indian", "band", "county"}
    words = re.findall(r"[a-z0-9]+", name.lower().replace("'", ""))
    return {w for w in words if w not in common and len(w) > 2}


def names_agree(ours: str, theirs: str) -> bool:
    """True when the two case names share a distinctive party word (or both have none)."""
    a, b = party_words(ours), party_words(theirs)
    if not a or not b:
        return True
    return bool(a & b) or any(x.startswith(y) or y.startswith(x) for x in a for y in b if min(len(x), len(y)) >= 4)
