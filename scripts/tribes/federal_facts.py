#!/usr/bin/env python3
"""Turn the Bureau of Indian Affairs list of recognized entities and the Tribal Leaders
Directory into dated, cited facts (the same shape the research helpers produce).

Inputs (downloaded by hand; see research/sessions/2026/2026-11-21-federal-list-import.md):
  list.htm       govinfo.gov text of 91 FR 4102 (FR Doc. 2026-01899)
  directory.json Tribal Leaders Directory feature service query (outFields=*, f=json)

Usage:
  python3 -I scripts/tribes/federal_facts.py list.htm directory.json out.json

Only office contact points are kept from the directory. Names, titles, personal email
addresses and election dates of officials are dropped on purpose (charter, commitment 1).
"""
import collections
import difflib
import html
import json
import re
import sys
import unicodedata

LIST_SOURCE = "bia-recognized-entities-2026"
DIRECTORY_SOURCE = "bia-tribal-leaders-directory-2026"
LIST_DATE = "2026-01-30"
DIRECTORY_DATE = "2026-11-20"  # dataLastEditDate reported by the feature service
LEGAL_BASIS = ("Federally Recognized Indian Tribe List Act of 1994, Pub. L. No. 103-454, "
               "§ 104, 108 Stat. 4791, 4792 (25 U.S.C. § 5131); 25 C.F.R. § 83.6(a)")

STATES = {
    "Alabama": "AL", "Alaska": "AK", "Arizona": "AZ", "Arkansas": "AR", "California": "CA",
    "Colorado": "CO", "Connecticut": "CT", "Delaware": "DE", "Florida": "FL", "Georgia": "GA",
    "Idaho": "ID", "Illinois": "IL", "Indiana": "IN", "Iowa": "IA", "Kansas": "KS",
    "Kentucky": "KY", "Louisiana": "LA", "Maine": "ME", "Maryland": "MD",
    "Massachusetts": "MA", "Michigan": "MI", "Minnesota": "MN", "Mississippi": "MS",
    "Missouri": "MO", "Montana": "MT", "Nebraska": "NE", "Nevada": "NV",
    "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY",
    "North Carolina": "NC", "North Dakota": "ND", "Ohio": "OH", "Oklahoma": "OK",
    "Oregon": "OR", "Pennsylvania": "PA", "Rhode Island": "RI", "South Carolina": "SC",
    "South Dakota": "SD", "Tennessee": "TN", "Texas": "TX", "Utah": "UT", "Vermont": "VT",
    "Virginia": "VA", "Washington": "WA", "West Virginia": "WV", "Wisconsin": "WI",
    "Wyoming": "WY", "Hawaii": "HI", "District of Columbia": "DC",
}
STATE_NAMES = "|".join(sorted(STATES, key=len, reverse=True))


def strip_parentheses(text):
    out, depth = "", 0
    for char in text:
        if char == "(":
            depth += 1
        elif char == ")":
            depth -= 1
        elif depth == 0:
            out += char
    return re.sub(r"\s+", " ", out).strip()


def parentheticals(text):
    found, depth, current = [], 0, ""
    for char in text:
        if char == "(":
            if depth:
                current += char
            depth += 1
        elif char == ")":
            depth -= 1
            if depth == 0:
                found.append(current.strip())
                current = ""
            else:
                current += char
        elif depth:
            current += char
    return found


def slug(text):
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    text = text.lower().replace("&", " and ").replace("'", "").replace("’", "")
    return re.sub(r"[^a-z0-9]+", "-", text).strip("-")


def make_id(name):
    name = strip_parentheses(name)
    name = re.sub(rf",\s*({STATE_NAMES})((\s*(,|and|&)\s*({STATE_NAMES}))*)$", "", name)
    return slug(name)


def parse_list(path):
    text = html.unescape(re.sub(r"<[^>]+>", "", open(path, encoding="utf-8").read()))
    lines = text.split("\n")
    start = next(i for i, l in enumerate(lines) if l.startswith("Indian Tribal Entities Within the Contiguous"))
    alaska = next(i for i, l in enumerate(lines) if l.startswith("Native Entities Within the State of Alaska"))
    end = next(i for i, l in enumerate(lines) if "[FR Doc." in l)
    entries = []

    def collect(block_start, block_end, group, page):
        current = ""
        for line in lines[block_start:block_end]:
            marker = re.match(r"\[\[Page (\d+)\]\]", line)
            if marker:
                page = int(marker.group(1))
                continue
            if not line.strip():
                continue
            current += line
            if line.endswith(" "):
                continue
            entries.append({"listed": current.strip(), "group": group, "page": page})
            current = ""
        return page

    def last_page(before):
        pages = [int(m.group(1)) for l in lines[:before] for m in [re.match(r"\[\[Page (\d+)\]\]", l)] if m]
        return pages[-1] if pages else 4102

    page = collect(start + 3, alaska, "contiguous-48", last_page(start))
    collect(alaska + 2, end, "alaska", last_page(alaska))
    return entries


def usable(value):
    """Drop empty values and directory placeholders such as 'Please refer to affiliates'."""
    return bool(value) and bool(value.strip()) and "refer to" not in value.lower()


def norm(text):
    text = unicodedata.normalize("NFKD", text.lower()).encode("ascii", "ignore").decode()
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", "", text.replace("&", "and"))).strip()


def main(list_path, directory_path, out_path):
    entries = parse_list(list_path)
    rows = [f["attributes"] for f in json.load(open(directory_path, encoding="utf-8"))["features"]]
    by_name = collections.defaultdict(list)
    for row in rows:
        by_name[norm(row["tribefullname"])].append(row)

    facts, entities, notes = [], [], []

    def fact(nation, field, value, source, confidence, as_of, locator=None, note=None):
        item = {"nation": nation, "field": field, "value": value, "source": source,
                "confidence": confidence, "as_of": as_of}
        if locator:
            item["locator"] = locator
        if note:
            item["note"] = note
        facts.append(item)

    records = []
    for entry in entries:
        listed = entry["listed"]
        # Cross-references ("X (See Y)") point to another entry; Lumbee's "(See ...)" is a note.
        if "(See " in listed and not listed.startswith("Lumbee"):
            continue
        official = strip_parentheses(listed)
        if official == "PuliklaTribe of Yurok People":
            official = "Pulikla Tribe of Yurok People"
            notes.append("govinfo prints 'PuliklaTribe' without a space; treated as a typesetting artifact.")
        records.append({"id": make_id(official), "official": official, "listed": listed,
                        "group": entry["group"], "page": entry["page"],
                        "parens": parentheticals(listed)})

    # The Capitan Grande entry names two groups that act as separate governments.
    capitan = next(r for r in records if r["official"].startswith("Capitan Grande"))
    for group_name, group_id in [
        ("Barona Group of Capitan Grande Band of Mission Indians of the Barona Reservation",
         "barona-group-of-capitan-grande-band-of-mission-indians"),
        ("Viejas (Baron Long) Group of Capitan Grande Band of Mission Indians of the Viejas Reservation",
         "viejas-baron-long-group-of-capitan-grande-band-of-mission-indians"),
    ]:
        records.append({"id": group_id, "official": group_name, "listed": group_name,
                        "group": "contiguous-48", "page": capitan["page"], "parens": [],
                        "component_of": capitan["official"]})

    ids = collections.Counter(r["id"] for r in records)
    duplicates = [k for k, v in ids.items() if v > 1]
    if duplicates:
        sys.exit(f"duplicate ids: {duplicates}")

    unmatched = []
    for record in records:
        nation = record["id"]
        locator = f"91 Fed. Reg. {record['page']}"
        entities.append({"id": nation, "official_name": record["official"], "entity_type": "native-nation",
                         "list": record["group"]})
        recognition = {"type": "federal", "legal_basis": LEGAL_BASIS}
        note = None
        if record["official"].startswith("Lumbee"):
            recognition["legal_basis"] += "; National Defense Authorization Act for Fiscal Year 2026, Pub. L. No. 119-60, § 8803"
            recognition["since"] = "2025-12-18"
            note = ("The notice states that the Act sets conditions on eligibility for federal services, including "
                    "verification of the roll and a delay in services until the third fiscal year after enactment.")
        if record.get("component_of"):
            note = f"Listed as a group within the entry for {record['component_of']}."
        fact(nation, "recognition", recognition, LIST_SOURCE, "high", LIST_DATE, locator, note)
        recognition_index = len(facts) - 1

        listed_note = []
        for paren in record["parens"]:
            for part in re.split(r";\s*", paren):
                part = part.strip()
                if part.startswith("See ") or not part:
                    continue
                m = re.match(r"previously listed as\s+(.*)", part)
                if m:
                    fact(nation, "name-former", {"name": m.group(1).strip()}, LIST_SOURCE, "high", LIST_DATE, locator,
                         "Listed in the notice as a previous name.")
                    continue
                m = re.match(r"aka\s+(.*)", part)
                if m:
                    fact(nation, "name-alternate", {"name": m.group(1).strip()}, LIST_SOURCE, "high", LIST_DATE, locator,
                         "Listed in the notice as also known as.")
                    continue
                # Other parentheticals name places, component bands or groups; they are kept
                # verbatim in the recognition note rather than guessed to be names.
                listed_note.append(part)
        if listed_note:
            facts[recognition_index]["note"] = " ".join(
                x for x in [facts[recognition_index].get("note"),
                            "The notice adds in parentheses: " + "; ".join(listed_note) + "."] if x)

        if record["group"] == "alaska":
            fact(nation, "state-presence", {"state": "AK"}, LIST_SOURCE, "high", LIST_DATE, locator,
                 "Listed among Native entities within the State of Alaska.")
        named = re.search(rf",\s*(({STATE_NAMES})((\s*(,|and|&)\s*({STATE_NAMES}))*))$", record["official"])
        if named:
            for state in re.findall(STATE_NAMES, named.group(1)):
                if STATES[state] == "AK" and record["group"] == "alaska":
                    continue
                fact(nation, "state-presence", {"state": STATES[state]}, LIST_SOURCE, "high", LIST_DATE, locator,
                     "State named in the listed name.")

        # Directory match: exact name, a parenthetical name, then a close match.
        keys = [norm(record["official"]), norm(record["listed"]),
                norm(record["listed"].replace("PuliklaTribe", "Pulikla Tribe"))]
        keys += [norm(p) for p in record["parens"]]
        if record.get("component_of"):
            keys = [k for k in by_name if norm(record["official"]) in k]
        hit = next((k for k in keys if k in by_name), None)
        match_note = None
        if not hit:
            close = difflib.get_close_matches(norm(record["official"]), list(by_name), n=1, cutoff=0.85)
            if close:
                hit = close[0]
                match_note = "Matched to the directory by a close (not exact) name."
        if not hit:
            unmatched.append(record["official"])
            continue
        candidates = by_name[hit]
        row = next((r for r in candidates if r["tribalcomponent"] == "Tribe"), candidates[0])
        if record.get("component_of"):
            affiliates = [r for k in keys for r in by_name[k] if r["tribalcomponent"].startswith("Affiliate")]
            row = affiliates[0] if affiliates else row
        confidence = "medium" if match_note else "high"
        office_state = STATES.get(row.get("state") or "")
        if office_state:
            fact(nation, "state-presence", {"state": office_state, "presence": "government-office"},
                 DIRECTORY_SOURCE, confidence, DIRECTORY_DATE, row["tribefullname"], match_note)
        label = "Tribal government office"
        if usable(row.get("website")):
            fact(nation, "website", {"value": row["website"].strip(), "label": label},
                 DIRECTORY_SOURCE, confidence, DIRECTORY_DATE, row["tribefullname"], match_note)
        street = ", ".join(x for x in [row.get("physicaladdress"), row.get("city")] if x)
        if usable(row.get("physicaladdress")):
            value = f"{street}, {office_state or row.get('state')} {row.get('zipcode') or ''}".strip()
            fact(nation, "physical-address", {"value": value, "label": label},
                 DIRECTORY_SOURCE, confidence, DIRECTORY_DATE, row["tribefullname"], match_note)
        if usable(row.get("mailingaddress")):
            mail_state = STATES.get(row.get("mailingaddressstate") or "", row.get("mailingaddressstate") or "")
            value = ", ".join(x for x in [row["mailingaddress"], row.get("mailingaddresscity")] if x)
            value = f"{value}, {mail_state} {row.get('mailingaddresszipcode') or ''}".strip()
            fact(nation, "mailing-address", {"value": value, "label": label},
                 DIRECTORY_SOURCE, confidence, DIRECTORY_DATE, row["tribefullname"], match_note)
        for field, key in [("phone", "phone"), ("fax", "fax")]:
            if usable(row.get(key)):
                fact(nation, field, {"value": row[key].strip(), "label": label},
                     DIRECTORY_SOURCE, confidence, DIRECTORY_DATE, row["tribefullname"], match_note)
        if row.get("biaregion"):
            value = {"bureau_of_indian_affairs_region": row["biaregion"]}
            if row.get("biaagency"):
                value["bureau_of_indian_affairs_agency"] = row["biaagency"]
            fact(nation, "federal-administration", value, DIRECTORY_SOURCE, confidence, DIRECTORY_DATE,
                 row["tribefullname"], match_note)
        if row.get("ancsaregion"):
            fact(nation, "related-entity", {"name": row["ancsaregion"],
                                            "relation": "alaska-native-claims-settlement-act-regional-corporation"},
                 DIRECTORY_SOURCE, confidence, DIRECTORY_DATE, row["tribefullname"],
                 "Regional corporation for the area, as listed in the directory.")

    # Some Alaska entries list a regional organization's site; say so rather than imply it is the nation's own.
    sites = collections.Counter(f["value"]["value"] for f in facts if f["field"] == "website")
    for item in facts:
        if item["field"] == "website" and sites[item["value"]["value"]] > 1:
            item["note"] = " ".join(x for x in [item.get("note"), "The directory lists this same website for "
                                                 f"{sites[item['value']['value']]} entities; it is likely a regional organization's site."] if x)
            item["value"]["label"] = "Website listed for the nation (shared)"

    out = {"agent": "federal-list-and-directory", "entities": entities, "facts": facts, "sources": [],
           "log": {"limits": "; ".join(notes + [f"No directory match for: {', '.join(unmatched)}" if unmatched else "All entries matched the directory."])}}
    with open(out_path, "w", encoding="utf-8") as handle:
        json.dump(out, handle, indent=1, ensure_ascii=False)
        handle.write("\n")
    print(f"{len(entities)} entities, {len(facts)} facts, unmatched: {unmatched}")


if __name__ == "__main__":
    main(*sys.argv[1:4])
