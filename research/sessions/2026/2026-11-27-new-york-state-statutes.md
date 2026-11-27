---
id: 2026-11-27-new-york-state-statutes
date: '2026-11-27'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: One session wrote a New York adapter for the shared state statutes pipeline (scripts/law/state_statutes/), ran it, read every strong hit a reader marked none and 40 random verdicts, and settled the ones it disagreed with in research/state-statutes/ny/settled.json. Smaller Claude models (Haiku) read every keyword hit and the recall samples blind to their pool, in ten batches of 139, and gave each section a core, incidental or none verdict.
- kind: page-fetch
  name: New York State Senate Open Legislation laws service
  detail: 'One answer per law from legislation.nysenate.gov/api/3/laws (the whole tree of chapters, articles, parts and sections, with every section''s text), 134 laws: the 94 Consolidated Laws, the eight court acts and 32 unconsolidated laws. The Senate and Assembly rules and the state Constitution were not read. The service needs a free key, which Trevor set as NEW_YORK_SENATE_API_KEY on Nov. 27, 2026.'
purpose: 'Trevor set the New York Senate key on Nov. 27, 2026 and asked to run New York "in parallel now to make sure it works"; this session continues the state statutes sweep (research/sessions/2026/2026-11-27-state-statutes-sweep.md) with New York.'
queries:
- Which sections of the New York Consolidated Laws, court acts and unconsolidated laws are Indian law, labeled core or incidental, by the Oklahoma pilot's method
- How well the keyword pass finds them, measured on random samples of the other sections
sources_added: []
limits: 'Reader verdicts are Unverified until a person checks them (Trevor will review every state''s labels once all are in). Recall rests on samples of 300 non-hits near a strong hit and 300 other non-hits. Each record links to the section''s page on nysenate.gov and is not served (state statutes stay link only). The service prints no history lines, so no record has an enactment year. Sections in force only.'
---

# New York state statutes: session notes

The method is the one in the first sweep's notes (research/sessions/2026/2026-11-27-state-statutes-sweep.md) and in `scripts/law/state_statutes/README.md`. New York's results are in `research/state-statutes/ny/`.

## The source

The Senate's Open Legislation service answers one call per law with the law's whole tree and every section's text, so the 134 laws came down in 14 seconds (153 MB). The key goes in the address; the adapter reads it from `NEW_YORK_SENATE_API_KEY`, never prints it (a failed download is named by its law), and the saved answers do not contain it. The service leaves out repealed sections and prints no source notes, so no section has an enactment year and the near sample is drawn only from sections printed next to a strong hit. The section pages on nysenate.gov, which each record links to, sit behind a browser check that cloud sessions cannot pass, so the links follow the Senate's own address pattern (`nysenate.gov/legislation/laws/<law>/<section>`) and were not opened from this session.

Three things in the text needed care. A section printed in two versions (one in force until a date, one after) carries an editor's note on its own line ("* NB Expires June 30, 2027"); the adapter takes out each note and keeps both versions. New York gives a second section with the same number a star ("§ 6-o*2"); the record key keeps the star apart (`new-york-laws-bnk-6-o-2`) and the citation prints the number as New York cites it ("§ 6-o"). And the General City Law prints sections 31 to 40 both in article 3 and inside § 25-a, which the service keeps apart by location; those take the location as their number.

## Citation form

The Indigo Book's table for New York (T1) cites each consolidated law by its own name and a publisher's year, "N.Y. <subject> Law § x (McKinney <year>)", with its own list of subject abbreviations, which the adapter follows; the court acts are cited the same way ("N.Y. Fam. Ct. Act § 115") and the Civil Practice Law and Rules by rule number with no section sign ("N.Y. C.P.L.R. 1602"). Laws the table does not list (the Cannabis Law and the Veterans' Services Law) follow the same pattern (project choice). McKinney's prints the unconsolidated laws under numbers of its own that the Senate's service does not give, so the five unconsolidated acts with Indian law sections are cited by the act's name and its own section number, such as "N.Y. Urban Development Corporation Act § 3 (McKinney 2026)" (project choice). The year is McKinney's 2026 edition because the Indigo Book names no form for the Senate's text; the text itself was read from the Senate's service.

## Results

40,160 sections, 40,124 in force; 265 strong and 518 weak-only hits; 369 Indian law sections (150 core, 219 incidental). The keyword pass takes only the nations' distinctive names as weak terms (Shinnecock, Poospatuck, Unkechauge, Tonawanda, Tuscarora, Saint Regis, Akwesasne, Haudenosaunee and the like): Seneca, Oneida, Onondaga, Cayuga, Allegany, Cattaraugus and Mohawk are mostly county, town, lake and river names in this code, and where a section means the nation it also says Nation, Indians, tribe or reservation. The readers were told so (research/state-statutes/reader-prompt.md).

All 98 sections of the Indian Law are on the list as core. The other core sections are mostly Education Law article 83 on Indian schools (§§ 4101 to 4119) and the state's Indian affairs duties in the Education and Social Services Laws (§§ 111 and 39), the tribal-state compact and settlement agreement sections of the Executive Law (§§ 11 and 12) and State Finance Law (§ 99-h), the Executive Law's human remains and funerary objects section (§ 171), the cigarette, motor fuel and sales tax sections for qualified reservations (Tax Law §§ 282, 284-e, 301-a, 470, 471, 471-e and 1112), the county-tribal detention agreements with the Oneida Indian Nation (County Law §§ 853 and 854) and the highway, railroad and transportation corporation sections on Indian reservations. Most incidental sections are minority and women-owned business definitions that count American Indian owners, peace officer and protection order sections that name tribal courts and Indian police, and lists of governments that include Indian nations.

The readers marked 13 strong hits none. The session agreed with three (a field-trip list that names a Native American museum, Educ. Law § 2590-h; a highway route described by a reservation boundary, High. Law § 341; a bridge named for two men, High. Law § 342-a) and settled ten as incidental: six minority business or workforce definitions that count American Indian or Native American persons (Envtl. Conserv. Law § 52-0113, Exec. Law § 821, Pub. Auth. Law §§ 1020-v, 1045-x, 1695 and 2799-gggg), Native Hawaiian demographic data collection (Exec. Law § 170-e) and an advisory committee that serves Native Hawaiians (Educ. Law § 805), and the Indian Health Service as a certifier of diabetes education programs (Pub. Health Law § 2999-cc, Soc. Serv. Law § 365-a), as the earlier states held for race categories with legal effect and for the Indian Health Service's roles. Neither recall sample found a miss (0 of 300 near a strong hit, 0 of 300 others), and the 40 verdicts read at random all agreed, apart from one strong hit the review had already settled.
