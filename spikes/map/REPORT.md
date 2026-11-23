# Map tool spike: d3-geo vs Observable Plot vs MapLibre vs Leaflet

**Recommendation: build the map with d3-geo at build time.** Use us-atlas TopoJSON for the shapes and the `geoAlbersUsaTerritories` projection from d3-composite-projections so the five territories appear. Write two static SVG files from the same data: one for the website, styled with design tokens, and one for print, with plain gray fills.

The sample passed every check:

- **Print:** it rendered in Typst as pure grayscale.
- **Offline:** it worked offline under a service worker.
- **Interaction:** hover, click and keyboard all worked. A table carries the same data. With scripts off, the map still links to the table.
- **Accessibility:** an automated accessibility scan found no problems in the light or dark theme.
- **Speed:** a build takes about 0.28 s.
- **Browser cost:** the map adds no map library to the browser.

This confirms the earlier recommendation, with two corrections:

- Plain Node cannot import d3-composite-projections 2.0.0 as published, so the build needs a 10-line loader.
- us-atlas's pre-projected file drops the territories.

Observable Plot also works, but it needs jsdom to run at build time, takes 2.5 times as long, and gives less control over links and markers.

MapLibre and Leaflet are more than a state-level map needs. Neither writes a static SVG for the book.

Spike date: 2026-11-21. Run by Claude (AI assistant). Claude built and measured the sample. A Claude sub-agent checked licenses and sources on the web. This report was written from those measurements, the files in `evidence/` and a visual check of the page images.

**Not locked out of drawing nations' land areas later.** The same d3-geo pipeline rendered all 704 areas in the Census Bureau's 2025 American Indian, Alaska Native and Native Hawaiian Areas file. It took 0.5 s and produced about 295 KB gzipped of path data. No boundary layer was built or published; see [Future layer: land areas of nations](#future-layer-land-areas-of-nations).

## What was built

All candidates used the same inputs:

- **Data:** mock records shaped like `schemas/tribe.schema.json` (`id`, `names.official`, `states[].state`, `presence`, `source`) in `src/data/mock-nations.json`. There are nine fictional entries across 13 places, including Alaska, Hawaii, DC, Guam and the Northern Mariana Islands. The Hawaii entry is a Native Hawaiian organization and the territorial entry is a territorial community, never a tribe.
- **Shapes:** us-atlas `states-10m.json`.
- **Projection:** a shared projection in `src/geography.mjs`.

The map shades each state by how many nations list a presence there, in four classes. Places too small to point at get a labeled marker: DC, Rhode Island, Delaware, Puerto Rico, the US Virgin Islands, Guam, the Northern Mariana Islands and American Samoa.

| Candidate | What the spike did |
| --- | --- |
| d3-geo at build time | `src/build-d3.mjs` writes `presence-map.svg` (web), `presence-map-print.svg` (print) and a sample page with a table, a small script, a service worker and a manifest |
| Observable Plot at build time | `src/build-plot.mjs` renders the same map through jsdom, in web and print versions |
| MapLibre GL JS, Leaflet | Not built. Installed to measure bundle size, and read their docs on tiles and export |

## Comparison

| Criterion | d3-geo (build time) | Observable Plot (build time) | MapLibre GL JS | Leaflet | Evidence |
| --- | --- | --- | --- | --- | --- |
| Build time | 0.27 to 0.31 s | 0.69 to 0.75 s | n/a (renders in the browser) | n/a (renders in the browser) | Measured, 5 runs each: `evidence/timing-output.txt` |
| JavaScript sent to the browser | None for the map; the page script is 1.8 KB | None if pre-rendered; 95 KB gzipped to render or show tips in the browser | 276 KB gzipped (5.24.1) plus 10 KB CSS | 42 KB gzipped plus 3.5 KB CSS | Measured with esbuild and gzip -9; sub-agent reported 298 KB plus a 157 KB worker for MapLibre 6.19.0 |
| Build dependencies | d3-geo, d3-path, d3-composite-projections, topojson-client, us-atlas | Same plus @observablehq/plot and jsdom (8.6 MB) | n/a | n/a | Measured: `src/package.json` |
| Web SVG size | 248 KB (94 KB gzipped) | 272 KB | Canvas, no SVG | SVG in the page, not a file | Measured |
| Static SVG for Typst | Yes | Yes | No: WebGL canvas only | No file export | Typst output below; MapLibre and Leaflet docs |
| Territories (PR, GU, VI, MP, AS) | Yes, with `geoAlbersUsaTerritories` | Yes, same projection | Real-world positions; insets need several maps | Same as MapLibre | `evidence/check-site-output.json`; page images |
| Links and keyboard access | Full control: 13 links, one per place listed | `href` channel exists; markers and labels need extra marks | Custom code | Custom code | Measured; analysis |
| Theming with tokens | CSS classes that read custom properties | Passes `var(--token)` through as fill (56 of 56 kept) | Style JSON; tokens need a script to copy them | CSS on SVG paths | Measured for d3 and Plot |
| License | ISC (d3-geo, topojson-client, us-atlas); BSD-3-Clause (d3-composite-projections) | ISC | BSD-3-Clause | BSD-2-Clause | `package.json` of each package; npm registry |

## Checks

### Typst and grayscale print

- **The print SVG works:** `presence-map-print.svg` renders in Typst 0.15.1 on a 6 x 9 in page (`evidence/print-page.png`, `evidence/print-sample.pdf`). It has gray fills set as attributes, black strokes, and text set in Atkinson Hyperlegible Next. The page compiles in 47 to 52 ms.
- **All of it is grayscale:** `tools/measure_pdf_color.py` found one color space in the PDF, ICC-based with one component (gray). Every fill and stroke uses it, and there is no transparency.
- **Neutral grays are what keep it gray.** A control file with one blue rectangle and one gray rectangle produced a three-component (RGB) color space for the blue and a one-component space for the gray.
- **Rule for the real build** (analysis): the print variant must use neutral grays only, or Lulu receives RGB.
- **The web SVG does not work in Typst.** It renders solid black, because its colors live in an external stylesheet and in CSS custom properties.
- **Why it fails:** Typst renders SVG with usvg/resvg 0.47 (Typst `Cargo.toml`). usvg says "CSS support is minimal" and supports static SVG only (usvg README). So the book needs its own SVG file, not the website's.
- **Text size:** in print, the 975-unit map is about 4.6 in wide, so one SVG unit is about 0.34 pt. Labels need font-size 20 or more in SVG units to print at about 7 pt (analysis from the page geometry). The real build could instead draw the legend in Typst and keep the SVG for shapes only.
- **Gray steps:** adjacent classes differ by contrast ratios of 1.67, 2.01 and 2.64 (`evidence/contrast-output.txt`). That is enough to tell four classes apart. With more classes, use hatching or direct labels (analysis).

### Offline, hover and click

Measured with Playwright and Chromium (`tools/check-site.cjs`, output in `evidence/check-site-output.json`):

- **Hover:** hovering Oklahoma shows "Oklahoma: 3 nations (Example Nation C, Example Nation D, Example Nation G)".
- **Click:** clicking Oklahoma fills a details panel with the 3 names and moves focus to it. Clicking the DC marker shows "District of Columbia".
- **Keyboard:** Tab reaches 13 links, one per place that has nations. Enter on Arizona opens its details.
- **Offline:** after the service worker installed, the browser was set offline and reloaded. The map (64 shapes and markers), the table (13 rows), hover and the self-hosted font all still worked. The page made no requests to other hosts.
- **Without scripts:** clicking Oklahoma follows its link to the table row (`#state-OK`), and the 65 `<title>` elements give native tooltips.

### Accessibility

- **The scan:** axe-core 4.11.0, with the WCAG 2.0 and 2.1 A and AA rules plus best practices, found no violations in the light or dark theme.
- **What the scan does not cover** (analysis): it does not test whether map fills contrast with each other. In the web palettes, adjacent fill classes differ by 1.40 to 2.47 (`evidence/contrast-output.txt`), below the 3:1 non-text contrast that WCAG 2.1 asks of graphics needed for understanding (WCAG 2.1, success criterion 1.4.11).
- **How the sample makes up for it:** borders separate states, each shape has a text label in its tooltip, and the full table is linked from the caption. In the real build, either step the palette to 3:1 or keep the table as the primary alternative (analysis).
- **Structure:** the map is an SVG `role="group"` with a `<title>`. The figure caption links to a captioned HTML table with row headers.

### Light and dark themes

- **Tokens:** colors are defined only as CSS custom properties on `:root`. They are redefined under `prefers-color-scheme: dark` and under `[data-theme="dark"]`.
- **Measured:** the Oklahoma fill computes to `rgb(156, 200, 236)` both with the system dark preference and with the theme button (`evidence/check-site-output.json`; `evidence/site-light.png`, `evidence/site-dark.png`).
- **Lightness order:** the dark palette reverses lightness, so "more nations" stays the most prominent color in both themes (analysis).

### Licensing of the boundary data

- **us-atlas** 3.0.1 is ISC licensed. It is "a convenient redistribution of the Census Bureau's cartographic boundary shapefiles, 2017 edition", built from the 1:5,000,000 county, state and nation files (us-atlas README and `prepublish` script).
- **Census terms:** the Census Bureau's file metadata says its boundary files "are not copyrighted" and are "free to use in a product or publication, however acknowledgement must be given to the U.S. Census Bureau as the source" (TIGER/Line 2026 and cartographic boundary 2025 metadata, read from the downloaded `.iso.xml` files). So the book and site must credit the Census Bureau.
- **Display scale:** cartographic boundary files are for "visual display at appropriate small scales only" and should not be shown at scales larger than 1:500,000 (same metadata). A national or state map is well within that.
- **Vintage:** the state lines are 2017. State boundaries rarely change. Updating to a newer Census vintage means building the TopoJSON with the us-atlas recipe; the spike did not do this.

### Build speed

- d3-geo build (SVG, print SVG and page): 0.27 to 0.31 s.
- Observable Plot build: 0.69 to 0.75 s.
- Typst map page: 47 to 52 ms.
- Measured as whole Node processes on this container, 5 runs each (`evidence/timing-output.txt`).

### Corrections to the earlier plan

1. **Territories:** `states-albers-10m.json` (pre-projected) has only 51 features; the territories are gone. `states-10m.json` (not projected) has all
   56. The build must project `states-10m.json` itself (measured).
2. **Packaging:** d3-composite-projections 2.0.0 declares `"type": "module"`, but its `main` is a UMD bundle and its ESM entry uses imports without file extensions, so Node cannot import it directly (measured: `SyntaxError ... does not provide an export named 'geoAlbersUsaTerritories'`). `src/composite-projections-loader.mjs` loads the UMD bundle instead. Vite and Rollup read the `module` field and should not need this (analysis).
3. **Inset layout:** `geoAlbersUsaTerritories` places Guam, the Northern Mariana Islands and American Samoa west of California, and Puerto Rico and the Virgin Islands at the lower right. At page size these are a few pixels across, so markers are needed (page images).

## Future layer: land areas of nations

Trevor does not want boundaries drawn now (decision record 0007), but wants room to add them. He prefers the Census Bureau's American Indian, Alaska Native and Native Hawaiian Areas (AIANNH) data as the source. This spike measured whether that would fit, using `src/future/measure-tribal-areas.mjs`. Nothing from it is committed or published; the output is numbers only.

### What the spike measured

Input: `cb_2025_us_aiannh_500k` (1.5 MB zipped, 704 areas), the newest cartographic boundary vintage (Census cartographic boundary files, 2025 page).

| Measure | Result |
| --- | --- |
| Read the shapefile | 0.09 s |
| Convert to TopoJSON and simplify | 0.25 s |
| Project all 704 areas with the same projection | 0.52 s; 0 areas dropped, Hawaiian home lands included |
| TopoJSON, full detail | 1.17 MB (273 KB gzipped) |
| SVG path data, simplified | 944 KB (295 KB gzipped) |
| Which states each area touches, from the Census 2020 relationship file | 704 areas in 40 states; 28 areas in more than one state |
| Same, by overlaying the geometry on us-atlas states | Matched the relationship file for 665 of 700 areas; it over-counted states along borders because us-atlas lines are simplified |

Source: `evidence/future-tribal-areas-output.json`.

### Fit of each option

| Option | Static national map (site and book) | Zoomable detail on the site | Analysis |
| --- | --- | --- | --- |
| d3-geo | Yes; tested above | Possible with d3-zoom, but SVG slows with thousands of detailed paths | Fits the book and an overview |
| Observable Plot | Yes, same projection | No built-in zoom | Same as d3-geo, with less control |
| MapLibre GL JS | No print SVG | Yes. It reads inline GeoJSON or a GeoJSON URL with no tile server (MapLibre style spec, sources), so a self-hosted file can be cached for offline use | Best tool if a zoomable boundary view is ever wanted |
| Leaflet | No print SVG | Yes, renders GeoJSON as SVG by default (Leaflet reference) | Lighter than MapLibre, slower with many detailed shapes (analysis) |

**Print** (analysis): most of the 704 areas are too small to see on a 6 x 9 in national map. A book layer would need regional insets or a state-by-state series. The Census Bureau also says not to display these files at scales larger than 1:500,000.

### Recommended architecture

These are design choices, not built.

1. **Keep base shapes unprojected.** Use longitude and latitude in `states-10m.json` and one shared projection module. Any later layer (Census areas, court locations) then lines up without reprojecting files. The spike already does this.
2. **Make each map layer a small build module with one shape:**
   - an `id` and `title`;
   - legend entries;
   - either `values_by_state` (choropleth) or `features` (shapes or points);
   - source keys;
   - a `print` variant.

   The state-presence layer is the first module. A Census areas layer would be another one, added without changing the base.
3. **Link nations to Census areas through the tribe profile.** Do not join them automatically. AIANNH codes are Census area codes, not tribe identifiers, and no official crosswalk to the BIA list was found (sub-agent: Census metadata, BIA LAR service, EPA Tribal Identifier standard). Some nations share an area and some have none.

   The tribe profile dataset thread is adding an optional `census_areas` list. Each entry has a Census geographic identifier, a name, an area type and a vintage, plus its own source and confidence (branch `claude/project-thread-264jkh`, not yet merged). The map can read that field directly.
4. **Gate the layer on review status.** Under charter commitment 6, a nation can restrict or withdraw material about it, and restricted material is never served or cached offline (commitment 5). The build should draw only areas linked to a nation whose record is not restricted or withdrawn, and should leave the layer off until consultation under commitment 4 (analysis applying the charter).
5. **Keep the book static.** If a zoomable view is ever needed, add MapLibre for that one website view. Serve a self-hosted GeoJSON or PMTiles file that the service worker caches. Print stays d3-geo SVG (analysis).

### Caveats to state wherever the layer appears

- **Not legal boundaries:** they are "for statistical data collection and tabulation purposes only; their depiction ... does not constitute a determination of jurisdictional authority or rights of ownership or entitlement and they are not legal land descriptions" (TIGER/Line 2026 metadata).
- **Two kinds of area:**
  - *Legal areas:* federal reservations and off-reservation trust land, state reservations, and Hawaiian home lands.
  - *Statistical areas:* Alaska Native village statistical areas, Oklahoma tribal statistical areas, tribal designated statistical areas and state designated tribal statistical areas.
- **Who reports them:** federal reservation and trust land boundaries are as of January 1, 2026, "as reported by the federally recognized tribal governments through the Census Bureau's Boundary and Annexation Survey" (TIGER/Line 2026 metadata).
- **Missing nations:** nations without a land base have no area.
- **Vintage:** each file is dated, updated yearly, and the relationship file is from 2020. 4 areas in the 2025 file are not in it (measured).
- **Credit:** the Census Bureau must be acknowledged as the source.
- **Native Land Digital is not a substitute.** Its About page calls its data CC0. But the Data Sovereignty Treaty required for an API key bars commercial use and storing or redistributing the data without permission (Native Land Digital API docs). It also states that it "does not represent or intend to represent official or legal boundaries". A sold book would need written permission.

## Other state-level layers

All of these use only per-state values, so each fits the layer module above with no boundaries drawn. Source checks are by the sub-agent on 2026-11-21.

| Layer | Source | Ready per state? |
| --- | --- | --- |
| Nations by recognition status (federal, state, other) | Tribe profiles' `recognition` field; BIA Tribal Leaders Directory has `state` and `biaregion` fields ([data.gov](https://catalog.data.gov/dataset/tribal-leaders-directory-14ff5)) | Yes from the dataset. The BIA `state` field is the headquarters only, so a nation in several states counts once |
| Public Law 280 states (mandatory, optional) | [BIA FAQ](https://www.bia.gov/faqs/what-public-law-280-and-where-does-it-apply): mandatory AK, CA, MN, NE, OR, WI; optional AZ, FL, ID, IA, MT, NV, ND, SD, UT, WA | Yes, but later retrocessions need adding |
| Tribal-state gaming compacts | [BIA Office of Indian Gaming compact list](https://www.bia.gov/as-ia/oig/gaming-compacts) (1,196 decisions, filterable by state); [NIGC Gaming Tribes by State](https://www.nigc.gov/download/gaming-tribes-by-state/) | Needs scraping and counting |
| Peacemaking courts and programs | [NARF Indigenous Peacemaking Initiative, tribal peacemaking laws](https://peacemaking.narf.org/models/tribal-peacemaking-laws/) (about 34 laws, listed by tribe) | Needs compiling by state; fits the peacemaking track |
| Tribal-state court forums | [Tribal-State Court Forums: An Annotated Directory, 2nd ed. (2020)](https://www.ojp.gov/library/publications/tribal-state-court-forums-annotated-directory-2nd-edition): 13 states | Yes, but dated 2020 |
| Recognition of tribal court judgments (full faith and credit or comity) | No current national compilation found; Montana legislative memo (2012) and a 2000 survey are the newest | Needs compiling from statutes and court rules; most relevant to an ADR code (analysis) |
| State Indian Child Welfare Act laws | [NICWA](https://www.nicwa.org/state-icwa/) (18 states, updated summer 2025); [NCSL](https://www.ncsl.org/human-services/native-american-children-and-child-welfare-laws) (17, no South Dakota) | Mostly; settle South Dakota |
| State Indian affairs commissions and offices | [NCSL](https://www.ncsl.org/quad-caucus/state-committees-and-commissions-on-indian-affairs) | Rows for all 50 states, undated, some blank |
| Nations whose ADR or peacemaking law the project has collected | The project's own `justice_institutions` and provision records | Grows with the dataset (analysis) |

BIA regions cross state lines; Arizona, for example, is split between the Navajo and Western regions. They are not a clean state-level layer (BIA Tribal Leaders Directory `biaregion` field).

## Limits

- **Mock data only:** with real data, class thresholds and marker placement will need tuning.
- **One browser:** checks ran in Chromium only. Safari and Firefox service worker and SVG focus behavior were not tested.
- **Not a full audit:** the accessibility scan is automated. It is not a screen-reader test.
- **MapLibre and Leaflet were not built.** Their findings come from their docs and measured bundle sizes.
- **Simplification untuned:** the level used for the Census areas test is a placeholder.

## Files

- `evidence/site-light.png`, `evidence/site-dark.png`: sample page; the dark one shows the hover tooltip
- `evidence/print-page.png`, `evidence/print-sample.pdf`: Typst page with the print SVG, plus a control page showing the web SVG rendering black
- `evidence/check-site-output.json`, `evidence/timing-output.txt`, `evidence/contrast-output.txt`, `evidence/pdf-color-output.txt`, `evidence/future-tribal-areas-output.json`
- `src/`: `geography.mjs`, `composite-projections-loader.mjs`, `build-d3.mjs`, `build-plot.mjs`, `site/`, `print/`, `tools/`, `future/`, `data/mock-nations.json`
- To rebuild: see `src/README.md`

## Sources

- us-atlas README and `prepublish` script: https://github.com/topojson/us-atlas
- d3-composite-projections README: https://github.com/rveciana/d3-composite-projections
- Census Bureau TIGER/Line 2026 and cartographic boundary 2025 AIANNH metadata (`tl_2026_us_aiannh.shp.iso.xml`, `cb_2025_us_aiannh_500k.shp.iso.xml`): https://www2.census.gov/geo/tiger/TIGER2026/AIANNH/ and https://www2.census.gov/geo/tiger/GENZ2025/shp/
- Census cartographic boundary files, 2025: https://www.census.gov/geographies/mapping-files/time-series/geo/cartographic-boundary.2025.html
- Census 2020 AIANNH relationship files: https://www.census.gov/geographies/reference-files/time-series/geo/relationship-files.2020.html
- Typst image reference: https://typst.app/docs/reference/visualize/image/ ; Typst `Cargo.toml`: https://github.com/typst/typst/blob/main/Cargo.toml
- usvg README: https://github.com/linebender/resvg/tree/main/crates/usvg
- MapLibre map options and style spec sources: https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapOptions/ , https://maplibre.org/maplibre-style-spec/sources/
- Leaflet reference: https://leafletjs.com/reference-1.9.4.html
- Native Land Digital, About and disclaimers; Data Sovereignty Treaty: https://api-docs.native-land.ca/about-and-disclaimers , https://api-docs.native-land.ca/data-sovereignty-treaty
- WCAG 2.1, success criterion 1.4.11 Non-text Contrast: https://www.w3.org/TR/WCAG21/#non-text-contrast
- Layer sources: linked in the table above
