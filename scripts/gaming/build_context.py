"""Merge the compact context research (negotiations, good-faith litigation,
Secretarial Procedures, compact review rules and revenue sharing) into
research/gaming/compact-context.{json,csv} and add source records for the
cases, regulations and Federal Register rules it relies on.

    python3 scripts/gaming/build_context.py CONTEXT_DIRECTORY

CONTEXT_DIRECTORY holds litigation.json, negotiations-a-m.json and
negotiations-n-w.json, written by research assistants and then checked by
check_quotes.py. A fact is `read-in-full` only when its quotation was found
word for word on the cited page; otherwise it is `title-only`, whatever the
assistant reported. Never changes a profile.
"""

import json
import pathlib
import re
import subprocess
import sys
import urllib.parse

import yaml

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
import record_facts  # noqa: E402
from build_catalog import SESSION, TODAY, fr_citation, source_record, write_table  # noqa: E402

OUT = pathlib.Path("research/gaming")
REPORTER = re.compile(r"(\d+) (U\.S\.|F\.[234]d|F\.4th|F\. Supp\. [23]d|F\. Supp\.) (\d+)")
COURTS = {
    "U.S.": "Supreme Court of the United States",
}
EXISTING_CASES = {
    "Seminole Tribe of Florida v. Florida": "seminole-tribe-v-florida-1996",
    "Michigan v. Bay Mills Indian Community": "michigan-v-bay-mills-indian-community",
}
FR_RULE = re.compile(r"/(?:pdf|html)/([0-9A-Z]+-?[0-9]+)\.(?:pdf|htm)$|/documents/\d{4}/\d\d/\d\d/([0-9-]+)/")


def slug(text):
    text = text.lower().replace("&", "and").replace("’", "").replace("'", "")
    return re.sub(r"[^a-z0-9]+", "-", text).strip("-")


def case_key(item):
    if item["title"] in EXISTING_CASES:
        return EXISTING_CASES[item["title"]]
    name = re.sub(r"\s*\(.*?\)", "", item["title"])
    name = re.sub(r"^(The|State of) ", "", name).replace(" et al.", "")
    year = (item.get("decided") or "")[:4]
    return f"{slug(name.replace(' v. ', ' v '))}-{year}".strip("-")


def case_record(item, key):
    reporter = REPORTER.search(item.get("citation") or "")
    citation = {"type": "legal_case", "title": re.sub(r"\s*\(.*?\)", "", item["title"])}
    if reporter:
        citation.update({"container-title": reporter.group(2), "volume": reporter.group(1), "page": reporter.group(3)})
    citation["authority"] = item.get("court") or COURTS.get(reporter.group(2) if reporter else "", "")
    if item.get("docket_number"):
        citation["number"] = item["docket_number"]
    if item.get("decided"):
        citation["issued"] = {"date-parts": [[int(part) for part in item["decided"].split("-")]]}
    citation["URL"] = item["link"]
    citation["accessed"] = {"date-parts": [[2026, 11, 21]]}
    states = item.get("states") or []
    record = {
        "key": key,
        "kind": "state-case" if "Okla" in (item.get("court") or "") and "Supreme" in (item.get("court") or "") else "federal-case",
        "citation": citation,
        "original_link": item["link"],
        "retrieved": TODAY,
        "archives": [],
        "history": {"status": "live", "last_checked": TODAY},
        "rights": {"status": "no-permission-needed", "basis": "fact-only",
                   "basis_note": "Court opinions are public domain; only facts and short quotations are used.",
                   "redistribution": False},
        "jurisdictions": [{"level": "federal"}, {"level": "tribal"}] + [{"level": "state", "state": s} for s in states],
        "topics": ["gaming", "tribal-state-compact", "good-faith-negotiation"],
        "access": {
            "open": True,
            "pull_from": ["free-web", "westlaw"] if item.get("needs_westlaw") else ["free-web"],
            "note": item.get("westlaw_reason") or "Free copy at the original link.",
        },
        "found_in": [SESSION],
        "notes": (f"{item.get('citation')}. {item['summary']} Read on the original link"
                  f"{'' if item.get('quote_found') else ' through a page-fetch tool only; holding not checked word for word'}. "
                  "Citator check (KeyCite) pending; see the project's Westlaw list."),
    }
    return record


def regulation_record(item, key, section=None):
    part = re.search(r"pt\. (\d+)|§ (\d+)\.(\d+)", item["citation"])
    citation = {"type": "legislation", "title": item["title"].split(", ", 1)[-1] if section else item["title"],
                "container-title": "Code of Federal Regulations", "container-title-short": "C.F.R.", "volume": "25"}
    citation["section"] = f"§ {part.group(2)}.{part.group(3)}" if section else f"pt. {part.group(1)}"
    link = (f"https://www.ecfr.gov/current/title-25/section-{part.group(2)}.{part.group(3)}" if section
            else f"https://www.ecfr.gov/current/title-25/part-{part.group(1)}")
    citation.update({"URL": link, "accessed": {"date-parts": [[2026, 11, 21]]}})
    return {
        "key": key, "kind": "federal-regulation", "citation": citation, "original_link": link, "retrieved": TODAY,
        "archives": [], "history": {"status": "live", "last_checked": TODAY},
        "rights": {"status": "no-permission-needed", "basis": "us-government-work", "redistribution": True},
        "jurisdictions": [{"level": "federal"}, {"level": "tribal"}],
        "topics": ["gaming", "tribal-state-compact", "regulation-text"],
        "found_in": [SESSION],
        "notes": f"{item['citation']}. {item['summary']} Read in the eCFR (point-in-time text of 2026-11-01).",
    }


def federal_register(number):
    fields = ["document_number", "title", "type", "publication_date", "volume", "start_page", "end_page", "html_url",
              "agencies"]
    url = (f"https://www.federalregister.gov/api/v1/documents/{number}.json?"
           + urllib.parse.urlencode([("fields[]", f) for f in fields]))
    result = subprocess.run(["curl", "-s", "-m", "60", url], capture_output=True)
    try:
        notice = json.loads(result.stdout)
    except json.JSONDecodeError:
        return None
    return notice if notice.get("volume") else None


def write_source(record):
    path = pathlib.Path("content/sources") / record["key"][0] / f"{record['key']}.yaml"
    if path.exists():
        return False
    path.write_text(yaml.safe_dump(record, sort_keys=False, allow_unicode=True, width=110), encoding="utf-8")
    return True


def main(context):
    tree = record_facts.Tree(".")
    addresses = {}
    for key, source in tree.sources.items():
        for link in record_facts.source_links(source):
            addresses[link] = key
    facts, added = [], 0
    for name in ("litigation.json", "negotiations-a-m.json", "negotiations-n-w.json"):
        for number, item in enumerate(json.loads((context / name).read_text(encoding="utf-8")), start=1):
            verification = "read-in-full" if item.get("quote_found") else "title-only"
            confidence = item.get("confidence") or "medium"
            if verification == "title-only" and confidence == "high":
                confidence = "medium"
            source = addresses.get(record_facts.normalized_link(item.get("link")))
            kind = item.get("link_kind")
            if not source and kind == "opinion":
                source = case_key(item)
                if write_source(case_record(item, source)):
                    added += 1
            elif not source and kind == "regulation":
                section = "§" in item["citation"]
                source = "cfr-25-" + (re.search(r"§ (\d+)\.(\d+)", item["citation"]).expand(r"\1-\2") if section
                                      else "part-" + re.search(r"pt\. (\d+)", item["citation"]).group(1))
                if write_source(regulation_record(item, source, section)):
                    added += 1
            elif not source and kind == "federal-register":
                match = FR_RULE.search(item["link"])
                notice = federal_register(match.group(1) or match.group(2)) if match else None
                if notice and (not item.get("citation") or fr_citation(notice).split(" (")[0] in item["citation"]):
                    source = f"federal-register-{notice['document_number'].lower()}"
                    record = source_record(notice["document_number"], notice, [])
                    record["notes"] = (f"{fr_citation(notice)}. {item.get('summary') or item.get('fact')} "
                                       "Metadata from the Federal Register API.")
                    if write_source(record):
                        added += 1
            fact = {
                "id": f"{name.split('.')[0]}-{number:03d}",
                "topic": item.get("topic"),
                "states": item.get("states") or ([item["state"]] if item.get("state") else []),
                "nations_as_named": item.get("nations") or [],
                "statement": item.get("summary") or item.get("fact"),
                "title": item.get("title"),
                "citation": item.get("citation"),
                "publisher": item.get("publisher"),
                "as_of": item.get("decided") or item.get("as_of"),
                "quote": item.get("quote"),
                "link": item.get("link"),
                "link_kind": kind,
                "source": source,
                "confidence": confidence,
                "verification": verification,
                "needs_westlaw": bool(item.get("needs_westlaw")),
                "westlaw_reason": item.get("westlaw_reason"),
            }
            facts.append(fact)
    write_table("compact-context", facts, [
        "id", "topic", "states", "nations_as_named", "statement", "citation", "title", "publisher", "as_of", "link",
        "source", "confidence", "verification", "needs_westlaw", "quote"])
    print(f"{len(facts)} context facts; {sum(f['verification'] == 'read-in-full' for f in facts)} quotations "
          f"found on the page; {added} new source records")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(pathlib.Path(sys.argv[1]))
