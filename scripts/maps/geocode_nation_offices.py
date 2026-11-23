"""Places each nation with no Census land area on the website's map by its government office.

The map shades each nation's Census land areas (site/geography/census-land-areas-2020.json). About a third of the nations in content/tribes/ have none, so they did not show on the map at all (Trevor, 2026-11-23: dots for nations with no land area). This script gives each such nation a point at the office address its record cites:

- the physical address, else the mailing address (each tried in turn), matched with the U.S. Census Bureau's geocoder (source key census-geocoder);
- if the geocoder finds no match, as for a post office box, the middle of the address's ZIP Code Tabulation Area from the Census Bureau's 2020 Gazetteer file (source key census-gazetteer-zcta-2020), marked as approximate.

A nation with no address on record gets no point and is listed only in the map's tables. The result is site/geography/nation-office-points.json, which the site reads when it is built. Run it again when records gain or lose an address or a land area:

    python3 scripts/maps/geocode_nation_offices.py

Points already found are kept unless the address changed, so a rerun asks the geocoder only about new addresses.
"""

from __future__ import annotations

import csv
import datetime
import io
import json
import re
import sys
import time
import zipfile
from pathlib import Path

import requests
import yaml

ROOT = Path(__file__).resolve().parents[2]
RECORDS = ROOT / "content" / "tribes"
OUTPUT = ROOT / "site" / "geography" / "nation-office-points.json"
GEOCODER = "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress"
GAZETTEER = "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2020_Gazetteer/2020_Gaz_zcta_national.zip"


def has_land_area(record: dict) -> bool:
    return any(not area.get("vintage") or str(area.get("vintage")) == "2020" for area in record.get("census_areas") or [])


def office_addresses(record: dict) -> list[str]:
    """The record's physical addresses, then its mailing addresses."""
    contacts = record.get("contacts") or []
    return [" ".join(str(contact["value"]).split()) for kind in ("physical-address", "mailing-address") for contact in contacts if contact.get("kind") == kind and contact.get("value")]


def place(session: requests.Session, address: str, centers: dict) -> tuple[list[float], str] | None:
    point = geocode(session, address)
    if point is not None:
        return list(point), "address"
    found = re.search(r"\b(\d{5})(?:-\d{4})?\s*$", address)
    if found:
        if "loaded" not in centers:
            centers.update(zip_centers(session))
            centers["loaded"] = True
        if found.group(1) in centers:
            return list(centers[found.group(1)]), "zip-code-area"
    return None


def geocode(session: requests.Session, address: str) -> tuple[float, float] | None:
    for attempt in range(3):
        try:
            response = session.get(GEOCODER, params={"address": address, "benchmark": "Public_AR_Current", "format": "json"}, timeout=30)
            response.raise_for_status()
            matches = response.json()["result"]["addressMatches"]
            if not matches:
                return None
            coordinates = matches[0]["coordinates"]
            return round(coordinates["x"], 5), round(coordinates["y"], 5)
        except (requests.RequestException, KeyError, ValueError):
            time.sleep(2 * (attempt + 1))
    return None


def zip_centers(session: requests.Session) -> dict[str, tuple[float, float]]:
    response = session.get(GAZETTEER, timeout=120)
    response.raise_for_status()
    with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
        name = next(entry for entry in archive.namelist() if entry.endswith(".txt"))
        text = archive.read(name).decode("utf-8")
    rows = csv.DictReader(io.StringIO(text), delimiter="\t")
    centers = {}
    for row in rows:
        row = {key.strip(): value.strip() for key, value in row.items()}
        centers[row["GEOID"]] = (round(float(row["INTPTLONG"]), 5), round(float(row["INTPTLAT"]), 5))
    return centers


def main() -> int:
    previous = {}
    if OUTPUT.exists():
        previous = {entry["nation"]: entry for entry in json.loads(OUTPUT.read_text(encoding="utf-8"))["offices"]}
    session = requests.Session()
    session.headers["User-Agent"] = "model-tribal-adr-code map builder"
    centers: dict = {}
    offices = []
    missing = 0
    for path in sorted(RECORDS.rglob("*.yaml")):
        record = yaml.safe_load(path.read_text(encoding="utf-8"))
        if has_land_area(record):
            continue
        addresses = office_addresses(record)
        if not addresses:
            missing += 1
            continue
        kept = previous.get(record["id"])
        if kept and kept.get("address") in addresses:
            offices.append(kept)
            continue
        placed = None
        for address in addresses:
            placed = place(session, address, centers)
            if placed:
                break
        if placed is None:
            print(f"No point for {record['id']}: {'; '.join(addresses)}", file=sys.stderr)
            missing += 1
            continue
        offices.append({"nation": record["id"], "address": address, "point": placed[0], "precision": placed[1]})
        time.sleep(0.2)
    offices.sort(key=lambda entry: entry["nation"])
    OUTPUT.write_text(
        json.dumps(
            {
                "retrieved": datetime.date.today().isoformat(),
                "sources": {"address": "census-geocoder", "zip-code-area": "census-gazetteer-zcta-2020"},
                "offices": offices,
            },
            indent=1,
            ensure_ascii=False,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"{len(offices)} offices placed ({sum(1 for entry in offices if entry['precision'] == 'address')} by address); {missing} nations with no land area have no placeable address.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
