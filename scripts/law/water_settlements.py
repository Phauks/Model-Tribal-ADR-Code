#!/usr/bin/env python3
"""Records, stored copies and nation-page facts for the Indian water rights settlements (new data source category 2;
Trevor, Nov. 27, 2026: "grab 1,2,4").

Two sources:

The Acts. research/water-settlements/enacted-settlements.csv lists the 35 settlements Congress has enacted, copied by
hand from Table 1 of the Congressional Research Service's report *Indian Water Rights Settlements*, R44148 (Dec. 3,
2024): year, the Act and the public laws that amended it, the states, the nations as CRS names them (with their
profiles, matched by hand), the acre-feet a year and the authorized federal cost. The four settlements reached
without an Act of Congress (39 in all) are not in the table and not listed. For each public law, the script finds
its granule of the Statutes at Large on GovInfo (searching GovInfo for "Public Law <number>" and checking each hit's
own public law citation), stores the PDF in the bucket under govinfo/STATUTE-<volume>/, the folder the other
Statutes at Large copies use, and writes a federal-statute record (public-law-<congress>-<number>) naming the
nations. A public law that already has a record keeps it; the script adds the nations and the topic.

The University of New Mexico's Native American Water Rights Settlement Project (two Digital Commons sets,
publication:nawrs and publication:nawrs_comm, read by OAI-PMH) holds the settlement agreements, compacts, decrees,
tribal water codes and legislation behind many settlements. Its PDFs refuse scripts (403), so the script does not
download them and does not get past the check: each item that is not federal legislation (which the Acts above
cover) gets a catalog record linking to the university's copy, and the agreements and decrees are added to the
hand-pull list. The records keep the university's own description out: it is the university's writing.

Each settlement becomes a nation-page fact (jurisdiction topic water-rights-settlement, value enacted) for each
nation it names, citing the Act's record. Every record and fact starts Unverified.

Steps:
  fetch    Read the University of New Mexico sets and find each Act's GovInfo granule. Writes --work/water.json.
  file     Download each Act's PDF and store it in the bucket.
  records  Write the Act and catalog records and research/water-settlements/*.csv.
  facts    Write research/jurisdiction/water-rights-settlements.json for scripts/jurisdiction/apply.py.

Usage:
  python3 scripts/law/water_settlements.py fetch --work DIR
  python3 scripts/law/water_settlements.py file --work DIR --captures /mnt/project-files/research/captures
  python3 scripts/law/water_settlements.py records --work DIR
  python3 scripts/law/water_settlements.py facts --work DIR
  python3 scripts/jurisdiction/apply.py research/jurisdiction/water-rights-settlements.json
"""
from __future__ import annotations

import argparse
import csv
import html
import json
import os
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
RESEARCH = ROOT / "research/water-settlements"
SETTLEMENTS = RESEARCH / "enacted-settlements.csv"
INDEX = ROOT / "research/capture-index.csv"
BATCH = ROOT / "research/jurisdiction/water-rights-settlements.json"
SESSION = "2026-11-27-water-rights-settlements"
SCRIPT = "scripts/law/water_settlements.py"
TODAY = "2026-11-27"
TOPIC = "water-rights-settlement"
AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
OAI = "https://digitalrepository.unm.edu/do/oai/"
SETS = ("publication:nawrs", "publication:nawrs_comm")
# The project's record of the report is crs-r44148 (the congressional sources thread; the June 17, 2025 version). The table
# was copied from the Dec. 3, 2024 version, read on EveryCRSReport.com.
CRS_LINK = "https://www.everycrsreport.com/files/2024-12-03_R44148_4e5766ec72ea73b3dcd2cb4ce6b4da016d301c7a.html"
GOVINFO = "https://api.govinfo.gov"
SHORT = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."]
GOVERNMENT = {"status": "no-permission-needed", "basis": "us-government-work",
              "basis_note": "Federal statutes and regulations are works of the U.S. government (17 U.S.C. § 105).", "redistribution": True}
LINKED = {"status": "no-permission-needed", "basis": "link-only",
          "basis_note": "Cited and linked to the University of New Mexico's copy, which refuses automated downloads; a person can pull a copy (pull list). The university's own description is not reproduced.",
          "redistribution": False}
# The university's words for what an item is, and the record kind each becomes. Federal legislation is left to the Act records.
KINDS = [
    (r"Decree|Court|Opinion|Judgment|Order|Claims|Hearing", "other", "Water rights court decree or filing"),
    (r"Settlement|Agreement|Compact", "intergovernmental-agreement", "Water rights settlement agreement"),
    (r"Tribal Water Code|Tribal", "tribal-code", "Tribal water code"),
    (r"State Legislation", "state-statute", "State legislation"),
]


def dump(value) -> str:
    return yaml.safe_dump(value, sort_keys=False, allow_unicode=True, width=float("inf"))


def get(url: str, data: bytes | None = None, headers: list[str] | None = None) -> bytes:
    command = ["curl", "-sfL", "-m", "300", "-A", AGENT]
    for header in headers or []:
        command += ["-H", header]
    if data is not None:
        command += ["--data-binary", "@-"]
    for attempt in range(4):
        result = subprocess.run(command + [url], input=data, capture_output=True)
        if result.returncode == 0:
            return result.stdout
        time.sleep(4 * (attempt + 1))
    raise SystemExit(f"could not read {url.split('api_key=')[0]}")


def key() -> str:
    value = os.environ.get("DATA_GOV_API_KEY")
    if not value:
        raise SystemExit("DATA_GOV_API_KEY is not set")
    return value


def settlements() -> list[dict]:
    with SETTLEMENTS.open(encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def laws_of(row: dict) -> list[str]:
    return [row["public_law"]] + [law.strip() for law in row["amending_laws"].split(";") if law.strip()]


def long_date(value: str) -> str:
    year, month, day = (int(part) for part in value.split("-"))
    return f"{SHORT[month - 1]} {day}, {year}"


# ---------------------------------------------------------------- fetch

def oai_records(work: Path) -> list[dict]:
    out = []
    for name in SETS:
        token = None
        while True:
            query = {"verb": "ListRecords", "resumptionToken": token} if token else {"verb": "ListRecords", "metadataPrefix": "oai_dc", "set": name}
            body = get(f"{OAI}?{urllib.parse.urlencode(query)}").decode("utf-8")
            for record in re.findall(r"(?s)<record>.*?</record>", body):
                fields = {field: [html.unescape(value).strip() for value in re.findall(rf"(?s)<dc:{field}>(.*?)</dc:{field}>", record)]
                          for field in ("title", "date", "identifier", "description", "subject", "creator", "rights", "relation")}
                fields["oai"] = re.search(r"<identifier>(.*?)</identifier>", record).group(1)
                fields["set"] = name
                out.append(fields)
            found = re.search(r"<resumptionToken[^>]*>([^<]+)</resumptionToken>", body)
            if not found:
                break
            token = found.group(1)
            time.sleep(1)
    return out


# Public laws GovInfo's search does not return (omnibus Acts, whose text has too many hits), by their first page in the
# Statutes at Large; the granule found there is still checked against its own public law citation.
FIRST_PAGES = {"101-618": ("104", "3289"), "102-575": ("106", "4600"), "106-554": ("114", "2763"), "108-447": ("118", "2809"),
               "111-11": ("123", "991"), "116-260": ("134", "1182")}


def summary_of(package: str, granule: str, law: str) -> dict:
    summary = json.loads(get(f"{GOVINFO}/packages/{package}/granules/{granule}/summary?api_key={key()}"))
    if (summary.get("identifier") or {}).get("publicLawCitation") != f"Public Law {law}":
        return {}
    volume, page = re.match(r"STATUTE-(\d+)-Pg(\d+)", summary["granuleId"]).groups()
    return {"granule": summary["granuleId"], "package": summary["packageId"], "title": summary.get("title", ""), "volume": volume, "page": page,
            "date": summary.get("granuleDate") or summary.get("dateIssued"), "link": f"https://www.govinfo.gov/app/details/{summary['packageId']}/{summary['granuleId']}",
            "pdf": f"https://www.govinfo.gov/content/pkg/{summary['packageId']}/pdf/{summary['granuleId']}.pdf"}


def granule_for(law: str) -> dict:
    """The Statutes at Large granule GovInfo gives this public law, checked by the granule's own citation."""
    if law in FIRST_PAGES:
        volume, page = FIRST_PAGES[law]
        return summary_of(f"STATUTE-{volume}", f"STATUTE-{volume}-Pg{page}", law)
    query = json.dumps({"query": f'collection:(STATUTE) AND "Public Law {law}"', "pageSize": 25, "offsetMark": "*"}).encode()
    hits = json.loads(get(f"{GOVINFO}/search?api_key={key()}", data=query, headers=["Content-Type: application/json"]))
    for hit in hits.get("results", []):
        if not hit.get("granuleId"):
            continue
        found = summary_of(hit["packageId"], hit["granuleId"], law)
        if found:
            return found
        time.sleep(0.3)
    return {}


def fetch(args) -> None:
    work = Path(args.work)
    work.mkdir(parents=True, exist_ok=True)
    path = work / "water.json"
    data = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    data["university"] = oai_records(work)
    granules = data.get("granules", {})
    for row in settlements():
        for law in laws_of(row):
            if granules.get(law):
                continue
            granules[law] = granule_for(law)
            print(law, granules[law].get("granule", "NOT FOUND"), granules[law].get("title", "")[:80], flush=True)
    data["granules"] = granules
    path.write_text(json.dumps(data, indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"{len(data['university'])} university items; {sum(1 for value in granules.values() if value)} of {len(granules)} public laws found on GovInfo")


# ---------------------------------------------------------------- file

def stored_key(granule: dict) -> str:
    return f"govinfo/{granule['package']}/{granule['granule']}.pdf"


def file(args) -> None:
    sys.path.insert(0, str(ROOT / "scripts/captures"))
    import mirror_captures  # noqa: E402

    work = Path(args.work)
    data = json.loads((work / "water.json").read_text(encoding="utf-8"))
    known = {row["key"] for row in csv.DictReader(INDEX.open(encoding="utf-8"))}
    for law, granule in sorted(data["granules"].items()):
        if not granule or stored_key(granule) in known or existing(law, granule).get("file"):
            continue
        local = work / "files" / f"{granule['granule']}.pdf"
        local.parent.mkdir(parents=True, exist_ok=True)
        if not local.exists():
            local.write_bytes(get(granule["pdf"]))
        if local.read_bytes()[:5] != b"%PDF-":
            print(f"not a PDF: {law}")
            continue
        mirror_captures.add(argparse.Namespace(
            captures=args.captures, files=[str(local)], topic=f"govinfo/{granule['package']}", name=f"{granule['granule']}.pdf",
            record=record_key(law), obtained=f"downloaded from GovInfo by {SCRIPT}", title=granule["title"], link=[granule["pdf"]],
            redistribution="yes", nations="", rights="United States government work (17 U.S.C. § 105).", keep_local=False))


# ---------------------------------------------------------------- records

def record_key(law: str) -> str:
    return f"public-law-{law}"


def record_path(record_key_: str) -> Path:
    return SOURCES / record_key_[0] / f"{record_key_}.yaml"


def existing(law: str, granule: dict) -> dict:
    """The record that already holds this Act: by key, or by its Statutes at Large page."""
    path = record_path(record_key(law))
    if path.exists():
        return yaml.safe_load(path.read_text(encoding="utf-8"))
    return {}


def copies() -> dict[str, dict]:
    out = {}
    for row in csv.DictReader(INDEX.open(encoding="utf-8")):
        out[row["key"]] = {"storage_key": row["key"], "checksum": row["sha256"], "media_type": row["media_type"], "bytes": int(row["bytes"])}
    return out


def stored_by_hash(data: dict, granule: dict, stored: dict) -> dict | None:
    """The copy already in the bucket under another key (the file step finds it by SHA-256 and does not store it twice)."""
    import hashlib
    local = Path(data["work"]) / "files" / f"{granule['granule']}.pdf"
    if not local.exists():
        return None
    digest = hashlib.sha256(local.read_bytes()).hexdigest()
    return next((copy for copy in stored.values() if copy["checksum"] == digest), None)


def act_records(data: dict) -> tuple[list[tuple[Path, dict]], dict[str, list[str]]]:
    nations_for: dict[str, list[str]] = {}
    names_for: dict[str, list[str]] = {}
    for row in settlements():
        nations = [nation for nation in row["nations"].split("; ") if nation]
        for law in laws_of(row):
            nations_for.setdefault(law, [])
            nations_for[law] += [nation for nation in nations if nation not in nations_for[law]]
            names_for.setdefault(law, [])
            role = "enacted" if law == row["public_law"] else "amended"
            names_for[law].append(f"{'is' if role == 'enacted' else 'amended'} the {row['settlement']} ({row['year']})")
    stored = copies()
    out = []
    for law, nations in nations_for.items():
        granule = data["granules"].get(law) or {}
        record = existing(law, granule)
        if record:
            record["tribes"] = record.get("tribes", []) + [nation for nation in nations if nation not in record.get("tribes", [])]
            record["topics"] = record.get("topics", []) + ([TOPIC] if TOPIC not in record.get("topics", []) else [])
            if SESSION not in record.get("found_in", []):
                record.setdefault("found_in", []).append(SESSION)
            if not record.get("file") and granule:
                record["file"] = stored.get(stored_key(granule)) or stored_by_hash(data, granule, stored)
                if not record["file"]:
                    del record["file"]
            out.append((record_path(record_key(law)), record))
            continue
        if not granule:
            print(f"no GovInfo granule for Public Law {law}: no record written")
            continue
        congress, number = law.split("-")
        date = granule["date"][:10]
        enacting = next((row["settlement"] for row in settlements() if row["public_law"] == law), "")
        title = granule["title"] or f"Pub. L. No. {law}"
        if enacting and title.startswith("An act") and len(enacting) < len(title):
            title = enacting  # GovInfo gives only the long title; the Act's own short title, as the Congressional Research Service names it.
        citation = {"type": "legislation", "title": title, "title-short": f"Act of {long_date(date)}",
                    "container-title": "United States Statutes at Large", "volume": granule["volume"], "page": granule["page"], "number": f"Pub. L. No. {law}",
                    "author": [{"literal": "United States Congress"}], "URL": granule["link"],
                    "issued": {"date-parts": [[int(part) for part in date.split("-")]]}, "accessed": {"date-parts": [[2026, 11, 27]]}}
        record = {"key": record_key(law), "kind": "federal-statute", "citation": citation, "original_link": granule["link"], "retrieved": TODAY, "archives": []}
        if stored_key(granule) in stored:
            record["file"] = stored[stored_key(granule)]
        record["rights"] = GOVERNMENT
        record["tribes"] = nations
        record["jurisdictions"] = [{"level": "federal"}]
        record["topics"] = [TOPIC]
        record["found_in"] = [SESSION]
        record["notes"] = (f"Indigo Book citation: {citation['title']}, Pub. L. No. {law}, {granule['volume']} Stat. {granule['page']} ({date[:4]}). "
                           f"The Act {'; '.join(names_for[law])}, as Table 1 of the Congressional Research Service's report R44148 (Dec. 3, 2024) lists it. "
                           f"Statutes at Large granule {granule['granule']} on GovInfo, found by {SCRIPT}; nobody has checked the record against the Act yet (Unverified).")
        out.append((record_path(record_key(law)), record))
    return out, nations_for


def university_records(data: dict, names: NationNames) -> list[tuple[Path, dict]]:
    out = []
    seen = set()
    for item in data["university"]:
        description = item["description"][0] if item["description"] else ""
        label = description.split(":")[0].strip() if ":" in description[:80] else ""
        if item["oai"] in seen or not item["title"]:
            continue
        seen.add(item["oai"])
        # Federal legislation is left to the Act records from GovInfo.
        if re.search(r"Federal Legis|purposes? of this (?:Act|section|amendment)|^Amends the|This Act|Congressional approval|^To direct the Secretary|^The overall purpose", description, re.I) and not re.search(r"Agreement|Decree|Settlement &|Settlement and", label):
            continue
        kind, genre = next(((kind, genre) for pattern, kind, genre in KINDS if re.search(pattern, label or item["title"][0], re.I)), ("other", "Water rights settlement document"))
        link = next((value for value in item["identifier"] if value.startswith("https://digitalrepository.unm.edu/") and "/viewcontent/" not in value), "")
        if not link:
            number = re.search(r"/article/(\d+)/", " ".join(item["identifier"]))
            link = f"https://digitalrepository.unm.edu/{item['set'].split(':')[1]}/{int(number.group(1)) - 999}" if number else ""
        if not link:
            continue
        identifier = re.search(r"/([a-z_]+)/(\d+)$", link)
        record_key_ = f"university-of-new-mexico-{identifier.group(1).replace('_', '-')}-{identifier.group(2)}" if identifier else None
        if not record_key_:
            continue
        date = (item["date"][0] if item["date"] else "")[:10]
        citation = {"type": "legal_case" if False else "document", "title": item["title"][0], "genre": genre,
                    "publisher": "University of New Mexico, Native American Water Rights Settlement Project", "URL": link, "accessed": {"date-parts": [[2026, 11, 27]]}}
        if re.match(r"\d{4}-\d\d-\d\d", date):
            citation["issued"] = {"date-parts": [[int(part) for part in date.split("-")]]}
        nations = settlement_nations(f"{item['title'][0]} ; {description[:300]}") or names.find(item["title"][0])
        record = {"key": record_key_, "kind": kind, "citation": citation, "original_link": link, "retrieved": TODAY, "archives": [], "rights": LINKED}
        if nations:
            record["tribes"] = nations
        record["jurisdictions"] = [{"level": "tribal" if kind == "tribal-code" else "state" if kind == "state-statute" else "federal"}]
        record["topics"] = [TOPIC]
        record["found_in"] = [SESSION]
        record["notes"] = (f"Listed in the University of New Mexico's Native American Water Rights Settlement Project as \"{label or 'item'}\" ({item['set']}, OAI identifier {item['oai']}). "
                           f"The university's PDF refuses automated downloads, so no copy is stored; it is on the hand-pull list. Nations matched by name in the title and the first subjects. "
                           f"Generated by {SCRIPT} (Unverified).")
        out.append((record_path(record_key_), record))
    return out


# The words that name each settlement in the university's titles ("Ak-Chin", "Fort Hall"), from the settlement's own name.
STEMS = r"\s+(?:Indian|Indians|Water|Tribe|Tribes|Settlement|Band|Community|Rights|Litigation|Reserved|Rural|Utah|Paiute Tribe-Fish)\b.*$"


def settlement_nations(text: str) -> list[str]:
    found = []
    for row in settlements():
        stem = re.sub(STEMS, "", row["settlement"]).strip()
        if len(stem) < 4 or stem in {"Southern Arizona", "Arizona", "Montana", "Snake River", "Navajo"}:
            stem = {"Southern Arizona": "San Xavier|Schuk Toak|Southern Arizona Water", "Arizona": "Gila River|Arizona Water Settlements",
                    "Montana": "Salish|Kootenai|Flathead|CSKT", "Snake River": "Nez Perce", "Navajo": "Navajo"}.get(stem, re.escape(stem))
        else:
            stem = re.escape(stem)
        stem += {"Chippewa Cree": "|Rocky Boy", "Fort Hall": "|Shoshone-Bannock", "Aamodt": "|Nambé|Nambe|Pojoaque|San Ildefonso|Tesuque"}.get(re.sub(STEMS, "", row["settlement"]).strip(), "")
        if re.search(rf"\b(?:{stem})\b", text, re.I):
            found += [nation for nation in row["nations"].split("; ") if nation and nation not in found]
    return found


def records(args) -> None:
    work = Path(args.work)
    data = json.loads((work / "water.json").read_text(encoding="utf-8"))
    data["work"] = str(work)
    names = NationNames()
    acts, _ = act_records(data)
    catalog = university_records(data, names)
    for path, record in acts + catalog:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(dump(record), encoding="utf-8")
    with (RESEARCH / "university-of-new-mexico-items.csv").open("w", encoding="utf-8", newline="") as handle:
        out = csv.writer(handle)
        out.writerow(["record", "kind", "genre", "title", "date", "nations", "link"])
        for _, record in catalog:
            out.writerow([record["key"], record["kind"], record["citation"]["genre"], record["citation"]["title"],
                          "-".join(str(part) for part in record["citation"].get("issued", {}).get("date-parts", [[""]])[0]), ";".join(record.get("tribes", [])), record["original_link"]])
    print(f"{len(acts)} Act records ({sum(1 for path, _ in acts if 'water-rights-settlement' in path.read_text())} with the topic), {len(catalog)} university catalog records")


# ---------------------------------------------------------------- facts

def facts(args) -> None:
    batch = {"session": SESSION, "facts": [], "objects": [], "searches": []}
    for row in settlements():
        amended = f", amended {row['amended'].replace('; ', ', ')}" if row["amended"] else ""
        laws = ", ".join(f"Pub. L. No. {law}" for law in laws_of(row))
        water = f" It quantifies {int(row['acre_feet_per_year']):,} acre-feet a year in all" if row["acre_feet_per_year"] else ""
        cost = f"{' and' if water else ' It'} authorizes about ${float(row['authorized_federal_cost_millions']):,.1f} million in federal funds" if row["authorized_federal_cost_millions"] else ""
        tail = f"{water}{cost}, as the Congressional Research Service counts it (R44148, Table 1)." if water or cost else " (Congressional Research Service, R44148, Table 1)."
        for nation in [nation for nation in row["nations"].split("; ") if nation]:
            detail = f"Congress enacted the {row['settlement']} in {row['year']}{amended} ({laws}), settling the water rights of {row['nations_as_listed']}.{tail}"
            fact = {"topic": "water-rights-settlement", "value": "enacted", "detail": detail, "source": record_key(row["public_law"]),
                    "confidence": "high", "verification": "inferred", "as_of": row["year"], "locator": f"Congressional Research Service, R44148, Table 1, {row['year']}"}
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
