#!/usr/bin/env python3
"""Turn the research on jurisdiction agreements
(research/raw/2026-11-23/jurisdiction-agreements.json) into source records
and a batch for apply.py.

Each fact is one agreement between the nation and a state, county, city or
federal agency, from one source: cross-deputization and law-enforcement
agreements, tax agreements other than gaming compacts, and child welfare
agreements (`jurisdiction_agreements`).

Sources that only authorize agreements without saying which nations signed
(Washington's cigarette tax statutes, New Mexico's list of nations eligible
for tax-sharing agreements) are not recorded as facts; each nation they name
gets a search-log entry with the lead instead.

Usage: python3 scripts/jurisdiction/build_agreements.py > research/jurisdiction/jurisdiction-agreements.json
"""
import json

from sources import ROOT, SESSION, write_source

RAW = ROOT / "research/raw/2026-11-23/jurisdiction-agreements.json"
BY = "Claude (AI assistant)"

LEADS_ONLY = {
    "revised-code-of-washington-43-06-460-cigarette-tax-contracts",
    "revised-code-of-washington-43-06-465-puyallup-cigarette-tax-agreement",
    "revised-code-of-washington-43-06-466-yakama-cigarette-tax-agreement",
    "new-mexico-taxation-and-revenue-department-tax-sharing-agreements",
}
TITLE_IV_E_SURVEY = "association-on-american-indian-affairs-survey-and-analysis-of-title-iv-e-tribal-state-agreements-2014"
KINDS = {"cross-deputization": "cross-deputization", "tax-agreement": "tax-agreement",
         "child-welfare-agreement": "child-welfare-agreement", "other-jurisdiction-agreement": "other"}
# Source kinds as the research named them, and the citation type each takes.
SOURCE_KINDS = {"intergovernmental-agreement": ("intergovernmental-agreement", "document"), "web-page": ("web-page", "webpage"),
                "state-statute": ("state-statute", "legislation"), "report": ("report", "report")}
# Lists read row by row rather than the agreement itself.
LISTS = {"web-page"}


def write_sources(raw: dict, used: set[str]) -> dict[str, str]:
    kinds = {}
    for source in raw["sources"]:
        key = source["key_suggestion"]
        kind, citation_type = SOURCE_KINDS[source["kind"]]
        kinds[key] = source["kind"]
        if key not in used:
            continue
        rights = "government-edict" if kind == "state-statute" else "fact-only"
        notes = f"Indigo Book citation: {source['indigo_citation']}. {source.get('how_read', '').strip()}".strip()
        issued = [int(part) for part in str(source["date"]).split("-")] if source.get("date") else None
        suffix = ".pdf" if ".pdf" in source["url"].lower() else ".html"
        write_source(key, kind, source["title"], source.get("author") or "Unknown", source["url"], issued, rights, notes,
                     suffix=suffix, citation_type=citation_type)
    return kinds


def main() -> None:
    raw = json.loads(RAW.read_text(encoding="utf-8"))
    used = {fact["source_key"] for fact in raw["facts"] if fact["source_key"] not in LEADS_ONLY}
    kinds = write_sources(raw, used)
    batch = {"session": SESSION, "facts": [], "searches": []}
    found: dict[str, int] = {}
    leads: dict[str, list[str]] = {}
    for fact in raw["facts"]:
        for nation in fact["roster_ids"]:
            if fact["source_key"] in LEADS_ONLY:
                leads.setdefault(nation, []).append(f"{fact['agreement']} ({fact['source_key']})")
                continue
            status = fact["status"]
            note = f"The source reads: “{fact['quote'].strip()}”."
            if fact.get("note"):
                note += " " + fact["note"].strip()
            if fact["source_key"] == TITLE_IV_E_SURVEY and fact["state"] == "OK" and status == "expired":
                status = "unknown"
                note += " Most Oklahoma agreements in the survey lapsed on June 30, 2013, and some were renewed; the survey does not settle which, so the status is left unknown."
            entry = {"kind": KINDS[fact["topic"]], "other_party": fact["other_party"]}
            if fact.get("agreement"):
                entry["agreement"] = fact["agreement"]
            if fact.get("state"):
                entry["state"] = fact["state"]
            if fact.get("date"):
                entry["date"] = str(fact["date"])
            entry["status"] = status
            entry.update({"source": fact["source_key"], "confidence": fact["confidence"],
                          "verification": "inferred" if fact["confidence"] == "low" else "bulk-import" if kinds[fact["source_key"]] in LISTS else "read-in-full",
                          "locator": fact["locator"], "note": note})
            batch["facts"].append({"profile": nation, "key": "jurisdiction_agreements", "fact": entry})
            found[nation] = found.get(nation, 0) + 1
    for nation, count in sorted(found.items()):
        batch["searches"].append({"profile": nation, "topic": "jurisdiction", "status": "found", "entry": {
            "date": "2026-11-23", "searched_by": BY, "method": "ai-review", "place_kind": "official-list",
            "address": "research/raw/2026-11-23/jurisdiction-agreements.json",
            "query": "Cross-deputization, tax and child welfare agreements with states, counties and cities: state agency lists, the Justice Department's sample agreement library, Title IV-E surveys",
            "outcome": "found", "reason": f"{count} agreement(s) recorded.",
            "records": [f"research/raw/2026-11-23/jurisdiction-agreements.json#{nation}"]}})
    for nation, items in sorted(leads.items()):
        batch["searches"].append({"profile": nation, "topic": "jurisdiction", "status": "partly-searched", "entry": {
            "date": "2026-11-23", "searched_by": BY, "method": "ai-review", "place_kind": "statute",
            "address": "research/raw/2026-11-23/jurisdiction-agreements.json",
            "query": "Tax agreements with the state",
            "outcome": "not-found",
            "reason": "A state source names the nation as one the state may make a tax agreement with, but does not say an agreement was signed: " + "; ".join(items) + "."}})
    for doubt in raw["doubtful"]:
        for nation in doubt["candidate_roster_ids"]:
            batch["searches"].append({"profile": nation, "topic": "jurisdiction", "status": "partly-searched", "entry": {
                "date": "2026-11-23", "searched_by": BY, "method": "ai-review", "place_kind": "report",
                "address": "research/raw/2026-11-23/jurisdiction-agreements.json",
                "query": "Child welfare agreements with the state", "outcome": "not-found",
                "reason": f"Not recorded: {doubt['names_in_source']} ({doubt['source_key']}). {doubt['reason']}"}})
    print(json.dumps(batch, indent=1, ensure_ascii=False))


if __name__ == "__main__":
    main()
