# Source audit of the Foundations drafts

Nov. 22, 2026. An audit of the sources behind the three drafted chapters of Part I: the legal history timeline, the key cases digest and the comparison of model codes and dispute frameworks. It asks four questions. Does every citation point to a source record? Do the quotations match their sources? Are the pinpoints right? And does each chapter stand on strong enough sources? The research log is `research/sessions/2026/2026-11-22-foundations-sources.md`; the quotation results are in [2026-11-22-foundations-quote-check.json](2026-11-22-foundations-quote-check.json).

## Summary

- Every key cited in the three drafts (247 before this session, counted per chapter) has a source record. No citation is broken.
- Of 384 quotations (after this session's additions), 276 matched their source word for word by machine, 3 matched across page breaks, and 10 more were confirmed by reading the source. None was found to be wrong. The other 95 could not be machine-checked: the source had no usable text (47), the quotation was too short to test (30), or the only text was a noisy scan (16, mostly Statutes at Large and the NCAI guide's page images). Two "quotations" are KeyCite flag labels, not opinion text.
- All 92 Supreme Court pinpoints in the drafts that fall within the Library of Congress's U.S. Reports scans were checked against those scans, and all 92 were right.
- The drafts leaned on one source for their framing. The NCAI guide *Tribal Nations and the United States* was the timeline's most-cited source (11 citations), and the drafts cited none of the standard treatises the project had already recorded (Cohen's Handbook, Canby, Getches et al., Richland and Deer, Pommersheim). This session adds 32 verified standard works and an annotated reading list.
- Five citations pointed to the wrong record or a merged record, and the drafts carried stale statements about citator checks, the old pull list and the compact data. All are fixed in this pull request (details below).

## Method

1. **Keys.** A script listed every `[@key]` in the three drafts and looked each up in `content/sources/`, recording the kind, link, archive, citator and verification notes.
2. **Quotations.** Each quotation was paired with the citation that follows it. A text of each cited source was fetched (official U.S. Reports scans from the Library of Congress where the volume is scanned, otherwise the record's own link), normalized for case, punctuation, soft hyphens and line breaks, and searched. Bracketed changes and ellipses split a quotation into fragments, each searched separately. Results that failed were opened and read.
3. **Pinpoints.** For Supreme Court cases in volumes 1 to 570, the Library of Congress scan begins on the case's first page, so the scan's page breaks give the report's page numbers. Each quotation's first words were located and the page compared with the pinpoint.
4. **Strength.** The kinds of sources each chapter relies on were counted, and the chapters were compared with what a reader of a law review would expect: primary sources for law, standard treatises and histories for framing, and Native authors where the subject is Native institutions.

## Findings and fixes

| # | Finding | Fix |
| --- | --- | --- |
| 1 | The timeline quoted 18 U.S.C. § 1152 but cited the 1817 General Crimes Act record | New record `usc-18-1152`; citation moved |
| 2 | A National Indian Law Library quotation was cited to the 1883 rules record ("read with the same record") | New record `nill-civilization-regulations-and-policy` |
| 3 | Two Navajo Nation quotations ("In 1892 ..." and "did away with ...") are not on the public guide page their record links; they are on the judiciary's History of the Courts page | New record `navajo-nation-judicial-branch-history-of-the-courts`; both citations moved. The third quotation ("In 1982 ...") is on the guide page and stays |
| 4 | The decision dates of Cherokee Nation v. Georgia and Worcester v. Georgia were "from general knowledge" | Verified from the Supreme Court Library's table of decision dates (dates from the Court's Engrossed Minutes): Mar. 18, 1831 and Mar. 3, 1832. New record `supreme-court-library-dates-of-decisions-1791-1882`; both case records updated |
| 5 | Indian Civil Rights Act § 402(c) was quoted from a record that links 25 U.S.C. § 1321, not § 1322 where the words are | New record `usc-25-1322` added beside the act's record |
| 6 | Timeline and digest said no case had been citator-checked; eleven have been | Both notes rewritten to say how many are checked and where the result is |
| 7 | Timeline and digest pointed readers to `research/pull-lists/2026-11-21-legal-history-westlaw.md`, a superseded list and an internal file | Removed. The essays are meant for the website, which never names internal files |
| 8 | The comparison essay said 256 of 286 compact clauses were copied from state models; the Nov. 22 recheck read 279 from each nation's own document | Section 4.2 updated with the current counts; the example rows were checked against the rechecked summaries and still match |
| 9 | The comparison essay named `docs/roadmap.md`, the analysis files and "the review queue" | Replaced with plain statements |
| 10 | No standard treatise or history was cited | 32 records added and the annotated list *Federal Indian law and Tribal justice: standard works* written; the timeline points to it |

## Strength of sources by chapter

| Chapter | Keys | Primary law and official texts | Books and articles | Reports | Web pages | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Timeline (before this session) | 119 | 100 | 9 (3 books, one a dissertation; 6 articles) | 5 | 5 | Framing rested on the NCAI guide; no treatise |
| Timeline (after) | 172 | 140 | 19 | 6 | 7 | Treaty clauses, Hawaiʻi and territories added; standard works listed |
| Key cases digest | 73 | 72 | 0 | 1 | 0 | Primary sources only, as a digest should be, plus the Supreme Court Library's date table; 11 of 65 cases KeyCited |
| Comparison essay | 56 | 41 (including compacts, foreign statutes and declarations) | 0 | 6 | 9 | Relies on official texts for the uniform acts and compacts; three foreign texts read through a summarizing tool (its own limits section says so) |

Counts are by record kind, per chapter (project analysis).

## What still needs a person or a library

These go to the pull list (`/mnt/project-files/research/documents-to-get.md`) or to the notes for later sessions:

- KeyCite for the 54 digest cases not yet checked, and for the 14 cases added here (the four bad-men cases, Flying Horse, Downes, Tuaua, Fitisemanu, Wabol and Davis).
- Library copies of Cohen's Handbook (2024), which is on Lexis rather than Westlaw, and of Deloria and Lytle's *American Indians, American Justice*, for pinpoints the timeline can cite.
- The NCAI guide's era quotations, the 1790 and 1817 acts, the Alaska IRA amendment and House Concurrent Resolution 108 were read from scans too noisy to confirm by machine. Each should be checked against a clean page image.
- The CNMI Constitution's own text (article XII is quoted from Wabol), the Chamorro Land Trust Act's 1975 session law, and the official American Samoa and Guam code texts (read here from mirrors).
- Print page numbers for the MacKenzie treatise, which the project holds only as an EPUB.
