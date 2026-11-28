---
id: 2026-11-28-colonial-era-maps-collection
date: '2026-11-28'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: One session extended site/tools/collect-historic-maps.mjs with `--only colonial`, chose the Library of Congress maps by title searches and their item records, and ran the tool.
- kind: page-fetch
  name: publications.newberry.org and loc.gov
  detail: The Newberry Library's U.S. historical counties file (generalized), and the Library of Congress's item records and JPEG 2000 scans for the nine maps in research/reviews/2026-11-28-colonial-era-maps-library-of-congress.csv.
purpose: 'Trevor asked for map data before 1783, back to 1492 if possible ("first settlers"), and after the research note research/analyses/2026-11-27-colonial-era-maps-1492-1783.md said "lets bring in these maps". This session collected the sources the note ranks first and second: the Newberry Library''s colonial counties from 1629 and Library of Congress maps from 1624 to 1776. The note''s third and fourth sources, Royce''s map of Cherokee cessions (1884) and the U.S. Geological Survey''s map of Indian tribes, cultures and languages (1967), were already collected on Nov. 26, 2026.'
queries:
- The Newberry Library's US_AtlasHCB_Counties_Gen001.zip
- 'Library of Congress map searches (dates 1492 to 1800): "former territorial limits of the Cherokee", "boundary line Indians Fort Stanwix 1768", "proclamation 1763", "southern Indian district", "Mitchell British and French dominions 1755", "Evans middle British colonies 1755", "Indian boundary line 1770", "Catawba deerskin map", "Chickasaw map 1723", "Indian nations 1771"'
- The item record and every JPEG 2000 scan for each map in research/reviews/2026-11-28-colonial-era-maps-library-of-congress.csv
sources_added:
- newberry-atlas-historical-counties
limits: 'The Library of Congress search turns away fast requests, so only ten searches were run and several found nothing (the Fort Stanwix line of 1768, the Chickasaw map of 1723, a 1771 Indian nations search); maps titled without the searched words are missed, and no map from before 1624 was kept. Several kept maps are British commercial maps that show colonial claims as their makers saw them, not as Native nations held their lands. The county file leaves out the vaguely bounded seventeenth-century areas of western Virginia, New York and New England and areas under foreign governments, so Spanish and French colonies are missing. Nothing here is georeferenced or drawn on the website''s map yet.'
---

# Colonial-era maps collection: session notes

## What was collected

`node tools/collect-historic-maps.mjs fetch --only colonial` downloads the Newberry Library's U.S. historical counties (one zip file, 53,391,588 bytes) and only the Library of Congress maps not yet in `site/geography/historic-map-scans.json`; `build`, `upload` and `index` with the same option add them beside the 59 maps collected on Nov. 26, 2026, leaving those entries and their index rows as they were.

## Results

The county file holds 17,727 county shapes from March 4, 1629 (the Massachusetts Bay charter) to December 31, 2000; 1,160 began before September 3, 1783, in the thirteen colonies and the early states, the Vermont Republic and the Erie Triangle. Each carries its start and end dates, the change and the Atlas's citation.

Nine Library of Congress maps were kept, with 12 images (278.7 MB with the JPEGs and thumbnails); all carry the Library's general rights line ("free to use and reuse unless a Rights Advisory statement is present") and are served:

- John Smith and William Hole, *Virginia* (1624, sixth state).
- *Map of the several nations of Indians to the Northwest of South Carolina* (1724): a copy of a Native-made map, copied, the Library's note says, "from a draught drawn & painted on a deer skin by an Indian Cacique and presented to Francis Nicholson"; the British Library calls it "sometimes known as the 'Catawba Deerskin Map'". It should be offered to the Catawba Indian Nation with its page.
- Lewis Evans, *A general map of the middle British colonies* (1755), which names "the country of the confederate Indians" and "the antient and present seats of the Indian nations".
- John Mitchell, *A map of the British and French dominions in North America* (1755, first Dutch edition, four sheets lacking).
- Thomas Kitchin, *A new map of the British Dominions in North America* (1763), the governments "settled by Proclamation, October 7th 1763".
- Robert Sayer, *An accurate map of North America* (1763), after the Treaty of Paris.
- Carington Bowles, *North America, and the West Indies* (1774), with an "Extract of the treaties of peace, proclamations &c."
- Jonathan Carver, *A new map of the Province of Quebec, according to the Royal Proclamation* (1776).
- Bernard Romans and others, *A general map of the southern British colonies* (1776), "with the neighboring Indian countries".

## On the website

The nine maps join the Historic Maps collection and open in the image viewer as the site's own copies. The county file is kept in the bucket and listed as a copy; it is not drawn on the Map page.

## For later

A county layer from 1629 and the Map page's year slider extended before 1783 wait for a mockup and Trevor's approval. Tracing the Proclamation line of 1763 and the treaty lines of 1768 to 1775 from these maps, georeferencing Royce's Cherokee map, and a points layer of European posts and missions from 1492 also wait. The copyright of Paullin and Wright (1932) and Friis (1940, 1968) is still unchecked.
