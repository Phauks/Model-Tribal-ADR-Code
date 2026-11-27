#!/usr/bin/env python3
"""Take the Confederated Salish and Kootenai Tribes off the tier 2 records
that name them only by the word "Tribes".

The Confederated Salish and Kootenai Tribes of the Flathead Reservation call
themselves "the Tribes", and the nation profile lists that as one of their
names. Before the shared matcher (scripts/law/nation_names.py) learned to set
aside names made only of words such as Tribe, Nation and Indians, every
Federal Register document, IBIA decision and NIGC document whose title or
abstract said "Tribes" was tied to them (found Nov. 26, 2026, thread "Add the
new data sources to the roadmap and collect them").

For each record that scripts/law/federal_register_documents.py,
ibia_decisions.py or nigc_documents.py wrote and that lists the nation, this
script reads the same words its script matched (the title and abstract from
the Federal Register API; the decision's or document's title), keeps the
nation where those words say Salish, Kootenai or Flathead, and otherwise takes
it off and matches the words again with that guard, so a record such as
"Joint Business Council of the Shoshone & Arapahoe Tribes" gets the nation its
title does name. Hand-made records are left as they are.

Usage:
  python3 scripts/law/fix_tribes_word_matches.py [--dry-run]
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
import urllib.request
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
SOURCES = ROOT / "content/sources"
NATION = "confederated-salish-and-kootenai-tribes-of-the-flathead-reservation"
OWN_WORDS = re.compile(r"salish|kootenai|flathead|ksanka|qlispe", re.IGNORECASE)
SCRIPTS = ("scripts/law/federal_register_documents.py", "scripts/law/ibia_decisions.py", "scripts/law/nigc_documents.py")


def dump(value) -> str:
    return yaml.safe_dump(value, allow_unicode=True, sort_keys=False, width=float("inf"))


def matcher():
    sys.path.insert(0, str(ROOT / "scripts/law"))
    from nation_names import NationNames  # noqa: E402
    return NationNames()  # with its guard against names made only of words such as "Tribes"


def abstracts(numbers: list[str]) -> dict[str, str]:
    """Title and abstract of each Federal Register document, twenty to a request."""
    out = {}
    for start in range(0, len(numbers), 20):
        batch = numbers[start:start + 20]
        url = (f"https://www.federalregister.gov/api/v1/documents/{','.join(batch)}.json"
               "?fields[]=document_number&fields[]=title&fields[]=abstract")
        for attempt in range(4):
            try:
                with urllib.request.urlopen(url, timeout=60) as response:
                    data = json.load(response)
                break
            except OSError:
                time.sleep(5 * (attempt + 1))
        else:
            raise SystemExit(f"Federal Register API did not answer for {batch[0]}")
        for document in data.get("results", [data]):
            out[document["document_number"]] = f"{document.get('title') or ''}. {document.get('abstract') or ''}"
        time.sleep(0.5)
    return out


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--dry-run", action="store_true", help="list the changes without writing them")
    args = parser.parse_args()
    found = []
    for path in sorted(SOURCES.rglob("*.yaml")):
        text = path.read_text(encoding="utf-8")
        if NATION not in text:
            continue
        record = yaml.safe_load(text)
        if NATION not in (record.get("tribes") or []) or (record.get("review") or {}).get("by") not in SCRIPTS:
            continue
        found.append((path, record))
    numbers = [record["citation"]["number"].removeprefix("FR Doc. ") for _, record in found
               if record["review"]["by"].endswith("federal_register_documents.py")]
    words_of = abstracts(numbers)
    names = matcher()
    kept = changed = 0
    for path, record in found:
        by = record["review"]["by"]
        if by.endswith("federal_register_documents.py"):
            words = words_of.get(record["citation"]["number"].removeprefix("FR Doc. "), record["citation"]["title"])
        else:
            words = record["citation"]["title"]
            named = (record.get("nations_in_case") or {}).get("named") or []
            words_as = [entry.get("named_as", "") for entry in named if entry.get("nation") == NATION]
            if any(OWN_WORDS.search(value) for value in words_as):
                kept += 1
                continue
        if OWN_WORDS.search(words):
            kept += 1
            continue
        tribes = [nation for nation in record["tribes"] if nation != NATION]
        if by.endswith("federal_register_documents.py"):
            tribes += [nation for nation in names.find(words) if nation not in tribes]
        else:
            # IBIA and NIGC records name each nation with the words that name it (nations_in_case).
            again = [(nation, words) for nation, words in names.named(words) if nation not in tribes]
            tribes += [nation for nation, _ in again]
            case = record.get("nations_in_case") or {}
            named = [entry for entry in case.get("named") or [] if entry.get("nation") != NATION]
            named += [{"nation": nation, "named_as": words, "role": "party"} for nation, words in again]
            if "nations_in_case" in record:
                case["named"] = named  # a case says which nations it names, or none (an empty list)
        if tribes:
            record["tribes"] = tribes
        else:
            record.pop("tribes")
        changed += 1
        print(f"{path.relative_to(ROOT)}: {', '.join(tribes) or '(no nation)'}")
        if not args.dry_run:
            path.write_text(dump(record), encoding="utf-8")
    print(f"{len(found)} records listed the nation; {kept} name it by its own words and keep it; {changed} changed.", file=sys.stderr)


if __name__ == "__main__":
    main()
