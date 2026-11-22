# Brief: read dispute resolution provisions known only by title

You are helping a law student's research project on Native nations' dispute resolution law. Each record in your batch file names a provision of a Native nation's law code that the project knows only from a heading in the National Indian Law Library (NILL) table of contents. Your job is to find and read the provision itself, then report what the text says. You do not edit any repository file.

## Inputs

Your batch file (path given in your task) is a JSON list. Each entry has:

- `nation`: the profile id.
- `provisions`: records to check. Each has `record_id`, `kind`, `title`, `citation`, `table_of_contents` (the NILL page), `note` and `text_hits` (places where the heading text was already found in a captured copy of the nation's own code: `text_file` is a local text file and `offset` is a character position in a lowercased, whitespace-collapsed copy, so search the file for the heading rather than trusting the offset).
- `captured_documents`: other copies of the nation's law already fetched, with a local `text_file` you can read or grep.

The files under `/mnt/project-files/` are on a slow network mount. Read only the files you need, and use `grep -i -n` with a few words of the heading or the section number to find the right place before reading around it.

## How to find the text

Try these in order and stop when you have read the provision:

1. The `text_hits` files, then other `captured_documents` whose title or address suggests the right title or chapter.
2. The NILL `table_of_contents` page: it often links to the nation's own copy (a PDF or a page on the nation's site). Fetch that copy.
3. The nation's own website (its code, laws, judicial or court page).
4. A web search for the nation's name plus the heading.

Do not use a page that only lists headings (a table of contents) as the provision. Do not log in, fill forms or bypass paywalls. If a site blocks you (403, 406), try once with a normal browser user agent, then move on.

## What to report

Write one JSON file (path given in your task): a list with one object per `record_id` in your batch, in this shape:

```json
{
  "record_id": "bay-mills-indian-community#0",
  "status": "read",
  "text_url": "https://... the copy you read",
  "document_title": "Title of the code or chapter as printed",
  "section": "Section number(s) as printed, e.g. 1803-1804",
  "as_of": "Date the text states (enactment, amendment or 'updated'), as YYYY, YYYY-MM or YYYY-MM-DD; null if none is printed",
  "title_as_printed": "Heading exactly as printed in the text",
  "kind": "arbitration | mediation | peacemaking | traditional-dispute-resolution | other",
  "summary": "One neutral sentence, present tense, on what the provision does.",
  "scope": "dispute-resolution | borderline | not-dispute-resolution",
  "confidence": "high | medium | low",
  "notes": "Anything a reviewer needs: OCR quality, a version question, a heading that differs from the record, a chapter not found.",
  "searches": [
    {"place": "captured copy | NILL page | nation website | web search | other",
     "address": "URL or file", "query": "search words if any",
     "outcome": "found | not-found | blocked | dead-link | no-text-online",
     "reason": "One sentence on what happened."}
  ]
}
```

`status` is one of:

- `read`: you read the provision's text and it matches the record.
- `read-different`: you read it, but the heading, number or subject differs from the record (explain in `notes`, and give the printed heading).
- `not-found`: you could not find the text online. Fill `searches` with every place you looked and why it failed. Leave `summary` null.
- `duplicate`: the same section as another `record_id` in your batch (name it in `notes`).

`searches` is required for every record, including ones you found, so the project can log where it looked.

## Rules for the summary

- Write only from the text you read. Never guess from the heading.
- One sentence, present tense, neutral, no evaluation of the nation's law.
- Do not quote the law; paraphrase. A short term of art in quotation marks is fine.
- Say what the provision does: who may use the process, for what, how a case enters, who decides, and whether an agreement or award is binding or enforced by the court, as far as the text says.
- `kind`: arbitration (a neutral decides), mediation (a neutral helps parties agree), peacemaking (the nation's peacemaking process; never call it ADR), traditional-dispute-resolution (another customary process, such as elders), other (anything else, such as a waiver of immunity for arbitration only, a settlement conference, a jurisdiction clause).
- `scope`: `not-dispute-resolution` if the section does not concern resolving disputes (for example a heading containing "arbitration" that only sets an arbitrary-and-capricious standard).
- Do not describe ceremonial, spiritual or clan matters beyond saying that the text refers to them.
- Leave out individuals' names.

When done, reply with only: the output path, the number of records by status, and any record you think a stronger reviewer should re-check (record_id and one line why).

---

# Brief: second reading of flagged dispute resolution provisions

First-pass helpers read title-only provisions of Native nations' law codes under `brief.md` in this folder (read it first: the output shape, status values, summary rules, kind and scope definitions all still apply). You are the stronger reviewer for the records they flagged, plus a random sample of records they marked high confidence.

## Input

Your input file is a JSON list. Each entry has `record_id`, `why_recheck` (why it was picked), `original_record` (the record as the project holds it: title, citation, NILL table-of-contents link, note), `text_hits` and `helper_result` (the first reading, in the brief.md shape).

## What to do for each record

1. Open the text the helper used (`helper_result.text_url`, or the local capture under /mnt/project-files/ it names). If the helper read through a summarizing fetch, get the raw text instead: download the PDF or page with curl (normal browser user agent) into your own work folder and extract it with `pdftotext -layout`; for image-only PDFs use `pdftoppm -r 200` then `tesseract`. Read the section itself.
2. Check every field against the text: section number, heading as printed, as_of (a date printed for that section or that code version; say which in notes), kind, scope and the summary. Fix what is wrong.
3. For `read-different`, decide whether the record's heading or number is a NILL error, an older version, or a different section; say which in notes.
4. For duplicates, confirm the two records really cite the same section.
5. For scope questions, apply brief.md: `not-dispute-resolution` only when the section does not concern resolving disputes; a section that bars or limits mediation is still about dispute resolution (kind other, scope dispute-resolution or borderline, explain).
6. Keep summaries to one neutral present-tense sentence from the text, no quotes beyond a short term of art, no ceremonial detail, no names.

## Output

Write a JSON list to the output path you are given: one object per input record, in the brief.md shape (all fields, `searches` kept and extended with anything you looked at), plus:

```json
"recheck": {
  "verdict": "confirmed | corrected | changed-status",
  "changes": "One or two sentences on what you changed and why, or 'none'.",
  "raw_text_read": true
}
```

Write the file as you go so partial work survives. Files under /mnt/project-files/ are on a slow network mount: grep before reading, never search the whole folder. Keep your downloads in your own subfolder of this item2 folder (named after your output file) and do not touch other files. Do not edit anything under /home/user.

When done, reply with only: the output path, counts by verdict, and any record you still could not settle (record_id and one line).

---

# Brief: second search for provisions the first pass could not find

First-pass helpers looked for 80 title-only provisions under `brief.md` in this folder and did not find the text (read brief.md first: output shape, status values, summary, kind and scope rules all still apply). Each entry in `retry-in.json` has `record_id`, `original_record`, `helper_result` (with its `searches` and notes) and `captured_documents`.

Do not repeat a search the helper already logged unless the reason it failed may have changed. Things that have changed or that the helpers did not try:

- OCR now works here: `pdftoppm -r 200 file.pdf page` then `tesseract`. Scanned PDFs the helpers skipped (for example Cherokee Nation court rules, scanned Omaha titles, Klamath Title 2 Ch. 18 beyond page 13) can be read.
- hoopa-nsn.gov returned HTTP 429 for the Title 13 and Title 14A PDFs; try again slowly (one request, wait, retry once).
- Leads the helpers left: Osage candidate osage.nation.codes/ONC/19-4-801; Zuni Children's Code 9-4-1(C) and 9-7-8(B) for the "Mediation" heading; Karuk Title I section 1.D; Nisqually Title 8 PDF beyond 8.50.290 (fetch the PDF raw and extract with pdftotext instead of a summarizing fetch); Mississippi Choctaw Title XV gaming dispute section in another version; Siletz Tribal Court Rules and Procedures (12-17-10); Mohegan and Pokagon ordinances.
- Wayback Machine copies (web.archive.org/web/2020*/<url>) of dead nation PDFs and of the NILL-linked copies.

Do not try ecode360.com or library.municode.com again (they refuse scripts), and do not try to get around a NILL note that a nation does not permit full text online: leave those records not-found and add one search entry saying so. Do not log in, fill forms or bypass paywalls.

Work through the records with leads first, then the rest as time allows. Write a JSON list to `retry-out.json` in this folder with one object per input record in the brief.md shape: a found record gets status read or read-different and full fields; a record still not found keeps status not-found with the helper's searches plus yours appended. Write the file as you go. Keep downloads in item2/retry/ and do not touch other files. Files under /mnt/project-files/ are on a slow network mount: grep, never search the whole folder. Do not edit anything under /home/user.

When done, reply with only: the output path, how many you found, and any found record you are unsure of (record_id and one line).
