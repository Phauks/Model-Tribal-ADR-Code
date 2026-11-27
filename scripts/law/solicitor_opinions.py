#!/usr/bin/env python3
"""Records and stored copies for the opinions of the Solicitor of the
Department of the Interior on Indian affairs ("M-Opinions"; data tier 2;
Trevor, Nov. 26, 2026: "add these to the data roadmap, attempt to grab the
high value and scriptables").

Two sources:

1917-1974. *Opinions of the Solicitor of the Department of the Interior
Relating to Indian Affairs 1917-1974* (2 volumes, Government Printing
Office, 1979; volume 2 begins at page 1109), compiled under 25 U.S.C. § 1341.
The University of Oklahoma Law Library keeps the text of both volumes as web
pages of about 25 printed pages each, with an index by M-number
(https://thorpe.law.ou.edu/solicitor.html). Each opinion opens with its
subject in capitals, any Interior Decisions citation ("53 I.D. 133"), its
M-number and its date, and the page's running head gives the page number.
The script cuts the pages into one opinion each and keeps that text, with
the printed page numbers marked, as a small web page in the bucket
(solicitor-opinions/1917-1974/<m-number>.html), which the site serves: the
opinions are works of the United States government.

Since 1993. The Solicitor's own index (https://www.doi.gov/solicitor/opinions)
lists each M-Opinion with its date, number, subject and PDF. Only those whose
subject is about Indian affairs are kept (by the words in SUBJECT_WORDS), in
solicitor-opinions/since-1993/<file>.pdf.

An opinion that already has a record (Powers of Indian Tribes, M-27781, and
M-37083 on the Native Hawaiian community) is left to that record. Every new
record starts Unverified.

Steps:
  fetch    Read both indexes and the volume pages, cut out each opinion and
           download each PDF. Writes --work/opinions.json and --work/files/.
  file     Store each copy in the bucket and add it to the capture index.
  records  Write content/sources/s/solicitor-opinion-<m-number>.yaml.

Usage:
  python3 scripts/law/solicitor_opinions.py fetch --work DIR
  python3 scripts/law/solicitor_opinions.py file --work DIR
  python3 scripts/law/solicitor_opinions.py records --work DIR
"""
from __future__ import annotations

import argparse
import concurrent.futures
import csv
import datetime as dt
import hashlib
import html
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
CAPTURE_INDEX = ROOT / "research/capture-index.csv"
SOURCES = ROOT / "content/sources"
SESSION = "2026-11-26-solicitor-opinions"
SCRIPT = "scripts/law/solicitor_opinions.py"
TOPIC = "solicitor-opinions"
OU = "https://thorpe.law.ou.edu"
OU_INDEX = f"{OU}/solicitor.html"
DOI = "https://www.doi.gov"
DOI_INDEX = f"{DOI}/solicitor/opinions"
OFFICE = "U.S. Department of the Interior, Office of the Solicitor"
VOLUMES = "Opinions of the Solicitor of the Department of the Interior Relating to Indian Affairs 1917-1974"
VOLUME_TWO_STARTS = 1109
# Opinions that already have a record of their own (their keys), left to that record.
EXISTING = {"M-27781": "solicitor-opinion-powers-of-indian-tribes-1934", "M-37083": "interior-solicitor-opinion-m-37083"}
SUBJECT_WORDS = re.compile(
    r"\b(?:Indians?|Tribes?|Tribal|Natives?|Pueblos?|Reservations?|Allot\w*|Gaming|Nations?|Bands?|Rancheria|Hawaiians?|Reorganization Act|"
    r"Klamath|Cherokee|Navajo|Osage|Seminole|Choctaw|Chickasaw|Creek|Keetoowah|Fort Berthold|Wampanoag|Carcieri|IGRA|ANCSA)\b", re.I)
# Matched by a word above but not about Indian affairs: whether withdrawn public lands are "reservations" under the Federal Power Act.
NOT_INDIAN_AFFAIRS = {"M-37005"}
MONTH = r"(?:January|February|March|April|May|June|July|August|September|October|November|December)"
# "M-2047 March 11, 1921.", "M-10526. December 13, 1923.", "M. 27654 April 19, 1934" and, in some years, the date before the
# number ("June 16 , 1924 . M-12198"); the scan's text sometimes reads a 1 as l ("192l").
_NUMBER = r"M\s?[-.]\s?(\d{4,5})\.?(\s*\((?:Supp|S)\.?\))?"
_DATE = r"(" + MONTH + r"\s+\d{1,2}\s*,\s*\d{3}[\dlI])\s*\.?"
HEADING = re.compile(_NUMBER + r"\s*,?\s+" + _DATE + "|" + _DATE + r"\s+" + _NUMBER)
RUNNING_HEAD = re.compile(r"(?<![\w.])(\d{1,4})\s+(?:OPINIONS OF THE SOLICITOR|DEPARTMENT OF THE INTERIOR)\s+(?:" + MONTH.upper() + r"|[A-Z]+)\s+\d{1,2}\s*,\s*\d{4}")
SMALL = {"a", "an", "and", "as", "at", "by", "for", "from", "in", "into", "of", "on", "or", "the", "to", "under", "upon", "with", "v.", "vs."}
RIGHTS = {"status": "no-permission-needed", "basis": "us-government-work",
          "basis_note": "A work of the United States government, not subject to copyright (17 U.S.C. § 105).",
          "redistribution": True}


def dump(value) -> str:
    return yaml.safe_dump(value, sort_keys=False, allow_unicode=True, width=10_000)


def get(url: str) -> bytes:
    url = urllib.parse.quote(url, safe=":/?&=%#+,;@~")
    for attempt in range(4):
        try:
            time.sleep(1)
            with urllib.request.urlopen(url, timeout=300) as response:
                return response.read()
        except Exception:  # noqa: BLE001 - retried, then raised
            if attempt == 3:
                raise
            time.sleep(5 * (attempt + 1))


def plain(fragment: str) -> str:
    """Page markup to text, keeping paragraph breaks as blank lines."""
    fragment = re.sub(r"(?is)<(script|style|head)[^>]*>.*?</\1>", " ", fragment)
    fragment = re.sub(r"(?i)</p>|<br\s*/?>|</blockquote>|</tr>|</h\d>", "\n\n", fragment)
    out = html.unescape(re.sub(r"<[^>]+>", " ", fragment)).replace("\xa0", " ")
    out = re.sub(r"[ \t\r\f\v]+", " ", out)
    return re.sub(r"\n\s*\n\s*", "\n\n", re.sub(r" *\n *", "\n", out)).strip()


def title_case(caps: str) -> str:
    caps = re.sub(r"\b(FULL|MIXED|HALF|EIGHT|NON|SELF|CO|RE|PRE|SUB|INTER|TWO|FIVE)-(?=[A-Z])", "\\1\u2010", caps.strip(" .,;"))
    caps = re.sub(r"\s*-{1,2}\s*|\s*—\s*", "—", caps).replace("\u2010", "-")
    words = []
    for index, word in enumerate(caps.split(" ")):
        parts = []
        for part in word.split("—"):
            lower = part.lower()
            if re.fullmatch(r"(?:[A-Z]\.){2,}|[IVX]+|U\.S\.?|IRA|ANCSA", part):
                parts.append(part)
            elif index and lower in SMALL and parts == []:
                parts.append(lower)
            else:
                parts.append(re.sub(r"[a-z]", lambda m: m.group(0).upper(), lower, count=1))
        words.append(re.sub(r"(?<=-)[a-z]", lambda m: m.group(0).upper(), "—".join(parts)))
    return " ".join(words)


def long_date(value: str) -> str:
    day = dt.date.fromisoformat(value)
    return f"{day:%B} {day.day}, {day.year}"


def iso(text: str) -> str:
    text = re.sub(r"\s*,\s*", ", ", re.sub(r"\s+", " ", text.strip()))
    return dt.datetime.strptime(re.sub(r"[lI]$", "1", text), "%B %d, %Y").date().isoformat()


def ou_pages(work: Path) -> tuple[list[str], set[str]]:
    index = get(OU_INDEX).decode("latin-1")
    (work / "pages").mkdir(parents=True, exist_ok=True)
    (work / "pages" / "solicitor.html").write_text(index, encoding="utf-8")
    files = sorted(set(re.findall(r'href="(sol_opinions/[^"#]+)', index)), key=lambda name: int(re.search(r"p(\d+)", name).group(1)))
    numbers = set(re.findall(r'href="sol_opinions/[^"#]+#[^"]*"[^>]*>\s*(M-\d+)', index))
    for name in files:
        path = work / "pages" / name.rsplit("/", 1)[-1]
        if not path.exists():
            path.write_bytes(get(f"{OU}/{name}"))
    return files, numbers


def is_heading(stream: str, match: re.Match) -> bool:
    """An opinion's own heading follows its subject in capitals; a citation of it inside another opinion
    ("Solicitor's Opinion, M-28086, July 17, 1935", "Op. Sol. I.D., M. 26034") follows ordinary words."""
    before = RUNNING_HEAD.sub(" ", stream[max(0, match.start() - 300):match.start()])
    words = re.sub(r"\[\[file \d+\]\]", " ", before).split()
    return bool(words) and not re.search(r"[a-z]", words[-1]) and not words[-1].endswith((",", ";")) and words[-1] not in ("I.D.", "L.D.")


def cut_opinions(work: Path, files: list[str], numbers: set[str]) -> list[dict]:
    """Every opinion heading in the volumes' text, in page order, with its text up to the next heading."""
    stream, sources = "", []
    for name in files:
        text = plain((work / "pages" / name.rsplit("/", 1)[-1]).read_text(encoding="latin-1"))
        text = re.sub(r"^Solicitor's Home\s*", "", text)
        first = int(re.search(r"p(\d+)", name).group(1))
        sources.append((len(stream), f"{OU}/{name}", first))
        stream += f"\n\n[[file {first}]]\n\n" + text
    heads = [match for match in HEADING.finditer(stream) if is_heading(stream, match)]
    opinions = []
    for number, match in enumerate(heads):
        before = stream[max(0, match.start() - 600):match.start()]
        # The subject in capitals just before the number, after the running head and any Interior Decisions citation.
        caps = re.search(r"((?:(?:[A-Z0-9][A-Z0-9.,;:'’()&/—-]*|-+|—)\s+)*(?:[A-Z0-9][A-Z0-9.,;:'’()&/—-]*|-+|—)\s*)$", before)
        subject = re.sub(r"\s+", " ", caps.group(1)) if caps else ""
        subject = RUNNING_HEAD.sub(" ", subject)
        subject = re.sub(r"^.*\]\]\s*", "", subject)
        reporter = ""
        cite = re.search(r"\s*(\d+\s+(?:I\.\s?D\.|L\.\s?D\.))\s*(\d+)\s*$", subject)
        if cite:
            reporter = f"{re.sub(r'\s', '', cite.group(1)).replace('I.D.', ' I.D.').replace('L.D.', ' L.D.').strip()} {cite.group(2)}"
            subject = subject[:cite.start()]
        subject = re.sub(r"^(?:[A-Z]\.\s+)?[A-Z][A-Z .'’-]+,\s*$", "", subject).strip(" .,;")
        # What is left of the line before (a date, a signature, a statute's citation) ends with a period or a parenthesis.
        for leftover in (r"^\d{1,2}\s*,\s*\d{4}\s*\.\s*", r"^[A-Z][A-Z]+\.?(?:\s+[A-Z]\.)*\s+[A-Z][A-Z]+\.\s+(?=[A-Z])", r"^[\d\s.,;:()]+(?=[A-Z])"):
            subject = re.sub(leftover, "", subject)
        subject = subject.strip(" .,;")
        begin = match.start() - (len(before) - (caps.start(1) if caps else len(before)))
        end = heads[number + 1].start() if number + 1 < len(heads) else len(stream)
        if number + 1 < len(heads):
            following = stream[max(0, end - 600):end]
            later_caps = re.search(r"((?:(?:[A-Z0-9][A-Z0-9.,;:'’()&/—-]*|-+|—)\s+)*(?:[A-Z0-9][A-Z0-9.,;:'’()&/—-]*|-+|—)\s*)$", following)
            if later_caps:
                end -= len(following) - later_caps.start(1)
        body = stream[begin:end]
        # The printed page the opinion starts on: the last running head before it, or the page file's first page.
        at_file = max((entry for entry in sources if entry[0] <= match.start()), key=lambda entry: entry[0])
        heads_before = [int(found.group(1)) for found in RUNNING_HEAD.finditer(stream, at_file[0], match.start())]
        page = heads_before[-1] if heads_before else at_file[2]
        mnumber = "M-" + (match.group(1) or match.group(5))
        supplement = bool(match.group(2) or match.group(6))
        opinions.append({"number": mnumber + (" (Supp.)" if supplement else ""), "m": mnumber, "supplement": supplement,
                         "date": iso(match.group(3) or match.group(4)), "subject": title_case(subject) if subject else "", "reporter": reporter,
                         "page": page, "volume": 1 if page < VOLUME_TWO_STARTS else 2, "page_link": at_file[1],
                         "in_index": mnumber in numbers, "text": body.strip()})
    return opinions


def opinion_page(opinion: dict) -> str:
    """The opinion's text as a small web page, with the printed page numbers marked."""
    body = RUNNING_HEAD.sub(lambda found: f"\n\n[page {found.group(1)}]\n\n", opinion["text"])
    body = re.sub(r"\[\[file \d+\]\]", "", body)
    paragraphs = "\n".join(f"<p>{html.escape(part.strip())}</p>" for part in re.split(r"\n\s*\n", body) if part.strip())
    heading = html.escape(f"{opinion['number']}, {long_date(opinion['date'])}")
    return ("<!doctype html>\n<html lang=\"en\"><head><meta charset=\"utf-8\">"
            f"<title>{html.escape(opinion['subject'] or opinion['number'])}</title></head><body>\n"
            f"<p><em>{html.escape(VOLUMES)}</em>, volume {opinion['volume']}, page {opinion['page']}. {heading}.</p>\n{paragraphs}\n</body></html>\n")


def since_1993(work: Path) -> list[dict]:
    page = get(DOI_INDEX).decode("utf-8", "replace")
    (work / "pages" / "doi-index.html").write_text(page, encoding="utf-8")
    out = []
    for row in re.findall(r"(?s)<tr>(.*?)</tr>", page):
        cells = re.findall(r"(?s)<td[^>]*>(.*?)</td>", row)
        if len(cells) < 3:
            continue
        link = re.search(r'href="([^"]+\.pdf)"', cells[1])
        number = re.sub(r"\s+", "", re.sub(r"<[^>]+>", "", html.unescape(cells[1])))
        subject = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", cells[2]))).strip()
        # The index marks some opinions "( Under Suspension Review )" before the subject: kept as the opinion's status.
        status = re.match(r"\(\s*([^)]*?)\s*\)\s*", subject)
        subject = subject[status.end():] if status else subject
        date = re.sub(r"<[^>]+>", "", cells[0]).strip()
        if not link or not re.fullmatch(r"M-?\d{5}", number) or not SUBJECT_WORDS.search(subject):
            continue
        number = number if number.startswith("M-") else "M-" + number[1:]
        if number in NOT_INDIAN_AFFAIRS:
            continue
        out.append({"number": number, "m": number, "date": dt.datetime.strptime(date, "%Y/%m/%d").date().isoformat(),
                    "subject": subject, "link": urllib.parse.urljoin(DOI, html.unescape(link.group(1))),
                    **({"status": status.group(1)} if status else {})})
    for opinion in out:
        name = re.sub(r"[^A-Za-z0-9._-]+", "-", opinion["link"].rsplit("/", 1)[-1])
        saved = work / "files" / "since-1993" / name
        data = saved.read_bytes() if saved.exists() else get(opinion["link"])
        if not data.startswith(b"%PDF"):
            opinion["problem"] = "not a PDF"
            continue
        (work / "files" / "since-1993").mkdir(parents=True, exist_ok=True)
        (work / "files" / "since-1993" / name).write_bytes(data)
        opinion.update(file=f"since-1993/{name}", sha256=hashlib.sha256(data).hexdigest(), bytes=len(data), media="application/pdf")
    return out


def fetch(args) -> None:
    work = Path(args.work)
    (work / "files" / "1917-1974").mkdir(parents=True, exist_ok=True)
    files, numbers = ou_pages(work)
    early = cut_opinions(work, files, numbers)
    seen: dict[str, int] = {}
    for opinion in early:
        name = opinion["m"].lower() + ("-supp" if opinion["supplement"] else "")
        seen[name] = seen.get(name, 0) + 1
        if seen[name] > 1:
            name += f"-{seen[name]}"
        data = opinion_page(opinion).encode("utf-8")
        (work / "files" / "1917-1974" / f"{name}.html").write_bytes(data)
        opinion.update(file=f"1917-1974/{name}.html", sha256=hashlib.sha256(data).hexdigest(), bytes=len(data), media="text/html",
                       link=f"{opinion['page_link']}#{opinion['m'].lower()}", era="1917-1974")
        del opinion["text"]
    missing = sorted(numbers - {opinion["m"] for opinion in early}, key=lambda m: int(m[2:]))
    late = since_1993(work)
    for opinion in late:
        opinion["era"] = "since-1993"
    (work / "opinions.json").write_text(json.dumps(early + late, indent=1, ensure_ascii=False), encoding="utf-8")
    (work / "missing.json").write_text(json.dumps(missing, indent=1), encoding="utf-8")
    print(f"1917-1974: {len(early)} opinions cut from {len(files)} pages ({len({o['m'] for o in early})} M-numbers; "
          f"{len(missing)} index numbers not found in the text); since 1993: {len(late)} about Indian affairs downloaded")


def record_key(opinion: dict) -> str:
    return EXISTING.get(opinion["m"]) if opinion["m"] in EXISTING and not opinion.get("supplement") else \
        "solicitor-opinion-" + Path(opinion["file"]).stem.lower().replace("_", "-") if opinion["era"] == "1917-1974" else \
        f"solicitor-opinion-{opinion['m'].lower()}"


def file(args) -> None:
    sys.path.insert(0, str(ROOT / "scripts/captures"))
    import mirror_captures  # noqa: E402

    work = Path(args.work)
    opinions = json.loads((work / "opinions.json").read_text(encoding="utf-8"))
    rows = mirror_captures.load_index()
    filed = {row["key"] for row in rows}
    by_digest = {row["sha256"]: row["key"] for row in rows}
    s3 = mirror_captures.client()
    bucket = mirror_captures.bucket_name()
    todo = []
    for opinion in opinions:
        if not opinion.get("file") or (opinion["m"] in EXISTING and not opinion.get("supplement")):
            continue
        key = f"{TOPIC}/{opinion['file']}"
        if key not in filed and opinion["sha256"] not in by_digest:
            todo.append((opinion, key))
            by_digest[opinion["sha256"]] = key

    def put(entry):
        opinion, key = entry
        path = work / "files" / opinion["file"]
        if mirror_captures.remote_state(s3, bucket, key) != (path.stat().st_size, opinion["sha256"]):
            s3.upload_file(str(path), bucket, key, ExtraArgs={"ContentType": opinion["media"] + ("; charset=utf-8" if opinion["media"] == "text/html" else ""),
                                                             "Metadata": {"sha256": opinion["sha256"], "captured": dt.date.today().isoformat()}})
            if mirror_captures.remote_state(s3, bucket, key) != (path.stat().st_size, opinion["sha256"]):
                return None
        return entry

    added = 0
    with concurrent.futures.ThreadPoolExecutor(8) as pool:
        for result in pool.map(put, todo):
            if not result:
                print("verification failed", file=sys.stderr)
                continue
            opinion, key = result
            early = opinion["era"] == "1917-1974"
            rows.append(mirror_captures.index_row(
                key=key, size=opinion["bytes"], digest=opinion["sha256"], media=opinion["media"], topic=TOPIC,
                title=f"Solicitor's opinion {opinion['number']}: {opinion['subject'] or 'untitled'} ({opinion['date'][:4]})", nations="",
                obtained=("cut by script from the University of Oklahoma Law Library's text of the 1917-1974 volumes" if early
                          else "downloaded from the Solicitor's index of M-Opinions (doi.gov) by script"),
                links=[opinion["link"]], record=record_key(opinion), redistribution="yes",
                rights="United States government work (17 U.S.C. § 105).", existing_keys=filed))
            filed.add(key)
            added += 1
    mirror_captures.write_index(rows)
    print(f"filed {added}")


def record_for(opinion: dict, copy: dict | None, nations: list[str]) -> dict:
    early = opinion["era"] == "1917-1974"
    year, month, day = (int(part) for part in opinion["date"].split("-"))
    subject = opinion["subject"] or f"Opinion {opinion['number']}"
    title = f"{opinion['number']}: {subject}"
    citation = {"type": "report", "title": title, "author": [{"literal": OFFICE}], "genre": "Solicitor's opinion", "number": opinion["number"]}
    if early:
        citation.update({"container-title": VOLUMES, "volume": str(opinion["volume"]), "page": str(opinion["page"])})
    citation.update({"issued": {"date-parts": [[year, month, day]]}, "URL": opinion["link"], "accessed": {"date-parts": [[2026, 11, 26]]}})
    if early:
        reprint = f"{opinion['volume']} Op. Sol. on Indian Affairs {opinion['page']} (U.S.D.I. 1979)"
        indigo = f"{subject}, Op. Sol. Interior {opinion['number']}" + (f", {opinion['reporter']}" if opinion["reporter"] else "") + f" ({year}), reprinted in {reprint}"
        found = (f"Printed in volume {opinion['volume']} of {VOLUMES} beginning at page {opinion['page']}"
                 + (f", and in {opinion['reporter'].replace('I.D.', 'Interior Decisions').replace('L.D.', 'Land Decisions')}" if opinion["reporter"] else "")
                 + ". Subject, number, date and page from the University of Oklahoma Law Library's text of the volumes, read by script; "
                 "the subject's capitals were set in title case by script.")
    else:
        indigo = f"{subject}, Op. Sol. Interior {opinion['number']} ({long_date(opinion['date'])})"
        found = ("Listed on the Solicitor's index of M-Opinions since 1993; subject, number and date from that index"
                 + (f", which marks it \"{opinion['status']}\" (Nov. 26, 2026)." if opinion.get("status") else "."))
    notes = (f"Indigo Book citation: {indigo}. {found} "
             f"Generated by {SCRIPT}, with the nations matched by name in the subject; not yet read by a person (Unverified).")
    record = {"key": record_key(opinion), "kind": "federal-agency-document", "citation": citation, "original_link": opinion["link"], "retrieved": "2026-11-26"}
    if copy:
        record["file"] = copy
    record["rights"] = RIGHTS
    record["jurisdictions"] = [{"level": "federal"}]
    if nations:
        record["tribes"] = nations
    record.update({"topics": ["solicitor-opinion"], "access": {"open": True, "pull_from": ["free-web"]}, "found_in": [SESSION], "notes": notes,
                   "review": {"status": "unverified", "by": SCRIPT, "date": "2026-11-26",
                              "checks": [{"check": "listing", "result": "missing",
                                          "detail": "Only the University of Oklahoma text was read, not the printed volumes" if early else f"Only the Solicitor's index was read: {DOI_INDEX}"}]}})
    return record


def records(args) -> None:
    sys.path.insert(0, str(ROOT / "scripts/law"))
    from nation_names import NationNames  # noqa: E402

    work = Path(args.work)
    opinions = [opinion for opinion in json.loads((work / "opinions.json").read_text(encoding="utf-8")) if opinion.get("file")]
    copies = {}
    for row in csv.DictReader(CAPTURE_INDEX.open(encoding="utf-8")):
        copies[row["sha256"]] = {"storage_key": row["key"], "checksum": row["sha256"], "media_type": row["media_type"], "bytes": int(row["bytes"])}
    names = NationNames()
    # The University of Oklahoma pages each hold several opinions: records on one page list each other (lint_records duplicate-link).
    by_page: dict[str, list[str]] = {}
    for opinion in opinions:
        if not (opinion["m"] in EXISTING and not opinion.get("supplement")):
            by_page.setdefault(opinion["link"].split("#", 1)[0], []).append(record_key(opinion))
    written = 0
    for opinion in opinions:
        if opinion["m"] in EXISTING and not opinion.get("supplement"):
            continue
        key = record_key(opinion)
        path = SOURCES / "s" / f"{key}.yaml"
        if path.exists() and SESSION not in path.read_text(encoding="utf-8"):
            print("key taken by another record, skipped:", key, file=sys.stderr)
            continue
        record = record_for(opinion, copies.get(opinion["sha256"]), names.find(opinion["subject"]))
        others = [other for other in by_page[opinion["link"].split("#", 1)[0]] if other != key]
        if others:
            record = {**{name: value for name, value in record.items() if name in ("key", "kind", "citation", "original_link", "retrieved", "file")},
                      "shares_link_with": others, **record}
        path.write_text(dump(record), encoding="utf-8")
        written += 1
    print(f"wrote {written} records")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    for name in ("fetch", "file", "records"):
        sub.add_parser(name).add_argument("--work", required=True)
    args = parser.parse_args()
    {"fetch": fetch, "file": file, "records": records}[args.command](args)


if __name__ == "__main__":
    main()
