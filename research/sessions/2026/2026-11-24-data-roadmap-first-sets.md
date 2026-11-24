---
id: 2026-11-24-data-roadmap-first-sets
date: '2026-11-24'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: One session chose the documents, wrote research/data-roadmap/small-sets.yaml and scripts/law/small_sets.py, and ran the script; no record was written by hand. One smaller assistant searched the web for Inter-American Commission matters about Native nations in the United States.
- kind: page-fetch
  name: ERIC, the Internet Archive, GovInfo, agency sites, the Census Bureau, the UN Official Document System and the University of Minnesota Human Rights Library
  detail: Each document's file was downloaded by script and checked (a PDF opens, a zip holds a shapefile).
purpose: 'Trevor asked for a general data roadmap the project can return to and add to, and to start on its smallest sets: major federal reports, land, and international documents (Nov. 24, 2026). This session builds those first sets as Unverified source records, with copies in the bucket: served for U.S. government and public domain works, private for the rest.'
queries:
- Major federal reports on Indian affairs from 1867 to 2024, by title, on ERIC, the Internet Archive and the publishing agencies' sites
- Royce's Indian Land Cessions in the United States (1899), by the Bureau of American Ethnology's annual report volume
- The Census Bureau's TIGER/Line files for tribal areas, subdivisions, Alaska Native regional corporations, tribal block groups and tribal tracts
- UN documents on Indigenous peoples in the United States, by document symbol
- Inter-American Commission decisions and thematic reports on Indigenous peoples in the United States
sources_added: []
limits: 'Every record is Unverified: its title, date and number come from the document''s first pages or its catalog entry and nobody has compared them with the printed document. The Organization of American States'' sites (oas.org, cidh.oas.org) turned away every automated request, so three Inter-American records have no stored copy and the two Dann reports are stored from the University of Minnesota Human Rights Library''s copy. Several scans carry a library''s cover page first (ERIC''s résumé; Google''s usage page). The Cohen scan has no text layer. The Census API now needs a key, and the Indian Health Service''s budget pages did not answer, so the population counts and budget lists were not started.'
---

# The data roadmap's first small sets: session notes

## What was built

`research/data-roadmap/small-sets.yaml` lists each document once: its record key, roadmap section, citation, the page a reader is sent to, the file to store, the bucket folder and its rights. `scripts/law/small_sets.py` reads it in three steps. `fetch` downloads each file and checks it; `file` stores it in the bucket with `scripts/captures/mirror_captures.py`, marking U.S. government and public domain works for serving and keeping the rest private; `records` writes a source record for each new entry and gives an existing record its stored copy. Adding a document later is one more entry and a re-run.

## Results

37 documents: 31 new records and 6 existing records given a stored copy. 34 files were stored (about 360 MB); 3 are link-only.

Federal reports (16): the Doolittle Committee's Condition of the Indian Tribes (1867), the Indian Peace Commission's report (1868), the Meriam Report (1928), Cohen's Handbook of Federal Indian Law (1942), the Kennedy Report (1969), both volumes of the American Indian Policy Review Commission's final report (1977), the Commission on Civil Rights' Indian Tribes: A Continuing Quest for Survival (1981), A Quiet Crisis (2003) and Broken Promises (2018), the Senate Special Committee on Investigations' final report (1989), the Indian Law and Order Commission's Roadmap (2013), both volumes of the Federal Indian Boarding School Initiative report (2022, 2024), the Not Invisible Act Commission's Not One More (2023) and the Justice and Interior Departments' response (2024).

Land (10): Royce's Indian Land Cessions in the United States (1899) and nine Census Bureau boundary files: the 2025 tribal areas (867), tribal subdivisions (484), Alaska Native regional corporations (12), tribal block groups (935) and tribal tracts (493); the 2020 tribal areas (859) and their cartographic version (704); and the 2010 (813) and 2000 (734) tribal areas.

International (11): the UN Declaration's official resolution (A/RES/61/295), the Special Rapporteur's 2012 report on the United States, the Committee on the Elimination of Racial Discrimination's 2006 Western Shoshone decision and its 2008, 2014 and 2022 concluding observations on the United States, the Inter-American Commission's two Dann reports (1999, 2002), its 2023 Onondaga admissibility decision, and its 2015 and 2021 thematic reports.

Rights changed on three existing records. The Meriam Report was published in 1928, so its term ended at the end of 2023 and it is now served. The 2020 TIGER file was recorded as "facts only" though it is a Census Bureau work, so it is now a government work, and its existing capture row is marked for serving.

## Next

Check each record against its document and mark it reviewed. Pull the three Inter-American documents by hand (pull list). The roadmap's next small items are the Census population counts (a free Census API key, which goes on Trevor's keys list) and the Indian Health Service and Bureau of Indian Affairs budget justifications (sites that need a person or another network).
