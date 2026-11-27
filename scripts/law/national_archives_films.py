#!/usr/bin/env python3
"""Records and stored copies for the Bureau of Indian Affairs' films and sound
recordings at the National Archives (Record Group 75) that explain or carry
out federal Indian policy (spike 5 of research/analyses/
2026-11-27-appeals-audio-land-spectrum-films.md; Trevor, Nov. 27, 2026: "go
and get the info").

Two series of Record Group 75 are kept at the National Archives at College
Park, Motion Pictures branch:

  Moving Images Documenting the Life and Culture of North American Indians
  (NAID 12678), items 75.1 to 75.47, 1908-1977; and
  Audio Recordings Documenting Programs Relating to Native Americans
  (NAID 101898), items 75-GENERALa-1 to -14, 1964-1980.

`fetch` reads every item in both series from the National Archives Catalog
(the catalog website's own search service, which answers without a key) and
downloads each digitized film this script keeps from the catalog's media host
(catalog.archives.gov/medialz/...), hashing each with SHA-256.

Every item is sorted by hand below (SCREEN), under the CARE principles and the
project's rules:

  policy    a film or recording made by or for the Bureau that explains or
            carries out a law, a program or the agency's own organization.
            It gets a record. A digitized one is stored in the bucket.
  ceremony  ceremonies, dances and customs (the Rodman Wanamaker films of
            1908-1920 among them): no record, no copy, until the nation
            filmed consents.
  children  films and recordings whose subject is children or students, who
            may be heard: no record, no copy (the children's matters rule).
  other     not about federal Indian policy, or a privately made film still
            in copyright, or an item the catalog does not describe.

The Navajo student recordings (NAID 5962194 and 1105460) are children's voices
and are left out whole; they are not read item by item.

A copy is served by the website only when the film shows on screen that a
federal agency made it (the Department of the Interior, the Indian Service or
the Bureau of Indian Affairs). A stored film whose maker is not shown is kept
private and linked at the National Archives. A film with ceremony footage
inside it is kept private and marked for the nation's review.

Steps:
  fetch    Read both series and download the digitized policy films.
           Writes --work/items.json and --work/files/.
  file     Store each copy in the bucket and add it to the capture index.
  records  Write content/sources/n/national-archives-<film|sound>-<item>.yaml.

Usage:
  python3 scripts/law/national_archives_films.py fetch --work DIR
  python3 scripts/law/national_archives_films.py file --work DIR
  python3 scripts/law/national_archives_films.py records --work DIR
"""
from __future__ import annotations

import argparse
import csv
import hashlib
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
SESSION = "2026-11-27-national-archives-films"
SCRIPT = "scripts/law/national_archives_films.py"
TOPIC = "national-archives-films"
RECORD_TOPIC = "federal-indian-policy-film"
SEARCH = "https://catalog.archives.gov/proxy/records/search"
CATALOG = "https://catalog.archives.gov/id/"
FILM_SERIES = 12678
SOUND_SERIES = 101898
LEFT_OUT_SERIES = {5962194: "Navajo Student Program Recordings (1950-1954)", 1105460: "Recordings of Navajo Students (1948-1961)"}
BUREAU = "U.S. Department of the Interior, Bureau of Indian Affairs"
INDIAN_SERVICE = "U.S. Department of the Interior, Office of Indian Affairs"
FILM_ARCHIVE = "National Archives at College Park, Motion Pictures"
RETRIEVED = "2026-11-27"

# Every item in both series, by its National Archives item number, sorted by hand from the catalog's description and, for
# the digitized films, from 30 frames read across each film (Nov. 27, 2026). The note says why, in a few words.
SCREEN: dict[str, tuple[str, str]] = {
    "75.1": ("ceremony", "customs and beliefs (1916)"),
    "75.2": ("ceremony", "customs on the Crow Reservation; a procession of small children (1919)"),
    "75.3": ("ceremony", "Wanamaker expedition flag ceremonies (1913)"),
    "75.4": ("ceremony", "Wanamaker National Indian Memorial ceremony (1913)"),
    "75.5": ("ceremony", "Wanamaker expedition flag ceremonies (1913)"),
    "75.6": ("ceremony", "Wanamaker expedition flag ceremonies (1913)"),
    "75.7": ("ceremony", "customs, traditions and costumes (1913)"),
    "75.8": ("ceremony", "Wanamaker expedition flag ceremonies"),
    "75.9": ("ceremony", "a war dance (1913)"),
    "75.10": ("ceremony", "a dance by a man and a boy among other scenes (1921)"),
    "75.11": ("policy", "the Indian Financing Act and Johnson-O'Malley contracts (1973)"),
    "75.12": ("policy", "the Bureau's CHOICE education program, presented by an official (1973)"),
    "75.13": ("policy", "the Bureau's 1973 reorganization"),
    "75.14": ("policy", "the Zuni Comprehensive Development Plan (1973)"),
    "75.15": ("ceremony", "the corn dance; marked possibly under copyright"),
    "75.16": ("children", "Alaska Native high school students (1975)"),
    "75.17": ("children", "bilingual schooling in Yup'ik; not described"),
    "75.18": ("children", "Alaska Native students flown to boarding schools"),
    "75.20": ("policy", "Bureau irrigation and water works"),
    "75.21": ("policy", "a Bureau career development center"),
    "75.22": ("children", "Alaska Native students boarded with families"),
    "75.23": ("policy", "a Bureau driver training film"),
    "75.24": ("children", "a dramatized film in which children act (1949)"),
    "75.25": ("policy", "Indian Service physicians (1947); opens with dancers and a healing fire, so held for review"),
    "75.26": ("policy", "an Indian Service film on the Colorado River Indian Reservation"),
    "75.27": ("policy", "the Bureau's Division of Law Enforcement on Indian prisoners at El Reno"),
    "75.28": ("policy", "the Alaska Native Claims Settlement Act (1971)"),
    "75.29": ("policy", "the Bureau's work in the Pueblos (1951); may show Pueblo dances"),
    "75.30": ("policy", "planning and financing a Bureau school"),
    "75.31": ("children", "preschool children of Akiachak (1975)"),
    "75.32": ("policy", "a Bureau tuberculosis film"),
    "75.35": ("policy", "Bureau timber management (1952)"),
    "75.36": ("policy", "notices against taking Indian artifacts"),
    "75.37": ("policy", "the Indian Arts and Crafts Board; not described"),
    "75.38": ("other", "not described in the catalog"),
    "75.39": ("other", "a Canadian film by the University of Guelph"),
    "75.40": ("other", "a private art film under copyright (1968)"),
    "75.41": ("ceremony", "a film made by a Navajo filmmaker about spiritual themes (1966)"),
    "75.43": ("policy", "the Bureau's North Star III resupply of Alaska villages"),
    "75.44": ("policy", "the Bureau's North Star III resupply of Alaska villages"),
    "75.45": ("policy", "Job Corps conservation centers in Montana (1966)"),
    "75.47": ("policy", "Pima farming and the San Carlos Irrigation Project; marked possibly under copyright"),
    "75-GENERALa-1": ("policy", "Indian legislation (1973)"),
    "75-GENERALa-2": ("policy", "Indian education (1973)"),
    "75-GENERALa-3": ("children", "Alaska Native high school students (1975)"),
    "75-GENERALa-4": ("children", "bilingual schooling in Yup'ik (1971)"),
    "75-GENERALa-5": ("policy", "Bureau water works (1976)"),
    "75-GENERALa-6": ("children", "Alaska Native students boarded with families (1971)"),
    "75-GENERALa-7": ("policy", "a Bureau driver training program (1980)"),
    "75-GENERALa-8": ("policy", "planning a Bureau school (1971)"),
    "75-GENERALa-9": ("children", "preschool children of Akiachak (1974)"),
    "75-GENERALa-10": ("policy", "Job Corps on a radio call-in program (1969)"),
    "75-GENERALa-11": ("policy", "the Commissioner's conference of superintendents in Santa Fe (1964)"),
    "75-GENERALa-12": ("policy", "the Commissioner's conference of superintendents in Santa Fe (1964)"),
    "75-GENERALa-13": ("policy", "the National Congress of American Indians convention in Sheridan, Wyoming"),
    "75-GENERALa-14": ("policy", "the Commissioner's conference of superintendents in Santa Fe (1964)"),
}

# What our reading of each stored film's frames showed: who the screen names as maker, and whether the site serves it.
STORED = {
    "75.25": {"maker": INDIAN_SERVICE, "shown": "Produced by U.S. Indian Service 1947", "serve": False,
              "held": "It opens with dancers and a figure at a fire, which may be a ceremony, so the project's copy is held for the nation's review."},
    "75.26": {"maker": INDIAN_SERVICE, "shown": "U.S. Department of Interior Presents ... An Indian Service Film", "serve": True,
              "seen": "maps of the Colorado River Indian Reservation in Arizona, irrigation and land clearing, farming, building and the reservation hospital"},
    "75.27": {"maker": BUREAU, "shown": "Bureau of Indian Affairs, Morris Thompson, Commissioner; Eugene F. Suarez, Sr., Chief, Division of Law Enforcement; Donald J. Morrow, Producer-Director", "serve": True,
              "seen": "a prison official, a discussion with Native inmates, an inmate group meeting and a powwow inside the institution"},
    "75.43": {"maker": None, "shown": None, "serve": False, "seen": "the voyage of the North Star III, loading at port and in the ice, and village life ashore"},
    "75.44": {"maker": None, "shown": None, "serve": False, "seen": "cargo unloaded from landing craft onto a beach and hauled to a village by tractor"},
}

# Nations named in a policy item's description, by record id.
NATIONS = {"75.14": ["zuni-tribe-of-the-zuni-reservation"], "75.26": ["colorado-river-indian-tribes-of-the-colorado-river-indian-reservation"]}

US_WORK = {"status": "no-permission-needed", "basis": "us-government-work",
           "basis_note": "A film made by a federal agency, which the screen names, and so a work of the United States government, not subject to copyright (17 U.S.C. § 105).",
           "redistribution": True}
US_WORK_HELD = {"status": "tribal-review-required", "basis": "us-government-work",
                "basis_note": "A work of the United States government (17 U.S.C. § 105), but it shows what may be a ceremony, so the project's copy is not served until the nation filmed has reviewed it (CARE principles).",
                "redistribution": False}
AGENCY_LISTED = {"status": "not-assessed", "basis": "link-only",
                 "basis_note": "The catalog names the Bureau of Indian Affairs as sponsor; the film is not digitized, so the project links to the National Archives' description and keeps no copy.",
                 "redistribution": False}
UNKNOWN = {"status": "not-assessed", "basis": "link-only",
           "basis_note": "The National Archives marks the use status undetermined or possibly under copyright, and the film does not name its maker on screen; linked at the National Archives, and any project copy is kept private.",
           "redistribution": False}
LINK_ONLY = {"status": "not-assessed", "basis": "link-only",
             "basis_note": "Not digitized, and the National Archives marks its use status undetermined or possibly under copyright; linked at the National Archives, and the project keeps no copy.",
             "redistribution": False}


def dump(value) -> str:
    return yaml.safe_dump(value, sort_keys=False, allow_unicode=True, width=10_000)


def get(url: str) -> bytes:
    for attempt in range(4):
        try:
            time.sleep(1)
            request = urllib.request.Request(url, headers={"Accept": "application/json"})
            with urllib.request.urlopen(request, timeout=1800) as response:
                return response.read()
        except Exception:  # noqa: BLE001 - retried, then raised
            if attempt == 3:
                raise
            time.sleep(5 * (attempt + 1))


def search(**params) -> list[dict]:
    body = json.loads(get(SEARCH + "?" + urllib.parse.urlencode({**params, "limit": 100})))["body"]["hits"]["hits"]
    return [hit["_source"]["record"] for hit in body]


def year_of(record: dict) -> int | None:
    for field in ("productionDates", "releaseDates", "broadcastDates"):
        for value in record.get(field) or []:
            if value.get("year"):
                return int(value["year"])
    return None


def date_of(record: dict) -> list[int] | None:
    for field in ("productionDates", "releaseDates", "broadcastDates"):
        for value in record.get(field) or []:
            if value.get("year"):
                return [int(value[part]) for part in ("year", "month", "day") if value.get(part)]
    return None


def series_of(record: dict) -> int | None:
    return next((ancestor["naId"] for ancestor in record.get("ancestors", []) if ancestor.get("levelOfDescription") == "series"), None)


def slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def title_of(record: dict) -> str:
    title = record["title"].strip().rstrip(".").strip("[]")
    if title.isupper():
        small = {"a", "an", "and", "for", "in", "of", "on", "the", "to", "with"}
        words = title.lower().split()

        def cased(index: int, word: str) -> str:
            bare = word.strip("\"'()")
            if bare.upper() in {"II", "III", "IV"}:
                return word.upper()
            if index and word in small:
                return word
            return re.sub(r"[a-z]", lambda letter: letter.group().upper(), word, count=1)

        title = " ".join(cased(index, word) for index, word in enumerate(words))
        title = title.replace("Tommorrow", "Tomorrow")
    # The catalog files a few titles with the article moved to the end ("Rodman Wanamaker Expedition ..., The").
    return re.sub(r"^(.*),\s*(The|A|An)$", r"\2 \1", title)


def fetch(args) -> None:
    work = Path(args.work)
    (work / "files").mkdir(parents=True, exist_ok=True)
    films = [r for r in search(recordGroupNumber=75, typeOfMaterials="Moving Images") if r["levelOfDescription"] == "item" and series_of(r) == FILM_SERIES]
    sounds = [r for r in search(recordGroupNumber=75, typeOfMaterials="Sound Recordings") if r["levelOfDescription"] == "item" and series_of(r) == SOUND_SERIES]
    items = []
    for record in films + sounds:
        number = record.get("localIdentifier")
        if number not in SCREEN:
            sys.exit(f"item {number} ({record['naId']}) is not sorted in SCREEN; read it and add it")
        verdict, reason = SCREEN[number]
        item = {"number": number, "naid": record["naId"], "film": record in films, "verdict": verdict, "reason": reason, "record": record}
        objects = record.get("digitalObjects") or []
        if verdict == "policy" and objects and number in STORED:
            url = objects[0]["objectUrl"]
            name = f"{number.replace('.', '-')}{Path(url).suffix.lower()}"
            path = work / "files" / name
            if not path.exists():
                path.write_bytes(get(url))
            data = path.read_bytes()
            item.update({"file": name, "file_url": url, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest(), "media": "video/x-ms-wmv"})
        items.append(item)
    missing = sorted(set(SCREEN) - {item["number"] for item in items})
    if missing:
        print("sorted in SCREEN but not in the catalog now:", ", ".join(missing), file=sys.stderr)
    (work / "items.json").write_text(json.dumps(items, indent=1), encoding="utf-8")
    counts = {}
    for item in items:
        counts[item["verdict"]] = counts.get(item["verdict"], 0) + 1
    print(f"{len(films)} films, {len(sounds)} sound recordings: {counts}; {sum(1 for item in items if item.get('file'))} downloaded")


def record_key(item: dict) -> str:
    return f"national-archives-{'film' if item['film'] else 'sound'}-{slug(item['number'])}-{slug(title_of(item['record']))}"[:120].rstrip("-")


def file(args) -> None:
    sys.path.insert(0, str(ROOT / "scripts/captures"))
    import mirror_captures  # noqa: E402

    work = Path(args.work)
    items = [item for item in json.loads((work / "items.json").read_text(encoding="utf-8")) if item.get("file")]
    rows = mirror_captures.load_index()
    filed = {row["key"] for row in rows}
    s3 = mirror_captures.client()
    bucket = mirror_captures.bucket_name()
    added = 0
    for item in items:
        key = f"{TOPIC}/{item['file']}"
        path = work / "files" / item["file"]
        if mirror_captures.remote_state(s3, bucket, key) != (path.stat().st_size, item["sha256"]):
            s3.upload_file(str(path), bucket, key, ExtraArgs={"ContentType": item["media"], "Metadata": {"sha256": item["sha256"], "captured": RETRIEVED}})
            if mirror_captures.remote_state(s3, bucket, key) != (path.stat().st_size, item["sha256"]):
                print("verification failed:", key, file=sys.stderr)
                continue
        if key in filed:
            continue
        stored = STORED[item["number"]]
        rows.append(mirror_captures.index_row(
            key=key, size=item["bytes"], digest=item["sha256"], media=item["media"], topic=TOPIC,
            title=f"{title_of(item['record'])} (National Archives film {item['number']})", nations=";".join(NATIONS.get(item["number"], [])),
            obtained="downloaded from the National Archives Catalog's copy (catalog.archives.gov/medialz) by script",
            links=[CATALOG + str(item["naid"]), item["file_url"]], record=record_key(item), redistribution="yes" if stored["serve"] else "no",
            rights=(US_WORK if stored["serve"] else US_WORK_HELD if stored["maker"] else UNKNOWN)["basis_note"], existing_keys=filed))
        filed.add(key)
        added += 1
    mirror_captures.write_index(rows)
    print(f"filed {added}")


def record_for(item: dict, copy: dict | None) -> dict:
    source = item["record"]
    number, film = item["number"], item["film"]
    title = title_of(source)
    stored = STORED.get(number)
    sponsored = any("Bureau of Indian Affairs" in (person.get("heading") or "") for person in source.get("contributors") or [])
    maker = (stored or {}).get("maker") or (BUREAU if sponsored else None)
    series = "Moving Images Documenting the Life and Culture of North American Indians" if film else "Audio Recordings Documenting Programs Relating to Native Americans"
    citation = {"type": "motion_picture" if film else "song", "title": title}
    if maker:
        citation["author"] = [{"literal": maker}]
    citation.update({"genre": "Motion picture" if film else "Sound recording", "number": f"NAID {item['naid']}",
                     "archive": FILM_ARCHIVE, "archive_location": f"Record Group 75, {series} (NAID {FILM_SERIES if film else SOUND_SERIES}), item {number}"})
    when = date_of(source)
    if when:
        citation["issued"] = {"date-parts": [when]}
    citation.update({"URL": CATALOG + str(item["naid"]), "accessed": {"date-parts": [[2026, 11, 27]]}})
    year = year_of(source)
    description = (source.get("scopeAndContentNote") or "").strip()
    indigo = f"{title} ({maker or 'Bureau of Indian Affairs records'} {year or 'n.d.'}) ({'motion picture' if film else 'sound recording'}), National Archives Identifier {item['naid']}, RG 75, item {number}"
    parts = [f"Indigo Book citation: {indigo}."]
    if description:
        parts.append(f"The National Archives describes it: \"{description}\"")
    if stored:
        parts.append(f"Digitized by the National Archives; the project's copy is its file, unchanged ({item['bytes']:,} bytes, SHA-256 {item['sha256']}).")
        if stored.get("shown"):
            parts.append(f"The screen names its maker: \"{stored['shown']}\".")
        else:
            parts.append("The film does not name its maker on screen.")
        if stored.get("seen"):
            parts.append(f"Thirty frames read across the film show {stored['seen']}.")
        if stored.get("held"):
            parts.append(stored["held"])
    else:
        parts.append(f"Not digitized: the National Archives holds the {'film' if film else 'recording'} at College Park, where it can be viewed or copied on request.")
    if number == "75.29":
        parts.append("It may show Pueblo dances; before any copy is shown, the Pueblos filmed are asked.")
    parts.append(f"Chosen as a federal Indian policy item ({item['reason']}) by {SCRIPT}; ceremony films and children's recordings in the same series are left out (CARE principles). Not yet watched or heard in full by a person (Unverified).")
    record = {"key": record_key(item), "kind": "federal-agency-document", "citation": citation, "original_link": CATALOG + str(item["naid"]), "retrieved": RETRIEVED}
    if copy:
        record["file"] = copy
    if stored:
        record["rights"] = US_WORK if stored["serve"] else US_WORK_HELD if stored["maker"] else UNKNOWN
    else:
        record["rights"] = AGENCY_LISTED if sponsored else LINK_ONLY
    if NATIONS.get(number):
        record["tribes"] = NATIONS[number]
    record["jurisdictions"] = [{"level": "federal"}]
    record["topics"] = [RECORD_TOPIC]
    record["access"] = {"open": bool(stored), "pull_from": ["free-web"] if stored else ["library"],
                        **({} if stored else {"note": "Ask the National Archives at College Park, Motion Pictures (mopix@nara.gov) for a viewing or a copy, citing the National Archives Identifier."})}
    if (stored and stored.get("held")) or number == "75.29":
        record["sensitivity"] = {"tribal_review_required": True}
    record.update({"found_in": [SESSION], "notes": " ".join(parts),
                   "review": {"status": "unverified", "by": SCRIPT, "date": RETRIEVED,
                              "checks": [{"check": "listing", "result": "missing", "detail": "Only the National Archives Catalog's description was read" + (" and 30 frames of the film" if stored else "")}]}})
    return record


def records(args) -> None:
    work = Path(args.work)
    items = [item for item in json.loads((work / "items.json").read_text(encoding="utf-8")) if item["verdict"] == "policy"]
    copies = {row["sha256"]: {"storage_key": row["key"], "checksum": row["sha256"], "media_type": row["media_type"], "bytes": int(row["bytes"])}
              for row in csv.DictReader(CAPTURE_INDEX.open(encoding="utf-8")) if row["topic"] == TOPIC}
    written = 0
    for item in items:
        key = record_key(item)
        path = SOURCES / "n" / f"{key}.yaml"
        if path.exists() and SESSION not in path.read_text(encoding="utf-8"):
            print("key taken by another record, skipped:", key, file=sys.stderr)
            continue
        path.write_text(dump(record_for(item, copies.get(item.get("sha256", "")))), encoding="utf-8")
        written += 1
    print(f"wrote {written} records")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    for name in ("fetch", "file", "records"):
        command = sub.add_parser(name)
        command.add_argument("--work", required=True)
    args = parser.parse_args()
    {"fetch": fetch, "file": file, "records": records}[args.command](args)


if __name__ == "__main__":
    main()
