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
- navajo-rules-of-evidence
- navajo-rules-of-civil-procedure
- tribal-law-journal-navajo-nation-courts-tribal-court-handbook-2012
- southern-ute-indian-tribal-court-rules-appendix-c
- southern-ute-title-1-general-provisions-2026
- washington-tribal-state-court-consortium-tribal-court-directory
- ogichidaa-storytellers-every-step-a-healing-circle
sources_updated:
- united-states-code-8-1359
- bc-treaty-commission-what-we-do
- ross-v-sulu-hopi-appellate-court
- hr-1502-107th-congress-tohono-oodham-citizenship
- arizona-rules-of-procedure-recognition-tribal-court-civil-judgments
- navajo-nation-judicial-branch-courts-and-peacemaking
- yazzie-1994-life-comes-from-it
- leeds-cross-jurisdictional-recognition-enforcement-judgments-2000
- deer-tatum-tribal-efforts-violence-against-women-act-full-faith-and-credit-2003
- goldberg-overextended-borrowing-tribal-peacemaking-1997
- valencia-weber-1994-tribal-courts-custom-innovative-law
- zuni-cruz-southwest-intertribal-court-of-appeals-1994
- fletcher-rethinking-customary-law-tribal-court-jurisprudence-2007
- zion-1983-navajo-peacemaker-court
- coker-1999-enhancing-autonomy-navajo-peacemaking
- martin-cherokee-supreme-court-1823-1835-dissertation-2018
- uniform-law-commission-child-custody-jurisdiction-enforcement-act-104
- uniform-law-commission-collaborative-law-rules-act
- uniform-law-commission-family-law-arbitration-act-2016
- uniform-law-commission-mediation-act
- uniform-law-commission-revised-arbitration-act-summary
- nigc-gaming-tribe-report-by-state-2024-12-10
- r-v-gladue-1999
limits: >-
  The R. v. Gladue print stops before paras. 66 and 93, so those are
  unconfirmed. Mitchell v. M.N.R. paragraph numbers were read from a text layer
  that runs the English and French columns together. Tribal Court Praxis was
  searched for evidence passages, not read in full. The Arizona petition shows
  only that the rules existed by 2014. Batch 2 settled Gladue paras. 66 and 93
  and the fate of H.R. 1502; the Arizona rules' original adoption date is still
  open. The batch 2 constitutions were added to the version histories by hand,
  with dates and statuses read from each copy's first and last pages; their
  articles were not read, and they are not in the constitution catalog's
  documents.json.
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
- **Native Hawaiian Law: A Treatise (MacKenzie ed. 2015)**: EPUB filed privately under `books/` (not on the pull list); all rights reserved, never served (`mackenzie-2015-native-hawaiian-law-treatise`).

# Hand-pulled documents, batch 2

The lead author sent 68 files on 2026-11-22 (16 in the thread, 52 placed at the top of the project's working files). Each was identified by its contents: generically named files were read (text layer, or a rendered first page for scans), not guessed from the file name. By SHA-256, 12 were files the project had already captured and moved to the bucket, and 56 were new. All 56 were filed with `scripts/captures/mirror_captures.py add`, and all 68, plus the Native Hawaiian Law EPUB, passed a check that downloaded each bucket object and hashed its bytes. The working-file copies were then deleted. A table of every file is in the project's working files, `research/pull-results/2026-11-22-hand-pulled-batch-2.md`.

What the batch holds:

- 29 constitutions and charters from the pull list (Wayback Machine and Library of Congress copies), filed under `constitutions/<nation>/` by hash. Each is now a version in its nation's history (`content/documents/`) with its own source record; Siletz and Sauk-Suiattle got new histories, and the two charters got charter histories of their own. Dates and statuses were read from each copy's first and last pages; where a copy is newer than the version the history had marked in effect, the older one is now marked superseded (Lummi, Salish and Kootenai, Sitka, Little River, Tlingit and Haida, Ho-Chunk, Hoopa Valley, Tonkawa, Suquamish). Copies whose words match a version already recorded are listed beside it as second copies. The two Library of Congress items are corporate charters, not constitutions (Native Village of Barrow, 1940; United Keetoowah Band, 1950).
- 10 law review articles and a dissertation, the 5 Uniform Law Commission acts, the National Indian Gaming Commission's Dec. 10, 2024 Gaming Tribe Report, and the official R. v. Gladue report, each filed against its existing record.
- New records for the Navajo Rules of Evidence and of Civil Procedure, a 2012 Tribal Law Journal handbook on the Navajo Nation courts, the Southern Ute court rules (Appendix C) and Title 1, the Washington Tribal court directory, and the Every Step education materials.

Findings recorded in records:

- **R. v. Gladue**: para. 66 (pp. 723-24) gives the two kinds of circumstances for sentencing an Aboriginal offender; the summary at para. 93 begins at p. 736 (`r-v-gladue-1999`).
- **H.R. 1502 (107th Cong.)**: its last action was referral to the Subcommittee on Immigration and Claims on Apr. 19, 2001, so it died in committee (`hr-1502-107th-congress-tohono-oodham-citizenship`).
- **Arizona Tribal court judgment rules**: the 2014 clerks' petition (R-14-0032) was adopted as modified, effective Jan. 1, 2016; the rules' original adoption date is still open (`arizona-rules-of-procedure-recognition-tribal-court-civil-judgments`).
- **Navajo Rules of Evidence (1978)**: Rule 10 excludes compromise offers and negotiation statements; Rule 13 lists seven privileges and none for peacemaking or sacred matters (`navajo-rules-of-evidence`).
- **Southern Ute**: no peacemaking program in Title 1 or the Appendix C court rules; Title 1 provides for advisors on custom and for hearing officers to consult elders (`southern-ute-title-1-general-provisions-2026`).
- The National Indian Gaming Commission report and H.R. 1502 are U.S. government works, so their records now allow the site to serve the copies.

Batch 3 (same day): Trevor sent six Part 1 files (the NMAI floor plan, three Navajo Peacemaking Program items, the Navajo Judicial Branch FY 2026 fourth quarter report and R. v. Powley) and said the other Part 1 links failed. He then sent 16 constitution files for Part 2e (14 new, 2 repeats) and the contents page of the Navajo Rules for Declaratory Rulings. All are indexed in `research/capture-index.csv` and wait for the next upload run. The brochure record was checked against the October 2025 PDF. The write-up is `research/pull-results/2026-11-22-hand-pulled-batch-3.md` in the project files.
