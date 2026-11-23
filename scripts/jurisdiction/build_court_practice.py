#!/usr/bin/env python3
"""Turn the research on using each nation's courts
(research/raw/2026-11-23/court-practice.json) into source records and a batch
for apply.py.

Each fact is one page or document from a court's or nation's own site:
admission to practice, court rules, filing fees, court forms, a public
defender or legal aid (`court_practice`). A fact whose link was seen in a
menu or document list but not opened is marked title-only; a low-confidence
fact is marked inferred. A page that already has a source record is cited
under that record's key. Courts whose sites were blocked or had nothing
useful get a search-log entry under the topic court-practice.

Usage: python3 scripts/jurisdiction/build_court_practice.py > research/jurisdiction/court-practice.json
"""
import json
import re
import sys

import yaml

from sources import ROOT, SESSION, write_source

sys.path.insert(0, str(ROOT / "scripts"))
from record_facts import source_links  # noqa: E402

RAW = ROOT / "research/raw/2026-11-23/court-practice.json"
BY = "Claude (AI assistant)"
TOPIC = "court-practice"
QUERY = "Admission to practice, court rules, filing fees, court forms, public defender and legal aid on the court's or nation's site"


def suffix_of(url: str) -> str:
    path = url.lower().split("?")[0]
    for ending in (".pdf", ".docx", ".doc"):
        if path.endswith(ending):
            return ending
    return ".html"


def existing_keys(raw: dict) -> dict[str, str]:
    """Keys of source records already in the project that have the same address as a research source."""
    suggested = {source["key_suggestion"] for source in raw["sources"]}
    by_link = {}
    for path in sorted((ROOT / "content/sources").glob("*/*.yaml")):
        record = yaml.safe_load(path.read_text(encoding="utf-8"))
        if record["key"] in suggested:
            continue
        for link in source_links(record):
            by_link.setdefault(link, record["key"])
    same = {}
    for source in raw["sources"]:
        for link in source_links({"original_link": source["url"]}):
            if link in by_link:
                same[source["key_suggestion"]] = by_link[link]
    return same


def write_sources(raw: dict, used: set[str]) -> None:
    for source in raw["sources"]:
        key = source["key_suggestion"]
        if key not in used:
            continue
        notes = f"Indigo Book citation: {source['indigo_citation']} {source.get('how_read', '').strip()}".strip()
        issued = [int(part) for part in str(source["date"]).split("-")] if source.get("date") else None
        write_source(key, "web-page", source["title"], source.get("author") or "Unknown", source["url"], issued, "fact-only", notes,
                     suffix=suffix_of(source["url"]))


def verification(fact: dict) -> str:
    if fact["confidence"] == "low":
        return "inferred"
    if "not opened" in (fact.get("note") or "").lower():
        return "title-only"
    return "read-in-full"


def failure(reason: str) -> tuple[str, str]:
    """The search outcome and the log status for a court site that gave nothing."""
    text = reason.lower()
    if re.search(r"\b404\b|not found \(|dead", text):
        return "dead-link", "partly-searched"
    if re.search(r"\b403\b|bot|captcha|cloudflare|blocked|forbidden", text):
        return "blocked", "partly-searched"
    if re.search(r"connection|timed? ?out|did not load|no response|frame", text):
        return "error", "partly-searched"
    return "not-found", "none-found"


def main() -> None:
    raw = json.loads(RAW.read_text(encoding="utf-8"))
    same = existing_keys(raw)
    for fact in raw["facts"]:
        fact["source_key"] = same.get(fact["source_key"], fact["source_key"])
    used = {fact["source_key"] for fact in raw["facts"]}
    write_sources(raw, used)
    for key in sorted(set(same.values())):
        write_source(key, "web-page", "", "", "", None, "fact-only", "")
    batch = {"session": SESSION, "facts": [], "searches": []}
    found: dict[str, int] = {}
    for fact in raw["facts"]:
        entry = {"kind": fact["kind"], "title": fact["title"].strip()}
        if fact.get("court"):
            entry["court"] = fact["court"].strip()
        if fact.get("link"):
            entry["link"] = fact["link"]
        if fact.get("detail"):
            entry["detail"] = fact["detail"].strip()
        quote = (fact.get("quote") or "").strip()
        notes = []
        if quote and quote.rstrip(".") != entry["title"].rstrip("."):
            notes.append(f"The source reads: “{quote}”.")
        if fact.get("note"):
            notes.append(fact["note"].strip())
        entry.update({"source": fact["source_key"], "confidence": fact["confidence"], "verification": verification(fact),
                      "locator": fact["locator"]})
        if notes:
            entry["note"] = " ".join(notes)
        batch["facts"].append({"profile": fact["roster_id"], "key": "court_practice", "fact": entry})
        found[fact["roster_id"]] = found.get(fact["roster_id"], 0) + 1
    for nation, count in sorted(found.items()):
        batch["searches"].append({"profile": nation, "topic": TOPIC, "status": "found", "entry": {
            "date": "2026-11-23", "searched_by": BY, "method": "ai-review", "place_kind": "tribal-court-site",
            "address": "research/raw/2026-11-23/court-practice.json", "query": QUERY,
            "outcome": "found", "reason": f"{count} page(s) or document(s) recorded.",
            "records": [f"research/raw/2026-11-23/court-practice.json#{nation}"]}})
    for empty in raw["none_found"]:
        outcome, status = failure(empty["reason"])
        if empty["roster_id"] in found:
            status = "found"
        batch["searches"].append({"profile": empty["roster_id"], "topic": TOPIC, "status": status, "entry": {
            "date": "2026-11-23", "searched_by": BY, "method": "ai-review", "place_kind": "tribal-court-site",
            "address": empty["court_link"], "query": QUERY, "outcome": outcome, "reason": empty["reason"].strip()}})
    print(json.dumps(batch, indent=1, ensure_ascii=False))


if __name__ == "__main__":
    main()
