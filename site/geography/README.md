# Map shapes

Boundary files the website's map reads when the site is built
(`src/lib/map-geometry.ts`). Nothing here is served to readers as a file; the
build turns it into SVG paths.

| File | What it is | Source |
| --- | --- | --- |
| `bureau-of-indian-affairs-regions.json` | The twelve Bureau of Indian Affairs regions, as TopoJSON, simplified to about 3 percent of the points for a national map | U.S. Department of the Interior, Bureau of Indian Affairs, Branch of Geospatial Support, "BIA Regions" feature service (source record [`bia-regions-2026`](../../content/sources/b/bia-regions-2026.yaml)) |

State and territory outlines come from the `us-atlas` package (the Census
Bureau's 2017 cartographic boundary files; source record
[`census-cartographic-boundary-states-2017`](../../content/sources/c/census-cartographic-boundary-states-2017.yaml)),
so they are not copied here.

The regions are the Bureau's administrative areas, not the lands of any
nation. The Navajo Region's outline follows the Navajo Nation's land, as the
Bureau draws it; Trevor chose on 2026-11-21 to draw the official outlines
anyway, with a note on the map saying so. No other nation's land is drawn
([decision record 0007](../../docs/decisions/0007-map-shows-state-presence.md)).

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
