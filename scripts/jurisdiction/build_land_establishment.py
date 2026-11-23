#!/usr/bin/env python3
"""Turn the research on how each reservation was set aside
(research/raw/2026-11-23/land-establishment.json) into source records and a
batch for apply.py.

Each fact names the land area as the instrument does, the method (treaty,
executive order, act of Congress, agreement or other), the instrument in
short form, its date, and a quotation of the words that set the land aside.
The first instrument for a land area is marked "First set aside"; later
orders that enlarged, divided or replaced it are marked "Later change".

Sources: executive orders and letters as Kappler prints them (vols. 1, 3 and
4), linked to the Oklahoma State University database's copy where it has one
and otherwise to the Internet Archive scan; treaties and acts in the
Statutes at Large on govinfo. A treaty that already has a source record is
reused.

Usage: python3 scripts/jurisdiction/build_land_establishment.py > research/jurisdiction/land-establishment.json
"""
import json
import re

from sources import ROOT, SESSION, capture, write_source

RAW = ROOT / "research/raw/2026-11-23/land-establishment.json"
TREATIES = ROOT / "research/raw/2026-11-23/treaties.json"
BY = "Claude (AI assistant)"

# Treaties that already have a source record, by Statutes at Large citation.
EXISTING_TREATIES = {
    "15 Stat. 667": "treaty-with-the-navaho-1868",
    "15 Stat. 619": "treaty-with-the-ute-1868",
    "15 Stat. 635": "treaty-with-the-sioux-and-arapaho-1868",
}
KINDS = {"executive-order": ("executive-order", "legislation"), "federal-statute": ("federal-statute", "legislation"),
         "treaty": ("intergovernmental-agreement", "treaty"), "other": ("other", "letter")}
ARCHIVE_TEXT = "https://archive.org/download/{0}/{0}_djvu.txt"


def slug(text: str) -> str:
    text = text.lower().replace("’", "").replace("'", "")
    return re.sub(r"[^a-z0-9]+", "-", text).strip("-")


def statute_cite(citation: str) -> str | None:
    found = re.search(r"(\d+) Stat\.,? (\d+)", citation)
    return f"{found.group(1)} Stat. {found.group(2)}" if found else None


def clean_citation(citation: str) -> str:
    """The research repeated the Statutes at Large cite on some treaties."""
    parts = [part.strip() for part in citation.split(",")]
    while len(parts) >= 4 and parts[-1] == parts[-2]:
        parts.pop()
    return ", ".join(parts)


def source_keys(raw: dict) -> dict[str, str]:
    """Map each suggested key to the key the record is filed under."""
    treaties = json.loads(TREATIES.read_text(encoding="utf-8"))["treaties"]
    by_cite = {treaty["statutes_at_large"]: treaty["title"] for treaty in treaties if treaty.get("statutes_at_large")}
    keys = {}
    for source in raw["sources"]:
        suggestion = source["key_suggestion"]
        if source["kind"] == "treaty":
            cite = statute_cite(source["indigo_citation"])
            keys[suggestion] = EXISTING_TREATIES.get(cite) or (slug(by_cite[cite]) if cite in by_cite else suggestion)
        else:
            keys[suggestion] = suggestion
    return keys


def write_sources(raw: dict, keys: dict[str, str]) -> None:
    archive_copies: dict[str, str] = {}
    for source in raw["sources"]:
        key = keys[source["key_suggestion"]]
        kind, citation_type = KINDS[source["kind"]]
        citation = clean_citation(source["indigo_citation"])
        url = source["url"]
        notes = f"Indigo Book citation: {citation}. {source.get('how_read', '').strip()}".strip()
        issued = [int(part) for part in source["date"].split("-")] if source.get("date") else None
        if "archive.org/details/" in url:
            # Many orders share one scan of Kappler: keep one private copy of its text.
            identifier = url.split("/details/")[1].strip("/")
            if identifier not in archive_copies:
                copy = capture(f"kappler-scan-{identifier}", ARCHIVE_TEXT.format(identifier), ".txt")
                archive_copies[identifier] = copy or ""
            copy = archive_copies[identifier]
            notes += f" Private copy of the scan's text: {copy}." if copy else " No private copy saved (download refused)."
            write_source(key, kind, source["title"], "United States", url, issued, "us-government-work", notes,
                         citation_type=citation_type, save_copy=False)
            continue
        suffix = ".pdf" if "govinfo.gov" in url else ".html"
        write_source(key, kind, source["title"], "United States", url, issued, "us-government-work", notes,
                     suffix=suffix, citation_type=citation_type)


def clean_note(text: str) -> str:
    """Drop pointers to neighbouring entries in the research file."""
    text = text.replace(" (see next entry)", "").replace(" (next entry)", "")
    return text.replace("Treat as the original set-aside, subject to the caveat that the legal form is a Commissioner's reservation.",
                        "It is recorded as the original set-aside, though its legal form is a Commissioner's reservation.")


def main() -> None:
    raw = json.loads(RAW.read_text(encoding="utf-8"))
    keys = source_keys(raw)
    write_sources(raw, keys)
    batch = {"session": SESSION, "facts": [], "searches": []}
    found: dict[str, list[str]] = {}
    for fact in sorted(raw["facts"], key=lambda item: (item["roster_id"], item["date"], not item["original"])):
        quote = fact["quote"].strip()
        note = f"The instrument reads: “{quote}”."
        if fact.get("note"):
            note += " " + clean_note(fact["note"].strip())
        entry = {"land_area": fact["land_area"], "method": fact["method"], "instrument": fact["instrument"],
                 "date": fact["date"], "detail": "First set aside" if fact["original"] else "Later change",
                 "source": keys[fact["source_key"]], "confidence": fact["confidence"],
                 "verification": "read-in-full" if fact["confidence"] != "low" else "inferred",
                 "locator": fact["locator"], "note": note}
        batch["facts"].append({"profile": fact["roster_id"], "key": "land_establishment", "fact": entry})
        found.setdefault(fact["roster_id"], []).append(fact["instrument"])
    for nation, instruments in sorted(found.items()):
        batch["searches"].append({"profile": nation, "topic": "federal-ties", "status": "found", "entry": {
            "date": "2026-11-23", "searched_by": BY, "method": "ai-review", "place_kind": "official-compilation",
            "address": "https://archive.org/details/bp_996062",
            "query": "How the nation's reservation was set aside: Kappler vols. 1, 3 and 4 (executive orders), Statutes at Large (treaties and acts)",
            "outcome": "found", "reason": f"{len(instruments)} instrument(s) recorded.",
            "records": [f"research/raw/2026-11-23/land-establishment.json#{nation}"]}})
    for doubt in raw["doubtful"]:
        for nation in doubt["roster_ids"]:
            if nation in found:
                continue
            batch["searches"].append({"profile": nation, "topic": "federal-ties", "status": "partly-searched", "entry": {
                "date": "2026-11-23", "searched_by": BY, "method": "ai-review", "place_kind": "official-compilation",
                "address": "https://archive.org/details/bp_996062",
                "query": "How the nation's reservation was set aside", "outcome": "not-found",
                "reason": f"Candidate: {doubt['candidate']}. Not entered: {doubt['reason']}"}})
    print(json.dumps(batch, indent=1, ensure_ascii=False))


if __name__ == "__main__":
    main()
