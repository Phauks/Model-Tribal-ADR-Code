---
id: 2026-11-27-removal-routes-for-the-map
date: '2026-11-27'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: One thread session with three research subagents (one for route data, two for removals east and west of the Mississippi); the thread session re-checked counts and quotations by script, placed each removal on the map and built the tile set.
- kind: page-fetch
  name: services1.arcgis.com, treaties.okstate.edu, tile.loc.gov, federalregister.gov, govinfo.gov, nps.gov, parkplanning.nps.gov, wikidata.org
  detail: Federal map services (National Park Service, Forest Service, Bureau of Land Management), Kappler's treaties, the Statutes at Large, the Federal Register, Park Service studies, and Wikidata coordinates for named places.
purpose: 'Trevor asked for research on adding more removal routes to the map than the Trail of Tears, then: "if you have located more lines, create them, then we can figure out what we want to do. If not, can we at least identify where tribes migrated to?"'
queries:
- Federal line data for removal routes and national historic trails
- Status of the Long Walk national historic trail study
- Each nation's removal stages, with the treaty, statute or order and the destination it names
sources_added:
- forest-service-nez-perce-trail
limits: 'Only the Nez Perce trail (the 1877 flight) has public line data beyond the Trail of Tears. The removal arrows join a point for the land a nation left to a point for the land it was sent to; they are not routes. Some points are anchors (a county, an agency town) chosen from the stage''s description. Every removal stage is Unverified; several stages rest on military or executive orders whose text was not fetched.'
---

# Removal routes for the map: session notes

## What was found

See `research/analyses/2026-11-27-removal-routes-for-the-map.md`. The Trail of Tears routes added in 2009 are already on the map; the Nez Perce National Historic Trail is the only other route with public line data; the Long Walk exists only as map figures in a Park Service study and both nations declined designation; the other removals have no line data.

## What was built

`research/historic-maps/removals/removals.json` holds 89 removal stages in 55 journeys. `site/tools/removal-places.mjs` places each end (Wikidata, Census area, or Royce cession) and writes `site/geography/removals.json`; 85 stages have both ends. `site/tools/build-historic-maps.mjs build --only journeys` makes the "Forced journeys" tile set (the Nez Perce trail and one arrow per stage), recorded in `site/geography/map-tiles.json` and uploaded to the bucket. The map does not draw it yet.

## Next

Trevor chooses how the map shows the journeys. The Long Walk route files are to be asked of the Park Service's Santa Fe trails office, and the Navajo Nation and the Mescalero Apache Tribe asked before the Long Walk is drawn; the Potawatomi Trail of Death Association is to be asked for its route.
