---
id: 2026-11-22-official-images-second-pass
date: '2026-11-22'
researchers:
- Claude (AI assistant)
tools:
- kind: page-fetch
  name: scripts/tribes/find_official_images.py
  detail: Read again the official websites of the 186 nations that had a website but no image (third argument naming those profiles). 60 sites refused or did not answer the plain reader.
- kind: page-fetch
  name: Playwright with Chromium
  detail: Rendered the same 186 home pages in a headless browser and saved the header and logo images; 181 pages loaded. Also read the terms, copyright and legal pages linked from the chosen nations' sites, and the USPTO record images (tsdr.uspto.gov) for comparison.
- kind: other
  name: Wikidata, English Wikipedia and Wikimedia Commons
  detail: Matched profiles to Wikidata items for federally recognized tribes (by website and name), read the infobox of each matched English Wikipedia article, and listed the files in the Commons categories of official seals, tribal insignia, logos, coats of arms and flags of Native American tribes, three levels down. Wikimedia's file server often refused requests (HTTP 429), so two files could not be downloaded.
- kind: web-search
  name: AI lookup helpers (Claude Haiku)
  detail: Ten helpers searched the web for 281 federally or state-recognized nations. A shared page-fetch limit stopped all of them early, so their results are partial; every lead they gave was downloaded and checked by eye before use.
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: Chose at most one image per nation by eye from contact sheets, compared each with the nation's USPTO tribal insignia entries, and classified every reuse sentence found.
purpose: Find a seal, emblem or logo for every nation that still had no image after the first collection (Trevor Goldsmith, 2026-11-22, "feel free to add all nation logos and seals that are not up yet"), looking first at the nation's own website and then at other reliable copies, and record every reuse signal under the rule in docs/official-images.md.
queries:
- Official websites listed in the profiles (contacts, kind website), read by script and in a browser
- Wikidata items that are instances of federally recognized tribe, with their English Wikipedia articles
- Commons categories Official seals of Native American tribes, North American Tribal Insignia, Logos of Native American tribes, Coats of arms of Native American tribes, Flags of Native Americans in the United States
- Web search for each nation's seal or logo (AI lookup helpers)
sources_added:
- icas-nsn-home-page
- kenaitze-seal-makeover
- navajo-nsn-home-page
- northforkrancheria-nsn-home-page
- piatribal-home-page
- pottervalleytribe-home-page
- rmtlc-chippewa-cree-of-rocky-boy
- sctca-ewiiaapaayp-band-of-kumeyaay-indians
- sctca-inaja-cosmit-band-of-indians
- sherwoodvalleybandofpomo-home-page
- snoqualmietribe-home-page
- southeasternmvskokenation-home-page
- standingrock-home-page
- wikimedia-commons-choctaw-seal
- wikimedia-commons-yuhaaviatam-of-san-manuel-nation-logo
- wikipedia-agua-caliente-band-of-cahuilla-indians-logo
- wikipedia-beaver-creek-indians-official-logo
- wikipedia-natchez-tribe-of-sc-logo
- ypt-nsn-home-page
sources_updated:
- fmyn-home
- kenaitze-indian-tribe-website
- tonkawa-tribe-of-indians-of-oklahoma-home
- tonto-apache-tribe-of-arizona-member-tribes-tonto-apache-tribe
- ute-indian-tribe-of-the-uintah-and-ouray-home
- wichita-and-affiliated-tribes-home
limits: >-
  Most nations without an image are Alaska Native villages whose listed website is a regional consortium's or borough's page, and groups with no website at all; for them nothing usable was found. The AI lookup helpers were cut short, so their part of the search is incomplete. Flags were found on Wikimedia Commons for about a dozen nations but were not used, pending a decision on whether a volunteer's drawing of a flag should stand in for a nation's own image. Copies from Wikipedia and Commons may be redrawings or non-free files that Wikipedia uses under its own fair use policy; the project shows them only under its reuse rule, with their maker and license credited. There was no second reader of the choices.
---

## What was done

At the start, 589 of the 954 nation records had no image: 239 federally recognized nations, and 350 state-recognized, petitioning, territorial and other records, most of them without a website.

The first collection's reader was run again on the 186 nations with a website, and each home page was also rendered in a browser, because 60 sites refuse the plain reader. Wikipedia infoboxes and Wikimedia Commons categories were read for every record that matched an article or a file, and ten AI lookup helpers searched the web for the federally and state-recognized nations. Every candidate was looked at on a contact sheet. Logos of regional consortia (Tanana Chiefs Conference, Kawerak, Bristol Bay Native Association), boroughs (North Slope, Northwest Arctic, Lake and Peninsula), Alaska Native corporations, casinos, state agencies and website builders were rejected, as were maps, photos and header art.

One image was chosen for each of 24 nations (21 federally recognized, 3 state-recognized):

- From the nation's own website (15): Fort McDowell Yavapai Nation, Iñupiat Community of the Arctic Slope, Kenaitze Indian Tribe (the seal shown on its "Seal Makeover" page), Navajo Nation, North Fork Rancheria, Petersburg Indian Association, Potter Valley Tribe, Sherwood Valley Rancheria, Snoqualmie Indian Tribe, Southeastern Mvskoke Nation, Standing Rock Sioux Tribe, Tonkawa Tribe, Ute Indian Tribe of the Uintah and Ouray Reservation, Wichita and Affiliated Tribes, Yerington Paiute Tribe.
- From an intertribal organization's page for the nation (4): Ewiiaapaayp Band and Inaja-Cosmit Band (Southern California Tribal Chairmen's Association), Tonto Apache Tribe (Inter Tribal Council of Arizona), Chippewa Cree Tribe (Rocky Mountain Tribal Leaders Council; the image itself reads "The Great Seal of the Chippewa Cree Tribe of the Rocky Boy's Reservation of Montana").
- From Wikimedia Commons or English Wikipedia (5): Choctaw Nation of Oklahoma (a 2006 drawing of the Great Seal), Yuhaaviatam of San Manuel Nation, Agua Caliente Band of Cahuilla Indians, Beaver Creek Indians and Natchez Tribe of South Carolina. Each record names who made or published the copy in `credit`, and its source record gives the license the file page states.

Two more were found on Wikimedia Commons but could not be downloaded because Wikimedia's file server refused the requests: the Pechanga Band's emblem and the Chuloonawick Native Village seal. They can be added in a later run.

## Reuse signals

No site's terms of use limit reuse of its logo or seal; the only notices were general copyright lines, recorded as `does-not-block`. Seven chosen images are the same as, or similar to, a design the nation filed in the USPTO Native American Tribal Insignia database, so under the project's rule they are recorded as restricted and not shown: Navajo Nation (89003209), Petersburg Indian Association (89003004), Wichita and Affiliated Tribes (89003191, the seal inside the logo), Southeastern Mvskoke Nation (89003203), Choctaw Nation of Oklahoma (89002386), Agua Caliente Band (89001506, and similar to 89001508) and Yuhaaviatam of San Manuel Nation (89003219 and 89003218). Each comparison is written to the entry's `design_compared`.

Result: 17 new images may be shown and 7 are restricted. Across the collection, 389 nations now have an image: 291 with no restriction found, 1 on conditions, 1 needing checking and 96 restricted.

## Search logs

Every one of the 589 nations has a search log under research/search-logs/official-images/, listing each place looked and why it failed (decision record 0025). Nations with no image are `partly-searched`, with next steps.

## Storage

The private copies are filed in the captures under nation-images/<id>/ and uploaded to the private bucket by scripts/tribes/capture_official_images.py, so the Worker serves them without fetching from the nation's site (decision record 0017).
