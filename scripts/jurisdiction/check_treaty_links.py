#!/usr/bin/env python3
"""Check the low-confidence treaty links on nation profiles.

build_treaties.py linked historic treaty parties to present-day nations; the
links it could not tie to the nation's own name went in at low confidence.
This pass checks each of them against two things:

- the successor list the Oklahoma State University Tribal Treaties Database
  keeps for the treaty inside an HTML comment (no longer displayed; some
  lists read "Under review"), saved in
  research/raw/2026-11-23/treaty-successor-lists.json;
- the treaty's own text (its opening names the parties), read for every link
  the list does not support.

Outcomes:

- corroborated: the list names the nation (or one of its constituent bands):
  medium confidence;
- confirmed by the text: the treaty's text names the nation's people under
  another name: medium confidence (TEXT_CONFIRMED);
- removed: the text shows the nation's people were not a party (REJECTED);
- kept: plausible but not supported by the list: stays low, and the note
  says why.

Every link stays `verification: inferred`. The script edits the `treaties`
block of each profile it touches and writes a report.

Usage: python3 scripts/jurisdiction/check_treaty_links.py
"""
import json
import sys

import yaml

sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parent))
from apply import profile_path, set_object  # noqa: E402
from sources import ROOT  # noqa: E402

RAW = ROOT / "research/raw/2026-11-23/treaties.json"
LISTS = ROOT / "research/raw/2026-11-23/treaty-successor-lists.json"
REPORT = ROOT / "research/raw/2026-11-23/treaty-link-check.json"

TEXT_CONFIRMED = {
    ("treaty-with-the-makah-1815-0115", "omaha-tribe-of-nebraska"): "The treaty's text names the party as the Mahas, the Omaha; the database's title and list read the name as Makah, the Washington nation.",
    ("treaty-with-the-makah-tribe-1825-0260", "omaha-tribe-of-nebraska"): "The treaty's text names the party as the Maha tribe, the Omaha; the database's title and list read the name as Makah, the Washington nation.",
    ("treaty-with-the-sauk-and-foxes-1867-0951", "sac-and-fox-nation"): "The treaty's text names the Sacs and Foxes of the Mississippi, then in Kansas, who removed to the Indian Territory as the Sac and Fox Nation; the database's list names only the Iowa community.",
    ("treaty-with-the-sioux-brule-oglala-miniconjou-yanktonai-hunkpapa-blackfeet-cuthead-two-kettle-sans-arcs-and-santee-and-arapaho-1868-0998", "rosebud-sioux-tribe-of-the-rosebud-indian-reservation"): "The treaty's text names the Brulé band, the Sicangu Lakota of the Rosebud Sioux Tribe.",
}

WEA_1809 = "The treaty's text is the Wea tribe's consent to the Fort Wayne treaty of Sept. 30, 1809; it names the other tribes only as parties to that treaty, so they did not sign this one."
WEA_PIANKASHAW = "The Wea and Piankashaw joined the Kaskaskia and Peoria in the Confederated Peoria under the 1854 treaty, so their successor is the Peoria Tribe of Indians of Oklahoma, not the Miami Tribe of Oklahoma."
REJECTED = {
    **{("treaty-with-the-wea-1809-0103", nation): WEA_1809 for nation in (
        "citizen-potawatomi-nation", "delaware-nation", "delaware-tribe-of-indians", "forest-county-potawatomi-community",
        "hannahville-indian-community", "match-e-be-nash-she-wish-band-of-pottawatomi", "nottawaseppi-huron-band-of-the-potawatomi",
        "pokagon-band-of-potawatomi-indians", "prairie-band-potawatomi-nation")},
    **{(treaty, "miami-tribe-of-oklahoma"): WEA_PIANKASHAW for treaty in (
        "treaty-with-the-piankeshaw-1804-0072", "treaty-with-the-piankashaw-1805-0089", "treaty-with-the-kickapoo-1809-0104",
        "treaty-with-the-wea-and-kickapoo-1816-0131", "treaty-with-the-wea-1818-0169", "treaty-with-the-wea-1820-0190",
        "treaty-with-the-piankashaw-and-wea-1832-0382", "treaty-with-the-kaskaskia-peoria-etc-1854-0636")},
    ("treaty-with-the-seneca-1831-0325", "eastern-shawnee-tribe-of-oklahoma"): "The treaty's text names only the Seneca residing on the Sandusky River; the mixed band of Seneca and Shawnee at Lewistown, from whom the Eastern Shawnee descend, made a separate treaty that year.",
    ("treaty-with-the-chippewa-1826-0268", "ottawa-tribe-of-oklahoma"): "The treaty's text is with the Chippewa tribe at Fond du Lac of Lake Superior; the Ottawa of Ohio, from whom the Ottawa Tribe of Oklahoma descends, were not a party.",
    ("treaty-with-the-potawatomi-nation-1846-0557", "ottawa-tribe-of-oklahoma"): "The treaty's text names the Ottawas of the United Band of Chippewas, Ottawas and Pottowautomies, who joined the Potawatomi nations; the Ottawa of Ohio, from whom the Ottawa Tribe of Oklahoma descends, were not a party.",
    ("treaty-with-the-utah-tabeguache-band-1863-0856", "southern-ute-indian-tribe-of-the-southern-ute-reservation"): "The treaty's text names only the Tabeguache band, whose descendants are in the Ute Indian Tribe of the Uintah and Ouray Reservation; the Southern Ute descend from the Muache and Capote bands.",
    ("treaty-with-the-utah-tabeguache-band-1863-0856", "ute-mountain-ute-tribe"): "The treaty's text names only the Tabeguache band, whose descendants are in the Ute Indian Tribe of the Uintah and Ouray Reservation; the Ute Mountain Ute descend from the Weeminuche band.",
    ("treaty-with-the-sauk-1815-0120", "sac-and-fox-nation"): "The treaty's text names only the portion of the Sac nation then residing on the Missouri River, from whom the Sac and Fox Nation of Missouri in Kansas and Nebraska descends.",
    ("treaty-with-the-sauk-1815-0120", "sac-and-fox-tribe-of-the-mississippi-in-iowa"): "The treaty's text names only the portion of the Sac nation then residing on the Missouri River, from whom the Sac and Fox Nation of Missouri in Kansas and Nebraska descends.",
}

ENDING = " The page is the treaty's first page as the Oklahoma State University database's address gives it."


def is_low(link: dict) -> bool:
    return not link["basis"].startswith("successor named") and link["confidence"] != "high"


def agent_note(link: dict) -> str:
    note = (link.get("note") or "").replace(" -> ", " to ").replace("->", "to").strip()
    if note and not note.endswith("."):
        note += "."
    return f" {note}" if note else ""


def main() -> None:
    raw = json.loads(RAW.read_text(encoding="utf-8"))
    lists = json.loads(LISTS.read_text(encoding="utf-8"))["treaties"]
    treaties = {treaty["treaty_key"]: treaty for treaty in raw["treaties"]}
    parts: dict[str, set[str]] = {}
    for path in (ROOT / "content/tribes").glob("*/*.yaml"):
        record = yaml.safe_load(path.read_text(encoding="utf-8"))
        if record.get("part_of"):
            parts.setdefault(record["part_of"], set()).add(record["id"])
    report = {"corroborated": [], "confirmed_by_text": [], "removed": [], "kept_low": []}
    changes: dict[str, list[tuple[str, str, dict | None]]] = {}
    for link in raw["links"]:
        if not is_low(link):
            continue
        treaty_key, nation = link["treaty_key"], link["roster_id"]
        listed = set(lists[treaty_key]["successor_roster_ids"])
        under_review = "Under review" in lists[treaty_key]["successor_list"]
        base = "The nation is one successor of the party the treaty names. Linked to the nation by Claude (AI assistant) from the treaty's text."
        row = {"treaty": treaty_key, "nation": nation, "signatory": link["signatory_name_in_treaty"]}
        if (treaty_key, nation) in REJECTED:
            outcome, reason = "removed", REJECTED[(treaty_key, nation)]
            update = None
        elif (treaty_key, nation) in TEXT_CONFIRMED:
            outcome, reason = "confirmed_by_text", TEXT_CONFIRMED[(treaty_key, nation)]
            update = {"confidence": "medium", "note": f"{base} Checked on Nov. 23, 2026: {reason}{agent_note(link)}{ENDING}"}
        elif nation in listed or parts.get(nation, set()) & listed:
            outcome = "corroborated"
            via = "names the nation" if nation in listed else "names the nation's constituent bands"
            reason = f"The Oklahoma State University Tribal Treaties Database's successor list for this treaty {via}; the list is in the page's source but is no longer displayed while the database reviews it."
            update = {"confidence": "medium", "note": f"{base} Checked on Nov. 23, 2026: {reason}{agent_note(link)}{ENDING}"}
        else:
            outcome = "kept_low"
            reason = ("The Oklahoma State University Tribal Treaties Database's successor list for this treaty reads \"Under review\", so no second source names the successor." if under_review
                      else "The Oklahoma State University Tribal Treaties Database's successor list for this treaty (no longer displayed) does not name the nation, so no second source names it; the relation rests on the treaty's text and the history of the nation's people.")
            update = {"confidence": "low", "note": f"{base} Checked on Nov. 23, 2026: {reason}{agent_note(link)}{ENDING}"}
        row["reason"] = reason
        report[outcome].append(row)
        changes.setdefault(nation, []).append((treaties[treaty_key]["title"], link["signatory_name_in_treaty"], update))
    edited = 0
    for nation, items in sorted(changes.items()):
        path = profile_path(nation)
        text = path.read_text(encoding="utf-8")
        record = yaml.safe_load(text)
        facts = record.get("treaties") or []
        kept = []
        for fact in facts:
            match = next((update for title, signatory, update in items if fact["title"] == title and fact.get("signatory") == signatory), "untouched")
            if match is None:
                continue
            if match != "untouched":
                fact = {**fact, **match}
            kept.append(fact)
        if kept == facts:
            continue
        if not kept:
            raise SystemExit(f"{nation}: every treaty link removed; add a search-log entry by hand")
        new_text = set_object(text, "treaties", kept)
        expected = {**record, "treaties": kept}
        if yaml.safe_load(new_text) != expected:
            raise SystemExit(f"{path}: written text does not match the intended record")
        path.write_text(new_text, encoding="utf-8")
        edited += 1
    REPORT.write_text(json.dumps({"generated": "2026-11-23", "checked": sum(len(rows) for rows in report.values()),
                                  "counts": {key: len(rows) for key, rows in report.items()}, **report},
                                 indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print({key: len(rows) for key, rows in report.items()}, "profiles edited:", edited)


if __name__ == "__main__":
    main()
