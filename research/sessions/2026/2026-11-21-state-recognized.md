---
id: 2026-11-21-state-recognized
date: '2026-11-21'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: web-search
  name: web search
- kind: page-fetch
  name: page fetch (WebFetch)
- kind: page-fetch
  name: curl
- kind: other
  name: pdftotext
- kind: other
  name: python3 -I text extraction
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: A research sub-agent searched, opened sources and returned cited facts in the raw file; the
    lead session reviewed the output and built the records.
purpose: Identify Native nations recognized by U.S. states, citing each state's own legal source for recognition.
queries:
- 'https://www.ncsl.org/quad-caucus/state-recognition-of-american-indian-tribes (page fetch: no list on
  page)'
- https://www.ncsl.org/quad-caucus/list-of-federal-and-state-recognized-tribes (curl 403; page fetch client
  error)
- 'https://web.archive.org/web/2025/https://www.ncsl.org/quad-caucus/list-of-federal-and-state-recognized-tribes
  (curl connection reset; page fetch: site blocked)'
- https://web.archive.org/cdx/search/cdx?url=ncsl.org/quad-caucus/list-of-federal-and-state-recognized-tribes
  (connection reset)
- 'web search: NCSL "State Recognition of American Indian Tribes"'
- https://legislature.maine.gov/doc/5373 (NCSL LegisBrief, October 2016)
- https://aiac.alabama.gov/wp-json/wp/v2/pages (Alabama Indian Affairs Commission page index)
- 'web search: Code of Alabama 41-9-708 Indian Affairs Commission membership tribes'
- 'web search: Alabama 2026 SB250 OR HB222 Indian Affairs Commission'
- 'web search: Connecticut General Statutes 47-59a Schaghticoke Paugussett Eastern Pequot'
- https://www.cga.ct.gov/current/pub/chap_824.htm (curl certificate error; page fetch robots error)
- https://portal.ct.gov/deep/environmental-justice/tribal-affairs
- https://www.ncleg.gov/EnactedLegislation/Statutes/HTML/ByChapter/Chapter_71A.html
- https://www.doa.nc.gov/divisions/american-indian-affairs/tribes
- https://www.commonwealth.virginia.gov/virginia-indians/state-recognized-tribes/
- https://rga.lis.virginia.gov/Published/2025/RD1034/PDF
- 'web search: Virginia 2010 House Joint Resolution recognition Cheroenhaka Nottoway Patawomeck'
- https://gov.louisiana.gov/federal-and-state-recognized-tribes
- https://www.legis.la.gov/legis/LawPrint.aspx?d=1108531 (R.S. 46:2305)
- 'web search: Louisiana concurrent resolution state recognition United Houma Nation Pointe-au-Chien Natchitoches'
- https://www.legis.la.gov/Legis/BillInfo.aspx (HCR14 2021, SCR54 2022, HCR13 2024, HCR15 2017, HR227
  2017)
- https://scdah.sc.gov/historic-preservation/resources/native-american-heritage/federal-and-state-recognized-native
- https://advance.sc.gov/community-resources/native-american-affairs/sc-recognized-tribes
- https://dsd.maryland.gov/executiveorders/Pages/01.01.2012.01.aspx, 01.01.2012.02, 01.01.2017.31 (01.01.2017.30
  and .32 return 404)
- https://2025mdmanual.msa.maryland.gov/msa/mdmanual/01glance/native/html/00list.html
- https://delcode.delaware.gov/title29/c001/index.html
- 'web search: O.C.G.A. 44-12-300 Georgia recognized tribes'
- https://www.mass.gov/executive-orders/no-126-massachusetts-native-americans; no-637-recognizing-the-herring-pond-wampanoag-tribe
- https://nj.gov/www.nj.gov/state/dos-statutes-american-indian-affairs.shtml; https://www.nj.gov/oag/newsreleases19/pr20190318b.html
- https://www.nysenate.gov/legislation/laws/IND
- 'web search: New York Montaukett recognition veto'
- https://legislature.vermont.gov/statutes/fullchapter/01/023; /statutes/section/01/023/00853a
- https://capitol.texas.gov/tlodocs/81R/billtext/html/SR00438F.htm; HR00812F.htm; 86R SC00061E.htm; HC00171F.htm
- https://www.michigan.gov/documents/mdcr/IndianDirectoryUpdated1-30-17_550084_7.pdf (curl 403; read via
  page fetch)
- https://www.capitol.hawaii.gov/hrscurrent/.../HRS_0010H-0001.htm (blocked 403)
sources_added:
- alabama-administrative-code-475-x-1-2026
- alabama-code-41-9-708
- alabama-indian-affairs-commission-state-recognized-tribes-compilation
- alabama-indian-affairs-commission-tribes-list-2026
- connecticut-deep-tribal-affairs
- connecticut-general-statutes-47-59a
- connecticut-olr-report-2026-r-0029
- delaware-code-title-29-chapter-1
- georgia-code-44-12-300
- georgia-house-bill-43-2024
- louisiana-governor-federally-and-state-recognized-tribes
- louisiana-governor-indian-affairs
- louisiana-house-concurrent-resolution-137-four-winds
- louisiana-house-resolution-227-2017
- louisiana-revised-statutes-46-2305
- louisiana-senate-concurrent-resolution-105-2004
- maryland-executive-order-01-01-2012-01
- maryland-executive-order-01-01-2012-02
- maryland-executive-order-01-01-2017-31
- maryland-manual-indigenous-peoples-2025
- massachusetts-executive-order-126
- massachusetts-executive-order-637
- michigan-civil-rights-indian-directory-2016
- new-jersey-attorney-general-2019-03-18
- new-jersey-commission-american-indian-affairs-about
- new-jersey-powhatan-settlement-agreement
- new-jersey-ramapough-settlement-agreement
- new-jersey-statutes-52-16a-53
- new-york-indian-law
- north-carolina-general-statutes-chapter-71a
- north-carolina-tribal-communities-2026
- south-carolina-recognized-tribes-advance-sc
- texas-house-concurrent-resolution-171-2019
- texas-senate-resolution-438-2009
- vermont-statutes-1-853a
- vermont-statutes-title-1-chapter-23
- virginia-house-joint-resolution-150-2010
- virginia-legislative-index-2010-indians
- virginia-mattaponi-tribe-history
- virginia-report-status-of-indian-tribes-2025
- virginia-secretary-of-the-commonwealth-state-recognized-tribes
- virginia-senate-joint-resolution-12-2010
- virginiaplaces-state-recognition
limits: 'NCSL: the current NCSL list could not be read (ncsl.org 403 to curl, client error to the page
  fetch tool; Wayback Machine connection resets and blocked). Only the 2016 NCSL LegisBrief (copy on legislature.maine.gov)
  was read, so no NCSL medium-confidence facts were recorded; every recognition fact cites the state''s
  own law, order, resolution or agency list instead. List versus law disagreements: (1) Alabama: Code
  Section 41-9-708 still names only seven tribes (including Poarch Band) under older names (Star Clan
  of Muscogee Creeks; Cherokees of southeast Alabama); the commission''s 2026 list and Rule 475-X-1-.02
  (effective 2026-09-14) add Piqua Shawnee Tribe and United Cherokee Ani-Yun-Wiya Nation, recognized by
  the commission. 2026 bills to put nine tribes in the statute (Senate Bill 250, House Bill 222) did not
  pass as far as found. The commission page says ''nine state recognized tribes and one that is also Federally
  Recognized'' but its list shows eight plus Poarch. (2) Louisiana: R.S. 46:2305 gives commission seats
  but does not itself confer recognition; recognition was by resolutions. For Bayou Lafourche, Grand Caillou/Dulac,
  Isle de Jean Charles (now Jean Charles Choctaw Nation) and Pointe-au-Chien, the enrolled 2004 Senate
  Concurrent Resolution No. 105 only ''reacknowledges the Indian ancestry'' of members for education and
  health benefits (the introduced text said ''formally recognizes''); a 2022 reaffirmation resolution
  died in committee. Natchitoches Tribe was recognized only by a single-chamber House Resolution No. 227
  (2017); the concurrent resolution died in the Senate. Resolutions for the Butte Tribe of Bayou Bourbeaux
  (2021, House Concurrent Resolution No. 14, not finally passed) and the Talimali Band of the Apalachee
  Indians of Louisiana (2024, House Concurrent Resolution No. 13, withdrawn) did not pass, and neither
  is on the Governor''s list; no entities created for them. Resolution numbers for Adai Caddo, Choctaw-Apache,
  Clifton Choctaw, Louisiana Band of Choctaw and United Houma Nation were not retrieved. (3) Connecticut:
  Section 47-59a(b) names ''the Paucatuck Eastern Pequot''; the state agency now uses Eastern Pequot Tribal
  Nation (merged 2002). The Schaghticoke have two factions (Schaghticoke Tribal Nation, Schaghticoke Indian
  Tribe); one entity ''Schaghticoke Tribe'' was created as the state agency does. Official cga.ct.gov
  statute text could not be fetched; Justia 2020 copy used. (4) New Jersey: the state denied recognition
  for some years before settling (Nanticoke Lenni-Lenape November 2018; Powhatan Renape and Ramapough
  Lenape 2019); the 1980/1982 resolution numbers were not retrieved, and the 2018 Nanticoke settlement
  itself was not opened. Older lists also name the Sand Hill Band of Indians and ''Ancient Boii Tribe-Clovis''
  for New Jersey; no New Jersey authority supports these, so they were left out. (5) Texas and Michigan:
  no formal state-recognition process. Texas resolutions ''recognize the Lipan Apache Tribe of Texas and
  commend it'' (2009, 2019); NCSL calls such resolutions honorary. Michigan''s four ''State Historic Tribes''
  come only from a 2016-2017 Department of Civil Rights directory; current Michigan pages list only federally
  recognized nations. Both recorded with medium or low confidence. (6) Massachusetts: recognition is by
  executive order (Executive Order 126 of 1976 and Executive Order 637 of 2024), not statute. An older
  compilation lists Chappaquiddick Wampanoag, Chaubunagungamaug Nipmuck, Pocasset Wampanoag and Seaconke
  Wampanoag; no Massachusetts order naming them was found, so they were left out. (7) Maryland: commission
  covers seven tribes (including Assateague Peoples Tribe, Nause-Waiwash Band, Pocomoke Indian Nation,
  Youghiogheny River Band of Shawnee Indians), but only the Piscataway Conoy Tribe, Piscataway Indian
  Nation and Accohannock Tribe have recognition executive orders; Cedarville Band of Piscataway Indians
  is part of the Piscataway Conoy Tribe per secondary accounts and was not created separately. (8) South
  Carolina: three categories (Tribe, Group, Special Interest Organization). The 10 Tribes and 3 Groups
  are included (Groups noted as such); Special Interest Organizations (for example Pine Hill Indian Community
  Development Initiative, American Indian Chamber of Commerce of South Carolina, Little Horse Creek American
  Indian Association) are not nations and were excluded. Recognition dates were not found. (9) New York:
  only the Unkechauge (Poospatuck) Indian Nation is state-only; Indian Law also has articles on Onondaga,
  Seneca, Tonawanda, Tuscarora and Saint Regis nations, but only Shinnecock got a state fact (medium).
  Montaukett recognition bills were vetoed again in 2023 and 2025; not recognized. (10) Virginia: resolution
  numbers for the 1983 (House Joint Resolution 54), 1984 and 1989 recognitions of the now-federal nations
  are from secondary or summary sources (medium); Wolf Creek Cherokee Tribe bill (House Joint Resolution
  453, 2025) died in committee. Not covered or no entity: Ohio (no state recognition; older lists name
  the United Remnant Band of the Shawnee Nation), Tennessee (2010 commission recognitions were voided),
  Kentucky (honorary resolutions only), California (no recognition process; Native American Heritage Commission
  keeps a consultation list of non-federally recognized tribes, and a 1994 resolution about the Gabrielino/Tongva
  was not checked), Montana (Little Shell is now federal; state has no recognition statute). Hawaii: Native
  Hawaiians are not a tribe; Hawaii Revised Statutes Chapter 10H (Act 195, 2011) recognizes Native Hawaiians
  as the indigenous people of Hawaii, but the statute site blocked access, so no fact was recorded; this
  belongs with the Native Hawaiian research. Contacts: only addresses, phones and emails a state agency
  lists for the tribe as an organization were kept; chiefs'' named emails and phones were skipped, and
  street addresses printed beside a leader''s name were kept only as medium confidence (Alabama, Louisiana)
  or skipped (Alabama residential-looking addresses, South Carolina street addresses and phones). Nations''
  own websites were not opened, so websites are as the state lists give them. Population was recorded
  only where the North Carolina Commission or a Massachusetts order states it.'
---

## What was done

Started with NCSL, which was unreachable; used the 2016 NCSL brief only for orientation. Then went state by state to the state's own authority: statutes (Alabama 41-9-708, Connecticut 47-59a, Delaware 29 Del. C. 106-107, Georgia 44-12-300, Louisiana R.S. 46:2305, New Jersey 52:16A-53, New York Indian Law Article 10, North Carolina Chapter 71A, Vermont 1 V.S.A. 853a-856), administrative rules (Alabama 475-X-1-.02, South Carolina Chapter 139), executive orders (Maryland, Massachusetts), legislative resolutions (Virginia, Louisiana, Texas) and current state agency lists (Alabama Indian Affairs Commission, North Carolina Commission of Indian Affairs, Virginia Secretary of the Commonwealth, Louisiana Governor's Office of Indian Affairs, South Carolina Advance SC, Connecticut Department of Energy and Environmental Protection). Created 68 entities for state-recognized nations not on the federal roster, and added state recognition facts to 15 federally recognized roster nations that a state also recognizes (Poarch Band, Lumbee, Catawba in North Carolina, seven Virginia nations, Mashantucket Pequot, Mohegan, Mashpee Wampanoag, Wampanoag Tribe of Gay Head, Shinnecock). Where a statute and a current list disagree, both facts are recorded with notes. Entity names follow the recognizing statute or the state's current list, with other forms as alternate or former names.

## Output

`research/raw/2026-11-21/state-recognized.json`: 378 facts about 83 nations or communities from 47 sources. What the build kept and dropped is in `research/raw/2026-11-21/build-report.json`.
