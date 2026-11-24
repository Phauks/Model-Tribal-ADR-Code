---
id: 2026-11-24-federal-recognition-lists
date: '2026-11-24'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: One session wrote scripts/law/recognition_lists.py and ran it; no record was written by hand.
- kind: page-fetch
  name: federalregister.gov and govinfo.gov
  detail: The Federal Register API's search for notices titled "Indian Entities Recognized", each notice's PDF, and nine whole Federal Register issues from 1979 to 1993 from GovInfo.
purpose: 'Trevor asked to cover federal Indian law in full, starting with tier 1 (Nov. 24, 2026, after the coverage spike in research/analyses/2026-11-24-federal-laws-and-treaties-coverage.md). This session gives every list of federally recognized Native nations the Bureau of Indian Affairs has published in the Federal Register its own source record, so a nation page can show when the nation first appeared on the list.'
queries:
- Every Federal Register notice since 1994 whose title begins "Indian Entities Recognized"
- The lists published from 1979 to 1993, by their Federal Register citations
sources_added: []
limits: 'The records carry each notice''s title, date and citation; nobody has compared the entries on any list with the nation records yet, so every record is Unverified. The search for lists between 1988 and 1993 tried three more citations (1989, 1990 and 1991), none of which is a list; whether the Bureau published one in 1989-1992 is not settled. Titles of the pre-1995 lists are read from scanned text, so their wording may differ slightly from the printed heading.'
---

# Federal Register lists of recognized nations: session notes

## What was built

`scripts/law/recognition_lists.py` has three steps. `fetch` asks the Federal Register API for every notice titled "Indian Entities Recognized" (32 since 1995, including two lists in some years and one correction in 2021) and downloads each notice's PDF from GovInfo. The API starts in 1994, so for the earlier lists the script takes each Federal Register citation, has GovInfo's link service find that day's issue, finds the page that carries the list's heading (skipping the table of contents) and the page that ends the notice, and keeps only those pages. `file` stores the copies in the project's bucket under `recognition-lists/<key>.pdf`, and `records` writes the source records.

The citations for 1979 (44 Fed. Reg. 7235), 1988 (53 Fed. Reg. 52829) and 1993 (58 Fed. Reg. 54364) are the ones the Feb. 16, 1995 list gives (60 Fed. Reg. 9250); 1982 (47 Fed. Reg. 53130) is cited in the 1988 list; the others (1980, 1981, 1983, 1985 and 1986) are the citations as commonly given, and the script accepted each only after finding the list heading in that issue. Citations for 1989 (54 Fed. Reg. 19806), 1990 (55 Fed. Reg. 38900) and 1991 (56 Fed. Reg. 47325) led to issues without a list, so they were dropped.

## Results

41 lists have a record: nine from 1979 to 1993 and 32 since 1995. 40 records are new (keys `bia-recognized-entities-<year>`, or with the full date where a year has two notices); the existing record of the Jan. 30, 2026 list keeps its text and gains the copy filed on Nov. 22 under `govinfo/`. Every record's notes name the list it follows, so the records read as a chain from the first list in 1979.

A spot check of the nine early copies found tribal names (Navajo, pueblo and rancheria entries) on every one. The early lists' headings change over time: "Indian Tribal Entities That Have a Government-to-Government Relationship With the United States" (1979-1981), "Indian Tribal Entities Recognized and Eligible To Receive Services From the United States Bureau of Indian Affairs" (1982-1986) and "Indian Entities Recognized and Eligible To Receive Services ..." from 1988.

## Next

Compare each nation record's name with its entries on these lists, to show the year each nation first appeared and its name on each list. The Oct. 27, 2010 notice is a single page and is probably a correction; read it and the other second notices in a year (2016, 2018, 2023) to say what each changes.
