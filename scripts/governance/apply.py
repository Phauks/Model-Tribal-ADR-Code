#!/usr/bin/env python3
"""Write governance facts into the Tribe profiles, and log every search.

Governance facts (the `governance` list of schemas/tribe.schema.json) come
from three places, in this order of preference (decision record 0042):

1. The nation's own constitution or other governing document, as the
   project's captured text of it. AI readers (Claude Haiku) followed
   scripts/governance/reader-brief.md (Claude Sonnet read again the hard
   cases listed in hard-cases.json) and copied each fact with the exact
   words that state it. This script keeps a fact only when those words are
   found in the text (spacing aside), so every kept fact can be checked
   against the document.
2. The nation's own website (a later pass; see research/governance/README.md).
3. The Bureau of Indian Affairs Tribal Leaders Directory: the title of the
   office of the nation's leader, never the person's name.

Subcommands:

  readings  BATCH_FOLDER   Check the readers' answers (batch-NNN.answers.json
                           beside batch-NNN.json and picked.json, written by
                           prepare_batches.py) and write
                           research/governance/readings.json: every fact with
                           whether its quote was found.
  directory DIRECTORY.json Turn a saved query of the directory's feature
                           service (fields tribefullname, tribalcomponent,
                           jobtitle) into research/governance/directory-titles.json.
  write                    Put the checked facts into the profiles, replacing
                           any `governance` list this script wrote before, and
                           write one search log per profile under
                           research/search-logs/governance/.

  python3 scripts/governance/apply.py readings /path/to/batches
  python3 scripts/governance/apply.py directory /path/to/directory.json
  python3 scripts/governance/apply.py write
"""

from __future__ import annotations

import glob
import json
import os
import re
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "research" / "governance"
LOGS = ROOT / "research" / "search-logs" / "governance"
DATE = "2026-11-23"
DIRECTORY_SOURCE = "bia-tribal-leaders-directory-2026"
DIRECTORY_LINK = "https://services1.arcgis.com/UxqqIfhng71wUT9x/arcgis/rest/services/TribalLeadership_Directory/FeatureServer/0"
ASPECTS = [
    "form", "governing-body", "governing-body-size", "governing-body-selection", "governing-body-term",
    "general-council", "head-of-government", "head-of-government-selection", "head-of-government-term",
    "other-officers", "elections", "voting-age", "election-authority", "branches", "separation-of-powers",
    "judiciary", "judicial-selection", "judicial-term", "judicial-independence", "amendment",
    "secretarial-approval", "recall-and-removal", "other",
]
READER_NOTE = (
    "Read from the text by an AI reader ({reader}); the quoted words were found in the text by "
    "scripts/governance/apply.py. Not yet checked by the lead author."
)
# Top-level profile keys the governance list goes before, in order of preference.
FOLLOWING_KEYS = ["governing_documents", "justice_institutions", "dispute_resolution", "gaming",
                  "jurisdiction", "memberships", "related_entities", "consultations", "review"]


def dump(value):
    return yaml.safe_dump(value, allow_unicode=True, sort_keys=False, width=10**6)


def spaced(text):
    """Text with every run of spacing made one space, for finding a quote."""
    return re.sub(r"\s+", " ", text).strip()


def letter(identifier):
    return identifier[0] if identifier[0].isalpha() else "_other"


def profiles():
    found = {}
    for path in sorted(glob.glob(str(ROOT / "content" / "tribes" / "*" / "*.yaml"))):
        found[Path(path).stem] = Path(path)
    return found


# ---------------------------------------------------------------- readings

def readings(folder):
    folder = Path(folder)
    picked = json.loads((folder / "picked.json").read_text(encoding="utf-8"))
    rows = {}
    # Hard cases (hard-cases.json), read again by a stronger reader (Claude
    # Sonnet) with notes on each, come last and replace the first reading.
    batch_paths = sorted(folder.glob("batch-[0-9][0-9][0-9].json"))
    if (folder / "hard-cases.answers.json").exists():
        batch_paths.append(folder / "hard-cases.json")
    for batch_path in batch_paths:
        reader = "Claude Sonnet" if batch_path.stem == "hard-cases" else "Claude Haiku"
        answers_path = batch_path.with_name(batch_path.stem + ".answers.json")
        batch = json.loads(batch_path.read_text(encoding="utf-8"))
        answers = json.loads(answers_path.read_text(encoding="utf-8")) if answers_path.exists() else []
        by_nation = {answer.get("nation"): answer for answer in answers if isinstance(answer, dict)}
        for row in batch:
            answer = by_nation.get(row["nation"])
            text = spaced(Path(row["text_path"]).read_text(encoding="utf-8", errors="replace"))
            facts = []
            for fact in (answer or {}).get("facts") or []:
                quote = spaced(str(fact.get("quote") or ""))
                aspect = fact.get("aspect") if fact.get("aspect") in ASPECTS else "other"
                facts.append({
                    "aspect": aspect,
                    "value": spaced(str(fact.get("value") or "")),
                    "quote": quote,
                    "locator": spaced(str(fact.get("locator") or "")),
                    "quote_found": bool(quote) and quote in text and len(quote) <= 400,
                })
            readable_text = legible(text)
            rows[row["nation"]] = {
                "nation": row["nation"],
                "document": row["document"],
                "version": row["version"],
                "version_label": row["version_label"],
                "version_status": row["status"],
                "date": row["date"],
                "source": row["source"],
                "text": os.path.relpath(row["text_path"], "/mnt/project-files") if row["text_path"].startswith("/mnt/project-files") else row["text_path"],
                "answered": answer is not None,
                "reader": reader,
                "readable": bool(answer and answer.get("readable")) and readable_text,
                "problem": spaced(str((answer or {}).get("problem") or "")) if readable_text else
                "The text extract is garbled beyond reading (its letters are shifted or scrambled), so no fact from it is kept.",
                "facts": facts,
            }
    for row in picked:
        if row["nation"] not in rows:
            rows[row["nation"]] = {
                "nation": row["nation"], "document": row["document"], "version": row["version"],
                "version_label": row["version_label"], "version_status": row["status"], "date": row["date"],
                "source": row["source"], "text": None, "answered": False, "readable": False,
                "problem": "No text layer: every captured version of the document is a scan without readable text.",
                "facts": [],
            }
    OUT.mkdir(parents=True, exist_ok=True)
    ordered = [rows[key] for key in sorted(rows)]
    (OUT / "readings.json").write_text(json.dumps(ordered, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    facts = [fact for row in ordered for fact in row["facts"]]
    print(f"{len(ordered)} nations, {sum(row['answered'] for row in ordered)} answered, "
          f"{sum(row['readable'] for row in ordered)} readable; {len(facts)} facts, "
          f"{sum(fact['quote_found'] for fact in facts)} with the quote found")


COMMON_WORDS = re.compile(r"\b(the|of|shall|and|be|by|to|or|in|any|for)\b", re.I)


def legible(text):
    """False for a text whose letters a scan or a font garbled beyond reading
    (for example a font whose letters are shifted): in a readable English
    governing document, words such as "the", "of" and "shall" make up about a
    fifth of all words; a garbled text has almost none."""
    words = text.split()
    return len(COMMON_WORDS.findall(text)) >= 0.03 * max(1, len(words))


# ---------------------------------------------------------------- directory

# The directory gives the leader's title in the form the current holder uses.
# The office's title is recorded without the holder's form, and words that
# describe the holder rather than the office (acting, interim, a dispute
# flag) are dropped. Titles of offices other than the leader's are skipped.
TITLE_FORMS = {
    "chairman": "Chairperson", "chairwoman": "Chairperson", "chairperson": "Chairperson", "chair": "Chairperson",
    "tribal chairman": "Tribal Chairperson", "council chairman": "Council Chairperson",
    "1st chief": "First Chief", "chief's": None, "vice-president": None, "secretary": None,
    "president/ceo": "President",
}


def office_title(raw):
    if not raw:
        return None
    title = re.sub(r"\(Subject to Tribal Leadership Dispute\)", "", raw).replace("*", "")
    title = re.sub(r"^(Acting|Interim)\s+", "", title.strip(), flags=re.I).strip()
    key = title.lower()
    if key in TITLE_FORMS:
        return TITLE_FORMS[key]
    title = re.sub(r"\bChair(man|woman)\b", "Chairperson", title)
    return title


def directory(path):
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    rows = [feature["attributes"] for feature in data["features"]]
    locators = {}
    for identifier, profile_path in profiles().items():
        record = yaml.safe_load(profile_path.read_text(encoding="utf-8"))
        for fact in iterate_facts(record):
            if fact.get("source") == DIRECTORY_SOURCE and fact.get("locator"):
                locators.setdefault(fact["locator"], set()).add(identifier)
    titles = []
    for row in rows:
        raw = row.get("jobtitle")
        title = office_title(raw)
        for identifier in sorted(locators.get(row["tribefullname"], ())):
            titles.append({"nation": identifier, "row": row["tribefullname"], "listed": raw, "title": title})
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "directory-titles.json").write_text(json.dumps(titles, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"{len(rows)} directory rows; {len(titles)} matched to profiles; "
          f"{sum(1 for t in titles if t['title'])} with an office title")


def iterate_facts(value):
    if isinstance(value, dict):
        if "source" in value:
            yield value
        for child in value.values():
            yield from iterate_facts(child)
    elif isinstance(value, list):
        for child in value:
            yield from iterate_facts(child)


# ---------------------------------------------------------------- write

def reading_facts(row):
    """The checked facts of one nation's reading, as profile facts."""
    if not row["readable"]:
        return []
    high = row["version_status"] == "in-effect"
    facts, seen = [], set()
    for fact in row["facts"]:
        if not fact["quote_found"] or not fact["value"]:
            continue
        key = (fact["aspect"], fact["value"].lower())
        if key in seen:
            continue
        seen.add(key)
        entry = {"aspect": fact["aspect"], "value": fact["value"], "quote": fact["quote"],
                 "source": row["source"], "confidence": "high" if high else "medium",
                 "verification": "read-in-full"}
        if row["date"]:
            entry["as_of"] = row["date"][:10]
        if fact["locator"]:
            entry["locator"] = fact["locator"]
        entry["document_version"] = {"document": row["document"], "version": row["version"]}
        note = READER_NOTE.format(reader=row.get("reader", "Claude Haiku"))
        if not high:
            note += " The newest text found; a later version may be in effect."
        if row["problem"]:
            note += f" Reader's note on the text: {row['problem'].rstrip('.')}."
        entry["note"] = note
        facts.append(entry)
    return facts


def directory_facts(entries):
    facts, seen = [], set()
    for entry in entries:
        title = entry["title"]
        if not title or title in seen:
            continue
        seen.add(title)
        note = ("The title of the leader's office as the federal directory lists it; the holder's name is not recorded.")
        if entry["listed"] and entry["listed"].strip() != title:
            note += f" Listed as “{entry['listed'].strip()}”; recorded without the holder's own form of the title."
        facts.append({"aspect": "head-of-government", "value": title, "source": DIRECTORY_SOURCE,
                      "confidence": "high", "verification": "bulk-import", "as_of": "2026-11-20",
                      "locator": entry["row"], "note": note})
    return facts


def order(facts):
    return sorted(facts, key=lambda fact: ASPECTS.index(fact["aspect"]))


def replace_block(text, key, block):
    """Replace or add the top-level `key:` list in the file's own text."""
    pattern = re.compile(rf"^{re.escape(key)}:\n(?:(?:[- ] .*|\s*)\n)*", re.M)
    match = pattern.search(text)
    if match:
        return text[:match.start()] + block + text[match.end():]
    if not block:
        return text
    for following in FOLLOWING_KEYS:
        found = re.search(rf"^{following}:", text, flags=re.M)
        if found:
            return text[:found.start()] + block + text[found.start():]
    return text + block


def write():
    readings_rows = {row["nation"]: row for row in json.loads((OUT / "readings.json").read_text(encoding="utf-8"))}
    titles = {}
    for entry in json.loads((OUT / "directory-titles.json").read_text(encoding="utf-8")):
        titles.setdefault(entry["nation"], []).append(entry)
    coverage = {row["nation"]: row for row in json.loads((ROOT / "research/constitutions/coverage.json").read_text(encoding="utf-8"))} \
        if (ROOT / "research/constitutions/coverage.json").exists() else {}
    counts = {"profiles": 0, "with facts": 0, "facts": 0}
    for identifier, path in profiles().items():
        counts["profiles"] += 1
        text = path.read_text(encoding="utf-8")
        record = yaml.safe_load(text)
        row = readings_rows.get(identifier)
        facts = order((reading_facts(row) if row else []) + directory_facts(titles.get(identifier, [])))
        block = ("governance:\n" + dump(facts)) if facts else ""
        new_text = replace_block(text, "governance", block)
        expected = dict(record)
        expected.pop("governance", None)
        if facts:
            expected["governance"] = facts
        if yaml.safe_load(new_text) != expected:
            raise SystemExit(f"{path}: the written file does not match the intended record")
        if new_text != text:
            path.write_text(new_text, encoding="utf-8")
        if facts:
            counts["with facts"] += 1
            counts["facts"] += len(facts)
        write_log(identifier, path, record, row, titles.get(identifier, []), coverage.get(identifier), facts)
    # A log whose profile is gone (for example merged into another record) goes too.
    known = set(profiles())
    for stale in LOGS.glob("*/*.yaml"):
        if stale.stem not in known:
            stale.unlink()
    print(counts)


def write_log(identifier, path, record, row, titles, coverage, facts):
    searches = []
    if row:
        found = [fact for fact in facts if fact.get("document_version")]
        if row["text"] is None:
            outcome, reason = "scanned-unreadable", row["problem"]
        elif not row["readable"]:
            outcome, reason = "not-found", f"The text was read but not used: {row['problem'] or 'not this nation’s governing document or not readable'}"
        elif found:
            outcome, reason = "found", f"Read the {row['version_label']} ({row['source']}); kept {len(found)} facts whose quoted words were found in the text."
        else:
            outcome, reason = "not-found", f"Read the {row['version_label']} ({row['source']}); no fact about how the government is set up could be quoted from the text."
        searches.append({
            "date": DATE, "searched_by": "Claude (AI assistant)", "method": "ai-review", "place_kind": "project-capture",
            "address": f"research/captures/{row['text']}" if row["text"] and not row["text"].startswith("research/") else (row["text"] or f"content/documents/{letter(identifier)}/{row['document']}.yaml"),
            "query": "Governance: governing body, head of government, elections, branches, courts, amendment (scripts/governance/reader-brief.md)",
            "outcome": outcome, "reason": reason,
            "records": [row["source"]] if outcome == "found" else [],
        })
    else:
        status = (coverage or {}).get("status")
        reason = ("The project's constitution catalog has no text of this nation's constitution or other governing document"
                  + (f" (catalog status: {status})." if status else "; the catalog covers federally recognized nations only."))
        searches.append({
            "date": DATE, "searched_by": "Claude (AI assistant)", "method": "script", "place_kind": "project-capture",
            "address": "research/constitutions/coverage.csv",
            "query": "A captured text of the nation's constitution or other governing document",
            "outcome": "not-found", "reason": reason,
        })
    federal = any(fact.get("type") == "federal" for fact in record.get("recognition") or [])
    if titles and any(entry["title"] for entry in titles):
        outcome, reason = "found", "The directory lists the title of the leader's office."
    elif titles:
        outcome, reason = "not-found", "The directory lists the nation but gives no title for its leader's office, or gives another office's."
    else:
        outcome = "not-found"
        reason = ("The nation was not matched to a row of the directory." if federal
                  else "The directory lists federally recognized nations only.")
    searches.append({
        "date": DATE, "searched_by": "Claude (AI assistant)", "method": "script", "place_kind": "database-listing",
        "address": DIRECTORY_LINK, "query": "jobtitle of the nation's row", "outcome": outcome, "reason": reason,
        **({"records": [DIRECTORY_SOURCE]} if outcome == "found" else {}),
    })
    for entry in searches:
        if not entry.get("records"):
            entry.pop("records", None)
    log = {
        "profile": str(path.relative_to(ROOT)),
        "topic": "governance",
        "status": "found" if facts else "partly-searched",
        "last_searched": DATE,
        "searches": searches,
        "next_steps": ("The nation's own website: a government, council or constitution page. "
                       "Then a newer constitution text from the nation, a law library or the Bureau of Indian Affairs."),
    }
    target = LOGS / letter(identifier) / f"{identifier}.yaml"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(dump(log), encoding="utf-8")


if __name__ == "__main__":
    command = sys.argv[1] if len(sys.argv) > 1 else ""
    if command == "readings":
        readings(sys.argv[2])
    elif command == "directory":
        directory(sys.argv[2])
    elif command == "write":
        write()
    else:
        raise SystemExit(__doc__)
