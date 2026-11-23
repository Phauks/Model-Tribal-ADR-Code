#!/usr/bin/env python3
"""Turn the second search for heritage languages
(research/raw/2026-11-23/languages.json) into source records and a batch for
apply.py.

The search covered nations whose profiles had no language after the
Nov. 21 pass, reading each nation's own site again. Each fact is a language
the nation's own page names as its own (`languages`). Nations the search
checked without finding one get a search-log entry under the topic
languages; nations it did not reach get none.

Usage: python3 scripts/jurisdiction/build_languages.py > research/jurisdiction/languages.json
"""
import json

from sources import ROOT, SESSION, write_source

RAW = ROOT / "research/raw/2026-11-23/languages.json"
BY = "Claude (AI assistant)"
TOPIC = "languages"
QUERY = "The nation's heritage language as its own site names it: language, culture, heritage and department pages"
# Facts left out, with the reason.
SKIP = {("nisqually-indian-tribe", "sEalifucid"): "the page spells the name in a Lushootseed font's ASCII encoding, so the text read is not the language's name"}


def main() -> None:
    raw = json.loads(RAW.read_text(encoding="utf-8"))
    facts = [fact for fact in raw["facts"] if (fact["roster_id"], fact["name"]) not in SKIP]
    used = {fact["source_key"] for fact in facts}
    for source in raw["sources"]:
        if source["key_suggestion"] not in used:
            continue
        notes = f"Indigo Book citation: {source['indigo_citation']} {source.get('how_read', '').strip()}".strip()
        issued = [int(part) for part in str(source["date"]).split("-")] if source.get("date") else None
        write_source(source["key_suggestion"], "web-page", source["title"], source.get("author") or "Unknown", source["url"], issued, "fact-only", notes)
    batch = {"session": SESSION, "facts": [], "searches": []}
    found: dict[str, list[str]] = {}
    for fact in facts:
        entry = {"name": fact["name"]}
        if fact.get("language_tag"):
            entry["language_tag"] = fact["language_tag"]
        note = f"The source reads: “{fact['quote'].strip()}”."
        if fact.get("note"):
            note += " " + fact["note"].strip()
        entry.update({"source": fact["source_key"], "confidence": fact["confidence"],
                      "verification": "read-in-full" if fact["confidence"] == "high" else "inferred",
                      "as_of": "2026-11-23", "locator": fact["locator"], "note": note})
        batch["facts"].append({"profile": fact["roster_id"], "key": "languages", "fact": entry})
        found.setdefault(fact["roster_id"], []).append(fact["name"])
    for nation, names in sorted(found.items()):
        batch["searches"].append({"profile": nation, "topic": TOPIC, "status": "found", "entry": {
            "date": "2026-11-23", "searched_by": BY, "method": "ai-review", "place_kind": "nation-website",
            "address": "research/raw/2026-11-23/languages.json", "query": QUERY,
            "outcome": "found", "reason": "Recorded " + ", ".join(names) + "."}})
    skipped = {nation for nation, _ in SKIP if nation not in found}
    for empty in raw["none_found"] + [{"roster_id": nation, "where": "nation website", "reason": reason} for (nation, _), reason in SKIP.items() if nation in skipped]:
        if empty["reason"].startswith("Not checked"):
            continue
        no_site = empty["reason"] == "no website"
        batch["searches"].append({"profile": empty["roster_id"], "topic": TOPIC, "status": "partly-searched", "entry": {
            "date": "2026-11-23", "searched_by": BY, "method": "ai-review", "place_kind": "nation-website",
            "address": "research/raw/2026-11-23/languages.json", "query": QUERY,
            "outcome": "no-site" if no_site else "not-found",
            "reason": "The profile lists no website for the nation." if no_site else
                      f"Not found: {empty['reason'].strip()} ({empty['where'].strip()}). The Nov. 21 pass had read the home page and up to eight language, culture and history links."}})
    print(json.dumps(batch, indent=1, ensure_ascii=False))


if __name__ == "__main__":
    main()
