---
id: 2026-11-26-ibia-decisions
date: '2026-11-26'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: One session wrote scripts/law/ibia_decisions.py and ran it; no record was written by hand.
- kind: page-fetch
  name: oha.doi.gov
  detail: The 4,878 decision PDFs the Interior Board of Indian Appeals' chronological index links, eight at a time.
purpose: 'Trevor asked to build tier 2 of the data roadmap to completion (project thread "Build tier 2 federal sources", Nov. 26, 2026), starting with the Interior Board of Indian Appeals. This session gives every decision of the Board that is not held back for privacy its own source record and a stored copy of its PDF, served by the site.'
queries:
- Every decision in the Board's chronological index, 1970 to Nov. 2026 (research/data-roadmap/2026-11-26-tier-2-and-3/ibia-decisions.csv, PR #519)
- Each decision's cover sheet (name, citation, date and notes) and its own docket number and "Decided" date
sources_added: []
limits: 'The records carry the index''s and the decisions'' own facts; nobody has read the decisions, so every record is Unverified, and the nations a decision concerns are matched by name in its name only. Decisions about a child or a protected person (221) are stored but neither shown nor named.'
---

# Records for the Interior Board of Indian Appeals' decisions: session notes

## What was built

`scripts/law/ibia_decisions.py` has four steps. `fetch` downloads every PDF the Board's chronological index links (4,878 files, about 1.1 GB) and extracts the text of each one's first two pages. `check` reads each decision's cover sheet, which the Board adds to every decision it publishes up to about volume 49 (the decision's name, its citation and date, and notes such as "Also published at 81 Interior Decisions 680", "Judicial review of this case:" or "Related Board case:"), and the decision's own docket number and date ("Decided December 5, 1974", or for an order the date in the caption's right column), and compares them with the index. `file` stores each PDF in the bucket under `ibia-decisions/<file>.pdf`. `records` writes the source records.

## Names, citations and dates

The name is the cover sheet's, else the index's (the later volumes have no cover sheet). The citation is the index's, except where the cover sheet prints the citation the file is named for and the index gives another. The date is the decision's own, unless the index and the cover sheet agree on another day, which happens where the decision has a slip (16 IBIA 163 prints 1998 in a 1988 volume).

The index links eight decisions to another decision's PDF (12 IBIA 116 links 12ibia119.pdf); the script fetches each one's own file, named for its citation. Two index rows, City of Salem and the Community Defense Council, are one consolidated decision, 32 IBIA 62, and get one record.

## Results

Of 4,878 decisions, the cover sheet and the index agree on the citation in 4,855 and the dates agree in 4,794 (`research/reviews/ibia-decisions-check.csv` lists the rest). At first 3,445 decisions got a record and a served copy, and 1,433 were held back: 1,427 probate appeals and 6 decisions whose name is about a minor or a guardianship. On Nov. 26, 2026 Trevor chose to show estate and probate cases like any other (project thread "Collect state court Indian law opinions and Oklahoma compacts"; the state court estate cases followed in PR #538). The check step now reads the whole text of each probate appeal and keeps it held when it is about a child or a protected person: it names a minor child or heir, a guardian or guardianship, a conservator, custody or child support, or mentions adoption, the Indian Child Welfare Act, parental rights, a protection order or a juvenile court at least three times (the state court rule). 215 probate appeals meet it. So 4,657 decisions now have a record and a served copy, 1,212 of them probate appeals, and 221 are held. Their PDFs are stored but not served, and `research/ibia/held-back.csv` lists them by citation and date only, with no names. Where an estate came before the Board more than once, a shown decision can carry the estate's name while a held one does not.

## Next

Link each decision to the nations it concerns (a name match against the nations' names in the title and the opening page, with a small model for the doubtful ones). A person reads the 221 held decisions and decides whether each can be shown with initials, as the Tribal court opinions about children are (decision record 0057).
