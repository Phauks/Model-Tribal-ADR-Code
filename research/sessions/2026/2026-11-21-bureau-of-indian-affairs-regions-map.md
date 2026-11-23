---
id: 2026-11-21-bureau-of-indian-affairs-regions-map
date: 2026-11-21
researchers: [Lead author, Claude (AI assistant)]
tools:
  - kind: ai-assistant
    name: Claude (AI assistant)
    detail: Searched for an official source of the regions' boundaries, queried it, simplified the shapes and built the website's map.
  - kind: web-search
    name: Web search
purpose: >-
  Add the Bureau of Indian Affairs regions to the website's map, from an
  official boundary source, and build the map itself, which until now existed
  only as the map tool spike.
queries:
  - Bureau of Indian Affairs regions boundary GIS dataset BIA regional offices polygon download
sources_added:
  - bia-regions-2026
  - census-cartographic-boundary-states-2017
limits: >-
  The regions are drawn from a copy simplified to about 3 percent of the
  service's points, enough for a national map and not for any closer look.
  The outlines come from the Bureau's file and the state lines from the
  Census Bureau's 2017 file, so their coastlines and shared edges differ
  slightly. The service does not say when the boundaries were last changed.
---

Findings:

- The Bureau of Indian Affairs publishes its region boundaries itself, as the "BIA Regions" feature service of its Branch of Geospatial Support (biamaps.geoplatform.gov, BOGS/BIA_Regions), also listed on data.gov ("BIA Regions", catalog.data.gov/dataset/bia-regions). A copy of the same layer appears in an EPA service ("BIA Tribes (2 of 5): Bureau of Indian Affairs Regional Boundaries"); the Bureau's own service was used instead.
- The service returned 12 polygons whose names match, exactly, the 12 region names that the Tribal Leaders Directory gives the 575 federally recognized nations in the dataset (measured: Alaska 224, Pacific 105, Northwest 45, Western 42, Eastern 35, Midwest 30, Southern Plains 24, Southwest 24, Eastern Oklahoma 20, Great Plains 16, Rocky Mountain 9, Navajo 1).
- The Navajo Region's outline follows the Navajo Nation's land and leaves the Hopi Tribe's land as a gap. The lead author chose on 2026-11-21 to draw the Bureau's official outlines anyway, with a note on the map that the regions are the Bureau's administrative areas, not nations' lands. No other nation's land is drawn (decision record 0007).
- The service writes outer rings counterclockwise (GeoJSON, RFC 7946); d3-geo needs them clockwise, so `site/tools/fetch-bureau-of-indian-affairs-regions.mjs` turns them (measured: unturned, every region covered the whole globe).
- Google's documented Maps URL for a search (`https://www.google.com/maps/search/?api=1&query=…`, Google Maps Platform, "Get started with Maps URLs") is used for address links; it needs no key.
