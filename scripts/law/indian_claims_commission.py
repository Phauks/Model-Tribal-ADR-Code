#!/usr/bin/env python3
"""Case records and stored copies for the decisions of the Indian Claims
Commission (1946-1978; data tier 2; Trevor, Nov. 26, 2026: "add these to the
data roadmap, attempt to grab the high value and scriptables").

The Commission's decisions were published by the Government Printing Office
in 43 volumes, *Indian Claims Commission Decisions* (cited "Ind. Cl.
Comm."). Oklahoma State University Library scanned them and lists each
opinion, finding, order and award as its own item in a CONTENTdm collection
(alias p17279coll10, https://cdm17279.contentdm.oclc.org/digital/collection/p17279coll10),
with its parties, date, docket numbers, volume and first page (the item's
identifier, such as oksd_icc_d337_v05_p493a: docket 337, volume 5, page
493), the kind of decision and the Library of Congress subjects that name
the claimant nation. As works of the United States government the volumes
are public domain (the library's own rights statement says so), so the
project keeps each PDF in the bucket under indian-claims-commission/ and
serves it, crediting the library as it asks.

The nation is matched by name (scripts/law/nation_names.py) in the parties'
names and the subjects. Every record starts Unverified.

Steps:
  fetch    Read the collection's item list and download each PDF.
           Writes --work/decisions.json.
  file     Store each PDF in the bucket and add it to the capture index.
  records  Write content/sources/<letter>/<key>.yaml for each decision.

Usage:
  python3 scripts/law/indian_claims_commission.py fetch --work DIR
  python3 scripts/law/indian_claims_commission.py file --work DIR
  python3 scripts/law/indian_claims_commission.py records --work DIR
"""
from __future__ import annotations

import argparse
import concurrent.futures
import csv
import datetime as dt
import hashlib
import json
import re
import sys
import threading
import time
import urllib.request
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
CAPTURE_INDEX = ROOT / "research/capture-index.csv"
SOURCES = ROOT / "content/sources"
SESSION = "2026-11-26-indian-claims-commission"
SCRIPT = "scripts/law/indian_claims_commission.py"
TOPIC = "indian-claims-commission"
HOST = "https://cdm17279.contentdm.oclc.org"
ALIAS = "p17279coll10"
API = f"{HOST}/digital/bl/dmwebservices/index.php?q="
COMMISSION = "Indian Claims Commission"
LIBRARY = "Oklahoma State University Library"
# The library's robots.txt allows its API and downloads to every agent with a crawl delay of one second, so a new request starts
# at most once a second (a download takes several seconds at the library's speed, so a few run at once).
CRAWL_DELAY = 1.0
_LAST_REQUEST = [0.0]
_REQUEST_LOCK = threading.Lock()
FIELDS = "identi!title!date!descri!is!subjec"
RIGHTS = {"status": "no-permission-needed", "basis": "us-government-work",
          "basis_note": "A work of the United States government, not subject to copyright (17 U.S.C. § 105). "
                        "Scanned by the Oklahoma State University Library, which asks that it be credited.",
          "redistribution": True}


def dump(value) -> str:
    return yaml.safe_dump(value, sort_keys=False, allow_unicode=True, width=10_000)


def get(url: str) -> bytes:
    for attempt in range(5):
        try:
            with _REQUEST_LOCK:
                wait = _LAST_REQUEST[0] + CRAWL_DELAY - time.monotonic()
                if wait > 0:
                    time.sleep(wait)
                _LAST_REQUEST[0] = time.monotonic()
            with urllib.request.urlopen(url, timeout=300) as response:
                return response.read()
        except Exception:  # noqa: BLE001 - retried, then raised
            if attempt == 4:
                raise
            time.sleep(5 * (attempt + 1))


def item_page(pointer: int) -> str:
    return f"{HOST}/digital/collection/{ALIAS}/id/{pointer}"


def download_link(pointer: int) -> str:
    return f"{HOST}/digital/api/collection/{ALIAS}/id/{pointer}/download"


def parse_identifier(identifier: str) -> dict:
    """oksd_icc_d337_v05_p493a: docket 337, volume 5, page 493, the first item at that page."""
    match = re.match(r"oksd_icc_d([^_]+)_v(\d+)_p(\d+)([a-z]*)$", identifier.strip())
    if not match:
        return {}
    return {"docket_code": match.group(1), "volume": str(int(match.group(2))), "page": str(int(match.group(3))), "suffix": match.group(4)}


def fetch(args) -> None:
    work = Path(args.work)
    (work / "files").mkdir(parents=True, exist_ok=True)
    items, start = [], 1
    while True:
        page = json.loads(get(f"{API}dmQuery/{ALIAS}/0/{FIELDS}/identi/1024/{start}/1/0/0/0/json"))
        items += page["records"]
        total = int(page["pager"]["total"])
        start += 1024
        if start > total:
            break
    print(f"{len(items)} of {total} items listed")

    def read(item: dict) -> dict:
        path = work / "files" / f"{item['pointer']}.pdf"
        if not path.exists() or path.stat().st_size == 0:
            try:
                data = get(download_link(item["pointer"]))
            except Exception as problem:  # noqa: BLE001 - reported in the entry
                item["problem"] = str(problem)
                return item
            if not data.startswith(b"%PDF"):
                item["problem"] = "not a PDF"
                return item
            path.write_bytes(data)
        data = path.read_bytes()
        item.update(file=path.name, sha256=hashlib.sha256(data).hexdigest(), bytes=len(data))
        return item

    with concurrent.futures.ThreadPoolExecutor(8) as pool:
        items = list(pool.map(read, items))
    (work / "decisions.json").write_text(json.dumps(items, indent=1, ensure_ascii=False), encoding="utf-8")
    for item in items:
        if item.get("problem"):
            print("FAILED", item["pointer"], item.get("identi"), item["problem"], file=sys.stderr)
    print(f"{sum(1 for i in items if i.get('file'))} downloaded, {sum(i.get('bytes', 0) for i in items) / 1e9:.2f} GB")


def text(value) -> str:
    return value.strip() if isinstance(value, str) else ""


def dockets_of(item: dict) -> str:
    """"Indian Claims Commission Decisions ; Volume 01, Docket no. 033, 034, 035" -> "Docket Nos. 33, 34, 35"."""
    match = re.search(r"Docket nos?\.\s*(.+)$", text(item.get("is")), re.I)
    if not match:
        return ""
    numbers = [re.sub(r"^0+(?=\w)", "", part.strip()) for part in re.split(r",|\band\b", match.group(1)) if part.strip()]
    return f"Docket No{'s' if len(numbers) > 1 else ''}. {', '.join(numbers)}"


def case_name(title: str) -> str:
    """The parties as the volume prints them, less the roles: "Kaw Tribe of Indians ... v. United States"."""
    name = re.sub(r"\s+", " ", title).strip().rstrip(".")
    name = re.sub(r",?\s*(?:Petitioners?|Plaintiffs?|Defendants?|Claimants?|Appellants?|Appellees?|Intervenors?)\b\.?", "", name, flags=re.I)
    name = re.sub(r"\bvs?\.\s+", "v. ", name)
    name = re.sub(r"\bv\. (?:the )?United States of America\b", "v. United States", name, flags=re.I)
    name = re.sub(r"^The\s+", "", name)
    name = re.sub(r"\s+,", ",", re.sub(r"\s{2,}", " ", name)).strip(" ,;")
    return name


def short_name(name: str) -> str:
    """For the Indigo Book citation: the first party before any "on the relation of" or "ex rel." and "v. United States"."""
    first, _, second = name.partition(" v. ")
    first = re.split(r",| on (?:the )?relation of| ex rel\.?| by and through| acting by| et al\.?", first, maxsplit=1, flags=re.I)[0].strip()
    second = second.strip() or "United States"
    if re.match(r"United States", second):
        second = "United States"
    return f"{first} v. {second}"


def slug(value: str) -> str:
    value = value.replace("’", "").replace("'", "").replace("&", " and ")
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", value.lower())).strip("-")


def record_key(item: dict) -> str:
    """kaw-tribe-of-indians-v-united-states-1-ind-cl-comm-355a (the key assign_keys gave, when it gave one)."""
    if item.get("key"):
        return item["key"]
    parts = parse_identifier(item["identi"])
    name = slug(short_name(case_name(item["title"])))
    if len(name) > 60:
        name = name[:60].rsplit("-", 1)[0]
    return f"{name}-{parts['volume']}-ind-cl-comm-{parts['page']}{parts['suffix']}"


# The catalog's date of these items is out of order in their volume (volume 1 runs from 1948 to 1951), so the record says so until a person reads the date from the scan.
DATE_DOUBTS = {
    "oksd_icc_d005_v01_p031": "volume 1's other items are dated 1948 to 1951, and the opinion says it was decided the same day as cases 2 and 3",
    "oksd_icc_d014_v01_p644": "volume 1's other items are dated 1948 to 1951",
}


def assign_keys(items: list[dict]) -> list[dict]:
    """The items to keep, one per catalog identifier, each with its record key. Two
    items under different dockets printed at the same page with no letter (Yakima,
    16 Ind. Cl. Comm. 565) would share a key, so each takes its docket code."""
    kept, seen = [], set()
    for item in items:
        if item.get("file") and parse_identifier(item["identi"]) and item["identi"].strip() not in seen:
            seen.add(item["identi"].strip())
            kept.append(item)
    for item in kept:
        item.pop("key", None)
    counts: dict[str, int] = {}
    for item in kept:
        counts[record_key(item)] = counts.get(record_key(item), 0) + 1
    for item in kept:
        base = record_key(item)
        item["key"] = f"{base}-docket-{slug(parse_identifier(item['identi'])['docket_code'])}" if counts[base] > 1 else base
    return kept


def long_date(value: str) -> str:
    day = dt.date.fromisoformat(value)
    return f"{day:%B} {day.day}, {day.year}"


def record_for(item: dict, copy: dict | None, named: list[tuple[str, str]], others: list[str]) -> dict:
    parts = parse_identifier(item["identi"])
    name = case_name(item["title"])
    kind = text(item.get("descri")) or "Decision"
    year, month, day = (int(part) for part in item["date"].split("-"))
    citation = {"type": "legal_case", "title": name, "container-title": "Ind. Cl. Comm.", "volume": parts["volume"], "page": parts["page"],
                "authority": COMMISSION}
    dockets = dockets_of(item)
    if dockets:
        citation["number"] = dockets
    citation.update({"genre": kind, "issued": {"date-parts": [[year, month, day]]}, "URL": item_page(item["pointer"]),
                     "accessed": {"date-parts": [[2026, 11, 26]]}})
    subjects = text(item.get("subjec"))
    notes = (f"Indigo Book citation: {short_name(name)}, {parts['volume']} Ind. Cl. Comm. {parts['page']} ({year}). "
             f"{kind} of the {COMMISSION}{f' in {dockets}' if dockets else ''}, dated {long_date(item['date'])}, "
             f"printed in volume {parts['volume']} of Indian Claims Commission Decisions beginning at page {parts['page']}. "
             f"Parties, date, dockets, volume and page from the {LIBRARY}'s catalog of its scan (item {item['identi']}"
             + (f"; subjects: {subjects}" if subjects else "") + "). "
             + (f"Other items printed at the same page: {', '.join(others)}. " if others else "")
             + (f"The catalog's date may be wrong: {DATE_DOUBTS[item['identi'].strip()]}. " if item["identi"].strip() in DATE_DOUBTS else "")
             + f"Generated by {SCRIPT}, with the nations matched by name in the parties and subjects; not yet read by a person (Unverified).")
    record = {"key": record_key(item), "kind": "federal-case", "citation": citation, "original_link": download_link(item["pointer"]), "retrieved": "2026-11-26"}
    if copy:
        record["file"] = copy
    record.update({
        "rights": RIGHTS,
        "jurisdictions": [{"level": "federal"}],
        **({"tribes": [nation for nation, _ in named]} if named else {}),
        "nations_in_case": {"checked": "2026-11-26", "named": [{"nation": nation, "named_as": words, "role": "party"} for nation, words in named]},
        "topics": ["indian-claims"],
        "access": {"open": True, "pull_from": ["free-web"]},
        "found_in": [SESSION],
        "notes": notes,
        "review": {"status": "unverified", "by": SCRIPT, "date": "2026-11-26",
                   "checks": [{"check": "listing", "result": "missing", "detail": f"Only the library's catalog entry was read: {item_page(item['pointer'])}"}]},
    })
    return record


def file(args) -> None:
    sys.path.insert(0, str(ROOT / "scripts/captures"))
    import mirror_captures  # noqa: E402

    work = Path(args.work)
    items = json.loads((work / "decisions.json").read_text(encoding="utf-8"))
    assign_keys(items)
    rows = mirror_captures.load_index()
    filed = {row["key"] for row in rows}
    by_digest = {row["sha256"]: row["key"] for row in rows}
    s3 = mirror_captures.client()
    bucket = mirror_captures.bucket_name()
    work_items = []
    for item in items:
        # Only the decisions: the appendices (maps and tables) have no volume and page of their own and no record.
        if not item.get("file") or not item.get("key"):
            continue
        key = f"{TOPIC}/{item['identi']}.pdf"
        item["storage_key"] = by_digest.get(item["sha256"], key)
        if key not in filed and item["sha256"] not in by_digest:
            work_items.append((item, key))
            by_digest[item["sha256"]] = key

    def put(entry):
        item, key = entry
        path = work / "files" / item["file"]
        if mirror_captures.remote_state(s3, bucket, key) != (path.stat().st_size, item["sha256"]):
            s3.upload_file(str(path), bucket, key, ExtraArgs={"ContentType": "application/pdf", "Metadata": {
                "sha256": item["sha256"], "captured": dt.date.today().isoformat()}})
            if mirror_captures.remote_state(s3, bucket, key) != (path.stat().st_size, item["sha256"]):
                return None
        return entry

    added = 0
    with concurrent.futures.ThreadPoolExecutor(8) as pool:
        for result in pool.map(put, work_items):
            if not result:
                print("verification failed", file=sys.stderr)
                continue
            item, key = result
            parts = parse_identifier(item["identi"])
            rows.append(mirror_captures.index_row(
                key=key, size=item["bytes"], digest=item["sha256"], media="application/pdf", topic=TOPIC,
                title=f"{case_name(item['title'])}, {parts['volume']} Ind. Cl. Comm. {parts['page']} ({item['date'][:4]})", nations="",
                obtained=f"downloaded from the {LIBRARY}'s scan of Indian Claims Commission Decisions (CONTENTdm) by script",
                links=[download_link(item["pointer"]), item_page(item["pointer"])], record=record_key(item), redistribution="yes",
                rights="United States government work (17 U.S.C. § 105); scan by the Oklahoma State University Library.", existing_keys=filed))
            filed.add(key)
            added += 1
    mirror_captures.write_index(rows)
    (work / "decisions.json").write_text(json.dumps(items, indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"filed {added}")


def records(args) -> None:
    sys.path.insert(0, str(ROOT / "scripts/law"))
    from nation_names import NationNames  # noqa: E402

    work = Path(args.work)
    items = assign_keys(json.loads((work / "decisions.json").read_text(encoding="utf-8")))
    copies = {}
    for row in csv.DictReader(CAPTURE_INDEX.open(encoding="utf-8")):
        copies[row["sha256"]] = {"storage_key": row["key"], "checksum": row["sha256"], "media_type": row["media_type"], "bytes": int(row["bytes"])}
    existing = {path.stem: path for path in SOURCES.rglob("*.yaml")}
    names = NationNames()
    keys: dict[str, int] = {}
    for item in items:
        keys[record_key(item)] = keys.get(record_key(item), 0) + 1
    dupes = [key for key, count in keys.items() if count > 1]
    if dupes:
        raise SystemExit(f"{len(dupes)} keys used twice, such as {dupes[:3]}")
    # Items printed at the same volume and page (an opinion and its findings, say), so each record can name the others.
    by_page: dict[tuple[str, str], list[str]] = {}
    for item in items:
        parts = parse_identifier(item["identi"])
        by_page.setdefault((parts["volume"], parts["page"]), []).append(record_key(item))
    written = 0
    for item in items:
        key = record_key(item)
        path = SOURCES / (key[0] if key[0].isalpha() else "_other") / f"{key}.yaml"
        if key in existing and SESSION not in existing[key].read_text(encoding="utf-8"):
            print("key taken by another record, skipped:", key, file=sys.stderr)
            continue
        path.parent.mkdir(exist_ok=True)
        parts = parse_identifier(item["identi"])
        others = [other for other in by_page[(parts["volume"], parts["page"])] if other != key]
        haystack = f"{item['title']} ; {re.sub(r'--[^;]*', ' Indians', text(item.get('subjec')))}"
        named = names.named(case_name(item["title"]))
        for nation in names.find(haystack):
            if nation not in [found for found, _ in named]:
                named.append((nation, names.names[nation]))
        path.write_text(dump(record_for(item, copies.get(item["sha256"]), named, others)), encoding="utf-8")
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
