---
id: 2026-11-27-map-redesign
date: '2026-11-27'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: One session measured the Map page, mocked up redesigns, added three layers to site/tools/build-historic-maps.mjs and ran it.
- kind: page-fetch
  name: publications.newberry.org and services1.arcgis.com (National Park Service)
  detail: The Newberry Library's generalized US Historical States and Territories file, the National Park Service's Trail of Tears National Historic Trail lines, and its tracing of the 1978 map of Indian land areas judicially established.
purpose: 'Trevor asked for the Map page to show states and nations together with layers that turn on and off, a map over time like a territorial evolution map (without copying anyone''s images), and how peoples moved: ancestral lands as against reservations, removals and migrations. The coordinator asked for sources with legal standing first, homelands shown as sourced findings rather than borders, and no Native Land Digital data without permission.'
queries:
- Historical state and territory boundaries, openly licensed, with dates
- Removal routes drawn by a federal agency
- The Indian Claims Commission's findings of each nation's land, as a map
sources_added:
- newberry-atlas-historical-states-and-territories
- park-service-trail-of-tears-routes
- indian-land-areas-judicially-established-1978
limits: 'The Newberry Library''s file ends on December 31, 2000; the site treats a shape standing then as standing today. The removal routes layer has only the Cherokee removal of 1837 to 1839, the routes the National Park Service maps; other nations'' removals need other sources. The 1978 areas are the Indian Claims Commission''s findings in claims against the United States, not any nation''s own account of its homeland, and are shown dashed and credited. Native Land Digital''s maps are not used: its terms forbid storing or redistributing its data.'
---

# Map redesign: session notes

## What was built

`site/tools/build-historic-maps.mjs fetch --only layers` downloads the three sources (the Newberry Library's site sometimes asks a person to pass a check first, so its file may need downloading by hand); `build --only layers` cuts three tile sets: borders over time (220 shapes, each with the day it began and ended, the change and the law cited), removal routes (2,006 pieces joined into 21 lines, one per route or shared stretch) and homelands found by the Indian Claims Commission (298 areas). `upload --only layers` puts the tiles and the downloaded files in the bucket, and `index --only layers` lists the files in `research/capture-index.csv`.

## On the website

The Map page's controls follow the approved design D (mockups in the project's design files): search and Layers at the top left, the main layers as buttons beside them, zoom, one flat-or-globe button and full screen at the right, a key listing only what is on, and a timeline along the bottom that rests on Today.

## Next

Map stories (one nation through homeland, cessions, removal and land today) are parked on the roadmap. Removal routes for other nations need sources with legal standing, such as removal provisions in treaties.
