"""Cut the dispute resolution, renegotiation, term and revenue sharing
sections out of the governing compact documents, for reviewers to summarize,
and check the reviewers' quotations against the text afterwards.

    python3 scripts/gaming/clause_evidence.py gather CAPTURE_DIRECTORY WORK_DIRECTORY [BATCH_SIZE]
    python3 scripts/gaming/clause_evidence.py check CAPTURE_DIRECTORY WORK_DIRECTORY
    python3 scripts/gaming/clause_evidence.py merge WORK_DIRECTORY

`gather` reads research/gaming/compact-documents.json and, for each nation
and state, keeps the most recent approved or deemed-approved compact, every
approved amendment after it, and any Secretarial Procedures (extensions and
disapprovals are left out). For each kept document with a text layer it
writes the passages that follow headings naming those subjects (table of
contents lines skipped) into batch files WORK_DIRECTORY/batches/batch-NNN.json.

`check` reads the reviewers' answers in WORK_DIRECTORY/answers/*.json and
marks each quotation `quote_found` true or false after comparing it, with
spacing, hyphenation and quotation marks normalized, to the document text.
The result goes to WORK_DIRECTORY/checked.json.

`merge` writes research/gaming/compact-clauses.{json,csv}: one row per
document, a clause kept only when its quotation was found (otherwise the
clause is kept without quotation, marked `quote_found` false, and the row is
flagged for a second pass), each row marked with the item number of the data
gap review (research/reviews/2026-11-21-compact-clauses.json) that already
covered the same nation and state. Never changes a profile.
"""

import json
import pathlib
import re
import sys

CATALOG = pathlib.Path("research/gaming/compact-documents.json")
KEPT = ("approved", "deemed-approved", "secretarial-procedures")
SUBJECTS = {
    "dispute_resolution": r"dispute|arbitrat|mediat",
    "renegotiation": r"renegotiat|re-negotiat|reopen|re-open|amendment|modification|negotiat",
    "term": r"duration|\bterm\b|termination|expiration|renewal",
    "revenue_sharing": r"revenue shar|payment|exclusiv|state share|contribution|special distribution|"
                       r"trust fund|fees? (to|for) the state|assessment",
    "sovereign_immunity": r"sovereign immunity|waiver",
}
NUMBERED = re.compile(r"^\s*(?:(?:section|sec\.|article|part)\s+[0-9ivxl]+[0-9a-z.()]*|[0-9]{1,2}(?:\.[0-9]{1,2})*\.?|[ivxl]{1,5}\.|\([a-z0-9]{1,3}\)|[a-z]\.)\s", re.I)
SECTION_CHARACTERS = 4500
DOCUMENT_CHARACTERS = 18000


def is_heading(line):
    stripped = line.strip()
    if not 3 <= len(stripped) <= 90 or re.search(r"\.{4,}|\s\d{1,3}$", stripped):
        return False  # empty, a sentence, or a table-of-contents line
    letters = [c for c in stripped if c.isalpha()]
    upper = letters and sum(c.isupper() for c in letters) / len(letters) > 0.8
    numbered = NUMBERED.match(stripped) and len(stripped.split()) <= 10 and not stripped.endswith((",", ";"))
    return bool(upper or numbered)


def sections(text):
    lines = text.split("\n")
    offsets, position = [], 0
    for line in lines:
        offsets.append(position)
        position += len(line) + 1
    headings = [(offsets[i], line) for i, line in enumerate(lines) if is_heading(line)]
    found, total = {}, 0
    for subject, words in SUBJECTS.items():
        pattern = re.compile(words, re.I)
        found[subject] = []
        for start, line in headings:
            if not pattern.search(line) or re.search(r"patron|player|customer|employee|tort|claims? by", line, re.I):
                continue
            after = text[start:start + 800]
            if len(re.findall(r"\.{4,}", after)) > 2:
                continue  # inside the table of contents
            passage = re.sub(r"[ \t]+", " ", text[start:start + SECTION_CHARACTERS])
            if total + len(passage) > DOCUMENT_CHARACTERS or len(found[subject]) == 2:
                break
            found[subject].append(passage)
            total += len(passage)
    return found


def governing(catalog):
    groups = {}
    for record in catalog:
        if record["decision"] not in KEPT or not record.get("capture"):
            continue
        key = (record["state"], tuple(record["nations"]) or (record["list_tribes_column"],))
        groups.setdefault(key, []).append(record)
    kept = []
    for records in groups.values():
        records.sort(key=lambda r: r["listed_date"] or "")
        compacts = [r for r in records if r["document_kind"] == "compact" and (r["capture"]["pages"] or 0) >= 20]
        start = compacts[-1]["listed_date"] if compacts else ""
        kept += [r for r in records if (r["listed_date"] or "") >= start or r["document_kind"] == "secretarial-procedures"]
    return kept


def gather(captures, work, batch_size=10):
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    (work / "batches").mkdir(parents=True, exist_ok=True)
    items, skipped = [], []
    for record in governing(catalog):
        text_file = (captures / record["capture"]["capture"]).with_suffix(".txt")
        text = text_file.read_text(encoding="utf-8", errors="replace") if text_file.exists() else ""
        if len(re.sub(r"\s", "", text)) < 500:
            skipped.append({"id": record["id"], "reason": "no text layer"})
            continue
        items.append({
            "id": record["id"], "state": record["state"], "nations": record["nations"] or [record["list_tribes_column"]],
            "title": record["title"], "decision": record["decision"], "document_kind": record["document_kind"],
            "listed_date": record["listed_date"], "pages": record["capture"]["pages"],
            "opening": re.sub(r"[ \t]+", " ", text[:1200]), "sections": sections(text),
        })
        if not any(items[-1]["sections"].values()):  # a short amendment: give the reviewer its text
            items[-1]["text_start"] = re.sub(r"[ \t]+", " ", text[:DOCUMENT_CHARACTERS])
    for number in range(0, len(items), batch_size):
        path = work / "batches" / f"batch-{number // batch_size + 1:03d}.json"
        path.write_text(json.dumps(items[number:number + batch_size], indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    (work / "skipped.json").write_text(json.dumps(skipped, indent=1) + "\n", encoding="utf-8")
    print(f"{len(items)} documents in {(len(items) + batch_size - 1) // batch_size} batches; {len(skipped)} skipped")


def normalize(text):
    text = text.replace("“", '"').replace("”", '"').replace("‘", "'").replace("’", "'")
    text = re.sub(r"-\s*\n\s*", "", text)
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def check(captures, work, folder="answers", output="checked.json"):
    catalog = {r["id"]: r for r in json.loads(CATALOG.read_text(encoding="utf-8"))}
    results = []
    for path in sorted((work / folder).glob("*.json")):
        for answer in json.loads(path.read_text(encoding="utf-8")):
            record = catalog.get(answer.get("id"))
            if not record:
                answer["check"] = "unknown document id"
                results.append(answer)
                continue
            text = normalize((captures / record["capture"]["capture"]).with_suffix(".txt").read_text(
                encoding="utf-8", errors="replace"))
            for subject in SUBJECTS:
                clause = answer.get(subject)
                if isinstance(clause, dict) and clause.get("quote"):
                    clause["quote_found"] = normalize(clause["quote"]) in text
            results.append(answer)
    (work / output).write_text(json.dumps(results, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    quotes = [c for a in results for s in SUBJECTS if isinstance(c := a.get(s), dict) and c.get("quote")]
    print(f"{len(results)} answers; {sum(1 for c in quotes if c.get('quote_found'))} of {len(quotes)} quotations found")


def merge(work):
    sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
    from build_catalog import write_table  # noqa: E402
    catalog = {r["id"]: r for r in json.loads(CATALOG.read_text(encoding="utf-8"))}
    earlier = {}
    for item in json.loads(pathlib.Path("research/reviews/2026-11-21-compact-clauses.json").read_text(encoding="utf-8")):
        earlier[(pathlib.Path(item["profile"]).stem, item["state"])] = item["item_id"]
    second = {}
    if (work / "checked-second.json").exists():
        for answer in json.loads((work / "checked-second.json").read_text(encoding="utf-8")):
            answer["reviewer"] = "larger model, second pass, whole document"
            second[answer.get("id")] = answer
    rows = []
    for first in json.loads((work / "checked.json").read_text(encoding="utf-8")):
        answer = second.get(first.get("id"), first)
        record = catalog.get(answer.get("id"))
        if not record:
            continue
        row = {"id": record["id"], "state": record["state"], "nations": record["nations"], "title": record["title"],
               "listed_date": record["listed_date"], "decision": record["decision"],
               "document_link": record["document_link"], "document_is": answer.get("document_is")}
        hard = answer.get("difficulty") == "hard"
        for subject in SUBJECTS:
            clause = answer.get(subject)
            if not isinstance(clause, dict) or clause.get("present") is None:
                row[subject] = None
                continue
            if clause.get("quote") and not clause.get("quote_found"):
                hard = True
            row[subject] = {key: clause.get(key) for key in (
                "present", "summary", "steps", "binding_arbitration", "triggers", "years", "automatic_renewal",
                "locator", "quote", "quote_found") if clause.get(key) is not None}
        row["note"] = answer.get("note")
        if answer is not first:
            row["first_pass_verdict"] = answer.get("first_pass_verdict")
        row["needs_review"] = hard and answer is first
        row["data_gap_review_items"] = sorted({earlier[(n, record["state"])] for n in record["nations"]
                                               if (n, record["state"]) in earlier})
        row["source"] = "office-of-indian-gaming-compacts-list-2026"
        row["confidence"] = "medium"
        row["verification"] = "read-in-full" if any(
            isinstance(row[s], dict) and row[s].get("quote_found") for s in SUBJECTS) else "title-only"
        row["reviewer"] = answer.get("reviewer", "small model, first pass")
        rows.append(row)
    rows.sort(key=lambda r: (r["state"], r["nations"], r["listed_date"] or ""))
    write_table("compact-clauses", rows, [
        "id", "state", "nations", "title", "listed_date", "document_is", "dispute_resolution.summary",
        "dispute_resolution.steps", "dispute_resolution.binding_arbitration", "dispute_resolution.locator",
        "renegotiation.summary", "renegotiation.locator", "term.summary", "term.years", "term.automatic_renewal",
        "revenue_sharing.summary", "sovereign_immunity.summary", "needs_review", "data_gap_review_items",
        "reviewer", "verification", "document_link", "note"])
    print(f"{len(rows)} rows; {sum(r['needs_review'] for r in rows)} need review")


if __name__ == "__main__":
    if len(sys.argv) in (4, 5) and sys.argv[1] == "gather":
        gather(pathlib.Path(sys.argv[2]), pathlib.Path(sys.argv[3]), int(sys.argv[4]) if len(sys.argv) == 5 else 10)
    elif len(sys.argv) == 3 and sys.argv[1] == "merge":
        merge(pathlib.Path(sys.argv[2]))
    elif len(sys.argv) == 4 and sys.argv[1] == "check":
        check(pathlib.Path(sys.argv[2]), pathlib.Path(sys.argv[3]))
        if (pathlib.Path(sys.argv[3]) / "second-answers").exists():
            check(pathlib.Path(sys.argv[2]), pathlib.Path(sys.argv[3]), "second-answers", "checked-second.json")
    else:
        sys.exit(__doc__)
