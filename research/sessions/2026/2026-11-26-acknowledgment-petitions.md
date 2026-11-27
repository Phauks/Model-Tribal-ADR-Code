---
id: 2026-11-26-acknowledgment-petitions
date: '2026-11-26'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: One session wrote scripts/law/acknowledgment_petitions.py and ran it; no record was written by hand.
- kind: page-fetch
  name: bia.gov
  detail: The Office of Federal Acknowledgment's two petition lists, each petition's page, and the 375 documents those pages link, four petitions at a time.
purpose: 'Trevor asked to build tier 2 of the data roadmap to completion (project thread "Build tier 2 federal sources", Nov. 26, 2026). This session gives each of the Department of the Interior''s documents in the federal acknowledgment petitions (25 C.F.R. part 83) its own source record and a stored copy, served by the site.'
queries:
- The Office of Federal Acknowledgment's Resolved Petitions list (bia.gov/as-ia/ofa/resolved) and Petitions in Process list (bia.gov/as-ia/ofa/petitions-in-process), Nov. 26, 2026, and each petition's page
sources_added: []
limits: 'The records carry the petition pages'' facts (the document''s name and year, the petition''s number, state and decision or status); nobody has read the documents, so every record is Unverified. 45 documents, mostly the older proposed findings, have no year on the page, so their records have no date until someone reads the document. The petitioners'' own documents and the public comments are not government works: they are stored privately and get no record.'
---

# Records for the federal acknowledgment petitions: session notes

## What was built

`scripts/law/acknowledgment_petitions.py` has three steps. `fetch` reads both of the Office of Federal Acknowledgment's lists and each petition's page, and downloads every document a page links, under the heading it sits under (Petitioner, Office of Federal Acknowledgment, Public Comments). `file` stores each document in the bucket under `acknowledgment/<petition number>/<file>`: the Department's documents are served as works of the United States government, and the petitioners' documents and the public comments are kept privately. `records` writes one record per Department document, of kind `federal-agency-document`, with the Office of Federal Acknowledgment as author, the document's name as its kind ("Proposed Finding", "Final Determination", "Phase I Technical Assistance Review Letter" and so on) and the petition number.

## Nations

An acknowledged petitioner's documents are linked to the nation's profile. Eleven of the 18 matched by name; the other seven petitioned under older names (Poarch Band of Creeks, Samish Tribe of Indians, Mashpee Wampanoag Indian Tribal Council, Jamestown Clallam Tribe of Indians, Snoqualmie Tribal Organization, Death Valley Timbi-Sha Shoshone Band, Wampanoag Tribal Council of Gay Head) and are matched in the script by petition number, each checked against the profile. Denied and pending petitioners are named but not linked, since they have no profile.

## Results

The lists hold 53 resolved petitions (18 acknowledged, 34 denied, and one, the Fernandeño Tataviam Band of Mission Indians, listed with no decision) and 22 in process. Their pages link 375 documents (1.63 GB): 135 of the Department's (0.83 GB), 137 of the petitioners' and 103 public comments. Each Department document has a record, listed at /stats/federal-acknowledgment, and its page names the Federal Register notices and Interior Board of Indian Appeals decisions about the petition.

## Next

Read the date of each finding and determination from the document itself, and link each record to its Federal Register notice and Board decision records.
