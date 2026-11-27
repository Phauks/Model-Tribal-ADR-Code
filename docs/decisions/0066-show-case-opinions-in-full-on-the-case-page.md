# 0066. Show a case's opinions in full on its page, read from the copy the site serves

- **Status:** Accepted
- **Date:** 2026-11-27
- **Extends:** decision records [0031](0031-serve-copies-of-documents-from-the-private-bucket.md) (the site serves its own copies of federal works), [0058](0058-draw-item-pages-on-request.md) (item pages drawn on request) and [0060](0060-serve-state-agreements-and-state-court-opinions.md) (state court opinions served)

## Context

Trevor Goldsmith asked on Nov. 27, 2026 that readers "should be able to directly read the majority and minority opinions of cases on our website". Until then a case page listed its opinions and linked each to its first page in the saved scan of the report, or to the saved copy as a whole. An audit the same day (`research/case-opinion-reader/opinion-text-audit.md` in the project files) found that every state case (2,950) and every federal case from the state reporters (150) has a served copy split into its opinions, each with its writer's line, once the copies are rebuilt with their citation links (PR #569). The Supreme Court's 534 cases had only the Library of Congress scans, which are not split. The Caselaw Access Project has the United States Reports, volumes 1 to 572, as HTML split by opinion, read by OCR. Trevor chose design B of three mockups (`design/case-opinion-reader/`): one folding section for each opinion, the Opinion of the Court open first.

## Decision

- **The text is read from the served copy.** A case page shows each opinion's text from the copy of the opinions the site already serves at `/copies/<key>`, read from the bucket when a reader opens the page (`/cases/<key>/opinions.json`). The route serves only the copy the case's built data names, only while it is on the build-time list, only when its file in the bucket is the one indexed, and not when a nation's choice stops the copy (decision record 0056). So any redaction, privacy hold or nation's choice that governs the copy governs the page. No opinion text is in the Worker's code or the page's built data.
- **The list is in git, the text is not.** `research/case-opinions/opinions.csv` lists each opinion's copy, kind, writer, pages and length, so the page can show its folding sections before the text arrives. `scripts/caselaw/case_opinion_texts.py index` writes it.
- **Supreme Court text from the Caselaw Access Project.** For volumes 1 to 572, the site serves a copy of each case's opinions built from the Caselaw Access Project's HTML, the same way the state copies are built (topic `supreme-court-opinions`). The opinions are works of the United States government (17 U.S.C. § 105). The text is OCR and has misreadings, so the scan stays the official copy: each Supreme Court opinion keeps its link to its first page in the scan, and quotations are still checked against the official report. The reporter's syllabus and statement of the case are left out, as the state copies leave out headnotes.
- **Only what the page needs is let through.** The text is shown in the page, not in a frame, so it is cleaned to paragraphs, emphasis, block quotations, footnotes, the citations' links and pictures held as data (`site/src/lib/opinion-text.ts`).

## Consequences

- 3,605 case pages show 4,455 opinions in full. The Interior Board of Indian Appeals' and the National Indian Gaming Commission's decisions keep their PDF in the page's Text frame, since each is one decision. Tribal court opinions have no case pages; they open on their copy's page as before.
- The 24 Supreme Court cases after volume 572, and five earlier cases the Project has no single matching opinion page for, keep their list of opinions linked to the scan, until their text is split from the bound volumes or slip opinions.
- The state and federal pages read their copies as rebuilt by PR #569. Until those copies are in the bucket, a page shows its opinions' list with a link to the saved copy.

## Sources

- Caselaw Access Project, Harvard Law School Library, static files of the United States Reports, https://static.case.law/us/ (read Nov. 27, 2026).
- 17 U.S.C. § 105.
- *Georgia v. Public.Resource.Org, Inc.*, 590 U.S. 255 (2020).
