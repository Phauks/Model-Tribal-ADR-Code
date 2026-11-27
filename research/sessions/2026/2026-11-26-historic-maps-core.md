---
id: 2026-11-26-historic-maps-core
date: '2026-11-26'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: One session wrote scripts/maps/land_cessions.py and site/tools/build-historic-maps.mjs and ran them; a Claude subagent matched 72 older Federal Register names of nations to nation records, which the session checked by hand.
- kind: page-fetch
  name: apps.fs.usda.gov, www2.census.gov and loc.gov
  detail: The U.S. Forest Service's Indian Land Cessions map service (layer 0 and table 2), the Census Bureau's national American Indian area files for 1990, 2000 and 2007 to 2026, and the Library of Congress's scans of Royce's 67 map sheets and the volume.
purpose: 'Trevor asked to "grab the useful map core" from the historic maps study (research/analyses/2026-11-26-historic-maps-of-indian-lands.md): Royce''s land cession maps, the Forest Service''s tracing of them linked to treaty and nation records, and every year of the Census Bureau''s land areas, for a year slider on the website''s map.'
queries:
- Every cession shape and table row in the Forest Service's map service
- Every national American Indian area file the Census Bureau publishes
- Every sheet in the Library of Congress's maps-only copy of Royce (g3701em.gct00002)
sources_added:
- forest-service-indian-land-cessions
- census-tiger-aiannh-1990-2026
limits: 'Treaties are linked by date: a cession is linked to the treaty records signed on one of its dates, and when two treaties share a date, to the one whose Kappler page matches the Forest Service''s link to Kappler (vol. 2 at HathiTrust runs 8 scans ahead of its page numbers in 518 of 548 single-treaty matches). Seven cession dates still have two treaties and are left unlinked. Cessions by Act of Congress, executive order or agreement are not linked until those records exist. Nations are linked by the Forest Service''s present-day names; 11 rows name a group with no nation record (nonfederally recognized groups). Royce''s sheets are not georeferenced, so the scans open in the image viewer rather than over the map.'
---

# Historic maps core: session notes

## What was built

`scripts/maps/land_cessions.py fetch` downloads the Forest Service's 718 cession shapes and 725-row table; `link` writes `site/geography/land-cessions.json` with each cession's dates, treaties, nations and map sheets. Older nation names go through `site/geography/land-cession-nation-names.json`. `site/tools/build-historic-maps.mjs` downloads the 22 Census years and Royce's sheets and volume, cuts two map tile sets (land cessions, 2.3 MB; land areas by year, 15.8 MB, 9,568 shapes, each carrying the years the Bureau drew it so), turns the JPEG 2000 sheets into JPEGs, and uploads everything to the bucket under `map-tiles/` and `historic-maps/`.

## Results

717 cessions with a Royce number (one shape has none and is left out); 460 linked to 248 treaty records; 633 linked to at least one nation page. 66 of the 67 sheets have a cession on them.

## On the website

The shared map block (`site/src/lib/components/TileMap.svelte`) gains a Historic group in its Layers menu with a Land cessions switch, and a year slider under the map (`YearSlider.svelte`) on the Map page's Land Areas view, on any view while cessions are on, and under a nation's Land Areas map. Choosing a cession on the Map page opens its details beside the map (`/nations/map#cession-<number>`). Nation pages get a Land cessions section after Treaties and federal ties; treaty pages get a Land ceded row and a small map in At a glance. The Statistics page counts Land Cessions and Historic Maps.

## Next

Link the remaining cessions as Act, executive order and agreement records are added (tier 1). Georeference Royce's sheets, about 10 to 20 minutes each by hand, if scans over the map are wanted.
