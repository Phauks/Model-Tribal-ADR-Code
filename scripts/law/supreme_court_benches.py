"""Record who decided each Supreme Court case: the Court, the vote and each justice's part.

For every source record of a case in the United States Reports, this script
finds the case in Oyez's public data (api.oyez.org), by volume and first page,
and writes a `supreme_court` block into the record:

    supreme_court:
      court: Warren Court                       # named for the Chief Justice
      short_name: "Williams"                    # the short citation's name, for chart labels
      natural_court: Warren Court (1958-1962)   # the bench as Oyez names it
      decision_type: majority opinion
      vote: {majority: 9, minority: 0}
      justices:
      - {name: Hugo L. Black, vote: majority, opinion: majority}
      ...
      source: https://api.oyez.org/cases/1958/39
      checked: '2026-11-22'

Oyez's facts (who sat, how each voted, who wrote) are facts, recorded with a
link back to Oyez. Where Oyez has no vote data (some nineteenth-century cases
and cases decided since about 2022), the block was filled by hand from the
official report, its source is the report, and a note says what the report
leaves unsettled; --refresh would replace those blocks only if Oyez now has
the votes. The short name is a first guess (the first party's name, or the other
party's when the first is the United States or a state); check it against
the Indigo Book's short-form rule, and a refresh keeps the one recorded.
A record that already has the block is skipped unless
--refresh is given. Run from the repository root:

    python3 scripts/law/supreme_court_benches.py [--refresh] [--key KEY ...]
"""

from __future__ import annotations

import argparse
import datetime
import json
import pathlib
import re
import sys
import time
import urllib.request

import yaml

ROOT = pathlib.Path(__file__).resolve().parents[2]
SOURCES = ROOT / "content" / "sources"
API = "https://api.oyez.org"
CACHE: dict[str, object] = {}


def fetch(url: str) -> object:
    if url in CACHE:
        return CACHE[url]
    for attempt in range(4):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": "research-script"})
            with urllib.request.urlopen(request, timeout=60) as response:
                data = json.load(response)
            CACHE[url] = data
            time.sleep(0.3)
            return data
        except Exception:  # network errors: retry with backoff
            if attempt == 3:
                raise
            time.sleep(2 ** attempt)
    raise RuntimeError(url)


def term_cases(term: int) -> list[dict]:
    data = fetch(f"{API}/cases?filter=term:{term}&per_page=0")
    return data if isinstance(data, list) else []


def simple(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", name.lower().replace("&", "and")).strip()


def find_case(volume: str, page: str, year: int, title: str) -> dict | None:
    terms = (year - 1, year, year - 2, year + 1)
    for term in terms:
        for case in term_cases(term):
            citation = case.get("citation") or {}
            if str(citation.get("volume")) == volume and str(citation.get("page")) == page:
                return case
    # Recent cases may not carry their volume and page in Oyez yet: match the name.
    wanted = simple(title)
    for term in terms:
        for case in term_cases(term):
            if simple(case.get("name") or "") == wanted:
                return case
    return None


def bench(case_url: str) -> dict | None:
    case = fetch(case_url)
    decisions = case.get("decisions") or []
    heard = case.get("heard_by") or case.get("decided_by") or []
    if isinstance(heard, dict):
        heard = [heard]
    heard = [court for court in heard if court]
    if not decisions or not heard:
        return None
    decision = decisions[0]
    natural_court = heard[0].get("name", "").strip()
    justices = []
    for vote in decision.get("votes") or []:
        member = (vote.get("member") or {}).get("name")
        if not member:
            continue
        entry = {"name": member, "vote": vote.get("vote") or "unknown"}
        opinion = vote.get("opinion_type")
        if opinion and opinion != "none":
            entry["opinion"] = opinion
        justices.append(entry)
    block = {
        "court": re.sub(r"\s*\(.*\)\s*$", "", natural_court),
        "natural_court": natural_court,
        "decision_type": decision.get("decision_type") or "unknown",
        "vote": {"majority": decision.get("majority_vote"), "minority": decision.get("minority_vote")},
        "justices": justices,
        "source": case_url,
        "checked": datetime.date.today().isoformat(),
    }
    return block


STATES = {
    "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware", "Florida", "Georgia",
    "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland",
    "Massachusetts", "Michigan", "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire",
    "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon",
    "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota", "Tennessee", "Texas", "Utah", "Vermont",
    "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming", "United States",
}


def short_name(title: str) -> str:
    """A first guess at the case's short name: "United States v. Lara" -> "Lara"; "Ex parte Crow Dog" -> "Crow Dog"."""
    title = re.sub(r"^(?:Ex parte|In re)\s+", "", title)
    parties = [party.strip() for party in title.split(" v. ", 1)]
    name = parties[1] if len(parties) == 2 and parties[0] in STATES else parties[0]
    return re.sub(r",?\s+(?:Inc\.|Co\.|Corp\.)$", "", name)


def block_yaml(block: dict) -> str:
    lines = ["supreme_court:"]
    lines.append(f"  court: {block['court']}")
    lines.append(f"  short_name: {json.dumps(block['short_name'], ensure_ascii=False)}")
    lines.append(f"  natural_court: {block['natural_court']}")
    lines.append(f"  decision_type: {block['decision_type']}")
    vote = block["vote"]
    count = lambda number: "null" if number is None else number
    lines.append(f"  vote: {{majority: {count(vote['majority'])}, minority: {count(vote['minority'])}}}")
    if block["justices"]:
        lines.append("  justices:")
        for justice in block["justices"]:
            parts = [f"name: {json.dumps(justice['name'], ensure_ascii=False)}", f"vote: {justice['vote']}"]
            if "opinion" in justice:
                parts.append(f"opinion: {justice['opinion']}")
            lines.append(f"  - {{{', '.join(parts)}}}")
    lines.append(f"  source: {block['source']}")
    if block.get("note"):
        lines.append(f"  note: {json.dumps(block['note'], ensure_ascii=False)}")
    lines.append(f"  checked: '{block['checked']}'")
    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--refresh", action="store_true", help="replace blocks already recorded")
    parser.add_argument("--key", action="append", help="only these record keys")
    arguments = parser.parse_args()

    found = missing = skipped = 0
    for path in sorted(SOURCES.rglob("*.yaml")):
        text = path.read_text(encoding="utf-8")
        record = yaml.safe_load(text)
        citation = record.get("citation") or {}
        if arguments.key and record.get("key") not in arguments.key:
            continue
        if citation.get("type") != "legal_case" or citation.get("container-title") != "U.S.":
            continue
        if "supreme_court" in record and not arguments.refresh:
            skipped += 1
            continue
        year = ((citation.get("issued") or {}).get("date-parts") or [[0]])[0][0]
        case = find_case(str(citation.get("volume")), str(citation.get("page")), int(year), citation.get("title", ""))
        block = bench(case["href"]) if case else None
        if not block or not block["justices"]:
            missing += 1
            print(f"not found or no votes: {record['key']} ({citation.get('volume')} U.S. {citation.get('page')}, {year})")
            continue
        block["short_name"] = (record.get("supreme_court") or {}).get("short_name") or short_name(citation.get("title", ""))
        text = re.sub(r"(?m)^supreme_court:\n(?:  .*\n)*", "", text)
        text = text.replace("\nrights:\n", "\n" + block_yaml(block) + "rights:\n", 1)
        path.write_text(text, encoding="utf-8")
        found += 1
        print(f"{record['key']}: {block['natural_court']}, {block['vote']['majority']}-{block['vote']['minority']}")
    print(f"recorded {found}, not found {missing}, already recorded {skipped}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
