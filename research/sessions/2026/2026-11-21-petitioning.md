---
id: 2026-11-21-petitioning
date: '2026-11-21'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: web-search
  name: web search
- kind: page-fetch
  name: page fetch (web-fetch tool for bia.gov and the University of North Texas archive)
- kind: page-fetch
  name: curl (Federal Register API, govinfo.gov)
- kind: other
  name: python3 for merging
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: A research sub-agent searched, opened sources and returned cited facts in the raw file; the
    lead session reviewed the output and built the records.
purpose: List every group that has petitioned for federal acknowledgment under 25 C.F.R. Part 83, with
  petition numbers, stages and determinations.
queries:
- 'web search: Office of Federal Acknowledgment list of petitioners by state'
- 'web search: "Summary Status of Acknowledgment Cases" Office of Federal Acknowledgment'
- 'web search: petitioner #319 / #338 letter of intent (no result)'
- https://www.bia.gov/sites/default/files/media_document/listpetbystate_2013-11-12.pdf (web fetch, state-by-state
  extraction, offsets tried)
- https://www.bia.gov/sites/default/files/dup/assets/as-ia/ofa/admindocs/StatusSummary_2013-11-12.pdf
- https://www.bia.gov/as-ia/ofa/petitions-in-process
- https://www.bia.gov/as-ia/ofa/resolved
- https://www.bia.gov/as-ia/ofa/re-petition
- https://www.bia.gov/as-ia/ofa/additional-resources
- https://webarchive.library.unt.edu/eot2008/20090508030445id_/http://www.doi.gov/bia/docs/ofa/admin_docs/Petitioners_by_State_092208.pdf
- 'Federal Register API documents.json, agency indian-affairs-bureau, terms: "Federal Acknowledgment";
  "Proposed Finding"; "Final Determination" acknowledgment; "Petition for Federal Acknowledgment"; acknowledgment
  "Indian tribe" petitioner (190 unique documents, 1994-2026)'
- govinfo.gov HTML of Federal Register notices 2015-30228 and 2022-2026 receipt notices
- govinfo.gov Public Law 115-121 and Public Law 116-92
sources_added:
- federal-register-02-17551
- federal-register-02-23672
- federal-register-02-299
- federal-register-03-30575
- federal-register-04-13871
- federal-register-04-14393
- federal-register-04-14394
- federal-register-05-20719
- federal-register-05-20720
- federal-register-2010-14733
- federal-register-2011-10117
- federal-register-2011-6472
- federal-register-2012-22380
- federal-register-2012-7646
- federal-register-2014-01831
- federal-register-2015-16711
- federal-register-2017-27764
- federal-register-95-13171
- federal-register-95-31075
- federal-register-96-8636
- federal-register-97-23018
- federal-register-97-33532
- federal-register-98-28438
- federal-register-98-298
- federal-register-99-33117
- federal-register-e6-16191
- federal-register-e7-12727
- federal-register-e7-2966
- federal-register-e8-5551
- ofa-list-of-petitioners-by-state-2008
- ofa-list-of-petitioners-by-state-2013
- ofa-petitions-in-process
- ofa-petitions-resolved
- ofa-re-petition-requests
- ofa-status-summary-2013
- public-law-115-121
- public-law-116-92-section-2870
limits: 'Primary list is the Office of Federal Acknowledgment List of Petitioners by State dated 2013-11-12
  (the newest list bia.gov still posts). The fetch tool cut its text at about 73,800 characters, partway
  into Vermont, so Vermont, Virginia, Washington, West Virginia and Wisconsin come from the 2008-09-22
  edition (University of North Texas End of Term 2008 archive, captured 2009-05-08). Any letters of intent
  filed in those states between 2008 and 2013 are missing; petition numbers 319 and 338 were not found
  anywhere (323 is the Pamunkey Indian Tribe). No Wyoming section exists in the 2008 edition. Rows were
  extracted by a summarizing fetch tool rather than from the raw PDF, because bia.gov blocks curl and
  web.archive.org was unreachable from this session (both curl and the fetch tool). Names, dates and Federal
  Register citations taken only from the lists (mostly pre-1994 determinations) carry medium confidence
  and should be spot-checked. Determinations from 1994 on were checked against Federal Register API metadata.
  Groups with only a letter of intent that are not on the current Petitions in Process list are typed
  unrecognized (inactive); bia.gov says groups on the 2013 list may no longer be active petitioners under
  the current (2015) regulations, which dropped letters of intent. Canoncito Band of Navajos (#114) got
  no entity because it is part of the roster Navajo Nation. Federation: Moorish Science Temple of America
  (#167) is included as listed, though the Department found it ineligible to petition. Groups whose older
  letter-of-intent number matches a current 400-series petition were merged when the names are identical
  (#140 to #411, #139 to #406, #239 to #401, #158 to #403) and for Mattaponi (#157 to #408), where the
  names are close and the match is noted. Amah Mutsun Band of Ohlone/Costanoan Indians (#120) and Amah
  Mutsun Tribal Band of Mission San Juan Bautista (#412) are kept as separate entities because the names
  differ. Two different groups share #336 on the 2013 list. No official websites were recorded, because
  none was clearly identifiable from these sources and searching each group one by one was out of scope.
  No state-recognition facts were recorded. No Native Hawaiian groups appear in any petitioner list read.
  State-presence facts record only the state the Office of Federal Acknowledgment lists, coded presence
  "other".'
---

## What was done

Read the agent contract and roster. Found the 2013 petitioner list and current status pages on bia.gov through web search, then read them with the web-fetch tool. bia.gov refused curl and the Wayback Machine was blocked, so no Wayback snapshot was used; every bia.gov page is the live copy read 2026-11-21. The 2013 PDF was extracted state by state. Its last states were cut off, so the 2008 edition from the University of North Texas archive filled them in, and the 2013 status summary supplied Washington determination dates. Pulled every Bureau of Indian Affairs Federal Register document matching acknowledgment terms through the API (190 documents) and linked proposed findings, final determinations, reconsiderations, receipt notices for the 400-series petitions, and re-petition notices to petition numbers. Built: entities for non-roster petitioners; recognition facts (petitioning for the 22 current petitions and the 3 re-petition requests; unrecognized for denied, withdrawn, ineligible and inactive letter-of-intent groups); federal recognition facts on 41 roster petition entries (Part 83 acknowledgments with final-determination citations, plus legislative and administrative recognitions, including the 2018 Virginia act, the 2019 Little Shell act and the 2025 Lumbee act); state-presence facts; and former and alternate names parsed from the list parentheticals. Diacritics such as Fernandeño and Juaneño are kept in UTF-8 names; only ids are ASCII.

## Output

`research/raw/2026-11-21/petitioning.json`: 741 facts about 357 nations or communities from 101 sources. What the build kept and dropped is in `research/raw/2026-11-21/build-report.json`.
