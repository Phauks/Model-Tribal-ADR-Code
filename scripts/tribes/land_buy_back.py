#!/usr/bin/env python3
"""Land Buy-Back Program for Tribal Nations results for each location, for the
nation pages' Key facts (Trevor, Nov. 27, 2026: spike 4 of
research/analyses/2026-11-27-appeals-audio-land-spectrum-films.md, "go and
get the info").

The Program carried out the land consolidation part of the Cobell settlement
(Claims Resolution Act of 2010, Pub. L. No. 111-291, § 101, 124 Stat. 3064).
Two Interior publications give its results for each location:

  final   Land Buy-Back Program for Tribal Nations: Ten Years of Restoring
          Land and Building Trust 2012-2022 (Dec. 2023), doi-lbb.pdf: the
          amount paid, the fractional interests bought and the equivalent
          acres for each of the 53 locations, the last word on the Program,
          whose money ran out in November 2022.
  table   Land Buy-Back Program for Tribal Nations Cumulative Sales
          (Oct. 12, 2022): for each nation by its full name, the landowners
          offered, the offers made, the landowners who sold, the amount paid,
          the interests, equivalent acres and tracts bought, for each round of
          offers and in total. Six small locations show only rates (♦), to
          protect their few landowners.

The final report's location column is out of line with its figures for 17
locations: it prints, for example, $44,429,584 paid at Colville, where
Interior offered about $25 million in all (press release of Dec. 12, 2016;
the October 2022 table's $25,440,446 offered and $9,839,343 paid). The
October 2022 table's figures agree with each other in every row (paid over
offered gives its printed capture rate), so this script keeps the table's
names and matches each of the final report's figure rows to the table row it
continues: the same interests and amount, or a little more where offers were
still being processed in October 2022 (Crow Creek, Fort Belknap, Pine Ridge
and others). Every match is checked: one final row for each table row, and
the final figures never less than the table's.

Usage:
  python3 scripts/tribes/land_buy_back.py --final doi-lbb.pdf --table cumulative-sales-2022.pdf
Needs pdftotext (poppler). Writes research/land-buy-back/locations.csv.
"""
from __future__ import annotations

import argparse
import csv
import re
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "law"))
from nation_names import NationNames  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "research/land-buy-back/locations.csv"

# The table's names the shared matcher reads wrongly or not at all, by hand.
HAND = {
    "Arapahoe Tribe of the Wind River Reservation, Wyoming & Eastern Shoshone Tribe of the Wind River Reservation, Wyoming": ["northern-arapaho-tribe-of-the-wind-river-reservation", "eastern-shoshone-tribe-of-the-wind-river-reservation"],
    "Minnesota Chippewa - Bois Forte Band": ["bois-forte-band"],
    "Minnesota Chippewa - Fond du Lac Band": ["fond-du-lac-band"],
}

# The final report's six locations whose figures are combined in one row.
COMBINED = "Agua Caliente, Cabazon, Rincon, Stockbridge Munsee, Sycuan, and Quapaw"

NUMBER = r"[\d,]+(?:\.\d+)?"


def text(pdf: Path) -> list[str]:
    return subprocess.run(["pdftotext", "-layout", str(pdf), "-"], check=True, capture_output=True, text=True).stdout.splitlines()


def number(value: str) -> float:
    return float(value.replace(",", "").replace("$", ""))


def final_rows(lines: list[str]) -> list[dict]:
    """The final report's "Sales and consolidation results by location" rows."""
    rows = []
    started = False
    pending = ""
    for line in lines:
        if "Locations are ordered by greatest to fewest interests consolidated" in line:
            started = True
            continue
        if not started:
            continue
        if "All Locations to Date" in line:
            break
        match = re.match(rf"^\s+(\S.*?)\s{{2,}}({NUMBER})\s+({NUMBER})\s+({NUMBER})\s*$", line)
        if match:
            name = match.group(1).strip()
            rows.append({"name": name, "paid": number(match.group(2)), "interests": int(number(match.group(3))), "acres": number(match.group(4))})
            pending = name if name.endswith(",") else ""
        elif pending and line.strip() and not re.search(r"\d", line):
            rows[-1]["name"] = f"{pending} {line.strip()}"
            pending = ""
    return rows


ROUND = re.compile(r"^\s+((?:Initial |Return )?Implementation \(([^)]*)\)|Total (?:to|To) Date)\s{2,}(.*)$")


def data_fields(rest: str) -> list[str]:
    """The figures of a table line: numbers, rates, ♦ and "In Process", without dollar signs."""
    return re.findall(r"♦|In Process|\d[\d,]*%?|\d+%", rest.replace("$", " "))


def table_rows(lines: list[str]) -> list[dict]:
    """The October 2022 table: one entry for each nation, with its rounds of offers."""
    entries: list[dict] = []
    name_parts: list[str] = []
    for line in lines:
        if not line.strip() or line.startswith("Land Buy-Back Program for Tribal Nations Cumulative Sales"):
            continue
        if line.startswith("All Locations"):
            break
        round_match = ROUND.match(line)
        if round_match and entries:
            fields = data_fields(round_match.group(3))
            label = round_match.group(1)
            entry = entries[-1]
            if label.startswith("Total"):
                entry["fields"] = fields
            else:
                entry["rounds"].append({"label": label, "years": round_match.group(2).replace(" ", ""), "fields": fields})
            continue
        if line.startswith(" ") and not entries:
            continue
        if not line.startswith(" "):
            # A name, with or without its figures on the same line.
            match = re.match(r"^(\S.*?)(?:\s{2,}(♦.*|\d.*))?$", line)
            name, rest = match.group(1).strip(), match.group(2)
            if not rest and entries and entries[-1].get("open"):
                # The second line of a name that wraps.
                entries[-1]["name"] += f" {name}"
                entries[-1]["open"] = False
                continue
            if name.startswith(("Tribe", "Individuals", "Offers", "Note")) or name[0].isdigit():
                continue
            fields = data_fields(rest) if rest else []
            entries.append({"name": name, "fields": fields, "rounds": [], "open": name.endswith((",", "&", "Wind"))})
            continue
        # Figures under a name that wrapped onto the line after them.
        if entries and not entries[-1]["fields"] and not entries[-1]["rounds"] and re.match(r"^\s+\d", line) and len(data_fields(line)) >= 8:
            entries[-1]["fields"] = data_fields(line)
            continue
        stripped = line.strip()
        if entries and not entries[-1].get("open") and entries[-1]["fields"] and re.match(r"^[A-Z][A-Za-z' .&-]+$", stripped) and len(stripped) > 20:
            # A name set in from the margin (Umatilla, under Colville's figures).
            entries.append({"name": stripped, "fields": [], "rounds": [], "open": False})
            continue
        if entries and entries[-1].get("open") and stripped and not re.search(r"\d{2}", stripped) and stripped[0].isupper():
            entries[-1]["name"] += f" {stripped}"
    for entry in entries:
        entry.pop("open", None)
        entry["name"] = re.sub(r"\s+", " ", entry["name"])
    return [entry for entry in entries if entry["fields"]]


def figures(fields: list[str]) -> dict:
    """The table's thirteen columns, in order; ♦ is left blank."""
    keys = ["landowners_offered", "offers", "offered_dollars", "landowners_sold", "landowner_rate", "offers_accepted", "offer_rate",
            "paid", "capture_rate", "interests", "acres", "tracts"]
    if len(fields) != len(keys):
        raise SystemExit(f"Unexpected columns: {fields}")
    out = {}
    for key, value in zip(keys, fields):
        out[key] = "" if value == "♦" else value.replace(",", "")
    return out


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--final", required=True, type=Path)
    parser.add_argument("--table", required=True, type=Path)
    arguments = parser.parse_args()

    final = final_rows(text(arguments.final))
    table = table_rows(text(arguments.table))
    names = NationNames()

    if len(final) != 48:
        raise SystemExit(f"Expected 48 figure rows in the final report, found {len(final)}")
    combined = next(row for row in final if row["name"].startswith("Agua Caliente"))
    shown = [row for row in final if row is not combined]

    out = []
    used: set[int] = set()
    for entry in table:
        total = figures(entry["fields"])
        nations = HAND.get(entry["name"]) or names.find(entry["name"])
        if len(nations) != 1 and entry["name"] not in HAND:
            raise SystemExit(f"No single nation for {entry['name']!r}: {nations}")
        record = {
            "location": entry["name"],
            "nations": ";".join(nations),
            "final_report_name": "",
            "paid_dollars": "",
            "fractional_interests": "",
            "equivalent_acres": "",
            "table_paid_dollars": total["paid"],
            "table_fractional_interests": total["interests"],
            "table_equivalent_acres": total["acres"],
            "tracts": total["tracts"],
            "landowners_offered": total["landowners_offered"],
            "landowners_sold": total["landowners_sold"],
            "landowner_rate": total["landowner_rate"],
            "offered_dollars": total["offered_dollars"],
            "capture_rate": total["capture_rate"],
            "rounds": "; ".join(round_["years"] for round_ in entry["rounds"]),
            "combined_with": "",
        }
        if not total["paid"]:
            # One of the six small locations: the final report gives them one row together.
            record["final_report_name"] = COMBINED
            record["combined_with"] = f"{combined['paid']:.0f}|{combined['interests']}|{combined['acres']}"
            out.append(record)
            continue
        paid, interests = float(total["paid"]), int(total["interests"])
        # The final row this one continues: the same figures, or a little more, never less.
        candidates = [
            (index, row) for index, row in enumerate(shown)
            if index not in used and row["interests"] >= interests and row["paid"] >= paid - 1
            and row["interests"] <= interests * 1.02 + 60 and row["paid"] <= paid * 1.03 + 1000
        ]
        if len(candidates) != 1:
            raise SystemExit(f"{len(candidates)} final rows fit {entry['name']!r}: {candidates}")
        index, row = candidates[0]
        used.add(index)
        record.update({
            "final_report_name": row["name"],
            "paid_dollars": f"{row['paid']:.0f}",
            "fractional_interests": str(row["interests"]),
            "equivalent_acres": f"{row['acres']:.3f}",
        })
        out.append(record)
    if len(used) != len(shown):
        left = [row["name"] for index, row in enumerate(shown) if index not in used]
        raise SystemExit(f"Final rows with no table row: {left}")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(out[0]))
        writer.writeheader()
        writer.writerows(sorted(out, key=lambda row: row["location"]))
    # The final report names a location by its land ("Pine Ridge") or a short name ("Crow Creek").
    def same(row: dict) -> bool:
        short = row["final_report_name"].lower()
        return short == "pine ridge" and row["location"] == "Oglala Sioux Tribe" or short in row["location"].lower()
    moved = [row for row in out if row["final_report_name"] != COMBINED and not same(row)]
    print(f"{len(out)} locations, {len({n for row in out for n in row['nations'].split(';')})} nations; {len(moved)} final report names out of line with their figures", file=sys.stderr)


if __name__ == "__main__":
    main()
