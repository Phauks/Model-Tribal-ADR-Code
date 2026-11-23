---
id: 2026-11-23-ordinance-scans
date: '2026-11-23'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: page-fetch
  name: National Indian Gaming Commission website (nigc.gov)
  detail: Downloaded 53 scanned ordinance PDFs again from their public links on the Commission's ordinance list, one at a time with a 3-second pause. All 53 downloads succeeded, and each file matched the sha256 of the gaming thread's capture of Nov. 21, 2026.
- kind: other
  name: scripts/review/ordinance_scans.py
  detail: Chose the documents, downloaded them, classified pages with pdftotext and low-resolution pdftoppm renderings (no OCR), wrote the reading batches, and merged the readers' items into the ordinance dispute review and the search logs.
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: Small-model reviewers read the page images of 53 documents in 12 batches; one batch re-read three documents whose images had dropped out. Claude (AI assistant) wrote the script and brief and spot-checked 10 items against the page images.
purpose: Read the scanned gaming ordinances (no text layer) of the 32 nations whose gaming-dispute-procedures search log was partly-searched, and record their patron dispute, employee grievance, licensing hearing and other dispute procedures under the lead author's grab-now rule.
queries:
- patron, gaming public or customer disputes, complaints and claims
- employee grievances and disciplinary appeals
- licensing hearings framed as dispute resolution
- arbitration, mediation, peacemaking and Tribal court review
- Tribal-State compact terms printed in the ordinance, and bare powers to hear complaints
sources_added: []
limits: Readers read page images without OCR, so their snippets could not be checked against a text layer. 9 of the 53 documents were partly read. Wilton Rancheria 2019 and Navajo Nation 2019 lost pages. Seven long documents stopped at a 40-page budget, and Shoalwater Bay 2019 left one page. Only 10 items were spot-checked, and 16 low-confidence items were not checked again. The 271 scanned documents of 137 other nations (second tier) were not downloaded or read.
---

# Scanned gaming ordinances read from page images

## What was done

The ordinance dispute review of Nov. 22 ([review](../../reviews/2026-11-22-ordinance-disputes.md)) could not read 330 scanned documents, and 32 nations' search logs were left `partly-searched`. The `select` step of `scripts/review/ordinance_scans.py` picked, for 31 of them, the newest full ordinance on the Commission's list (if it is scanned) and the scanned amendments listed on or after it, at most 3 per nation: 53 documents with 1,791 pages. The 32nd nation, the Confederated Tribes of the Chehalis Reservation, has no scanned document. `download` fetched the PDFs again from the Commission's public links, and `pages` and `batches` wrote reading plans. Documents of 40 pages or fewer were read in full; longer ones were read from the contents within a 40-page budget. Small-model reviewers read the page images following the [scan brief](../../reviews/briefs/2026-11-23-ordinance-scans.md). `merge-scans` added their items to the review and updated the search logs.

## Result

75 procedures in 38 documents: 41 patron dispute, 12 employee grievance, 7 licensing hearing and 15 other (42 high, 14 medium and 19 low confidence). A spot check of 10 items against the page images would change 5:

- 2 Navajo Nation 2019 items quote struck-through text, which the amendment deletes.
- 3 licensing hearings (Shoalwater Bay 2012 and 2019, Coquille 2020) are framed only by the word "disagree".

Search logs: 25 nations moved to `found` and 6 to `none-found`. Wilton Rancheria and Navajo Nation are among the found; the pages that dropped out are listed in their `next_steps`, since the search-log schema calls a log `found` once any search found something. All 315 logs now stand at 295 found, 19 none-found and 1 partly-searched (Chehalis).

## Not done

No profile was changed and no source record was added. Still to do:

- read the pages that dropped out for Wilton Rancheria 2019 and Navajo Nation 2019;
- read the pages left by the budget;
- check again the 16 low-confidence items that were not checked;
- read the 271 second-tier scanned documents of 137 other nations;
- read the Chehalis 2017 amendment in full.
