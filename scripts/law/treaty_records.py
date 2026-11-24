#!/usr/bin/env python3
"""Source records for every treaty and agreement between the United States
and Native nations: the 370 ratified treaties, the unratified treaties and
related papers, and the post-1871 agreements (data tier 1; Trevor, Nov. 24,
2026).

Inputs, both made from the Oklahoma State University Tribal Treaties Database
(https://treaties.okstate.edu/), which reproduces Kappler's Indian Affairs:
Laws and Treaties, vol. 2, and other collections:

- research/raw/2026-11-23/treaties.json: the 370 ratified treaties, with the
  date signed, the Statutes at Large citation and the Kappler page, and the
  169 unratified or non-Kappler treaty records (Nov. 23 treaty session).
- research/raw/2026-11-24/osu-agreements.json: the database's 149 agreement
  records, with the header line and key provisions each record page shows.

Each ratified treaty's text is the Statutes at Large granule on GovInfo
(https://www.govinfo.gov/link/statute/VOL/PAGE), a United States government
work, which `fetch` downloads and `file` stores in the project's bucket under
treaties/<key>.pdf through scripts/captures/mirror_captures.py. `records`
writes content/sources/t/<key>.yaml, keeping the 26 treaty records that
already exist (matched by Statutes at Large citation) and adding only their
stored copy.

The records carry the database's metadata; nobody has read the texts against
them yet, so each says so in its notes and stays Unverified until checked.

Usage:
  python3 scripts/law/treaty_records.py fetch --work DIR
  python3 scripts/law/treaty_records.py check --work DIR
  python3 scripts/law/treaty_records.py file --work DIR --captures /mnt/project-files/research/captures
  python3 scripts/law/treaty_records.py records
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import datetime as dt
import json
import re
import subprocess
import sys
import time
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
TREATIES = ROOT / "research/raw/2026-11-23/treaties.json"
AGREEMENTS = ROOT / "research/raw/2026-11-24/osu-agreements.json"
INDEX = ROOT / "research/capture-index.csv"
CHECK = ROOT / "research/reviews/2026-11-24-treaty-text-check.csv"
SOURCES = ROOT / "content/sources"
SESSION = "2026-11-24-federal-treaty-records"
TODAY = "2026-11-24"
OSU = "https://treaties.okstate.edu/treaties/"
MONTHS = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."]
RIGHTS = {"status": "no-permission-needed", "basis": "us-government-work",
          "basis_note": "A work of the United States government, not subject to copyright (17 U.S.C. § 105).",
          "redistribution": True}
OSU_RIGHTS = {"status": "no-permission-needed", "basis": "fact-only",
              "basis_note": "Only facts are recorded from the database; the record links the database's reproduction of the text.",
              "redistribution": False}


def dump(value) -> str:
    return yaml.safe_dump(value, allow_unicode=True, sort_keys=False, width=float("inf"))


def base_key(osu_key: str) -> str:
    """The database's address without its page or record number, as a record key."""
    return slug(re.sub(r"[-.]*\(?\d{4,5}\)?$", "", osu_key))


def slug(text: str) -> str:
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", text.lower())).strip("-")


def stat_parts(cite: str) -> tuple[int, int]:
    match = re.match(r"(\d+) Stat\. (\d+)", cite)
    return int(match.group(1)), int(match.group(2))


def long_date(iso: str) -> str:
    year, month, day = (int(part) for part in iso.split("-"))
    return f"{MONTHS[month - 1]} {day}, {year}"


def ratified() -> list[dict]:
    """The ratified treaties with their record keys: two treaties of the same name and year are told apart
    by date, and two signed the same day by their Statutes at Large page."""
    treaties = json.loads(TREATIES.read_text(encoding="utf-8"))["treaties"]

    def dated(treaty: dict) -> str:
        year, month, day = treaty["date_signed"].split("-")
        return f"{base_key(treaty['treaty_key'])}-{MONTHS[int(month) - 1].rstrip('.').lower()}-{int(day)}"

    by_name: dict[str, int] = {}
    by_date: dict[str, int] = {}
    for treaty in treaties:
        by_name[base_key(treaty["treaty_key"])] = by_name.get(base_key(treaty["treaty_key"]), 0) + 1
        by_date[dated(treaty)] = by_date.get(dated(treaty), 0) + 1
    for treaty in treaties:
        key = base_key(treaty["treaty_key"])
        if by_name[key] > 1:
            key = dated(treaty)
            if by_date[key] > 1:
                volume, page = stat_parts(treaty["statutes_at_large"])
                key = f"{key}-{volume}-stat-{page}"
        treaty["key"] = key
    return treaties


def existing_treaty_records() -> dict[str, Path]:
    """Treaty records already in content/sources, by Statutes at Large citation."""
    found = {}
    for path in SOURCES.glob("*/*.yaml"):
        text = path.read_text(encoding="utf-8")
        if "type: treaty" not in text or "generated by scripts/law/treaty_records.py" in text:
            continue
        match = re.search(r"(\d+) Stat\. (\d+)", text)
        if match:
            found[f"{match.group(1)} Stat. {match.group(2)}"] = path
    return found


def fetch(args) -> None:
    work = Path(args.work)
    work.mkdir(parents=True, exist_ok=True)
    failed = []
    for treaty in ratified():
        volume, page = stat_parts(treaty["statutes_at_large"])
        path = work / f"{treaty['key']}.pdf"
        if path.exists() and path.stat().st_size > 1000:
            continue
        url = f"https://www.govinfo.gov/content/pkg/STATUTE-{volume}/pdf/STATUTE-{volume}-Pg{page}.pdf"
        result = subprocess.run(["curl", "-sL", "-m", "120", "-A", "Mozilla/5.0", "-o", str(path), "-w", "%{http_code} %{content_type}", url],
                                capture_output=True, text=True)
        if not result.stdout.startswith("200 application/pdf"):
            path.unlink(missing_ok=True)
            failed.append((treaty["key"], url, result.stdout))
        time.sleep(0.5)
    print(f"fetched into {work}; failed {len(failed)}")
    for item in failed:
        print("  ", *item)


def file(args) -> None:
    sys.path.insert(0, str(ROOT / "scripts/captures"))
    import mirror_captures  # noqa: E402

    filed = {row["key"] for row in csv.DictReader(INDEX.open(encoding="utf-8"))}
    checked = {row["key"] for row in csv.DictReader(CHECK.open(encoding="utf-8")) if row["result"] == "ok"}
    existing = existing_treaty_records()
    for treaty in ratified():
        path = Path(args.work) / f"{treaty['key']}.pdf"
        record = existing.get(treaty["statutes_at_large"])
        key = record.stem if record else treaty["key"]
        if f"treaties/{key}.pdf" in filed or not path.exists() or treaty["key"] not in checked:
            continue
        volume, page = stat_parts(treaty["statutes_at_large"])
        mirror_captures.add(argparse.Namespace(
            captures=args.captures, files=[str(path)], topic="treaties", name=f"{key}.pdf", record=key,
            obtained="downloaded from GovInfo (Statutes at Large) by script", title=f"{treaty['title']}, {treaty['statutes_at_large']}",
            link=[f"https://www.govinfo.gov/link/statute/{volume}/{page}"], redistribution="yes", nations="",
            rights="United States government work (17 U.S.C. § 105).", keep_local=False))


def stored_copies() -> dict[str, dict]:
    copies = {}
    for row in csv.DictReader(INDEX.open(encoding="utf-8")):
        if row["key"].startswith(("treaties/", "jurisdiction/treaty-")):
            copies[f"treaties/{Path(row['key']).name}"] = {"storage_key": row["key"], "checksum": row["sha256"],
                                  "media_type": row["media_type"], "bytes": int(row["bytes"])}
    return copies


def add_file_block(path: Path, block: dict) -> bool:
    """Give an existing treaty record its stored copy, leaving the rest of the file as it is."""
    text = path.read_text(encoding="utf-8")
    if "\nfile:\n" in text:
        return False
    text = text.replace("\nrights:\n", "\n" + dump({"file": block}) + "rights:\n", 1)
    if SESSION not in text:
        text = re.sub(r"\nfound_in:\n((?:- .*\n)+)", lambda m: f"\nfound_in:\n{m.group(1)}- {SESSION}\n", text, count=1)
    path.write_text(text, encoding="utf-8")
    return True


def ratified_record(treaty: dict, copy: dict | None, flag: str = "") -> dict:
    volume, page = stat_parts(treaty["statutes_at_large"])
    name = re.sub(r",? \d{4}$", "", treaty["title"]).strip()
    year, month, day = (int(part) for part in treaty["date_signed"].split("-"))
    link = f"https://www.govinfo.gov/link/statute/{volume}/{page}"
    record = {
        "key": treaty["key"], "kind": "intergovernmental-agreement",
        "citation": {"type": "treaty", "title": f"{name}, {long_date(treaty['date_signed'])}, {treaty['statutes_at_large']}",
                     "author": [{"literal": "United States"}], "URL": link,
                     "issued": {"date-parts": [[year, month, day]]}, "accessed": {"date-parts": [[2026, 11, 24]]}},
        "original_link": link, "retrieved": TODAY, "archives": [],
    }
    if copy:
        record["file"] = copy
    record["rights"] = RIGHTS
    record["jurisdictions"] = [{"level": "federal"}]
    record["found_in"] = [SESSION]
    kappler = f"Kappler vol. 2, p. {treaty['kappler_page']}" if treaty.get("kappler_page") else "Kappler vol. 2"
    record["notes"] = (f"Indigo Book citation: {record['citation']['title']}. Ratified treaty ({kappler}; header \"{treaty.get('kappler_header', '')}\"). "
                       f"The text is the Statutes at Large granule on GovInfo; the Oklahoma State University Tribal Treaties Database reproduces it at {treaty['osu_url']}. "
                       "Title, date and citation come from the database and the Kappler header, generated by scripts/law/treaty_records.py; "
                       "not yet read against the text (Unverified). The nations that descend from its signatories are on their nation pages (treaties)." + flag)
    return record


def other_record(item: dict, kind_word: str) -> dict:
    """An unratified treaty, related paper or agreement: the database's metadata and link, no stored copy."""
    url = item["osu_url"]
    year = int(re.search(r"\d{4}", item["year"]).group(0))
    record = {
        "key": base_key(url.rstrip("/").rsplit("/", 1)[1]), "kind": "intergovernmental-agreement",
        "citation": {"type": "treaty", "title": item["title"], "author": [{"literal": "United States"}], "URL": url,
                     "issued": {"date-parts": [[year]]}, "accessed": {"date-parts": [[2026, 11, 24]]}},
        "original_link": url, "retrieved": TODAY, "archives": [], "rights": OSU_RIGHTS,
        "jurisdictions": [{"level": "federal"}], "found_in": [SESSION],
    }
    header = f" Header: \"{item['header']}\"." if item.get("header") else ""
    record["notes"] = (f"{kind_word}{header} Listed in the Oklahoma State University Tribal Treaties Database, which reproduces the text; "
                       "metadata generated by scripts/law/treaty_records.py, not yet read against the text (Unverified).")
    return record


def write(record: dict) -> Path:
    path = SOURCES / record["key"][0] / f"{record['key']}.yaml"
    path.write_text(dump(record), encoding="utf-8")
    return path


def ours(key: str) -> bool:
    """Whether a record with this key is missing or was written by this script."""
    path = SOURCES / key[0] / f"{key}.yaml"
    return not path.exists() or SESSION in path.read_text(encoding="utf-8")


def records(args) -> None:
    copies = stored_copies()
    existing = existing_treaty_records()
    flags = {row["key"]: row["result"] for row in csv.DictReader(CHECK.open(encoding="utf-8"))} if CHECK.exists() else {}
    added = updated = 0
    used = set()
    for treaty in ratified():
        record_path = existing.get(treaty["statutes_at_large"])
        key = record_path.stem if record_path else treaty["key"]
        used.add(key)
        copy = copies.get(f"treaties/{key}.pdf")
        if record_path:
            updated += bool(copy and add_file_block(record_path, copy))
            continue
        if not ours(key):
            sys.exit(f"key in use by another record: {key}")
        result = flags.get(treaty["key"])
        flag = (" GovInfo returned no Statutes at Large granule for this citation; check the citation (research/reviews/2026-11-24-treaty-text-check.csv)."
                if result == "missing" else
                " The Statutes at Large granule GovInfo returns for this citation did not clearly show this treaty, so no copy is stored; check the citation (research/reviews/2026-11-24-treaty-text-check.csv)."
                if result == "check by hand" else "")
        write(ratified_record(treaty, copy, flag))
        added += 1
    raw = json.loads(TREATIES.read_text(encoding="utf-8"))
    others = [(item, "Unratified treaty or related paper, not in Kappler's list of ratified treaties.")
              for item in raw["unratified_or_non_kappler_records_not_linked"]]
    others += [(item, "Agreement, marked not ratified in the database." if item.get("not_ratified") else "Agreement.")
               for item in json.loads(AGREEMENTS.read_text(encoding="utf-8"))["agreements"]]
    counts: dict[str, int] = {}
    for item, _ in others:
        key = base_key(item["osu_url"].rstrip("/").rsplit("/", 1)[1])
        counts[key] = counts.get(key, 0) + 1
    for item, word in others:
        record = other_record(item, word)
        if counts[record["key"]] > 1 or record["key"] in used or not ours(record["key"]):
            record["key"] = slug(item["osu_url"].rstrip("/").rsplit("/", 1)[1])
        if record["key"] in used or not ours(record["key"]):
            sys.exit(f"key in use: {record['key']}")
        used.add(record["key"])
        write(record)
    print(f"ratified: {added} added, {updated} existing records given their copy; unratified and agreements: {len(others)}")


# How the Statutes at Large spell some parties, so a granule is not flagged only for an older spelling
# or a scan's "l" for "I".
SPELLINGS = {"pota": ["pota", "pott"], "sauk": ["sauk", "sac"], "iowa": ["iowa", "ioway", "loway"], "maka": ["maka", "maha"],
             "teto": ["teto", "teet"], "arik": ["arik", "ricar"], "chey": ["chey", "chay"], "mola": ["mola", "mole", "molel"]}


def check(args) -> None:
    """Check that each downloaded granule is the treaty it is filed as: its text should name the
    treaty's first party and give the year signed. Writes research/reviews/2026-11-24-treaty-text-check.csv."""
    rows = []
    spelled: dict[str, list[str]] = {}
    for link in json.loads(TREATIES.read_text(encoding="utf-8"))["links"]:
        spelled.setdefault(link["treaty_key"], []).append(link["signatory_name_in_treaty"])
    for treaty in ratified():
        path = Path(args.work) / f"{treaty['key']}.pdf"
        if not path.exists():
            rows.append({"key": treaty["key"], "result": "missing", "party": "", "year": ""})
            continue
        text = subprocess.run(["pdftotext", "-l", "3", str(path), "-"], capture_output=True, text=True).stdout.lower()
        text = re.sub(r"\s+", " ", text)
        name = re.sub(r",? \d{4}$", "", treaty["title"])
        party = re.sub(r"^(treaty|articles|agreement)\s+(of|with)\s+(the\s+)?", "", name.lower()).split(",")[0].split(" and ")[0]
        names = [party] + treaty.get("osu_signatory_tags", []) + spelled.get(treaty["treaty_key"], [])
        stems = {re.sub(r"[^a-z]", "", name.lower().split()[0])[:4] for name in names if name.split()}
        stems.discard("")
        stem = "/".join(sorted(stems))
        year = treaty["date_signed"][:4]
        found_party = any(variant in text for s in stems for variant in SPELLINGS.get(s, [s]))
        found_year = year in text or "one thousand eight hundred" in text or "seventeen hundred" in text
        rows.append({"key": treaty["key"], "result": "ok" if found_party and found_year else "check by hand",
                     "party": f"{stem}:{'found' if found_party else 'not found'}", "year": f"{year}:{'found' if found_year else 'not found'}"})
    digests: dict[str, list[dict]] = {}
    for row in rows:
        path = Path(args.work) / f"{row['key']}.pdf"
        if path.exists():
            digests.setdefault(hashlib.sha256(path.read_bytes()).hexdigest(), []).append(row)
    for shared in digests.values():
        if len(shared) > 1:
            for row in shared:
                row["result"] = "check by hand"
                row["party"] += "; the same granule is filed for " + ", ".join(r["key"] for r in shared if r is not row)
    out = CHECK
    with out.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["key", "result", "party", "year"])
        writer.writeheader()
        writer.writerows(rows)
    counts: dict[str, int] = {}
    for row in rows:
        counts[row["result"]] = counts.get(row["result"], 0) + 1
    print(counts)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    for name in ("fetch", "check", "file", "records"):
        p = sub.add_parser(name)
        if name in ("fetch", "check", "file"):
            p.add_argument("--work", required=True)
        if name == "file":
            p.add_argument("--captures", required=True)
    args = parser.parse_args()
    {"fetch": fetch, "check": check, "file": file, "records": records}[args.command](args)


if __name__ == "__main__":
    main()
