#!/usr/bin/env python3
"""Records and stored copies for the Native nations' own historic laws: the constitutions, codes, session laws and
council acts the nations printed before Oklahoma statehood and the Indian Reorganization Act (new data source
category 4; Trevor, Nov. 27, 2026: "grab 1,2,4").

Two places hold them:

The Library of Congress. Its digitized law collection has the Cherokee, Choctaw, Chickasaw, Muskogee (Creek), Osage
and Seneca volumes, many in the nation's own language as well as English. The project's list of Library of
Congress items not yet in our records (research/harvard-resources/library-of-congress-items-not-in-our-records.csv,
from the Harvard resources thread) gives each item; this script takes those dated before 1934. Each item's JSON
(https://www.loc.gov/item/<id>/?fo=json) gives its title, date, languages and PDF.

The Internet Archive. A title search for each nation's name with "laws", "constitution", "acts" and the like found
the volumes listed in INTERNET_ARCHIVE below, which the Library of Congress list lacks. Copies of the same edition
already taken from the Library of Congress are left out (a person compared title, year and page count).

Each volume becomes a source record of kind tribal-code (tribal-constitution when it is a constitution alone),
with its stored copy in the bucket under historic-nation-laws/, served on the site: the volumes are in the public
domain and are the nations' own governing documents, which the project serves (decision record 0031); a nation can
ask to have a copy taken down. Every record starts Unverified.

Nations are matched by the name in the title (NATIONS). The Cherokee Nation's laws from before the Act of Union
of 1839 are also the laws of the Eastern Band and the United Keetoowah Band, whose people lived under them, so those
volumes name all three.

Steps:
  fetch    Read each item's metadata and download its PDF. Writes --work/volumes.json and --work/files/.
  file     Store each PDF in the bucket and add it to the capture index.
  records  Write the source records and research/historic-nation-laws/volumes.csv.

Usage:
  python3 scripts/law/historic_nation_laws.py fetch --work DIR
  python3 scripts/law/historic_nation_laws.py file --work DIR --captures /mnt/project-files/research/captures
  python3 scripts/law/historic_nation_laws.py records --work DIR
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import subprocess
import sys
import time
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
SOURCES = ROOT / "content/sources"
RESEARCH = ROOT / "research/historic-nation-laws"
INDEX = ROOT / "research/capture-index.csv"
LIBRARY_LIST = ROOT / "research/harvard-resources/library-of-congress-items-not-in-our-records.csv"
SESSION = "2026-11-27-historic-nation-laws"
SCRIPT = "scripts/law/historic_nation_laws.py"
TODAY = "2026-11-27"
TOPIC = "historic-nation-laws"
LAST_YEAR = 1933
AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"

CHEROKEE_BEFORE_UNION = ["cherokee-nation", "eastern-band-of-cherokee-indians", "united-keetoowah-band-of-cherokee-indians-in-oklahoma"]
# The name in the title (English or the nation's language), and the profile it names.
NATIONS = [
    (r"Cherokee|Tsalagi|Tahlequah", ["cherokee-nation"]),
    (r"Choctaw|Chahta", ["the-choctaw-nation-of-oklahoma"]),
    (r"Chickasaw|Chikasha", ["the-chickasaw-nation"]),
    (r"Muskogee|Muskokee|Creek|Maskoke", ["the-muscogee-nation"]),
    (r"Seminole", ["the-seminole-nation-of-oklahoma"]),
    (r"Osage", ["the-osage-nation"]),
    (r"Seneca", ["seneca-nation-of-indians"]),
    (r"Sac and Fox", ["sac-and-fox-nation"]),
]
# Library of Congress titles in a nation's language name no nation in English; their subjects do, and these are
# the ones the item JSON leaves ambiguous.
LIBRARY_NATIONS = {
    "2009655209": ["cherokee-nation"], "2009655208": ["cherokee-nation"],
    "29025971": ["the-choctaw-nation-of-oklahoma"],  # the Choctaw council's acts; the subjects also name the Chickasaw district
    "42039512": ["the-chickasaw-nation"], "28014195": ["the-chickasaw-nation"],  # the Chickasaw constitution and laws, in Chickasaw
}
# Library of Congress items on the list that are not a nation's own law: the Interior Department's 1907 leasing
# regulations for the Five Tribes, William Wirt's 1830 opinion for the Cherokee Nation, and a 1900 brief on citizenship.
LIBRARY_LEFT_OUT = {"07035284", "10013932", "57055140"}
# The intertribal General Council of the Indian Territory's journal is no one nation's law.
LIBRARY_KINDS = {"ltf96010085": "other"}
# Volumes on the Internet Archive that the Library of Congress list lacks: identifier, nations, kind.
INTERNET_ARCHIVE = [
    ("Ayer_251_C211_1828", CHEROKEE_BEFORE_UNION, "tribal-constitution"),
    ("Ayer_251_C211_1830", CHEROKEE_BEFORE_UNION, "tribal-code"),
    ("bp_1377223", ["cherokee-nation"], "tribal-code"),
    ("bp_1377210", ["cherokee-nation"], "tribal-code"),
    ("freedmenbillacte00choc", ["the-choctaw-nation-of-oklahoma"], "tribal-code"),
    ("lawsofchoctawnat00choc", ["the-choctaw-nation-of-oklahoma"], "tribal-code"),
    ("ayer_kf_8228_c9_a5_1894", ["the-muscogee-nation"], "tribal-constitution"),
    ("Ayer_251_S25_S119_1887", ["sac-and-fox-nation"], "tribal-code"),
    ("cu31924060361585", ["seneca-nation-of-indians"], "tribal-constitution"),
    ("Ayer_E78_I5_I5_1871", [], "other"),
]


def dump(value) -> str:
    return yaml.safe_dump(value, sort_keys=False, allow_unicode=True, width=float("inf"))


def curl(url: str, path: Path | None = None, timeout: int = 900) -> bytes | bool:
    command = ["curl", "-sfL", "-m", str(timeout), "-A", AGENT]
    for attempt in range(4):
        if path is None:
            result = subprocess.run(command + [url], capture_output=True)
            if result.returncode == 0:
                return result.stdout
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            result = subprocess.run(command + ["-o", str(path), url], capture_output=True)
            if result.returncode == 0 and path.exists() and path.stat().st_size > 0 and path.read_bytes()[:5] == b"%PDF-":
                return True
            path.unlink(missing_ok=True)
        time.sleep(5 * (attempt + 1))
    return False if path is not None else b""


def slug(value: str, limit: int = 80) -> str:
    value = re.sub(r"[^a-z0-9]+", "-", value.lower().replace("&", " and ").replace("’", "").replace("'", "")).strip("-")
    return value[:limit].rstrip("-")


def first(value):
    return value[0] if isinstance(value, list) and value else value


def clean_title(title: str) -> str:
    title = re.sub(r"\s+", " ", title).strip()
    title = re.sub(r"^\[(.*)\]?$", r"\1", title).rstrip("]").strip()
    title = re.sub(r"\s*[/:;,.]+\s*$", "", title)
    return title[0].upper() + title[1:] if title else title


def nations_in(text: str) -> list[str]:
    found: list[str] = []
    for pattern, nations in NATIONS:
        if re.search(pattern, text, re.I):
            found += [nation for nation in nations if nation not in found]
    return found


# ---------------------------------------------------------------- fetch

def library_volume(row: dict, work: Path) -> dict | None:
    item = row["loc_item_id"]
    cached = work / "items" / f"loc-{item}.json"
    if not cached.exists():
        time.sleep(4)
        body = curl(f"https://www.loc.gov/item/{item}/?fo=json", timeout=120)
        if not body:
            print(f"could not read Library of Congress item {item}", file=sys.stderr)
            return None
        cached.parent.mkdir(parents=True, exist_ok=True)
        cached.write_bytes(body)
    data = json.loads(cached.read_text(encoding="utf-8"))
    detail = data.get("item", {})
    resources = data.get("resources", [])
    pdf = next((resource.get("pdf") for resource in resources if resource.get("pdf")), None)
    pages = len(resources[0].get("files", [])) if resources else None
    year = re.search(r"1[89]\d\d", detail.get("date") or row["date"] or detail.get("title", ""))
    text = " ".join([detail.get("title", ""), " ".join(detail.get("subject_headings") or detail.get("subjects") or []), " ".join(detail.get("contributor_names") or [])])
    nations = LIBRARY_NATIONS.get(item) or nations_in(text)
    if nations == ["cherokee-nation"] and year and int(year.group(0)) < 1839:
        nations = CHEROKEE_BEFORE_UNION
    title = clean_title(detail.get("title") or row["title"])
    is_constitution = re.match(r"(?i)(the )?constitution(?! and)(?!,? and)", title) and not re.search(r"(?i)\blaws\b|\bcode\b", title)
    return {
        "source": "library-of-congress", "identifier": item, "title": title, "year": year.group(0) if year else "",
        "languages": detail.get("language") or [], "contributors": detail.get("contributor_names") or [],
        "place": first(detail.get("location")) or "", "link": f"https://www.loc.gov/item/{item}/", "pdf": pdf, "pages": pages,
        "nations": nations, "kind": LIBRARY_KINDS.get(item) or ("tribal-constitution" if is_constitution else "tribal-code"), "library_kind": row["kind"],
    }


def archive_volume(identifier: str, nations: list[str], kind: str, work: Path) -> dict | None:
    cached = work / "items" / f"ia-{identifier}.json"
    if not cached.exists():
        time.sleep(1)
        body = curl(f"https://archive.org/metadata/{identifier}", timeout=120)
        if not body:
            print(f"could not read Internet Archive item {identifier}", file=sys.stderr)
            return None
        cached.parent.mkdir(parents=True, exist_ok=True)
        cached.write_bytes(body)
    data = json.loads(cached.read_text(encoding="utf-8"))
    metadata = data.get("metadata", {})
    pdfs = [entry for entry in data.get("files", []) if entry.get("name", "").endswith(".pdf")]
    pdfs.sort(key=lambda entry: (entry.get("format") != "Text PDF", -int(entry.get("size", 0) or 0)))
    year = re.search(r"1[89]\d\d", str(metadata.get("date", "")))
    return {
        "source": "internet-archive", "identifier": identifier, "title": clean_title(first(metadata.get("title", identifier))),
        "year": year.group(0) if year else "", "languages": [first(metadata.get("language"))] if metadata.get("language") else [],
        "contributors": [value for value in [first(metadata.get("creator")), first(metadata.get("publisher"))] if value],
        "place": "", "link": f"https://archive.org/details/{identifier}",
        "pdf": f"https://archive.org/download/{identifier}/{pdfs[0]['name']}" if pdfs else None,
        "pages": int(metadata["imagecount"]) if str(metadata.get("imagecount", "")).isdigit() else None,
        "nations": nations, "kind": kind, "contributing_library": first(metadata.get("contributor")) or "",
    }


def fetch(args) -> None:
    work = Path(args.work)
    volumes = []
    for row in csv.DictReader(LIBRARY_LIST.open(encoding="utf-8")):
        year = re.search(r"1[89]\d\d", row["date"] or row["title"])
        if row["kind"] == "corporate charter" or (year and int(year.group(0)) > LAST_YEAR) or row["loc_item_id"] in LIBRARY_LEFT_OUT:
            continue
        volume = library_volume(row, work)
        if volume:
            volumes.append(volume)
    for identifier, nations, kind in INTERNET_ARCHIVE:
        volume = archive_volume(identifier, nations, kind, work)
        if volume:
            volumes.append(volume)
    keys: set[str] = set()
    for volume in volumes:
        base = "-".join(part for part in [slug(volume["title"], 64), volume["year"]] if part)
        key, number = base, 2
        while key in keys:
            key, number = f"{base}-{number}", number + 1
        keys.add(key)
        volume["key"] = key
        volume["file"] = f"files/{key}.pdf"
        path = work / volume["file"]
        if volume["pdf"] and not (path.exists() and b"%%EOF" in path.read_bytes()[-2048:]):
            if not curl(volume["pdf"], path):
                print(f"could not download {volume['pdf']}", file=sys.stderr)
                volume["file"] = None
            time.sleep(2)
        print(f"{key}: {path.stat().st_size if volume['file'] and path.exists() else 0} bytes")
    (work / "volumes.json").write_text(json.dumps(volumes, indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"{len(volumes)} volumes, {sum(1 for volume in volumes if volume['file'])} downloaded")


# ---------------------------------------------------------------- file

def stored_key(volume: dict) -> str:
    return f"{TOPIC}/{volume['key']}.pdf"


def file(args) -> None:
    sys.path.insert(0, str(ROOT / "scripts/captures"))
    import mirror_captures  # noqa: E402

    work = Path(args.work)
    volumes = json.loads((work / "volumes.json").read_text(encoding="utf-8"))
    known = {row["key"] for row in csv.DictReader(INDEX.open(encoding="utf-8"))}
    for volume in volumes:
        if not volume["file"] or stored_key(volume) in known:
            continue
        mirror_captures.add(argparse.Namespace(
            captures=args.captures, files=[str(work / volume["file"])], topic=TOPIC, name=f"{volume['key']}.pdf",
            record=volume["key"], obtained=f"downloaded by {SCRIPT}", title=volume["title"], link=[volume["link"]],
            redistribution="yes", nations=";".join(volume["nations"]),
            rights="Published before 1930, so in the public domain in the United States; a Native nation's own law, served on this site (decision record 0031); the nation can ask to have it taken down.",
            keep_local=False))


def copies() -> dict[str, dict]:
    out = {}
    for row in csv.DictReader(INDEX.open(encoding="utf-8")):
        out[row["key"]] = {"storage_key": row["key"], "checksum": row["sha256"], "media_type": row["media_type"], "bytes": int(row["bytes"])}
    return out


# ---------------------------------------------------------------- records

NAMES = {
    "cherokee-nation": "Cherokee Nation", "the-choctaw-nation-of-oklahoma": "Choctaw Nation", "the-chickasaw-nation": "Chickasaw Nation",
    "the-muscogee-nation": "Muskogee Nation", "the-seminole-nation-of-oklahoma": "Seminole Nation", "the-osage-nation": "Osage Nation",
    "seneca-nation-of-indians": "Seneca Nation of Indians", "sac-and-fox-nation": "Sac and Fox Nation",
}


def records(args) -> None:
    work = Path(args.work)
    volumes = json.loads((work / "volumes.json").read_text(encoding="utf-8"))
    stored = copies()
    rows = []
    for volume in volumes:
        nations = volume["nations"]
        author = NAMES.get(nations[0], "") if nations else "General Council of the Indian Territory"
        citation = {"type": "legislation", "title": volume["title"], "author": [{"literal": author}],
                    "genre": "Constitution" if volume["kind"] == "tribal-constitution" else "Session laws and codes"}
        if volume["year"]:
            citation["issued"] = {"date-parts": [[int(volume["year"])]]}
        if volume["place"]:
            citation["publisher-place"] = volume["place"].title()
        if volume["pages"]:
            citation["number-of-pages"] = str(volume["pages"])
        citation |= {"URL": volume["link"], "accessed": {"date-parts": [[2026, 11, 27]]}}
        record = {"key": volume["key"], "kind": volume["kind"], "citation": citation, "original_link": volume["link"], "retrieved": TODAY}
        copy = stored.get(stored_key(volume)) if volume["file"] else None
        if copy:
            record["file"] = copy
        record["rights"] = {"status": "no-permission-needed", "basis": "public-domain",
                            "basis_note": f"Published in {volume['year'] or 'the 19th century'}, so in the public domain in the United States. It is the nation's own law, which the project serves (decision record 0031); the nation can ask to have the copy taken down.",
                            "redistribution": True}
        if nations:
            record["tribes"] = nations
        record["jurisdictions"] = [{"level": "tribal"}]
        record["topics"] = [TOPIC]
        record["access"] = {"open": True, "pull_from": ["free-web"]}
        record["found_in"] = [SESSION]
        where = ("the Library of Congress's digitized law collection" if volume["source"] == "library-of-congress"
                 else f"the Internet Archive (digitized from {volume['contributing_library']})" if volume.get("contributing_library") else "the Internet Archive")
        languages = [language for language in volume["languages"] if language and language.lower() not in ("english", "eng")]
        language = f" The text is in {', '.join(languages)}, the catalog says." if languages else ""
        union = " The Cherokee Nation's laws from before the Act of Union of 1839 governed the people of today's Cherokee Nation, Eastern Band and United Keetoowah Band, so all three are named." if nations == CHEROKEE_BEFORE_UNION else ""
        record["notes"] = (f"A volume of the nation's own law, from {where}.{language}{union} "
                           f"Generated by {SCRIPT} from the catalog record; nobody has read the volume against the record yet (Unverified).")
        record["review"] = {"status": "unverified", "by": SCRIPT, "date": TODAY,
                            "checks": [{"check": "listing", "result": "missing", "detail": "Only the catalog record was read, not the volume"}]}
        path = SOURCES / record["key"][0] / f"{record['key']}.yaml"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(dump(record), encoding="utf-8")
        rows.append({"record": volume["key"], "kind": volume["kind"], "year": volume["year"], "title": volume["title"],
                     "nations": ";".join(nations), "languages": ";".join(volume["languages"]), "pages": volume["pages"] or "",
                     "from": volume["source"], "link": volume["link"], "stored": "yes" if copy else "no"})
    RESEARCH.mkdir(parents=True, exist_ok=True)
    rows.sort(key=lambda row: (row["nations"], row["year"], row["title"]))
    with (RESEARCH / "volumes.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]), lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)
    print(f"{len(rows)} records, {sum(1 for row in rows if row['stored'] == 'yes')} with stored copies")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    for name in ("fetch", "file", "records"):
        command = sub.add_parser(name)
        command.add_argument("--work", required=True)
        if name == "file":
            command.add_argument("--captures", required=True)
    args = parser.parse_args()
    {"fetch": fetch, "file": file, "records": records}[args.command](args)


if __name__ == "__main__":
    main()
