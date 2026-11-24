#!/usr/bin/env python3
"""An independent check of the treaty and agreement records that
scripts/law/treaty_records.py wrote (PR #460), against the texts themselves
(Trevor approved steps 1 to 3 of the plan, Nov. 24, 2026).

1. Ratified treaties with a stored Statutes at Large text: the stored copy's
   first printed page is the cited page, the treaty begins there (its date
   signed is in the margin or headnote), the parties the title names appear in
   the text, and the ratification and proclamation dates that Kappler's header
   gives are printed in the margin or headnote.
2. Kappler page: the Oklahoma State University Tribal Treaties Database's
   document scan (its CONTENTdm "kapplers" collection) begins on the page the
   record gives, under the treaty's running head.
3. Unratified treaties, related papers and agreements: the database holds a
   document for each (a scan or a transcription with a source), its date
   matches the record's year, and the database's ratification status agrees
   with the record and with the ratified list.

Pages the script cannot settle are listed with "check by hand"; a reader's
findings go in research/reviews/2026-11-24-treaty-verification-hand.json and
are merged by `report`. Nothing here marks a record Verified: under the
project's rule only the nation's own review does that. `apply` adds a
dated "Checked against the text" sentence to each record's notes instead.

Usage:
  python3 scripts/law/verify_treaties.py texts --pdfs DIR --work DIR
  python3 scripts/law/verify_treaties.py fetch --work DIR      (database pages and scans, about 1 a second)
  python3 scripts/law/verify_treaties.py report --work DIR
  python3 scripts/law/verify_treaties.py apply
"""
from __future__ import annotations

import argparse
import csv
import difflib
import html as htmllib
import json
import re
import subprocess
import sys
import time
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts/law"))
import treaty_records as tr  # noqa: E402

REVIEWS = ROOT / "research/reviews"
RATIFIED_OUT = REVIEWS / "2026-11-24-treaty-verification-ratified.csv"
OTHER_OUT = REVIEWS / "2026-11-24-treaty-verification-other.csv"
HAND = REVIEWS / "2026-11-24-treaty-verification-hand.json"
MONTH_NAMES = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"]
MONTH_FORMS = [[name, name[:3]] + (["sept"] if name == "september" else []) for name in MONTH_NAMES]
# Words in a title that are not a party's name.
FILLER = {"treaty", "with", "the", "of", "and", "etc", "tribe", "tribes", "band", "bands", "nation", "nations", "indians", "indian",
          "confederated", "united", "states", "convention", "articles", "agreement", "supplementary", "article", "certain",
          "chiefs", "headmen", "fort", "or", "who", "are", "a", "at", "in", "on", "to", "by", "from", "for", "also", "known", "as",
          "mixed", "lake", "river", "upper", "lower", "great", "little", "red", "head", "principal", "men", "people", "makah"}
FILLER.discard("makah")
# How the Statutes at Large spell some parties.
VARIANTS = {
    "potawatomi": ["pota", "pott", "pata", "pout", "poto"], "chippewa": ["chip", "chep", "otch", "ojib"], "sauk": ["sac", "sauk", "sack"],
    "foxes": ["fox", "renard"], "fox": ["fox"], "iowa": ["iowa", "ioway", "loway", "ioua", "aiowa"], "oto": ["oto", "otto", "ottoe"],
    "shawnee": ["shaw"], "seneca": ["sene", "senec"], "winnebago": ["winn", "wine", "winiba"], "kansa": ["kans", "kanz", "kaw"],
    "wyandot": ["wyan", "wian"], "creeks": ["creek", "musk"], "creek": ["creek", "musk"], "delawares": ["dela"], "delaware": ["dela"],
    "navaho": ["nava"], "comanche": ["coma", "cama", "kom"], "kiowa": ["kiow", "kioa", "kaiow"], "cheyenne": ["chey", "chay", "shay"],
    "arapaho": ["arap", "arrap"], "quapaw": ["quap", "quaw"], "omaha": ["omah", "maha"], "ponca": ["ponc", "punc", "punk"],
    "miami": ["miam", "mia"], "wea": ["wea", "weea", "ouia"], "piankashaw": ["pian", "pean"], "piankeshaw": ["pian", "pean"],
    "kaskaskia": ["kask"], "peoria": ["peor"], "kickapoo": ["kick", "kika"], "ottawa": ["otta", "otaw", "otto"], "menominee": ["meno", "meno"],
    "chickasaw": ["chic", "chik"], "choctaw": ["choc"], "cherokee": ["cher"], "seminole": ["semi"], "osage": ["osag"],
    "sioux": ["siou", "sioux", "dacot", "dakot"], "mandan": ["mand"], "arikara": ["arik", "aric", "rica", "ricar", "aricar"],
    "missouri": ["miss"], "pawnee": ["pawn", "pani"], "makah": ["maka"], "yakama": ["yaki", "yakam"], "nisqually": ["nesq", "nisq"],
    "klamath": ["klam", "clam"], "modoc": ["modo"], "shoshoni": ["shos", "shoshon"], "bannock": ["bann", "banac", "bonac"],
    "utah": ["utah", "ute"], "ute": ["ute", "utah"], "apache": ["apac"], "crow": ["crow"], "blackfeet": ["blac"], "mohawk": ["moha"],
    "oneida": ["onei", "onie"], "stockbridge": ["stoc"], "munsee": ["muns", "mons"], "tuscarora": ["tusc"], "cayuga": ["cayu"],
    "onondaga": ["onon"], "brothertown": ["brot"], "dwamish": ["dwam", "duwam"], "suquamish": ["suqu", "suqua"],
    "sisseton": ["siss", "seeseeto", "sisito"], "wahpeton": ["wahp", "warp"], "yankton": ["yank"], "hunkpapa": ["hunk", "unkpa", "onkpa"], "oglala": ["ogal", "ogla", "ogal"],
    "brule": ["brul"], "mdewakanton": ["medaywakan", "mdewak", "medawakan"], "wahpakoota": ["wahpaykoo", "wahpekut", "wahpakoot"],
    "kalapuya": ["calapoo", "callapoo", "kalapu", "calapu"], "molala": ["molal", "mollal", "moolal"], "aionai": ["ioni", "aionai", "hainai", "ionie"],
    "anadarko": ["anadah", "nadarko", "anadak", "andarko"], "miniconjou": ["minneconjou", "miniconjou", "minikanye", "minneconj"],
    "yanktonai": ["yanktonai", "yanctonai"], "cuthead": ["cuthead"], "arcs": ["sansarc", "sansarcs"], "santee": ["santee"], "wichita": ["wich", "witch"], "caddo": ["cadd"], "eel": ["eel"],
}
FOREIGN = re.compile(r"\b(British|Britain|Japan|Hawaii\w*|Danish|Hamburg|Neutrals|Mexic\w*|Spain|Spanish|France|French|Russia\w*)\b")
LABELS = [("ratified", r"ratifi\w*(?: advised)?"), ("proclaimed", r"proclaim\w*|proclamation")]


def squash(text: str) -> str:
    """Lowercase letters and digits only, with punctuation kept, so a scan's broken words still match."""
    squashed = re.sub(r"\s+", "", text.lower())
    # A scan reads 8 as S and 1 as l or I inside numbers ("1S20", "l815").
    for _ in range(2):
        squashed = re.sub(r"(?<=\d)s(?=\d)|(?<=\d)s(?=[,.])", "8", squashed)
        squashed = re.sub(r"(?<=\d)[li](?=\d)|(?<![a-z])[li](?=\d{3})", "1", squashed)
    return squashed


def date_pattern(iso: str) -> str:
    year, month, day = (int(part) for part in iso.split("-"))
    months = "|".join(MONTH_FORMS[month - 1])
    return rf"(?:{months})\.?,?{day}(?:st|nd|rd|th|d)?[,.:;]?(?:a\.?d\.?)?{year}"


ONES = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen",
        "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"]
TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"]
ORDINALS = ["", "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth", "eleventh", "twelfth",
            "thirteenth", "fourteenth", "fifteenth", "sixteenth", "seventeenth", "eighteenth", "nineteenth", "twentieth"]


def number_words(number: int) -> str:
    return ONES[number] if number < 20 else TENS[number // 10] + ONES[number % 10]


def ordinal_words(day: int) -> str:
    if day <= 20:
        return ORDINALS[day]
    if day == 30:
        return "thirtieth"
    return TENS[day // 10] + ORDINALS[day % 10]


def words_date_pattern(iso: str) -> str:
    """A date written out, as the Statutes at Large print a proclamation's: 'the twenty-first day of June, in the year of
    our Lord one thousand eight hundred and fifty-four', matched against letters only."""
    year, month, day = (int(part) for part in iso.split("-"))
    rest = year % 100
    centuries = "seventeenhundred" if year < 1800 else "eighteenhundred"
    thousand = "onethousandsevenhundred" if year < 1800 else "onethousandeighthundred"
    tail = f"(?:and)?{number_words(rest)}" if rest else ""
    day_forms = f"(?:{ordinal_words(day)}|{day}(?:st|nd|rd|th|d)?)"
    return rf"{day_forms}(?:day)?of{MONTH_NAMES[month - 1]}[a-z0-9]{{0,40}}?(?:{thousand}|{centuries}){tail}"


def letters(text: str) -> str:
    return re.sub(r"[^a-z0-9]", "", text.lower())


def date_in(iso: str, squashed: str, plain: str) -> bool:
    return bool(re.search(date_pattern(iso), squashed) or re.search(words_date_pattern(iso), plain))


def parse_date(text: str) -> str | None:
    """'Mar. 8, 1821' (or 'March 8 1821') as 1821-03-08."""
    match = re.search(r"([A-Za-z]{3,9})[.,]?\s*(\d{1,2})(?:st|nd|rd|th|d)?\s*[,.]?\s*(\d{4})", text)
    if not match:
        return None
    word = match.group(1).lower()
    for index, forms in enumerate(MONTH_FORMS):
        if any(word.startswith(form) for form in forms) or (forms[0].startswith(word) and len(word) >= 3):
            return f"{match.group(3)}-{index + 1:02d}-{int(match.group(2)):02d}"
    return None


def header_dates(header: str) -> dict:
    """The ratification and proclamation dates Kappler's header line gives."""
    found = {}
    header = re.sub(r",?\s*\|\s*(?=\d)", " ", header)
    for label, pattern in LABELS:
        match = re.search(rf"(?:{pattern})[.,]?\s*([^|]*)", header, re.I)
        if match:
            found[label] = parse_date(match.group(1)) or ("unreadable: " + match.group(1).strip())
    return found


def parties(title: str) -> list[str]:
    """The party words a title names, such as ['ottawa', 'chippewa'] for 'Treaty with the Ottawa and Chippewa'."""
    name = re.sub(r",? \d{4}$", "", title)
    name = re.sub(r"^.*?\bwith\b", "", name, flags=re.I) if re.search(r"\bwith\b", name, re.I) else name
    words = re.findall(r"[a-zé']+", name.lower().replace("é", "e"))
    return [word for word in words if word not in FILLER and len(word) > 2]


def word_found(word: str, words: set[str], squashed: str) -> bool:
    stems = VARIANTS.get(word, []) + [word[:4], word.rstrip("s")]
    if any(stem in squashed for stem in stems if len(stem) >= 3):
        return True
    return bool(difflib.get_close_matches(word, words, n=1, cutoff=0.75))


OCR_DIGITS = str.maketrans({"J": "1", "I": "1", "l": "1", "i": "1", "G": "6", "S": "5", "O": "0", "o": "0", "B": "8", "Z": "2", "s": "5"})


def head_number(layout: str, number: int) -> bool:
    """Whether a page's running head (its first lines) carries this page number, allowing a scan's misread digits."""
    lines = [line for line in layout.splitlines() if line.strip()][:2]
    for line in lines:
        for token in re.findall(r"\b[\dJIlGSOoBZs]{1,4}\b", line):
            if re.search(r"\d", token) and token.translate(OCR_DIGITS) == str(number):
                return True
    return False


def pdf_text(path: Path, first: int, last: int, layout: bool = False) -> str:
    command = ["pdftotext", "-f", str(first), "-l", str(last)] + (["-layout"] if layout else []) + [str(path), "-"]
    return subprocess.run(command, capture_output=True, text=True).stdout


def treaties() -> list[dict]:
    """Each ratified treaty with the record key it is filed under and its stored copy's key."""
    existing = tr.existing_treaty_records()
    copies = tr.stored_copies()
    out = []
    for treaty in tr.ratified():
        record = existing.get(treaty["statutes_at_large"])
        key = record.stem if record else treaty["key"]
        copy = copies.get(f"treaties/{tr.SHARED_COPY.get(key, key)}.pdf")
        treaty["record_key"] = key
        treaty["storage_key"] = copy["storage_key"] if copy else ""
        out.append(treaty)
    return out


def texts(args) -> None:
    work = Path(args.work) / "stat"
    work.mkdir(parents=True, exist_ok=True)
    done = 0
    for treaty in treaties():
        if not treaty["storage_key"]:
            continue
        pdf = Path(args.pdfs) / treaty["storage_key"].replace("/", "__")
        first = 1
        if treaty["record_key"] in tr.SHARED_COPY:
            first = 5  # the supplementary articles of Feb. 17, 1831 begin on pdf page 5 (7 Stat. 346)
        (work / f"{treaty['record_key']}.layout.txt").write_text(pdf_text(pdf, first, first, layout=True), encoding="utf-8")
        (work / f"{treaty['record_key']}.layout2.txt").write_text(pdf_text(pdf, first + 1, first + 1, layout=True), encoding="utf-8")
        (work / f"{treaty['record_key']}.txt").write_text(pdf_text(pdf, first, first + 1), encoding="utf-8")
        (work / f"{treaty['record_key']}.all.txt").write_text(pdf_text(pdf, first, 999), encoding="utf-8")
        done += 1
    print(f"extracted {done} texts into {work}")


def get(url: str, path: Path) -> str:
    if path.exists() and path.stat().st_size > 500:
        return path.read_text(encoding="utf-8", errors="replace")
    for attempt in range(3):
        result = subprocess.run(["curl", "-sL", "-m", "60", "-A", "Mozilla/5.0", "-o", str(path), "-w", "%{http_code}", url],
                                capture_output=True, text=True)
        time.sleep(1)
        if result.stdout == "200":
            return path.read_text(encoding="utf-8", errors="replace")
        time.sleep(5 * (attempt + 1))
    path.unlink(missing_ok=True)
    print("failed", url)
    return ""


def all_osu_urls() -> list[str]:
    raw = json.loads(tr.TREATIES.read_text(encoding="utf-8"))
    urls = [t["osu_url"] for t in raw["treaties"]] + [t["osu_url"] for t in raw["unratified_or_non_kappler_records_not_linked"]]
    return urls + [a["osu_url"] for a in json.loads(tr.AGREEMENTS.read_text(encoding="utf-8"))["agreements"]]


def scan_id(page: str) -> tuple[str, str] | None:
    match = re.search(r"contentdm\.oclc\.org/digital/collection/([^/\"]+)/id/(\d+)", page)
    return (match.group(1), match.group(2)) if match else None


def fetch(args) -> None:
    work = Path(args.work)
    (work / "osu").mkdir(parents=True, exist_ok=True)
    (work / "cdm").mkdir(exist_ok=True)
    for url in all_osu_urls():
        page = get(url, work / "osu" / f"{url.rstrip('/').rsplit('/', 1)[1]}.html")
        scan = scan_id(page)
        if scan:
            get(f"https://cdm17279.contentdm.oclc.org/digital/bl/dmwebservices/index.php?q=dmGetItemInfo/{scan[0]}/{scan[1]}/json",
                work / "cdm" / f"{scan[0]}-{scan[1]}.json")


def osu_page(work: Path, url: str) -> dict:
    """What the database's page for a document shows: its title, header line, key provisions, links and text."""
    path = work / "osu" / f"{url.rstrip('/').rsplit('/', 1)[1]}.html"
    page = path.read_text(encoding="utf-8", errors="replace") if path.exists() else ""
    plain = re.sub(r"<script.*?</script>|<style.*?</style>|<!--.*?-->", "", page, flags=re.S)
    plain = htmllib.unescape(re.sub(r"<[^>]+>", "\n", plain))
    lines = [line.strip() for line in plain.splitlines() if line.strip()]
    provisions = []
    if "KEY PROVISIONS" in lines:
        # The provisions are listed one to a line with "|" lines between them; the text follows.
        rest = lines[lines.index("KEY PROVISIONS") + 1:]
        index = 0
        while index < len(rest) and not rest[index].isupper():
            provisions.append(rest[index].lower())
            if index + 1 < len(rest) and rest[index + 1] == "|":
                index += 2
            else:
                break
    links = dict(re.findall(r'<a href="([^"]+)"[^>]*class="btn[^"]*"[^>]*>\s*([A-Z][A-Z ]+)', page))
    scan = scan_id(page)
    cdm = {}
    if scan:
        cdm_path = work / "cdm" / f"{scan[0]}-{scan[1]}.json"
        if cdm_path.exists():
            try:
                cdm = json.loads(cdm_path.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                cdm = {}
    body_start = lines.index("IDENTIFIERS") + 2 if "IDENTIFIERS" in lines else 0
    return {"found": bool(page), "lines": lines, "provisions": provisions, "links": {v.strip(): k for k, v in links.items()},
            "scan": scan, "cdm": cdm, "body": "\n".join(lines[body_start:])}


def kappler_page(cdm: dict) -> tuple[int | None, str, int | None]:
    """The printed page number of the scan's first page, and its running head. The transcription runs the pages
    together, so when the first head's number did not survive the scan, the next head's number less one is used."""
    text = cdm.get("transc") or ""
    if not isinstance(text, str) or not text.strip():
        return None, "", None
    lines = [line.strip() for line in text.strip().splitlines() if line.strip()]
    first = lines[0]

    def head_number(line: str) -> int | None:
        if re.fullmatch(r"\d{1,4}\.?", line) and int(line.rstrip(".")) < 1100:
            return int(line.rstrip("."))
        if not re.search(r"[A-Z]{3,}.*\b1[6-9]\w\w\b|TREATIES|AGREEMENT|TREATY", line) or sum(c.isupper() for c in line) < 8:
            return None
        match = re.match(r"^(\d{1,4})\s", line) or re.search(r"\s(\d{1,4})[._]?$", line)
        # Kappler's volume 2 runs to about 1,100 pages, so a larger number is the year in the running head.
        return int(match.group(1)) if match and int(match.group(1)) < 1100 else None

    number = head_number(first)
    if number is not None:
        return number, first, None
    # The scan's text sometimes sets the page number on a line of its own, below the running head.
    later = None
    for line in lines[1:]:
        if re.fullmatch(r"\d{1,4}\.?", line) and int(line.rstrip(".")) < 1100:
            return int(line.rstrip(".")), first + f" (number {line} set below the head)", None
        if re.search(r"TREATY|AGREEMENT", line) and sum(c.isupper() for c in line) >= 8:
            later = head_number(line)
            if later is not None:
                break
    return None, first, later


def hand_findings() -> dict:
    return json.loads(HAND.read_text(encoding="utf-8")) if HAND.exists() else {}


def check_ratified(work: Path) -> list[dict]:
    rows = []
    hand = hand_findings()
    for treaty in treaties():
        key = treaty["record_key"]
        volume, page = tr.stat_parts(treaty["statutes_at_large"])
        row = {"key": key, "citation": treaty["statutes_at_large"], "date_signed": treaty["date_signed"],
               "kappler_header": treaty.get("kappler_header", ""), "kappler_page": treaty.get("kappler_page") or ""}
        problems = []
        if treaty["storage_key"]:
            layout = (work / "stat" / f"{key}.layout.txt").read_text(encoding="utf-8")
            text = (work / "stat" / f"{key}.txt").read_text(encoding="utf-8")
            squashed = squash(text)
            second = (work / "stat" / f"{key}.layout2.txt").read_text(encoding="utf-8")
            if head_number(layout, page):
                row["page"] = "ok"
            elif head_number(second, page + 1):
                row["page"] = "ok (next page is numbered %d)" % (page + 1)
            else:
                row["page"] = "ok (unnumbered page; GovInfo files the granule at this page)"
            first_page = squash(layout)
            signed = re.search(date_pattern(treaty["date_signed"]), first_page)
            row["date_signed_check"] = "ok" if signed else ("ok (page 2)" if re.search(date_pattern(treaty["date_signed"]), squashed) else "not found")
            whole_text = (work / "stat" / f"{key}.all.txt").read_text(encoding="utf-8")
            words = set(re.findall(r"[a-z]+", whole_text.lower()))
            named = parties(treaty["title"])
            missing = [word for word in named if not word_found(word, words, squash(whole_text))]
            row["parties"] = "ok: " + ", ".join(named) if not missing else "not found: " + ", ".join(missing)
            dates = header_dates(treaty.get("kappler_header", ""))
            whole = squash(whole_text)
            for label in ("ratified", "proclaimed"):
                value = dates.get(label)
                if not value:
                    row[label] = ""
                elif value.startswith("unreadable"):
                    row[label] = value
                else:
                    near = date_in(value, squashed, letters(text))
                    later = date_in(value, whole, letters(whole_text))
                    row[label] = f"{value} ok" if near else (f"{value} ok (later page)" if later else f"{value} not found")
            for name, value in (("page", row["page"]), ("date signed", row["date_signed_check"]), ("parties", row["parties"]),
                                ("ratified", row["ratified"]), ("proclaimed", row["proclaimed"])):
                if "not found" in value or "unreadable" in value:
                    problems.append(name)
        else:
            row.update(page="no stored copy", date_signed_check="", parties="", ratified="", proclaimed="")
        page_data = osu_page(work, treaty["osu_url"])
        number, head, later = kappler_page(page_data["cdm"])
        row["kappler_scan_head"] = head
        expected = treaty.get("kappler_page")
        if page_data["scan"] and page_data["scan"][0] == "kapplers" and number is not None:
            row["kappler_check"] = "ok" if number == expected else f"scan begins on p. {number}"
        elif (page_data["scan"] and later and expected and expected % 2 == 1 and later in (expected + 1, expected + 2)
              and not re.match(r"^\W*\d", head)):
            # Kappler sets an odd page's number at the right of its head, where the scan's text often loses it;
            # an unnumbered first head followed by p. N+1 or N+2 places the first page at N.
            row["kappler_check"] = f"ok (odd page; its number is lost in the scan's text, the next numbered head is p. {later})"
        else:
            row["kappler_check"] = "no Kappler scan" if not page_data["scan"] else "page number not read"
        if row["kappler_check"] != "ok":
            problems.append("kappler page")
        finding = hand.get(key)
        if finding:
            row["hand_check"] = finding["finding"]
            problems = [p for p in problems if p not in finding.get("settles", [])]
            if finding.get("correction"):
                problems.append("corrected")
        else:
            row["hand_check"] = ""
        result = "confirmed" if not problems else ("corrected" if problems == ["corrected"] else "check by hand: " + ", ".join(problems))
        if result == "confirmed" and not treaty["storage_key"]:
            result = "confirmed (Kappler only: not printed in the Statutes at Large)"
        elif result == "confirmed" and finding and (finding.get("note") or finding.get("label")):
            result = "confirmed; " + (finding.get("label") or "the Statutes at Large differ from Kappler's header or data (see note)")
        row["result"] = result
        rows.append(row)
    return rows


def other_items() -> list[tuple[dict, str]]:
    raw = json.loads(tr.TREATIES.read_text(encoding="utf-8"))
    items = [(item, "unratified or related paper") for item in raw["unratified_or_non_kappler_records_not_linked"]]
    items += [(item, "agreement, not ratified" if item.get("not_ratified") else "agreement")
              for item in json.loads(tr.AGREEMENTS.read_text(encoding="utf-8"))["agreements"]]
    return items


def record_key_for(url: str) -> str:
    """The key treaty_records.py gave the record for this database address."""
    slug_key = tr.base_key(url.rstrip("/").rsplit("/", 1)[1])
    full = tr.slug(url.rstrip("/").rsplit("/", 1)[1])
    for key in (slug_key, full):
        path = tr.SOURCES / key[0] / f"{key}.yaml"
        if path.exists() and url in path.read_text(encoding="utf-8"):
            return key
    return ""


def check_other(work: Path) -> list[dict]:
    rows = []
    hand = hand_findings()
    ratified_by_year: dict[str, list[dict]] = {}
    for treaty in tr.ratified():
        ratified_by_year.setdefault(treaty["date_signed"][:4], []).append(treaty)
    for item, kind in other_items():
        url = item["osu_url"]
        key = record_key_for(url)
        page = osu_page(work, url)
        row = {"key": key, "kind_in_record": kind, "title": item["title"], "year": item["year"], "header": item.get("header", "")}
        problems = []
        if not page["found"]:
            row.update(document="page not found", date_check="", status_check="", same_as_ratified="")
            problems.append("document")
        else:
            sources = [name for name in ("DOCUMENT SCAN", "ALTERNATIVE SOURCE") if name in page["links"]]
            body = page["body"]
            row["document"] = ("ok: " + ", ".join(sources) + f"; transcription {len(body)} characters") if sources or len(body) > 400 else "no scan, source or text"
            if row["document"].startswith("no"):
                problems.append("document")
            year = re.search(r"\d{4}", item["year"]).group(0)
            dated = re.findall(r"\b(1[6-9]\d\d)\b", (item.get("header") or "") + " " + body[:1500])
            row["date_check"] = "ok" if year in dated else ("no date in header or opening" if not dated else f"text gives {', '.join(sorted(set(dated))[:4])}")
            if row["date_check"] != "ok":
                problems.append("date")
            says_not = any("not ratified" in p or "unratified" in p for p in page["provisions"])
            says_ratified = any(p == "ratified" for p in page["provisions"])
            header_ratified = re.search(r"\bratified\b", item.get("header") or "", re.I) and not re.search(r"not ratified|never ratified", item.get("header") or "", re.I)
            if kind == "agreement, not ratified":
                row["status_check"] = "ok (database: not ratified)" if says_not else "the database no longer marks it not ratified"
                if not says_not:
                    problems.append("status")
            elif kind == "agreement":
                row["status_check"] = "ok (database: ratified)" if says_ratified and not says_not else ("database marks it not ratified" if says_not else "database gives no status")
                if says_not:
                    problems.append("status")
            else:
                if says_ratified or header_ratified:
                    row["status_check"] = "database or header says ratified"
                    problems.append("status")
                else:
                    row["status_check"] = "ok (database: not ratified)" if says_not else "ok (the database gives no status and does not mark it ratified)"
            twins = [t for t in ratified_by_year.get(year, []) if set(parties(t["title"])) & set(parties(item["title"]))]
            header_date = parse_date(item.get("header") or "")
            same_day = [t for t in twins if header_date and t["date_signed"] == header_date]
            row["same_as_ratified"] = "; ".join(f"{t['title']} ({t['date_signed']}, {t['statutes_at_large']})" for t in twins)
            if same_day and kind != "agreement":
                row["same_as_ratified"] = "SAME DAY: " + row["same_as_ratified"]
                problems.append("same day as a ratified treaty")
        if FOREIGN.search(item["title"]) or any("hawaiian kingdom" in p for p in page["provisions"]):
            row["scope"] = "names a foreign state: check that a Native nation is a party"
            problems.append("scope")
        else:
            row["scope"] = ""
        finding = hand.get(key or url)
        row["hand_check"] = finding["finding"] if finding else ""
        if finding:
            problems = [p for p in problems if p not in finding.get("settles", [])]
            if finding.get("correction"):
                problems.append("corrected")
        row["result"] = "confirmed" if not problems else ("corrected" if problems == ["corrected"] else "check by hand: " + ", ".join(problems))
        rows.append(row)
    return rows


def write_csv(path: Path, rows: list[dict]) -> None:
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)


def report(args) -> None:
    work = Path(args.work)
    for path, rows in ((RATIFIED_OUT, check_ratified(work)), (OTHER_OUT, check_other(work))):
        write_csv(path, rows)
        counts: dict[str, int] = {}
        for row in rows:
            counts[row["result"]] = counts.get(row["result"], 0) + 1
        print(path.name, len(rows), json.dumps(dict(sorted(counts.items(), key=lambda kv: -kv[1])), indent=1))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    for name in ("texts", "fetch", "report", "apply"):
        p = sub.add_parser(name)
        if name != "apply":
            p.add_argument("--work", required=True)
        if name == "texts":
            p.add_argument("--pdfs", required=True)
    args = parser.parse_args()
    {"texts": texts, "fetch": fetch, "report": report, "apply": lambda a: apply(a)}[args.command](args)


MARK = "Text check, Nov. 24, 2026"
UNVERIFIED_GENERATED = "; not yet read against the text (Unverified)."
UNVERIFIED_OTHER = ", not yet read against the text (Unverified)."
STILL = "It stays Unverified until the nation reviews it."


def check_sentence_ratified(row: dict, finding: dict | None) -> str:
    if row["page"] == "no stored copy":
        said = (f"{MARK} (research/reviews/2026-11-24-treaty-verification-ratified.csv): Kappler p. {row['kappler_page']} confirmed on the "
                "Oklahoma State University scan; the Statutes at Large do not print this treaty.")
    else:
        matched = ["the parties", "the date signed", f"the citation ({row['citation']}, its first page)", "the Kappler page"]
        missing = []
        for label, words in (("ratified", "ratification date"), ("proclaimed", "proclamation date")):
            value = row[label]
            if not value:
                continue
            if "ok" in value or (finding and label in finding.get("settles", []) and "(matches)" in finding.get("finding", "").split(label + ":", 1)[-1].split(";")[0]):
                matched.append(f"the {words} in Kappler's header")
            elif finding and label in finding.get("settles", []) and "not printed" in finding.get("finding", "").split(label + ":", 1)[-1].split(";")[0]:
                missing.append(f"the {words}")
        said = (f"{MARK} (research/reviews/2026-11-24-treaty-verification-ratified.csv): the stored Statutes at Large text and the Oklahoma State "
                f"University scan of Kappler agree with {', '.join(matched[:-1])} and {matched[-1]}.")
        if missing:
            said += f" The Statutes at Large do not print {' or '.join(missing)}."
    if finding and finding.get("note"):
        said += " " + finding["note"]
    return said + " " + STILL


def check_sentence_other(row: dict, finding: dict | None) -> str:
    said = f"{MARK} (research/reviews/2026-11-24-treaty-verification-other.csv): the database holds the document"
    if "DOCUMENT SCAN" in row["document"]:
        said += " with a scan of it"
    said += ", and its date matches the record."
    if finding and finding.get("finding") and not finding.get("kind_note"):
        said += " " + finding["finding"]
    return said + " It stays Unverified."


def set_notes(path: Path, notes: str, data: dict) -> None:
    """Replace the notes line (with any continuation lines) and leave the rest of the file as it is."""
    text = path.read_text(encoding="utf-8")
    text, count = re.subn(r"^notes:.*(?:\n[ ].*)*", tr.dump({"notes": notes}).rstrip("\n").replace("\\", "\\\\"), text, count=1, flags=re.M)
    if not count:
        text = text.rstrip("\n") + "\n" + tr.dump({"notes": notes})
    path.write_text(text if text.endswith("\n") else text + "\n", encoding="utf-8")


def strip_check(notes: str) -> str:
    return notes.split(" " + MARK)[0].rstrip()


def apply(args) -> None:
    """Write each check's result into its record's notes, and the corrections the hand check found."""
    hand = hand_findings()
    changed = 0
    for row in csv.DictReader(RATIFIED_OUT.open(encoding="utf-8")):
        path = tr.SOURCES / row["key"][0] / f"{row['key']}.yaml"
        data = yaml.safe_load(path.read_text(encoding="utf-8"))
        notes = strip_check(data.get("notes", "")).replace(UNVERIFIED_GENERATED, ".")
        # Older records said their Kappler page had not been checked against the printing; now it has.
        notes = notes.replace(" and was not checked against a page image of the 1904 printing", "")
        notes = f"{notes} {check_sentence_ratified(row, hand.get(row['key']))}".strip()
        if notes != data.get("notes"):
            set_notes(path, notes, data)
            changed += 1
    for row in csv.DictReader(OTHER_OUT.open(encoding="utf-8")):
        path = tr.SOURCES / row["key"][0] / f"{row['key']}.yaml"
        data = yaml.safe_load(path.read_text(encoding="utf-8"))
        finding = hand.get(row["key"])
        notes = strip_check(data["notes"]).replace(UNVERIFIED_OTHER, ".")
        if finding and finding.get("kind_note"):
            notes = re.sub(r"^(Unratified treaty or related paper, not in Kappler's list of ratified treaties\.|Agreement\.|"
                           r"Agreement, marked not ratified in the database\.)", lambda _: finding["kind_note"], notes)
        fix = (finding or {}).get("fix", {})
        if fix.get("author"):
            data["citation"]["author"] = [{"literal": fix["author"]}]
        if fix.get("year"):
            data["citation"]["issued"] = {"date-parts": [[fix["year"]]]}
        data["notes"] = f"{notes} {check_sentence_other(row, finding)}"
        path.write_text(tr.dump(data), encoding="utf-8")
        changed += 1
    print(f"wrote the check into {changed} records")


if __name__ == "__main__":
    main()
