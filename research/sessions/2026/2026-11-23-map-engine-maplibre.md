---
id: 2026-11-23-map-engine-maplibre
date: 2026-11-23
researchers: [Lead author, Claude (AI assistant)]
tools:
  - kind: ai-assistant
    name: Claude (AI assistant)
    detail: Measured the sizes of the Census Bureau's land areas, compared four map tools from their pricing, terms and documentation, built a demo with MapLibre GL JS, and built the website's map tiles with tippecanoe and the pmtiles tool.
purpose: >-
  Find out why many nations barely show on the website's map and whether another map tool, including Google Maps, would show them, as the lead author asked on 2026-11-23.
queries: []
sources_added:
  - census-cartographic-boundary-states-2020
  - protomaps-basemap-openstreetmap
limits: >-
  Sizes are measured from the Census Bureau's 1:500,000 cartographic file, which is itself simplified; the full-detail TIGER/Line file would give slightly different areas. Prices and terms are as read on the date above and change over time.
---

Findings:

- Of the 629 land areas drawn on the map (704 in the file, less Hawaiian home lands), 293 cover less than 25 square kilometers, 152 less than 5 and 63 less than 1; half cover less than 31. Blue Lake Rancheria and Off-Reservation Trust Land covers 0.34 square kilometers. Measured with d3-geo and @turf/area from cb_2020_us_aiannh_500k.
- The drawn map zooms at most 8 times (16 in the "Land areas" view). At 8 times, one screen pixel of the map page is still about 1 kilometer, so areas under about 1 square kilometer are less than a pixel wide.
- Google Maps Platform: Dynamic Maps are free for 10,000 loads a month, then $7.00 per 1,000 up to 100,000 (Google, Google Maps Platform pricing). Free usage caps per product replaced the $200 monthly credit on March 1, 2025 (Google, billing overview). The Service Specific Terms forbid removing or obscuring Google's attribution and allow caching only what they name, mainly place IDs.
- Protomaps: a full world basemap is about 120 GB for zooms 0 to 15; the pmtiles tool cuts a region and zoom range from it. Dry runs against the 2026-11-22 build: the United States and territories (geography/map-tile-region.json) take 446 MB to zoom 10, 956 MB to zoom 11 and 2.2 GB to zoom 12. The basemap is an Open Database License produced work needing OpenStreetMap attribution. Cloudflare caches tiles served from a Worker only on a custom domain, not on workers.dev (Protomaps, Cloudflare integration).
- Cloudflare R2: $0.015 per GB-month past a free 10 GB-month; reads free up to 10 million a month. The project's bucket held 11.2 GB on 2026-11-23, so new files are billed from the first GB.
- Compressed sizes from npm: maplibre-gl 5.24.1 is 276 KB of script and 10 KB of stylesheet; leaflet 1.9.4 is 42 KB; pmtiles 4.5.0 is 8 KB.
