#!/usr/bin/env python3
"""Turn the state jurisdiction research (research/raw/2026-11-23/
state-jurisdiction.json) into a batch for apply.py and write its sources.

The research read the statutes, session laws and opinions behind the
optional Public Law 280 states (Arizona, Montana, Nevada, North Dakota,
South Dakota) and the other federal laws that give a state jurisdiction
(the Kansas Act, New York, the Maine, Rhode Island, Connecticut,
Massachusetts, Catawba, Texas, Seminole and Utah Paiute acts, and the repeal
of Iowa's 1948 act). General rules that name no nation are left out, and so
are the Nevada retrocession facts the profiles already hold.

Usage: python3 scripts/jurisdiction/build_state_jurisdiction.py > research/jurisdiction/state-jurisdiction.json
"""
import json
import re

from sources import ROOT, SESSION, write_source

RAW = ROOT / "research/raw/2026-11-23/state-jurisdiction.json"
BY = "Claude (AI assistant)"

KEYS = {
    "usc-25-232": "us-code-title-25-section-232", "usc-25-233": "us-code-title-25-section-233",
    "usc-18-3243": "us-code-title-18-section-3243", "usc-25-1322": "usc-25-1322",
    "pl-104-208-s330": "public-law-104-208-section-330", "pl-97-429": "texas-band-of-kickapoo-act-1983",
    "s-rept-116-130": "senate-report-116-130",
    "nd-leg-council-memo-2004": "north-dakota-legislative-council-indian-jurisdictional-issues-2004",
    "wold-1": "three-affiliated-tribes-v-wold-engineering-1984", "wold-2": "three-affiliated-tribes-v-wold-engineering-1986",
    "rosebud-8cir": "rosebud-sioux-tribe-v-south-dakota-1990", "hankins-sd": "in-re-hankins-petition-1964",
    "francisco-az": "francisco-v-state-1976", "davis-nev": "davis-v-warden-1972",
    "kennerly": "kennerly-v-district-court-of-montana-1971", "us-v-john": "united-states-v-john-1978",
    "narragansett-1cir": "rhode-island-v-narragansett-indian-tribe-1994",
    "fr-81-7209": "federal-register-2016-arizona-air-plan-rescissions", "nrs-41-430": "nevada-revised-statutes-41-430",
    "nev-stat-1955-198": "nevada-statutes-1955-chapter-198", "nev-stat-1973-601": "nevada-statutes-1973-chapter-601",
    "fr-40-27501": "federal-register-1975-nevada-retrocession", "fr-53-5837": "federal-register-1988-ely-retrocession",
    "aiprc-1976": "american-indian-policy-review-commission-task-force-four-1976",
    "mca-2-1-301-302": "montana-code-annotated-2-1-301",
    "mt-lsd-pl280-2024": "montana-legislative-services-division-public-law-280-2024",
    "me-30-6204": "maine-revised-statutes-title-30-section-6204", "me-30-7208": "maine-revised-statutes-title-30-section-7208",
    "sc-code-27-16-40": "south-carolina-code-27-16-40", "tcc-goldberg-2010": "goldberg-2010-tribal-jurisdictional-status-analysis",
}
FEDERAL_CASES = {"wold-1", "wold-2", "rosebud-8cir", "kennerly", "us-v-john", "narragansett-1cir"}
STATE_LAW = ("sdcl-", "nrs-", "nev-stat-", "mca-", "me-", "sc-code-")


AUTHORS = {
    "wold-1": "Supreme Court of the United States", "wold-2": "Supreme Court of the United States",
    "kennerly": "Supreme Court of the United States", "us-v-john": "Supreme Court of the United States",
    "rosebud-8cir": "United States Court of Appeals for the Eighth Circuit",
    "narragansett-1cir": "United States Court of Appeals for the First Circuit",
    "hankins-sd": "Supreme Court of South Dakota", "francisco-az": "Supreme Court of Arizona", "davis-nev": "Supreme Court of Nevada",
    "fr-81-7209": "Environmental Protection Agency", "s-rept-116-130": "United States Senate, Committee on Indian Affairs",
    "nd-leg-council-memo-2004": "North Dakota Legislative Council", "aiprc-1976": "American Indian Policy Review Commission",
    "mt-lsd-pl280-2024": "Montana Legislative Services Division", "tcc-goldberg-2010": "Carole Goldberg (Tribal Court Clearinghouse)",
}
PREFIX_AUTHORS = (("sdcl-", "South Dakota Legislature"), ("nrs-", "Nevada Legislature"), ("nev-stat-", "Nevada Legislature"),
                  ("mca-", "Montana Legislature"), ("me-", "Maine Legislature"), ("sc-code-", "South Carolina General Assembly"),
                  ("fr-", "Department of the Interior, Bureau of Indian Affairs"))


def author_for(suggestion: str) -> str:
    if suggestion in AUTHORS:
        return AUTHORS[suggestion]
    for prefix, author in PREFIX_AUTHORS:
        if suggestion.startswith(prefix):
            return author
    return "United States Congress"


def key_for(suggestion: str) -> str:
    if suggestion in KEYS:
        return KEYS[suggestion]
    if suggestion.startswith("stat-"):
        return "statutes-at-large-" + suggestion[5:]
    if suggestion.startswith("pl-"):
        return "public-law-" + suggestion[3:]
    if suggestion.startswith("sdcl-"):
        return "south-dakota-codified-laws-" + suggestion[5:]
    raise SystemExit(f"no key for {suggestion}")


def third_person(text: str) -> str:
    """The research notes speak as "I"; the records speak of the research."""
    text = re.sub(r"\bthat I found\b", "that the research found", text)
    text = re.sub(r"\bI follow\b", "the research follows", text)
    text = re.sub(r"\bI have\b", "the research has", text)
    text = re.sub(r"\bI (did|could|have|found|read|followed|checked|confirmed)\b", r"the research \1", text)
    text = re.sub(r"\bI\b", "the research", text)
    text = re.sub(r"(^|[.!?]\s+)the research", lambda match: match.group(1) + "The research", text)
    return text.replace("you already read", "already recorded").replace("Already recorded by you", "Already recorded").replace("your list", "the research brief")


def write_sources(raw: dict, used: set) -> None:
    for source in raw["sources"]:
        suggestion = source["key_suggestion"]
        if suggestion not in used:
            continue
        key = key_for(suggestion)
        kind = source["kind"]
        if kind == "court-opinion":
            kind, citation_type = ("federal-case" if suggestion in FEDERAL_CASES else "state-case"), "legal_case"
        elif kind in ("session-law", "federal-statute", "state-statute"):
            kind, citation_type = ("state-statute" if suggestion.startswith(STATE_LAW) else "federal-statute"), "legislation"
        elif kind == "federal-register-notice":
            citation_type = "legislation"
        else:
            kind, citation_type = ("report" if source["url"].lower().endswith(".pdf") else "web-page"), "report"
        federal = suggestion.startswith(("usc-", "stat-", "pl-", "fr-", "s-rept-", "aiprc-")) or suggestion in FEDERAL_CASES
        rights = "us-government-work" if federal else "government-edict" if kind in ("state-statute", "state-case") else "fact-only"
        title = source["indigo_citation"]
        notes = third_person(f"Indigo Book citation: {source['indigo_citation']}. Status: {source['status']}. {source.get('how_read', '')}")
        suffix = ".pdf" if ".pdf" in source["url"].lower() else ".html"
        write_source(key, kind, title, author_for(suggestion), source["url"], None, rights, notes,
                     suffix=suffix, citation_type=citation_type)


def main() -> None:
    raw = json.loads(RAW.read_text(encoding="utf-8"))
    batch = {"session": SESSION, "facts": [], "searches": []}
    used = set()
    for fact in raw["facts"]:
        if not fact["roster_ids"]:
            continue
        if fact["state"] == "NV" and fact["value"] == "retroceded":
            continue
        primary = fact["source_keys"][0]
        used.update(fact["source_keys"])
        others = [key_for(key) for key in fact["source_keys"][1:]]
        detail = third_person(fact["detail"])
        note = third_person(fact.get("note") or "")
        if others:
            note = (note + " Also cites: " + ", ".join(others) + ".").strip()
        for nation in fact["roster_ids"]:
            entry = {"topic": fact["topic"], "value": fact["value"], "detail": detail, "source": key_for(primary),
                     "confidence": fact["confidence"], "verification": "read-in-full" if fact["confidence"] != "low" else "inferred",
                     "locator": fact["locator"]}
            if note:
                entry["note"] = note
            batch["facts"].append({"profile": nation, "key": "jurisdiction", "fact": entry})
    write_sources(raw, used)
    by_nation: dict[str, list[str]] = {}
    for entry in batch["facts"]:
        by_nation.setdefault(entry["profile"], []).append(entry["fact"]["value"])
    for nation, values in sorted(by_nation.items()):
        batch["searches"].append({"profile": nation, "topic": "jurisdiction", "status": "found", "entry": {
            "date": "2026-11-23", "searched_by": BY, "method": "ai-review", "place_kind": "statutes-and-cases",
            "address": "research/raw/2026-11-23/state-jurisdiction.json",
            "query": "State jurisdiction under optional Public Law 280 statutes and other federal laws (session laws, codes, Federal Register notices, opinions)",
            "outcome": "found", "reason": f"{len(values)} facts recorded: " + ", ".join(sorted(set(values))) + "."}})
    print(json.dumps(batch, indent=1, ensure_ascii=False))


if __name__ == "__main__":
    main()
