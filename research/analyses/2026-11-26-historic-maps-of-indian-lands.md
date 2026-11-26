# Historic maps of Indian lands: what exists, how big it is, and how it would fit the site

**Status:** research spike, written Nov. 26, 2026, in answer to Trevor's question "Should we grab historic map data and historic maps of Indian land and reservations?" and his follow-up "Also estimate size." Nothing was built and no site or content was changed. Numbers in brackets point to the Sources list in section 8, which marks what I read or counted directly. "Project analysis" marks my own reasoning or estimate from those numbers. Counting was done with short scripts against each source's own catalog; no subagents were needed because no counts disagreed.

## 1. Short answer

Yes, and most of it is cheap. The two sources that matter most are small vector datasets, and every source worth hosting is a United States government work the project may serve under its standing hosting rule. The large one, the National Archives' Bureau of Indian Affairs maps, costs about $4.50 a month even if we kept all of it, and it is better collected nation by nation.

| Source | Items | Size (raw) | Size (web tiles) | License and hosting | Script? | Joins to |
| --- | --- | --- | --- | --- | --- | --- |
| Royce, *Indian Land Cessions in the United States* (1899), maps | 67 maps plus the 480-page volume [1] | 136 MB as service images (JPEG 2000); about 2.8 GB as master TIFFs; volume PDF 146 MB [1][2] | About 150 MB | Public domain; serve our own copy [1] | Yes | Treaties, nations, map |
| Forest Service tracing of Royce's cessions | 718 cession polygons, 725 table rows [3] | 8 MB GeoJSON | About 5 MB | U.S. government work; serve our own copy [3][4] | Yes | Treaties (464 of 718 by date), nations (188 of 275 names exactly), map |
| Census Bureau American Indian areas, by year | 22 national vintages: 1990, 2000, and every year 2007-2026 [5] | About 190 MB (8-9 MB a year) [5] | 12 MB a year today; about 40 MB for all years if merged with year ranges, 260 MB if kept apart | Public domain; we already serve 2020 | Yes | Nations (`census_areas`), map |
| Bureau of Indian Affairs Land Area Representations | 335 land areas plus 30 Oklahoma statistical areas; current only, no past years [6] | 21 MB GeoJSON | About 10 MB | "Public information" [6]; serve our own copy | Yes | Nations, regions, map |
| Library of Congress, digitized maps on Indian lands | 87 found by title search (1736-2003) [7] | About 1 GB as JPEG 2000; about 17.6 GB as master TIFFs [7] | About 1 GB | Mostly public domain; check each item's rights line | Yes, slowly | Nations, treaties, image viewer; map only after georeferencing |
| National Archives, Bureau of Indian Affairs maps (Record Group 75) | 12,142 online map descriptions, about 11,700 of them land maps [8] | About 150 GB of land maps (JPEG) [8] | About 150 GB more if every map were tiled | Federal records, "Unrestricted" [8]; serve our own copy, but allotment maps name individuals (section 6) | Yes | Nations, image viewer; map only after georeferencing |
| Native Land Digital | Worldwide territories, languages and treaties | Not stored | Not stored | Its Data Sovereignty Treaty forbids storing or redistributing without permission [9] | Not allowed | Link only |
| David Rumsey Map Collection | Large private collection | Not stored | Not stored | Creative Commons license; reuse limited [10] | Not needed | Link only |

**Storage and cost.** R2 standard storage costs $0.015 per GB-month (infrequent access $0.01), with free egress [11]. The table's sources come to three steps (project analysis):

| Step | What it holds | R2 storage | Monthly cost |
| --- | --- | --- | --- |
| A. Vector layers | Forest Service cessions, Census vintages, Bureau of Indian Affairs land areas, raw and tiled | About 0.5 GB | Under $0.01 |
| B. Royce and Library of Congress scans | Service images, the Royce volume, and tiles | About 2.6 GB | About $0.04 |
| B+. Master TIFFs for step B | Archival copies | About 20 GB more | About $0.31 (standard) or $0.20 (infrequent access) |
| C. National Archives land maps | All about 11,700, with tiles | About 300 GB | About $4.50 (about $3.75 with originals on infrequent access) |
| All of it | | About 325 GB | About $4.90 |

Reads are cheap too: R2 includes 10 million reads a month free and charges $0.36 per million after that [11], and a map scan served as one PMTiles file costs one read per tile shown.

**Recommendation (project analysis).** Do step A now: it is small, public domain, scripted, and joins straight to our treaty and nation records. Do step B next, with the Royce maps first, because each Royce map is keyed to the treaties on our pages. Treat step C as a collection to draw from nation by nation, not a bulk copy.

## 2. Correcting the first list

The first list of candidates came from memory. Three points changed when checked.

The Bureau of Indian Affairs Land Area Representations are current only. The Bureau's service holds one set of 335 areas, with no past years, and calls itself "strictly for illustrative and reference purposes" [6]. Yearly boundaries come from the Census Bureau alone, and its online files reach back to 1990 for the cartographic file and to 2000 and 2007-2026 for the full files [5].

A traced version of Royce already exists. The Forest Service's Office of Tribal Relations scanned, georeferenced and traced all 67 Royce maps into 718 cession polygons, each with Royce's cession number, the cession dates, links to Royce's schedule and to Kappler, the map it comes from, and the present-day nations named in the Federal Register list [3][4]. That saves the hardest work.

Native Land Digital's own pages disagree with each other. Its "About and Disclaimers" page says the data "can be considered under a CC0 license" [9], but the API now needs a key, and getting one means agreeing to its Data Sovereignty Treaty, which says users must not "Store or distribute API data without explicit permission from Native Land Digital" and must not "Modify or alter Indigenous land boundaries without direct consultation" [9]. The later and more specific terms govern (project analysis), so the site should link to it, as first proposed.

## 3. Each source

### 3.1 Royce's maps and schedule

Royce's work is the second part of the Bureau of American Ethnology's Eighteenth Annual Report (1899), U.S. Serial Set number 4015, also printed as House Document No. 736, 56th Congress, 1st Session. The Library of Congress describes it as "sixty-seven maps and two tables compiled by Charles C. Royce," and the Schedule of Indian Land Cessions covers every cession or reservation "from the organization of the Federal Government to and including 1894" [1]. The Library marks it "in the public domain and ... free to use and reuse" [1].

I counted 67 map images in the Library's maps-only copy, totaling 136 MB as JPEG 2000 service files; each is about 4,256 by 3,297 pixels [2]. A Library master TIFF of the same pixel size runs about 42 MB [7], so all 67 masters would be about 2.8 GB (project analysis). The full volume as one PDF is 146 MB [2].

**Joining.** Royce numbers each cession, and each map shows those numbers. The Forest Service tracing (section 3.2) carries the same numbers, so a scan, its traced polygons and its schedule entry share one key.

### 3.2 The Forest Service tracing

The Forest Service map service holds 718 cession polygons and a 725-row table [3]. Its metadata says the 67 maps "have been scanned, georeferenced in JPEG2000 format, and digitized to create this feature class," georeferenced against the National Atlas [4]. As a U.S. government work it is free to reuse; its use note says only that it is "for informational purposes only" and "not legal documents" [4]. I downloaded all 718 polygons as GeoJSON (8 MB).

**Joining (counted against our data).** Of the 718 polygons, 716 carry a cession date, and 464 have a date that equals the signing date of one of our 370 ratified treaties, which covers 236 of those treaties (`research/raw/2026-11-23/treaties.json`). Most of the rest should be Acts, executive orders and agreements, which the tier 1 work is adding (project analysis). The polygons name 275 distinct present-day nations; 188 of those names match a nation profile's official name exactly, reaching 186 profiles. The other 87 are older Federal Register spellings (for example "Kiowa Indian Tribe of Oklahoma") and a few non-federal groups, which a short alias list can match. 466 polygons link to Kappler's text at HathiTrust, which can be swapped for our own treaty pages.

Whether the Forest Service's georeferenced Royce scans can be downloaded I could not confirm; if not, the 67 Library of Congress scans can be georeferenced from the traced polygons' corners (project analysis).

### 3.3 Census Bureau American Indian areas

The Census Bureau's TIGER/Line folder holds a national American Indian, Alaska Native and Native Hawaiian areas file for every year 2010-2026, each 8.0 to 8.8 MB zipped, a 2000 file (8.3 MB), state files for 2007-2009, and a 1990 cartographic file (0.4 MB) [5]. All are public domain. We already turn the 2020 cartographic file into an 11.9 MB tile set (decision record 0028; `site/geography/map-tiles.json`).

**Joining.** Every file uses the same area code (the AIANNH code) that our profiles already record in `census_areas`, so each year's outline lands on the right nation without matching names (project analysis). Most areas do not change from year to year, so one tile set with a "from year" and "to year" on each shape would be far smaller than one set per year.

### 3.4 Bureau of Indian Affairs land areas

The Bureau's service has 335 land areas (reservations and trust land, with acreage and region) and 30 Oklahoma "Tribal Statistical Areas" drawn from 1867-1870 descriptions [6]. The Bureau says "These data are public information and may be used by various organizations," and also that "No legal inference can or should be made" from them [6]. It is the Bureau's own record, so it is a useful second outline beside the Census one, but it is not historic. We already draw the Bureau's regions from the same server (memory: map notes).

### 3.5 Library of Congress

A keyword search of the Library's online maps (seven searches: Indian reservation, Indian lands, Indian Territory, Indian land cessions, Indian agency, Indian tribes, Indian country) found 281 maps, of which 87 are about Indian lands by title; they are listed in `research/reviews/2026-11-26-historic-maps-library-of-congress.csv` [7]. They include the Office of Indian Affairs' "Map showing Indian reservations within the limits of the United States" in several editions (1883, 1888, 1892), the 1923 "Indian Reservations west of the Mississippi River," reservation allotment maps, and many Indian Territory maps. The real number is higher, because the search API matches titles loosely and slows down after a few requests (project analysis).

In a sample of six, the service JPEG 2000 averaged 11.7 MB and the master TIFF 202 MB [7], so the 87 come to about 1 GB of service images or 17.6 GB of masters (project analysis). Most are public domain, but each item states its own rights, so a script should read and record that line.

### 3.6 National Archives, Record Group 75

The National Archives catalog lists 13,189 map descriptions in Record Group 75 (Bureau of Indian Affairs), 12,142 of them online [8]. Its search stops at 10,000 results, so I read those 10,000 and scaled up. They hold 21,123 files, but 367 descriptions (5,157 files, 96 GB) are building plans for schools and hospitals, not land maps. The other 9,633 land-map descriptions have 15,966 files; the catalog gives real sizes for 6,310 of them (29.3 GB) and a placeholder for the rest, and a random sample of 40 of those measured 10.0 MB on average. That puts the sample's land maps at about 126 GB and all of them at about 150 GB (project analysis). The series are in `research/reviews/2026-11-26-historic-maps-national-archives-series.csv`; the biggest are the Central Map File (6,216 in the sample), maps of reservations made for irrigation (1,267), railroad right-of-way maps (659), allotment maps (648) and "Maps of Indian Lands and Reservations" (146).

The records checked were marked "Unrestricted" [8], and federal records are public domain. The catalog's search can be read by script without a key, gently.

### 3.7 Other leads, not counted

The Bureau of Land Management's General Land Office records hold the survey plats of reservation townships, and the U.S. Geological Survey's historical topographic maps show reservation lines from the 1880s on; both are government works and could feed later passes (memory, not checked today). The Indian Claims Commission's map of land areas it found to be aboriginal title belongs with tier 2 (memory, not checked today).

## 4. What the map block needs for historic layers

This is a list for a later build, not a design; the current map is described in decision record 0039 and the map notes.

1. A "Historic" group in the Layers menu, separate from the base pictures, with each layer labeled by its maker and year (for example "Bureau of American Ethnology, 1899").
2. A year control for vector layers. With "from year" and "to year" on each shape, MapLibre can filter one tile set by year, which serves both the Census vintages and the Royce cessions (whose dates run 1784-1894).
3. A raster overlay with an opacity slider for georeferenced scans, built as one PMTiles file per scan.
4. Serving through our own site. A historic scan must come from our R2 copy through `/map-tiles/`, the same way satellite imagery does, so no third party such as the Library of Congress sees where a reader looks (decision record 0039). The Library's own image server must not be called from the map.
5. Side-column details for a cession: Royce number, date, the treaty or Act as a link to our law page, and the present-day nations as links to their pages.
6. Withdrawal. The withdrawn-areas list (`site/geography/withdrawn-land-areas.json`) needs to cover cession polygons and scans too, and the tile build must honor it (charter commitment 6).
7. Print and no-WebGL fallback. Vector cessions can be drawn by the existing drawn map; a raster scan should print as the scan itself, not as tiles.
8. Building. Vector layers use the existing tippecanoe path in `tools/build-map-tiles.mjs`. Scans need GDAL to warp and cut them, which the build does not have today, and each scan not already georeferenced needs ground control points set by a person, roughly 10 to 20 minutes a map (project analysis). That makes georeferencing the 87 Library maps about a day of work, and all 11,700 National Archives maps impractical; those belong in the image viewer instead.

On nation pages, the same data could fill a "Land cessions" section (a small map and a list of cessions linking to treaties), and on treaty pages, a map of the land ceded (project analysis).

## 5. Where it would join our records

| Our record | Historic data that joins | Key |
| --- | --- | --- |
| Treaty and law pages | Royce cessions | Cession date to signing date (464 of 718 today); Royce number |
| Nation pages | Royce cessions; Census vintages; Bureau land areas; scans of the nation's reservation | Federal Register name (188 of 275 exact); AIANNH code; Bureau area id; title words |
| Shared map block | All vector layers; georeferenced scans | Tile sets in `map-tiles.json` |
| Image viewer and Source Documents | Library of Congress and National Archives scans | One source record per map, with a SHA-256 hash like every download |

## 6. CARE context

The project's charter adopts the CARE Principles (Collective benefit, Authority to control, Responsibility, Ethics) [12]. For historic maps they mean (project analysis):

**These are the government's maps.** Royce, the Office of Indian Affairs and the General Land Office drew land as the United States took it, in the names it used. A map of a cession records a transfer the government made, not a nation's own understanding of its territory. Trevor chose, for the Census land areas, to "just cite the source" with no stance text (map notes, Nov. 22, 2026). Labeling each historic layer with its maker and year does the same job here. Whether historic layers need more than that is Trevor's call.

**Restricted places.** Land-use, irrigation and survey maps can mark burial grounds, sacred sites and gathering places. Those are restricted material under charter commitment 5 and should not be published without the nation's approval, so a person should look at each National Archives map before it goes public.

**Individual people.** Allotment maps and plats name individual allottees, and many allotments are still held in trust by their heirs (memory, not checked against these maps). Like the Tribal court opinions with children's names, allotment maps should start private and be offered to the nation first (charter commitment 4).

**Authority to control.** A nation may withdraw any layer or scan about it, and the build must honor that (charter commitment 6). Native Land Digital, which is Indigenous-led, asks that its data not be stored or altered, so the site links to it instead.

**Collective benefit.** Nations, their lawyers and researchers use these maps in land claims, boundary disputes and repatriation work; one place that ties each map to the treaty and the nation, with free downloads, serves them (project analysis).

## 7. Next steps if Trevor says go

1. Step A: a script that downloads the Forest Service cessions, the 22 Census vintages and the Bureau land areas into the private bucket, builds one historic vector tile set, and adds source records. About half a day (project analysis).
2. Match the 87 unmatched Federal Register names, and link cessions to Acts, orders and agreements as tier 1 adds them.
3. Mockups of the Historic layer group, the year control and the nation-page "Land cessions" section, approved before building, and the built pages checked side by side against them.
4. Step B: copy the 67 Royce scans and the volume, georeference them, then the 87 Library of Congress maps.
5. Step C: pull National Archives maps nation by nation as nation pages are worked on, holding allotment maps back.

## 8. Sources

1. Library of Congress, *Indian land cessions in the United States* (1899), item record, https://www.loc.gov/item/13023487/ (read Nov. 26, 2026: notes, rights line "The contents of this collection are in the public domain and are free to use and reuse," three resources: maps-only copy with 67 files, Serial Set 4014 with 675 files, Serial Set 4015 with 480 files).
2. Library of Congress image server, maps-only copy `g3701em.gct00002`, https://www.loc.gov/resource/g3701em.gct00002/ (counted: 67 JPEG 2000 files, 136 MB together; `info.json` for map 10 gives 4,256 by 3,297 pixels); volume PDF https://tile.loc.gov/storage-services/public/law/llss4015/llss4015.pdf (146,279,607 bytes, read from the server's header).
3. U.S. Forest Service, "Indian Land Cessions in the United States" map service, https://apps.fs.usda.gov/arcx/rest/services/EDW/EDW_TribalCessionLands_01/MapServer (counted: layer 0 has 718 features, table 2 has 725 rows; all 718 downloaded and compared with project data). Listed on Data.gov as "Tribal Lands Ceded to the United States (Feature Layer)," https://catalog.data.gov/dataset/tribal-lands-ceded-to-the-united-states-feature-layer.
4. U.S. Forest Service, metadata for `S_USA.TRIBALCEDEDLANDS`, https://data.fs.usda.gov/geodata/edw/edw_resources/meta/S_USA.TRIBALCEDEDLANDS.xml (read: abstract, purpose, use constraints).
5. U.S. Census Bureau, TIGER/Line and cartographic boundary folders, https://www2.census.gov/geo/tiger/ (counted: `TIGER2010`-`TIGER2026/AIANNH/` national files 8.0-8.8 MB each; `TIGER2010/AIANNH/2000/` 8.3 MB; `TIGER2007FE`-`TIGER2009` by state; `PREVGENZ/aianhh/ir/ir99_d90_shp.zip` 389 KB).
6. Bureau of Indian Affairs, Division of Land Titles and Records, map services `BIA_AIAN_National_LAR`, `BIA_AIAN_Tribal_Statistical_Areas` and `BIA_AIAN_LAR_Supplemental`, https://biamaps.geoplatform.gov/server/rest/services/DivLTR (read descriptions; counted 335, 30 and 9 features; downloaded 16.4 MB and 4.7 MB GeoJSON).
7. Library of Congress maps search, https://www.loc.gov/maps/ (seven keyword searches, 281 maps, 87 kept by title, Nov. 26, 2026; file sizes read from six item records, for example https://www.loc.gov/item/99446198/). List: `research/reviews/2026-11-26-historic-maps-library-of-congress.csv`.
8. National Archives Catalog, Record Group 75, type "Maps and Charts," https://catalog.archives.gov/ (counted through the catalog's own search: 13,189 descriptions, 12,142 online, 11,685 at item level; the first 10,000 read in full; 40 placeholder-sized files measured from the server's header; records checked show use restriction "Unrestricted"). Series list: `research/reviews/2026-11-26-historic-maps-national-archives-series.csv`. Background: National Archives, *Guide to Federal Records*, Record Group 75, https://www.archives.gov/research/guide-fed-records/groups/075.html.
9. Native Land Digital, API documentation, https://api-docs.native-land.ca/ : "Data Sovereignty Treaty" (sections 1-3 quoted), "About and Disclaimers" (CC0 sentence), and "Get and use your API key" (key needs agreement to the treaty). Read Nov. 26, 2026.
10. David Rumsey Map Collection, "Copyright and Permissions," https://www.davidrumsey.com/about/copyright-and-permissions (read: "This work is licensed under a Creative Commons License"; credit line; rights holders' permission needed for works not in the public domain).
11. Cloudflare, R2 pricing, https://developers.cloudflare.com/r2/pricing/ (read: storage $0.015 per GB-month standard, $0.01 infrequent access; Class B $0.36 per million; free tier 10 GB-month and 10 million Class B reads; egress free).
12. Project charter, `docs/charter.md`, commitments 1 and 4 to 6; decision records 0028 and 0039; project memory map notes.
