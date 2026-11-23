#!/usr/bin/env python3
"""Turn the Indian Health Service research (research/raw/2026-11-23/
indian-health-service-areas.json) into a batch for apply.py and write its
source records.

Each nation gets up to three facts, one per source: the Area (from the
Area's own list of Tribes), the service unit or health program (from a
service unit page, facility table or Alaska Area profile), and who runs the
nation's health services (the Direct Service Tribes list, or a page that marks
a program as Tribal). The Area is repeated in each fact so each stands alone.

ihs.gov sends its certificate without the intermediate; to save the private
copies, run with CURL_CA_BUNDLE pointing at a bundle that adds the issuer
certificate (from the certificate's own AIA address). Verification stays on.

Usage: python3 scripts/jurisdiction/build_indian_health_service.py > research/jurisdiction/indian-health-service.json
"""
import json
import re

from sources import ROOT, SESSION, write_source

RAW = ROOT / "research/raw/2026-11-23/indian-health-service-areas.json"
BY = "Claude (AI assistant)"
OPERATORS = {"tribally operated": "tribal", "IHS direct": "indian-health-service"}
CONFIDENCE = {"high": "high", "medium": "medium", "low": "low"}
WORDS = [("ihs-", "indian-health-service-"), ("-okc-", "-oklahoma-city-"), ("-prc-", "-purchased-referred-care-"),
         ("fy2022", "fiscal-year-2022"), ("-chs-", "-contract-health-service-"), ("-mt-", "-mount-"),
         ("wwkmhcc", "woodrow-wilson-keeble-memorial-health-care-center"), ("covid19", "covid-19")]


def key_for(suggestion: str) -> str:
    key = suggestion
    for short, long in WORDS:
        key = key.replace(short, long)
    return key


def clean_note(note: str) -> str:
    note = (note or "").replace("Area from IHS list heading/page.", "").strip()
    # The operator has a fact of its own, with its own note.
    note = re.sub(r'Operator "[^"]+" is from the Direct Service Tribes list, which says some tribes have a mixed IHS and tribal arrangement\.', "", note)
    note = re.sub(r"\bihs-[a-z0-9-]+", lambda match: key_for(match.group(0)), note)
    note = re.sub(r"\bIHS\b", "Indian Health Service", note)
    return re.sub(r"\s+", " ", note).strip()


def main() -> None:
    raw = json.loads(RAW.read_text(encoding="utf-8"))
    used = set()
    for row in raw["nations"]:
        for field in ("source_key", "service_unit_source_key", "operator_source_key"):
            if row.get(field) and row.get("ihs_area"):
                used.add(row[field])
    for source in raw["sources"]:
        if source["key_suggestion"] not in used:
            continue
        url = source["url"]
        pdf = url.lower().endswith(".pdf")
        notes = f"{source['title']}. As of: {source.get('as_of') or 'undated'}. {source.get('how_read', '')}".strip()
        notes = re.sub(r"\bIHS\b", "Indian Health Service", notes)
        write_source(key_for(source["key_suggestion"]), "report" if pdf else "web-page",
                     re.sub(r"\bIHS\b", "Indian Health Service", source["title"]),
                     "U.S. Department of Health and Human Services, Indian Health Service", url, None, "us-government-work",
                     notes, suffix=".pdf" if pdf else ".html", citation_type="report" if pdf else "webpage")
    batch = {"session": SESSION, "facts": [], "searches": []}
    for row in raw["nations"]:
        nation, area = row["roster_id"], row["ihs_area"]
        if not area:
            batch["searches"].append({"profile": nation, "topic": "federal-ties", "status": "partly-searched", "entry": {
                "date": "2026-11-23", "searched_by": BY, "method": "ai-review", "place_kind": "federal-list",
                "address": "https://www.ihs.gov/", "query": "The nation's name on each Indian Health Service Area list, the Direct Service and Self-Governance Tribes lists and the Purchased/Referred Care Delivery Area list (Jan. 11, 2024)",
                "outcome": "not-found", "reason": clean_note(row["note"])}})
            continue
        confidence = CONFIDENCE[row["match_confidence"]]
        operator = OPERATORS.get(row.get("operator") or "")
        operator_source = row.get("operator_source_key")
        unit_source = row.get("service_unit_source_key")
        area_fact = {"area": area, "source": key_for(row["source_key"]), "confidence": confidence, "verification": "read-in-full",
                     "as_of": "2026-11-23", "locator": row["locator"]}
        note = clean_note(row["note"])
        listed = f"Listed as \"{row['name_as_listed']}\"." if row.get("name_as_listed") else ""
        area_fact["note"] = " ".join(part for part in (listed, note) if part)
        facts = [area_fact]
        if row.get("service_unit") and unit_source:
            unit = {"area": area, "service_unit": row["service_unit"], "source": key_for(unit_source),
                    "confidence": CONFIDENCE.get(row.get("service_unit_confidence") or row["match_confidence"], "medium"),
                    "verification": "read-in-full", "as_of": "2026-11-23", "locator": row.get("service_unit_locator") or "page text",
                    "note": f"The source's words: \"{row['service_unit_quote']}\"."}
            if operator and (not operator_source or operator_source == unit_source):
                unit["operator"] = operator
            facts.append(unit)
        if operator and operator_source and operator_source != unit_source:
            facts.append({"area": area, "operator": operator, "source": key_for(operator_source), "confidence": confidence,
                          "verification": "read-in-full", "as_of": "2026-11-23", "locator": row.get("operator_locator") or "list of Tribes",
                          "note": f"Listed as \"{row.get('operator_quote')}\"." + (" The Direct Service Tribes list says some Tribes have a mixed Indian Health Service and Tribal arrangement." if operator == "indian-health-service" else "")})
        elif operator and not operator_source and not (row.get("service_unit") and unit_source):
            area_fact["operator"] = operator
        for fact in facts:
            batch["facts"].append({"profile": nation, "key": "indian_health_service", "fact": fact})
        batch["searches"].append({"profile": nation, "topic": "federal-ties", "status": "found", "entry": {
            "date": "2026-11-23", "searched_by": BY, "method": "ai-review", "place_kind": "federal-list",
            "address": next(source["url"] for source in raw["sources"] if source["key_suggestion"] == row["source_key"]),
            "query": "Indian Health Service Area, service unit and operator", "outcome": "found",
            "reason": f"{area} Area" + (f"; {row['service_unit']}" if row.get("service_unit") and unit_source else "") + ".",
            "records": [f"research/raw/2026-11-23/indian-health-service-areas.json#{nation}"]}})
    print(json.dumps(batch, indent=1, ensure_ascii=False))


if __name__ == "__main__":
    main()
