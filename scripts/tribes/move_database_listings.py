"""Move bulk database records out of dispute resolution provisions.

The first research pass copied 938 entries from the National Center on
Restorative Justice Restorative Justice Tribal Laws Database into
`dispute_resolution.provisions` without opening the laws they list. The lead
author decided on Nov. 21, 2026 that such entries live in their own field,
`dispute_resolution.database_listings`, so that they stay on each profile as
leads but are not counted as provisions (decision record 0015).

A record moves only if it cites the database and its note says it was copied
in bulk. Records that cite the database but were read and summarized by hand
stay in `provisions`. The database's own tags (practice area, phase, form of
practice) move from the note into fields; the project's rule-assigned `kind`
is dropped. Every moved record gets `verification: bulk-import`.

Usage: python3 scripts/tribes/move_database_listings.py [--check]
"""

import argparse
import glob
import re
import sys

import yaml

DATABASE_SOURCE = "national-center-on-restorative-justice-restorative-justice-tribal-laws-database"
BULK_NOTE = (
    "Bulk record from the NCORJ Restorative Justice Tribal Laws Database; kind assigned from NCORJ's "
    "form-of-practice tags (peacemaking, mediation, circle/elder/cultural as traditional-dispute-resolution, "
    "everything else as other). Not individually reviewed; no summary written."
)
TAG = re.compile(r"Database (practice area|phase|form of practice): ")
TAG_FIELDS = {"practice area": "practice_area", "phase": "phase", "form of practice": "form_of_practice"}
FIELD_ORDER = [
    "title", "citation", "link", "practice_area", "phase", "form_of_practice",
    "source", "confidence", "verification", "as_of", "locator", "note",
]


def is_bulk(record):
    return record.get("source") == DATABASE_SOURCE and (record.get("note") or "").startswith(BULK_NOTE)


def parse_note(note):
    """Split the note's tail into database tags and any remaining text."""
    rest = note[len(BULK_NOTE):].strip()
    tags, remainder = {}, []
    matches = list(TAG.finditer(rest))
    if matches:
        remainder.append(rest[: matches[0].start()].strip())
    else:
        remainder.append(rest)
    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else len(rest)
        chunk = rest[match.end():end].strip()
        # A tag value ends at its first ". " followed by text that is not another tag.
        value, _, tail = chunk.partition(". ")
        tags[TAG_FIELDS[match.group(1)]] = value.rstrip(".").strip()
        remainder.append(tail.strip())
    return tags, " ".join(part for part in remainder if part)


def to_listing(record):
    tags, remainder = parse_note(record["note"])
    listing = {key: value for key, value in record.items() if key not in ("kind", "note", "verification")}
    listing.update({key: value for key, value in tags.items() if value})
    listing["verification"] = "bulk-import"
    if remainder:
        listing["note"] = remainder
    return {key: listing[key] for key in FIELD_ORDER if key in listing} | {
        key: value for key, value in listing.items() if key not in FIELD_ORDER
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--check", action="store_true", help="report counts without writing")
    arguments = parser.parse_args()

    moved = profiles = 0
    for path in sorted(glob.glob("content/tribes/*/*.yaml")):
        with open(path, encoding="utf-8") as handle:
            profile = yaml.safe_load(handle)
        practice = profile.get("dispute_resolution") or {}
        provisions = practice.get("provisions") or []
        bulk = [record for record in provisions if is_bulk(record)]
        if not bulk:
            continue
        kept = [record for record in provisions if not is_bulk(record)]
        listings = practice.get("database_listings", []) + [to_listing(record) for record in bulk]
        rebuilt = {}
        for key, value in practice.items():
            if key == "provisions":
                if kept:
                    rebuilt["provisions"] = kept
                continue
            if key == "database_listings":
                continue
            rebuilt[key] = value
        rebuilt["database_listings"] = listings
        profile["dispute_resolution"] = rebuilt
        moved += len(bulk)
        profiles += 1
        if not arguments.check:
            with open(path, "w", encoding="utf-8") as handle:
                yaml.safe_dump(profile, handle, allow_unicode=True, sort_keys=False, width=100)
    print(f"{'Would move' if arguments.check else 'Moved'} {moved} records in {profiles} profiles.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
