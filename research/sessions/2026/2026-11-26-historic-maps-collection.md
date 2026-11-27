---
id: 2026-11-26-historic-maps-collection
date: '2026-11-26'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: One session wrote site/tools/collect-historic-maps.mjs, chose which Library of Congress maps to keep by their titles, and ran the tool.
- kind: page-fetch
  name: biamaps.geoplatform.gov and loc.gov
  detail: The Bureau of Indian Affairs' land area map services (national land areas, Oklahoma Tribal Statistical Areas, supplemental areas) and the Library of Congress's item records and JPEG 2000 scans for the kept maps.
purpose: 'Trevor chose steps A and B of the historic maps study (research/analyses/2026-11-26-historic-maps-of-indian-lands.md): "lets get A, and B. And note this for future use." The earlier core build (research/sessions/2026/2026-11-26-historic-maps-core.md) already held the Forest Service cessions, the Census years and Royce''s sheets, so this session collected the rest: the Bureau of Indian Affairs'' land areas (step A) and the Library of Congress maps (step B).'
queries:
- Every feature of the Bureau's three land area layers, as GeoJSON
- The Library of Congress item record and every JPEG 2000 scan for each map marked keep in research/reviews/2026-11-26-historic-maps-library-of-congress.csv
sources_added:
- bia-land-area-representations
limits: 'The Library of Congress list comes from seven title searches, so maps titled without the words searched are missed. Of the 87 found, 28 were left out because they are not about Indian lands (general colonial, state or United States maps, atlases, town views, park guides); the reason is in the list''s `reason` column. Allotment maps name individual people, so they are kept in the bucket but not served until the nation has seen them (charter commitment 4). A map whose Library rights line does not say it is free to use is kept but not served. None of the scans is georeferenced, so they open in the image viewer, not over the map; the Bureau''s areas are not drawn on the map yet either.'
---

# Historic maps collection: session notes

## What was collected

`site/tools/collect-historic-maps.mjs fetch` downloads the Bureau of Indian Affairs' three land area layers (335 national areas, 30 Oklahoma Tribal Statistical Areas, 9 supplemental areas) and, for each Library of Congress map marked keep, its item record and JPEG 2000 scans. `build` makes a JPEG and a thumbnail for each scan, writes `site/geography/historic-map-scans.json` and writes a source record for each map. `upload` puts everything in the bucket under `historic-maps/bia-land-areas/` and `historic-maps/library-of-congress/`; `index` adds the files to `research/capture-index.csv`.

## Results

The Bureau's layers hold 335 national land areas, 30 Oklahoma Tribal Statistical Areas and 9 supplemental areas. 59 Library of Congress maps were kept, with 312 images (3.6 GB in all, with the JPEGs and thumbnails); 939 files went into the bucket. Three maps name individual allottees and are kept but not served: *Map of Pawnee Reservation showing allotments* (1893), the Umatilla Indian Reservation township maps (about 1900, 10 sheets) and the Indian Territory Map Company's *Cherokee Nation* atlas (1909, 238 sheets). The other 56 maps (63 images) are served. All 59 carry the Library's general rights line for its Geography and Map Division ("free to use and reuse unless a Rights Advisory statement is present") or a public domain statement. One scan was too large for ImageMagick's limits, so its viewer JPEG was made at a lower resolution; the JPEG 2000 file keeps the full one.

## On the website

The Historic Maps collection lists the Library of Congress maps beside Royce's sheets; each opens in the image viewer as the site's own copy, so no reader's request goes to the Library.

## For later

Step C of the study, the National Archives' Bureau of Indian Affairs maps (about 11,700 land maps, about 150 GB), is not collected; pull it nation by nation as nation pages are worked on, holding allotment maps and any map of sacred or burial sites back for the nation. Georeferencing Royce's sheets and these maps, a layer for the Bureau's land areas, and links from each map to the nations it shows all wait for a mockup and Trevor's go-ahead.
