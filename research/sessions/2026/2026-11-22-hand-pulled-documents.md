---
id: 2026-11-22-hand-pulled-documents
date: '2026-11-22'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: legal-database
  name: Westlaw
  detail: The lead author printed the KeyCite report for 8 U.S.C. § 1359.
- kind: page-fetch
  name: Web browser (lead author)
  detail: The lead author downloaded or printed to PDF the court decisions, pages and constitutions
    on the project's pull list that refuse automated requests, and saved one page to the Wayback
    Machine.
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: Matched each file to its pull-list item by contents and SHA-256, read the passages each
    item asked about, filed the private copies and updated the records.
- kind: other
  name: pdftotext and pdftoppm (Poppler)
  detail: Extracted text from the PDFs and rendered page images of one scanned constitution.
- kind: web-search
  name: Web search
  detail: One search for the status of H.R. 1502 (107th Cong.).
purpose: >-
  File the first batch of documents the lead author fetched by hand from the
  project's pull list and record what each one settles.
queries:
- H.R. 1502 107th Congress Tohono O'odham citizenship all actions
sources_added:
- mitchell-v-mnr-2001
- r-v-gladue-1999
- newton-1998-tribal-court-praxis
- navajo-nation-itb-26-09-4310sb-peacemaking-building-2026
sources_updated:
- united-states-code-8-1359
- bc-treaty-commission-what-we-do
- ross-v-sulu-hopi-appellate-court
- hr-1502-107th-congress-tohono-oodham-citizenship
- arizona-rules-of-procedure-recognition-tribal-court-civil-judgments
- navajo-nation-judicial-branch-courts-and-peacemaking
limits: >-
  The R. v. Gladue print stops before paras. 66 and 93, so those are
  unconfirmed. Mitchell v. M.N.R. paragraph numbers were read from a text layer
  that runs the English and French columns together. Tribal Court Praxis was
  searched for evidence passages, not read in full. The Arizona petition shows
  only that the rules existed by 2014. Whether H.R. 1502 passed is still
  unconfirmed.
---

# Hand-pulled documents, batch 1

The lead author sent 26 files in three uploads; by SHA-256 they were 15
distinct files. A table of each file, where its private copy is filed and what
it settled is in the project's working files,
`research/pull-results/2026-11-22-hand-pulled-batch-1.md`. Private copies are
under `research/captures/` there, never in this repository.

Findings recorded in records:

- **8 U.S.C. § 1359**: KeyCite shows a yellow flag for proposed legislation
  only, and none of its seven Notes of Decisions concerns people born in
  Mexico (`united-states-code-8-1359`).
- **Mitchell v. M.N.R., 2001 SCC 33**: the claimed right was not proven; the
  Jay Treaty appears only in a quotation in the concurrence
  (`mitchell-v-mnr-2001`).
- **Ross v. Sulu**: decided July 5, 1991 (`ross-v-sulu-hopi-appellate-court`).
- **Newton, Tribal Court Praxis (1998)**: evidence passage at 318-19 & n.127
  (`newton-1998-tribal-court-praxis`).
- **Navajo Nation**: a 2026 invitation to bid for a Supreme Court peacemaking
  building and amphitheater (`navajo-nation-itb-26-09-4310sb-peacemaking-building-2026`).
- The Oneida Indian Nation's "Liberty Trees and the Tree of Peace" page tells
  no peacemaking story (`oneida-indian-nation-tree-of-peace`).
