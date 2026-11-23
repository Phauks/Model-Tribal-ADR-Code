---
id: 2026-11-21-print-pipeline
date: 2026-11-21
researchers: [Lead author, Claude (AI assistant)]
tools:
  - kind: ai-assistant
    name: Claude (AI assistant)
    detail: Read the guides and manuals below, built the print pipeline and measured its output.
  - kind: other
    name: Lulu guides supplied by the lead author
    detail: Book Creation Guide, Retail Distribution Guide and Retail Distribution Eligible Products Guide (PDFs uploaded to the project's shared files).
  - kind: page-fetch
    name: Web page fetch tool
  - kind: other
    name: GitHub and npm package files
    detail: The CSL styles and locales repositories, the Atkinson Hyperlegible Next and Noto font repositories, Typst 0.15.1 release files, citeproc-js, markdown-it and plugins.
purpose: >-
  Turn the PDF engine test build into a real print build. Find every Lulu rule
  that depends on the book size, so the size can be one setting; check the
  Indigo Book's statute, id. and supra forms to fix the citation style; and
  record the sources and licenses of the fonts and the style.
queries:
  - Lulu trim sizes eligible for retail distribution, perfect bound, standard black-and-white
  - Lulu bleed, safety margin, inside margin by page count, spine width formula, spine text minimum
  - Lulu title page, copyright page, blank page and page numbering rules
  - Indigo Book R6.2.2 and R6.2.3 (id. and supra), R16 (U.S. Code), R17 (state codes), R18.4 (uniform acts), R22.2
  - CSL bluebook-law-review.csl legislation macros and the "reference with no printed form" error
  - Atkinson Hyperlegible Next glyph coverage; Noto Sans, Noto Sans Cherokee and Noto Sans Canadian Aboriginal releases
sources_added: []
limits: >-
  No source records were added: the Lulu guides and the Indigo Book are cited
  in pdf/README.md, pdf/book-sizes.yaml and pdf/styles/README.md, and become
  records if the book's text cites them. Lulu's guides disagree on the spine
  text minimum (80 pages in the Book Creation Guide, p. 17; 100 pages in the
  Retail Distribution Guide, p. 14); the build uses 100. The spine width is
  Lulu's estimate; Lulu's cover template is final. The CSL-M IndigoBook style
  from Juris-M was not tested. The Indigo Book was read in its HTML edition
  (2d ed., 2023 updates) only.
---

Findings:

- Lulu lists twelve trim sizes as eligible for retail distribution as a perfect-bound paperback with standard black-and-white ink (*Retail Distribution Eligible Products Guide*, pp. 3-9). Comic Book is eligible only with premium color. Small Square is not distributed through Ingram, and Executive, Crown Quarto, A4, US Letter and Square are not distributed through Ingram on 60# cream paper (same guide). All twelve are in `pdf/book-sizes.yaml`.
- The size-dependent rules are the page size with 0.125 in bleed, the 0.5 in safety margin, the inside margin by page count and the spine width of pages / 444 + 0.06 in (*Book Creation Guide*, pp. 8-13, 17, 23).
- The upstream CSL style `bluebook-law-review.csl` (file dated 2025-05-06) dropped a statute's "§ 4" pinpoint and printed no short form for an act without a section (measured with citeproc-js 2.4.63). The project's copy, `pdf/styles/project-law-review.csl`, prints the forms in Indigo Book R6.2.2, R16.1, R16.2 and R18.4, such as "Unif. Mediation Act § 4 (Unif. L. Comm'n 2001)" and "*Id.* § 5".
- Atkinson Hyperlegible Next has 362 glyphs and lacks ʔ, ʷ, ʼ and ō, which appear in the names of some Native nations, so the build falls back to Noto Sans and its Cherokee and Canadian Aboriginal syllabics fonts (measured).
- The specimen at every size passes the build's checks of Lulu's rules (measured; `npm run build:every-size`).
