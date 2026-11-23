#!/usr/bin/env python3
"""Turn the National Indian Gaming Commission's lists of Indian lands opinions
and enforcement actions (research/raw/2026-11-23/gaming-commission-records.json)
into source records and a batch for apply.py.

Each nation named in a list gets `gaming.indian_lands_opinions` and
`gaming.enforcement_actions`, one fact per row, citing the list page and
linking the row's document. Rows naming businesses, management contractors or
people are left out of the raw file; people's names are never recorded.
Every other federally recognized nation gets a search-log entry saying the
lists do not name it.

Usage: python3 scripts/jurisdiction/build_gaming_commission_records.py > research/jurisdiction/gaming-commission-records.json
"""
import json

import yaml

from sources import ROOT, SESSION, write_source

RAW = ROOT / "research/raw/2026-11-23/gaming-commission-records.json"
BY = "Claude (AI assistant)"
OPINIONS = "national-indian-gaming-commission-indian-lands-opinions"
ACTIONS = "national-indian-gaming-commission-enforcement-actions"
KINDS = {"NOV": "notice-of-violation", "SA": "settlement-agreement", "CFA": "civil-fine-assessment", "CO": "closure-order",
         "TCO": "temporary-closure-order", "POA": "pre-opening-agreement", "RO": "other-order", "ORD": "other-order"}


def kinds_of(code: str) -> list[str]:
    seen = []
    for part in code.replace("-", "/").split("/"):
        kind = KINDS[part.strip()]
        if kind not in seen:
            seen.append(kind)
    return seen


def main() -> None:
    raw = json.loads(RAW.read_text(encoding="utf-8"))
    opinions_page, actions_page = raw["indian_lands_opinions"]["page"], raw["enforcement_actions"]["page"]
    write_source(OPINIONS, "web-page", "Indian Lands Opinions", "National Indian Gaming Commission", opinions_page, None, "us-government-work",
                 "Indigo Book citation: Nat'l Indian Gaming Comm'n, Indian Lands Opinions, " + opinions_page + " (last visited Nov. 23, 2026). "
                 "The list of Indian lands opinions of the Commission and the Interior Department's Office of the Solicitor (tribe, parcel, legal theory, whether the theory was accepted, date), read row by row on Nov. 23, 2026.")
    write_source(ACTIONS, "web-page", "Enforcement Actions", "National Indian Gaming Commission", actions_page, None, "us-government-work",
                 "Indigo Book citation: Nat'l Indian Gaming Comm'n, Enforcement Actions, " + actions_page + " (last visited Nov. 23, 2026). "
                 "The list of notices of violation, closure orders, civil fine assessments, settlement agreements and pre-opening agreements from 1999 to date (title, tracking number, date, type), read row by row on Nov. 23, 2026.")
    lists: dict[str, dict[str, list]] = {}
    for row in raw["indian_lands_opinions"]["rows"]:
        fact = {"parcel": row["parcel"], "legal_theory": row["legal_theory"], "accepted": row["theory_accepted"] == "Yes", "date": row["date"],
                "link": row["link"], "source": OPINIONS, "confidence": "high", "verification": "bulk-import",
                "locator": f"Row for {row['tribe']}, {row['date']}",
                "note": f"The list names the tribe as “{row['tribe']}”."}
        lists.setdefault(row["roster_id"], {}).setdefault("indian_lands_opinions", []).append(fact)
    for row in raw["enforcement_actions"]["rows"]:
        fact = {"kinds": kinds_of(row["type"]), "tracking_number": row["tracking_number"], "date": row["date"], "link": row["link"],
                "source": ACTIONS, "confidence": "high", "verification": "bulk-import",
                "locator": f"Row {row['tracking_number']}",
                "note": f"The list titles the action “{row['title']}” and gives its type as {row['type']}."}
        lists.setdefault(row["roster_id"], {}).setdefault("enforcement_actions", []).append(fact)
    batch = {"session": SESSION, "facts": [], "searches": []}
    for path in sorted((ROOT / "content/tribes").glob("*/*.yaml")):
        record = yaml.safe_load(path.read_text(encoding="utf-8"))
        if not any(fact.get("type") == "federal" for fact in record.get("recognition") or []):
            continue
        found = lists.get(record["id"])
        entry = {"date": "2026-11-23", "searched_by": BY, "method": "script", "place_kind": "official-list",
                 "address": f"{opinions_page} and {actions_page}",
                 "query": "Indian lands opinions and enforcement actions of the National Indian Gaming Commission (scripts/jurisdiction/build_gaming_commission_records.py)"}
        if not found:
            batch["searches"].append({"profile": record["id"], "topic": "federal-ties", "status": "none-found", "entry": {
                **entry, "outcome": "not-found", "reason": "Neither list names the nation."}})
            continue
        for key, items in found.items():
            for item in sorted(items, key=lambda item: item["date"]):
                batch["facts"].append({"profile": record["id"], "key": f"gaming.{key}", "fact": item})
        counts = ", ".join(f"{len(items)} {key.replace('_', ' ')}" for key, items in sorted(found.items()))
        batch["searches"].append({"profile": record["id"], "topic": "federal-ties", "status": "found", "entry": {
            **entry, "outcome": "found", "reason": f"Recorded {counts}."}})
    print(json.dumps(batch, indent=1, ensure_ascii=False))


if __name__ == "__main__":
    main()
