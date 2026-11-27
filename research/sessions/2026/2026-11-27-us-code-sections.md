---
id: 2026-11-27-us-code-sections
date: '2026-11-27'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: One session wrote scripts/law/us_code_sections.py and ran it; no record was written by hand.
- kind: page-fetch
  name: govinfo.gov
  detail: GovInfo's link service for the United States Code (https://www.govinfo.gov/link/uscode/<title>/<section>?year=2024&link-type=pdf) and the chapter PDFs of the 2024 edition.
purpose: 'Trevor asked (Nov. 27, 2026) why the page for 25 U.S.C. § 232 showed no text. The 36 records for single sections of the Code were made from Cornell Legal Information Institute pages, and that page was the only copy kept: private for 9 records, and for the other 27 a saved web page with all of its menus. This session stores the official text of each section, from the 2024 edition on GovInfo, so each page shows it.'
queries:
- For each source record of a single section (or a few sections, or a chapter) of the United States Code, the granule PDF of that section in the 2024 edition on GovInfo
sources_added: []
limits: 'The copies are the 2024 edition (the latest annual edition on GovInfo), not the online current Code; amendments after it are not in them. A record that cites several sections has one PDF joined from the sections'' PDFs (pdfunite); 9 U.S.C. §§ 201, 301 and §§ 401-402 are stored as the chapter PDFs (chapters 2, 3 and 4). A GovInfo section PDF starts on the page where the section begins, so its first page can end the section before it. usc-25-1301 is § 8077 of the Department of Defense Appropriations Act, 1991; its copy is 25 U.S.C. § 1301, the section that Act amended, whose notes give the Act. Records stay Unverified.'
---

# Official text of United States Code sections: session notes

## Why the pages had no text

The records for single sections of the Code (for example `us-code-title-25-section-232` and `usc-25-1911`) were written between Nov. 20 and Nov. 23, 2026, from Cornell Legal Information Institute (LII) pages. The copy kept of each was LII's web page. For 9 records that copy is marked private, so the page showed no text. For the other 27 the copy is served, but it is LII's whole page, with its menus and forms, and renders badly. The Title 25 work on Nov. 24 and 26 stored a PDF of each chapter of Title 25, not of each section. Nothing was lost in the move to the new bucket.

## What was built

`scripts/law/us_code_sections.py` has three steps. `fetch` downloads each record's section PDF from GovInfo's link service (2024 edition), joins the PDFs of a record that cites several sections, and writes `research/raw/2026-11-27/us-code-sections.json`. `file` stores each PDF in the bucket under `united-states-code/2024/` with `scripts/captures/mirror_captures.py`, which checks the SHA-256 after upload and adds the row to the capture index. `records` gives each record a `file` block and a sentence in its notes.

Each PDF was checked to hold the heading of every section (or chapter) its record cites. GovInfo's link service answered 5 U.S.C. § 561 with an error (400), so that section is fetched by its granule name.

The site now shows a record's own stored file before a saved copy of the page its citation links (`savedCopyFor`, `site/src/lib/server/markdown.ts`). Besides the 27 section pages, this fixes 4 records whose link was shared with another record and showed that record's PDF: three treaties (Potawatomi, Dec. 4, 1834; Iowa, 1837; Kickapoo of the Vermilion, 1820) and the Menominee Restoration Act.
