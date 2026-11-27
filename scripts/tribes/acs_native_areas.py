#!/usr/bin/env python3
"""American Community Survey figures for every American Indian, Alaska Native
and Native Hawaiian area (data tier 2; Trevor, Nov. 27, 2026: "work on those
tier 2 gaps"), for the table builder at /nations/data/build.

The Census Bureau's data API now wants its own key (the api.data.gov key is
refused with "invalid_key"), so the figures come from the survey's
table-based summary file on www2.census.gov, which answers without one: one
pipe-separated file per table, every geography in it, estimates (E) and
margins of error (M). Only summary level 250 is kept: each American Indian
area (reservation, off-reservation trust land, Oklahoma tribal statistical
area and the rest), Alaska Native village statistical area and Hawaiian home
land, whole (geographic component 00), named as the Bureau names it.

The tables and what is taken from each:
  B01003  total population
  B02001  American Indian and Alaska Native alone
  B02010  American Indian and Alaska Native alone or in combination
  B01002  median age
  B19013  median household income (2024 dollars)
  B17001  people below the poverty level, of those whose status is known
  B23025  unemployed, of the civilian labor force
  B15003  people 25 and older with a bachelor's degree or more
  B28002  households with a broadband subscription of any kind

Rates are worked out here from the counts (their margins are not), and each
count keeps the Bureau's margin of error. Five-year estimates for small areas
are uncertain; the margins say how much. These are facts about the people
living in an area, Native or not; they are not counts of any nation's
citizens, and an area is not a nation (schemas/tribe.schema.json,
census_areas).

Usage:
  python3 scripts/tribes/acs_native_areas.py --work DIR
Writes research/census/acs-2020-2024-native-areas.csv.
"""
from __future__ import annotations

import argparse
import csv
import io
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "research/census/acs-2020-2024-native-areas.csv"
YEAR = 2024
BASE = f"https://www2.census.gov/programs-surveys/acs/summary_file/{YEAR}/table-based-SF"
UA = {"User-Agent": "Mozilla/5.0 (research script)"}
PREFIX = "2500000US"
# Each column written, from (table, estimate line).
COUNTS = {
    "total_population": ("b01003", 1),
    "american_indian_alaska_native_alone": ("b02001", 4),
    "american_indian_alaska_native_alone_or_in_combination": ("b02010", 1),
    "median_age": ("b01002", 1),
    "median_household_income": ("b19013", 1),
    "poverty_status_known": ("b17001", 1),
    "below_poverty_level": ("b17001", 2),
    "civilian_labor_force": ("b23025", 3),
    "unemployed": ("b23025", 5),
    "age_25_and_older": ("b15003", 1),
    "bachelors_degree": ("b15003", 22),
    "masters_degree": ("b15003", 23),
    "professional_degree": ("b15003", 24),
    "doctorate_degree": ("b15003", 25),
    "households": ("b28002", 1),
    "broadband_any_type": ("b28002", 4),
}


def get(url: str) -> bytes:
    for attempt in range(5):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=600) as response:
                return response.read()
        except Exception:  # noqa: BLE001 - retried, then raised
            if attempt == 4:
                raise
            time.sleep(5 * (attempt + 1))
    raise RuntimeError("unreachable")


def table_rows(work: Path, table: str) -> dict[str, dict[str, str]]:
    """The summary level 250 rows of one table file, by GEO_ID (cached in --work)."""
    cached = work / f"acsdt5y{YEAR}-{table}-250.csv"
    if not cached.exists():
        text = get(f"{BASE}/data/5YRData/acsdt5y{YEAR}-{table}.dat").decode("utf-8")
        lines = text.splitlines()
        kept = [lines[0]] + [line for line in lines[1:] if line.startswith(PREFIX)]
        cached.write_text("\n".join(kept) + "\n", encoding="utf-8")
    reader = csv.DictReader(io.StringIO(cached.read_text(encoding="utf-8")), delimiter="|")
    return {row["GEO_ID"]: row for row in reader}


def names(work: Path) -> dict[str, tuple[str, str]]:
    cached = work / f"Geos{YEAR}5YR.txt"
    if not cached.exists():
        cached.write_bytes(get(f"{BASE}/documentation/Geos{YEAR}5YR.txt"))
    out = {}
    for row in csv.DictReader(io.StringIO(cached.read_text(encoding="utf-8", errors="replace")), delimiter="|"):
        if row["SUMLEVEL"] == "250" and row["COMPONENT"] == "00":
            out[row["GEO_ID"]] = (row["NAME"], row["AIANHH"])
    return out


def number(value: str | None) -> float | None:
    """A figure, or None where the Bureau gives none (an empty cell, or a negative code such as -666666666 for too few cases)."""
    if value in (None, "", "null", "N", "(X)"):
        return None
    try:
        figure = float(value)
    except ValueError:
        return None
    return None if figure < 0 else figure


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--work", required=True)
    args = parser.parse_args()
    work = Path(args.work)
    work.mkdir(parents=True, exist_ok=True)
    areas = names(work)
    tables = {table: table_rows(work, table) for table in sorted({table for table, _ in COUNTS.values()})}
    columns = ["geographic_identifier", "name"]
    for column in COUNTS:
        columns += [column, f"{column}_margin"]
    columns += ["poverty_rate", "unemployment_rate", "bachelors_or_more_rate", "broadband_rate"]
    rows = []
    for geo_id, (name, code) in sorted(areas.items(), key=lambda item: item[1][1]):
        row: dict[str, object] = {"geographic_identifier": code, "name": name}
        for column, (table, line) in COUNTS.items():
            data = tables[table].get(geo_id, {})
            estimate = number(data.get(f"{table.upper()}_E{line:03d}"))
            margin = number(data.get(f"{table.upper()}_M{line:03d}"))
            row[column] = "" if estimate is None else (f"{estimate:g}" if column == "median_age" else f"{estimate:.0f}")
            row[f"{column}_margin"] = "" if margin is None else (f"{margin:g}" if column == "median_age" else f"{margin:.0f}")

        def rate(part: str | list[str], whole: str) -> str:
            parts = [part] if isinstance(part, str) else part
            values = [row[name] for name in parts]
            if row[whole] in ("", "0") or any(value == "" for value in values):
                return ""
            return f"{100 * sum(float(value) for value in values) / float(row[whole]):.1f}"

        row["poverty_rate"] = rate("below_poverty_level", "poverty_status_known")
        row["unemployment_rate"] = rate("unemployed", "civilian_labor_force")
        row["bachelors_or_more_rate"] = rate(["bachelors_degree", "masters_degree", "professional_degree", "doctorate_degree"], "age_25_and_older")
        row["broadband_rate"] = rate("broadband_any_type", "households")
        rows.append(row)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=columns)
        writer.writeheader()
        writer.writerows(rows)
    print(f"{len(rows)} areas written to {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
