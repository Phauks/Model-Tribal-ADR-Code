# 0033. Give the map on each nation's page the big map's views

- **Status:** Accepted (lead author, Nov. 22, 2026)
- **Date:** 2026-11-22

## Context

[Decision record 0007](0007-map-shows-state-presence.md) kept nations' boundaries off the map, and the small map on each nation's page showed only the states where sources record a presence. It left out the nation's Bureau of Indian Affairs region on purpose: the Navajo Region's outline follows the Navajo Nation's land, so on that nation's page it would draw the nation's land. [Decision record 0028](0028-map-adds-census-land-areas.md) then added a "Land areas" view to the big map, drawn from the Census Bureau's 2020 boundaries, with the source stated and no statement of position added.

On Nov. 22, 2026, while the nation page was being rebuilt as a reference page, the lead author asked that the map on a nation's page "be able to toggle like the big map, so you can see other stuff", and that "At a glance" say which Bureau of Indian Affairs region the nation is in.

## Decision

The map in each nation's "At a glance" box gets the big map's views, shown as tabs: **States** (the existing view, and the first), **Region** (the nation's Bureau of Indian Affairs region, outlined among its neighbors and named on the map) and **Land areas** (the Census Bureau's 2020 areas whose codes the nation's record lists, under `census_areas`). A view appears only when the record has what it needs: a cited region for Region, a matching Census area for Land areas. "At a glance" also has a row that names the region in full, "Bureau of Indian Affairs region", links it to the regions view of the big map and names the agency that serves the nation.

This amends 0007 for the nation page only. The Region view can show the shape of a nation's land where a region's outline follows it, as the Navajo Region's does, and the Land areas view shows the Census Bureau's areas for the nation, as 0028 allows on the big map. Each view's caption names its source and says the outlines are simplified, and the Land areas caption says they are not a statement of the nation's own boundaries.

## Consequences

- Each view is a tab in the WAI-ARIA tabs pattern. Without scripts all the views show one after another, each under its own caption.
- The outlines of states are written into the page once and shared by the views, so three views do not triple the map's size.
- A nation's request to leave its land area off the map wins, as under 0028 (charter commitment 6); the same list of withdrawn Census codes applies to its page.
- The page's Sources section lists the Bureau of Indian Affairs regions file and the Census Bureau's boundary files under "Map" whenever a view uses them.

## Sources

The lead author's request is in the project thread for the nation page review, Nov. 22, 2026. The region outlines come from the Bureau of Indian Affairs' BIA Regions layer on its geoplatform, and the land areas from the U.S. Census Bureau, 2020 Cartographic Boundary File, American Indian/Alaska Native/Native Hawaiian Areas, 1:500,000 (source record `census-cartographic-boundary-aiannh-2020`).
