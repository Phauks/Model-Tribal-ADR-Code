---
id: 2026-11-27-water-rights-settlements
date: '2026-11-27'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: One session copied Table 1 of the Congressional Research Service's report R44148 into research/water-settlements/enacted-settlements.csv by hand (matching each nation to its profile by hand), then wrote scripts/law/water_settlements.py and ran it.
- kind: page-fetch
  name: everycrsreport.com, api.govinfo.gov and digitalrepository.unm.edu
  detail: The report on EveryCRSReport.com; GovInfo's search and granule summaries for each public law, and each Act's Statutes at Large PDF; the University of New Mexico's two Native American Water Rights Settlement Project sets by OAI-PMH (metadata only).
purpose: 'Trevor picked new data source category 2, Indian water rights settlements, from the ranked list of new kinds of sources (project thread "Collect approved tribal laws, water settlements and old nation codes", Nov. 27, 2026: "grab 1,2,4").'
queries:
- Every settlement Congress enacted, with its Act and the public laws that amended it (Congressional Research Service, R44148, Table 1)
- Each of those 36 public laws in the Statutes at Large on GovInfo
- Every item in the University of New Mexico's Native American Water Rights Settlement Project
sources_added: []
limits: 'Every record and fact is Unverified. The table is copied by hand from the report, not read by script; the four settlements reached without an Act of Congress (39 in all) are not in it. Several settlements are titles of large omnibus Acts (the Consolidated Appropriations Acts of 2001, 2005 and 2021, the Omnibus Public Land Management Act of 2009, the Claims Resettlement Act of 2010); the record and copy are of the whole Act. The University of New Mexico''s PDFs refuse automated downloads, so its settlement agreements, compacts and decrees are catalogued with a link to the university''s copy and put on the hand-pull list, without the university''s own descriptions; its federal legislation is left to the Act records. The acre-feet and federal cost in each fact are the report''s figures, not ours.'
---

# Indian water rights settlements: session notes

## What was built

`research/water-settlements/enacted-settlements.csv` lists the 35 settlements in Table 1 of *Indian Water Rights Settlements*, R44148 (Dec. 3, 2024): year, the Act and its amendments, states, the nations as the report names them and their profiles, acre-feet a year and the authorized federal cost.

`scripts/law/water_settlements.py` has four steps. `fetch` finds each of the 36 public laws on GovInfo (by a search for "Public Law <number>", checked against each granule's own citation; six omnibus Acts are found by their first page instead) and reads the university's two sets. `file` stores each Act's PDF under `govinfo/STATUTE-<volume>/`. `records` writes the Act records (27 new; 9 that already existed get the nations and the topic `water-rights-settlement`), 50 catalog records for the university's agreements, compacts, decrees, state legislation and tribal water codes. The report itself is the record `crs-r44148` (the June 17, 2025 version, from the congressional sources thread); the table was copied from the Dec. 3, 2024 version. `facts` writes `research/jurisdiction/water-rights-settlements.json`.

## Results

- 36 Acts of Congress, each with a stored copy (27 new copies, about 179 MB).
- 50 catalog records linking the university's documents (30 settlement agreements and compacts, 17 decrees and court filings, 2 tribal water codes, 1 state law), listed in `research/water-settlements/university-of-new-mexico-items.csv`.
- 44 nation-page facts for 40 nations under a new jurisdiction topic, `water-rights-settlement` (docs/data-model.md).
- One collection, "Indian Water Rights Settlements" (`water-rights-settlements`), one item per settlement, linking the enacting Act's page.

## Next

The university's 50 documents are on the hand-pull list (`/mnt/project-files/research/documents-to-get.md`, section 1l). Settlements Congress passes later are Acts, which the federal statute watchers will find; the CSV is updated by hand when the report is revised.
