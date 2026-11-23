# Briefs: confirming the text-read tier (Gate 1, item 3, Nov. 23, 2026)

The three briefs given to the readers in the [text-read tier review](../../sessions/2026/2026-11-23-text-read-tier.md), as written, with the session's scratch paths replaced by WORK_DIRECTORY. The first reading was done by small-model readers, the second reading and the web search by larger-model readers, and the final readings were checked by the lead session. The results are in [`2026-11-23-text-read-tier.json`](../2026-11-23-text-read-tier.json).

## 1. First reading (project files only)

You are checking records in a research dataset about Native nations' dispute resolution law (peacemaking, mediation, arbitration forums, code provisions, contract clauses, gaming compact dispute clauses). A model code will be drafted from these records, so each must rest on the nation's own text, actually read. Your job: for each record in your batch, find the document that holds its text among files the project already has, read the relevant part, and say whether the record is supported.

### Inputs

Your batch file is a JSON list. Each item has:
- `rid` (record id; use it in your output), `pid` (nation), `section`, `index`, `category`
  - `unread:title-only` = known only by a heading; `unread:inferred` = details inferred, maybe from a secondary source; `unread:bulk-import` = copied from a database (often the National Center on Restorative Justice, NCORJ) without reading the code; `mislabeled` = marked read-in-full but its note says the text was not read; `ocr` = read from a scan by OCR and needs a careful re-read.
- `record_yaml`: the record exactly as stored. Check every factual claim in it (title, citation, kind, case types, participation, relationship to court, enforcement, summary, description).
- `candidates`: files the project holds that may contain the text. `local_text` is a text extract you can read directly. Otherwise get the file with `python3 -I WORK_DIRECTORY/tools/fetch_capture.py <key>`, which prints a FILE path and a TEXT path. If it says the PDF has little or no text layer, run it again with `--pages --first=N --last=M` (keep ranges small, under 15 pages; find the right pages from a table of contents first) and look at the PNG page images with the Read tool.
- Text extracts can be large: use `grep -n -i` for the section number, heading words or terms like "peacemak", "mediat", "arbitrat", then read around the hits with `sed -n 'A,Bp'`. Don't read whole long files.

### Rules

- Only use files from the candidates list, or other files under the same nation in `/home/user/Model-Tribal-ADR-Code/research/capture-index.csv` (search it with grep for the nation id). **Do not use the web.** No web search, no fetching URLs. If the text is not in the project's files, say so; a later step searches the web.
- A table of contents, an index page (NARF's peacemaking laws list, NILL's code index, NCORJ's database) or a news article is not the nation's text. It can tell you where the text is, but it does not confirm the record. A nation's own web page describing its program counts as the nation's own text for a forum's description, but not for a code provision.
- Quote exactly. Your `quote` must be copied character for character from the file (up to 50 words), so a second reader can find it.
- Do not invent. If the text does not say something the record says, report it as unsupported. If unsure, say so and lower your confidence.
- Do not edit any repository file. Write only your output file.

### Output

Write a JSON list to the output path you were given, one object per record, then reply with only a one-line count of outcomes. Fields:

```json
{
  "rid": 123,
  "pid": "nation-id",
  "outcome": "confirmed | corrected | not-found | not-dispute-resolution",
  "text_key": "capture key of the document you read (or null)",
  "read_method": "text-layer | html | page-images | none",
  "locator": "section, article or page numbers read",
  "quote": "exact words from the text that best support or contradict the record",
  "document_title_and_date": "as printed in the document, with enactment/amendment date if printed",
  "findings": "2-4 sentences: what the text says on each claim the record makes, and what differs",
  "proposed_changes": {"field": "new value, only for fields that are wrong or missing"},
  "proposed_verification": "read-in-full | title-only | inferred | bulk-import",
  "confidence": "high | medium | low",
  "searched": ["capture keys you opened that did not have it"]
}
```

- `confirmed`: the nation's own text was read and supports every claim (wording differences are fine).
- `corrected`: the text was read and at least one claim is wrong, missing or overstated; give the fix in `proposed_changes` (for example a new `summary`, `citation`, `locator`, `title`, `participation`, `case_types`, `note`).
- `not-found`: no project file holds the text. Keep `proposed_verification` at the record's current level.
- `not-dispute-resolution`: the text is found but is not about resolving disputes (explain).
- `proposed_verification` is `read-in-full` only if you read the nation's own text of the provision or program yourself.

## 2. Second reading

Read the first brief above for the background, tools and rules (no web, quote exactly, do not edit repository files). A first reader (a smaller model) has already checked each record in your batch and found the nation's text. Earlier in this project, a second reading of first-pass results changed more than half of them, mostly summaries that left out how a case enters the process or whether an outcome is enforced, so read independently.

For each item in your batch (fields `rid`, `first_reading`, `record_yaml`, `candidates`):

1. Open the document the first reader used (`first_reading.text_key`) with the fetch tool. Check that their `quote` is really in it, character for character (allow line-break differences). If the text has no text layer, look at the page images.
2. Read the relevant section yourself and check every claim in `record_yaml` and every proposed change in `first_reading.proposed_changes`.
3. Decide the final result. Write the proposed changes as they should be applied: full replacement values for each field (for example the whole new `summary`, one sentence or two, plain English, saying what the provision does, who decides, how a case gets there and whether the result is binding or enforced, when the text says so). Use the schema's existing field names only: for provisions `title`, `citation`, `kind`, `locator`, `summary`, `note`, `as_of`; for forums `name`, `description`, `legal_basis`, `case_types`, `participation`, `relationship_to_court`, `enforcement`, `locator`, `note`, `as_of`; for compacts `dispute_resolution_summary`, `dispute_resolution_locator`, `locator`, `as_of`. Do not change `kind`, `case_types` or `participation` values unless the text clearly calls for it, and use the same vocabulary the record already uses.
4. `not-dispute-resolution` only if the section plainly has nothing to do with resolving disputes; otherwise keep it and say what it covers.

Write a JSON list to your output path, one object per record:

```json
{
  "rid": 123,
  "second_outcome": "confirmed | corrected | not-found | not-dispute-resolution",
  "agrees_with_first": true,
  "quote_checked": "exact | close | not-found",
  "text_key": "capture key read",
  "read_method": "text-layer | html | page-images",
  "locator": "section or pages read",
  "quote": "exact words (up to 50) from the text",
  "document_title_and_date": "as printed",
  "findings": "what you checked and what differs from the record or the first reading",
  "final_changes": {"field": "full new value"},
  "final_verification": "read-in-full | title-only | inferred | bulk-import",
  "confidence": "high | medium | low"
}
```

`final_verification` is `read-in-full` only if you read the nation's own text of the provision or program yourself. Reply with only a one-line count of outcomes.

## 3. Web search for texts the project does not hold

Background: a research project on Native nations' dispute resolution law is checking that each record a model code may rely on rests on the nation's own text. The records in your batch could not be confirmed from the project's own files (`first_reading` says what was opened). Your job is to look on the open web, once, carefully and politely, for the nation's own text of each one.

For each item (fields `rid`, `first_reading`, `record_yaml`, `source_record`):

1. Read the record and the first reader's findings: what section, ordinance, rule or program is needed.
2. Search the web (WebSearch) with the nation's name and the section heading or number. Prefer, in order: the nation's own website or code host; the National Indian Law Library (narf.org/nill) full-text copies; NARF's peacemaking library (peacemaking.narf.org); a court's own rules page.
3. Fetch only pages a search returned (WebFetch). If a site shows a bot check, a sign-in screen, "Just a moment", or loads only with JavaScript (eCode360, Municode, tribal.codes often do), record it as `blocked` and move on. Never try to get around bot protection. Never fetch a Shoshone-Arapaho draft Peacemaker Court text: that tribe withheld it.
4. If you find the text, read the section and check every claim in `record_yaml`, as in a careful legal reading. Note that a fetch-and-summarize tool may paraphrase: copy a quote only if the tool returns the exact words, and say `read_method: fetch-summary` if you only saw a summary. A record read only through a summary stays at its current level.
5. Pace yourself: at most about 3 searches and 3 fetches per record, and stop early when the answer is clear. The project shares an hourly page-read limit with other work.

Do not edit any repository file. Write a JSON list to your output path, one object per record:

```json
{
  "rid": 123,
  "outcome": "found-confirmed | found-corrected | blocked | dead-link | not-online | not-dispute-resolution",
  "url": "address of the text found (or the best lead)",
  "read_method": "raw-text | fetch-summary | none",
  "locator": "section read",
  "quote": "exact words (up to 50) if you saw them verbatim",
  "document_title_and_date": "as printed",
  "findings": "what the text says against each claim in the record, or why it is not online",
  "final_changes": {"field": "full new value (same field names as the record)"},
  "final_verification": "read-in-full | title-only | inferred | bulk-import",
  "confidence": "high | medium | low",
  "searches": [{"place_kind": "web-search | nation-website | national-indian-law-library | other", "address": "url or query", "query": "words", "outcome": "found | not-found | blocked | dead-link", "reason": "one sentence"}],
  "pull_list_action": "if not readable here: what a person should do in a browser or library to get it (one sentence with the exact link), else null"
}
```

`final_verification` is `read-in-full` only when you read the exact text yourself (raw text, not a summary). Reply with only a one-line count of outcomes.
