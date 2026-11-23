---
id: 2026-11-23-ordinance-scans-second-tier
date: '2026-11-23'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: page-fetch
  name: National Indian Gaming Commission website (nigc.gov)
  detail: Downloaded 219 scanned ordinance PDFs from their public links on the Commission's ordinance list, one at a time with a pause. All 219 downloads succeeded, and each file matched the sha256 of the gaming thread's capture of Nov. 21, 2026.
- kind: other
  name: scripts/review/ordinance_scans.py
  detail: The new second-tier step chose the documents for the nations not read in the first tier; download, pages and batches prepared them, and merge-scans added the readers' items to the ordinance dispute review and the search logs. merge-scans now also flags a document whose file is another nation's (same sha256 and the other nation's name in the link).
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: Small-model reviewers read the page images of 219 documents in 43 batches; one batch re-read three documents that an earlier batch had not recorded. Claude (AI assistant) spot-checked 10 items against the page images.
purpose: Read the second tier of scanned gaming ordinances (no text layer), for the 136 nations whose text documents were already reviewed, and record their dispute procedures under the lead author's grab-now rule.
queries:
- patron, gaming public or customer disputes, complaints and claims
- employee grievances and disciplinary appeals
- licensing hearings framed as dispute resolution
- arbitration, mediation, peacemaking and Tribal court review
- Tribal-State compact terms printed in the ordinance, and bare powers to hear complaints
sources_added: []
limits: Readers read page images without OCR, so their snippets could not be checked against a text layer. 48 of the 219 documents were partly read, mostly because of the 40-page budget. The Kialegee Tribal Town 2022 link serves the Kalispel Tribe's file, so nothing was recorded for Kialegee. Only 10 items were spot-checked, and 100 low-confidence items were not checked again. 52 older scanned documents of these nations were not picked.
---

# Second tier of scanned gaming ordinances

## What was done

After the first tier ([session log](2026-11-23-ordinance-scans.md)), 137 nations still had 271 scanned documents that had not been read, though each of those nations already had a text document reviewed. `scripts/review/ordinance_scans.py second-tier` applied the first tier's rule to them: the newest full ordinance on the Commission's list (if scanned) and the scanned amendments listed on or after it, at most 3 per nation. That gave 219 documents (5,956 pages) for 136 nations. `download`, `pages` and `batches` prepared them, small-model reviewers read the page images under the [scan brief](../../reviews/briefs/2026-11-23-ordinance-scans.md), and `merge-scans` added the items to the [review](../../reviews/2026-11-22-ordinance-disputes.md).

## Result

339 procedures in 154 documents for 113 nations: 194 patron dispute, 43 employee grievance, 11 licensing hearing and 91 other (161 high, 75 medium and 103 low confidence). A spot check of 10 items against the page images kept all 10. The Kialegee Tribal Town amendment listed 2022-06-02 links to the Kalispel Tribe's file, so it is flagged `wrong-file` with nothing recorded. All 136 search logs gained entries and stay `found`.

## Not done

No profile was changed and no source record was added. Still to do:

- read the pages left by the 40-page budget in 48 documents;
- check again the 100 low-confidence items that were not checked;
- find Kialegee Tribal Town's own 2022 amendment;
- read the 52 older scanned documents that were not picked.
