#!/usr/bin/env python3
"""Source records and stored copies for the National Indian Gaming
Commission's reading room (data tier 2; Trevor, Nov. 26, 2026: "Start with
tier 2. Work to completion"): its Indian lands opinions, game classification
opinions, management contract declination letters, enforcement actions,
Commission final decisions and bulletins, as the reading room's tables list
them (counted in research/analyses/2026-11-26-tier-2-and-3-data-sources.md,
section 2.4). The gaming ordinances are already held
(scripts/gaming/ordinance_list.py).

Every document is a work of the United States government, so the project
keeps its own copy in the bucket under nigc/<table>/<file> and serves it.
The title, date, nation and the table's other columns (the parcel and legal
theory of an Indian lands opinion, the class of a game, the tracking number
and kind of an enforcement action) come from the Commission's tables; the
nations are matched by name (scripts/law/nation_names.py).

Commission final decisions are adjudications, so they are written as cases
(/cases/<key>); everything else is a federal agency document, with a page
at /laws/<key> like the other federal documents.

Steps:
  fetch    Read the six tables and download every document into --work.
           Writes --work/documents.json.
  file     Store each document in the bucket and add it to the capture index.
  records  Write content/sources/<letter>/<key>.yaml.

Usage:
  python3 scripts/law/nigc_documents.py fetch --work DIR
  python3 scripts/law/nigc_documents.py file --work DIR
  python3 scripts/law/nigc_documents.py records --work DIR
"""
from __future__ import annotations

import argparse
import concurrent.futures
import csv
import datetime as dt
import hashlib
import html
import json
import mimetypes
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
SESSION = "2026-11-26-nigc-documents"
SCRIPT = "scripts/law/nigc_documents.py"
COMMISSION = "National Indian Gaming Commission"
SITE = "https://www.nigc.gov"
UA = {"User-Agent": "Mozilla/5.0 (research script)"}
MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
RIGHTS = {"status": "no-permission-needed", "basis": "us-government-work",
          "basis_note": "A work of the United States government, not subject to copyright (17 U.S.C. § 105).",
          "redistribution": True}

# Each reading room table: its address, its columns, and what one row is.
TABLES = {
    "indian-lands-opinions": {"path": "office-of-general-counsel/legal-opinions/indian-lands-opinions", "genre": "Indian lands opinion",
                              "columns": ["nation", "parcel", "theory", "accepted", "date"]},
    "game-classification-opinions": {"path": "office-of-general-counsel/legal-opinions/game-classification-opinions", "genre": "Game classification opinion",
                                     "columns": ["game", "class", "bingo", "card_games", "card_games_state", "pull_tabs", "internet", "other", "date"]},
    "declination-letters": {"path": "office-of-general-counsel/legal-opinions/declination-letters", "genre": "Declination letter",
                            "columns": ["date", "nation", "company"]},
    "enforcement-actions": {"path": "commission/commission-actions/enforcement-actions", "genre": "Enforcement action",
                            "columns": ["nation", "tracking", "date", "type", "violations"]},
    "commission-final-decisions": {"path": "commission/commission-actions/commission-final-decisions", "genre": "Commission final decision",
                                   "columns": ["nation", "date", "type"]},
    "bulletins": {"path": "office-of-chief-of-staff/compliance/bulletins", "genre": "Bulletin",
                  "columns": ["date", "number", "title", "topic"]},
}

# The kinds of action the enforcement and final decision tables abbreviate (the Commission's own terms, 25 C.F.R. parts 573 and 575).
ACTIONS = {"NOV": "notice of violation", "SA": "settlement agreement", "CFA": "civil fine assessment", "TCO": "temporary closure order",
           "CO": "closure order", "POA": "plan of action", "RO": "rescission order", "ORD": "ordinance disapproval",
           "MGMT": "management contract decision", "MICS VAR": "minimum internal control standards variance"}


def dump(value) -> str:
    return yaml.safe_dump(value, allow_unicode=True, sort_keys=False, width=float("inf"))


DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


def slug(text: str) -> str:
    text = text.replace("’", "").replace("'", "").replace("&", " and ")
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", text.lower())).strip("-")


def get(url: str) -> bytes:
    for attempt in range(4):
        try:
            # Some links carry spaces ("Poarch Band of Creek Indians ..."): quote them, keeping what is already quoted.
            url = urllib.parse.quote(url, safe=":/?&=%#+,;@~")
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120) as response:
                return response.read(), response.geturl(), response.headers.get_content_type()
        except Exception:  # noqa: BLE001 - retried, then raised
            if attempt == 3:
                raise
            time.sleep(4 * (attempt + 1))


def table_rows(page: str) -> list[tuple[list[str], list[str]]]:
    rows = []
    for row in re.findall(r"(?s)<tr[^>]*>(.*?)</tr>", page):
        cells = [html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", cell))).strip() for cell in re.findall(r"(?s)<td[^>]*>(.*?)</td>", row)]
        links = [html.unescape(link).strip("'\" ") for link in re.findall(r'href="([^"]+)"', row)]
        if cells:
            rows.append((cells, links))
    return rows


def actions(code: str) -> str:
    return " and ".join(ACTIONS.get(part.strip(), part.strip()) for part in code.split("/") if part.strip())


def title_of(table: str, row: dict) -> str:
    if table == "indian-lands-opinions":
        return f"Indian Lands Opinion: {row['nation']}, {row['parcel']}"
    if table == "game-classification-opinions":
        return f"Game Classification Opinion: {row['game']}"
    if table == "declination-letters":
        return f"Management Contract Declination Letter: {row['nation']}" + (f", {row['company']}" if row.get("company") else "")
    if table == "enforcement-actions":
        kind = actions(row["type"])
        return f"{kind[:1].upper() + kind[1:]} {row['tracking']}: {row['nation']}" if row.get("tracking") else f"{kind[:1].upper() + kind[1:]}: {row['nation']}"
    if table == "commission-final-decisions":
        return f"In re {row['nation']}"
    return f"Bulletin {row['number']}: {row['title']}"


def fetch(args) -> None:
    work = Path(args.work)
    documents = []
    if args.retry:
        documents = json.loads((work / "documents.json").read_text(encoding="utf-8"))
    for table, setting in ({} if args.retry else TABLES).items():
        page = get(f"{SITE}/{setting['path']}/")[0].decode("utf-8", "replace")
        (work / "pages").mkdir(parents=True, exist_ok=True)
        (work / "pages" / f"{table}.html").write_text(page, encoding="utf-8")
        for number, (cells, links) in enumerate(table_rows(page), 1):
            if not links:
                continue
            row = dict(zip(setting["columns"], cells))
            row.update(table=table, row=number, listing=f"{SITE}/{setting['path']}/", link=links[0], genre=setting["genre"])
            row["title"] = title_of(table, row)
            documents.append(row)

    def download(row: dict) -> None:
        folder = work / "files" / row["table"]
        folder.mkdir(parents=True, exist_ok=True)
        if args.retry and not row.get("problem"):
            return
        row.pop("problem", None)
        try:
            data, final, media = get(row["link"])
        except Exception as problem:  # noqa: BLE001 - reported in the row
            row["problem"] = str(problem)
            return
        name = urllib.parse.unquote(final.rsplit("/", 1)[-1]).split("?")[0] or f"{row['row']}.pdf"
        name = re.sub(r"[^A-Za-z0-9._-]+", "-", name)
        if name.lower().endswith(".docx") and data.startswith(b"PK"):
            pass  # one notice of violation is posted only as a Word file; it is stored as posted.
        elif not data.startswith(b"%PDF") and media != "application/pdf":
            row["problem"] = f"not a PDF ({media}) at {final}"
            return
        elif not name.lower().endswith(".pdf"):
            name += ".pdf"
        row.update(final=final, file=name, sha256=hashlib.sha256(data).hexdigest(), bytes=len(data))
        (folder / name).write_bytes(data)

    with concurrent.futures.ThreadPoolExecutor(6) as pool:
        list(pool.map(download, documents))
    (work / "documents.json").write_text(json.dumps(documents, indent=1, ensure_ascii=False), encoding="utf-8")
    problems = [row for row in documents if row.get("problem")]
    for row in problems:
        print("FAILED", row["table"], row["title"], row["problem"], file=sys.stderr)
    print(f"{len(documents) - len(problems)} of {len(documents)} documents downloaded")


def file(args) -> None:
    sys.path.insert(0, str(ROOT / "scripts/captures"))
    import mirror_captures  # noqa: E402

    work = Path(args.work)
    documents = json.loads((work / "documents.json").read_text(encoding="utf-8"))
    rows = mirror_captures.load_index()
    filed = {row["key"] for row in rows}
    by_digest = {row["sha256"]: row["key"] for row in rows}
    s3 = mirror_captures.client()
    bucket = mirror_captures.bucket_name()
    todo = []
    for item in documents:
        if not item.get("file"):
            continue
        key = f"nigc/{item['table']}/{item['file']}"
        if key in filed or item["sha256"] in by_digest:
            continue
        filed.add(key)
        by_digest[item["sha256"]] = key
        todo.append((item, key))

    def put(entry):
        item, key = entry
        path = work / "files" / item["table"] / item["file"]
        media = DOCX if item["file"].lower().endswith(".docx") else "application/pdf"
        if mirror_captures.remote_state(s3, bucket, key) != (path.stat().st_size, item["sha256"]):
            s3.upload_file(str(path), bucket, key, ExtraArgs={"ContentType": media, "Metadata": {
                "sha256": item["sha256"], "captured": dt.date.today().isoformat()}})
            if mirror_captures.remote_state(s3, bucket, key) != (path.stat().st_size, item["sha256"]):
                return None
        return item, key, path, media

    added = 0
    existing = {row["key"] for row in rows}
    with concurrent.futures.ThreadPoolExecutor(8) as pool:
        for result in pool.map(put, todo):
            if not result:
                print("verification failed", file=sys.stderr)
                continue
            item, key, path, media = result
            rows.append(mirror_captures.index_row(
                key=key, size=path.stat().st_size, digest=item["sha256"], media=media, topic="nigc", title=item["title"],
                nations="", obtained="downloaded from the National Indian Gaming Commission's reading room by script",
                links=[item["final"]], record=record_key(item), redistribution="yes",
                rights="United States government work (17 U.S.C. § 105).", existing_keys=existing))
            existing.add(key)
            added += 1
    mirror_captures.write_index(rows)
    print(f"filed {added}")


_keys: dict[tuple, str] = {}


def record_key(item: dict) -> str:
    """nigc-<table word>-<what>-<date>: nigc-indian-lands-opinion-ponca-tribe-of-nebraska-carter-lake-2007-12-31."""
    marker = (item["table"], item["row"])
    if marker in _keys:
        return _keys[marker]
    what = {"indian-lands-opinions": f"{item.get('nation', '')} {item.get('parcel', '').split(',')[0]}",
            "game-classification-opinions": item.get("game", ""),
            "declination-letters": f"{item.get('nation', '')} {item.get('company', '')}",
            "enforcement-actions": item.get("tracking") or f"{item.get('type', '')} {item.get('nation', '')}",
            "commission-final-decisions": item.get("nation", ""),
            "bulletins": item.get("number", "")}[item["table"]]
    word = {"indian-lands-opinions": "indian-lands-opinion", "game-classification-opinions": "game-classification",
            "declination-letters": "declination-letter", "enforcement-actions": "enforcement", "commission-final-decisions": "final-decision",
            "bulletins": "bulletin"}[item["table"]]
    name = slug(what)
    if len(name) > 60:
        name = name[:60].rsplit("-", 1)[0]
    key = f"nigc-{word}-{name}-{item['date']}" if item["table"] not in ("enforcement-actions", "bulletins") or not name else f"nigc-{word}-{name}"
    base, number = key, 2
    while key in _keys.values():
        key = f"{base}-{number}"
        number += 1
    _keys[marker] = key
    return key


def long_date(iso: str) -> str:
    year, month, day = iso.split("-")
    return f"{MONTHS[int(month) - 1]} {int(day)}, {year}"


def details(item: dict) -> str:
    """The table's other columns, as a sentence."""
    table = item["table"]
    if table == "indian-lands-opinions":
        return f"Parcel: {item['parcel']}. Legal theory: {item['theory']}. Theory accepted: {item['accepted']}."
    if table == "game-classification-opinions":
        kinds = [label for column, label in (("bingo", "bingo"), ("card_games", "card games"), ("pull_tabs", "pull tabs"), ("internet", "internet gaming"), ("other", "other"))
                 if item.get(column)]
        return f"Class: {item['class']}." + (f" Kind: {', '.join(kinds)}." if kinds else "") + (f" State: {item['card_games_state']}." if item.get("card_games_state") else "")
    if table == "declination-letters":
        return f"Management contractor: {item['company']}." if item.get("company") else ""
    if table == "enforcement-actions":
        return f"Kind: {actions(item['type'])} ({item['type']})." + (f" Violations: {item['violations']}." if item.get("violations") else "")
    if table == "commission-final-decisions":
        return f"Kind: {actions(item['type'])} ({item['type']})."
    return f"Topic: {item['topic']}." if item.get("topic") else ""


def record_for(item: dict, copy: dict | None, named: list[tuple[str, str]]) -> dict:
    year, month, day = (int(part) for part in item["date"].split("-"))
    case = item["table"] == "commission-final-decisions"
    citation = {"type": "legal_case" if case else "report", "title": item["title"]}
    if case:
        citation["authority"] = COMMISSION
    else:
        citation.update({"author": [{"literal": COMMISSION}], "genre": item["genre"]})
        if item["table"] == "enforcement-actions" and item.get("tracking"):
            citation["number"] = item["tracking"]
        if item["table"] == "bulletins":
            citation["number"] = item["number"]
    citation.update({"issued": {"date-parts": [[year, month, day]]}, "URL": item["final"], "accessed": {"date-parts": [[2026, 11, 26]]}})
    short = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."][month - 1]
    cite = f"{item['title']} ({COMMISSION} {short} {day}, {year})" if case else f"{COMMISSION}, {item['title']} ({short} {day}, {year})"
    notes = (f"Indigo Book citation: {cite}. {item['genre']} of the {COMMISSION}, dated {long_date(item['date'])}, as listed in the Commission's reading room ({item['listing']}). "
             f"{details(item)} Title, date and details from the Commission's table; nations matched by name. "
             f"Generated by {SCRIPT}; not yet read by a person (Unverified).").replace("  ", " ")
    record = {"key": record_key(item), "kind": "federal-case" if case else "federal-agency-document", "citation": citation,
              "original_link": item["final"], "retrieved": "2026-11-26"}
    if copy:
        record["file"] = copy
    record["rights"] = RIGHTS
    record["jurisdictions"] = [{"level": "federal"}]
    if named:
        record["tribes"] = [nation for nation, _ in named]
    if case:
        record["nations_in_case"] = {"checked": "2026-11-26", "named": [{"nation": nation, "named_as": words, "role": "party"} for nation, words in named]}
    record.update({"topics": ["gaming"], "access": {"open": True, "pull_from": ["free-web"]}, "found_in": [SESSION], "notes": notes,
                   "review": {"status": "unverified", "by": SCRIPT, "date": "2026-11-26",
                              "checks": [{"check": "listing", "result": "missing", "detail": f"Only the Commission's table was read: {item['listing']}"}]}})
    return record


def records(args) -> None:
    sys.path.insert(0, str(ROOT / "scripts/law"))
    from nation_names import NationNames  # noqa: E402

    work = Path(args.work)
    documents = json.loads((work / "documents.json").read_text(encoding="utf-8"))
    names = NationNames()
    copies = {}
    for row in csv.DictReader(CAPTURE_INDEX.open(encoding="utf-8")):
        copies[row["sha256"]] = {"storage_key": row["key"], "checksum": row["sha256"], "media_type": row["media_type"], "bytes": int(row["bytes"])}
    written = 0
    for item in documents:
        if not item.get("file"):
            continue
        key = record_key(item)
        named = names.named(item["nation"]) if item.get("nation") else []
        path = SOURCES / (key[0] if key[0].isalpha() else "_other") / f"{key}.yaml"
        path.parent.mkdir(exist_ok=True)
        path.write_text(dump(record_for(item, copies.get(item["sha256"]), named)), encoding="utf-8")
        written += 1
    print(f"wrote {written} records")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    for name in ("fetch", "file", "records"):
        command = sub.add_parser(name)
        command.add_argument("--work", required=True)
        if name == "fetch":
            command.add_argument("--retry", action="store_true", help="download again only the documents that failed last time")
    args = parser.parse_args()
    {"fetch": fetch, "file": file, "records": records}[args.command](args)


if __name__ == "__main__":
    main()
