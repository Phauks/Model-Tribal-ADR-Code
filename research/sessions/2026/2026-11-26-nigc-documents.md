---
id: 2026-11-26-nigc-documents
date: '2026-11-26'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: One session wrote scripts/law/nigc_documents.py and ran it; no record was written by hand.
- kind: page-fetch
  name: nigc.gov
  detail: The six reading room tables of the National Indian Gaming Commission and the 1,077 documents they link, six at a time.
purpose: 'Trevor asked to build tier 2 of the data roadmap to completion (project thread "Build tier 2 federal sources", Nov. 26, 2026). After the Interior Board of Indian Appeals, this session gives each document in the National Indian Gaming Commission''s reading room its own source record and a stored copy, served by the site.'
queries:
- The reading room tables for Indian lands opinions, game classification opinions, management contract declination letters, enforcement actions, Commission final decisions and bulletins (nigc.gov, Nov. 26, 2026)
sources_added: []
limits: 'The records carry the tables'' facts (title, date, nation, tracking or bulletin number); nobody has read the documents, so every record is Unverified. Two linked documents could not be had: the Poarch Band of Creek Indians Indian lands opinion (Tallapoosa site, 2008), whose link in the table is broken, and a Kalispel Tribe declination letter, which answers 404. The approved gaming ordinances (1,168 documents) were already held and are not part of this session.'
---

# Records for the National Indian Gaming Commission's reading room: session notes

## What was built

`scripts/law/nigc_documents.py` has three steps. `fetch` reads six tables of the Commission's reading room and downloads the document each row links. `file` stores each document in the bucket under `nigc/<table>/<file>` and adds it to the capture index, served as a work of the United States government. `records` writes one source record per document.

## Records

The Commission's final decisions are adjudications, so each is a case (`federal-case`, authority National Indian Gaming Commission), named "In re" the nation or company, with the nation it names. Every other document is a new kind, `federal-agency-document`: an Indian lands opinion, a game classification opinion, a management contract declination letter, an enforcement action (a notice of violation, a civil fine assessment, a settlement agreement, a temporary closure order and the like, with its tracking number) or a bulletin (with its number). The date is the table's. The nation is matched by name against the nation profiles and the Commission's own ordinance list (`scripts/law/nation_names.py`).

One notice of violation, CO-03-02 (Sac and Fox Tribe of the Mississippi in Iowa), is posted only as a Word file; it is stored and served as posted. One settlement agreement's link (SA-09-25, Pit River Tribe) carries a stray quotation mark, which the script removes.

## Results

1,077 of 1,079 documents are stored and served, dated Sept. 14, 1992 to Oct. 29, 2026: 101 Indian lands opinions, 122 game classification opinions, 326 declination letters, 360 enforcement actions, 65 final decisions and 103 bulletins. They have 1,068 records: where a table lists one document twice, with the same title and date, it gets one record, and where the Commission answered several entries in one file (two games in one letter, two parcels in one opinion), each entry keeps its record and the records list each other. They are listed together at /stats/national-indian-gaming-commission.

## Next

A person reads each document for its holding; the final decisions and Indian lands opinions first, since nations cite them.
