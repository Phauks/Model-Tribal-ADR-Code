---
id: 2026-11-20-charter-sources
date: 2026-11-20
researchers: [Claude (AI assistant)]
tools:
  - kind: ai-assistant
    name: Claude (AI assistant)
    detail: A research sub-agent opened each page and returned quotes with URLs.
  - kind: page-fetch
    name: Web page fetch tool
purpose: Verify the authorities cited in the project charter and citation style.
queries:
  - CARE Principles (GIDA one-pager; Carroll et al. 2020)
  - UNDRIP articles 5, 18, 19, 31, 34
  - Executive Order 13175
  - NCAI "Walk Softly and Listen Carefully" (2012)
  - FNIGC OCAP principles
  - The Indigo Book, current edition and license
  - CSL styles repository Bluebook style; Juris-M CSL-M styles; citeproc-js
  - NARF Indigenous Peacemaking Initiative home page
  - Local Contexts TK Notice
  - 17 U.S.C. § 107
sources_added: []
limits: >-
  UN-hosted copies of UNDRIP did not load; the text was read from the
  Government of Canada's reproduction. The GIDA site did not display the
  principle definitions, which were read from a hosted copy of GIDA's 2019
  one-pager. The fetch tool returned long passages in pieces. The Indigo Book
  page gives inconsistent edition labels (see docs/citation-style.md).
---

All quotations in `docs/charter.md` and `docs/citation-style.md` come from the
pages listed in their footnotes, as read in this session.
