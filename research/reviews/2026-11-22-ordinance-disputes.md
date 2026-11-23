# Dispute procedures in Tribal gaming ordinances

**Status:** collected Nov. 22, 2026, for the lead author, Trevor Goldsmith, to accept, change or reject (Gate 1 of the [roadmap](../../docs/roadmap.md)). Nothing here changes a profile. Each row is a lead for review, not a finding about any nation's law or practice. The lead author approved the search on Nov. 22, 2026: "gaming patron and employee grievances are worth investigating, we grab now, figure out later". So every procedure was collected, whatever it may later be called.

Every count comes from [`2026-11-22-ordinance-disputes-counts.json`](2026-11-22-ordinance-disputes-counts.json), written by [`scripts/review/ordinance_disputes.py`](../../scripts/review/ordinance_disputes.py). The procedures are in [`2026-11-22-ordinance-disputes.json`](2026-11-22-ordinance-disputes.json) and [`2026-11-22-ordinance-disputes.csv`](2026-11-22-ordinance-disputes.csv), which has an empty `lead_author_decision` column. Each nation has a search log in [`../search-logs/gaming-dispute-procedures/`](../search-logs/gaming-dispute-procedures/) ([decision record 0025](../../docs/decisions/0025-search-logs.md)). Interpretation is labeled as project analysis.

## Why these documents

The National Indian Gaming Commission required, from 1993, that a Tribe submitting a gaming ordinance describe its "procedures for resolving disputes between the gaming public and the tribe or the management contractor". The rule was 25 C.F.R. § 522.2(f) from 1993 (58 Fed. Reg. 5810, as amended) until Oct. 20, 2022. Ordinances from late 1993 already cite § 522.2(h) for fingerprints, which matches that paragraph order. A 2022 rule moved it to § 522.2(e) and asked for "a copy of the procedures" from Oct. 21, 2022 ([87 Fed. Reg. 57590](https://www.govinfo.gov/content/pkg/FR-2022-09-21/html/2022-20235.htm)). A direct final rule removed the requirement effective Dec. 1, 2025, because the Indian Gaming Regulatory Act "contains no directive about such procedures for ordinances" ([90 Fed. Reg. 46754](https://www.govinfo.gov/content/pkg/FR-2025-09-30/html/2025-19063.htm)). Today's § 522.2(f) concerns fingerprinting and criminal history checks, not disputes. Each version was read on the [eCFR](https://www.ecfr.gov/current/title-25/chapter-III/subchapter-E/part-522/section-522.2) versions of Nov. 17, 2016, Oct. 21, 2022, Sept. 30, 2025 and Dec. 1, 2025, and the rules on govinfo.gov. federalregister.gov showed a bot check and was not retried. So for about 30 years nearly every gaming ordinance had to carry a patron dispute procedure. Many still mark that section "[25 C.F.R. § 522.2(f)]".

The gaming thread had already captured all 1,167 ordinances and amendments on the Commission's list on Nov. 21, 2026 ([`research/gaming/ordinance-documents.json`](../gaming/ordinance-documents.json)). This review reads those private copies and downloads nothing.

## How it was done

1. **Scan.** `ordinance_disputes.py batches` read the text the gaming thread extracted from each PDF. It marked pages with no text layer, pages of the Commission's approval letter and tables of contents. It found candidate sections by heading (dispute, complaint, grievance, patron, claims, arbitration, mediation, hearing, appeal) and by keywords in the body. For each nation it picked the newest document on the list with a patron dispute section, the newest with an employee grievance section, and, when there was neither, the newest with another dispute or licensing hearing section. Every document checked is in the nation's search log. No OCR was available, so scanned documents were logged `scanned-unreadable`.
2. **First reading.** Small-model reviewers (Claude, AI assistant) read the 310 selected documents in 9 batches, following the [brief](briefs/2026-11-22-ordinance-disputes.md). For each procedure they recorded the kind, locator, who hears it, time limits, review or appeal, any mediation, arbitration or court step, the final decision-maker, what it refers to, and a short verbatim snippet.
3. **Quote check.** `merge` compared every snippet with the document's full extracted text, with whitespace normalized. All 512 snippets were found word for word, and none had 25 words or more.
4. **Second look.** Claude (AI assistant) read the passage behind every low-confidence item (115) and every item whose passage is garbled by an earlier scanner's character recognition (16, 8 of them also low). That made 123 items, each given a verdict with a reason. The reviewer's own fields stay beside the verdict.

Tribal legal text is link-only by default ([data model](../../docs/data-model.md#permission-statuses)). The public files therefore carry the locator, the link, summaries in the project's words and the result of the quote check (`quote_check`). The snippets themselves are kept in a private file with the project's working files (`research/ordinance-disputes/` under `/mnt/project-files/`).

## What the scan found

| Document outcome | Documents |
| --- | ---: |
| Candidate sections | 610 |
| Candidate sections, but a third or more of the pages have no text layer | 8 |
| Text read, no candidate section | 211 |
| No text layer (`scanned-unreadable`) | 330 |
| Approval letter only | 7 |
| Not captured | 1 |
| **Total** | **1,167** |

10,118 of the 34,814 pages have no text layer. The documents name 319 nations: 315 with a profile, and 4 list names the gaming catalog did not match to a profile (Bay Mills Indian Community, Mississippi Band of Choctaw Indians, Pueblo of Sandia and Seminole Nation of Oklahoma). Those rows were left unmatched, as the gaming catalog rule says. For 25 nations, every document on the list is scanned.

## What the reviewers recorded

Reviewers recorded 512 procedures in 298 of the 310 documents.

| Kind | High | Medium | Low | Total | After second look |
| --- | ---: | ---: | ---: | ---: | ---: |
| `patron-dispute` | 245 | 65 | 52 | 362 | 361 |
| `employee-grievance` | 19 | 18 | 14 | 51 | 48 |
| `licensing-hearing` (framed as dispute resolution) | 2 | 9 | 0 | 11 | 11 |
| `other` | 18 | 21 | 49 | 88 | 89 |
| Not a dispute procedure | | | | | 3 |

Second look: 118 kept and 2 changed kind. A complaint intake open to employees and the public moved from employee grievance to other; a clause by which players consent to the Tribe's jurisdiction moved from patron dispute to other (choice of forum). 3 were set aside: "disciplinary hearings" of licensees, a choice-of-law clause, and limits on remedies in license appeals.

The procedures that remain come from 264 nations with a profile: 257 with a patron dispute procedure (206 at high confidence), 37 with an employee grievance procedure, 9 with a licensing hearing framed as dispute resolution and 74 with another procedure. 23 of those nations have only low-confidence items. Their steps name arbitration in 39 items, mediation in 11, a Tribal court in 96 and peacemaking in none.

Patterns among the patron dispute items (project analysis, from the reviewers' fields):

- Most run from the gaming operation's management to the Tribal gaming commission or regulatory authority, often with a hearing, a 30-day filing limit and a cap on claims. The commission or authority decides last in 181 items. A court (usually the Tribal court) does so in 70. 113 do not say who decides last.
- 153 point to another text for the procedure: the Tribal-State compact (56 of all kept items), the commission's regulations, Secretarial Procedures (8) or a tort claims ordinance.
- 17 name arbitration and 9 mediation; 76 name a court step.
- Many low-confidence items are only a commission power or duty, "to hear patron complaints" or for inspectors to "assist in seeking voluntary resolution". `other` items include management contract requirements to provide dispute mechanisms, a commission's power to arbitrate or settle its own disputes, and duties to create a forum for per capita payment disputes.

## Judgment calls for the lead author

These were not reversed. Each is marked in `flags` or in the second look's reason.

1. **Tribal-State compact terms printed in an ordinance.** Reviewers treated them differently. The Pawnee Nation amendment of 2022 has its compact's tort and prize claim terms recorded with `refers_to` (`compact-terms-recorded`). The Dry Creek Rancheria amendment of 2019 had compact sections skipped (`compact-terms-skipped`). In all, 21 skipped passages mention the compact. Decide whether compact claim terms copied into an ordinance count.
2. **General Tribal court appeal clauses.** Clauses letting anyone affected by a commission decision appeal to the Tribal court were mostly skipped as not framed as dispute resolution. One example is the Pueblo of Acoma amendment of 1998, whose document has no item for this reason. Some were kept, for example Pueblo of Tesuque 2002 and the Alturas Indian Rancheria interim rule of 1999. 89 skipped passages mention a court.
3. **Commission powers "to hear complaints".** These were recorded at low confidence; a word search of the summaries puts them at 51 of the 115 low items. Decide whether a bare power is enough for a record.
4. **Overlap.** The Northern Arapaho Tribe's 2013 and 2017 amendments and the Northern Cheyenne Tribe's 2011 amendment share sections 802 (patron disputes over particular wagers) and 803 (appeal to Tribal court). Their 15 items are flagged `check-overlap`, to check for duplicates and for which version is in force.
5. **Dispute chapter not in the passages.** In the Colorado River Indian Tribes amendment of 2009 and the Confederated Tribes of the Chehalis Reservation amendment of 2017, the passages held only the table of contents. The whole document needs reading; both are flagged `needs-full-document-read`. The same applies to items that rest only on a heading (Nottawaseppi Huron Band, 2011), on appendices not in the passages (Seneca Nation, 2009), or on a passage that cannot be read (Kickapoo Tribe in Kansas, 2007).
6. **Other kinds.** Decide whether management contract dispute requirements, per capita dispute forums and a commission's power to arbitrate its own disputes belong in the dispute resolution data at all.

## Lead author's answer, Nov. 23, 2026

On calls 1 and 3 the lead author wrote: "I don't know for those questions .too unclear. Just grab it and we can deal with the info later?" `scripts/review/ordinance_disputes.py grab` applied that answer:

- The 21 compact passages that first readers set aside are now items of kind `other`, flagged `compact-terms`, at low confidence. Their summary is the first reader's note; the passages were not read further and carry no snippet.
- 100 items that set out no steps of their own are flagged `no-steps`. Most are a commission's bare power to hear complaints or disputes; a few only point to a compact or management agreement. The flag was set by a word search of the summaries and second-look reasons, so it may miss or over-include a few.
- Every item, 533 in all, is marked `keep` in `lead_author_decision`. Filter on the `flags` column to set these groups aside later.

Calls 2, 4, 5 and 6 are unchanged. The skipped general Tribal court appeal clauses (call 2) were not added.

## Documents with nothing recorded

12 selected documents had no item, each with the reviewer's reason in `documents_without_items`. 2 are the passage gaps above. The others hold only licensing hearings, enforcement or commission membership rules with no dispute framing (Crow Creek Sioux 1994, Crow Tribe 2015, Forest County Potawatomi 1997, Morongo 1995, Nooksack 1993, Ottawa Tribe of Oklahoma 1998, Pueblo of Acoma 1998, Puyallup 2000, Shakopee Mdewakanton 2013). Santa Ynez 2008 names a dispute procedure in a list without its text. For 6 of these nations, older documents where the script found candidate sections were not given to reviewers; their search logs say so.

## Search logs

315 logs, one per nation with a profile, list 1,163 searches (one per document; a document shared by two list rows is listed under each).

| Status | Nations |
| --- | ---: |
| `found` | 270 |
| `partly-searched` (a scanned or missing document, or a passage gap) | 32 |
| `none-found` | 13 |

264 of the found nations have a procedure the reviewers recorded. In the other 6, only the script's leads in older documents found something. The table shows the logs as of Nov. 22; the next section gives the statuses after the scanned documents were read.

## Scanned ordinances read from page images, Nov. 23, 2026

32 nations were `partly-searched` on Nov. 22, 31 of them because their documents are scans with no text layer. The script [`scripts/review/ordinance_scans.py`](../../scripts/review/ordinance_scans.py) picked, for each of those nations, the newest full ordinance on the list (if it is scanned) plus the scanned amendments listed on or after it, at most 3. It downloaded each PDF again from the Commission's public link, one at a time with a pause. All 53 downloads succeeded, and each file matched the gaming thread's earlier capture (sha256). Small-model reviewers (Claude, AI assistant) then read the page images, following the [scan brief](briefs/2026-11-23-ordinance-scans.md). No OCR was run. The page images of three documents (Metlakatla Indian Community 1997, Miccosukee Tribe 1994, Organized Village of Kake 2000) dropped out of the first batch, and those documents were read again in a later batch.

| | Count |
| --- | ---: |
| Nations with a document read | 31 |
| Documents read | 53 |
| Pages in those documents | 1,791 |
| Pages read as images | 1,322 |
| Documents read in full | 44 |
| Documents partly read | 9 |
| Documents with no item | 15 |

The 9 partly read documents are flagged `partly-read` on each of their items, with `verification: title-only`:

- **Pages that dropped out:** Wilton Rancheria 2019 (pages 1–12, 21–22, 25–34, 38–42 and 45–49 were not seen) and Navajo Nation 2019 (pages 1–6 could not be read).
- **The 40-page budget for long documents:** Pueblo of Nambé 2016, Pueblo of Isleta 2000 and 2024, Seneca-Cayuga 2013, Shinnecock 2020 (pages 41–44), Navajo Nation 2003 and 2019, and Shoalwater Bay 2019 (page 41).

Readers recorded 75 procedures in 38 documents.

| Kind | High | Medium | Low | Total |
| --- | ---: | ---: | ---: | ---: |
| `patron-dispute` | 30 | 4 | 7 | 41 |
| `employee-grievance` | 5 | 2 | 5 | 12 |
| `licensing-hearing` | 4 | 3 | 0 | 7 |
| `other` | 3 | 5 | 7 | 15 |
| **Total** | **42** | **14** | **19** | **75** |

The items join the review files with ids ending `#p<n>` and the lead author's grab-now decision. They have no text layer, so the snippets could not be checked against the document. Each item's `quote_check` says "copied from the page image; no text layer to check", and the snippets are in the private copy only. The `grab` flags apply: 12 items refer to the Tribal-State compact (`compact-terms`, set from the `refers_to` wording) and 11 set out no steps (`no-steps`).

**Spot check.** Claude (AI assistant) checked 10 items against the page images. Six were chosen because the lead session asked for them, and four were drawn at random (seed 20261123). The result is in each item's `second_look`; the reader's own fields are unchanged.

- 5 were kept as recorded: Seneca-Cayuga 2013 (Office of Gaming Appeals), Torres-Martinez 2020, Pueblo of Jemez 2005, Pueblo of Nambé 2016 and Pinoleville 2004.
- 2 are `not-in-force`: the low-confidence Navajo Nation 2019 items quote sections that the amendment strikes through, so the amendment deletes them. One of their snippets also corrects the document's "patrol" to "patron", so it is not word for word.
- 3 are `not-a-dispute-procedure`: Shoalwater Bay 2012 and 2019 (12-14.01) and Coquille 2020 (section 12 of chapter 198) are ordinary licensing hearings. Their only framing is the word "disagree(s)", which the brief does not count as dispute framing.

So 5 of the 10 would change. Page numbers were right in all 10, and 9 of the 10 snippets matched the page word for word. The other 16 low-confidence items were not checked again.

**Search logs.** Each of the 31 nations' logs gained one entry per document read, and their statuses changed as follows:

- 25 moved to `found`. For Wilton Rancheria and Navajo Nation, the pages that dropped out are listed in `next_steps`. Those logs are `found` rather than `partly-searched`, because the search-log schema calls a log `found` once any search found something.
- 6 moved to `none-found`: Confederated Tribes of Siletz Indians, Confederated Tribes of the Warm Springs Reservation, Metlakatla Indian Community, Morongo Band of Mission Indians, Pueblo of Sandia and Quileute Tribe. Some of their files are only an approval letter or a resolution: the Morongo 2010 amendment and the ordinance attached to Sandia's 1995 resolution are not in the list's copies.

The Confederated Tribes of the Chehalis Reservation stays `partly-searched`: it has no scanned document, but its 2017 text amendment still needs a full reading. In all, the 315 logs now stand at 295 `found`, 19 `none-found` and 1 `partly-searched`.

**Not read yet (second tier).** 137 other nations have 271 scanned documents (7,203 pages) that are older or sit beside text documents the first review already read. The same rule would pick 219 of them (5,956 pages) for 136 nations. Two more scanned documents belong to list rows with no profile (Mississippi Band of Choctaw Indians, 2010, and Seminole Nation of Oklahoma, 2009). None of these were downloaded. Their logs still list them as `scanned-unreadable`, but those nations already had a document that was read.

**Approval letter pages.** The batch builder marks a page as the Commission's approval letter only when the page has a text layer. The first run marked pages with the Commission's name and "chair", which also caught ordinance text (Siletz 2024, pages 25–26; Isleta 2024, pages 170–171) and a Tribal resolution (Kake 2000, page 3). The check now also needs "Dear" or "Sincerely". A letter scanned as an image cannot be recognized without OCR, so readers read those pages too.

## Limits

- **Readers.** Small models made the first reading from extracted passages, not whole documents. The second look covered low-confidence and garbled items only. Medium and high items were checked by the quote check, and Claude (AI assistant) spot-checked six at random, but they were not re-read one by one.
- **Newest document only.** Older ordinances were scanned, not reviewed, so a procedure that changed over time shows only its latest listed form. The list's copy may not be the nation's current law.
- **Scanned documents.** 330 documents (10,118 pages) have no text layer. 53 of them were read from page images on Nov. 23 (see above); the other 277 were not read. Page-image snippets could not be checked against a text layer. Some text came from an earlier scanner's character recognition and is garbled; snippets kept its misspellings.
- **Regulations not on the list.** Many ordinances leave the procedure to commission regulations or a compact. Those texts were not searched here.
- **Absence.** "None found" means only that the listed documents had no procedure in the text read on this date (project analysis).

## Files

- Procedures: [JSON](2026-11-22-ordinance-disputes.json), [CSV](2026-11-22-ordinance-disputes.csv), [counts](2026-11-22-ordinance-disputes-counts.json).
- Search logs: [`research/search-logs/gaming-dispute-procedures/`](../search-logs/gaming-dispute-procedures/).
- Briefs: [`briefs/2026-11-22-ordinance-disputes.md`](briefs/2026-11-22-ordinance-disputes.md) and, for the scans, [`briefs/2026-11-23-ordinance-scans.md`](briefs/2026-11-23-ordinance-scans.md).
- Scripts: [`scripts/review/ordinance_disputes.py`](../../scripts/review/ordinance_disputes.py) and [`scripts/review/ordinance_scans.py`](../../scripts/review/ordinance_scans.py).
- Session logs: [`research/sessions/2026/2026-11-22-ordinance-disputes.md`](../sessions/2026/2026-11-22-ordinance-disputes.md) and [`research/sessions/2026/2026-11-23-ordinance-scans.md`](../sessions/2026/2026-11-23-ordinance-scans.md).
- The batches, verdicts, second-look file and snippets are kept privately outside the repository, because they hold text of Tribal laws.
