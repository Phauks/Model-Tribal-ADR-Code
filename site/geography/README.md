# Map shapes

Boundary files the website's map reads when the site is built (`src/lib/map-geometry.ts`). Nothing here is served to readers as a file; the build turns it into SVG paths.

| File | What it is | Source |
| --- | --- | --- |
| `bureau-of-indian-affairs-regions.json` | The twelve Bureau of Indian Affairs regions, as TopoJSON, simplified to about 3 percent of the points for a national map | U.S. Department of the Interior, Bureau of Indian Affairs, Branch of Geospatial Support, "BIA Regions" feature service (source record [`bia-regions-2026`](../../content/sources/b/bia-regions-2026.yaml)) |
| `map-tiles.json` | The map tiles the site serves at `/map-tiles/<set>/<z>/<x>/<y>.mvt`: each file's key in the private bucket, size, SHA-256, zoom levels and source | Written by `tools/build-map-tiles.mjs` (below) |
| `census-land-area-points-2020.json` | For each land area, where to put its label or dot (inside its largest piece), its bounding box and its size in square kilometers | Written by `tools/build-map-tiles.mjs` from the same Census file as the land areas |
| `map-tile-region.json` | The boxes around the states and territories that the basemap tiles are cut to | Project file |
| `withdrawn-land-areas.json` | Census codes of land areas a nation has asked to leave off every map (charter commitment 6) | Project file; read by the drawn map and the tile build |
| `census-land-areas-2020.json` | 629 American Indian and Alaska Native areas (reservations, trust lands and the Census Bureau's statistical areas), as TopoJSON, simplified to about 3 percent of the points, for the map's "Land areas" view; Hawaiian home lands are left out | U.S. Census Bureau, 2020 cartographic boundary file of American Indian/Alaska Native/Native Hawaiian areas, 1:500,000 (source record [`census-cartographic-boundary-aiannh-2020`](../../content/sources/c/census-cartographic-boundary-aiannh-2020.yaml)) |

State and territory outlines come from the `us-atlas` package (the Census Bureau's 2017 cartographic boundary files; source record [`census-cartographic-boundary-states-2017`](../../content/sources/c/census-cartographic-boundary-states-2017.yaml)), so they are not copied here.

The regions are the Bureau's administrative areas, not the lands of any nation. The Navajo Region's outline follows the Navajo Nation's land, as the Bureau draws it; Trevor chose on 2026-11-21 to draw the official outlines anyway, with a note on the map saying so.

The "Land areas" view draws the Census Bureau's areas, which Trevor asked for on 2026-11-22 ([decision record 0028](../../docs/decisions/0028-map-adds-census-land-areas.md), amending [0007](../../docs/decisions/0007-map-shows-state-presence.md)). The other views draw no nation's land.

## Refreshing the regions

From `site/`:

```sh
node tools/fetch-bureau-of-indian-affairs-regions.mjs
```

The script downloads the regions, turns the outer rings clockwise (the service writes them counterclockwise, as GeoJSON does, and d3-geo would read that as "the whole globe except this region"), simplifies them and records the date retrieved in the file's `metadata`. Update the source record's `retrieved` and `history` dates when you run it.

## Refreshing the land areas

From `site/`:

```sh
node tools/fetch-census-land-areas.mjs
```

The script downloads the Census Bureau's file, sorts the areas into kinds by their Census codes, leaves out Hawaiian home lands and pieces under 5 square kilometers (except each area's largest piece), simplifies the rest and records the date retrieved in the file's `metadata`. The shapefile already stores outer rings clockwise, as d3-geo expects. Update the source record's `retrieved` and `history` dates when you run it. To leave an area off the map at a nation's request, add its Census code to `withdrawnLandAreas` in `src/lib/map-geometry.ts`.

## Building the map tiles

The website draws its map with MapLibre from two tile sets kept in the private bucket ([decision record 0039](../../docs/decisions/0039-website-map-uses-maplibre-and-our-own-tiles.md)): the Census Bureau's land areas and states at full detail, and a Protomaps basemap of OpenStreetMap data (towns, roads, water) cut to the United States and its territories up to zoom 12, about 2.2 GB. The drawn map above stays for print, the book and offline reading.

The build needs [tippecanoe](https://github.com/felt/tippecanoe) and the [pmtiles tool](https://github.com/protomaps/go-pmtiles) (`go install github.com/protomaps/go-pmtiles@latest`) on the PATH. From `site/`:

```sh
node tools/build-map-tiles.mjs build --work /tmp/map-tiles
node tools/build-map-tiles.mjs upload --work /tmp/map-tiles
```

`build` downloads the Census files and the latest Protomaps build (or the one given with `--basemap-build YYYYMMDD`), writes the two PMTiles files to the work folder, and rewrites `map-tiles.json` and `census-land-area-points-2020.json`. `upload` puts the files in the bucket under `map-tiles/`, skipping any already there with the same SHA-256; it reads `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` and `CLOUDFLARE_ACCOUNT_ID` from the environment. Upload before merging the new `map-tiles.json`, so the live site never names a file the bucket lacks. Each file's name carries its build (the land areas' SHA-256, the basemap's date), so browsers may keep tiles for a year. Rebuild after a change to `withdrawn-land-areas.json`.

The basemap's labels and icons need its fonts (Noto Sans, SIL Open Font License) and icon sheets (MIT), which `node tools/build-map-tiles.mjs upload-assets --assets <folder>` puts in the bucket under `map-tiles/assets/` from a checkout of [protomaps/basemaps-assets](https://github.com/protomaps/basemaps-assets); the comment at the top of the script says which folders to check out.
