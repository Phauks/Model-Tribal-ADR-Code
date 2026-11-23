---
id: 2026-11-23-official-representatives
date: '2026-11-23'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: web-search
  name: web search
- kind: page-fetch
  name: curl
- kind: other
  name: pdftotext
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: Read each list and recorded the office titles by hand in research/representatives/state-listings.json; scripts/representatives/apply.py wrote the profiles and search logs.
purpose: Find the official lists that name each Native nation's leader (the Bureau of Indian Affairs Tribal Leaders Directory and state Indian affairs commission lists), and record the office each names, never the person.
queries:
- https://www.bia.gov/service/tribal-leaders-directory
- https://biamaps.geoplatform.gov/Tribal-Leaders-Directory (the directory map; checked for a link to a single nation's entry)
- https://services1.arcgis.com/UxqqIfhng71wUT9x/arcgis/rest/services/TribalLeadership_Directory/FeatureServer/0 (fields tribefullname and jobtitle only)
- https://aiac.alabama.gov/wp-content/uploads/2026/10/AIAC-Tribes-List.pdf
- https://aiac.alabama.gov/wp-content/uploads/2026/06/2026-REVISED-Chief-List-6-11-2026.pdf
- https://gov.louisiana.gov/federal-and-state-recognized-tribes
- https://www.doa.nc.gov/divisions/american-indian-affairs/tribes
- https://advance.sc.gov/community-resources/native-american-affairs/sc-recognized-tribes
- https://www.commonwealth.virginia.gov/virginia-indians/state-recognized-tribes/
- https://portal.ct.gov/deep/environmental-justice/tribal-affairs
- https://georgiaindiancouncil.com/georgia_tribes
- https://msa.maryland.gov/msa/mdmanual/01glance/native/html/00list.html
- https://governor.maryland.gov/community-initiatives/ethnic-commissions/indian-affairs
- https://www.nj.gov/state/njcaia-members.shtml
- https://www.mass.gov/info-details/indian-affairs (HTTP 403)
- https://vcnaa.vermont.gov/ and https://vcnaa.vermont.gov/node/84 (HTTP 403)
- 'web search: Indian affairs commission tribal leaders directory, for Alabama, Massachusetts, Maryland, New Jersey, Georgia, Vermont, Oklahoma, Minnesota, Washington, Arizona, New Mexico, Montana, Wisconsin, North Dakota, South Dakota, Nebraska, Nevada, Utah, Oregon, California, Idaho, Michigan, Colorado, Maine and Virginia'
limits: 'The federal directory has no page for one nation, so each listing links to the directory page and gives the name to look up. Its titles were checked against the live service on Nov. 23, 2026 and matched those recorded on Nov. 20 (research/governance/directory-titles.json). State lists were read once, by hand. Massachusetts and Vermont refused the page fetch; a person can read them in a browser. Lists of leaders that states keep for federally recognized nations (table below) were found but not used yet. Delaware, Michigan, New York and Texas have no list that names Tribes'' leaders.'
---

## What was done

Trevor Goldsmith asked whether Native nations have "verified representatives" and, if so, to use the federal list and the state commissions' lists. Each nation decides who speaks for it; governments keep lists of who holds each nation's leading office. This session read those lists and recorded only the office (decision record [0050](../../../docs/decisions/0050-show-the-offices-official-lists-name-as-representatives.md)).

- Federal: the Tribal Leaders Directory of the Bureau of Indian Affairs, for 572 federally recognized nations with a title (7 rows give none). The office titles had already been read for governance facts (decision record 0042); this session re-queried the service (title fields only) and found no change.
- States: the lists of Alabama, Louisiana, North Carolina, South Carolina and Virginia name each Tribe's leader, so their offices were recorded for 56 nations, federally recognized ones included where the state lists them. Louisiana's list names a person but no title for the Clifton Choctaw Tribe, so no office was recorded for it.
- Every profile has a search log under `research/search-logs/representatives/`.

## State lists

What each state publishes, as found on Nov. 23, 2026. "Leaders named" means the list gives each Tribe's leader with a title.

### States that recognize Tribes

| State | Body and list | Leaders named | Used |
| --- | --- | --- | --- |
| Alabama | Alabama Indian Affairs Commission, [Tribes Recognized by the State of Alabama](https://aiac.alabama.gov/wp-content/uploads/2026/10/AIAC-Tribes-List.pdf) (Oct. 2026); also a [chief list of June 2026](https://aiac.alabama.gov/wp-content/uploads/2026/06/2026-REVISED-Chief-List-6-11-2026.pdf) | Yes | Yes |
| Connecticut | Department of Energy and Environmental Protection, [Tribal Affairs](https://portal.ct.gov/deep/environmental-justice/tribal-affairs) | No | No |
| Delaware | No commission list found; recognition rests on the Delaware Code | No | No |
| Georgia | Georgia Council on American Indian Concerns, [Georgia tribes](https://georgiaindiancouncil.com/georgia_tribes) | No | No |
| Louisiana | Governor's Office of Indian Affairs, [Federally and State-Recognized Tribes](https://gov.louisiana.gov/federal-and-state-recognized-tribes) | Yes | Yes |
| Maryland | Maryland Commission on Indian Affairs ([Governor's page](https://governor.maryland.gov/community-initiatives/ethnic-commissions/indian-affairs)); [Maryland Manual](https://msa.maryland.gov/msa/mdmanual/01glance/native/html/00list.html) lists the Tribes | No | No |
| Massachusetts | Massachusetts Commission on Indian Affairs ([page](https://www.mass.gov/info-details/indian-affairs)) | Not read (403) | No |
| Michigan | No state recognition process; Department of Civil Rights [Indian directory of 2017](https://www.michigan.gov/documents/mdcr/IndianDirectoryUpdated1-30-17_550084_7.pdf) is the only list | Not current | No |
| New Jersey | Commission on American Indian Affairs, [members](https://www.nj.gov/state/njcaia-members.shtml) | No (Commission members only) | No |
| New York | No commission list found | No | No |
| North Carolina | Commission of Indian Affairs, [NC Tribal Communities](https://www.doa.nc.gov/divisions/american-indian-affairs/tribes) | Yes | Yes |
| South Carolina | Commission for Community Advancement and Engagement, [SC Recognized Tribes](https://advance.sc.gov/community-resources/native-american-affairs/sc-recognized-tribes) | Yes | Yes |
| Texas | No commission and no recognition process | No | No |
| Vermont | Vermont Commission on Native American Affairs ([site](https://vcnaa.vermont.gov/)) | Not read (403) | No |
| Virginia | Secretary of the Commonwealth, [State Recognized Tribes](https://www.commonwealth.virginia.gov/virginia-indians/state-recognized-tribes/) (the [Virginia Indian Advisory Board](https://www.commonwealth.virginia.gov/virginia-indians/virginia-indian-advisory-board/) advises on recognition) | Yes | Yes |

### States with leader lists for federally recognized nations

Found by web search; not opened or used yet. Each is a candidate second list for the nations in that state.

| State | Body and list |
| --- | --- |
| Arizona | Governor's Office on Tribal Relations, [Arizona Tribal Leadership List](https://gotr.azgovernor.gov/sites/default/files/arizona-tribal-leadership-list-5-6-2026_0.pdf) (May 2026) |
| California | Governor's Office of Tribal Affairs, [Tribal Liaisons Directory](https://tribalaffairs.ca.gov/wp-content/uploads/sites/10/2026/02/2026-02-05_Tribal-Liaisons-Directory_PUBLIC.pdf) (state staff, not Tribal leaders); the Native American Heritage Commission keeps a consultation contact list on request |
| Montana | Governor's Office of Indian Affairs, [Tribal leaders flyer](https://gov.mt.gov/_docs/tribalnations/TribalLeadersFlyer.pdf) |
| Nevada | Department of Native American Affairs, [Tribal Chairs and Organizations](https://dnaa.nv.gov/wp-content/uploads/2026/01/Tribal-Chairs-and-Organizations-for-website-7-1.pdf) (Jan. 2026) |
| New Mexico | Indian Affairs Department, [Tribal Leader Contacts](https://www.iad.nm.gov/wp-content/uploads/2026/08/Tribal-Leader-Contacts-public-8.10.2026.pdf) (Aug. 2026) and [Tribal Directory](https://www.iad.nm.gov/nations-pueblos-and-tribes/tribal-directory/) |
| North Dakota | Indian Affairs Commission, [site](https://www.indianaffairs.nd.gov/) |
| Oregon | Legislative Commission on Indian Services, [contacts](https://www.oregonlegislature.gov/cis/Pages/agency-contacts.aspx) |
| South Dakota | Department of Tribal Relations, [Tribal contacts](https://sdtribalrelations.sd.gov/tribal-contacts.aspx) |
| Washington | Governor's Office of Indian Affairs, [Tribal Directory](https://goia.wa.gov/node/101) |
| Wisconsin | Department of Administration, [Tribal Leaders](https://doa.wi.gov/DIR/Tribal-Leaders.pdf) |

Searched with no leader list found among the results: Oklahoma (the Oklahoma Indian Affairs Commission's directory did not appear; [Oklahoma Department of Libraries](https://oklahoma.gov/libraries/digital-resources/oklahoma-native-american-tribes.html) lists the nations), Minnesota ([Minnesota Indian Affairs Council](https://mn.gov/indian-affairs/about-us)), Nebraska, Utah ([Utah Division of Indian Affairs](https://indian.utah.gov/about/)), Idaho, Colorado ([Colorado Commission of Indian Affairs](https://ccia.colorado.gov/home/about-us)), Michigan and Maine. Not searched: the other states.

## Output

- `research/representatives/state-listings.json`: what was read from each state list, and the states whose pages name no office.
- `representatives` in 613 profiles; search logs in `research/search-logs/representatives/`.
