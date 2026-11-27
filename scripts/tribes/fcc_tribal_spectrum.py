#!/usr/bin/env python3
"""The FCC's 2.5 GHz licenses over tribal lands, for the nation pages' Key
facts (Trevor, Nov. 27, 2026: spike 4 of
research/analyses/2026-11-27-appeals-audio-land-spectrum-films.md, "go and
get the info").

In July 2019 the FCC opened a Rural Tribal Priority Window: before any
auction, a federally recognized tribe or an entity it controls could apply
for unassigned 2.5 GHz spectrum over its rural tribal lands (Transforming
the 2.5 GHz Band, Report and Order, 34 FCC Rcd 5446 (2019); 84 Fed. Reg.
57,343 (Oct. 25, 2019); 47 C.F.R. § 27.1204). The licenses it granted are
Educational Broadband Service licenses whose market is a tribal land area:
market codes beginning "TL" in the Universal Licensing System. This script
reads the FCC's complete weekly file for the band (l_mdsitfs.zip, from
https://data.fcc.gov/download/pub/uls/complete/) and keeps every license with
a TL market, whatever its status, with its call sign, status, grant and
expiration dates and its licensee.

Each licensee is matched to a nation by the shared name matcher
(scripts/law/nation_names.py) or by HAND below: shortened names, Alaska
village councils and the utilities and companies nations own, such as Hopi
Telecommunications, Inc. A license held by a nation's utility is shown on
the nation's page as held by that utility. Licensees that are not a nation or
its own body (carriers a license was assigned to, consortia of several
nations, colleges, the Department of Hawaiian Home Lands, which is not a
tribe) are kept with no nation.

Usage:
  python3 scripts/tribes/fcc_tribal_spectrum.py --zip l_mdsitfs.zip
Writes research/fcc-tribal-spectrum/licenses.csv.
"""
from __future__ import annotations

import argparse
import csv
import io
import re
import sys
import zipfile
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "law"))
from nation_names import NationNames  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "research/fcc-tribal-spectrum/licenses.csv"
HAND_FILE = ROOT / "research/fcc-tribal-spectrum/licensee-nations.csv"

# A licensee that is a nation's company or utility, not its government: its page names the holder.
BODY = re.compile(r"\b(?:Telephone|Telecommunications|Utility|Utilities|Power|Authority|Inc|LLC|Company|Corporation|Wireless|Broadband|District)\b", re.I)

STATUS = {"A": "active", "C": "canceled", "E": "expired", "T": "terminated"}


def rows(archive: zipfile.ZipFile, name: str):
    with archive.open(f"{name}.dat") as handle:
        for line in io.TextIOWrapper(handle, encoding="latin-1", newline=""):
            yield line.rstrip("\r\n").split("|")


def iso(date: str) -> str:
    return datetime.strptime(date, "%m/%d/%Y").date().isoformat() if date else ""


def hand_map() -> dict[str, str]:
    """Licensee name -> nation id ('' for a licensee that is no one nation), kept by hand."""
    if not HAND_FILE.exists():
        return {}
    with HAND_FILE.open(encoding="utf-8") as handle:
        return {row["licensee"]: row["nation"] for row in csv.DictReader(handle)}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--zip", required=True, type=Path)
    arguments = parser.parse_args()

    archive = zipfile.ZipFile(arguments.zip)
    markets: dict[str, list[str]] = {}
    for row in rows(archive, "MK"):
        if row[5].startswith("TL"):
            markets.setdefault(row[1], []).append(row[5])
    headers = {row[1]: row for row in rows(archive, "HD") if row[1] in markets}
    licensees = {row[1]: row for row in rows(archive, "EN") if row[1] in markets and row[5] == "L"}

    names = NationNames()
    hand = hand_map()
    out = []
    unmatched: dict[str, int] = {}
    for identifier, codes in markets.items():
        header = headers.get(identifier)
        entity = licensees.get(identifier)
        if not header or not entity:
            continue
        licensee = " ".join(entity[7].split())
        if licensee in hand:
            nation = hand[licensee]
            how = "hand" if nation else ""
        else:
            found = names.find(licensee)
            nation = found[0] if len(found) == 1 else ""
            how = "name" if nation else ""
        if not nation and licensee not in hand and header[5] == "A":
            unmatched[licensee] = unmatched.get(licensee, 0) + 1
        out.append({
            "call_sign": header[4],
            "unique_system_identifier": identifier,
            "status": STATUS.get(header[5], header[5]),
            "radio_service": header[6],
            "market": ";".join(sorted(set(codes))),
            "granted": iso(header[7]),
            "expires": iso(header[8]),
            "canceled": iso(header[9]),
            "licensee": licensee,
            "licensee_city": entity[17],
            "licensee_state": entity[18],
            "nation": nation,
            "held_by_nation_body": "yes" if nation and BODY.search(licensee) else "",
            "matched_by": how,
        })

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(out[0]))
        writer.writeheader()
        writer.writerows(sorted(out, key=lambda row: (row["licensee"].lower(), row["call_sign"])))
    active = [row for row in out if row["status"] == "active"]
    shown = [row for row in active if row["nation"]]
    print(f"{len(out)} licenses with a tribal land market, {len(active)} active; {len(shown)} active on {len({row['nation'] for row in shown})} nation pages", file=sys.stderr)
    for licensee, count in sorted(unmatched.items()):
        print(f"  not matched: {licensee} ({count})", file=sys.stderr)


if __name__ == "__main__":
    main()
