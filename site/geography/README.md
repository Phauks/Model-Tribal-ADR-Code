# Map shapes

Boundary files the website's map reads when the site is built
(`src/lib/map-geometry.ts`). Nothing here is served to readers as a file; the
build turns it into SVG paths.

| File | What it is | Source |
| --- | --- | --- |
| `bureau-of-indian-affairs-regions.json` | The twelve Bureau of Indian Affairs regions, as TopoJSON, simplified to about 3 percent of the points for a national map | U.S. Department of the Interior, Bureau of Indian Affairs, Branch of Geospatial Support, "BIA Regions" feature service (source record [`bia-regions-2026`](../../content/sources/b/bia-regions-2026.yaml)) |
| `census-land-areas-2020.json` | 629 American Indian and Alaska Native areas (reservations, trust lands and the Census Bureau's statistical areas), as TopoJSON, simplified to about 3 percent of the points, for the map's "Land areas" view; Hawaiian home lands are left out | U.S. Census Bureau, 2020 cartographic boundary file of American Indian/Alaska Native/Native Hawaiian areas, 1:500,000 (source record [`census-cartographic-boundary-aiannh-2020`](../../content/sources/c/census-cartographic-boundary-aiannh-2020.yaml)) |

State and territory outlines come from the `us-atlas` package (the Census
Bureau's 2017 cartographic boundary files; source record
[`census-cartographic-boundary-states-2017`](../../content/sources/c/census-cartographic-boundary-states-2017.yaml)),
so they are not copied here.

The regions are the Bureau's administrative areas, not the lands of any
nation. The Navajo Region's outline follows the Navajo Nation's land, as the
Bureau draws it; Trevor chose on 2026-11-21 to draw the official outlines
anyway, with a note on the map saying so.

The "Land areas" view draws the Census Bureau's areas, which Trevor asked for on 2026-11-22 ([decision record 0027](../../docs/decisions/0027-map-adds-census-land-areas.md), amending [0007](../../docs/decisions/0007-map-shows-state-presence.md)). The other views draw no nation's land.

## Refreshing the regions

From `site/`:

```sh
node tools/fetch-bureau-of-indian-affairs-regions.mjs
```

The script downloads the regions, turns the outer rings clockwise (the
service writes them counterclockwise, as GeoJSON does, and d3-geo would read
that as "the whole globe except this region"), simplifies them and records
the date retrieved in the file's `metadata`. Update the source record's
`retrieved` and `history` dates when you run it.

## Refreshing the land areas

From `site/`:

```sh
node tools/fetch-census-land-areas.mjs
```

The script downloads the Census Bureau's file, sorts the areas into kinds by their Census codes, leaves out Hawaiian home lands and pieces under 5 square kilometers (except each area's largest piece), simplifies the rest and records the date retrieved in the file's `metadata`. The shapefile already stores outer rings clockwise, as d3-geo expects. Update the source record's `retrieved` and `history` dates when you run it. To leave an area off the map at a nation's request, add its Census code to `withdrawnLandAreas` in `src/lib/map-geometry.ts`.
