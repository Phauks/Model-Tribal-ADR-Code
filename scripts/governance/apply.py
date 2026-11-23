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
2. The nation's own website: its government, council, election and court
   pages and any governing document it posts, saved by crawl_websites.py and
   read by AI readers under scripts/governance/website-brief.md. A fact from
   the website replaces a fact of the same aspect read from an older library
   copy of the constitution, since the website is the nation's newer word.
3. The Bureau of Indian Affairs Tribal Leaders Directory: the title of the
   office of the nation's leader, never the person's name.

Subcommands:

  readings  BATCH_FOLDER   Check the readers' answers (batch-NNN.answers.json
                           beside batch-NNN.json and picked.json, written by
                           prepare_batches.py) and write
                           research/governance/readings.json: every fact with
                           whether its quote was found.
  websites BATCH_FOLDER    Check the website readers' answers
                           (batch-NNN.answers.json beside each batch written by
                           prepare_website_batches.py) against the saved page
                           texts and write research/governance/website-readings.json.
  sources                  Write a source record for each website page that a
                           kept fact cites (content/sources/), from
                           website-readings.json.
  directory DIRECTORY.json Turn a saved query of the directory's feature
                           service (fields tribefullname, tribalcomponent,
                           jobtitle) into research/governance/directory-titles.json.
  write                    Put the checked facts into the profiles, replacing
                           any `governance` list this script wrote before, and
                           write one search log per profile under
                           research/search-logs/governance/.

  python3 scripts/governance/apply.py readings /path/to/batches
  python3 scripts/governance/apply.py websites /path/to/website-batches
  python3 scripts/governance/apply.py sources
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


# ---------------------------------------------------------------- websites

WEBSITE_NOTE = (
    "Read from the nation's own website by an AI reader ({reader}); the quoted words were found in the "
    "saved page by scripts/governance/apply.py. Not yet checked by the lead author."
)
SESSION = "2026-11-23-governance"


def slug(text, limit):
    words = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return words[:limit].rstrip("-") or "home"


def page_key(nation, link):
    """A source key for one page of a nation's website: the nation and the page's path."""
    from urllib.parse import urlparse
    parsed = urlparse(link)
    path = slug(parsed.path + ("-" + parsed.query if parsed.query else ""), 60)
    return f"{slug(nation, 70)}-website-{path}"


def websites(folder):
    folder = Path(folder)
    rows = {}
    for batch_path in sorted(folder.glob("batch-[0-9][0-9][0-9].json")):
        answers_path = batch_path.with_name(batch_path.stem + ".answers.json")
        batch = json.loads(batch_path.read_text(encoding="utf-8"))
        answers = json.loads(answers_path.read_text(encoding="utf-8")) if answers_path.exists() else []
        by_nation = {answer.get("nation"): answer for answer in answers if isinstance(answer, dict)}
        for row in batch:
            pages_folder = Path(row["folder"])
            manifest = json.loads((pages_folder / row.get("manifest", "reading.json")).read_text(encoding="utf-8"))
            pages = {page["number"]: page for page in manifest["pages"]}
            texts = {number: spaced((pages_folder / page["text"]).read_text(encoding="utf-8", errors="replace"))
                     for number, page in pages.items()}
            answer = by_nation.get(row["nation"])
            facts = []
            for fact in (answer or {}).get("facts") or []:
                quote = spaced(str(fact.get("quote") or ""))
                try:
                    number = int(fact.get("page"))
                except (TypeError, ValueError):
                    number = None
                # A quote found on another saved page than the one given still counts, on the page it is on.
                if number not in texts or quote not in texts[number]:
                    number = next((candidate for candidate, text in texts.items() if quote and quote in text), number)
                aspect = fact.get("aspect") if fact.get("aspect") in ASPECTS else "other"
                facts.append({
                    "aspect": aspect,
                    "value": spaced(str(fact.get("value") or "")),
                    "quote": quote,
                    "page": number,
                    "locator": spaced(str(fact.get("locator") or "")),
                    "quote_found": bool(quote) and number in texts and quote in texts[number] and len(quote) <= 400,
                })
            documents = []
            for document in (answer or {}).get("documents") or []:
                page = pages.get(document.get("page")) if isinstance(document.get("page"), int) else None
                if page:
                    documents.append({**{key: document.get(key) for key in ("page", "kind", "title", "year", "stated_current", "nation_matches")},
                                      "link": page["final_link"], "sha256": page["sha256"]})
            rows[row["nation"]] = {
                "nation": row["nation"],
                "sites": manifest["sites"],
                "fetched": manifest["fetched"],
                "answered": answer is not None,
                "reader": "Claude Haiku",
                "official": bool(answer and answer.get("official")),
                "problem": spaced(str((answer or {}).get("problem") or "")),
                "pages": [{key: page[key] for key in ("number", "link", "final_link", "title", "media_type", "sha256", "raw")}
                          | {"folder": str(pages_folder)} for page in manifest["pages"]],
                "documents": documents,
                "facts": facts,
            }
    skipped_path = folder / "skipped.json"
    for entry in json.loads(skipped_path.read_text(encoding="utf-8")) if skipped_path.exists() else []:
        rows.setdefault(entry["nation"], {"nation": entry["nation"], "answered": False, "official": False,
                                          "problem": entry["reason"], "pages": [], "documents": [], "facts": [],
                                          "sites": [], "fetched": DATE, "reader": None})
    previous = OUT / "website-readings.json"
    if previous.exists():
        for row in json.loads(previous.read_text(encoding="utf-8")):
            rows.setdefault(row["nation"], row)
    ordered = [rows[key] for key in sorted(rows)]
    previous.write_text(json.dumps(ordered, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    facts = [fact for row in ordered for fact in row["facts"]]
    print(f"{len(ordered)} nations, {sum(row['answered'] for row in ordered)} answered, "
          f"{sum(row['official'] for row in ordered)} official sites; {len(facts)} facts, "
          f"{sum(fact['quote_found'] for fact in facts)} with the quote found")


def website_page(row, number):
    return next((page for page in row["pages"] if page["number"] == number), None)


def website_documents(row):
    """Pages the reader marked as a governing document of this nation, by page number."""
    return {document["page"]: document for document in row["documents"]
            if document.get("nation_matches") is not False and document.get("kind") in ("constitution", "bylaws", "articles", "other")}


_CATALOGED = None


def cataloged():
    """Governing-document texts the catalog already holds, by SHA-256: (source key, document version, status)."""
    global _CATALOGED
    if _CATALOGED is None:
        _CATALOGED = {}
        for path in sorted(glob.glob(str(ROOT / "content" / "documents" / "*" / "*.yaml"))):
            history = yaml.safe_load(Path(path).read_text(encoding="utf-8"))
            for version in history.get("versions") or []:
                sha = (version.get("capture") or {}).get("sha256")
                if sha and version.get("source"):
                    _CATALOGED[sha] = (version["source"], {"document": history["id"], "version": version["id"]}, version.get("status"))
    return _CATALOGED


_EXISTING = None


def existing_sources():
    """Source records from other work, by link, so a page already cited elsewhere keeps its record."""
    global _EXISTING
    if _EXISTING is None:
        _EXISTING = {}
        for path in sorted(glob.glob(str(ROOT / "content" / "sources" / "*" / "*.yaml"))):
            record = yaml.safe_load(Path(path).read_text(encoding="utf-8"))
            if SESSION in (record.get("found_in") or []) and "-website-" in record["key"]:
                continue
            for link in {record.get("original_link"), (record.get("citation") or {}).get("URL")} - {None}:
                _EXISTING.setdefault(same_link(link), record["key"])
    return _EXISTING


def same_link(link):
    """A link without its scheme, a leading www. or a closing slash, for matching records."""
    return re.sub(r"^https?://(www\.)?", "", link.strip()).rstrip("/").lower()


def page_source(row, page):
    """The source key for a saved page: the catalog's version, a record from other work with the same link, or the page's own."""
    known = cataloged().get(page["sha256"])
    if known:
        return known[0]
    for link in (page["final_link"], page["link"]):
        if same_link(link) in existing_sources():
            return existing_sources()[same_link(link)]
    return page_key(row["nation"], page["final_link"])


def website_facts(row):
    if not row or not row["official"]:
        return []
    documents = website_documents(row)
    facts, seen = [], set()
    for fact in row["facts"]:
        if not fact["quote_found"] or not fact["value"]:
            continue
        key = (fact["aspect"], fact["value"].lower())
        if key in seen:
            continue
        seen.add(key)
        page = website_page(row, fact["page"])
        document = documents.get(fact["page"])
        current = not document or document.get("stated_current")
        known = cataloged().get(page["sha256"])
        if known:
            # The page is a governing document the constitution catalog already holds: cite that version.
            current = current or known[2] == "in-effect"
        entry = {"aspect": fact["aspect"], "value": fact["value"], "quote": fact["quote"],
                 "source": page_source(row, page),
                 "confidence": "high" if current else "medium", "verification": "read-in-full",
                 "as_of": row["fetched"]}
        if fact["locator"]:
            entry["locator"] = fact["locator"]
        if known:
            entry["document_version"] = dict(known[1])
        note = WEBSITE_NOTE.format(reader=row.get("reader") or "Claude Haiku")
        if document and not current:
            note += " The governing document as the nation's website posts it; the page does not say whether it is the version now in effect."
        if row["problem"]:
            note += f" Reader's note on the pages: {row['problem'].rstrip('.')}."
        entry["note"] = note
        facts.append(entry)
    return facts


def sources():
    """Write a source record for each website page a kept fact cites."""
    rows = json.loads((OUT / "website-readings.json").read_text(encoding="utf-8"))
    names = official_names()
    written = 0
    earlier = {path for path in (ROOT / "content" / "sources").glob("*/*-website-*.yaml")
               if SESSION in (yaml.safe_load(path.read_text(encoding="utf-8")).get("found_in") or [])}
    kept_paths = set()
    for row in rows:
        identifier = row["nation"]
        facts = website_facts(row)
        documents = website_documents(row)
        for number in sorted({page["number"] for page in row["pages"]
                              if page_key(identifier, page["final_link"]) in {fact["source"] for fact in facts}}):
            page = website_page(row, number)
            key = page_key(identifier, page["final_link"])
            document = documents.get(number)
            author = names.get(identifier, [identifier])[0]
            year, month, day = (int(part) for part in row["fetched"].split("-"))
            if document:
                citation = {"type": "legislation", "title": document.get("title") or page["title"] or "Constitution",
                            "author": [{"literal": author}], "URL": page["final_link"]}
                if document.get("year"):
                    citation["issued"] = {"date-parts": [[int(document["year"])]]}
            else:
                citation = {"type": "webpage", "title": page["title"] or page["final_link"],
                            "author": [{"literal": author}], "URL": page["final_link"]}
            citation["accessed"] = {"date-parts": [[year, month, day]]}
            record = {
                "key": key,
                "kind": "tribal-constitution" if document and document.get("kind") == "constitution" else "web-page",
                "citation": citation,
                "original_link": page["final_link"],
                "retrieved": row["fetched"],
                "history": {"status": "live", "last_checked": row["fetched"]},
                "rights": {"status": "no-permission-needed", "basis": "fair-use",
                           "basis_note": ("Facts about how the nation's government is set up, each with the few words of the page "
                                          "(at most 300 characters) that state it, so a reader can check it (decision record 0042)."),
                           "redistribution": False},
                "tribes": [identifier],
                "found_in": [SESSION],
                "notes": (f"The nation's own website, read on {row['fetched']} for its governance facts "
                          f"(research/governance/website-readings.json). Saved page SHA-256 {page['sha256'][:16]}..."),
            }
            path = ROOT / "content" / "sources" / letter(key) / f"{key}.yaml"
            if path.exists():
                existing = yaml.safe_load(path.read_text(encoding="utf-8"))
                if SESSION not in existing.get("found_in", []):
                    raise SystemExit(f"{path}: a source record of this key exists from other work; rename the key")
                if existing.get("archives"):
                    record["archives"] = existing["archives"]
                    record = {key_: record[key_] for key_ in ["key", "kind", "citation", "original_link", "retrieved", "archives",
                                                              "history", "rights", "tribes", "found_in", "notes"]}
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(dump(record), encoding="utf-8")
            kept_paths.add(path)
            written += 1
    # A page record an earlier run wrote that no fact cites now (for example a page cited elsewhere under another key) goes.
    for path in earlier - kept_paths:
        path.unlink()
    print(f"{written} source records written; {len(earlier - kept_paths)} no longer cited removed")


def official_names():
    """The nation's own names, for the author of each page's citation."""
    names = {}
    for identifier, path in profiles().items():
        record = yaml.safe_load(path.read_text(encoding="utf-8"))
        own = record.get("names") or {}
        names[identifier] = [name for name in (own.get("official"), own.get("common")) if name]
    return names


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
    website_path = OUT / "website-readings.json"
    website_rows = {row["nation"]: row for row in json.loads(website_path.read_text(encoding="utf-8"))} if website_path.exists() else {}
    counts = {"profiles": 0, "with facts": 0, "facts": 0, "from websites": 0}
    for identifier, path in profiles().items():
        counts["profiles"] += 1
        text = path.read_text(encoding="utf-8")
        record = yaml.safe_load(text)
        row = readings_rows.get(identifier)
        from_site = website_facts(website_rows.get(identifier))
        site_aspects = {fact["aspect"] for fact in from_site}
        # The website is the nation's newer word: its fact replaces one of the same aspect read from an
        # older library copy, but not one read from a text the nation's own site marks as in effect.
        from_text = [fact for fact in (reading_facts(row) if row else [])
                     if fact["confidence"] == "high" or fact["aspect"] not in site_aspects]
        facts = order(from_text + from_site + directory_facts(titles.get(identifier, [])))
        counts["from websites"] += len(from_site)
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
        write_log(identifier, path, record, row, titles.get(identifier, []), coverage.get(identifier), facts,
                  website_rows.get(identifier))
    # A log whose profile is gone (for example merged into another record) goes too.
    known = set(profiles())
    for stale in LOGS.glob("*/*.yaml"):
        if stale.stem not in known:
            stale.unlink()
    print(counts)


def next_steps(site, record):
    if site and site["pages"] and site["official"]:
        return ("A newer constitution text from the nation, a law library or the Bureau of Indian Affairs; "
                "the government office can say which version is in effect.")
    if site and site["pages"]:
        return "Find the nation's own government website; the address listed leads elsewhere."
    if site:
        return "The nation's website refused an automated reader; read its government pages by hand."
    if any(contact.get("kind") == "website" for contact in record.get("contacts") or []):
        return ("The nation's own website: a government, council or constitution page. "
                "Then a newer constitution text from the nation, a law library or the Bureau of Indian Affairs.")
    return ("Ask the nation's government office for its constitution or a description of its government; "
            "a state commission on Indian affairs may also list it.")


def write_log(identifier, path, record, row, titles, coverage, facts, site=None):
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
    if site:
        site_sources = {page_source(site, page) for page in site["pages"]}
        kept = [fact for fact in facts if fact["source"] in site_sources and fact.get("as_of") == site["fetched"]]
        if not site["pages"]:
            outcome, reason = "blocked", f"The website could not be read: {site['problem'] or 'no page could be fetched'}."
        elif not site["official"]:
            outcome, reason = "not-found", f"The pages saved are not the nation's own government site: {site['problem'] or 'another site'}."
        elif kept:
            outcome, reason = "found", f"Read {len(site['pages'])} pages (home, government, council, election, court and constitution pages); kept {len(kept)} facts whose quoted words were found on the page."
        else:
            outcome, reason = "not-found", f"Read {len(site['pages'])} pages (home, government, council, election, court and constitution pages); none states how the government is set up in words that could be quoted."
        searches.append({
            "date": site["fetched"], "searched_by": "Claude (AI assistant)", "method": "ai-review", "place_kind": "nation-website",
            "address": (site["sites"] or [contact["value"] for contact in record.get("contacts") or [] if contact.get("kind") == "website"] or ["content/tribes"])[0],
            "query": "Government, council, election, court and constitution pages linked from the home page (scripts/governance/crawl_websites.py, website-brief.md)",
            "outcome": outcome, "reason": reason,
            "records": sorted({fact["source"] for fact in kept}),
        })
    elif not any(contact.get("kind") == "website" for contact in record.get("contacts") or []):
        contacts_log = ROOT / "research" / "search-logs" / "contacts" / letter(identifier) / f"{identifier}.yaml"
        searches.append({
            "date": DATE, "searched_by": "Claude (AI assistant)", "method": "script", "place_kind": "nation-website",
            "address": str(contacts_log.relative_to(ROOT)) if contacts_log.exists() else "content/tribes",
            "query": "A website of the nation's own, to read its government pages",
            "outcome": "no-site",
            "reason": "The profile lists no website of the nation's own; the contacts search (its log is the address) found none.",
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
        "next_steps": next_steps(site, record),
    }
    target = LOGS / letter(identifier) / f"{identifier}.yaml"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(dump(log), encoding="utf-8")


if __name__ == "__main__":
    command = sys.argv[1] if len(sys.argv) > 1 else ""
    if command == "readings":
        readings(sys.argv[2])
    elif command == "websites":
        websites(sys.argv[2])
    elif command == "sources":
        sources()
    elif command == "directory":
        directory(sys.argv[2])
    elif command == "write":
        write()
    else:
        raise SystemExit(__doc__)
