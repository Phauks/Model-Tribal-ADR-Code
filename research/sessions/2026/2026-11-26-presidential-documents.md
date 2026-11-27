---
id: 2026-11-26-presidential-documents
date: '2026-11-26'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: One session wrote scripts/law/presidential_documents.py and ran it; no record was written by hand.
- kind: other
  name: Federal Register API
  detail: Presidential documents since 1994 whose text uses a Native term, with their numbers, dates, citations and GovInfo PDFs.
purpose: 'Trevor asked to add the sources missing from the data roadmap and to collect the ones that are high value and scriptable (project thread "Add the new data sources to the roadmap and collect them", Nov. 26, 2026). This session adds the presidential documents on Indian policy since 1994 beyond the reservation orders: executive orders, proclamations and memoranda.'
queries:
- 'Federal Register API, type PRESDOCU, term (Indian|tribal|tribe|tribes|"Native American"|"Alaska Native"|"Native Hawaiian"), Nov. 26, 2026: 779 documents'
sources_added: []
limits: 'Every record is Unverified. Documents are chosen by title (and eight national monument proclamations by number), so a document about Indian policy whose title names no Native people or nation is missed. Documents before 1994 are not in the API and are not collected.'
---

# Presidential documents on Indian policy since 1994: session notes

## What was built

`scripts/law/presidential_documents.py` asks the Federal Register API for every presidential document since 1994 that uses "Indian", "tribal", "tribe", "Native American", "Alaska Native" or "Native Hawaiian" (779 on Nov. 26, 2026). Most of them are disaster and emergency declarations that only mention tribal governments, so it keeps the documents whose title names Native people or nations (75, leaving out one proclamation on the Indian Ocean tsunami) and eight national monument proclamations that Native nations proposed or help manage: Canyons of the Ancients (2000), Bears Ears (2016, 2021 and 2026), Avi Kwa Ame (2023), Baaj Nwaavjo I'tah Kukveni (2023), Chuckwalla and Sáttítla Highlands (2025). Each GovInfo PDF is stored under `presidential-documents/<document number>.pdf` and served as a work of the United States government.

Records are of kind `executive-order`, as the project's reservation proclamations already are, so they join the Executive Orders collection: `executive-order-<number>`, `proclamation-<number>` or `presidential-memorandum-<year>-<title>`.

## Results

83 documents chosen: 18 executive orders, 57 proclamations and 8 memoranda. All 18 executive orders already had records (Executive Order 13175 and the rest, from the Nov. 24 executive order session) and keep them, so 65 records are new: 57 proclamations, among them the yearly Native American Heritage Month, Indigenous Peoples' Day and Missing or Murdered Indigenous Persons Awareness Day proclamations and the Carlisle Federal Indian Boarding School National Monument, and 8 memoranda, among them the 1994 government-to-government memorandum, the 1994 eagle feathers policy, the 2009, 2021 and 2022 tribal consultation memoranda, the 2025 Lumbee recognition memorandum and the 2025 denial of a presidential permit for the Kickapoo Traditional Tribe of Texas. Three documents of 1994 have no PDF on GovInfo, so their records link the Federal Register page and have no stored copy.

## Next

Documents before 1994 (Indian policy messages, proclamations and orders) from the Public Papers of the Presidents, and a reading of each text for the nations it names.
