---
id: 2026-11-27-1909-reservations-layer
date: '2026-11-27'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: One session placed the 1909 map's inset panels, added the missing small reservations, warped the scan onto map tiles and built the Map page's layer.
- kind: page-fetch
  name: catalog.archives.gov and gis.blm.gov
  detail: The National Archives' scan of the 1909 map (catalog 655555952) and the Bureau of Land Management's township polygons (PLSS CadNSDI, layer "PLSS Township") for the San Bernardino, New Mexico Principal and Indian meridians.
purpose: 'Trevor approved the mockup of the 1909 layer ("i trust your best judgemnt on this"). Before building it, the coordinator asked for the two inset panels to be placed from their own printed grids and the missing small reservations to be added (research/analyses/2026-11-27-pre-1990-reservation-maps.md, section 8).'
queries:
- The township grid printed in each inset panel, matched to the Bureau of Land Management's townships
- The specks beside reservation names on the Washington coast, in Kansas, Nevada, Arizona and New York
sources_added:
- office-of-indian-affairs-reservations-map-1909
limits: 'Every shape is Unverified. Where neighbors were printed as one piece of brown, the line between them is placed halfway between the 2020 Census areas, not traced. The panels are placed from their township grids: each printed township''s center is paired with the same township''s center in the Bureau of Land Management''s survey, so the panels inherit the grid''s schematic drawing. Kaibab, Shivwits and Camp Verde are printed only as school names in lower-case italic, so they are not added as reservations.'
---

# The 1909 reservations layer: session notes

## The inset panels

There are three panels, not two: "Mission Ind. Res. in California", "Indian Pueblo Grants in New Mexico" and "Northeastern Oklahoma". Each is drawn on the Public Land Survey's township grid and numbers its ranges and townships in its margins. `scripts/maps/oia_1909_reservations.py insets` finds the printed township lines (2.7 to 4.3 pixels root mean square from a straight grid) and pairs the center of every whole township in the panel with the center of the same township in the Bureau of Land Management's survey layer. Left out in turn and predicted from the rest, the township centers miss by 0.37 km (Mission), 0.30 km (Pueblo) and 0.17 km (Northeastern Oklahoma), root mean square. The pairs are in `research/historic-maps/oia-1909/inset-gcps.json`.

The panels add 55 features. Each reading was checked against the 2020 Census area under it, and each panel's patch lands on its present-day reservation. The main map's smaller drawings of the same places (13 patches and nine pieces of the Oklahoma patch) are dropped in favor of the panels' drawings, with the reason in the review table. In the Northeastern Oklahoma panel every reservation is drawn as a brown band around plain paper, the legend's sign for "Opened".

## The small reservations

Eleven points were added by hand from the scan: Quileute, Hoh River, Shoal Water, Chehalis, Squaxin and Nisqually on the Washington coast; Kickapoo and "Sac and Fox and Iowa" in Kansas; Moapa River; Havasupai; and Tuscarora. Where a school or agency symbol covers the speck, the point is the symbol's. The panel's Cosmit speck was added the same way.

## The original map on the website

`scripts/maps/oia_1909_reservations.py warp` warps the scan onto web map tiles: the main map to zoom 9, about its own scale, and each panel over its own ground to zoom 11, as WebP pictures. `site/tools/build-historic-maps.mjs build --only 1909` packs those and the traced layer into two PMTiles files, served from the project's bucket through /map-tiles.

## The layer on the Map page

The Layers list's history section has "Reservations on the 1909 map" (Office of Indian Affairs, 1909), and under it, once the layer is on, "Show the original map". Turning the layer on at Today moves the timeline to 1909. The key adds "Reservation, 1909 map", "Opened, 1909 map" and "Small reservation, 1909 map". A chosen reservation is marked on the map and its details give what the map printed, the nation there today, how a shared line was drawn, the review status and the source, with a link to the National Archives' record. With the original map on, the traced shapes are only outlined in blue so the print shows through. Side-by-side pictures of the approved mockup and the built page are in the project files under `design/historic-maps/oia-1909/compare/`.

Panels' boxes are cut out of the main map's tiles, so a panel's drawing never shows over the main map's ground (the Pueblo panel reaches past the box the extraction skips). The first upload of the picture tiles (`scan-1909-efc0c917deec`) was replaced by `scan-1909-14c9d1a839f4` after that fix; the first file is still in the bucket and can be deleted.
