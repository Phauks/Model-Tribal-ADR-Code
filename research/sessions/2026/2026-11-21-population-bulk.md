---
id: 2026-11-21-population-bulk
date: '2026-11-21'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: page-fetch
  name: curl
- kind: other
  name: pdftotext (layout and bbox modes)
- kind: other
  name: python3 -I parsing scripts
- kind: page-fetch
  name: page fetch
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: A research sub-agent searched, opened sources and returned cited facts in the raw file; the
    lead session reviewed the output and built the records.
purpose: Gather population figures and Census areas for the federally recognized nations from bulk official
  datasets.
queries:
- https://api.census.gov/data/2020/dec/pl?get=NAME,P1_001N&for=american%20indian%20area/alaska%20native%20area/hawaiian%20home%20land:*
  (redirected to missing_key.html; API now needs a key)
- https://www2.census.gov/programs-surveys/decennial/2020/data/01-Redistricting_File--PL_94-171/National/us2020.npl.zip
- https://www2.census.gov/programs-surveys/decennial/2020/data/01-Redistricting_File--PL_94-171/<State>/<st>2020.pl.zip
  (geographic header only, by HTTP range requests; summary level 280 records used as a cross-check of
  state parts)
- https://www2.census.gov/geo/docs/maps-data/data/rel2020/aiannh/tab20_aiannh20_county20_natl.txt
- https://www2.census.gov/programs-surveys/decennial/2020/data/detailed-dhc-a/2020-ddhc-a.zip
- https://www2.census.gov/programs-surveys/decennial/2020/technical-documentation/complete-tech-docs/detailed-demographic-and-housing-characteristics-file-a/2020-census-hispanic-origin-and-race-iterations-list.xlsx
- https://www.bia.gov/sites/default/files/dup/assets/public/pdf/idc1-024782.pdf (2013 report, downloaded
  directly)
- https://www.bia.gov/sites/bia.gov/files/assets/public/pdf/idc-001719.pdf (2005 report; scanned images,
  no text layer, not used)
- http://archive.org/wayback/available?url=bia.gov/sites/bia.gov/files/assets/public/pdf/idc1-024782.pdf
- https://www.hud.gov/sites/dfiles/PIH/documents/FY_25_Grant_Summary.pdf
sources_added:
- bia-american-indian-population-and-labor-force-report-2013
- census-2020-detailed-demographic-and-housing-characteristics-file-a
- census-2020-redistricting-data-national-summary-file
- census-2020-tribal-area-to-county-relationship-file
- hud-indian-housing-block-grant-fy2025-final-allocation
limits: '(1) The Bureau of Indian Affairs 2013 American Indian Population and Labor Force Report has NO
  tribal enrollment column (the 2005 report had one, but its PDF at bia.gov is a scanned image with no
  text layer and no OCR tool was available, so it was not used). From the 2013 report only Appendix Table
  2 figures were taken: 110 nations got the 2010 service area population (kind service-area-population)
  and 58 got a Census-based population indicator (kind other; county-vicinity figures marked low confidence).
  About 440 rows in that table carry no tribe-specific figure (the nation is only in a geographic group).
  Rows for divisions of a nation (by state, county or band: Navajo agencies, Minnesota Chippewa bands,
  Ponca by county, Sisseton-Wahpeton by state, Standing Rock in North Dakota, Duck Valley in Idaho, Colorado
  River in Arizona, Samish in San Juan County, Te-Moak Battle Mountain, Washoe Woodfords) were skipped
  as partial. (2) Enrollment (kind enrolled-citizens) therefore comes from the HUD FY 2025 Indian Housing
  Block Grant table for 345 of the 350 contiguous-48 nations; Alaska rows left to the Alaska helper. No
  HUD row for: Capitan Grande Band (the HUD row named Capitan Grande Band was skipped because Barona has
  no separate row, so the row''s coverage is unclear), Barona, Chicken Ranch Rancheria, Minnesota Chippewa
  Tribe (HUD lists the six component bands separately; skipped), Passamaquoddy Tribe (HUD lists Passamaquoddy
  Tribe and Pleasant Point separately; skipped as partial). HUD rows for state-recognized groups (Coharie,
  Haliwa-Saponi, MOWA Band of Choctaw, Waccamaw Siouan) skipped; no entities created. Some HUD enrollment
  values are 0 (Onondaga, Tonawanda, Tuscarora, Koi) and are recorded as given. (3) api.census.gov now
  requires a key (keyless calls redirect to missing_key.html), so the 2020 redistricting national summary
  file and the tribal-area-to-county relationship file from www2.census.gov were used instead. Census
  areas not matched to any roster nation: 75 Hawaiian Home Lands (Native Hawaiians are not a tribe; no
  entity created), state reservations and State Designated Tribal Statistical Areas of state-recognized
  groups, Celilo Village (held for several Columbia River nations), Ontonagon Reservation, Tama (state)
  Reservation, three zero-population joint-use areas (Kickapoo (KS)/Sac and Fox; San Felipe/Santa Ana;
  San Felipe/Santo Domingo), and the Alaska Native village statistical areas Kodiak, Lake Minchumina,
  Canyon Village, Port Alsworth and Uyak. 30 roster nations have no Census area (landless or regional):
  alabama-quassarte-tribal-town, buena-vista-rancheria, california-valley-miwok-tribe, cloverdale-rancheria,
  delaware-tribe-of-indians, federated-indians-of-graton-rancheria, kialegee-tribal-town, koi-nation,
  little-shell-tribe, monacan-indian-nation, nansemond-indian-nation, potter-valley-tribe, san-juan-southern-paiute-tribe,
  scotts-valley-band, shawnee-tribe, tejon-indian-tribe, thlopthlocco-tribal-town, united-keetoowah-band
  (lives within the Cherokee statistical area but was not matched because the area name says only Cherokee),
  upper-mattaponi-tribe, wilton-rancheria, central-council-of-the-tlingit-and-haida-indian-tribes, inupiat-community-of-the-arctic-slope,
  kaguyak-village, king-island-native-community, native-village-of-afognak, native-village-of-kanatak,
  native-village-of-unga, pauloff-harbor-village, sunaq-tribe-of-kodiak, umkumiut-native-village. Shared
  or joint-use statistical areas (Wind River, Caddo-Wichita-Delaware, Kiowa-Comanche-Apache-Fort Sill
  Apache, Citizen Potawatomi-Absentee Shawnee and the joint-use Oklahoma areas) give the same count to
  each nation named; notes say so. Resident population counts everyone living in the area, of any background.
  (4) Detailed DHC-A: national alone-or-in-combination counts for 571 nations whose own name appears as
  a Census tribal group; broad groupings (Apache, Sioux, Cherokee, Chippewa and the like) were not used.
  Not recorded where two separate iterations could both mean the nation (Northern Arapaho: ''Arapaho Tribe
  of the Wind River Reservation'' and ''Northern Arapaho Tribe''; Pribilof Islands: ''Saint George Island''
  and ''Saint Paul Island''; Venetie: ''Village of Venetie'' and ''Arctic Village''), or where no specific
  label exists (Minnesota Chippewa Tribe). State and tribal-area level Detailed DHC-A counts were not
  extracted.'
---

## What was done

Bulk official datasets only, no per-nation searching. Census: the 2020 redistricting national geographic header (summary level 250) gave each tribal area's code, name and total population; areas were matched to roster nations by name, with hand review of every match and notes where the match rests on a former name, a component band or a community name (Alaska Native village statistical areas were matched through the Tribal Leaders Directory community fields). One census-area fact and one resident-population fact per matched area per nation. State presence comes from the 2020 tribal area to county relationship file (land part greater than 0): presence land for legal areas (reservations, trust land, pueblos, rancherias, colonies, state reservations), presence other for statistical areas (Alaska Native village, Oklahoma tribal, tribal designated and state designated statistical areas). Detailed DHC-A table T01001 United States rows were joined to the official iterations list; labels matched exactly to the roster official or listed name, plus hand-reviewed name variants. HUD FY 2025 IHBG and BIA 2013 Appendix Table 2 PDFs were parsed by word position (pdftotext -bbox) and rows matched to roster names with fuzzy scoring and hand review.

## Output

`research/raw/2026-11-21/population-bulk.json`: 2848 facts about 575 nations or communities from 5 sources. What the build kept and dropped is in `research/raw/2026-11-21/build-report.json`.
