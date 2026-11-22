---
id: 2026-11-22-census-land-areas-map
date: 2026-11-22
researchers: [Lead author, Claude (AI assistant)]
tools:
  - kind: ai-assistant
    name: Claude (AI assistant)
    detail: Downloaded the Census Bureau's 2020 boundary file of American Indian, Alaska Native and Native Hawaiian areas, classified and simplified it, and built the map's "Land areas" view.
purpose: >-
  Add a view of nations' land areas to the website's map, as the lead author asked on 2026-11-22, from the official source the dataset already cites for Census area codes.
queries: []
sources_added:
  - census-cartographic-boundary-aiannh-2020
limits: >-
  The view draws a copy simplified to about 3 percent of the file's points, with pieces under 5 square kilometers left out except each area's largest piece. That is enough for a national map and not for any closer look. The file is the 2020 vintage, so boundaries changed since then are not shown. Statistical areas are the Census Bureau's counting areas, not legal boundaries. Nations without a land base have no area.
---

Findings:

- The Census Bureau's 2020 cartographic boundary file (cb_2020_us_aiannh_500k) holds 704 areas. It has no class code field, so areas were sorted by the Census code ranges, checked against each area's legal or statistical area description code (LSAD): codes under 5000 are federal reservations and off-reservation trust lands (327 areas); 5000 to 5999 are Hawaiian home lands (LSAD 78, 75 areas) and Oklahoma tribal statistical areas (LSAD 88 and 90, 29 areas); 6000 to 7999 are Alaska Native village statistical areas (221); 8000 to 8999 are tribal designated statistical areas (7); 9000 to 9499 are state reservations (10); 9500 and up are state designated tribal statistical areas (35). Counts measured from the file on 2026-11-22.
- Hawaiian home lands are left out. They are lands of the State of Hawaiʻi's Hawaiian home lands program, not of any nation, and Native Hawaiians are not a tribe (project rule).
- 590 nation records already cite 2020 Census area codes in `census_areas`, so each area on the map links to a table row that lists the nations whose entries name it.
- Simplifying turned three tiny rings inside out (two pieces of the Navajo Nation Reservation and Off-Reservation Trust Land and one of the Pascua Pueblo Yaqui area), which d3-geo then drew as the whole globe. `site/src/lib/map-geometry.ts` turns such rings back.
- Drawn into the page, the view would have taken the map page from about 750 KB to 1.8 MB. It is fetched when a reader opens it instead (about 106 KB compressed).
