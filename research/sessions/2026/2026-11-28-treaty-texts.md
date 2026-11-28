---
id: 2026-11-28-treaty-texts
date: '2026-11-28'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: One session wrote scripts/law/treaty_texts.py and ran it; no record was read or written by hand.
- kind: page-fetch
  name: govinfo.gov, archive.org and treaties.okstate.edu
  detail: The GovInfo scans of Kappler's vols. 1 to 5 and of 32 other Serial Set documents, GovInfo's full-text search of the Serial Set, the Internet Archive's scans of American State Papers, Indian Affairs, vols. 1 and 2 and of the Hawaiian Kingdom's 1887 treaty book, and the Oklahoma State University Tribal Treaties Database's record page for each treaty record without a stored copy, at about one request a second.
purpose: 'Trevor asked for a public-domain copy of the text of each treaty and treaty-related record that has no stored copy, so that its page shows the text (Nov. 28, 2026). The database''s transcriptions are third-party and are not republished; the text comes from government printings instead.'
queries:
- Every record of kind intergovernmental-agreement, type treaty or document, whose original link, citation link and file checksum match no served copy in research/capture-index.csv
- Each such treaty record's transcription on the database's page, looked up word sequence by word sequence in every page of each printing
- 'GovInfo full-text search of the Serial Set for four phrases from each record not found in Kappler or American State Papers (content:"..." with a date range from the year before the document)'
sources_added: []
limits: 'Of 324 treaty records without a copy, 156 now have a stored text and 41 are on a review list (research/reviews/2026-11-28-treaty-text-matches.csv) because the best run of pages holds less than three fifths of the transcription or too little of what only that record has. The other 127 were not found in any printing searched: most are unratified treaties and agreements that Kappler did not print and that GovInfo''s search did not turn up, and two (the instruments of cession of Tutuila and Manua) have no database page to match by. The stored texts are machine-read and carry whole pages, so a first or last page can hold part of the paper before or after. The 1,102 document records (gaming compacts, county and state agreements, a university repository''s water settlement papers) have no public-domain government printing and were left alone. Every record stays Unverified.'
---

# Public-domain texts for treaty records: session notes

## What was built

`scripts/law/treaty_texts.py` finds each record without a served copy (`missing`), downloads the printings and splits them into pages (`volumes`), finds each record's pages (`match`), searches the Serial Set on GovInfo for the ones not found (`search`), stores the texts in the project's bucket under `treaties/<key>.txt` and checks them by size and SHA-256 (`store`), and gives each record a `file` block with the text's checksum (`apply`).

A record is matched by the database's transcription, which is used only to find the document: the run of pages in a printing that holds at least three fifths of its three-word sequences, and at least half of the sequences no other record's transcription has, with the year (in figures or in words) on its first pages. The stored text is the printing's own text for those pages, under a heading naming the printing and pages.

## Results

The 156 stored texts come from Kappler's Indian Affairs: Laws and Treaties (vol. 1, 36; vol. 2, 21; vol. 3, 9; vol. 4, 21, among them the eighteen California treaties of 1851 and 1852; vol. 5, 11), 43 from 32 other Serial Set documents on GovInfo, 9 from American State Papers, Indian Affairs, 5 from the Hawaiian Kingdom's own printing of its treaties (1887), and the Jay Treaty from the Statutes at Large (8 Stat. 116). Each record's notes name the printing and pages, and its rights now say why the text may be served.

Records that the database lists twice (the Crow agreement of 1880, the Choctaw and Chickasaw agreement of 1901) point to the same pages under each key.
