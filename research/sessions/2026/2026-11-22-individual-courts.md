---
id: 2026-11-22-individual-courts
date: '2026-11-22'
researchers:
- Claude (AI assistant)
tools:
- kind: web-search
  name: Web search
  detail: Found each nation's court pages and the official directories that list its courts.
- kind: page-fetch
  name: Web-fetch tool, then scripts/review/individual_courts_fetch.py
  detail: The readers used the web-fetch tool until its shared hourly budget ran out, then the project's own fetcher, which saves each page so the quotes can be checked. The Alaska Tribal Court Directory PDF was read through pdftotext. Sites that refused the fetcher were logged as blocked and not worked around.
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: Nineteen reader agents, one per batch of nations (two mid-size-model batches for nations with large court systems, seventeen small-model batches), followed research/reviews/briefs/2026-11-22-individual-courts.md. The Navajo Nation was read by the coordinating session. No second reader checked the readings.
- kind: other
  name: python3 script
  detail: scripts/review/individual_courts.py (collect, which checks each quote against its page; apply, which adds the courts, source records and search log entries).
purpose: >-
  List every court of each Native nation on its page, not only "Tribal Court", with where each court sits and an official link (Trevor, Nov. 22, 2026: "navajo nation has 11 district courts, we should list all of them. same for other tribes").
queries:
- '"<nation name>" tribal court; the nation''s judicial branch, court, judiciary and justice pages; district, family, juvenile, healing to wellness, peacemaking, appellate and supreme courts'
- State court systems' tribal court directories, the Alaska Tribal Court Directory (2022), the Bureau of Indian Affairs list of Courts of Indian Offenses, intertribal courts' member lists
sources_added: []
limits: >-
  One reader per batch and no second reader. A quote found on its page shows the words are there, not that the reading is right. Low-confidence findings, findings whose quote was not on the page and courts the profile already lists under another name were not added. The 141 new source records are listed by their found_in field. Alaska directory entries reflect a 2021 survey. 25 searches were refused by sites and 97 failed.
---

Output: [the report](../../reviews/2026-11-22-individual-courts.md), with one record per nation in `.json`, one row per court in `.csv` (empty `lead_author_decision` column) and counts; entries in the `courts` [search logs](../../search-logs/README.md) of all 416 nations searched (321 extended, 91 new).

Results: 549 courts found; 280 facts added to 137 profiles (214 courts the profiles did not list, 53 listed courts with their address, group or appeals, and 13 paths of appeal on listed courts). New schema fields on `justice_institutions`: `part_of` (the group a court belongs to) and `location` (place, state and street address, from the source only).
