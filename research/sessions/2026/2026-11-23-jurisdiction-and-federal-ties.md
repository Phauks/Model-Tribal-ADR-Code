---
id: 2026-11-23-jurisdiction-and-federal-ties
date: '2026-11-23'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: page-fetch
  name: curl (through the session proxy)
- kind: web-search
  name: WebSearch
- kind: other
  name: pdftotext and pdftoppm
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: The lead session filled the Public Law 280 gaps from the statutes and the Bureau of Indian Affairs' list. Research sub-agents gathered the Violence Against Women Act lists, state jurisdiction statutes, Indian Health Service Areas and treaties into raw files; the lead session reviewed each file and built the facts with scripts/jurisdiction/.
purpose: Fill in and extend the Jurisdiction section of nation pages (Trevor asked on Nov. 23, 2026 to start with the fast items from official lists), and add treaties and federal ties.
queries:
- https://www.bia.gov/faqs/what-public-law-280-and-where-does-it-apply
- https://ndlegis.gov/cencode/t27c19.pdf
- https://le.utah.gov/xcode/Title9/Chapter9/C9-9-P2_1800010118000101.pdf
- 'web search: Arizona 1967 Public Law 280 air and water pollution statute; North Dakota Public Law 280 tribal consent; Utah Public Law 280 tribal consent; South Dakota Public Law 280 highways Rosebud Sioux Tribe v. South Dakota; Act of May 31, 1946, 60 Stat. 229 Devils Lake'
- https://www.tribalvawa.org/implementing-tribes and its Special Tribal Criminal Jurisdiction Chart
- https://www.ncai.org/section/vawa/about-vawa-and-stcj/about-stcj
- https://www.justice.gov/ovw/media/1377361/dl?inline=
- https://www.justice.gov/ovw/media/1460186/dl?inline
- https://www.justice.gov/ovw/awards/fy-2025-ovw-grant-awards-program
- https://www.justice.gov/ovw/special-tribal-criminal-jurisdiction-reimbursement-program
- Indian Health Service Area pages, service unit pages, Direct Service Tribes and Self-Governance Tribes lists, Alaska Area profiles (ihs.gov; the server omits its intermediate certificate, so the issuer certificate was added to a private bundle and verification stayed on)
- https://treaties.okstate.edu/treaties/ (listing of all 1,325 records, then each of the 570 treaty and 44 other records at about one request a second)
- Statutes at Large through https://www.govinfo.gov/link/statute/<volume>/<page>; U.S. Code and Supreme Court opinions on law.cornell.edu and tile.loc.gov; state codes on sdlegislature.gov, leg.state.nv.us, leg.mt.gov, legislature.maine.gov, scstatehouse.gov; opinions on static.case.law
sources_added:
- bia-faq-public-law-280
- tribal-law-and-policy-institute-special-tribal-criminal-jurisdiction-chart
- office-on-violence-against-women-2024-update-tribal-consultation-recommendations
- office-on-violence-against-women-fiscal-year-2025-grant-awards-by-program
- american-indian-policy-review-commission-task-force-four-1976
- davis-v-warden-1972
- federal-register-2016-arizona-air-plan-rescissions
- francisco-v-state-1976
- goldberg-2010-tribal-jurisdictional-status-analysis
- in-re-hankins-petition-1964
- kennerly-v-district-court-of-montana-1971
- maine-revised-statutes-title-30-section-6204
- maine-revised-statutes-title-30-section-7208
- montana-legislative-services-division-public-law-280-2024
- nevada-revised-statutes-41-430
- nevada-statutes-1955-chapter-198
- nevada-statutes-1973-chapter-601
- north-dakota-legislative-council-indian-jurisdictional-issues-2004
- public-law-100-228
- public-law-100-89
- public-law-100-95
- public-law-102-171
- public-law-103-116
- public-law-103-377
- public-law-104-208-section-330
- public-law-115-301
- public-law-95-395
- public-law-96-227
- public-law-96-420
- public-law-98-134
- rhode-island-v-narragansett-indian-tribe-1994
- rosebud-sioux-tribe-v-south-dakota-1990
- senate-report-116-130
- south-carolina-code-27-16-40
- south-dakota-codified-laws-1-1-12
- south-dakota-codified-laws-1-1-13
- south-dakota-codified-laws-1-1-18
- south-dakota-codified-laws-1-1-21
- statutes-at-large-54-249
- statutes-at-large-60-229
- statutes-at-large-62-1161
- statutes-at-large-62-1224
- three-affiliated-tribes-v-wold-engineering-1984
- three-affiliated-tribes-v-wold-engineering-1986
- united-states-v-john-1978
- us-code-title-18-section-3243
- us-code-title-25-section-232
- us-code-title-25-section-233
limits: 'Public Law 280: a nation is placed in a state by the Census Bureau''s land areas, or by its office state when no land is recorded (then medium confidence); "not a Public Law 280 state" is inferred from the state''s absence from the Bureau of Indian Affairs'' two lists. Violence Against Women Act: the Justice Department publishes no list of Tribes exercising special Tribal criminal jurisdiction; the fullest list is the Tribal Law and Policy Institute chart (39 Tribes, undated, file modified Aug. 11, 2026), and the only Department documents naming exercising Tribes are the 14 first-round reimbursement awards of May 2024. Planning grants are recorded separately and never as exercising. The Kiowa Tribe (news report of July 20, 2026 describes a grant to implement) and the Mandan, Hidatsa and Arikara Nation (name match to the Three Affiliated Tribes) rest on the chart alone. Indian Health Service: the Service publishes service units for only some Areas; Alaska service areas come from Area profiles of about 2007; the careers brochures are undated (about 2018); no Indian Health Service page names the Lumbee Tribe, so it has no Area. Treaties: the Oklahoma State University database removed its successor-in-interest tags, so every link from a historic signatory to a modern nation was drawn by the research assistant from the treaty and the nation''s name; links where the official name carries the signatory''s name are medium confidence, the rest low. The 703 low links were then checked (see below): the database''s pages still hold their successor lists inside an HTML comment, marked as under review, so a list that names the nation corroborates the link but is not a published source. Kappler page numbers come from the database''s page addresses. State jurisdiction: Arizona''s 1967 session law and its repealing laws were not read (the state archive blocked the request); the Nevada nations absent from the 1975 retrocession notice are recorded at low confidence because no source says why they are absent; that the 1946 Devils Lake act is unrepealed rests on the absence of any enacted repeal through the 119th Congress; whether the Paiute Indian Tribe of Utah voted to accept state jurisdiction was not found.'
sources_updated:
- federal-register-1975-nevada-retrocession
- montana-code-annotated-2-1-301
- texas-band-of-kickapoo-act-1983
---

## What was done

Public Law 280. `scripts/jurisdiction/public_law_280_gaps.py` compared each federally recognized nation's states with the six mandatory states and the ten optional states the Bureau of Indian Affairs lists. It added the mandatory-state fact where a profile had none for a state (the five Minnesota Chippewa Tribe bands split out of the combined record, Fond du Lac in Wisconsin, Ho-Chunk in Minnesota, Oglala in Nebraska, Metlakatla for civil jurisdiction, Bois Forte for civil jurisdiction after the 1975 criminal retrocession). Nations whose state retroceded everything (Menominee, Burns Paiute, Santee Sioux) keep only their retroceded fact. Every state that is on neither list got a `not-a-public-law-280-state` fact for each nation with land there (119 facts for 116 nations; 10 mandatory-state facts were added in all). The six Minnesota Chippewa bands also got their own Indian Child Welfare Act agent facts, from their rows in the 2026 notice.

Violence Against Women Act. `scripts/jurisdiction/build_violence_against_women_act.py` added 8 nations the chart marks as having implemented special Tribal criminal jurisdiction, 14 facts from the Justice Department's first reimbursement awards (which pay only for exercising it), and 10 planning-grant facts for nations not otherwise listed.

Indian Health Service. `scripts/jurisdiction/build_indian_health_service.py` recorded the Area for 580 nations, the service unit or health program for 294 and who runs the nation's health services for 248, one fact per source, from 59 Indian Health Service pages and documents (`research/raw/2026-11-23/indian-health-service-areas.json`).

Treaties. `scripts/jurisdiction/build_treaties.py` linked 150 nations to 370 ratified treaties in Kappler's volume 2 (1,074 links), each citing Kappler at the treaty's first page and linking the database's text (`research/raw/2026-11-23/treaties.json`). Alaska Native villages (no treaties) and California nations (the 1851-52 treaties were never ratified) have a search-log entry saying so.

State jurisdiction. `scripts/jurisdiction/build_state_jurisdiction.py` added 190 facts for 88 nations from the statutes, session laws, Federal Register notices and opinions read for the optional Public Law 280 states and the other federal laws that give a state jurisdiction (`research/raw/2026-11-23/state-jurisdiction.json`). The research notes spoke as "I" and were put in the third person.

The facts were written with `scripts/jurisdiction/apply.py`, which appends to each profile without changing its other lines and records each search in `research/search-logs/jurisdiction/`.

## Treaty link check

The 703 low-confidence treaty links were checked on Nov. 23, 2026. The 195 treaty pages behind them were read from the Oklahoma State University database with curl, two seconds apart. Each page still carries a "Successor in interest (tribes)" list inside an HTML comment that the page no longer displays (26 of them read "Under review"); the lists are saved in `research/raw/2026-11-23/treaty-successor-lists.json`. `scripts/jurisdiction/check_treaty_links.py` compared each link with its list, and the treaty's opening text was read for every link the list does not support:

- 608 links are named in the list (or the list names the nation's constituent bands) and went to medium confidence;
- 4 links are confirmed by the treaty's text: the 1815 and 1825 "Makah" treaties are with the Mahas (Omaha), the 1867 treaty is with the Sacs and Foxes of the Mississippi who became the Sac and Fox Nation, and the 1868 Fort Laramie treaty names the Brulé band of the Rosebud Sioux Tribe;
- 24 links were removed because the text shows the nation's people were not a party: the Potawatomi and Delaware nations on the Wea's 1809 consent treaty, the Miami Tribe of Oklahoma on Wea and Piankashaw treaties (their successor is the Peoria Tribe), the Eastern Shawnee on the Sandusky Seneca treaty of 1831, the Ottawa Tribe of Oklahoma on the 1826 Fond du Lac and 1846 Potawatomi treaties, the Southern Ute and Ute Mountain Ute on the 1863 Tabeguache treaty, and the Sac and Fox Nation and Iowa community on the 1815 treaty with the Missouri River Sac;
- 67 links stay low because no second source names the nation; most are band-level relations the lists leave out (Dakota bands in Minnesota, Yanktonai at Fort Peck and Crow Creek, the Eastern Band of Cherokee and Poarch Creek where the list reads "Under review").

Every link stays `verification: inferred`, and its note says what the check found. The report is `research/raw/2026-11-23/treaty-link-check.json`.

## How the land was set aside

`scripts/jurisdiction/build_land_establishment.py` recorded 127 instruments for 110 nations (`research/raw/2026-11-23/land-establishment.json`): 58 executive orders, 38 treaties, 24 acts of Congress, 2 agreements ratified by Congress and 5 others (letters and proclamations of officials). Executive orders are cited as Kappler prints them in volumes 1, 3 and 4 (Internet Archive full-text scans; the Oklahoma State University database's copy where it has one), and treaties and acts are cited to the Statutes at Large on govinfo. Each fact quotes the words that set the land aside and is marked "First set aside" or "Later change". Every quotation was checked against the source text.

Coverage is about a third of the nations with a land area. Not covered: reservations proclaimed by the Secretary of the Interior after 1934 (25 U.S.C. § 5110), because the Federal Register search starts in 1994 and the 1936-1950 volumes have no full-text search (most California rancherias, Nevada colonies, and Oklahoma, New York, New England and Southeast lands); Metlakatla; and 20 cases the research left out as doubtful (each has a search-log entry with the candidate instrument and the reason), among them the San Bernardino County Mission reserves, La Jolla ("La Joya" in Kappler), Barona and Viejas, San Pasqual, Summit Lake, Fort Mojave, the Seminole Tribe of Florida and the Minnesota Chippewa reservations. Kappler page numbers come from the scans' OCR; the Grande Ronde order's date (June 30, 1857) was read from the earlier print because the 1904 OCR reads 1867. One database address first recorded for the Spokane order of 1881 returned "not found", so that source links the Kappler scan.

## Jurisdiction agreements

`scripts/jurisdiction/build_agreements.py` recorded 202 agreements for 114 nations in the new `jurisdiction_agreements` list (`research/raw/2026-11-23/jurisdiction-agreements.json`): 136 child welfare agreements, 46 tax agreements, 19 cross-deputization and law enforcement agreements and one motor vehicle tag compact. About 100 pages were read, with curl, three seconds apart.

Child welfare agreements come from the Association on American Indian Affairs' 2014 survey of Title IV-E tribal-state agreements and the National Indian Law Library's 2013 list of example agreements; both are old, so their facts are medium confidence and most have an unknown status. Most Oklahoma agreements in the survey lapsed on June 30, 2013, and some were renewed, so those are left unknown rather than expired. Tax agreements come from the current lists of the South Dakota, Michigan, Minnesota, Montana and Nebraska revenue departments and the Oklahoma Governor's January 2024 release on the Chickasaw and Apache compacts. Cross-deputization agreements are copies in the Justice Department's Community Oriented Policing Services sample library; many are unsigned or undated, and none says whether it is still in force.

Washington's cigarette tax statutes (RCW 43.06.460, .465 and .466) and New Mexico's list of nations eligible for tax-sharing agreements authorize agreements without saying which nations signed, so the nations they name got a search-log lead instead of a fact. Not covered: the Administration for Children and Families list of Title IV-E plans (behind a bot check), the Oklahoma Secretary of State's compact list (built by script), the Oklahoma Tax Commission and Washington Department of Revenue pages (not found), Wisconsin's county-tribal law enforcement reports (connection dropped), Nevada, Idaho, Utah, Colorado, Kansas and North Dakota tax agreements, the state cross-deputization statutes, and the Alaska agreements made through regional nonprofit corporations.

## Court cases

The nation page now lists the court cases in the project's sources whose source record names the nation in `tribes`, oldest first, with the reporter citation and year. No profile data was added for this; the list is read from the case source records.

## Nearby state courts

`scripts/jurisdiction/build_nearby_state_courts.py` recorded 896 state trial courts for 551 federally recognized nations in the new `nearby_state_courts` list (`research/jurisdiction/nearby-state-courts.json`). It takes the counties each nation's 2020 Census area lies in from the Census Bureau's area-to-county relationship file (source `census-2020-tribal-area-to-county-relationship-file`), keeps a county when it holds at least 1 percent of the area's land, and names the state's trial court of general jurisdiction for that county from `research/jurisdiction/state-trial-courts.tsv`, which gives the court and the judiciary page that lists those courts for each of the 36 states. Each fact cites that state page; its note gives the county's share of the land and names the Census file.

The facts are medium confidence: the court for a county is inferred from the state's court structure, not read from a list that names the county, and in several states one district court sits for several counties. Seven state pages (Kansas, Utah, Minnesota, Nevada, Oklahoma, New Mexico and New York) were behind a bot check, so their address and title come from a search listing and their facts are marked title-only. Nations with no Census area, and Alaska Native villages whose statistical area was not matched to a profile, have no entry.

## Using the courts

`scripts/jurisdiction/build_court_practice.py` recorded 163 pages and documents for 58 nations in the new `court_practice` list (`research/raw/2026-11-23/court-practice.json`): 38 form lists, 37 admission-to-practice pages, 35 court rules, 29 fee schedules, 16 public defender pages and 8 legal aid pages. A Sonnet agent read the court sites of the first 109 nations in the court list, about 135 page fetches, following up to three pages per court; the remaining nations were not reached and have no search log for this topic yet. A page that already had a source record is cited under that record's key.

Thirty-two courts gave nothing: the Navajo court site is a frame shell whose frames did not load, and the Blackfeet, Sac and Fox, Puyallup, Red Lake, Shoshone-Bannock, Southern Ute, Confederated Salish and Kootenai, Kenaitze, Agua Caliente, Orutsararmiut, Poarch Creek and Wyandotte sites were blocked or dead. Each is in the court-practice search log. Legal aid is thin: no Legal Services Corporation list ties its Native American grantees to nations, so the legal aid facts come only from nations' own pages. Many facts are links seen in a court's menu or document list whose target was not opened; those are marked title-only. The Wind River Tribal Court serves both the Eastern Shoshone and Northern Arapaho, so its facts are on both profiles.

## Output

Batches in `research/jurisdiction/`; the Violence Against Women Act research is in `research/raw/2026-11-23/violence-against-women-act-jurisdiction.json`.
