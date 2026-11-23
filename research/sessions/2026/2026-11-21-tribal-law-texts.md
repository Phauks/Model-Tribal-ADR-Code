---
id: 2026-11-21-tribal-law-texts
date: '2026-11-21'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: page-fetch
  name: curl, pdftotext and pandoc
  detail: Fetched every law code, court rules and dispute resolution link the profiles cite and the
    chapters linked from their index pages, at most one request per second per site, and extracted
    the text.
- kind: ai-assistant
  name: Claude Haiku (AI assistant)
  detail: First reader. Recorded each dispute resolution provision in 2,700 passages with an exact
    quotation, under research/tribal-law/briefs/2026-11-21-parse-passages.md.
- kind: ai-assistant
  name: Claude Sonnet (AI assistant)
  detail: Second reader. Re-read 568 hard cases and a random sample of 120 other records under
    research/tribal-law/briefs/2026-11-21-second-pass.md.
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: Took stock of what had been collected and parsed, wrote the scripts, checked every
    quotation against the fetched text by script, and wrote the summary files.
purpose: >-
  Read the law codes, court rules and dispute resolution ordinances that the
  profiles listed only by title, and record their dispute resolution
  provisions (mediation, arbitration, peacemaking referrals, court-annexed
  processes and enforcement) for the lead author's review.
queries: []
limits: >-
  1,753 scanned PDFs have no text layer and were not read, because no OCR tool
  was available. eCode360 and Municode refused the fetches, and 287 links failed
  to connect. Only one level of linked chapters was followed. Provisions that
  use none of the search terms were missed. Every record is a machine reading.
  The second reader saw only the passage around each quotation, so it removed
  citation years that may appear elsewhere in the document. No profile was
  changed.
---

## Result

[`research/tribal-law/`](../../tribal-law/README.md) holds the results:

- 2,127 provision records from 531 documents and 117 nations.
- 1,867 records after removing duplicates.
- 1,671 records once the second reader's drops and undecided records are set aside. These come from 425 documents and 108 nations.

## What had been collected but not parsed

Before this session the profiles held:

- 611 law codes, all `title-only`.
- 3 tribal court rules entries.
- 938 listings copied from the National Center on Restorative Justice database (`bulk-import`).
- 323 provision records, 310 of them with no verification level.
- 46 Native American Rights Fund entries that had never been opened.

The private source bucket was empty. Constitutions and charters were left to the separate constitutions research.

## Method

See [the README](../../tribal-law/README.md#how-the-provisions-were-found).

- 820 links, cited by 299 profiles, led to 8,921 files.
- 6,748 of those files had text.
- 2,700 passages matched a search term.
- Haiku read each passage, and a script then found every quotation in the fetched text.
- 8 nations were corrected where the document's site belongs to exactly one nation.
- Sonnet re-read every borderline, low-confidence and medium-confidence record, and a fixed random sample of the rest.

## Second reader

| Selected as | Confirm | Change | Drop | Cannot tell |
| --- | --- | --- | --- | --- |
| Hard case (568) | 257 | 117 | 189 | 5 |
| Random sample (120) | 84 | 34 | 2 | 0 |

The random sample shows three things:

- The high-confidence records are almost always real provisions: 2 of 120 were dropped.
- About 1 in 9 has a substantive field to correct (13 of 120).
- About 1 in 7 has a citation year the passage does not show (18 of 120).

## Peacemaking

The peacemaking provisions went to the peacemaking research as a private file: 580 records from 39 nations, with quotations, feature tags and capture paths. Twenty-one passages with ceremonial or spiritual content are listed without quotation or summary.

## Next

- The lead author decides each provision in the `lead_author_decision` column.
- Accepted provisions can then go into profiles and, where a law has more than one version, into `content/documents/`.
- Scanned codes need OCR.
- eCode360 and Municode codes need another way in.
