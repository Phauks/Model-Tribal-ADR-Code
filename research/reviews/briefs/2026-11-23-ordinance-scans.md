# Brief: scanned gaming ordinances read from page images (Nov. 23, 2026)

For reviewers reading the batches written by `python3 scripts/review/ordinance_scans.py batches --work WORK_DIRECTORY`. SCANS below means `WORK_DIRECTORY/scans`.

This extends the [brief of Nov. 22](2026-11-22-ordinance-disputes.md). Follow that brief for the item kinds (`patron-dispute`, `employee-grievance`, `licensing-hearing`, `other`), the fields, "Not an item" and the rules, with the changes below. Where it speaks of passages, sections and refs, read pages of the PDF instead.

## Why

330 documents on the National Indian Gaming Commission's list have no text layer, so the first review could not read them, and no OCR tool was available. The lead author's grab-now rule applies to them too. The script's `select` step looked at the 32 nations whose search log was `partly-searched`. For each, it picked the newest full ordinance on the list (if it is scanned) plus the scanned amendments listed on or after it, at most 3 per nation. The `download` step fetched each PDF again from the Commission's public link.

## What a batch holds

Each batch, `SCANS/batches/scan-batch-NNN.json`, has about 8 documents or 150 planned pages. For each document it gives the document id, `nations` (profile ids), `document_kind`, `listed_date`, `final_link`, `local_pdf`, `pages`, `suggested_page_ranges`, `reading_plan` and `plan_note`.

## How to read

- Use the Read tool on `local_pdf` with the `pages` parameter, one range per call, for example pages "1-20". Never ask for more than 20 pages in one call, and never call Read on a PDF without `pages`.
- `reading_plan` "full": read every range in `suggested_page_ranges`.
- `reading_plan` "contents-first" (documents over 40 pages): read the suggested ranges (the first 6 pages), find the contents or section list, then read only the parts the `plan_note` names, within its 40-page budget.
- Pages in `commission_approval_letter_pages` are the Commission's approval letter; skip them.
- Page numbers you report are PDF page numbers counted from 1 in the file, not the numbers printed on the page. You may add the printed number in the section text, for example "Section 9 (printed p. 7)".
- Do not run OCR, install anything, download anything, or edit any file other than your verdict file.

## Grab-now rule (lead author, Nov. 22–23)

Record anything that names a dispute, complaint or grievance procedure. This changes the Nov. 22 brief in two ways:

- Tribal-State compact terms printed in the ordinance are items. Give them the kind that fits and set `"refers_to": "Tribal-State compact"`.
- A bare power to hear complaints or disputes, with no procedure, is an item at `"confidence": "low"`.

Ordinary license hearings with no dispute framing stay out of items; list them in `skipped`.

## Each item

- `refs`: [] (scans have no section refs).
- `locator`: `section` (the section number and heading as printed, or "") and `pages` (the PDF page or pages). A page number is required for every item.
- `snippet`: copied word for word from the page image, under 25 words, from one place on one page. Keep the document's spelling, capitals and punctuation. Do not join words from two places, fix typos or fill in words you cannot read. If you cannot read a clean run of words, use the clearest short run and set confidence no higher than medium.
- Every other field as the Nov. 22 brief says. Never guess.

## Output

Write `SCANS/verdicts/scan-batch-NNN.json`: one JSON list, one object per document in batch order, in the Nov. 22 format, with `"reader": "small-model reviewer, page images"`, `pages_read` (the ranges actually read), `unreadable_pages`, `what_the_document_is` (one sentence), `items`, `skipped` (each `{"pages": "...", "why": "..."}`) and `none_found_reason`. Every document of the batch must be present.

## Afterwards

`ordinance_scans.py merge-scans` adds the items to the review with ids ending `#p<n>`. There is no text layer to check snippets against, so their `quote_check` says they were copied from the page image. An item is `read-in-full` only when every page of its document was read; otherwise it is `title-only` and flagged `partly-read`. Claude (AI assistant) spot-checks a sample against the page images and records the result in `second_look`.

## Known limit: approval letter pages

`ordinance_scans.py pages` marks a page as the Commission's approval letter only when the page has a text layer holding the Commission's name and a letter's salutation or closing ("Dear", "Sincerely"). The first run looked for the name and "chair" alone. That also matched ordinance pages that mention notices to the Commission (Confederated Tribes of Siletz Indians 2024, PDF pages 25–26; Pueblo of Isleta 2024, pages 170–171) and a Tribal resolution (Organized Village of Kake 2000, page 3). That is fixed. A letter scanned as an image (page 1 of many files) still cannot be recognized without OCR, so it stays in the reading ranges and readers read it; it costs a page and is not an item.
