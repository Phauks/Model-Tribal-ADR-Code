# Case opinions

`opinions.csv` lists each opinion in the cases whose text the website serves, so a case's page can show each one in a folding section of its own (Trevor Goldsmith asked on Nov. 27, 2026 that readers "be able to directly read the majority and minority opinions of cases on our website" and chose design B, one fold per opinion). Written by `scripts/caselaw/case_opinion_texts.py index`.

| Column | What it holds |
|---|---|
| `record` | The case's source record key (`content/sources/`). |
| `copy` | The served copy that holds the text (`research/capture-index.csv`, `/copies/<key>`). |
| `position` | The opinion's place among the copy's opinions, from 0. |
| `kind` | `majority`, `concurrence`, `dissent` and the other kinds in `site/src/lib/case-opinions.ts`. |
| `author` | The writer's surname: for a Supreme Court case from the record's opinions block or its bench where the copy's line matches one, otherwise read from the copy's writer line. Empty for a per curiam opinion or a line that names no one. |
| `first_page`, `last_page` | The report pages it starts and ends on, from the copy's page numbers. |
| `words` | Its length in words, without page numbers. |

The text itself is not in git. The website reads it from the copy when a reader opens the page (`site/src/routes/cases/[id]/opinions.json`), so a redaction, a privacy hold or a nation's choice that governs the copy governs the page too.

The Supreme Court copies (topic `supreme-court-opinions`, keys `caselaw-access-project/us/<volume>/<file>.html`) are the Caselaw Access Project's text of the United States Reports, volumes 1 to 572, read by OCR, built by `case_opinion_texts.py supreme-court`. The Library of Congress scan of the report stays the official copy, and each opinion on the page links to its first page in that scan. Cases decided after volume 572 are not covered yet.
