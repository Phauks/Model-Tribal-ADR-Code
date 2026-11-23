---
id: 2026-11-23-text-read-tier
date: '2026-11-23'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: 'A lead session and its readers: small-model readers gave every record a first reading from the project''s own files (15 batches, 5 of them re-reading OCR records from page images); larger-model readers gave a second reading to every record a first reader found (6 batches) and searched the web once for the texts the project does not hold (6 batches); the lead session checked the merged results and read three records itself.'
- kind: page-fetch
  name: Page fetcher
  detail: Nations' code sites, the National Indian Law Library, the Indigenous Peacemaking Initiative library and court pages, fetched only where a search returned them; sites with a bot check, a sign-in or JavaScript-only pages were recorded as blocked and not retried.
- kind: web-search
  name: Web search
  detail: At most about three searches per record, with the nation and the section heading or number.
- kind: other
  name: pdftotext and pdftoppm (Poppler)
  detail: Text extracts from the bucket copies, and page images of scanned pages, which were read visually (no OCR engine was used).
purpose: 'Gate 1, item 3 of the roadmap: confirm the text-read tier of every dispute resolution record and gaming compact dispute clause a draft of the model code is likely to rely on, after the lead author asked whether the documents added since the analysis change things (Nov. 23, 2026).'
queries:
- <nation> <section number or heading> (for example "Sauk-Suiattle Gaming Ordinance 1999 7.3 dispute resolution")
- <nation> tribal code arbitration ordinance
- <nation> peacemaking code OR peacemaker court
- site:narf.org/nill <nation> code
sources_added:
- siletz-tribal-court-rules-and-procedures-2015
- siletz-tribal-code-3-300-community-law-court-2005
- colville-tribal-code-chapter-5-2-juveniles
- ctuir-family-law-code-2024
- ctuir-workers-benefit-code-2020
- fort-mcdowell-gaming-ordinance-2020
- ho-chunk-4-hcc-18-custody-placement-2024
- hoopa-valley-title-13-tero-2023
- karuk-tribal-code-10-10-270
- karuk-tribal-code-10-05-040
- kiowa-tribe-court-codes
- lco-tribal-code-dmr-1-3-120
- little-traverse-wotcl-2024-2
- nhbp-tribal-code-5-3-labor-relations
- oneida-indian-nation-peacemaking-rules-1997
- kake-circle-peacemaking-manual-2005
- pascua-yaqui-title-5-chapter-9-mediation-2019
- pokagon-native-justice-resources
- pueblo-of-laguna-gaming-control-ordinance-2013
- srpmic-code-chapter-11-minors
- santee-sioux-judiciary-act-2000
- sauk-suiattle-gaming-ordinance-1999
- sault-ste-marie-tribal-code-chapter-36-juvenile
- chickasaw-peacemaking-a-way-of-life-2007
- three-affiliated-tribes-gaming-ordinance-1994
- smith-river-rancheria-childrens-code-2006
- yurok-tribal-code-9-20-010
sources_updated: []
limits: 'Every reading is the assistant''s and awaits the lead author''s review. Fifty-two records could not be read from the nation''s own text: the National Indian Law Library says many of these nations have not allowed their codes online, and the other copies sit on sites that refused automated requests (Municode, eCode360, codepublishing.com, tribal.codes and some nations'' own sites), which the project does not try to get past. A fetch-and-summarize tool''s summary was never counted as reading. The Shoshone and Arapaho draft Peacemaker Court text was not sought, because the Tribes have withheld it. Records already marked read-in-full whose notes do not mention OCR or a summary were not re-read; they rest on the earlier reviews named in their notes.'
---

# Confirming the text-read tier (Gate 1, item 3): session notes

Gate 1 of the [roadmap](../../../docs/roadmap.md#gate-1-review-of-the-pull-request-2-data) asks that every record a draft of the model code is likely to rely on rest on the nation's own text, read, and that records read by OCR or through a fetch-and-summarize tool be re-read where they matter (item 3; [analysis, review queue item 10](../../analyses/2026-11-21-dispute-resolution-practice.md#9-review-queue)). On Nov. 23, 2026 the lead author asked for item 3 to start, and whether the documents added since the analysis change things. They do. This note records how the check was run and what it found. The record-by-record results are in [`research/reviews/2026-11-23-text-read-tier.json`](../../reviews/2026-11-23-text-read-tier.json), and the readers' briefs are in [`research/reviews/briefs/2026-11-23-text-read-tier.md`](../../reviews/briefs/2026-11-23-text-read-tier.md).

## Scope

The records in scope are the ones a draft could cite as a nation's practice: the dispute resolution forums, provisions, clauses, published materials and training programs in `content/tribes/`, and the dispute clause summaries of gaming compacts, 627 records in all. Database listings are out of scope, because they are kept apart from provisions and are not relied on as practice ([decision record 0015](../../../docs/decisions/0015-database-listings-apart-from-provisions.md)).

`python3 scripts/review/text_read_tier.py select` found 172 of the 627 not yet confirmed (project count):

| Why the record was not confirmed | Records |
| --- | --- |
| Known only by a section heading (`title-only`) | 71 |
| Details inferred, often from a secondary page (`inferred`) | 31 |
| Copied from a database without reading the code (`bulk-import`) | 18 |
| Marked `read-in-full`, but its own note says the text was not read (a NARF description, a dead link, a heading only, or a summary tool) | 22 |
| Marked `read-in-full`, but read by OCR or from a garbled text layer | 30 |

The other 455 were already read from the nation's text in earlier reviews, including the compact clause re-check of Nov. 22, 2026, which left 284 of 286 compact summaries read from each nation's own compact ([compact clause re-check](2026-11-22-compact-clauses-recheck.md)).

## Method

1. **Match to the project's copies.** For each record, the select step listed the files in the capture index (`research/capture-index.csv`, about 16,300 files) filed under the record's source or the nation.
2. **First reading.** Small-model readers opened those files from the bucket, found the section and checked every claim in the record against it, quoting the text. They used no web. Scans with no text layer were read from page images. The 30 OCR records were all re-read from page images.
3. **Second reading.** Every record a first reader said it had found went to a larger-model reader, who checked the quotation word for word, read the section independently and wrote the final values for each field to change. Second readings changed most first-pass results, mostly summaries that left out how a case reaches the forum or whether the result is enforced, as an earlier review had found (project count, `stage` and `first_reading` in the review file).
4. **One web search.** For the records no project file held, a reader searched the web once, at most about three searches and three fetches per record, preferring the nation's own site, then the National Indian Law Library's full text, then the Indigenous Peacemaking Initiative's library. A summary from the fetch tool never counted as reading. Pages behind a bot check, a sign-in or JavaScript were recorded as blocked and not retried. Texts read in full on the web were filed in the bucket with `scripts/captures/mirror_captures.py add` (seven new captures; the Santee Sioux Judiciary Act matched a copy already filed).
5. **Lead check and apply.** The lead session merged the readings and read three records itself: Karuk Tribal Code §§ 10.10.270 and 10.05.040, and § 7.3 of the Sauk-Suiattle Gaming Ordinance, from copies filed that day that the readers had missed. It cited the Alabama-Coushatta constitution record to the July 2023 publication in effect, after checking that its Article XIII reads the same. It named the 1995 Nez Perce and 1990 Shakopee compacts as the versions two compact records describe on purpose. It then applied the results with `python3 scripts/review/text_read_tier.py apply`. The apply step changes only the lines of each record that changed, adds the 27 new source records and adds the places searched to each nation's search log (`research/search-logs/dispute-resolution/`).

Every confirmed record's note now says when and from what it was read, and points to its entry in the review file. Every record that could not be confirmed keeps, or drops to, an honest level, and its note says why.

## Result

**575 of the 627 records now rest on the nation's own text, read** (455 before this review plus 120 now). The remaining 52 are unread and labeled as such (project count, `select` after `apply`).

| Category | Confirmed | Corrected | Flagged | Not confirmed | Total |
| --- | --- | --- | --- | --- | --- |
| Section heading only | 5 | 25 |  | 41 | 71 |
| Inferred | 7 | 19 |  | 5 | 31 |
| Database copy | 5 | 8 |  | 5 | 18 |
| Labeled read, but not read | 2 | 18 | 1 | 1 | 22 |
| OCR | 24 | 6 |  |  | 30 |
| **All** | **43** | **76** | **1** | **52** | **172** |

"Corrected" means the text was read and at least one claim was wrong, missing or overstated. The fields most often changed were the locator (52), summary (43), as-of date (35), citation (25), title (21) and relationship to the court (15). The 120 read records were read from a text layer (59), from page images (46) or from a web page's HTML (15), and the second readers rated 106 of them high confidence and 14 medium.

**What the new documents changed.** Of the 120 records now read, 34 were read from documents filed on Nov. 23, 2026 (the retry of failed fetches and the hand pulls), and 16 from texts found on the web in this review and now filed. The other 70 were in files the project already held but had never been read against the record (project count, capture dates in the capture index).

Five of the 22 records labeled read when they were not are worth knowing about: the label had come from a NARF description or a dead link. Eighteen are now read and corrected. Grand Ronde's Tribal Court Ordinance (`confederated-tribes-of-the-grand-ronde-community-of-oregon`, provision 0) was relabeled `bulk-import`, because NARF's copy is a dead link.

## For the lead author

These need a decision, not more reading (the review file gives each record's findings):

- **Nisqually, "24.19 Mediation of Disputes"** (`nisqually-indian-tribe`, provision 2): the Tribe's current Title 24 makes 24.19 Post Trial Procedures, and no mediation section appeared. Withdraw the record, or find the older code it came from.
- **Tulalip, Alternative Court Code** (`tulalip-tribes-of-washington`, provision 1, record 581): read in full; it sets up the Wellness Court and a plea-agreement program in criminal procedure. The second reader judged it not dispute resolution; it is kept under the grab-now rule and marked in its note.
- **Seminole Nation, § 809, Internal Dispute Resolution Policy** (`the-seminole-nation-of-oklahoma`, provision 0): an employee workplace policy, seen only in summary.
- **Minnesota Chippewa Tribe compact** (`minnesota-chippewa-tribe`, compact 0): the record summarizes the Prairie Island Indian Community's compact. The Tribe is not a party; its member bands have their own compacts.
- **Grand Traverse Band peacemaking** (`grand-traverse-band-of-ottawa-and-chippewa-indians`, forum 1): the only source is the 1999 Honoring Nations report; it stays `inferred`.
- **Eastern Band of Cherokee Indians training materials and the Pokagon Band's 2019 training**: known only from NARF news items; no nation text is expected.

## Decisions (Nov. 23, 2026)

Trevor confirmed the review and gave the go-ahead for the fixes proposed above ("You can do those fixes"):

- **Nisqually, "24.19 Mediation of Disputes"** was withdrawn from the profile. The Tribe's current Title 24 makes 24.19 Post Trial Procedures, and the record rested only on the National Indian Law Library's 2016 table of contents. The Nisqually mediation provisions in Title 50 remain. The withdrawal is recorded in the nation's search log.
- **Minnesota Chippewa Tribe compact** was removed. The Tribe is not a party to a gaming compact; its member bands hold their own, recorded on the band profiles ([decision record 0016](../../../docs/decisions/0016-component-bands-own-profiles.md)). The record had summarized the Prairie Island Indian Community's compact.
- **Tulalip Alternative Court Code** and **Seminole Nation § 809** stay as recorded, under the grab-now rule, with their notes saying what each covers.
- **Grand Traverse Band peacemaking** stays `inferred` until the search in pull list 4g returns the Band's own text.

After these changes, 575 of 625 records in scope are read from the nation's own text, and 50 are unread (`select`, run after the changes).

## The 52 not confirmed

| Why | Records |
| --- | --- |
| The National Indian Law Library says the nation has not allowed the text online, or no copy was found | 29 |
| The only copy is on a site that refused automated requests (Municode, eCode360, codepublishing.com, tribal.codes or the nation's own site) | 9 |
| A copy was seen only through a summary tool | 7 |
| The text found does not settle the record, or does not contain the section | 4 |
| Dead link | 2 |
| The heading appears not to concern dispute resolution | 1 |

Each is on the pull list (`/mnt/project-files/research/documents-to-get.md` in the project files). New section 1h has four nations' PDFs to download, 2i has eight code pages to save from a browser and leads for open rows of 2g and 2h, and 4g has the Red Lake 1991 compact and the Grand Traverse search. Two new Part 6 requests ask the National Indian Law Library for ten nations' withheld code sections and the Shingle Springs Rancheria for two documents.

Of the two compact summaries not read from the nation's own compact, Red Lake's 1991 compact is not posted online, and the Minnesota Chippewa Tribe's record needs correcting, as above.

## Limits

See `limits` above. In short: the readings are the assistant's and await the lead author's review, and 52 records are still unread.
