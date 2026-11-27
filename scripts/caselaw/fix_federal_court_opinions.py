#!/usr/bin/env python3
"""Apply the Nov. 27, 2026 review of the lower federal court opinions to the records already written.

Trevor asked on Nov. 27, 2026 for a review of the lower federal court opinions (PR #595), then said to "go ahead
with what is necessary to prep those". The review found captions that had lost words, court names spelled more than
one way, nations linked through a bare word ("Tribes"), cases filed twice, and opinions about children that the
privacy check had missed. scripts/caselaw/state_court_opinions.py now writes new records the fixed way (case_title,
court_title, specific_names, parallel_reports, and the readers' privacy-reviews.json); this script brings the records
an earlier run wrote into line, without writing them again:

    python3 scripts/caselaw/fix_federal_court_opinions.py --work DIR --private DIR

--work is the folder the first run used (candidates.jsonl and cases/); --private is the folder outside git with the
held list and privacy-reviews.json. A record whose case a reader held is removed, with its capture index rows, and its
case joins the held list; the copy in the bucket is no longer listed, so it is not served.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "caselaw"))
sys.path.insert(0, str(ROOT / "scripts" / "captures"))
import mirror_captures  # noqa: E402
import state_court_opinions as opinions  # noqa: E402

SESSION = opinions.FEDERAL_SESSION
DATA = opinions.FEDERAL_DATA
COURTLISTENER_PAGE = re.compile(r"https://www\.courtlistener\.com/opinion/\d+/[^ ]*?/(?=[ .]|$)")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--work", required=True)
    parser.add_argument("--private", required=True)
    args = parser.parse_args()
    work, private = Path(args.work), Path(args.private)
    rows = opinions.candidates(work)
    by_link = {opinions.source_link(row): row for row in rows}
    reviews = opinions.privacy_reviews(private)

    records = {}
    for path in opinions.SOURCES.glob("*/*.yaml"):
        text = path.read_text(encoding="utf-8")
        if SESSION in text:
            record = yaml.safe_load(text)
            if SESSION in (record.get("found_in") or []):
                records[record["key"]] = (path, record)

    def row_of(record: dict) -> dict | None:
        found = by_link.get(record["original_link"])
        if not found:  # released through GovInfo's copy: the notes give CourtListener's page
            page = COURTLISTENER_PAGE.search(record.get("notes") or "")
            found = by_link.get(page.group(0)) if page else None
        return found

    def case_of(row: dict) -> dict:
        return json.loads((work / "cases" / row["reporter"] / row["volume"] / row["file"]).read_text(encoding="utf-8"))

    matched = {key: row_of(record) for key, (path, record) in records.items()}
    missing = [key for key, row in matched.items() if row is None]
    if missing:
        sys.exit(f"{len(missing)} records have no case in --work, for example {missing[:3]}")

    removed: dict[str, str] = {}  # record key -> why
    held_rows = []
    changed = {"title": 0, "court": 0, "links": 0, "merged": 0, "held": 0}

    # Readers' holds: the record goes, and its case joins the held list.
    for key, row in matched.items():
        if reviews.get(str(row["id"])) == "hold":
            case = case_of(row)
            removed[key] = "held"
            held_rows.append({"id": row["id"], "name": case.get("name_abbreviation"),
                              "citation": "; ".join(c.get("cite") for c in case.get("citations", []) if c.get("cite")),
                              "court": row["court"], "date": row["date"], "reason": "child or protected person", "link": opinions.source_link(row)})
            changed["held"] += 1

    # One opinion filed twice: the record with the Federal Reporter's citation stays and lists the other citation.
    kept_rows = [row for key, row in matched.items() if key not in removed]
    key_of = {str(row["id"]): key for key, row in matched.items()}
    also = opinions.parallel_reports(kept_rows, work)
    for duplicate in also["duplicates"]:
        removed[key_of[str(duplicate)]] = "duplicate"
        changed["merged"] += 1

    for key, (path, record) in records.items():
        if key in removed:
            continue
        row = matched[key]
        case = case_of(row)
        citation = record["citation"]
        year = int(str(citation["issued"]["date-parts"][0][0]))
        title = opinions.case_title(case) if not row.get("pdf") else citation["title"]
        court = opinions.court_title(citation["authority"], citation.get("container-title", ""), year)
        if title and title != citation["title"]:
            citation["title"] = title
            changed["title"] += 1
        if court != citation["authority"]:
            record["notes"] = record["notes"].replace(f"Decided by the {citation['authority']}", f"Decided by the {court}")
            citation["authority"] = court
            changed["court"] += 1
        named = record["nations_in_case"]["named"]
        specific = opinions.specific_names(named)
        if len(specific) != len(named):
            record["nations_in_case"]["named"] = specific
            record["tribes"] = [entry["nation"] for entry in specific]
            if not record["tribes"]:
                del record["tribes"]
            for check in record["review"]["checks"]:
                if check["check"].startswith("Nations named in the caption"):
                    check["detail"] = re.sub(r"^\d+ matched", f"{len(specific)} matched", check["detail"])
            changed["links"] += 1
        extra = [cite for cite in also["citations"].get(row["id"], []) if cite and cite not in (record.get("notes") or "")]
        if extra:
            notes = record["notes"]
            published = re.match(r"^(Published at .*?)\. (?=Decided by|Found by)", notes)
            if published:  # citations have periods of their own (146 F. Supp. 459), so the list ends before "Decided by"
                record["notes"] = f"{published.group(1)}; {'; '.join(extra)}. " + notes[published.end():]
            else:
                record["notes"] = f"Published at {'; '.join(extra)}. " + re.sub(r"; no reporter citation yet", "", notes, count=1)
        path.write_text(opinions.dump(record), encoding="utf-8")

    for key, why in removed.items():
        records[key][0].unlink()

    index = mirror_captures.load_index()
    titles = {key: record["citation"]["title"] for key, (path, record) in records.items() if key not in removed}
    tribes = {key: ";".join(record.get("tribes", [])) for key, (path, record) in records.items() if key not in removed}
    kept_index = []
    for entry in index:
        if entry["records"] in removed:
            continue
        if entry["records"] in titles:
            entry["title"] = titles[entry["records"]]
            entry["nations"] = tribes[entry["records"]]
        kept_index.append(entry)
    # The index's CSV alone: mirror_captures.write_index also counts the pages of new PDFs, which this change has none of.
    with mirror_captures.INDEX_CSV.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=mirror_captures.FIELDS, lineterminator="\n")
        writer.writeheader()
        writer.writerows(kept_index)

    with open(DATA / "records.csv", newline="", encoding="utf-8") as handle:
        listed = list(csv.DictReader(handle))
    listed = [row for row in listed if row["key"] not in removed]
    with open(DATA / "records.csv", "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, ["key", "citation", "court", "date", "score", "how"])
        writer.writeheader()
        writer.writerows(listed)

    with open(private / "held-for-privacy-review.csv", newline="", encoding="utf-8") as handle:
        held = list(csv.DictReader(handle))
    known = {str(row["id"]) for row in held}
    held += [row for row in held_rows if str(row["id"]) not in known]
    with open(private / "held-for-privacy-review.csv", "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, ["id", "name", "citation", "court", "date", "reason", "link"])
        writer.writeheader()
        writer.writerows(held)

    summary = json.loads((DATA / "summary.json").read_text(encoding="utf-8"))
    summary["written"] = len(listed)
    summary["held_for_privacy_review"] = len(held)
    summary["held_by_reason"] = {reason: sum(1 for row in held if row["reason"] == reason) for reason in sorted({row["reason"] for row in held})}
    summary["held_after_review"] = summary.get("held_after_review", 0) + changed["held"]
    summary["merged_duplicates"] = summary.get("merged_duplicates", 0) + changed["merged"]
    (DATA / "summary.json").write_text(json.dumps(summary, indent=1) + "\n", encoding="utf-8")
    print(changed, {"records": len(listed), "held": len(held)})


if __name__ == "__main__":
    main()
