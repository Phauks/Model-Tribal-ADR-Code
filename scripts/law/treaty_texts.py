#!/usr/bin/env python3
"""A public-domain text for each treaty and treaty-related record that has no stored copy (Nov. 28, 2026).

The unratified treaties, related papers and agreements that scripts/law/treaty_records.py wrote link only the Oklahoma
State University Tribal Treaties Database, whose transcriptions are third-party and are not republished. This script
finds each document in a public-domain government printing instead, stores that printing's text for the pages the
document fills, and gives the record the copy. The printings:

- Kappler, Indian Affairs: Laws and Treaties, vols. 1 to 5 (Government Printing Office, 1904 to 1941), from the
  GovInfo scans of the Serial Set printings, whose PDFs carry a text layer;
- American State Papers, Indian Affairs, vols. 1 and 2 (1832 and 1834), from the Internet Archive's scans and their
  page-level full text;
- the Hawaiian Kingdom's own printing of its treaties (Honolulu, 1887), for the Hawaiian Kingdom records, from the
  Internet Archive's scan;
- other Serial Set documents on GovInfo that print a document, found by `search` through GovInfo's full-text search.

Matching. The database's transcription is read only to find the document: its word sequences are looked up in every
page of every printing, and the run of pages that holds most of them, from the page with its opening words to the page
with its closing words, is the document's place. A record is matched when that run holds at least ACCEPT of the
transcription's word sequences and its first pages carry the year (in figures or in words). Runs between REVIEW and
ACCEPT go to a short list for a person to review (research/reviews/2026-11-28-treaty-text-matches.csv). Nothing from
the database's page is stored.

Storing. The text is the printing's own text for the whole pages, from the first page of the document to its last,
under a heading naming the printing and pages. It goes to the project's bucket under treaties/<key>.txt, is checked by
size and SHA-256 after upload (metadata and the bytes read back), and gets a row in research/capture-index.csv,
written only through scripts/captures/capture_index.write_rows. The record gains a file block with the text's
checksum, as the ratified treaty records have for their Statutes at Large copies; its rights say why the text may be
served, and its notes say where the text comes from. Records stay Unverified.

The records of kind intergovernmental-agreement that are type document (tribal-state gaming compacts, county and state
agreements, a university repository's papers) have no public-domain government printing: `missing` lists them with
the reason, and this script leaves them alone.

Usage:
  python3 scripts/law/treaty_texts.py missing --work DIR    which records have no served copy
  python3 scripts/law/treaty_texts.py volumes --work DIR    download the printings and split them into pages
  python3 scripts/law/treaty_texts.py match --work DIR      find each record's pages (reads the database's pages once)
  python3 scripts/law/treaty_texts.py search --work DIR     look for the unmatched ones in the Serial Set on GovInfo
                                                            (needs DATA_GOV_API_KEY); then run volumes and match again
  python3 scripts/law/treaty_texts.py store --work DIR      upload the texts, check them, add index rows
  python3 scripts/law/treaty_texts.py apply --work DIR      give the records their copies

`store` needs R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and CLOUDFLARE_ACCOUNT_ID in the environment, and boto3.
"""
from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import html as html_text
import json
import os
import re
import subprocess
import sys
import time
import urllib.request
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

import yaml

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "captures"))
import capture_index  # noqa: E402
import mirror_captures  # noqa: E402

SOURCES = ROOT / "content" / "sources"
REVIEW_FILE = ROOT / "research" / "reviews" / "2026-11-28-treaty-text-matches.csv"
SESSION = "2026-11-28-treaty-texts"
TODAY = "2026-11-28"
ACCEPT = 0.6
OWN_ACCEPT = 0.5
REVIEW = 0.45
LONGEST = 40  # pages: a longer run is not one document
SERVED_MEDIA = {"application/pdf", "text/html", "text/plain", "image/jpeg"}
GOVERNMENT_WORK = "United States government work (17 U.S.C. § 105)."
GOVERNMENT_BASIS = ["us-government-work", "A work of the United States government, not subject to copyright (17 U.S.C. § 105)."]
GOVINFO = "https://www.govinfo.gov/content/pkg/{package}/pdf/{package}.pdf"
ARCHIVE = "https://archive.org/download/{item}/{item}{suffix}"
SEARCH = "https://api.govinfo.gov/search"
SUMMARY = "https://api.govinfo.gov/packages/{package}/summary"
SERIAL_SET_FILE = "serial-set.json"
LARGEST_DOCUMENT = 1200  # pages: a Serial Set document longer than this is not downloaded
SHORT_DOCUMENT = 200  # pages: a Serial Set document this short is downloaded for one record
KAPPLER = "Kappler, Indian Affairs: Laws and Treaties"


def kappler(volume: str, package: str, detail: str) -> dict:
    return {"pdf": GOVINFO.format(package=package), "scan": "GovInfo", "short": f"{KAPPLER}, vol. {volume}",
            "name": f"{KAPPLER}, vol. {volume} ({detail})", "rights": GOVERNMENT_WORK, "basis": GOVERNMENT_BASIS}


def public_domain(note: str) -> dict:
    return {"rights": f"{note}: public domain.", "basis": ["public-domain", f"{note}: public domain."]}


# Each printing: where its scan is, how a note names it, and why it may be served. The order is the order of
# preference when two printings hold the same document.
VOLUMES = {
    "kappler-2": kappler("2", "SERIALSET-04624_00_00-001-0319-0002", "Government Printing Office, 1904; S. Doc. No. 319, 58th Cong., 2d sess., Serial Set No. 4624"),
    "kappler-1": kappler("1", "SERIALSET-04623_00_00-001-0319-0000", "Government Printing Office, 1904; S. Doc. No. 319, 58th Cong., 2d sess., Serial Set No. 4623"),
    "kappler-3": kappler("3", "SERIALSET-06166_00_00-002-0719-0000", "Government Printing Office, 1913; S. Doc. No. 719, 62d Cong., 2d sess., Serial Set No. 6166"),
    "kappler-4": kappler("4", "SERIALSET-08849_00_00-002-0053-0000", "Government Printing Office, 1929; S. Doc. No. 53, 70th Cong., 1st sess., Serial Set No. 8849"),
    "kappler-5": kappler("5", "SERIALSET-10458_00_00-002-0194-0000", "Government Printing Office, 1941; S. Doc. No. 194, 76th Cong., 3d sess., Serial Set No. 10458"),
    "asp-indian-affairs-1": {"archive": "americanstatepap_c01unit", "scan": "Internet Archive", "short": "American State Papers, Indian Affairs, vol. 1",
                             "name": "American State Papers, Indian Affairs, vol. 1 (Gales and Seaton, 1832)",
                             **public_domain("Printed by order of Congress in American State Papers (1832)")},
    "asp-indian-affairs-2": {"archive": "americanstatepap_d02unit", "scan": "Internet Archive", "short": "American State Papers, Indian Affairs, vol. 2",
                             "name": "American State Papers, Indian Affairs, vol. 2 (Gales and Seaton, 1834)",
                             **public_domain("Printed by order of Congress in American State Papers (1834)")},
    "hawaiian-kingdom-treaties-1887": {
        "pdf": "https://archive.org/download/ahn1084.0001.001.umich.edu/ahn1084.0001.001.umich.edu.pdf", "item": "ahn1084.0001.001.umich.edu",
        "scan": "Internet Archive", "short": "Treaties and Conventions Concluded Between the Hawaiian Kingdom and Other Powers, Since 1825",
        "name": "Treaties and Conventions Concluded Between the Hawaiian Kingdom and Other Powers, Since 1825 (Honolulu, 1887)",
        **public_domain("Printed by the Hawaiian Kingdom government in 1887")},
    "statutes-at-large-8-116": {
        "pdf": "https://www.govinfo.gov/content/pkg/STATUTE-8/pdf/STATUTE-8-Pg116.pdf", "scan": "GovInfo", "first_page": 116,
        "short": "8 Stat. 116", "name": "Statutes at Large, vol. 8 (Little, Brown, 1846), the treaty's granule on GovInfo",
        "rights": GOVERNMENT_WORK, "basis": GOVERNMENT_BASIS},
}
# Records the database does not hold, with the printing that is the whole document.
WHOLE = {"jay-treaty-1794": "statutes-at-large-8-116"}


def printings(work: Path) -> dict[str, dict]:
    """The fixed printings, then the Serial Set documents `search` found."""
    found = work / SERIAL_SET_FILE
    extra = json.loads(found.read_text(encoding="utf-8"))["printings"] if found.exists() else {}
    return {**VOLUMES, **extra}


# ---------------------------------------------------------------- which records

def link_for_matching(link: str | None) -> str | None:
    """The site's linkForMatching (site/src/lib/public-copies.ts): https, no fragment."""
    if not link or not re.match(r"https?://", link):
        return None
    parts = urlsplit(link)
    return urlunsplit(("https", parts.netloc, parts.path or "/", parts.query, ""))


def served_copies() -> tuple[set, set]:
    """The links and SHA-256 digests of the copies the site serves (content.ts indexedCopies)."""
    links, digests = set(), set()
    for row in capture_index.read_rows():
        if (row["redistribution"] != "yes" or row["derived_from"] or row["media_type"] not in SERVED_MEDIA
                or {"westlaw", "articles"} & {row["topic"], row["key"].split("/")[0]}):
            continue
        digests.add(row["sha256"])
        links.update(filter(None, map(link_for_matching, row["link"].split())))
    return links, digests


def no_copy_records() -> list[dict]:
    """Records of kind intergovernmental-agreement, type treaty or document, that the site finds no copy for."""
    links, digests = served_copies()
    found = []
    for path in sorted(SOURCES.glob("*/*.yaml")):
        text = path.read_text(encoding="utf-8")
        if "kind: intergovernmental-agreement" not in text:
            continue
        record = yaml.load(text, Loader=getattr(yaml, "CSafeLoader", yaml.SafeLoader))
        citation = record.get("citation") or {}
        if record.get("kind") != "intergovernmental-agreement" or citation.get("type") not in ("treaty", "document"):
            continue
        if ((record.get("file") or {}).get("checksum") in digests or link_for_matching(record.get("original_link")) in links
                or link_for_matching(citation.get("URL")) in links):
            continue
        issued = (citation.get("issued") or {}).get("date-parts") or [[None]]
        found.append({"key": record["key"], "path": str(path.relative_to(ROOT)), "type": citation["type"],
                      "title": citation.get("title", ""), "year": issued[0][0], "url": citation.get("URL") or "",
                      "original_link": record.get("original_link") or "", "notes": record.get("notes", "")})
    return found


def reason_without_printing(record: dict) -> str:
    """Why a document record is left alone."""
    host = urlsplit(record["url"] or record["original_link"]).netloc
    if record["key"].startswith(("compact-", "california-")) or "gaming" in record["title"].lower():
        return "tribal-state gaming compact: not a federal printing"
    if host == "digitalrepository.unm.edu":
        return "University of New Mexico repository document: not a federal printing"
    if host == "cops.usdoj.gov":
        return "tribal-county or tribal-state agreement posted by the Justice Department: the parties' document, not a federal printing"
    return f"no public-domain government printing known ({host or 'no link'})"


def missing(args) -> None:
    work = Path(args.work)
    work.mkdir(parents=True, exist_ok=True)
    records = no_copy_records()
    for record in records:
        if record["type"] == "document":
            record["left_alone"] = reason_without_printing(record)
    (work / "missing.json").write_text(json.dumps(records, indent=1), encoding="utf-8")
    print(Counter(record["type"] for record in records))
    print(Counter(record.get("left_alone", "to match") for record in records).most_common())


# ---------------------------------------------------------------- the printings

def download(url: str, path: Path, minutes: int = 60) -> Path:
    if not path.exists() or path.stat().st_size == 0:
        partial = path.with_suffix(path.suffix + ".part")
        subprocess.run(["curl", "-sSL", "--fail", "--retry", "3", "--max-time", str(minutes * 60), "-o", str(partial), url], check=True)
        partial.rename(path)
    return path


def page_label(first_line: str) -> str | None:
    match = re.match(r"^\s*(\d{1,4})\b", first_line) or re.search(r"\b(\d{1,4})\s*$", first_line)
    return match[1] if match else None


def number_pages(pages: list[dict]) -> None:
    """Give each page the printed number that most of the running heads within six pages count to, when at least three
    agree, or its own head's number when a neighbor agrees with it."""
    known = {page["index"]: int(page["read"]) for page in pages if page.get("read") and page["read"].isdigit()}
    for page in pages:
        index = page["index"]
        votes = Counter(known[other] + index - other for other in range(index - 6, index + 7) if other in known)
        own = known.get(index)
        best = votes.most_common(1)[0] if votes else (None, 0)
        if own is not None and votes.get(own, 0) >= 2:
            page["page"] = str(own)
        elif best[1] >= 3 and best[0] > 0:
            page["page"] = str(best[0])
        else:
            page["page"] = None


def pdf_pages(name: str, volume: dict, work: Path) -> list[dict]:
    pdf = download(volume["pdf"], work / "volumes" / f"{name}.pdf", minutes=90)
    text = subprocess.run(["pdftotext", str(pdf), "-"], capture_output=True, text=True, check=True).stdout
    pages = []
    for index, body in enumerate(text.split("\f")[:-1], start=1):
        lines = [line.strip() for line in body.splitlines() if line.strip()]
        pages.append({"index": index, "read": page_label(lines[0]) if lines else None, "text": body.strip()})
    return pages


def archive_pages(name: str, volume: dict, work: Path) -> list[dict]:
    item, folder = volume["archive"], work / "volumes"
    search = download(ARCHIVE.format(item=item, suffix="_hocr_searchtext.txt.gz"), folder / f"{name}.searchtext.gz")
    index = download(ARCHIVE.format(item=item, suffix="_hocr_pageindex.json.gz"), folder / f"{name}.pageindex.gz")
    numbers = download(ARCHIVE.format(item=item, suffix="_page_numbers.json"), folder / f"{name}.page_numbers.json")
    text = gzip.open(search, "rt", encoding="utf-8").read()
    spans = json.loads(gzip.open(index, "rt", encoding="utf-8").read())
    printed = {entry["leafNum"]: entry["pageNumber"] for entry in json.loads(numbers.read_text())["pages"]}
    pages = []
    for leaf, span in enumerate(spans):
        body = text[span[0]:span[1]].strip()
        lines = [line for line in body.splitlines() if line.strip()]
        read = printed.get(leaf) or (page_label(lines[0]) if lines else None)
        pages.append({"index": leaf, "read": read if read and read.isdigit() else None, "text": body})
    return pages


def volume_pages(name: str, work: Path) -> list[dict]:
    cached = work / "volumes" / f"{name}.pages.json"
    if cached.exists():
        pages = json.loads(cached.read_text(encoding="utf-8"))
    else:
        cached.parent.mkdir(parents=True, exist_ok=True)
        volume = printings(work)[name]
        pages = pdf_pages(name, volume, work) if "pdf" in volume else archive_pages(name, volume, work)
        cached.write_text(json.dumps(pages), encoding="utf-8")
    number_pages(pages)
    first_page = printings(work)[name].get("first_page")
    for position, page in enumerate(pages):
        if first_page:
            page["page"] = str(first_page + position)
    return pages


def volumes(args) -> None:
    work = Path(args.work)

    def one(name: str) -> str:
        try:
            pages = volume_pages(name, work)
        except subprocess.CalledProcessError as error:
            return f"{name}: not downloaded ({error})"
        return f"{name}: {len(pages)} pages, {sum(1 for page in pages if page['page'])} numbered"

    with ThreadPoolExecutor(6) as pool:  # several downloads at once; GovInfo sends each slowly
        for line in pool.map(one, args.only or printings(work)):
            print(line, flush=True)


def label(page: dict) -> str:
    return page["page"] or f"[scan page {page['index']}]"


def page_link(volume: dict, page: dict) -> str:
    if "item" in volume or "archive" in volume:
        leaf = page["index"] - 1 if "pdf" in volume else page["index"]
        return f"https://archive.org/details/{volume.get('item') or volume['archive']}/page/n{leaf}/mode/1up"
    return volume["pdf"] + f"#page={page['index']}"


# ---------------------------------------------------------------- matching

def words(text: str) -> list[str]:
    text = text.lower().replace("¬\n", "").replace("-\n", "")
    return [word for word in re.findall(r"[a-z]+", text) if len(word) > 1]


def shingles(text: str, size: int = 3) -> list[str]:
    """The text's word sequences, in order."""
    found = words(text)
    return [" ".join(found[i:i + size]) for i in range(len(found) - size + 1)]


def osu_body(page_html: str) -> str:
    """The database page's transcription, read only to find the document in a printing."""
    start = page_html.find("col-sm-11 col-sm-offset-1")
    if start < 0:
        return ""
    end = page_html.find("footer-header-div", start)
    body = page_html[start:end if end > 0 else None]
    body = re.sub(r"(?s)<(script|style)[^>]*>.*?</\1>", " ", body)
    body = re.sub(r"<br\s*/?>|</p>", "\n", body)
    return html_text.unescape(re.sub(r"<[^>]+>", " ", body)).replace("Additional Resources", " ")


def database_bodies(records: list[dict], work: Path) -> dict[str, str]:
    """Each record's database transcription, from the page saved on the first run (about one request a second)."""
    folder = work / "database-pages"
    folder.mkdir(parents=True, exist_ok=True)
    bodies = {}
    for record in records:
        link = record["original_link"] or record["url"]
        if "treaties.okstate.edu" not in link:
            continue
        path = folder / f"{record['key']}.html"
        if not path.exists():
            result = subprocess.run(["curl", "-sSL", "--fail", "--max-time", "60", link], capture_output=True)
            if result.returncode == 0:
                path.write_bytes(result.stdout)
            time.sleep(1)
        if path.exists():
            bodies[record["key"]] = osu_body(path.read_text(encoding="utf-8", errors="replace"))
    return bodies


class Printing:
    """One printing's pages, with each page's word sequences, for finding a document in it."""

    def __init__(self, name: str, pages: list[dict]):
        self.name, self.pages = name, pages
        self.page_shingles = [set(shingles(page["text"])) for page in pages]
        self.where = defaultdict(list)
        for position, found in enumerate(self.page_shingles):
            for shingle in found:
                self.where[shingle].append(position)

    def find(self, ordered: list[str], own: set) -> dict | None:
        """The pages that hold the document: around the page with most of its rarer word sequences, from the page with
        its opening sequences to the page with its closing ones, and any page beside them that adds more of it."""
        wanted = set(ordered)
        rare = {shingle: places for shingle in wanted if 0 < len(places := self.where.get(shingle, ())) <= 3}
        hits = Counter(position for places in rare.values() for position in places)
        if not hits:
            return None
        best = hits.most_common(1)[0][0]
        low = high = best

        def some(position: int) -> bool:
            return 0 <= position < len(self.pages) and hits[position] >= max(5, 0.04 * len(self.page_shingles[position]))

        while some(low - 1) and best - low < LONGEST:
            low -= 1
        while some(high + 1) and high - best < LONGEST:
            high += 1
        inside = [[position for position in rare[shingle] if low <= position <= high] for shingle in ordered if shingle in rare]
        inside = [places for places in inside if places]
        ends = [Counter(position for places in part for position in places).most_common(1)[0][0] for part in (inside[:40], inside[-40:])]
        first, last = min(ends), max(ends)
        covered = set().union(*self.page_shingles[first:last + 1]) & wanted
        for step in (-1, 1):
            while low <= (edge := (first if step < 0 else last) + step) <= high:
                gain = (self.page_shingles[edge] & wanted) - covered
                if len(gain) < max(5, 0.02 * len(wanted)):
                    break
                covered |= gain
                first, last = min(first, edge), max(last, edge)
        return {"printing": self.name, "first": first, "last": last, "coverage": round(len(covered) / len(wanted), 3),
                "own_coverage": round(len(covered & own) / len(own), 3) if own else None}


ONES = "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split()
TENS = "twenty thirty forty fifty sixty seventy eighty ninety".split()


def year_in_words(year: int) -> str:
    """1820 as a treaty writes it after "one thousand": "eight hundred and twenty"."""
    hundreds, rest = divmod(year % 1000, 100)
    tail = ONES[rest] if rest < 20 else TENS[rest // 10 - 2] + ("" if rest % 10 == 0 else " " + ONES[rest % 10])
    return f"{ONES[hundreds]} hundred" + (f" and {tail}" if rest else "")


def year_on_first_pages(record: dict, printing: Printing, place: dict) -> bool:
    """The record's year, or the next (when the paper went to Congress then), is on the first page or the one after, in
    figures or in words."""
    if not record.get("year"):
        return True
    year = int(record["year"])
    text = " ".join(printing.pages[position]["text"] for position in range(place["first"], min(place["last"], place["first"] + 1) + 1))
    return any(str(candidate) in text for candidate in (year, year + 1)) or year_in_words(year) in " ".join(words(text))


def match(args) -> None:
    work = Path(args.work)
    records = [record for record in json.loads((work / "missing.json").read_text()) if not record.get("left_alone")]
    bodies = database_bodies(records, work)
    known = printings(work)
    order = list(known)
    loaded = {name: Printing(name, volume_pages(name, work)) for name in args.only or known}
    # Word sequences that only one record's transcription has (its places, people and terms): a treaty written on
    # the same form as another must find its own in the pages too, not only the form's wording.
    counts = Counter(shingle for body in bodies.values() for shingle in set(shingles(body)))
    results, review = [], []
    for record in records:
        wanted = shingles(bodies.get(record["key"], ""))
        own = {shingle for shingle in wanted if counts[shingle] == 1}
        result = {"key": record["key"], "title": record["title"], "year": record["year"], "shingles": len(wanted)}
        if record["key"] in WHOLE and WHOLE[record["key"]] in loaded:
            # A record the database does not hold, whose printing is known: the whole granule is the document.
            name = WHOLE[record["key"]]
            pages = loaded[name].pages
            result.update(outcome="matched", chosen={"printing": name, "first": 0, "last": len(pages) - 1, "coverage": None,
                                                     "pages": f"{label(pages[0])}-{label(pages[-1])}"})
            results.append(result)
            continue
        if len(wanted) < 25:
            result["outcome"] = "no transcription to match by" if record["key"] in bodies else "no database page"
            results.append(result)
            continue
        places = sorted(filter(None, (printing.find(wanted, own) for printing in loaded.values())), key=lambda place: -place["coverage"])
        for place in places:
            pages = loaded[place["printing"]].pages
            place["pages"] = f"{label(pages[place['first']])}-{label(pages[place['last']])}"
            place["year_on_first_pages"] = year_on_first_pages(record, loaded[place["printing"]], place)
        result["places"] = places[:3]
        good = [place for place in places if place["coverage"] >= ACCEPT and place["year_on_first_pages"]
                and (place["own_coverage"] is None or len(own) < 30 or place["own_coverage"] >= OWN_ACCEPT)
                and place["last"] - place["first"] < LONGEST]
        if good:
            # When two printings hold it (a paper in American State Papers and in Kappler's appendix), the first in
            # order of preference among those within a tenth of the best is used.
            near = [place for place in good if place["coverage"] >= good[0]["coverage"] - 0.1]
            result.update(outcome="matched", chosen=min(near, key=lambda place: order.index(place["printing"])))
        elif places and places[0]["coverage"] >= REVIEW:
            best = places[0]
            result["outcome"] = "review"
            review.append({"key": record["key"], "title": record["title"], "year": record["year"],
                           "printing": known[best["printing"]]["short"], "pages": best["pages"], "coverage": best["coverage"],
                           "year_on_first_pages": best["year_on_first_pages"], "own_coverage": best["own_coverage"],
                           "link": page_link(known[best["printing"]], loaded[best["printing"]].pages[best["first"]]),
                           "decision": "", "note": ""})
        else:
            result["outcome"] = "not found in the printings"
        results.append(result)
    (work / "matches.json").write_text(json.dumps(results, indent=1), encoding="utf-8")
    REVIEW_FILE.parent.mkdir(parents=True, exist_ok=True)
    with REVIEW_FILE.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(review[0]) if review else ["key"], lineterminator="\n")
        writer.writeheader()
        writer.writerows(review)
    print(Counter(result["outcome"] for result in results).most_common())
    print(Counter(result["chosen"]["printing"] for result in results if result.get("chosen")).most_common())


# ---------------------------------------------------------------- the Serial Set

def govinfo(url: str, body: dict | None = None) -> dict:
    key = os.environ.get("DATA_GOV_API_KEY")
    if not key:
        sys.exit("Set DATA_GOV_API_KEY (an api.data.gov key) in the environment.")
    request = urllib.request.Request(f"{url}?api_key={key}", data=json.dumps(body).encode() if body else None,
                                     headers={"Content-Type": "application/json"} if body else {})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(request, timeout=90) as response:
                return json.load(response)
        except OSError:
            time.sleep(10 * (attempt + 1))
    return {}


def phrases(text: str, count: int = 4, size: int = 6) -> list[str]:
    """A few runs of longer words from across the transcription, to search for."""
    found = words(text)
    picked = []
    for share in [(part + 1) / (count + 1) for part in range(count)]:
        start = int(len(found) * share)
        for offset in range(0, 200):
            run = found[start + offset:start + offset + size]
            if len(run) == size and sum(len(word) > 3 for word in run) >= size - 1:
                picked.append(" ".join(run))
                break
    return picked


def ordinal(number: str) -> str:
    value = int(number)
    if value % 100 in (11, 12, 13):
        return f"{value}th"
    return f"{value}" + {1: "st", 2: "d", 3: "d"}.get(value % 10, "th")


DOCUMENT_TYPES = {"SDOC": "S. Doc.", "HDOC": "H.R. Doc.", "SRPT": "S. Rep.", "HRPT": "H.R. Rep.", "SEXDOC": "S. Exec. Doc.",
                  "HEXDOC": "H.R. Exec. Doc.", "SMISCDOC": "S. Misc. Doc.", "HMISCDOC": "H.R. Misc. Doc.", "SMISDOC": "S. Misc. Doc.",
                  "HMISDOC": "H.R. Misc. Doc."}


def serial_set_printing(summary: dict) -> dict:
    serial = re.search(r"'serialSetNumber': '(\d+)'", str(summary.get("serialSet"))) or re.search(r"SERIALSET-0*(\d+)_", summary["packageId"])
    kind = DOCUMENT_TYPES.get(summary.get("documentType", ""), summary.get("documentType", "Doc."))
    session = summary.get("session")
    title = re.split(r"(?<=[a-z]{3})\. ", summary.get("title", ""), maxsplit=1)[0].rstrip(".")
    detail = (f"{kind} No. {summary.get('documentNumber')}, {ordinal(summary['congress'])} Cong."
              + (f", {ordinal(session)} sess." if session and session.isdigit() else "")
              + f" ({summary.get('dateIssued', '')[:4]}), Serial Set No. {serial[1] if serial else '?'}")
    short = f"{title[:150]}, {detail}"
    return {"pdf": GOVINFO.format(package=summary["packageId"]), "scan": "GovInfo", "short": short,
            "name": f"{short} (Government Printing Office)", "rights": GOVERNMENT_WORK, "basis": GOVERNMENT_BASIS,
            "pages": int(summary.get("pages") or 0)}


def search(args) -> None:
    """For each record no printing holds, search GovInfo's Serial Set for a few of its phrases and keep each document
    that holds at least two of them as a further printing."""
    work = Path(args.work)
    found_file = work / SERIAL_SET_FILE
    found = json.loads(found_file.read_text()) if found_file.exists() else {"printings": {}, "searched": {}}
    found.setdefault("documents", found.get("printings", {}))
    records = {record["key"]: record for record in json.loads((work / "missing.json").read_text())}
    results = json.loads((work / "matches.json").read_text())
    bodies = database_bodies([records[result["key"]] for result in results], work)
    for result in results:
        if (result["outcome"] == "matched" or result["key"] in found["searched"] or result["key"] not in bodies
                or (args.records and not re.match(args.records, result["key"]))):
            continue
        year = int(result["year"] or 1800)
        hits = Counter()
        queries = [{"query": f'collection:SERIALSET AND content:"{phrase}" AND publishdate:range({year - 1}-01-01,1980-12-31)',
                    "pageSize": 10, "offsetMark": "*"} for phrase in phrases(bodies[result["key"]])]
        with ThreadPoolExecutor(len(queries) or 1) as pool:
            for answer in pool.map(lambda body: govinfo(SEARCH, body), queries):
                hits.update({entry["packageId"] for entry in answer.get("results", [])})
        fixed = {volume.get("pdf") for volume in VOLUMES.values()}
        candidates = [package for package, count in hits.most_common(4) if count >= 2 and GOVINFO.format(package=package) not in fixed][:3]
        found["searched"][result["key"]] = candidates
        for package in candidates:
            name = serial_set_name(package)
            if name not in found["documents"]:
                found["documents"][name] = serial_set_printing(govinfo(SUMMARY.format(package=package)) or {"packageId": package})
        found_file.write_text(json.dumps(found, indent=1), encoding="utf-8")
    # The documents worth downloading: those found for a record still unmatched, short (SHORT_DOCUMENT pages or
    # fewer) or found for three records or more, and not another edition of Kappler.
    unmatched = {result["key"] for result in results if result["outcome"] != "matched"}
    wanted = Counter(name for key, packages in found["searched"].items() if key in unmatched
                     for name in map(serial_set_name, packages))
    found["printings"] = {name: document for name, document in found["documents"].items()
                          if wanted[name] and not document["short"].lower().startswith("indian affairs: laws and treaties")
                          and (document.get("pages", 0) <= SHORT_DOCUMENT or (wanted[name] >= 3 and document.get("pages", 0) <= LARGEST_DOCUMENT))}
    found_file.write_text(json.dumps(found, indent=1), encoding="utf-8")
    print(f"searched {len(found['searched'])} records; found {len(found['documents'])} documents, {len(found['printings'])} to download "
          f"({sum(document.get('pages', 0) for document in found['printings'].values())} pages)")


def serial_set_name(package: str) -> str:
    return "serial-set-" + package.removeprefix("SERIALSET-").lower().replace("_", "-")


# ---------------------------------------------------------------- storing

def page_span(first: str, last: str) -> str:
    return f"p. {first}" if first == last else f"pp. {first}–{last}"


def stored_text(record: dict, volume: dict, pages: list[dict]) -> str:
    span = page_span(label(pages[0]), label(pages[-1]))
    scan = (f"the text layer of the {volume['scan']} scan, {volume['pdf']}" if "pdf" in volume
            else f"the Internet Archive's full text of its scan, https://archive.org/details/{volume['archive']}")
    lines = [record["title"], "", f"From {volume['name']}, {span}.", f"Text: {scan} (machine-read, so some words are misread).",
             "The pages are given whole, so the first and last may also hold the end of the paper before and the start of the one after.", ""]
    for page in pages:
        lines += [f"[Page {label(page)}]", "", re.sub(r"[ \t]+", " ", page["text"]).replace(" \n", "\n").strip(), ""]
    return "\n".join(lines)


def store(args) -> None:
    work = Path(args.work)
    results = [result for result in json.loads((work / "matches.json").read_text()) if result.get("outcome") == "matched"]
    records = {record["key"]: record for record in json.loads((work / "missing.json").read_text())}
    out = work / "texts"
    out.mkdir(exist_ok=True)
    rows = {row["key"]: row for row in capture_index.read_rows()}
    s3, bucket = mirror_captures.client(), mirror_captures.bucket_name()
    known, loaded, stored = printings(work), {}, []
    for result in results:
        chosen, record = result["chosen"], records[result["key"]]
        volume = known[chosen["printing"]]
        if chosen["printing"] not in loaded:
            loaded[chosen["printing"]] = volume_pages(chosen["printing"], work)
        pages = loaded[chosen["printing"]][chosen["first"]:chosen["last"] + 1]
        body = stored_text(record, volume, pages).encode("utf-8")
        key, digest = f"treaties/{record['key']}.txt", hashlib.sha256(body).hexdigest()
        if key in rows and rows[key]["sha256"] != digest:
            print(f"skipped {key}: the index already has a different file there", file=sys.stderr)
            continue
        local = out / f"{record['key']}.txt"
        local.write_bytes(body)
        if mirror_captures.remote_state(s3, bucket, key) != (len(body), digest):
            s3.upload_file(str(local), bucket, key, ExtraArgs={"ContentType": "text/plain; charset=utf-8", "Metadata": {
                "sha256": digest, "captured": TODAY, "records": record["key"]}})
        if mirror_captures.remote_state(s3, bucket, key) != (len(body), digest):
            sys.exit(f"upload check failed for {key}: size or SHA-256 differs in the bucket")
        if hashlib.sha256(s3.get_object(Bucket=bucket, Key=key)["Body"].read()).hexdigest() != digest:
            sys.exit(f"upload check failed for {key}: the bytes read back differ")
        span = page_span(label(pages[0]), label(pages[-1]))
        rows[key] = {
            "key": key, "bytes": str(len(body)), "sha256": digest, "media_type": "text/plain", "topic": "treaties",
            "title": f"{record['title']} ({volume['short']}, {span})", "nations": "",
            "obtained": f"text of the printing's {volume['scan']} scan, saved by scripts/law/treaty_texts.py, {TODAY}",
            "link": page_link(volume, pages[0]), "captured": TODAY, "records": record["key"], "record_kinds": "source",
            "listed_in": "", "catalog": "", "derived_from": "", "rights": volume["rights"], "redistribution": "yes",
            "keep_local": "yes", "orphan": "no"}
        stored.append({"key": record["key"], "storage_key": key, "checksum": digest, "bytes": len(body),
                       "printing": chosen["printing"], "span": span})
    capture_index.write_rows(rows.values())
    (work / "stored.json").write_text(json.dumps(stored, indent=1), encoding="utf-8")
    print(f"stored and checked {len(stored)} texts")


# ---------------------------------------------------------------- the records

def dump(value) -> str:
    return yaml.safe_dump(value, allow_unicode=True, sort_keys=False, width=float("inf"))


def source_sentence(volume: dict, span: str) -> str:
    where = f"the {volume['scan']} scan's text layer" if "pdf" in volume else "the Internet Archive scan's full text"
    return (f"Stored text, Nov. 28, 2026 (scripts/law/treaty_texts.py): the pages that hold it in {volume['short']} ({span}), "
            f"from {where}; the database's transcription is not copied.")


def apply(args) -> None:
    work = Path(args.work)
    stored = json.loads((work / "stored.json").read_text())
    records = {record["key"]: record for record in json.loads((work / "missing.json").read_text())}
    known, changed = printings(work), 0
    for copy in stored:
        path = ROOT / records[copy["key"]]["path"]
        text = path.read_text(encoding="utf-8")
        if "\nfile:\n" in text:
            continue
        volume = known[copy["printing"]]
        block = {"storage_key": copy["storage_key"], "checksum": copy["checksum"], "media_type": "text/plain", "bytes": copy["bytes"]}
        text = text.replace("\nrights:\n", "\n" + dump({"file": block}) + "rights:\n", 1)
        rights = {"status": "no-permission-needed", "basis": volume["basis"][0], "basis_note": volume["basis"][1], "redistribution": True}
        text = re.sub(r"^rights:\n(?:[ ].*\n)+", lambda _: dump({"rights": rights}), text, count=1, flags=re.M)
        notes = yaml.safe_load(text).get("notes", "")
        sentence = source_sentence(volume, copy["span"])
        if " It stays Unverified" in notes:
            notes = notes.replace(" It stays Unverified", f" {sentence} It stays Unverified", 1)
        else:
            notes = f"{notes} {sentence}".strip()
        text = re.sub(r"^notes:.*(?:\n[ ].*)*", lambda _: dump({"notes": notes}).rstrip("\n"), text, count=1, flags=re.M)
        if SESSION not in text:
            text = re.sub(r"\nfound_in:\n((?:- .*\n)+)", lambda found: f"\nfound_in:\n{found[1]}- {SESSION}\n", text, count=1)
        assert yaml.safe_load(text)["file"]["checksum"] == copy["checksum"]
        path.write_text(text, encoding="utf-8")
        changed += 1
    print(f"gave {changed} records their stored text")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    steps = {"missing": missing, "volumes": volumes, "match": match, "search": search, "store": store, "apply": apply}
    parser.add_argument("step", choices=list(steps))
    parser.add_argument("--work", required=True, help="a folder for downloads and intermediate files")
    parser.add_argument("--only", nargs="*", help="volumes and match: only these printings")
    parser.add_argument("--records", help="search: only the records whose key matches this pattern")
    args = parser.parse_args()
    steps[args.step](args)


if __name__ == "__main__":
    main()
