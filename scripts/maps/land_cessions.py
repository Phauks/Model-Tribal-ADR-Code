#!/usr/bin/env python3
"""Links each land cession in Royce's schedule to the project's treaty records and nation pages.

Charles C. Royce's Indian Land Cessions in the United States (Eighteenth Annual Report of the Bureau of American Ethnology, part 2, 1899) numbers every cession of land by Native nations to the United States from 1784 to 1894 and draws each on 67 map sheets. The U.S. Forest Service traced all 67 sheets into 718 cession shapes, each carrying Royce's number, the cession dates, the map sheets it appears on, and the present-day nations the Forest Service lists for it (map service EDW_TribalCessionLands_01; research/analyses/2026-11-26-historic-maps-of-indian-lands.md). Both are works of the United States government.

`fetch` downloads the Forest Service's shapes (layer 0, as GeoJSON) and table (table 2) into a work folder. `link` reads them and writes site/geography/land-cessions.json, the facts the website shows for each cession, without shapes (the shapes go into map tiles, site/tools/build-historic-maps.mjs):

- treaties: the treaty records (content/sources, citation type "treaty") signed on one of the cession's dates. When more than one treaty was signed that day, the one whose title shares a word with the nations Royce's schedule names is kept; a day that still has more than one is left unlinked and listed in the report.
- nations: the nation records whose official name (or a name in site/geography/land-cession-nation-names.json) is one the Forest Service lists (see Nations for how a name matches). The Forest Service uses the Federal Register list of its day, so older spellings are matched through that file. The file's "cessions" adds nations, by Royce number, where the Forest Service lists none or misses a people Royce names, and replaces the Forest Service's list where it names the wrong people.
- sheets: Royce's map sheets, by plate number in the Library of Congress's copy (g3701em.gct00002).

`report` prints what did not match.

Usage, from the repository root:
  python3 scripts/maps/land_cessions.py fetch --work DIR
  python3 scripts/maps/land_cessions.py link --work DIR
  python3 scripts/maps/land_cessions.py report --work DIR
"""
from __future__ import annotations

import argparse
import datetime
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
SERVICE = "https://apps.fs.usda.gov/arcx/rest/services/EDW/EDW_TribalCessionLands_01/MapServer"
OUTPUT = ROOT / "site" / "geography" / "land-cessions.json"
NAMES = ROOT / "site" / "geography" / "land-cession-nation-names.json"
SHEETS_ITEM = "https://www.loc.gov/item/13023487/"
SHEETS_RESOURCE = "https://www.loc.gov/resource/g3701em.gct00002/"


def get(url: str) -> bytes:
    for attempt in range(1, 5):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "model-tribal-code-maps/1.0"}), timeout=120) as response:
                return response.read()
        except OSError:
            if attempt == 4:
                raise
            time.sleep(2 * attempt)
    raise RuntimeError(url)


def fetch(work: Path) -> None:
    work.mkdir(parents=True, exist_ok=True)
    features = []
    offset = 0
    while True:
        query = urllib.parse.urlencode({"where": "1=1", "outFields": "*", "outSR": "4326", "f": "geojson", "resultOffset": offset, "resultRecordCount": 250, "returnGeometry": "true"})
        page = json.loads(get(f"{SERVICE}/0/query?{query}"))["features"]
        features += page
        if len(page) < 250:
            break
        offset += 250
    (work / "cessions.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": features}))
    query = urllib.parse.urlencode({"where": "1=1", "outFields": "*", "f": "json", "resultRecordCount": 2000})
    rows = [row["attributes"] for row in json.loads(get(f"{SERVICE}/2/query?{query}"))["features"]]
    (work / "cessions-table.json").write_text(json.dumps(rows))
    print(f"Saved {len(features)} shapes and {len(rows)} table rows in {work}.")


def short(properties: dict) -> dict:
    """The Forest Service's joined field names, without their table prefixes."""
    return {name.rsplit(".", 1)[-1]: value for name, value in properties.items()}


def day(milliseconds: int | None) -> str | None:
    if milliseconds is None:
        return None
    # The service stores each date as midnight UTC, so no time zone shift is needed.
    return (datetime.datetime(1970, 1, 1) + datetime.timedelta(milliseconds=milliseconds)).date().isoformat()


def plate(url: str | None) -> int | None:
    match = re.search(r"[?&]sp=(\d+)", url or "")
    return int(match.group(1)) if match else None


def words(text: str) -> set[str]:
    stop = {"the", "of", "and", "etc", "with", "treaty", "indians", "indian", "tribe", "tribes", "band", "bands", "nation", "nations"}
    return {word for word in re.findall(r"[a-z]+", text.lower()) if word not in stop and len(word) > 2}


def normal(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", name.lower()).strip()


STATES = {"Alabama": "AL", "Alaska": "AK", "Arizona": "AZ", "California": "CA", "Colorado": "CO", "Connecticut": "CT", "Florida": "FL", "Idaho": "ID", "Iowa": "IA", "Kansas": "KS", "Louisiana": "LA", "Maine": "ME", "Massachusetts": "MA", "Michigan": "MI", "Minnesota": "MN", "Mississippi": "MS", "Montana": "MT", "Nebraska": "NE", "Nevada": "NV", "New Mexico": "NM", "New York": "NY", "North Carolina": "NC", "North Dakota": "ND", "Oklahoma": "OK", "Oregon": "OR", "Rhode Island": "RI", "South Carolina": "SC", "South Dakota": "SD", "Texas": "TX", "Utah": "UT", "Virginia": "VA", "Washington": "WA", "Wisconsin": "WI", "Wyoming": "WY"}
TRAILING_STATE = re.compile(rf",?\s+(?:of\s+)?(?:the\s+state\s+of\s+)?({'|'.join(STATES)})$")


def key(name: str) -> str:
    """A name as matching compares it: lower case, punctuation dropped, and without a leading "The"."""
    return re.sub(r"^the ", "", normal(name))


def split_state(name: str) -> tuple[str, str | None]:
    """A name without its trailing state ("..., Minnesota", "... of New York"), which the Federal Register lists of different years add or drop, and that state's postal code."""
    match = TRAILING_STATE.search(name.strip())
    if not match:
        return key(name), None
    return key(name[:match.start()]), STATES[match.group(1)]


def kappler_page(url: str | None) -> int | None:
    """The page sequence number in the Forest Service's link to Kappler, vol. 2, at HathiTrust (uc1.31210003349790)."""
    match = re.search(r"seq=(\d+)", url or "")
    return int(match.group(1)) if match else None


def treaty_records() -> dict[str, list[dict]]:
    by_day: dict[str, list[dict]] = {}
    for path in sorted((ROOT / "content" / "sources").glob("*/*.yaml")):
        text = path.read_text()
        if "type: treaty" not in text:
            continue
        record = yaml.safe_load(text)
        citation = record.get("citation") or {}
        if citation.get("type") != "treaty":
            continue
        parts = ((citation.get("issued") or {}).get("date-parts") or [[None]])[0]
        if len(parts) < 3:
            continue
        key = f"{parts[0]:04d}-{parts[1]:02d}-{parts[2]:02d}"
        page = re.search(r"Kappler vol\. 2, p\. (\d+)", record.get("notes") or "")
        by_day.setdefault(key, []).append({"key": record["key"], "title": citation.get("title", ""), "kappler": int(page.group(1)) if page else None})
    return by_day


class Nations:
    """Finds the nation record a Forest Service name means.

    A name matches a record when it is the record's official name or one of its aliases (ignoring case, punctuation and a leading "The"), or when site/geography/land-cession-nation-names.json says which record it means. Failing that, the name without its state matches a record's name without its state only when the record has an office or land in that state and no other record fits, so "Cherokee Nation, Oklahoma" is the Cherokee Nation and not the Cherokee Nation of Alabama, and "Oneida Nation of New York" is not the Oneida Nation of Wisconsin.
    """

    def __init__(self) -> None:
        self.exact: dict[str, str] = {}
        self.base: dict[str, list[tuple[str, str | None, set[str]]]] = {}
        for path in sorted((ROOT / "content" / "tribes").glob("*/*.yaml")):
            record = yaml.safe_load(path.read_text())
            names = record.get("names") or {}
            states = {entry.get("state") for entry in record.get("states") or [] if isinstance(entry, dict)}
            for name in [names.get("official"), *(alias.get("name") if isinstance(alias, dict) else alias for alias in names.get("aliases") or [])]:
                if not name:
                    continue
                self.exact.setdefault(key(name), record["id"])
                base, state = split_state(name)
                entries = self.base.setdefault(base, [])
                if all(entry[0] != record["id"] for entry in entries):
                    entries.append((record["id"], state, states))
        self.chosen: dict[str, str | None] = {}
        if NAMES.exists():
            self.chosen = {key(name): nation for name, nation in json.loads(NAMES.read_text())["names"].items()}

    def find(self, name: str) -> str | None:
        if key(name) in self.chosen:
            return self.chosen[key(name)]
        if key(name) in self.exact:
            return self.exact[key(name)]
        base, state = split_state(name)
        fits = [nation for nation, own_state, states in self.base.get(base, []) if state is None or ((own_state is None or own_state == state) and state in states)]
        return fits[0] if len(fits) == 1 else None


def kappler_offset(rows, treaties: dict[str, list[dict]]) -> int | None:
    """How many scans HathiTrust's copy of Kappler, vol. 2, runs ahead of its printed page numbers, from the days with only one treaty."""
    counts: dict[int, int] = {}
    for row in rows:
        for index in range(1, 6):
            candidates = treaties.get(day(row.get(f"cessdate{index}")) or "", [])
            sequence = kappler_page(row.get(f"date{index}link_kappler_treaty"))
            if len(candidates) == 1 and sequence and candidates[0]["kappler"]:
                difference = sequence - candidates[0]["kappler"]
                counts[difference] = counts.get(difference, 0) + 1
    return max(counts, key=counts.get) if counts else None


def bounds(geometry: dict) -> list[float]:
    """The shape's box, west, south, east, north, so a page's map can open on it."""
    points = []

    def walk(part):
        if isinstance(part[0], (int, float)):
            points.append(part)
        else:
            for inner in part:
                walk(inner)

    walk(geometry["coordinates"])
    return [round(min(point[0] for point in points), 3), round(min(point[1] for point in points), 3), round(max(point[0] for point in points), 3), round(max(point[1] for point in points), 3)]


def link(work: Path, write: bool = True) -> dict:
    shapes = json.loads((work / "cessions.geojson").read_text())["features"]
    rows = {row["cessnum"]: row for row in json.loads((work / "cessions-table.json").read_text())}
    treaties = treaty_records()
    nations = Nations()
    added = json.loads(NAMES.read_text()).get("cessions", {}) if NAMES.exists() else {}
    offset = kappler_offset(rows.values(), treaties)
    cessions = []
    sheets: dict[int, str] = {}
    ambiguous = []
    unmatched_names: dict[str, int] = {}
    for feature in shapes:
        number = short(feature["properties"])["cessnum"]
        row = rows.get(number)
        if number is None or row is None or not feature.get("geometry"):
            continue
        dates = sorted({value for value in (day(row.get(f"cessdate{index}")) for index in range(1, 6)) if value})
        schedule = row.get("schdtrb") or ""
        linked = []
        for index in range(1, 6):
            date = day(row.get(f"cessdate{index}"))
            if not date:
                continue
            candidates = treaties.get(date, [])
            sequence = kappler_page(row.get(f"date{index}link_kappler_treaty"))
            if len(candidates) > 1 and sequence and offset is not None:
                # The link points at the treaty's first page; the volume's page numbers run a fixed number of scans behind.
                on_page = [treaty for treaty in candidates if treaty["kappler"] is not None and sequence - offset - 10 <= treaty["kappler"] <= sequence - offset]
                if on_page:
                    candidates = [max(on_page, key=lambda treaty: treaty["kappler"])]
            if len(candidates) > 1:
                named = words(schedule)
                narrowed = [treaty for treaty in candidates if words(treaty["title"]) & named]
                if len(narrowed) == 1:
                    candidates = narrowed
                else:
                    ambiguous.append({"royce": number, "date": date, "candidates": [treaty["key"] for treaty in candidates]})
                    candidates = []
            linked += [treaty["key"] for treaty in candidates if treaty["key"] not in linked]
        present = [name.strip() for name in (row.get("presdaytrb") or "").split(";") if name.strip()]
        matched = []
        unmatched = []
        for name in present:
            nation = nations.find(name)
            if nation:
                if nation not in matched:
                    matched.append(nation)
            else:
                unmatched.append(name)
                unmatched_names[name] = unmatched_names.get(name, 0) + 1
        chosen = added.get(str(number)) or {}
        if chosen.get("replace"):
            # The Forest Service's list for this cession names the wrong people (the file gives the basis).
            matched, unmatched = [], []
        for nation in chosen.get("nations", []):
            if nation not in matched:
                matched.append(nation)
        own_sheets = []
        for index in range(1, 7):
            name, number_on_loc = row.get(f"mapname{index}"), plate(row.get(f"mapurl{index}"))
            if name and number_on_loc:
                sheets[number_on_loc] = name
                own_sheets.append(number_on_loc)
        cessions.append({
            "royce": number,
            "order": row.get("cessnumsort"),
            "dates": dates,
            "schedule": schedule,
            "treaties": linked,
            "nations": matched,
            "other_nations": unmatched,
            "sheets": own_sheets,
            "states": [state.strip() for state in (row.get("state") or "").split(";") if state.strip()],
            "bounds": bounds(feature["geometry"]),
        })
    cessions.sort(key=lambda cession: (cession["dates"][0] if cession["dates"] else "9999", cession["order"] or 0))
    result = {
        "description": "Royce's land cessions (1899) as the U.S. Forest Service traced them, linked to the project's treaty records and nation pages by scripts/maps/land_cessions.py. Shapes are in the historic map tiles (site/tools/build-historic-maps.mjs).",
        "sources": {
            "schedule": SHEETS_ITEM,
            "sheets": SHEETS_RESOURCE,
            "shapes": SERVICE,
        },
        "retrieved": datetime.date.today().isoformat(),
        "sheets": [{"plate": number, "name": sheets[number]} for number in sorted(sheets)],
        "cessions": cessions,
    }
    if write:
        OUTPUT.write_text(json.dumps(result, indent="\t", ensure_ascii=False) + "\n")
        print(f"Wrote {len(cessions)} cessions, {len(sheets)} sheets to {OUTPUT.relative_to(ROOT)}.")
    result["_ambiguous"] = ambiguous
    result["_unmatched_names"] = unmatched_names
    return result


def report(work: Path) -> None:
    result = link(work, write=False)
    cessions = result["cessions"]
    with_treaty = sum(1 for cession in cessions if cession["treaties"])
    treaties = {key for cession in cessions for key in cession["treaties"]}
    with_nation = sum(1 for cession in cessions if cession["nations"])
    print(f"{len(cessions)} cessions; {with_treaty} linked to {len(treaties)} treaties; {with_nation} linked to at least one nation.")
    print(f"{len(result['_ambiguous'])} cession dates with more than one treaty left unlinked:")
    for entry in result["_ambiguous"]:
        print(f"  {entry['royce']} {entry['date']}: {', '.join(entry['candidates'])}")
    print(f"{len(result['_unmatched_names'])} present-day names with no nation record:")
    for name, count in sorted(result["_unmatched_names"].items(), key=lambda item: -item[1]):
        print(f"  {count:4d}  {name}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("command", choices=["fetch", "link", "report"])
    parser.add_argument("--work", type=Path, required=True)
    arguments = parser.parse_args()
    if arguments.command == "fetch":
        fetch(arguments.work)
    elif arguments.command == "link":
        link(arguments.work)
    else:
        report(arguments.work)


if __name__ == "__main__":
    sys.exit(main())
