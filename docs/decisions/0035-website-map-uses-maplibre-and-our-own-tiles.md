# 0035. Draw the website's map with MapLibre and the project's own map tiles

- **Status:** Accepted (lead author, Nov. 23, 2026)
- **Date:** 2026-11-23

## Context

The website's map has been a picture drawn once when the site is built, with d3-geo, as the map tool spike recommended (project files, `spikes/map/REPORT.md`). Zooming only enlarges that picture, up to 8 times (16 in the "Land areas" view). On Nov. 23, 2026 the lead author said that many nations barely show up and that zoom is limited, and asked whether Google Maps would help.

Measured that day from the Census Bureau's 2020 file: of the 629 land areas on the map, 293 cover less than 25 square kilometers and 63 less than 1. At full zoom one pixel of the drawn map is still about a kilometer, so Blue Lake Rancheria (0.34 square kilometers) is less than a pixel wide, with no towns or roads around it.

Four tools were compared in the project thread "Improve the map's zoom and small nations" and its document "Map engine: keep D3 or switch?": keeping d3-geo, MapLibre GL JS with map tiles the project builds and stores, Leaflet, and the Google Maps JavaScript API. Google Maps charges past 10,000 map loads a month,[^google-pricing] does not allow keeping its map for offline reading, requires its credit to stay on the map,[^google-terms] sends each visitor's map views to Google, and shows Google's own reservation labels, which a nation's withdrawal request could not remove.

## Decision

The lead author chose MapLibre with the project's own tiles on Nov. 23, 2026. The website's map is drawn in the browser by MapLibre GL JS from two tile sets that the project builds and keeps in its private bucket, served by the website's own Worker:

- **Land areas and states**, from the Census Bureau's 2020 cartographic boundary files at full detail.[^census]
- **A basemap** of towns, roads, water and borders from OpenStreetMap, in the Protomaps basemap build, cut to the United States and its territories.[^protomaps]

Small areas show as dots until their outlines are large enough to see, and readers can zoom to street level. The drawn d3-geo map stays for printing, the book, offline reading and devices that cannot run MapLibre.

## Consequences

- `site/tools/build-map-tiles.mjs` builds both tile sets with tippecanoe and the pmtiles tool and uploads them; `site/geography/map-tiles.json` names the files the site serves. Tiles are served at `/map-tiles/<set>/<z>/<x>/<y>.mvt`.
- No third party sees readers' map views: tiles come from the website's own address.
- The map credits the Census Bureau and, as the basemap's Open Database License requires, OpenStreetMap's contributors.
- A nation's request to leave its area off the map still wins (charter commitment 6): the list of withdrawn Census codes moves to `site/geography/withdrawn-land-areas.json`, which both the drawn map and the tile build read. A change needs new tiles.
- Map pages load MapLibre (about 290 KB compressed), only when the map is shown. The budget of no map library in the browser (site/DESIGN.md, section 11) no longer applies to map pages.
- The bucket grows by about 2.2 GB, about 3 cents a month at the bucket's storage price. Cloudflare caches the tiles only once the site has its own domain; until then each tile is read from the bucket.

## Sources

[^google-pricing]: Google, Google Maps Platform pricing, https://developers.google.com/maps/billing-and-pricing/pricing (Dynamic Maps; read Nov. 23, 2026).

[^google-terms]: Google, Google Maps Platform Service Specific Terms, https://cloud.google.com/maps-platform/terms/maps-service-terms/ (read Nov. 23, 2026).

[^census]: U.S. Census Bureau, 2020 Cartographic Boundary Files, American Indian/Alaska Native/Native Hawaiian Areas and States, 1:500,000 (source records `census-cartographic-boundary-aiannh-2020` and `census-cartographic-boundary-states-2020`).

[^protomaps]: Protomaps, basemap daily builds of OpenStreetMap data, https://docs.protomaps.com/basemaps/downloads (source record `protomaps-basemap-openstreetmap`).
