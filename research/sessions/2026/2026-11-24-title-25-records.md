---
id: 2026-11-24-title-25-records
date: '2026-11-24'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: One session wrote scripts/law/title_25_records.py and ran it; no record was written by hand.
- kind: page-fetch
  name: govinfo.gov and ecfr.gov
  detail: The 2024 edition of Title 25 of the United States Code on GovInfo (HTML and each chapter's PDF); the eCFR structure and versions of Title 25 of the Code of Federal Regulations, and each part's PDF from the 2025 annual edition on GovInfo.
purpose: 'Trevor asked to cover federal Indian law in full, starting with tier 1 (Nov. 24, 2026, after the coverage spike in research/analyses/2026-11-24-federal-laws-and-treaties-coverage.md, which recommended chapter-level Code records and part-level regulation records with a refresh). This session gives every chapter of Title 25 of the Code and every part of Title 25 of the regulations its own source record and stored copy.'
queries:
- Every chapter of 25 U.S.C. with its sections, and which sections are in force
- Every part of 25 C.F.R. in force, the agency that issued it and its last amendment
sources_added: []
limits: 'The records are generated from the official editions and are Unverified only in that nobody has read them. The Code copies are the 2024 edition (current through Jan. 6, 2025), the newest on GovInfo; the regulation copies are the 2025 annual edition (revised as of Apr. 1, 2025), and 13 parts were amended after that date, which the eCFR link on each record shows. Individual sections have no records of their own beyond the seven usc-25-<section> records that already existed.'
---

# Title 25 of the Code and of the regulations: session notes

## What was built

`scripts/law/title_25_records.py` has four steps. `fetch` finds the newest edition of Title 25 of the United States Code on GovInfo (2024), reads its 57 chapters and 2,396 section numbers from the HTML (1,180 sections in force; the rest marked omitted, repealed, transferred or vacant), downloads each chapter's PDF, reads the 154 parts of 25 C.F.R. in force from the eCFR structure with each part's issuing agency and last amendment, and downloads each part's PDF from the newest annual edition on GovInfo (2025). `file` stores the PDFs in the project's bucket under `united-states-code/2024/` and `code-of-federal-regulations/2025/`. `records` writes the source records. `check` is the refresh check: it compares the records with the current eCFR and GovInfo and lists parts added, removed or amended since the records were made and any newer Code edition, in `research/reviews/title-25-refresh.csv`, exiting with an error when anything changed so it can run on a schedule. To refresh, run `fetch`, `file` and `records` again.

## Results

57 chapter records (`usc-25-chapter-<n>`, kind `federal-statute`), each giving its section range and how many sections are in force, and 151 new part records (`cfr-25-part-<n>`, kind `federal-regulation`) naming the issuing agency (Bureau of Indian Affairs, 111 parts; National Indian Gaming Commission, 30; Indian Arts and Crafts Board, 6; Assistant Secretary for Indian Affairs, 3; Office of Navajo and Hopi Indian Relocation, 2; the joint Bureau of Indian Affairs and Indian Health Service self-determination rules, 1; Office of the Special Trustee, 1). The three existing part records (parts 11, 291 and 293) keep their text and gain the stored copy. Every record has a stored copy.

## Next

Run `check` each year when GovInfo publishes the new Code edition and the new annual regulations (or monthly for the regulations, which change more often). Section-level anchors inside chapter pages are a website task: the stored chapter PDFs and the eCFR links already carry them.
