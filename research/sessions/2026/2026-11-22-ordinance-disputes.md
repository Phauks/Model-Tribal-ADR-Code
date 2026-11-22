---
id: 2026-11-22-ordinance-disputes
date: '2026-11-22'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: other
  name: scripts/review/ordinance_disputes.py
  detail: Read the text already extracted (pdftotext) from the 1,167 captured gaming ordinances and amendments, found candidate sections by heading and keyword, wrote review batches, checked every reviewer snippet against the text and wrote the review files and search logs. Nothing was downloaded again.
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: Small-model reviewers made the first reading of 310 documents in 9 batches. Claude (AI assistant) wrote the script and brief, took the second look at 123 low-confidence or garbled items and spot-checked others.
- kind: page-fetch
  name: eCFR versioner API and govinfo.gov
  detail: Read 25 C.F.R. § 522.2 as in force on Nov. 17, 2016, Oct. 21, 2022, Sept. 30, 2025 and Dec. 1, 2025, and the rules at 87 Fed. Reg. 57590 and 90 Fed. Reg. 46754. federalregister.gov returned a bot check page and was not retried.
purpose: Collect the dispute procedures in Tribal gaming ordinances (patron disputes, employee grievances, licensing hearings framed as dispute resolution, and any mediation, arbitration, peacemaking or Tribal court step) under the lead author's rule of Nov. 22, 2026 to collect now and classify later, and log every document read for each nation under decision record 0025.
queries:
- patron, gaming public, customer or player near dispute, complaint or claim
- grievance; arbitration; mediation; peacemaking; dispute resolution
- Tribal court near appeal or review
- 25 C.F.R. 522.2(f) or (e)
- headings with dispute, complaint, grievance, patron, claims, hearing, appeal
sources_added: []
limits: Only the newest document with each kind of procedure was reviewed for each nation; older documents were scanned by keyword only. 330 documents (10,118 pages) have no text layer and were not read, because no OCR tool was available. Reviewers read extracted passages, not whole documents, and the second look covered low-confidence and garbled items only. Commission regulations and compacts that ordinances refer to were not searched.
---

# Dispute procedures in Tribal gaming ordinances

## What was done

The lead author approved this on Nov. 22, 2026: "gaming patron and employee grievances are worth investigating, we grab now, figure out later". The gaming thread had captured all 1,167 ordinances and amendments on the National Indian Gaming Commission's list the day before. This session read those copies for the procedures 25 C.F.R. § 522.2(f) required ordinances to describe from 1993 to Oct. 20, 2022. The requirement was § 522.2(e) from Oct. 21, 2022 (87 Fed. Reg. 57590) until it was removed on Dec. 1, 2025 (90 Fed. Reg. 46754).

`scripts/review/ordinance_disputes.py batches` scanned every document and picked, for each nation, the newest document with each kind of procedure: 310 documents for 9 review batches. Small-model reviewers read them following the [brief](../../reviews/briefs/2026-11-22-ordinance-disputes.md). `merge` checked their snippets against the text and applied the second look. It then wrote the review files and one search log per nation under topic `gaming-dispute-procedures`.

## Result

512 procedures in 298 documents; all snippets found word for word. After the second look: 361 patron dispute, 48 employee grievance, 11 licensing hearings framed as dispute resolution, 89 other, and 3 set aside. They cover 264 nations with a profile. Search logs: 270 found, 32 partly searched, 13 none found. Details and the judgment calls for the lead author are in the [review](../../reviews/2026-11-22-ordinance-disputes.md).

## Not done

No profile was changed and no source record was added. The OCR of scanned documents, a reading of older ordinances and of the commission regulations and compacts the ordinances refer to, and a second reading of medium and high items are left for later.
