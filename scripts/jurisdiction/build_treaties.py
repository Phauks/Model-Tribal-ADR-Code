#!/usr/bin/env python3
"""Turn the treaty research (research/raw/2026-11-23/treaties.json) into a
batch for apply.py.

The treaties are the ratified ones in Kappler's volume 2 (1778-1868), as the
Oklahoma State University Tribal Treaties Database reproduces them; each fact
cites Kappler (kappler-indian-affairs-laws-and-treaties-vol-2-1904) at its
first page and links the database's page for the text. The database no
longer tags modern successor nations, so every link from a historic
signatory to a modern nation was drawn by an AI research assistant:

- the nation's official name carries the signatory's name: medium confidence;
- a band-level or one-of-several-successors relation: low confidence, or
  medium where the assistant rated it high.

Both are `verification: inferred` and say so in their note, so a reader and a
later review can tell them from a sourced relation.

Usage: python3 scripts/jurisdiction/build_treaties.py > research/jurisdiction/treaties.json
"""
import json

import yaml

from sources import ROOT, SESSION

RAW = ROOT / "research/raw/2026-11-23/treaties.json"
KAPPLER = "kappler-indian-affairs-laws-and-treaties-vol-2-1904"
BY = "Claude (AI assistant)"


def main() -> None:
    raw = json.loads(RAW.read_text(encoding="utf-8"))
    treaties = {treaty["treaty_key"]: treaty for treaty in raw["treaties"]}
    batch = {"session": SESSION, "facts": [], "searches": []}
    linked: dict[str, list[str]] = {}
    for link in raw["links"]:
        treaty = treaties[link["treaty_key"]]
        named = link["basis"].startswith("successor named")
        confidence = "medium" if named or link["confidence"] == "high" else "low"
        how = ("The nation's official name carries the name the treaty gives this party." if named
               else "The nation is one successor of the party the treaty names; band-level attribution was not determined.")
        fact = {"title": treaty["title"], "signed": treaty["date_signed"]}
        if treaty.get("statutes_at_large"):
            fact["statutes_at_large"] = treaty["statutes_at_large"]
        kappler = {"volume": treaty.get("kappler_volume") or 2}
        if treaty.get("kappler_page"):
            kappler["page"] = treaty["kappler_page"]
        kappler["link"] = treaty["osu_url"]
        fact["kappler"] = kappler
        fact["signatory"] = link["signatory_name_in_treaty"]
        fact.update({"source": KAPPLER, "confidence": confidence, "verification": "inferred",
                     "locator": (f"p. {treaty['kappler_page']}" if treaty.get("kappler_page") else "page not determined") + f" ({treaty['title']}; Kappler header \"{treaty.get('kappler_header', '')}\")",
                     "note": (how + " Linked to the nation by Claude (AI assistant) from the treaty's text and the nation's name, not from a source that names the successor; not yet checked against a second source." + (f" {link['note']}" if link.get("note") else "") + " The page is the treaty's first page as the Oklahoma State University database's address gives it.").strip()})
        batch["facts"].append({"profile": link["roster_id"], "key": "treaties", "fact": fact})
        linked.setdefault(link["roster_id"], []).append(treaty["title"])
    for nation, titles in sorted(linked.items()):
        batch["searches"].append({"profile": nation, "topic": "federal-ties", "status": "found", "entry": {
            "date": "2026-11-23", "searched_by": BY, "method": "ai-review", "place_kind": "treaty-database",
            "address": "https://treaties.okstate.edu/treaties/", "query": "Ratified treaties (Kappler vol. 2) whose signatories the nation descends from",
            "outcome": "found", "reason": f"{len(titles)} ratified treaties linked.",
            "records": [f"research/raw/2026-11-23/treaties.json#{nation}"]}})
    reasons = {
        "alaska": "No treaties: the United States made no treaties with Alaska Native villages; their claims were settled by statute (Alaska Native Claims Settlement Act, 1971).",
        "california_only": "No ratified treaty: the 18 treaties negotiated with California tribes in 1851-52 were never ratified (the Senate rejected them in secret session in 1852).",
        "other_ids": "No ratified treaty linked: the nation's only treaties were unratified or colonial, or no successor relation to a ratified treaty's signatory could be shown from the treaty and the nation's name.",
    }
    groups = {"other_ids": raw["nations_without_links"]["other_ids"], "alaska": [], "california_only": []}
    for path in sorted((ROOT / "content/tribes").glob("*/*.yaml")):
        record = yaml.safe_load(path.read_text(encoding="utf-8"))
        if not any(fact.get("type") == "federal" for fact in record.get("recognition") or []):
            continue
        states = {fact["state"] for fact in record.get("states") or []}
        if states == {"AK"}:
            groups["alaska"].append(record["id"])
        elif states == {"CA"}:
            groups["california_only"].append(record["id"])
    for group, nations in groups.items():
        for nation in nations:
            if nation in linked:
                continue
            batch["searches"].append({"profile": nation, "topic": "federal-ties", "status": "none-found" if group != "other_ids" else "partly-searched", "entry": {
                "date": "2026-11-23", "searched_by": BY, "method": "ai-review", "place_kind": "treaty-database",
                "address": "https://treaties.okstate.edu/treaties/", "query": "Ratified treaties (Kappler vol. 2) whose signatories the nation descends from",
                "outcome": "not-found", "reason": reasons[group]}})
    print(json.dumps(batch, indent=1, ensure_ascii=False))


if __name__ == "__main__":
    main()
