---
id: 2026-11-24-supreme-court-native-cases
date: '2026-11-24'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: One session wrote scripts/caselaw/supreme_court_native_cases.py and ran it; where the script's sources disagreed, smaller Claude models read the official report's scan for the disputed fact only. No other readers were used.
- kind: page-fetch
  name: scdb.wustl.edu, static.case.law, tile.loc.gov, api.oyez.org
  detail: The Supreme Court Database's justice-centered files (releases 2026_01 and Legacy_07); the Caselaw Access Project's volume files of the United States Reports (volumes 1 to 572); the Library of Congress scans of each case in the United States Reports; Oyez's case data.
purpose: 'Trevor asked for a record and a page for every Supreme Court case involving Native nations or people (Nov. 24, 2026), built economically by script, after the count in research/analyses/2026-11-24-supreme-court-native-cases-coverage.md.'
queries:
- For each case in research/supreme-court-coverage/native-cases-scdb.csv without a record, its citation, decision date, caption, printed dates, opinions and the page each starts on, and the bench
- Whether the Supreme Court Database, the Caselaw Access Project's text, the Library of Congress scan and Oyez agree on each of those
- Which Native nations each caption names
sources_added: []
limits: 'The records are written by script and not yet read by a person. Each has a review block listing the cross-checks; "verified" there means the sources agreed, not that a person checked the record. Nations are proposed from the caption only, and historical names that could be more than one of today''s nations are left unlinked. Cases decided since 2014 and cases in volumes 543 to 572 (no Library of Congress scan) are handled separately.'
---

# Records for every Supreme Court case involving Native nations or people: session notes

The script and how to run it are described at the top of `scripts/caselaw/supreme_court_native_cases.py`. Each run writes `research/reviews/<date>-supreme-court-native-cases.csv`, one row per case with the result of every check.
