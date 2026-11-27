# Reservation boundaries before 1990: which old maps exist, who has digitized them, and what a pilot would take

**Status:** research spike, written Nov. 27, 2026, in answer to Trevor's request to "look further into these maps" (the Office of Indian Affairs' *Map showing Indian reservations within the limits of the United States*, the 1980 Census state maps, and any georeferenced or traced versions). Nothing was built and no site, data or bucket was changed. Numbers in brackets point to the Sources list in section 9. "Project analysis" marks my own reasoning or a measurement I made myself. The list of editions, with links, sizes and rights lines, is in `research/reviews/2026-11-27-pre-1990-reservation-maps.csv`.

## 1. Short answer

The map's land layer starts in 1990 because that is the first year the Census Bureau drew reservations digitally (`site/tools/build-historic-maps.mjs`) [25]. Older boundaries exist only on paper, and three paper sources are worth using:

1. **The Office of Indian Affairs' national reservation map.** I found at least 23 editions between 1879 and 1914, scanned by the Library of Congress, the National Archives, the Leventhal Map Center, the University of Michigan, Yale and the University of Oklahoma's law library [1][2][3][5][8][11]. All are works of the United States government, and every holder whose rights line I could read calls them free to use or public domain [1][4][5][8][11][24]. The best scans are 8,000 to 16,000 pixels wide, enough to read every reservation name (project analysis, from the scans I measured).
2. **The 1980 Census state map sets.** Each state's 1980 *General Population Characteristics* report carries a map of "Counties, American Indian Reservations, County Subdivisions ... and Places," drawn on the Geological Survey's 1:500,000 state base [15][16]. The Census Bureau's own scans are online as 400 dots-per-inch black-and-white PDFs [16].
3. **The Bureau of Indian Affairs' 1971 "Indian Land Areas" map**, made with the Geological Survey and called public domain by the University of Michigan, which has a scan [20][21].

Nobody has traced any of these into shapes we can use. One copy of the 1892 edition (Leventhal Map Center) is georeferenced, meaning pinned to real coordinates, but not traced [5][6]. The only traced pre-1990 national boundaries I found are IPUMS NHGIS's 1980 American Indian areas, which may not be redistributed without permission [17], and two Arizona-only datasets from the University of Arizona (1890 and 1980) whose records I could not open [22].

**Recommendation:** a pilot on one edition, the 1909 National Archives copy, which is the sharpest scan I found and whose brown reservation fill a short script already pulled out cleanly (section 5). About one and a half days of work for the first edition, then about half a day for each later one (section 6). If the pilot looks right, add four or five more editions spaced across the years, and treat 1980 separately by starting from the 1990 Census shapes and redrawing only the reservations that changed (section 7).

## 2. The Office of Indian Affairs map, edition by edition

The Office (later Bureau) of Indian Affairs printed a national reservation map, usually bound into the Commissioner's annual report, under slightly different titles from 1879 to at least 1914 [2][3][5]. The University of Oklahoma's copies record the report each came from, for example the 1890 edition in the "Report of the Commissioner of Indian Affairs ... 1890" (Johnson's reference 1890-362) [2]. Leventhal's copies say each was "Detached from Annual reports of the Department of the Interior" for the year before the printing date, so the 1903 map was printed in 1904 [5].

| Editions found | Where | Best scan I measured | Notes |
| --- | --- | --- | --- |
| 1879, 1883 (2), 1885, 1890, 1893 (2), 1895, 1906, 1907, 1909 (2), 1911, 1912, 1914 | National Archives, Record Group 75 [3] | 1909: 15,949 by 10,467 pixels; 1890: 11,064 by 7,589; 1911: 8,183 by 5,489 [3] | The Central Map File copies are the Bureau's own working copies; the 1909 copy has blue-pencil district lines drawn on it (project analysis, from the scan) |
| 1883, 1888, 1892 | Library of Congress [1] | 1888: 13,521 by 8,931; 1883: 12,459 by 7,759; 1892: 10,486 by 6,705 [1] | Already in our bucket since PR #565 [25] |
| 1892, 1903, 1904, 1906 | Leventhal Map & Education Center [5] | 1892: 9,600 by 6,331 [5] | The 1892 copy is flagged georeferenced (section 3) |
| 1892, 1898 | University of Michigan [8] | Not measured (server refused) | Marked "Georeferenced: false" [8] |
| 1883 (west of the 84th meridian), 1884, 1885 (2), 1887, 1889, 1890, 1891, 1892, 1893, 1894, 1895, undated | University of Oklahoma Law Library [2] | Downloads refused | Each tied to its Serial Set report [2] |
| 1909 | Big Ten Academic Alliance Geoportal [9] | Not readable (bot check) | Insets for Mission reservations, Pueblo grants and northeastern Oklahoma [9] |
| 1913 | Yale [11] | Not measured | Catalog box only, not georeferenced [11] |
| 1923 (*Indian reservations west of the Mississippi River*) | Ohio State, Yale [11][12] | Not measured | Scale about 1:3,500,000, "Base map furnished by General Land Office" [12] |

Search results also point to copies at Stanford (1915), the Portal to Texas History, the Smithsonian's National Anthropological Archives and the Alabama Department of Archives and History, and to dealer scans at Geographicus (1885, 1896, 1904); I did not open those [13]. Dealer scans should not be used, since better public copies exist (project analysis).

**Scale.** Leventhal catalogs the 1892 and 1904 editions at about 1:5,800,000 and the 1903 and 1906 editions at about 1:6,000,000 [5]. At that scale one millimeter on the paper is about 6 kilometers on the ground, so a carefully placed line is still only good to a few kilometers, and small reservations (most California rancherias, many in the East) are dots rather than shapes (project analysis). The insets of the Mission reservations in California and the Pueblo grants in New Mexico are drawn at about 1:1,600,000 and 1:2,300,000 [9], which helps there.

**What the map shows.** The 1909 legend separates "Indian Reservation" (solid brown fill) from "Opened" (outline only, for reservations opened to non-Indian settlement), and marks agencies and schools (project analysis, from the scan). The "Opened" outlines matter for the history of allotment and surplus-land sales, and they have to be traced by hand (section 5).

## 3. Has anyone already georeferenced or traced them?

- **Leventhal Map Center, 1892 edition.** The Digital Commonwealth record for the 1892 copy has `georeferenced: true` and a bounding box of roughly 135° W to 58° W and 17° N to 54° N [5]. Leventhal's guide says its older georeferenced maps were made in its Map Warper and can be downloaded as a GeoTIFF or as web tiles from the record's Downloads section, and that its newer work uses Allmaps [6]. The record is not in Allmaps's annotation store (lookup returned "Manifest not found") [7], so it is probably a Map Warper georeference; I could not open the record page to confirm the download, because the site sits behind a bot check [5][6]. A georeference is not a tracing, but it would let us check our own control points (project analysis).
- **Allmaps.** None of the four Leventhal copies or the Michigan 1892 copy has an Allmaps georeference [7]. The Library of Congress copies could not be checked, because loc.gov refused Allmaps's lookup [7].
- **University of Michigan and Yale.** Both say their copies are not georeferenced [8][11].
- **IPUMS NHGIS, 1980.** NHGIS publishes 1980 boundaries for "American Indian Area/Alaska Native Area/Hawaiian Home Land," built by its researchers from the maps in the printed 1980 census reports on top of 2000 TIGER/Line lines [17]. Its terms say "You will not redistribute the data without permission," though it will "consider requests for free and commercial redistribution" [17]. Under our rule that third-party works stay private, we could use it privately to check our own work, or Trevor could ask NHGIS for permission (project analysis).
- **University of Arizona, Arizona only.** Spatial-data portals list "American Indian Reservations, Arizona, 1890" and "American Indian Reservations, Arizona, 1980" from the University of Arizona [22]. Every portal I tried showed a bot check or an error, so I could not read their source, method or license [22].
- **National Atlas.** The National Atlas's "Indian Lands of the United States" layer shows Bureau areas of 640 acres or more [18], but the page was last changed in 2013 and the layer is a modern one, not a pre-1990 one [18]. The 1970 National Atlas maps I could find on Indian subjects are "Early Indian Tribes, Culture Areas, and Linguistic Stocks" and, later, the 1978 "Indian Land Areas Judicially Established" [19]; the first is about homelands before contact, and the second is already on our map as the Indian Claims Commission homelands layer [25]. I did not find a 1970 Atlas page of reservations; the national reservation map of that period is the Bureau's 1971 "Indian Land Areas" [20][21].

## 4. The 1980 Census state maps

For the 1970 census the Bureau of Indian Affairs named 115 reservations, but the census used the boundaries on its own enumeration maps, which "proved to be inaccurate and incomplete" [14]. For 1980 the Census Bureau "worked with the BIA and State certifying officials ... to obtain maps of the reservation boundaries" [14]. For 1990 it "inserted the 1980 census geographic information for American Indian reservations and trust lands ... into the TIGER data base," then had the Bureau of Indian Affairs and the tribes correct it through the Tribal Review Program [14].

That history matters for the work. The 1990 shapes we already have began as the 1980 boundaries, so for most reservations the 1980 boundary is the 1990 one, and only the reservations changed or corrected in the 1980s need redrawing (project analysis, from [14]).

The 1980 report series includes "a special version of the county subdivision map series ... showing American Indian reservation and Alaska Native village boundaries and names," drawn on the Geological Survey's 1:500,000 state maps [15]. The Census Bureau has its 1980 reports online by state; in Arizona's, the reservation maps are PDF pages 62 and 63 of `1980a_azabc-03.pdf`, scanned at 400 dots per inch in black and white, with reservations in screened tints and a latitude-longitude grid around the edge [16]. A screenshot is in the project files (`research/historic-maps/pre-1990-reservations/1980-census-arizona-reservations-page.png`). The Census Bureau also prepared about 84 larger-scale sheets for selected reservations [15], which I did not look for.

## 5. A test on the 1909 edition

To see how much of the tracing a script can do, I ran a short color filter over the National Archives' 1909 scan, keeping pixels of the map's brown reservation fill and turning each patch into an outline (`research/historic-maps/pre-1990-reservations/fill-test.py`) [23]. It found 158 shapes larger than about one millimeter on the paper, with about 3,700 corner points after light smoothing, in under a minute (project analysis). Pictures of the result are in the project files (`1909-fill-test-whole-map.jpg`, `1909-fill-test-north-dakota.jpg`).

What it got right: the solid reservations follow the printed edge closely, for example Fort Berthold, Fort Peck and Turtle Mountain (project analysis, from the test picture).

What it missed or got wrong, and needs a person:

- Reservations shown only in outline ("Opened"), such as Uintah, Wind River and parts of the Sioux lands, are not filled, so the filter skips them (project analysis).
- Agency and school symbols printed on a reservation's edge cut notches into the shape, as at Fort Berthold's southeast corner (project analysis).
- About 230 smaller brown patches were dropped as too small; some are real small reservations and need points instead of shapes (project analysis).
- The insets (California, New Mexico, northeastern Oklahoma) have their own scales and must be georeferenced separately (project analysis, from [9]).

## 6. Effort

All of these are estimates from the test above and from the prior study's 10 to 20 minutes a map for simple georeferencing [25] (project analysis).

| Step | First edition | Each later edition |
| --- | --- | --- |
| Georeference the main map and three insets from graticule crossings (40 to 60 points) | 1.5 to 2 hours | 1 hour |
| Run the fill filter, then fix notches and joined shapes | 2 to 3 hours | 1 to 2 hours |
| Trace "Opened" outlines and add small reservations as points | 2 to 3 hours | 1 to 2 hours |
| Name each shape as printed, and link it to our nation records (a script can suggest the match from overlap with 1990 shapes; a person checks) | 3 to 4 hours | 1 to 2 hours |
| Build the tiles, source record and checks | 2 hours, once | 30 minutes |
| **Total** | **about 1.5 days** | **about half a day** |

Twenty-three editions would be about 12 days, and most of them change little from one year to the next, so a handful spaced across the years gives most of the value (project analysis).

For 1980: matching each state's 1980 map against the 1990 shapes and redrawing only the reservations that differ is about half a day per state with many reservations (Arizona, New Mexico, Oklahoma's Osage, the Dakotas, Montana, Washington, Wisconsin, Minnesota) and less for the rest; I would guess four to six days for all states (project analysis, untested).

Storage is small: the 1909 scan is 27.6 MB [3], and the traced shapes for one edition should be well under a megabyte (project analysis).

## 7. Recommendation and pilot

**Pilot: the 1909 edition from the National Archives (Central Map File 11536 AA)** [3].

- Why this one: it is the sharpest scan found (15,949 pixels wide), it is a federal record with no rights questions, the fill filter already works on it, and 1909 sits in the middle of the allotment era, when reservations changed fastest (project analysis).
- What the pilot delivers: one GeoJSON of the 1909 reservations (shapes, plus points for the small ones), each with the name as printed, its "Reservation" or "Opened" status, and a suggested link to a nation; one source record for the scan; and a side-by-side picture of the traced shapes over the scan and over the 1990 Census shapes, so Trevor can judge the fit before anything goes on the site.
- How it would show on the map: as its own layer named for its maker and year ("Office of Indian Affairs, 1909"), following the "just cite the source" rule for land areas, and never mixed into the Census layer (project analysis, from [25]). The year slider would show an edition only for years near it, so 1950 would not quietly show 1909's boundaries; how near is a design choice for the mockup (project analysis).
- Checks: compare our georeference against Leventhal's 1892 georeference if its GeoTIFF can be downloaded [6], and spot-check a few reservations whose boundaries have not changed since 1909 against the 1990 shapes (project analysis).

**If the pilot works**, add 1883 and 1888 or 1892 (Library of Congress, already in our bucket) [1], 1923 (*west of the Mississippi*, larger scale) [12], and the 1971 Bureau map [21], then do 1980 state by state.

**Not recommended:** asking NHGIS for redistribution rights before the pilot. It would only cover 1980, and the 1980 Census maps are public domain and line up with the 1990 shapes we already serve (project analysis, from [14][16][17]).

## 8. Care

Reservation boundaries are public, but these maps print names given by the Office of Indian Affairs, some of which nations do not use today; the layer should show the printed name as a quotation of the source, beside the nation's own name (project analysis). The National Archives' Central Map File also holds allotment maps naming individuals [25]; the national maps in this note name no individuals (project analysis, from the 1909 scan), so they need no hold. A nation may still ask to withdraw a layer about it [25].

## 9. Sources

1. Library of Congress item records: 1883, https://www.loc.gov/item/2009579475/ (pixel size from `site/geography/historic-map-scans.json`); 1888, https://www.loc.gov/item/2009579476/ and 1892, https://www.loc.gov/item/2009579467/ (read Nov. 27, 2026: notes, "1 map : col. ; 53 x 84 cm," rights line "free to use and reuse," JPEG 2000 13,521 by 8,931 and 10,486 by 6,705 pixels). The Library's search and the resource page `g4051e.mf000045` refused requests that day.
2. University of Oklahoma College of Law Digital Commons, American Indian and Alaskan Native Documents Maps and Illustrations, https://digitalcommons.law.ou.edu/maps/ (index pages read; 16 reservation maps listed; item pages 2 and 20 read for source report and Johnson's reference; file downloads returned an error page).
3. National Archives Catalog, search for "indian reservations within the limits," https://catalog.archives.gov/ (Nov. 27, 2026: 23 results, 15 of them editions of this map, listed in the CSV); scans of 437015503, 655555952 and 353144530 downloaded and measured.
4. DocsTeach, "Map Showing Indian Reservations Within the Limits of the United States, 1911," https://docsteach.org/document/map-indian-reservations-within-us-1911/ (rights: "Public Domain, Free of Known Copyright Restrictions"; National Archives Identifier 353144530, CMF 9003).
5. Digital Commonwealth records for the Leventhal copies, https://www.digitalcommonwealth.org/search/commonwealth:js957749v.json, `...:7d27cg28q.json`, `...:gf06jr87c.json`, `...:gb19hw10q.json` (read: dates, scales, "Detached from Annual reports of the Department of the Interior," rights "No known copyright restrictions," license "No known restrictions on use," `georeferenced_bsi` true for js957749v only); image sizes from https://iiif.digitalcommonwealth.org/iiif/2/commonwealth:js957750m/info.json and the other three. The Leventhal portal pages themselves showed a bot check.
6. Leventhal Map & Education Center, "Georeferenced Map Collections," https://cartinal.leventhalmap.org/guides/lmec-dc-geo.html; "Improved features for georeferencing in our digital collections portal" (Oct. 30, 2023), https://www.leventhalmap.org/articles/new-features-for-georeferencing-in-lmec-collections; "Georeferencing," https://leventhalmap.org/projects/digital-projects/georeferencing (read through a fetch tool: Map Warper-era downloads "Downloads → GeoTIFF"; Allmaps now built in).
7. Allmaps Annotations API, `https://annotations.allmaps.org/?url=<manifest>` for the four Leventhal manifests and the Michigan 1892 manifest (each "Manifest not found"); Library of Congress manifests returned "Forbidden." Checked Nov. 27, 2026.
8. AGSL GeoDiscovery (University of Wisconsin-Milwaukee), records for the Michigan copies, https://geodiscovery.uwm.edu/catalog/5544e954-910e-4635-8587-518cbe537336 (1892) and https://geodiscovery.uwm.edu/catalog/298fa907-caec-44fe-a6c8-010d034fbea0 (1898) (read: "Georeferenced: false," rights "No copyright," NoC-US).
9. Big Ten Academic Alliance Geoportal, 1909 edition, https://geo.btaa.org/catalog/p16022coll230:1318 (page metadata only, read through a fetch tool: "Map originally bound in: Annual report of the Department of the Interior"; inset scales).
10. California State University, Monterey Bay, Hornbeck Collection, 1883 and 1888 and 1892 editions, https://digitalcommons.csumb.edu/hornbeck_ind_2/6/, https://digitalcommons.csumb.edu/hornbeck_ind_2/7/, https://digitalcommons.csumb.edu/hornbeck_usa_1/22/ (read: source "Library of Congress"; 17.7 MB and 10.7 MB downloads), so these are copies of the Library's scans.
11. Yale University Library GeoBlacklight, https://geoblacklight.library.yale.edu/catalog/bibid-9440336 (1913) and https://geoblacklight.library.yale.edu/catalog/bibid-4933023 (1923), raw records read: references only to the catalog, no georeferenced file, rights "Public."
12. MIT GeoData record of Ohio State's copy, "Indian reservations west of the Mississippi River," 1923, https://geodata.libraries.mit.edu/record/gisogm:edu.osu:10b8d4374f77 (read: scale, base map note, NoC-US).
13. Web search results not opened: Stanford 1915 (https://geodata.lib.berkeley.edu/catalog/stanford-sz226kb1842), Portal to Texas History (https://www.texashistory.unt.edu/ark:/67531/metapth41363/), Smithsonian (https://www.si.edu/object/archives/components/sova-naa-xxxx-0155-ref5571), Alabama (https://alabamamosaic.org/vufind/Record/ADAHmaps783), Geographicus (https://www.geographicus.com/P/AntiqueMap/indianreservations-atkins-1885).
14. U.S. Census Bureau, *Geographic Areas Reference Manual*, ch. 5, "American Indian and Alaska Native Areas," https://www2.census.gov/geo/pdfs/reference/GARM/Ch5GARM.pdf (read: "The 1970 Census," "The 1980 Census," "The Tribal Review Program for Reservations and Trust Lands").
15. Donna M. Dixon, *1980 Census Mapping Products*, Auto-Carto 5 proceedings, https://cartogis.org/docs/proceedings/archive/auto-carto-5/pdf/1980-census-mapping-products.pdf (read: "American Indian Reservation Map Series," about 84 sheets; county subdivision map series on the 1:500,000 base; special version with reservation boundaries).
16. U.S. Census Bureau, *1980 Census of Population*, vol. 1, Arizona, https://www2.census.gov/library/publications/decennial/1980/volume-1/arizona/1980a_azabc-03.pdf (opened: PDF page 62, "Counties, American Indian Reservations, County Subdivisions (Census County Divisions), and Places—Section 1"; images 3,478 by 5,647 at 400 dots per inch, black and white).
17. IPUMS NHGIS, "Data Availability," https://www.nhgis.org/data-availability (GIS file table: American Indian areas marked for 1980); "GIS Files," https://www.nhgis.org/gis-files (section "1980 and Earlier Boundaries Based on 2000 TIGER/Line Files"); "IPUMS NHGIS Terms of Use," https://www.nhgis.org/ipums-nhgis-terms-use (redistribution sentence quoted).
18. National Atlas, "Indian Lands of the United States," archived at https://webarchive.library.unt.edu/web/20140922235413/http://nationalatlas.gov/mld/indlanp.html (read: "areas of 640 acres or more"; last modified May 30, 2013).
19. U.S. Geological Survey, Rocky Mountain Mapping Center, "Indian Lands Maps," archived at https://webarchive.library.unt.edu/eot2008/20090109035542/http:/rockyweb.cr.usgs.gov/outreach/lewisclark/indianlandsmaps.html (read: four maps and their scales).
20. Bureau of Indian Affairs, press release, "New Indian Land Areas Maps Help Tourists, Industrialists, Interested In Indians" (Sept. 15, 1972), https://www.bia.gov/as-ia/opa/online-press-release/new-indian-land-areas-maps-help-tourists-industrialists-interested.
21. MIT GeoData record of Michigan's copy, "Indian lands and related facilities as of 1971," https://geodata.libraries.mit.edu/record/gisogm:edu.umich:cbad253cd8ae (read: "Compiled by the Bureau of Indian Affairs in cooperation with the Geological Survey"; "This map is in the public domain").
22. Search results for "American Indian Reservations, Arizona, 1890," https://geo.nyu.edu/catalog/uarizona-arizona-amerindianreservations-1890, and "... 1980," https://geodata.mit.edu/catalog/uarizona-arizona-amerindianreservations-1980 (records not readable: bot checks or errors at NYU, Berkeley, MIT, Texas).
23. Project test, `research/historic-maps/pre-1990-reservations/fill-test.py` in the project files, run on the National Archives 1909 scan (identifier 655555952) on Nov. 27, 2026.
24. 17 U.S.C. § 105 (no copyright in works of the United States government).
25. Project files: `site/tools/build-historic-maps.mjs`; `research/analyses/2026-11-26-historic-maps-of-indian-lands.md` (georeferencing estimate, allotment-map care, nation withdrawal); `docs/roadmap.md` Parked research; project memory on map decisions.
