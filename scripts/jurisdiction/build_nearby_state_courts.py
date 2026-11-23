#!/usr/bin/env python3
"""Record the state trial court for each county a nation's Census area lies in.

Inputs:
- the Census Bureau's 2020 American Indian, Alaska Native and Native Hawaiian
  area to county relationship file (already a source record,
  census-2020-tribal-area-to-county-relationship-file, with a private copy);
- research/jurisdiction/state-trial-courts.tsv: each state's trial court of
  general jurisdiction and the judiciary page that lists those courts by
  county or district (`read` says whether the page was opened or, where a
  bot check blocked it, only seen in a search listing).

A county counts when it holds at least 1 percent of the Census area's land,
so slivers along a boundary are left out. Each fact cites the state
judiciary page; its note names the county's share and the Census file.

Usage: python3 scripts/jurisdiction/build_nearby_state_courts.py RELATIONSHIP_FILE > research/jurisdiction/nearby-state-courts.json
"""
import csv
import json
import sys
from collections import defaultdict

import yaml

from public_law_280_gaps import state_names
from sources import ROOT, SESSION, write_source

TABLE = ROOT / "research/jurisdiction/state-trial-courts.tsv"
CENSUS = "census-2020-tribal-area-to-county-relationship-file"
CENSUS_LINK = "https://www2.census.gov/geo/docs/maps-data/data/rel2020/aiannh/tab20_aiannh20_county20_natl.txt"
SHARE = 0.01
BY = "Claude (AI assistant)"


def state_key(state: str) -> str:
    return f"state-trial-court-directory-{state.lower()}"


def write_state_sources(table: list[dict]) -> None:
    names = state_names()
    for row in table:
        opened = row["read"] == "opened"
        name = names[row["state"]]
        notes = (f"The {name} judiciary's list of its {row['trial_court'].lower()}s, used to name the state trial court for each county a nation's Census area lies in. "
                 + ("The page was opened on Nov. 23, 2026." if opened else "A bot check blocked the page from the research environment; its address and title were taken from a search listing on Nov. 23, 2026."))
        suffix = ".pdf" if row["directory"].lower().endswith(".pdf") else ".html"
        write_source(state_key(row["state"]), "web-page", f"{name} state courts: {row['trial_court']}", f"{name} Judicial Branch",
                     row["directory"], None, "fact-only", notes, suffix=suffix, save_copy=opened)


def main() -> None:
    relationship = sys.argv[1]
    table = list(csv.DictReader(TABLE.open(encoding="utf-8"), delimiter="\t"))
    by_code = {row["state_code"]: row for row in table}
    write_state_sources(table)
    parts = defaultdict(list)
    with open(relationship, encoding="utf-8-sig") as handle:
        for row in csv.DictReader(handle, delimiter="|"):
            if row["GEOID_AIANNH_20"] and int(row["AREALAND_PART"] or 0) > 0:
                parts[row["GEOID_AIANNH_20"]].append(row)
    batch = {"session": SESSION, "facts": [], "searches": []}
    for path in sorted((ROOT / "content/tribes").glob("*/*.yaml")):
        record = yaml.safe_load(path.read_text(encoding="utf-8"))
        if not any(fact.get("type") == "federal" for fact in record.get("recognition") or []):
            continue
        seen = set()
        for area in record.get("census_areas") or []:
            identifier = area.get("geographic_identifier")
            rows = parts.get(identifier or "", [])
            total = sum(int(row["AREALAND_PART"]) for row in rows)
            for row in sorted(rows, key=lambda item: -int(item["AREALAND_PART"])):
                share = int(row["AREALAND_PART"]) / total if total else 0
                state = by_code.get(row["GEOID_COUNTY_20"][:2])
                if share < SHARE or not state or row["GEOID_COUNTY_20"] in seen:
                    continue
                seen.add(row["GEOID_COUNTY_20"])
                county = row["NAMELSAD_COUNTY_20"]
                percent = f"{share:.0%}" if share >= 0.01 else "under 1%"
                batch["facts"].append({"profile": record["id"], "key": "nearby_state_courts", "fact": {
                    "state": state["state"], "county": county, "court": f"{state['trial_court']} for {county}", "link": state["directory"],
                    "source": state_key(state["state"]), "confidence": "medium",
                    "verification": "inferred" if state["read"] == "opened" else "title-only",
                    "locator": f"{state['trial_court']}s by county or district",
                    "note": (f"{county} holds {percent} of the land of {row['NAMELSAD_AIANNH_20']} (Census GEOID {identifier}), from the Census Bureau's 2020 area-to-county relationship file ({CENSUS}). "
                             f"The court is the state's trial court of general jurisdiction for the county; the state page lists those courts, and a district court may sit for several counties.")}})
        if seen:
            batch["searches"].append({"profile": record["id"], "topic": "jurisdiction", "status": "found", "entry": {
                "date": "2026-11-23", "searched_by": BY, "method": "script", "place_kind": "dataset", "address": CENSUS_LINK,
                "query": "Counties the nation's Census area lies in, and each state's trial court of general jurisdiction (scripts/jurisdiction/build_nearby_state_courts.py)",
                "outcome": "found", "reason": f"{len(seen)} county or counties with at least 1 percent of the area's land."}})
    print(json.dumps(batch, indent=1, ensure_ascii=False))


if __name__ == "__main__":
    main()
