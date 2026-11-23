#!/usr/bin/env python3
"""Write each nation's official representatives into the Tribe profiles, and log every search.

An official representative here is an office, never a person: the office that
an official government list names as the nation's leader (the `representatives`
list of schemas/tribe.schema.json; decision record 0052). Two kinds of list:

1. The Tribal Leaders Directory of the Bureau of Indian Affairs, for every
   federally recognized nation. The title of each nation's leader comes from
   research/governance/directory-titles.json (written by
   scripts/governance/apply.py from the directory's feature service, fields
   tribefullname and jobtitle only). The directory has no page for a single
   nation, so the link is the directory's own page, and `listed_as` gives the
   name to look up there.
2. A state's list of the Tribes it recognizes, kept by its Indian affairs
   commission or office, where the list names each Tribe's leader. What was
   read, and which states' lists name no office, is in
   research/representatives/state-listings.json.

No person's name, email address or phone number is copied (charter,
commitment 1). The list itself names who holds the office now.

  python3 scripts/representatives/apply.py
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
TRIBES = ROOT / "content" / "tribes"
LOGS = ROOT / "research" / "search-logs" / "representatives"
STATE_LISTINGS = ROOT / "research" / "representatives" / "state-listings.json"
DIRECTORY_TITLES = ROOT / "research" / "governance" / "directory-titles.json"
DATE = "2026-11-23"
BY = "Claude (AI assistant)"

DIRECTORY_SOURCE = "bia-tribal-leaders-directory-2026"
DIRECTORY_LISTED_BY = "Bureau of Indian Affairs, Tribal Leaders Directory"
DIRECTORY_PAGE = "https://www.bia.gov/service/tribal-leaders-directory"
DIRECTORY_SERVICE = "https://services1.arcgis.com/UxqqIfhng71wUT9x/arcgis/rest/services/TribalLeadership_Directory/FeatureServer/0"
DIRECTORY_AS_OF = "2026-11-20"

# Top-level profile keys the representatives list goes before, in order of preference.
FOLLOWING_KEYS = ["governing_documents", "justice_institutions", "dispute_resolution", "gaming",
                  "jurisdiction", "jurisdiction_agreements", "treaties", "land_establishment",
                  "memberships", "related_entities", "consultation", "review"]

# Titles that name an office other than the leader's, or no office at all.
NOT_A_LEADER = {"vice-president", "secretary", "chief's"}


def dump(value) -> str:
    return yaml.safe_dump(value, allow_unicode=True, sort_keys=False, width=10**6)


def office(raw: str | None) -> tuple[str | None, bool]:
    """The office's title without the holder's own form, and whether the list shows it vacant.

    Chairman, Chairwoman and Chair become Chairperson; words about the holder
    (acting, interim, a dispute flag) are dropped.
    """
    if not raw:
        return None, False
    title = raw.replace("*", "")
    vacant = bool(re.search(r"\(vacant\)", title, flags=re.I))
    title = re.sub(r"\((vacant|Subject to Tribal Leadership Dispute)\)", "", title, flags=re.I).strip()
    title = re.sub(r"^(Acting|Interim)\s+", "", title, flags=re.I).strip()
    if title.lower() in NOT_A_LEADER:
        return None, False
    if title.lower() == "president/ceo":
        title = "President"
    if title.lower() == "1st chief":
        title = "First Chief"
    title = re.sub(r"\bChair(man|woman)?\b", "Chairperson", title)
    return title, vacant


def profiles() -> dict[str, Path]:
    return {path.stem: path for path in sorted(TRIBES.glob("*/*.yaml"))}


def letter(identifier: str) -> str:
    return identifier[0] if identifier[0].isalpha() else "_other"


def replace_block(text: str, key: str, block: str) -> str:
    """Replace or add the top-level `key:` list in the file's own text, so nothing else is re-dumped."""
    pattern = re.compile(rf"^{re.escape(key)}:\n(?:(?:[- ] .*|\s*)\n)*", re.M)
    match = pattern.search(text)
    if match:
        return text[:match.start()] + block + text[match.end():]
    if not block:
        return text
    for following in FOLLOWING_KEYS:
        found = re.search(rf"^{following}:", text, flags=re.M)
        if found:
            return text[:found.start()] + block + text[found.start():]
    return text + block


def directory_entries(rows: list[dict]) -> list[dict]:
    entries, seen = [], set()
    for row in rows:
        title, _ = office(row["listed"])
        if not title or title in seen:
            continue
        seen.add(title)
        note = ("The title of the leader's office as the federal directory lists it; the holder's name is not recorded. "
                "The directory has no page for a single nation: open it and look up the name given here.")
        if row["listed"] and row["listed"].strip() != title:
            note += f" Listed as “{row['listed'].strip()}”; recorded without the holder's own form of the title."
        entries.append({"office": title, "listed_by": DIRECTORY_LISTED_BY, "link": DIRECTORY_PAGE,
                        "listed_as": row["row"], "source": DIRECTORY_SOURCE, "confidence": "high",
                        "verification": "bulk-import", "as_of": DIRECTORY_AS_OF, "locator": row["row"], "note": note})
    return entries


def state_entries(rows: list[dict], lists: dict) -> list[dict]:
    entries = []
    for row in rows:
        listing = lists[row["state"]]
        for raw in row["listed"]:
            title, vacant = office(raw)
            if not title:
                continue
            note = "The title of the office as the state's list gives it; the holder's name is not recorded."
            plain = re.sub(r"\s*\(vacant\)", "", raw, flags=re.I).strip()
            if plain != title:
                note += f" Listed as “{plain}”; recorded without the holder's own form of the title."
            if vacant:
                note += " The list showed the office as vacant when read."
            entries.append({"office": title, "listed_by": listing["listed_by"], "link": listing["link"],
                            "listed_as": row["listed_as"], "source": listing["source"], "confidence": "high",
                            "verification": "read-in-full", "as_of": listing["as_of"],
                            "locator": listing["locator_form"].format(name=row["listed_as"]), "note": note})
    return entries


def search(address: str, query: str, outcome: str, reason: str, place_kind: str, records: list[str] | None = None,
           method: str = "script") -> dict:
    entry = {"date": DATE, "searched_by": BY, "method": method, "place_kind": place_kind, "address": address,
             "query": query, "outcome": outcome, "reason": reason}
    if records:
        entry["records"] = records
    return entry


def main() -> None:
    listings = json.loads(STATE_LISTINGS.read_text(encoding="utf-8"))
    titles: dict[str, list[dict]] = {}
    for row in json.loads(DIRECTORY_TITLES.read_text(encoding="utf-8")):
        titles.setdefault(row["nation"], []).append(row)
    by_state: dict[str, list[dict]] = {}
    for row in listings["entries"]:
        by_state.setdefault(row["nation"], []).append(row)

    counts = {"profiles": 0, "with representatives": 0, "federal list": 0, "state lists": 0}
    for identifier, path in profiles().items():
        counts["profiles"] += 1
        text = path.read_text(encoding="utf-8")
        record = yaml.safe_load(text)
        recognition = record.get("recognition") or []
        federal = any(fact.get("type") == "federal" for fact in recognition)
        states = sorted({fact.get("state") for fact in recognition if fact.get("type") == "state" and fact.get("state")})

        federal_entries = directory_entries(titles.get(identifier, []))
        listed_rows = by_state.get(identifier, [])
        listed_entries = state_entries(listed_rows, listings["lists"])
        entries = federal_entries + listed_entries
        block = ("representatives:\n" + dump(entries)) if entries else ""
        new_text = replace_block(text, "representatives", block)
        expected = dict(record)
        expected.pop("representatives", None)
        if entries:
            expected["representatives"] = entries
        if yaml.safe_load(new_text) != expected:
            raise SystemExit(f"{path}: the written file does not match the intended record")
        if new_text != text:
            path.write_text(new_text, encoding="utf-8")
        if entries:
            counts["with representatives"] += 1
        counts["federal list"] += bool(federal_entries)
        counts["state lists"] += bool(listed_entries)

        # The search log: the federal directory for every nation, and each state list that could name it.
        searches = []
        if federal_entries:
            searches.append(search(DIRECTORY_SERVICE, "jobtitle of the nation's row", "found",
                                   "The directory lists the title of the leader's office.", "database-listing", [DIRECTORY_SOURCE]))
        elif titles.get(identifier):
            searches.append(search(DIRECTORY_SERVICE, "jobtitle of the nation's row", "not-found",
                                   "The directory lists the nation but gives no title for its leader's office, or gives another office's.",
                                   "database-listing"))
        else:
            searches.append(search(DIRECTORY_SERVICE, "jobtitle of the nation's row", "not-found",
                                   "The nation was not matched to a row of the directory." if federal
                                   else "The directory lists federally recognized nations only.", "database-listing"))
        listed_states = {row["state"] for row in listed_rows}
        for state in sorted(listed_states | set(states)):
            listing = listings["lists"].get(state)
            query = "The office the state's list of Tribes names as the nation's leader"
            if listing:
                rows = [row for row in listed_rows if row["state"] == state]
                if rows and any(office(raw)[0] for row in rows for raw in row["listed"]):
                    searches.append(search(listing["link"], query, "found",
                                           "The state's list names the leader's office.", "official-list",
                                           [listing["source"]], method="ai-review"))
                elif rows:
                    searches.append(search(listing["link"], query, "not-found",
                                           "The state's list names a person for the nation but gives no title of an office.",
                                           "official-list", method="ai-review"))
                else:
                    searches.append(search(listing["link"], query, "not-found",
                                           "The nation is not on the state's list.", "official-list", method="ai-review"))
            elif state in listings["checked_without_offices"]:
                checked = listings["checked_without_offices"][state]
                searches.append(search(checked["address"], query, checked.get("outcome", "not-found"), checked["reason"],
                                       "official-list", method="ai-review"))
            elif state in listings["no_list"]:
                searches.append(search("research/representatives/state-listings.json", query, "not-found",
                                       listings["no_list"][state], "other", method="ai-review"))
        found = any(entry["outcome"] == "found" for entry in searches)
        log = {
            "profile": str(path.relative_to(ROOT)),
            "topic": "representatives",
            "status": "found" if found else "partly-searched",
            "last_searched": DATE,
            "searches": searches,
        }
        if not found:
            log["next_steps"] = ("Ask the nation's office which office speaks for it; a state's list that names "
                                 "Tribes' leaders, where one is published later.")
        target = LOGS / letter(identifier) / f"{identifier}.yaml"
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(dump(log), encoding="utf-8")
    print(json.dumps(counts))


if __name__ == "__main__":
    main()
