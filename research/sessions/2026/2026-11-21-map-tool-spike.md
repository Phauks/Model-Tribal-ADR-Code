---
id: 2026-11-21-map-tool-spike
date: 2026-11-21
researchers: [Lead author, Claude (AI assistant)]
tools:
  - kind: ai-assistant
    name: Claude (AI assistant)
    detail: Built and measured the sample maps; a sub-agent read library docs, licenses and data sources.
  - kind: web-search
    name: Web search tool
  - kind: page-fetch
    name: Web page fetch tool
  - kind: other
    name: npm registry and package files
    detail: Versions, licenses and bundle sizes of d3-geo, d3-composite-projections, us-atlas, Observable Plot, MapLibre GL JS and Leaflet.
  - kind: other
    name: Census Bureau file server (www2.census.gov)
    detail: Downloaded cb_2025_us_aiannh_500k and the 2020 AIANNH-to-county relationship file; read the metadata of these and of tl_2026_us_aiannh.
purpose: Compare tools for the state-presence map, check print, offline, accessibility, theming, licensing and build speed, and check that a later Census tribal areas layer would fit.
queries:
  - us-atlas license and source edition; territories in states-10m
  - d3-composite-projections geoAlbersUsaTerritories
  - Census Bureau TIGER/Line and cartographic boundary terms of use
  - Typst SVG support (usvg, resvg)
  - MapLibre GL JS sources without a tile server; Leaflet SVG renderer
  - Census AIANNH files, relationship files, BIA tribe crosswalk
  - Native Land Digital API terms and Data Sovereignty Treaty
  - State-level layers - Public Law 280, gaming compacts, peacemaking laws, tribal-state court forums, state ICWA laws, Indian affairs commissions
sources_added: []
limits: >-
  No source records were added; the spike report cites URLs directly and the
  sources become records if the map is built. Census terms were read from file
  metadata, not a general policy page. MapLibre and Leaflet were measured and
  read about but not built. The NIGC 2025 tribes-by-state list was seen only in
  a search snippet. Typst, npm and Census pages were read by a sub-agent; some
  pages were read through GitHub mirrors.
---

Findings and measurements are in `spikes/map/REPORT.md`. Result: d3-geo at build time with us-atlas and `geoAlbersUsaTerritories`, a separate grayscale SVG for print, and an architecture that leaves room for a Census American Indian, Alaska Native and Native Hawaiian Areas layer without building it.
