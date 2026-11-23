#!/usr/bin/env python3
"""Turn the Violence Against Women Act research (research/raw/2026-11-23/
violence-against-women-act-jurisdiction.json) into a batch for apply.py and
write its source records.

Three kinds of fact, kept apart because they mean different things:
- exercising, from the Tribal Law and Policy Institute's implementation chart
  (rows with the "Implemented VAWA STCJ" box checked), for nations the
  profiles did not yet list;
- exercising, from the Justice Department's first Special Tribal Criminal
  Jurisdiction reimbursement awards (FY 2024), which pay only for exercising
  it;
- implementation-grant, from Tribal Jurisdiction Program grants, which also go
  to nations still planning, so they never count as exercising.

Usage: python3 scripts/jurisdiction/build_violence_against_women_act.py > research/jurisdiction/violence-against-women-act.json
"""
import json
import glob
from pathlib import Path

import yaml

from sources import ROOT, SESSION, write_source

RAW = ROOT / "research/raw/2026-11-23/violence-against-women-act-jurisdiction.json"
TOPIC = "violence-against-women-act-special-tribal-criminal-jurisdiction"
BY = "Claude (AI assistant)"

CHART = "tribal-law-and-policy-institute-special-tribal-criminal-jurisdiction-chart"
REIMBURSED = "office-on-violence-against-women-2024-update-tribal-consultation-recommendations"
GRANTS_2025 = "office-on-violence-against-women-fiscal-year-2025-grant-awards-by-program"
KEYS = {"tlpi-implementing-tribes-chart": CHART, "ovw-2024-update-tribal-consultation": REIMBURSED, "ovw-fy2025-awards-program": GRANTS_2025}


def sources() -> None:
    write_source(CHART, "report", "Special Tribal Criminal Jurisdiction Chart", "Tribal Law and Policy Institute",
                 "https://www.tribalvawa.org/_files/ugd/1af47f_5e7c4fbbc75f4befbab5ea0ae68c760d.pdf", None, "fact-only",
                 "One-page chart of 39 Tribes that have implemented special domestic violence criminal jurisdiction (2013) or special Tribal criminal jurisdiction (2022), linked from the Implementing Tribes page of TribalVAWA.org, which the Tribal Law and Policy Institute runs as a Justice Department technical-assistance provider. Undated; the file was last modified Aug. 11, 2026 and its latest dated entry is 2025. The check marks are not in the text layer and were read from the rendered page.",
                 suffix=".pdf", citation_type="report")
    write_source(REIMBURSED, "report", "2024 Update on the Status of Tribal Consultation Recommendations", "U.S. Department of Justice, Office on Violence Against Women",
                 "https://www.justice.gov/ovw/media/1377361/dl?inline=", [2024, 11], "us-government-work",
                 "States that the first reimbursements went in May 2024 to 14 Tribes for expenses of exercising special Tribal criminal jurisdiction (p. 14); Appendix D (PDF pp. 51-54) lists each award as \"OVW TJ TRP FY 2024\". Also lists Tribal Jurisdiction Program grants, which go to Tribes at any stage, including planning.",
                 suffix=".pdf", citation_type="report")
    write_source(GRANTS_2025, "web-page", "Fiscal Year 2025 OVW Grant Awards by Program", "U.S. Department of Justice, Office on Violence Against Women",
                 "https://www.justice.gov/ovw/awards/fy-2025-ovw-grant-awards-program", [2025], "us-government-work",
                 "Lists the fiscal year 2025 Tribal Jurisdiction Program (special Tribal criminal jurisdiction) grants. A grant can support planning as well as exercising jurisdiction.")


def main() -> None:
    sources()
    raw = json.loads(RAW.read_text(encoding="utf-8"))
    have = set()
    for path in glob.glob(str(ROOT / "content/tribes/*/*.yaml")):
        record = yaml.safe_load(open(path, encoding="utf-8"))
        if any(fact["topic"] == TOPIC and fact["value"] == "exercising" for fact in record.get("jurisdiction") or []):
            have.add(record["id"])
    batch = {"session": SESSION, "facts": [], "searches": []}
    exercising = {row["roster_id"] for row in raw["nations"] if row["source_key"] in ("tlpi-implementing-tribes-chart", "ovw-2024-update-tribal-consultation") and "NOT evidence" not in row["what"]}
    for row in raw["nations"]:
        key = KEYS.get(row["source_key"])
        if not key:
            continue
        nation = row["roster_id"]
        grant_only = "NOT evidence" in row["what"]
        if row["source_key"] == "tlpi-implementing-tribes-chart":
            if nation in have:
                continue
            fact = {"topic": TOPIC, "value": "exercising",
                    "detail": "Listed by the Tribal Law and Policy Institute among the Tribes that have implemented special Tribal criminal jurisdiction under the Violence Against Women Act Reauthorization Act of 2022 (25 U.S.C. § 1304).",
                    "source": key, "confidence": "medium" if row["match_confidence"] == "high" else "low", "verification": "inferred",
                    "as_of": "2026-08-11", "locator": row["locator"] + ", \"Implemented VAWA STCJ\" column",
                    "note": f"Listed as \"{row['name_as_listed']}\". The chart is undated (file last modified Aug. 11, 2026) and comes from a Justice Department technical-assistance provider, not the Department itself."}
        elif row["source_key"] == "ovw-2024-update-tribal-consultation" and not grant_only:
            fact = {"topic": TOPIC, "value": "exercising",
                    "detail": "One of the 14 Tribes that received the Justice Department's first Special Tribal Criminal Jurisdiction reimbursement awards (May 2024), which repay the costs of exercising the jurisdiction.",
                    "source": key, "confidence": "high" if row["match_confidence"] == "high" else "medium", "verification": "read-in-full",
                    "as_of": "2024-11", "locator": "p. 14 and Appendix D, " + row["locator"].split(", row")[0].replace("Appendix D ", ""),
                    "note": f"Listed as \"{row['name_as_listed']}\" with an \"OVW TJ TRP FY 2024\" award. Awards were based on 2023 expenses."}
        elif grant_only and nation not in exercising and nation not in have:
            fiscal = row["as_of"]
            fact = {"topic": TOPIC, "value": "implementation-grant",
                    "detail": f"Received a Justice Department Tribal Jurisdiction Program grant ({fiscal.replace('FY', 'fiscal year ')}) for special Tribal criminal jurisdiction. These grants also fund planning, so the grant alone does not show that the nation exercises the jurisdiction.",
                    "source": key, "confidence": "high" if row["match_confidence"] == "high" else "medium", "verification": "read-in-full",
                    "as_of": fiscal.replace("FY", ""), "locator": row["locator"],
                    "note": f"Listed as \"{row['name_as_listed']}\"."}
        else:
            continue
        batch["facts"].append({"profile": nation, "key": "jurisdiction", "fact": fact})
    seen = set()
    for entry in batch["facts"]:
        nation, source = entry["profile"], entry["fact"]["source"]
        if (nation, source) in seen:
            continue
        seen.add((nation, source))
        address = {CHART: "https://www.tribalvawa.org/implementing-tribes", REIMBURSED: "https://www.justice.gov/ovw/media/1377361/dl?inline=", GRANTS_2025: "https://www.justice.gov/ovw/awards/fy-2025-ovw-grant-awards-program"}[source]
        batch["searches"].append({"profile": nation, "topic": "jurisdiction", "status": "found", "entry": {
            "date": "2026-11-23", "searched_by": BY, "method": "ai-review", "place_kind": "federal-list" if source != CHART else "intertribal-organization",
            "address": address, "query": "Tribes exercising or funded for special Tribal criminal jurisdiction (Violence Against Women Act)",
            "outcome": "found", "reason": entry["fact"]["detail"].split(".")[0] + ".",
            "records": [f"research/raw/2026-11-23/violence-against-women-act-jurisdiction.json#{nation}"]}})
    print(json.dumps(batch, indent=1, ensure_ascii=False))


if __name__ == "__main__":
    main()
