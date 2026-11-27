---
id: 2026-11-27-petition-documents
date: '2026-11-27'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: One session added the link step to scripts/law/acknowledgment_petitions.py and ran it; no record was written by hand.
- kind: page-fetch
  name: bia.gov
  detail: The Office of Federal Acknowledgment's two petition lists and each petition's page, read again on Nov. 27, 2026.
- kind: page-fetch
  name: Federal Register API
  detail: The four acknowledgment notices the petition pages link that had no record (95-13172, 97-4837, 96-10685, 96-10686).
purpose: 'Trevor asked that a petitioning nation''s page show its petition documents ("if petitioning, we should show petitioning documents", project thread "Find each nation''s first federal recognition document", Nov. 27, 2026). This session links every petition''s records to the nation''s profile and gives the petitioners'' documents and the public comments records of their own.'
queries:
- The Office of Federal Acknowledgment's Resolved Petitions list (bia.gov/as-ia/ofa/resolved) and Petitions in Process list (bia.gov/as-ia/ofa/petitions-in-process), Nov. 27, 2026, and each petition's page
sources_added: []
limits: 'Only the petition pages were read, so every new record is Unverified. A petitioner''s document or a public comment with no year on the page takes the year in the file name the Office gave it, where there is one. About 280 older petitioners have no page on the Office''s site; their Federal Register notices are not yet linked.'
---

# Petition documents on nation pages: session notes

## What was built

`scripts/law/acknowledgment_petitions.py link` reads the petition pages (saved at `research/raw/2026-11-27/acknowledgment-petition-pages.json`) and matches each petition to a nation's profile by the petition number in the profile's recognition facts. Numbers are compared without leading zeros ("057" and "57" are one petition). One petition is matched by hand: the Office numbers the Fernandeño Tataviam Band of Mission Indians 158, and its profile gives 403, the number of its later petition.

For each petition, the step adds the nation, and the topic `federal-recognition`, to the Department's records (`acknowledgment-<number>-...`), to the Federal Register notice records the page links, and to the Interior Board of Indian Appeals decision records it links. It edits only those two lists in each record and checks that nothing else changed.

The petitioners' own documents and the public comments are not government works. Each now has a record of kind `other`, with rights `link-only`, that cites the document and links the Office's copy; the project's copy stays private. A comment's record names the person or body that commented as its author.

## Results

All 75 petitions with a page matched a profile. 210 existing records were linked (92 of the Department's documents, 84 Federal Register notices and 34 Board decisions; the rest of the Department's records already named their nation), and 240 records were written for the petitioners' documents (137) and the public comments (103). A Board decision's record also names the petitioner in `nations_in_case`, as a party, under the name the decision gives it. Four Federal Register notices the pages link had no record, because the API files them under the Department of the Interior rather than the Bureau of Indian Affairs: 60 Fed. Reg. 28426 (May 31, 1995), 62 Fed. Reg. 8983 (Feb. 27, 1997), and the two notices at 61 Fed. Reg. 19314 (May 1, 1996). Each now has a record and a stored copy (`scripts/law/federal_register_documents.py file` and `records`, run on those four alone).

## Nation pages

A nation with a petition number shows, under Treaties and federal ties, an "Acknowledgment petition" row with the number and status, and a "Petition documents" table with the year, the document and who it is from, as Trevor approved from the mockup on Nov. 27, 2026 (project files, `design/petition-documents/`). A record with its own page links there; a petitioner's document or a comment links the Office's copy.

## Next

Find the Federal Register notices of the petitioners that have no page on the Office's site (about 280, mostly before 1994), and read each finding's date from the document itself.
