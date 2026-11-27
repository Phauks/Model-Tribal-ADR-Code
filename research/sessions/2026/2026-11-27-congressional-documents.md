---
id: 2026-11-27-congressional-documents
date: '2026-11-27'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: One session wrote scripts/law/congressional_documents.py, scripts/law/crs_reports.py and scripts/tribes/acs_native_areas.py and ran them; no record was written by hand.
- kind: other
  name: GovInfo API (api.govinfo.gov) and Congress.gov API (api.congress.gov)
  detail: Both with the project's free api.data.gov key (DATA_GOV_API_KEY). GovInfo's search, package summaries, MODS records and PDFs for the Congressional Hearings, Congressional Reports, Congressional Serial Set and Committee Prints collections; Congress.gov's law, bill, bill actions and committee report endpoints and its list of Congressional Research Service products.
- kind: page-fetch
  name: www2.census.gov
  detail: The American Community Survey 2020-2024 five-year table-based summary file (nine tables) and its geography file. The Census Bureau's own data API refuses the api.data.gov key.
purpose: 'Trevor asked to "work on those tier 2 gaps" once the api.data.gov key was set (Nov. 27, 2026). The key-gated tier 2 sources were Congress''s own documents on Indian affairs (hearings and committee reports), the legislative histories of the statutes the project holds, the Congressional Research Service''s reports, and Census and American Community Survey tables (docs/data-roadmap.md; research/analyses/2026-11-26-tier-2-and-3-data-sources.md, section 2.7).'
queries:
- 'GovInfo search, each of CHRG, CRPT and CPRT: committee:(Indian) OR committee:("Native American") OR committee:("Native Hawaiian") OR a title holding Indian, Indians, tribal, tribe, tribes, Native American, Alaska Native, Native Hawaiian, a nation''s name, Rancheria, reservation, Eskimo and the like (6,325 candidates, CRPT including the Serial Set''s reports)'
- For each federal statute record with a public law number from the 93rd Congress on (205 laws), the bill that became it on Congress.gov and the reports its actions and committee report list name, then each report on GovInfo (CRPT from the 104th Congress, the Serial Set before)
- Every product in Congress.gov's list of Congressional Research Service products (14,276), kept when its title names Native people or a nation
- The American Community Survey 2020-2024 five-year tables B01003, B02001, B02010, B01002, B19013, B17001, B23025, B15003 and B28002 at summary level 250
sources_added: []
limits: 'Records are generated from GovInfo''s and Congress.gov''s metadata and are Unverified. GovInfo is still scanning the Serial Set, so older reports it has not put up yet are missing (of the 296 reports Congress.gov names for the 205 laws, 214 were found on GovInfo). Congress.gov has bill data only from the 93rd Congress (1973), so laws before then have no legislative history here. Floor debate in the Congressional Record is not collected. A scan over 64 MB (212 documents, mostly scanned hearings, 50 GB of the 70 GB) is linked at GovInfo, not stored. The Census figures are estimates for everyone living in an area, Native or not.'
---

# Congressional documents, legislative histories, CRS reports and the American Community Survey: session notes

## What was built

`scripts/law/congressional_documents.py` searches GovInfo for every hearing, report and committee print that a committee for Indian, Native American or Native Hawaiian affairs wrote or whose title names Native people, reads each one's summary and MODS record, and keeps a document when a committee for Indian affairs wrote it, when its title or subtitle names Indians, tribes, Native Americans, Alaska Natives, Native Hawaiians, a nation the project has a page for or a reservation the Census Bureau names, or when GovInfo's Library of Congress subject headings for it are about Indians. Titles such as "Indian River grapefruit", "Indian Ocean", "U.S.-Indian Nuclear Energy Cooperation" or a county list ("Kiowa and Comanche Counties") do not count. The review file `research/reviews/2026-11-27-congressional-documents.csv` lists every candidate with the decision and the reason; the 872 left out are mostly military, lighthouse and customhouse reservations, creeks and bridges.

The same script reads Congress.gov for the legislative history of each federal statute record from the 93rd Congress on: the bill that became the law, and the reports its actions name ("With written report No. 100-157") or its committee report list gives. Each report found on GovInfo gets a record that names the law in `legislative.laws`, and the law's page lists it under On this site, Legislative history.

Records are kind `congressional-document` (a new kind, which gets a page at `/laws/<key>`), with `citation.genre` Hearing, House report, Senate report or Committee print, and a new `legislative` block: chamber, Congress, session, committees, bills, the laws it is the history of, the days a hearing was held and the GovInfo package. Keys are `house-report-<congress>-<number>` and `senate-report-<congress>-<number>` (with `-session-<n>` before the 80th Congress, when reports were numbered by session), `senate-hearing-<congress>-<number>` for a hearing with an S. Hrg. number, and `congressional-hearing-<package>` or `committee-print-<package>` otherwise. A hearing that is both a born-digital CHRG package and a scanned GOVPUB one keeps the born-digital one.

`scripts/law/crs_reports.py` lists every Congressional Research Service product on Congress.gov and keeps the 103 whose titles name Native people or a nation ("Indian" alone, which in a CRS title is nearly always India's, does not count). Each is a `congressional-document` with genre CRS report, CRS In Focus, CRS Legal Sidebar, CRS Insight, CRS infographic or CRS testimony; its authors, version and the laws Congress.gov relates it to are kept, and its current PDF is stored under `crs/`.

`scripts/tribes/acs_native_areas.py` reads nine tables of the American Community Survey's 2020-2024 five-year summary file for the 704 American Indian, Alaska Native and Native Hawaiian areas and writes `research/census/acs-2020-2024-native-areas.csv`, which the table builder shows as its "Census areas" dataset, each area linked to the nations whose pages name it.

Every document is a work of the United States government (17 U.S.C. § 105), so each PDF of 64 MB or less is stored in the bucket under `congress/<package>.pdf` or `crs/<id>.<version>.pdf` and served.

## Results

- 5,532 congressional documents: 1,032 hearings (1933-2026), 4,441 House and Senate reports (1821-2026) and 59 committee prints (among them the American Indian Policy Review Commission's task force reports of 1976-1977).
- 172 statutes have a legislative history on their pages; 180 of the 205 laws since 1973 have reports named on Congress.gov, and 138 of those have at least one report on GovInfo.
- 103 Congressional Research Service products.
- 704 Census areas with American Community Survey figures.
- 542 congressional records name a nation; nations are matched by name in the title only (a match on "Tribes" alone, the alias of the Confederated Salish and Kootenai Tribes, is dropped).

## Next

- A watcher for each (govinfo and congress-gov), listed as planned in `site/watch/watchers/index.ts`.
- Legislative histories before 1973 from the Statutes at Large margin notes and the Serial Set; the Congressional Record's floor debate.
- House and Senate documents (CDOC and the Serial Set's documents series, 4,155 with an Indian term in the title), among them the Commissioner of Indian Affairs' annual reports.
