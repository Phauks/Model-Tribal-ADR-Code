---
id: 2026-11-23-supreme-court-pages
date: '2026-11-23'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: One session read every page cited and wrote the Court histories in its own words; no other readers were used.
- kind: page-fetch
  name: supremecourt.gov, fjc.gov and supremecourthistory.org
  detail: The Court's "Justices 1789 to Present" table and current biographies, the Federal Judicial Center's federal-judicial-service.csv export and its legislative history of the Supreme Court, and the Supreme Court Historical Society's "History of the Courts" pages, fetched directly.
purpose: 'Trevor asked that the Court named in a case box, such as "Marshall Court", open a page with the Court''s make-up, its history and the cases on the site that it decided (Nov. 23, 2026).'
queries:
- Every Chief Justice and Associate Justice, with the oath date and the date service ended, from the Court's own list
- The seat, the statute for a new seat, and how service ended for each of the 121 Supreme Court appointments, from the Federal Judicial Center
- The Acts of Congress that set the number of seats
- The Supreme Court Historical Society's history of each Court that decided a case on the site
sources_added:
- supreme-court-justices-1789-to-present
- supreme-court-biographies-of-current-justices
- federal-judicial-center-biographical-directory
- federal-judicial-center-supreme-court-legislative-history
- supreme-court-historical-society-marshall-court
- supreme-court-historical-society-waite-court
- supreme-court-historical-society-fuller-court
- supreme-court-historical-society-white-court
- supreme-court-historical-society-warren-court
- supreme-court-historical-society-burger-court
- supreme-court-historical-society-rehnquist-court
limits: 'Histories were written only for the eight Courts that decided a case on the site (Marshall, Waite, Fuller, White, Warren, Burger, Rehnquist, Roberts). The Historical Society has no page for the Roberts Court, so its history is limited to the Chief Justice''s own record. Every reading awaits the lead author''s review.'
---

# Pages for each Court of the Supreme Court: session notes

## Who served, and when

`scripts/law/supreme_court_justices.py` reads the Court's list and the Federal Judicial Center's Directory and writes `content/supreme-court/justices.yaml` (121 appointments: 17 as Chief Justice, 104 as Associate Justice; John Rutledge, Edward D. White, Charles Evans Hughes, Harlan F. Stone and William H. Rehnquist hold one of each). Service begins on the day of the judicial oath, as the Court's list counts it, and ends on the Court's date. Every appointment matched exactly one row of the Directory by family name, title and year; John Rutledge's 1795 recess appointment as Chief Justice matched on its recess date, since the Senate never confirmed it.

The Directory's Seat ID (such as SCT0603, the third holder of seat 6) names each Justice's predecessor. Its Termination column gives how service ended, except that a Justice who retired and later died shows "Death": where the Directory's senior status date falls within a month of the Court's end date, the service is recorded as ending in retirement (for example Hugo L. Black, Sept. 17, 1971; Charles Evans Hughes, June 30, 1941).

## The Courts

A Court is named for its Chief Justice and runs from the Chief Justice's oath to the end of their service. Its Associate Justices are those whose service overlaps that span. The seat counts come from the Acts the Federal Judicial Center lists; the Judiciary Act of 1801, repealed before any seat fell vacant, is left out.

The short histories in `content/supreme-court/courts.yaml` are in the project's own words, each sentence cited to the page it comes from.
