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
limits: 'Public Law 280: a nation is placed in a state by the Census Bureau''s land areas, or by its office state when no land is recorded (then medium confidence); "not a Public Law 280 state" is inferred from the state''s absence from the Bureau of Indian Affairs'' two lists. Violence Against Women Act: the Justice Department publishes no list of Tribes exercising special Tribal criminal jurisdiction; the fullest list is the Tribal Law and Policy Institute chart (39 Tribes, undated, file modified Aug. 11, 2026), and the only Department documents naming exercising Tribes are the 14 first-round reimbursement awards of May 2024. Planning grants are recorded separately and never as exercising. The Kiowa Tribe (news report of July 20, 2026 describes a grant to implement) and the Mandan, Hidatsa and Arikara Nation (name match to the Three Affiliated Tribes) rest on the chart alone. Indian Health Service: the Service publishes service units for only some Areas; Alaska service areas come from Area profiles of about 2007; the careers brochures are undated (about 2018); no Indian Health Service page names the Lumbee Tribe, so it has no Area. Treaties: the Oklahoma State University database removed its successor-in-interest tags, so every link from a historic signatory to a modern nation was drawn by the research assistant from the treaty and the nation''s name; links where the official name carries the signatory''s name are medium confidence, the rest low; none has been checked against a second source. Kappler page numbers come from the database''s page addresses. State jurisdiction: Arizona''s 1967 session law and its repealing laws were not read (the state archive blocked the request); the Nevada nations absent from the 1975 retrocession notice are recorded at low confidence because no source says why they are absent; that the 1946 Devils Lake act is unrepealed rests on the absence of any enacted repeal through the 119th Congress; whether the Paiute Indian Tribe of Utah voted to accept state jurisdiction was not found.'
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

## Output

Batches in `research/jurisdiction/`; the Violence Against Women Act research is in `research/raw/2026-11-23/violence-against-women-act-jurisdiction.json`.
