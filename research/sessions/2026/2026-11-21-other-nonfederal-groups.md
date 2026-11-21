---
id: 2026-11-21-other-nonfederal-groups
date: '2026-11-21'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: page-fetch
  name: page fetch (web-fetch tool)
- kind: web-search
  name: web search
- kind: page-fetch
  name: curl
- kind: other
  name: pdftotext
- kind: other
  name: python3 -I (DBF and JSON parsing)
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: A research sub-agent searched, opened sources and returned cited facts in the raw file; the
    lead session reviewed the output and built the records.
purpose: 'Identify groups that federal sources name but that are neither federally recognized nor already
  in the state-recognition or petition records: the GAO funding report, Census tribal statistical areas
  and state reservations, termination statutes and federal award lists.'
queries:
- https://www.gao.gov/products/gao-12-348 (web fetch)
- https://www.gao.gov/assets/600/590726.txt (web fetch, offsets 0, 85000, 90000, 100000)
- https://www.gao.gov/assets/gao-12-348.pdf (curl 403; web fetch, truncated at Appendix III)
- Wayback copies of the GAO report (connection reset by the proxy)
- 'web search: "Received Federal Funding before Fiscal Year 2007" GAO-12-348 table 8'
- 'web search: "Federal Funding for Non-Federally Recognized Tribes" accessible text GAO-12-348 html'
- https://legistorm.com/reports/view/gao/42045/Federal_Funding_for_Non_Federally_Recognized_Tribes.html
  (summary only)
- https://www2.census.gov/geo/docs/reference/codes2020/national_aiannh2020.txt
- https://www2.census.gov/geo/docs/reference/codes2020/national_aiannh_by_state2020.txt
- https://www2.census.gov/geo/tiger/TIGER2020/AIANNH/tl_2020_us_aiannh.zip (DBF attributes only)
- https://census.gov/programs-surveys/geography/about/glossary/aian-definitions.html
- 'web search: census.gov 2020 State Designated Tribal Statistical Area SDTSA list tribe'
- https://api.census.gov/data/2020/dec/ddhca/variables/POPGROUP.json
- https://api.census.gov/data/2020/dec/ddhca?get=...&POPGROUP=... (redirects to missing_key; no population
  values)
- https://www.govinfo.gov/content/pkg/STATUTE-72/pdf/STATUTE-72-Pg619.pdf
- https://www.govinfo.gov/content/pkg/STATUTE-78/pdf/STATUTE-78-Pg390.pdf
- https://www.law.cornell.edu/uscode/text/25/677a (Ute Partition Act definitions; omitted section)
- 'web search: HUD Indian Housing Block Grant FY 2025 final allocations formula'
- https://www.hud.gov/sites/default/files/PIH/documents/FY26-IHBG-Formula-Allocations-Congressional-Notification.pdf
- https://www.hud.gov/sites/default/files/PIH/documents/FY-2025IHBG-Formula-Allocation-Press-Release-Awards-List.pdf
- https://www.hud.gov/sites/dfiles/PIH/documents/FY_25_Grant_Summary.pdf
- https://dol.gov/sites/dolgov/files/ETA/advisories/TEGL/2023/TEGL%2016-23/Attachment%20I%20%28Accessible%20PDF%29.pdf
  (WIOA Section 166 PY2024 grantees)
- https://acf.gov/ana/current-recipients (page lists only program areas; the awards-list PDF link was
  not exposed)
- 'https://acf.gov/ana/grants-funding/awardees and https://acf.gov/sites/default/files/documents/ocs/Table_Allocations_Tribes_2025.05.01.pdf
  (blocked: client error / 202 empty)'
- https://api.usaspending.gov/api/v2/search/spending_by_award/ (Assistance Listings 93.612, 93.587, 93.581;
  FY2023-FY2026 action dates; 362 award rows)
- https://api.usaspending.gov/api/v2/awards/<id>/ for 7 awards
sources_added:
- bia-recognized-entities-2026
- census-2020-ddhca-popgroup-codes
- census-aian-geography-definitions
- census-aiannh-codes-by-state-2020
- census-tiger-2020-aiannh
- gao-12-348-federal-funding-non-federally-recognized-tribes
- hud-ihbg-fy2026-formula-allocations
- public-law-85-671-california-rancheria-act
- public-law-88-419-california-rancheria-act-amendment
- usaspending-award-90na8343
- usaspending-award-90na8457
- usaspending-award-90na8504
- usaspending-award-90na8516
- usaspending-award-90nk0197
- usaspending-award-90xn0025
- usaspending-award-90xn0159
limits: 'GAO-12-348: Tables 1, 3, 4, 6 and the body text were read through the web-fetch tool. Appendix
  IV Table 8 (groups funded before FY2007) and Appendix V could not be read: gao.gov returns 403 to curl,
  Wayback was unreachable, and the fetched text stopped partway through Appendix III. Table 7 (state-recognized
  tribes as of Sept. 2011) was not transcribed because another helper covers state recognition. GAO names
  a single program for only some groups; per-tribe program lists are not in the report. Census: the area-to-group
  link is by name comparison (Census publishes only area names), so census-area facts are medium or low
  confidence. Areas not linked to a group because the name fits more than one group: 9525 Beaver Creek
  SDTSA (SC), 9844 Pee Dee SDTSA (SC), 9775 Isle de Jean Charles SDTSA (LA). The Census DDHC-A population
  API needs a key, so no population counts were taken. ACF/ANA and OCS pages (acf.gov) blocked automated
  access, so ANA awards come from USAspending records (FY2023-FY2026 search window, plus earlier awards
  still showing in that window); the USAspending award records give the recipient name and project but
  not recognition status. Indian Health Service and Department of Education Title VI eligibility lists
  that name groups were not found as bulk lists and were not covered. The DOL WIOA Section 166 PY2024
  grantee list was checked; its non-federal grantees are intertribal or urban organizations and a consortium,
  not named groups, so nothing was recorded from it. Termination: only the California Rancheria Act lists
  were compared with the 2026 list; other termination statutes were reviewed only at the category level
  (see narrative).'
---

## What was done

Inclusion rule: a group is included only when a federal government source opened here names it (GAO report table or text, Census geography file, federal statute, HUD allocation list, or a USAspending federal award record), and it is not on the 2026 federal list (roster.json). Groups known only from their own websites or press were not considered. Recognition facts use type unrecognized meaning 'not federally recognized'; each note says what the source states (for example GAO's reported state-recognition status) and makes no judgment about the group. Each source gives its own recognition and state-presence fact. Ids: where a group's name matches an entity already defined by the state-recognized helper (identical, or differing only by 'of North Carolina', 'the', 'Inc.', or the Muskogee/Muscogee spelling), that id is reused so records merge, and the note gives the name exactly as each source writes it. Otherwise the id is a slug of the name as the source writes it, with a 'possible match' note where another helper likely holds the same group under a different name (Nanticoke Indian Association / Nanticoke Indian Tribe of Delaware; Nanticoke Lenni-Lenape Indians of New Jersey / Nanticoke Lenni-Lenape Tribal Nation; St. Francis/Sokoki Band of Abenakis of Vermont Abenaki Tribal Council / Missisquoi, St. Francis-Sokoki Band). Groups that probably also appear in the petitioning helper's output, by name: American Indian Council of Mariposa County (Southern Sierra Miwuk Nation), Burt Lake Band, Duwamish, Euchee/Yuchi, Eel River Tribe of Indiana, Juaneno Band of Mission Indians, Muscogee Nation of Florida, Qutekcak Native Tribe, Saponi Nation of Missouri Mahenips Band, St. Francis/Sokoki Band, Tuscarora Nation of Indians of the Carolinas, Wesget Sipu. Sources worked: (1) GAO-12-348 Table 1 (26 groups with direct federal funding FY2007-2010) and body text: 23 groups recorded plus Four Winds Cherokee (named in the text as a consortium member). Lumbee Tribe of North Carolina, Mashpee Wampanoag Tribe and Shinnecock Indian Nation appear in Table 1 but are on the 2026 federal list, so no recognition facts were written for them. GAO Table 6: nine California rancherias or reservations terminated and not restored, recorded with the 1958 Act (Pub. L. 85-671) and the 1964 amendment (Pub. L. 88-419) as legal basis. All 41 rancherias named in the 1958 Act were checked against the 2026 list; by name, eleven are not found: the seven in GAO Table 6, plus Montgomery Creek (named inside the Pit River Tribe entry on the 2026 list) and Smith River, Table Bluff and North Fork, which GAO Table 5 lists as restored (Smith River Rancheria; Wiyot Tribe, formerly the Table Bluff Reservation; Northfork Rancheria of Mono Indians). This agrees with GAO. (2) Census 2020 TIGER AIANNH: 35 State Designated Tribal Statistical Areas and 10 state American Indian reservations. 42 were linked to a group by name (3 of them to nations on the 2026 list: Lumbee SDTSA, Pamunkey and Shinnecock state reservations, census-area facts only). Three were left unlinked because they fit more than one group. Tama (state) Reservation, Georgia, was linked to the Lower Muscogee Creek Tribe at low confidence by combining GAO's note and the Census DDHC-A name 'Lower Muscogee Creek Tama Tribal Town'. (3) Termination: other termination acts were reviewed by category. Western Oregon tribes and bands named in the 1954 Western Oregon termination act were excluded because GAO reports Interior's view that many were historic tribes no longer organized at termination, and their descendants are largely citizens of restored confederated nations. Classes of individuals terminated within nations that are still recognized (for example the mixed-blood provisions of the 1954 Ute Partition Act) were excluded because the statute treats them as individuals, not as a separate nation. Nations that were terminated and later restored are on the 2026 list and were skipped. (4) HUD FY2026 IHBG formula allocations: four recipients not on the federal list (MOWA, Coharie, Haliwa-Saponi, Waccamaw Siouan). HHS/ANA awards from USAspending: seven recipients not on the federal list. Other ANA recipients not on the list were intertribal, urban, Native Hawaiian, territorial, educational or nonprofit organizations, not named groups, and were excluded. One recipient, The Munsee Tribe in Kansas, Inc., is documented only by its federal award record; it is recorded at low confidence with the record's own classification. (5) The Census 2020 DDHC-A code list was used only for low-confidence alternate names of groups already documented by another source. No contacts were recorded: none of the sources is an official contact list for these groups.

## Output

`research/raw/2026-11-21/other-nonfederal-groups.json`: 235 facts about 69 nations or communities from 16 sources. What the build kept and dropped is in `research/raw/2026-11-21/build-report.json`.

## Review by the lead session

- Two groups the assistant marked as possible matches were merged into existing records after comparing names and states (see `entity-merges.json`): Nanticoke Lenni-Lenape Indians of New Jersey into the Nanticoke Lenni-Lenape Tribal Nation, and the St. Francis/Sokoki Band of Abenakis of Vermont Abenaki Tribal Council into the St. Francis/Sokoki Band of Abenakis of Vermont. The other names are kept as alternate names.
- The Nanticoke Indian Association (named by GAO) was not merged with the Nanticoke Indian Tribe of Delaware, because no source read states that the two are the same group. That match is left for review.
- In the imported raw file, the id `saponi-nation-of-missouri-mahenips-band` was replaced by the existing `saponi-nation-of-missouri`, so the record keeps the id it already had.
- Recognition type `unrecognized` here means only that the group is not federally recognized. It says nothing about whether a state recognizes the group.
