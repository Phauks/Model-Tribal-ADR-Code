# 0028. Add a land areas view to the map, from the Census Bureau's boundaries

- **Status:** Accepted (lead author, Nov. 22, 2026)
- **Date:** 2026-11-22

## Context

[Decision record 0007](0007-map-shows-state-presence.md) kept nations' boundaries off the map. On Nov. 21, 2026 the lead author said he did not want boundaries then but did not want to be locked out of them, and preferred the Census Bureau's American Indian, Alaska Native and Native Hawaiian areas as the source when the time came. On Nov. 22, 2026 the website's two maps became one map with views, and the lead author asked for the nations' geographic data as another view, with the source stated and no statement of position added.

## Decision

The map gets a third view, "Land areas". It draws the Census Bureau's 2020 cartographic boundary file of American Indian and Alaska Native areas: federal reservations and off-reservation trust lands, state reservations, and the Census Bureau's statistical areas, each kind in its own shade.[^census] Hawaiian home lands are left out, because they are a State of Hawaiʻi program's lands, not a nation's. The caption and Sources section name the Census Bureau as the source. "Nations by state" stays the first view, and the other views stay as they were.

## Consequences

- Each area links to a table row listing the nations whose entries name that Census area (`census_areas`), so the map is never the only way to the facts.
- A nation's request to leave its area off the map wins (charter commitment 6). `site/src/lib/map-geometry.ts` keeps a list of withdrawn Census codes for that.
- The boundaries are the 2020 vintage and simplified for a national map. A later edition can refresh them with `site/tools/fetch-census-land-areas.mjs`.
- The view is fetched only when a reader opens it, so the map page stays the size it was.

## Sources

[^census]: U.S. Census Bureau, 2020 Cartographic Boundary File, American Indian/Alaska Native/Native Hawaiian Areas, 1:500,000 (source record `census-cartographic-boundary-aiannh-2020`).
