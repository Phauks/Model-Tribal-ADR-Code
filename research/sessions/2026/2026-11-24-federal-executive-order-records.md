---
id: 2026-11-24-federal-executive-order-records
date: '2026-11-24'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: One session wrote scripts/law/executive_order_records.py and ran it; no record was written by hand.
- kind: page-fetch
  name: treaties.okstate.edu, federalregister.gov and govinfo.gov
  detail: The Oklahoma State University Tribal Treaties Database's listing page and its 562 executive order pages, at about one request a second; the Federal Register API's entries for 42 orders published since 1994 and their PDFs from GovInfo.
purpose: 'Trevor asked to cover federal Indian law in full, starting with tier 1 (Nov. 24, 2026, after the coverage spike in research/analyses/2026-11-24-federal-laws-and-treaties-coverage.md). This session gives every presidential executive order on Indian affairs that the Oklahoma State University database lists, and the modern Indian-affairs orders in the Federal Register, its own source record with a stored copy of its text.'
queries:
- Every executive order in the Oklahoma State University Tribal Treaties Database, with its president, number, date, scan link and text
- The Federal Register entry for each numbered order published since 1994, and for the 18 orders since 1994 with an Indian term in their title
sources_added: []
limits: 'The records carry the database''s and the Federal Register''s metadata; nobody has read the texts against the titles and dates yet, so every record is Unverified. The database is not complete: Kappler''s volumes reproduce reservation orders it does not list, such as the Colville orders of 1872, the Coast Reservation order of 1855 and the Spokane order of 1881, which already had records from the Nov. 23 jurisdiction session. The stored text of the 525 orders before 1994 is the database''s transcription, not a scan of the printed page; the database''s scans are on the Oklahoma State University digital collections site, which this session''s network could not reach.'
---

# Records for every executive order on Indian affairs: session notes

## What was built

`scripts/law/executive_order_records.py` has three steps. `fetch` reads the database's listing (562 executive orders, from 1836 to 2023) and each order's page: the president, the identifiers (the order's number and, for later orders, the Federal Register citation), the links to a scan and another source, the date and the text. It then asks the Federal Register API for every numbered order since 1994 in the database and for the 18 modern Indian-affairs orders the coverage note lists, and downloads each one's PDF from GovInfo. `file` stores a copy of each order in the project's bucket under `executive-orders/<key>`: the Federal Register PDF where there is one (41 orders), otherwise the order's text as the database transcribes it, with a header naming where it came from (525 orders). `records` writes the source records.

The database's 562 orders are not all reservation orders: 395 are numbered orders (Executive Order 38 to Executive Order 14112, most from 1900-1945), many of them on allotment trust periods, Indian schools and the Indian Service, and 167 are unnumbered orders from 1836 to 1904, nearly all of them the reservation orders Kappler reproduces. Four of the 18 modern orders are not in the database (13104, 13774, 13809 and 14031) and come from the Federal Register alone, for 566 orders in all.

## Record keys and dates

A numbered order's key is `executive-order-<number>` (`executive-order-1529`, `executive-order-13175`); an unnumbered order's is `executive-order-<date>-<place>` from the database's title (`executive-order-1882-01-24-sioux-reserve`). The 41 orders that already had a record (35 matched by the database address or number, six by date and place) keep their key and text and gain the stored copy.

Dates come from the Federal Register's signing date where there is one, then from the date in the database's title (174 orders), then from the date line that opens the database's text of the order (350 orders; in every case the first line of the text is a date).

## Results

525 new records and 41 existing records with their copy: every one of the 566 orders now has a record and a stored copy. The records carry no `tribes`; which nations each order concerns is for a later pass, as with the treaties.

## Next

Read a sample of the orders against Kappler's printed text (archive.org has Kappler vol. 1 as `bp_996062`) and record the Kappler page in each record. Add the reservation orders Kappler reproduces that the database lacks. Link each order to the nations it set land apart for.
