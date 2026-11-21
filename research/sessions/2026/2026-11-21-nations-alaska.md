---
id: 2026-11-21-nations-alaska
date: '2026-11-21'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: page-fetch
  name: curl against State of Alaska ArcGIS REST services
- kind: other
  name: python3 join/match scripts
- kind: web-search
  name: web search
- kind: page-fetch
  name: page fetch
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: A research sub-agent searched, opened sources and returned cited facts in the raw file; the
    lead session reviewed the output and built the records.
purpose: Gather contacts, regional affiliations, languages, Native names and citizen counts for the Alaska
  Native entities on the federal list.
queries:
- https://maps.commerce.alaska.gov/server/rest/services/Contacts/CDO_Contacts_Federally_Recognized_Tribes/MapServer/0/query?where=1%3D1&outFields=*&f=json
- https://maps.commerce.alaska.gov/server/rest/services/Community_Related/Community_Regions_Overview/MapServer/0/query?where=1%3D1&outFields=*&f=json
- https://maps.commerce.alaska.gov/server/rest/services/Community_Related/Community_Overview/MapServer/1/query?where=1%3D1&outFields=*&f=json
- https://maps.commerce.alaska.gov/server/rest/services/?f=json (service catalog)
- 'web search: HUD Indian Housing Block Grant FY 2025 final allocation formula area data enrollment'
- https://www.hud.gov/sites/dfiles/PIH/documents/FY_25_Grant_Summary.pdf
- https://www.kenaitze.org/
- https://www.sitkatribe.org/
- https://www.eklutna-nsn.gov/
- https://www.tlingitandhaida.gov/
- https://www.metlakatla.com/
- https://www.necalaska.org/
- https://www.qawalangin.com/
- https://www.sunaq.org/
- https://www.chickaloon-nsn.gov/
- https://www.kniktribe.org/
- https://www.ninilchiktribe-nsn.gov/
- https://www.eyak-nsn.gov/
- https://www.arcticslope.org/
- https://www.nvb-nsn.gov/ (robots unreachable)
- https://www.svt.org/ (robots unreachable)
- https://www.kictribe.org/ (fetch failed)
- https://www.nativecouncil.org/ (fetch failed)
sources_added:
- alaska-dcra-community-regions-overview
- alaska-dcra-federally-recognized-tribes-contacts
- alaska-dcra-native-place-names
- eklutna-native-village-website
- hud-indian-housing-block-grant-fy2025-final-allocation
- kenaitze-indian-tribe-website
- metlakatla-indian-community-website
- nome-eskimo-community-website
- qawalangin-tribe-website
- sitka-tribe-of-alaska-website
- tlingit-and-haida-website
limits: 'Contacts, alternate names, regional affiliations and place-name languages come from State of
  Alaska DCRA layers and cover all 225 Alaska roster nations. Emails: only office-type mailboxes were
  kept (about 194); addresses that looked personal (a person''s name, officer titles such as president
  or mayor, staff roles) were dropped, so some nations have no email fact. Websites: only 57 records carry
  a website in the state layer; a few point to regional consortium sites (labeled, medium confidence);
  the state lists http://www.kenaize.org for Kenaitze (likely a typo for kenaitze.org), recorded as given.
  Related entities are stated by the state per community, not per tribal government; for nations based
  in a city (for example Central Council of the Tlingit and Haida Indian Tribes in Juneau, Ketchikan Indian
  Community) the affiliation reflects that community. Self-references (a tribe listed as its own health
  provider) were skipped. Language facts (212 from DCRA) are the language of the community''s Native place
  name, as the state took it from the Alaska Native Language Center place-names map; they were not attached
  to multi-community nations (Tlingit and Haida Central Council, Pribilof Islands Aleut Communities, Native
  Village of Venetie Tribal Government, Inupiat Community of the Arctic Slope). ISO 639-3 tags were assigned
  by the researcher (Iñupiaq tagged ipk; Sugt''stun/Alutiiq ems; Middle Tanana has no ISO code, left untagged;
  ambiguous ''Tanana'' / ''Middle Tanana or Tanacross'' entries skipped). 28 communities had no place-name
  row. Native place names were recorded as name-alternate, not name-self-designation, because they name
  the place, not the government. Only 3 true self-designations were found (Kenaitze, Eklutna, Sitka) in
  a short pass over about 15 nation websites; several sites blocked automated fetching (nvb-nsn.gov, svt.org,
  kictribe.org, nativecouncil.org). Population: 221 enrolled-citizen counts come from the HUD FY 2025
  Indian Housing Block Grant table (enrollment as used in the formula, matched by short name); not assigned
  for Native Village of Venetie Tribal Government and Pribilof Islands Aleut Communities (HUD lists their
  constituent villages separately: Arctic Village 172, Venetie 237, Saint George Island 131, Saint Paul
  Island 653), and Egegik Village and Village of Sleetmute have no HUD row. Two own-site figures (Tlingit
  and Haida, Nome Eskimo Community) were added and differ from HUD. Not attempted: Alaska Native Language
  Center pages directly, regional consortium per-village enrollment pages, Native-language self-designations
  for most Yup''ik and Iñupiaq villages.'
---

## What was done

Pulled the State of Alaska DCRA ArcGIS REST layers with curl (Federally Recognized Tribes contacts, Community Regions Overview, Native Place Name), matched 230 contact rows to the 225 roster ids by normalized name plus 15 manual matches (constituent rows for Venetie/Arctic Village and St. Paul/St. George folded into their combined nations with labels), and joined communities to regional corporation, regional nonprofit and regional health provider. Added enrollment from the HUD FY 2025 IHBG Final Allocation PDF (parsed with pdftotext), then spot-checked about 15 nation websites for Native-language names and enrollment statements.

## Output

`research/raw/2026-11-21/nations-alaska.json`: 2047 facts about 225 nations or communities from 11 sources. What the build kept and dropped is in `research/raw/2026-11-21/build-report.json`.
