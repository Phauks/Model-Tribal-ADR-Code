#!/usr/bin/env python3
"""Find the Public Law 280 facts that federally recognized nations lack, and
write them as a batch for apply.py.

Two kinds of gap:

1. A nation with land in a mandatory state (18 U.S.C. § 1162(a), 28 U.S.C.
   § 1360(a)) whose profile has no Public Law 280 fact for that state, such as
   the bands split out of the Minnesota Chippewa Tribe record.
2. A nation whose states are not among the sixteen states the Bureau of
   Indian Affairs lists as mandatory or optional Public Law 280 states. Each
   such state gets a `not-a-public-law-280-state` fact citing that list.

Which states a nation is in comes from its `states` facts: the states where
the Census Bureau places its land, or, for a nation with no land recorded, the
state of its government office (so those facts are medium confidence).
The optional states (Arizona, Idaho, Montana, Nevada, North Dakota, South
Dakota, Utah and the others) are researched one by one, not here.

Run it before apply.py, against the profiles as they stand; once applied, a
rerun finds no gaps.

Usage: python3 scripts/jurisdiction/public_law_280_gaps.py > research/jurisdiction/public-law-280-gaps.json
"""
import glob
import json
import re
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
SESSION = "2026-11-23-jurisdiction-and-federal-ties"
TODAY = "2026-11-23"
BY = "Claude (AI assistant)"

MANDATORY = {"AK", "CA", "MN", "NE", "OR", "WI"}
OPTIONAL = {"AZ", "FL", "ID", "IA", "MT", "NV", "ND", "SD", "UT", "WA"}
EXCEPTED = {"red-lake-band-of-chippewa-indians": "MN", "confederated-tribes-of-the-warm-springs-reservation-of-oregon": "OR"}
# Nations whose state returned all of its Public Law 280 jurisdiction: the
# 2026-11-21 session gave them only the retroceded fact, and that stays so.
FULLY_RETROCEDED = {"menominee-indian-tribe-of-wisconsin": "WI", "burns-paiute-tribe": "OR", "santee-sioux-nation": "NE"}


def state_names() -> dict[str, str]:
    """State names by code, from the website's own table (site/src/lib/nation-labels.ts)."""
    text = (ROOT / "site/src/lib/nation-labels.ts").read_text(encoding="utf-8")
    table = text.split("export const stateNames")[1].split("};")[0]
    return dict(re.findall(r"([A-Z]{2}): '([^']+)'", table))


def main() -> None:
    names = state_names()
    batch = {"session": SESSION, "facts": [], "searches": []}
    for path in sorted(glob.glob(str(ROOT / "content/tribes/*/*.yaml"))):
        record = yaml.safe_load(open(path, encoding="utf-8"))
        if not any(fact.get("type") == "federal" for fact in record.get("recognition") or []):
            continue
        identifier = record["id"]
        facts = record.get("states") or []
        land = sorted({fact["state"] for fact in facts if fact.get("presence") == "land"})
        by_land = bool(land)
        states = land or sorted({fact["state"] for fact in facts})
        existing = [fact for fact in record.get("jurisdiction") or [] if fact["topic"] == "public-law-280"]
        added = []
        for state in states:
            name = names[state]
            if state in MANDATORY:
                if EXCEPTED.get(identifier) == state or FULLY_RETROCEDED.get(identifier) == state:
                    continue
                if any(fact["value"] == "mandatory-state" and name in (fact.get("detail") or "") for fact in existing):
                    continue
                fact = {
                    "topic": "public-law-280",
                    "value": "mandatory-state",
                    "detail": f"{name} is a mandatory state: 18 U.S.C. § 1162(a) (criminal) and 28 U.S.C. § 1360(a) (civil) extend state jurisdiction to all Indian country within {name}. Applies to the nation's Indian country within {name}; the statute itself does not identify which lands are Indian country.",
                    "source": "us-code-title-18-section-1162",
                    "confidence": "medium",
                    "verification": "inferred",
                    "as_of": "2010-07-29",
                    "locator": f"18 U.S.C. § 1162(a) and 28 U.S.C. § 1360(a), entry \"{name}\"",
                    "note": ("Statute is primary; nation placed in " + name + (" by the Census Bureau's land areas" if by_land else " by its office state in the BIA Tribal Leaders Directory") + ", so confidence is medium. Cited jointly with us-code-title-28-section-1360. Added on 2026-11-23 where the profile had no fact for this state (for example a band split out of a combined record)."),
                }
            elif state in OPTIONAL:
                continue
            else:
                fact = {
                    "topic": "public-law-280",
                    "value": "not-a-public-law-280-state",
                    "detail": f"{name} is not one of the states that Public Law 280 required to take jurisdiction or that chose to take it, so the state has no Public Law 280 jurisdiction over the nation's Indian country in {name}. Other federal laws can still give a state some jurisdiction.",
                    "source": "bia-faq-public-law-280",
                    "confidence": "high" if by_land else "medium",
                    "verification": "inferred",
                    "as_of": "2017-07-18",
                    "locator": "Answer, second and third paragraphs (the lists of mandatory and optional states)",
                    "note": ("Inferred from the state's absence from both lists. Nation placed in " + name + (" by the Census Bureau's land areas." if by_land else " by its office state in the BIA Tribal Leaders Directory, so confidence is medium.")),
                }
            batch["facts"].append({"profile": identifier, "key": "jurisdiction", "fact": fact})
            added.append(name)
        if added:
            batch["searches"].append({"profile": identifier, "topic": "jurisdiction", "status": "found", "entry": {
                "date": TODAY, "searched_by": BY, "method": "script", "place_kind": "federal-list",
                "address": "https://www.bia.gov/faqs/what-public-law-280-and-where-does-it-apply",
                "query": "scripts/jurisdiction/public_law_280_gaps.py: the nation's states against the mandatory and optional Public Law 280 states",
                "outcome": "found",
                "reason": "Public Law 280 status recorded for " + ", ".join(added) + ".",
            }})
    print(json.dumps(batch, indent=1, ensure_ascii=False))


if __name__ == "__main__":
    main()
