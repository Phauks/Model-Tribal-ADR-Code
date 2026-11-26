---
id: 2026-11-26-federal-register-indian-affairs
date: '2026-11-26'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: One session wrote scripts/law/federal_register_documents.py and ran it; no record was written by hand.
- kind: legal-database
  name: Federal Register API (federalregister.gov/api/v1)
  detail: Every document of six Indian affairs offices, 1994 to Nov. 2026, listed year by year.
- kind: page-fetch
  name: govinfo.gov
  detail: The Federal Register PDF of each document not already stored, eight at a time.
purpose: 'Trevor asked to build tier 2 of the data roadmap to completion (project thread "Build tier 2 federal sources", Nov. 26, 2026). This session gives every Federal Register document of the Indian affairs offices since 1994 its own source record and a stored copy, served by the site.'
queries:
- 'Federal Register API, documents by agency office, one year at a time, 1994 to 2026: indian-affairs-bureau, national-indian-gaming-commission, special-trustee-for-american-indians-office, indian-arts-and-crafts-board, navajo-and-hopi-indian-relocation-office, indian-trust-transition-office'
sources_added: []
limits: 'Titles, dates, citations and kinds are the Federal Register API''s; nobody has read the documents, so every new record is Unverified. Nations are matched by name in the title and abstract only, so a notice that names a nation only in its body is not linked. Three PDFs on GovInfo are not PDFs (94-32265, 95-9023, 95-9024); their records link to the Federal Register without a stored copy. The Indian Health Service''s 768 documents are not included: they are health program notices more than Indian law, and can be added by listing its office in the script.'
---

# Records for the Federal Register documents of the Indian affairs offices: session notes

## What was built

`scripts/law/federal_register_documents.py` has three steps. `fetch` lists every document each office published from 1994 on, with its number, citation, title, kind, date and abstract, and downloads each GovInfo PDF the project did not already hold. `file` stores each new PDF in the bucket under `federal-register/<document number>.pdf`. `records` writes one source record per document that had none.

## Records

A document that already had a record (from the gaming compact work, the recognized nations lists and others) keeps it, and a PDF already stored under GovInfo's path is reused. Every new record is keyed `federal-register-<document number>`, lowercase. Its citation is the Federal Register's: volume, first page, date and "FR Doc." number, with the office as author and the document's kind (notice, rule, proposed rule, correction). The Indigo Book citation in the notes is "<volume> Fed. Reg. <page> (<date>)".

## Results

The six offices published 3,734 documents from Jan. 18, 1994 to Nov. 18, 2026: 3,322 by the Bureau of Indian Affairs, 362 by the National Indian Gaming Commission, 35 by the Office of the Special Trustee, 17 by the Indian Arts and Crafts Board, 7 by the Navajo and Hopi relocation office and 4 by the Indian Trust Transition Office (some name two offices). They are 3,114 notices, 304 proposed rules, 255 rules, 45 uncategorized documents and 16 corrections. Among their titles, 198 name liquor ordinances, 143 land acquisitions, 155 acknowledgment matters and 235 tribal-state compacts. 2,993 documents got a new record; the rest already had one, among them the lists of recognized nations. 2,946 PDFs were stored, and the others were already held.

## Next

A person reads the reservation proclamations, liquor ordinances and land acquisitions first, and links each to the nation and the land it concerns where the title does not name them.
