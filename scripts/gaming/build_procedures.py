"""Merge the Secretarial Procedures research into research/gaming/secretarial-procedures.{json,csv}
(one row per set of procedures, amendment or request) and research/gaming/part-291-history.{json,csv}
(the rulemaking and court history of 25 C.F.R. part 291), adding source records for Federal Register
documents not yet recorded.

    python3 scripts/gaming/build_procedures.py RESEARCH_FILE CAPTURES CACHE

RESEARCH_FILE is the reviewer's secretarial-procedures.json. A row is `read-in-full` only when its
quotation is found word for word in the captured document (or, for a court opinion, on the linked
page); otherwise `title-only`. Never changes a profile.
"""

import json
import pathlib
import re
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from build_catalog import fr_citation, source_record, write_table  # noqa: E402
from build_context import federal_register, write_source  # noqa: E402
from check_quotes import page_text  # noqa: E402
from clause_evidence import normalize  # noqa: E402

SESSION = "2026-11-21-gaming-compact-histories"
OUT = pathlib.Path("research/gaming")
LIST_SOURCE = "office-of-indian-gaming-compacts-list-2026"
CASES = {
    "Texas v. United States": "texas-v-united-states-2007",
    "New Mexico v. Dep't of the Interior": "new-mexico-v-department-of-the-interior-2017",
    "New Mexico v. Department of the Interior": "new-mexico-v-department-of-the-interior-2017",
}
FR_NUMBER = re.compile(r"doc\. ([0-9]{2,4}-[0-9]+)|/documents/\d{4}/\d\d/\d\d/([0-9-]+)/|/html/([0-9]+-[0-9]+)\.htm")


def fr_source(number, summary):
    """Source key for a Federal Register document, writing its record when it is new."""
    key = f"federal-register-{number.lower()}"
    if not list(pathlib.Path("content/sources").glob(f"*/{key}.yaml")):
        notice = federal_register(number)
        if not notice:
            return None
        record = source_record(number, notice, [])
        record["found_in"] = [SESSION]
        record["notes"] = f"{fr_citation(notice)}. {summary} Metadata from the Federal Register API."
        write_source(record)
    return key


def quote_found(quote, text):
    return bool(quote and text and normalize(quote) in normalize(text))


def main(research, captures, cache):
    data = json.loads(research.read_text(encoding="utf-8"))
    catalog = {r["id"]: r for r in json.loads((OUT / "compact-documents.json").read_text(encoding="utf-8"))}
    by_link = {r["document_link"]: r for r in catalog.values()}
    rows = []
    for item in data["procedures"]:
        record = catalog.get(item.get("document_id") or "")
        mentioned_in = None if record else by_link.get(item.get("link") or "")
        notice = item.get("federal_register") or {}
        if record:
            text_file = (captures / record["capture"]["capture"]).with_suffix(".txt")
            text = text_file.read_text(encoding="utf-8", errors="replace") if text_file.exists() else ""
            source, locator = LIST_SOURCE, f"document {record['id']}"
        elif mentioned_in:  # known only from a later document on the list
            text_file = (captures / mentioned_in["capture"]["capture"]).with_suffix(".txt")
            text = text_file.read_text(encoding="utf-8", errors="replace") if text_file.exists() else ""
            source, locator = LIST_SOURCE, f"document {mentioned_in['id']}"
        elif notice.get("document_number"):
            source = fr_source(notice["document_number"], item.get("notes") or "")
            text, locator = page_text(notice["link"], cache) if notice.get("link") else None, item.get("locator")
        else:
            source = next((key for name, key in CASES.items() if name in (item.get("preceding_case") or "")), None)
            text, locator = (page_text(item["link"], cache) if item.get("link") else None), item.get("locator")
        found = quote_found(item.get("quote"), text)
        rows.append({
            "nation": item.get("profile_id"),
            "nation_as_named": item["nation"],
            "state": item["state"],
            "document": record["id"] if record else None,
            "mentioned_in": mentioned_in["id"] if mentioned_in else None,
            "issued": item.get("issued"),
            "kind": item.get("kind") or "request",
            "path": item.get("path"),
            "preceding_case": item.get("preceding_case"),
            "mediator": item.get("mediator"),
            "federal_register": notice.get("citation"),
            "term": item.get("term"),
            "dispute_resolution": item.get("dispute_resolution"),
            "payments": item.get("payments"),
            "replacement_by_compact": item.get("replacement_by_compact"),
            "later_history": item.get("later_history"),
            "note": item.get("notes"),
            "quote": item.get("quote") if found else None,
            "locator": item.get("locator") or locator,
            "link": item.get("link"),
            "source": source,
            "confidence": item.get("confidence") if found else "medium" if item.get("confidence") == "high" else item.get("confidence"),
            "verification": "read-in-full" if found else "title-only",
        })
    write_table("secretarial-procedures", rows, list(rows[0]))

    history = []
    for item in data["part_291"]["history"]:
        number = FR_NUMBER.search(f"{item.get('citation')} {item.get('link')}")
        if "Fed. Reg." in (item.get("citation") or "") and number:
            source = fr_source(next(g for g in number.groups() if g), item["event"])
        else:
            source = next((key for name, key in CASES.items() if name in (item.get("citation") or "")), None)
        history.append({
            "date": item["date"], "event": item["event"], "citation": item.get("citation"), "link": item.get("link"),
            "source": source, "confidence": "high" if source else "medium",
            "verification": "read-in-full" if (item.get("verification") or "").startswith("read-in-full") else "title-only",
        })
    sections = [{"date": None, "event": f"§ {s['section']} {s['heading']}: {s['summary']}",
                 "citation": f"25 C.F.R. § {s['section']}", "link": data["part_291"]["ecfr_link"], "source": "cfr-25-part-291",
                 "confidence": "high", "verification": "read-in-full"} for s in data["part_291"]["sections"]]
    write_table("part-291-history", history + sections, list(history[0]))
    print(f"{len(rows)} procedure rows ({sum(r['verification'] == 'read-in-full' for r in rows)} quotations found); "
          f"{len(history)} history events; {len(sections)} sections")


if __name__ == "__main__":
    if len(sys.argv) != 4:
        sys.exit(__doc__)
    main(*(pathlib.Path(a) for a in sys.argv[1:]))
