---
id: 2026-11-24-nill-gateway-remaining
date: '2026-11-24'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: page-fetch
  name: scripts/review/nill_gateway_fetch.py (one page at a time, 6 seconds apart, each page once, robots.txt obeyed)
  detail: Read the 138 National Indian Law Library Tribal Law Gateway pages listed as not read in research/nill-coverage/gateway-nations.csv. Every page returned 200; the library showed no refusal or challenge.
- kind: other
  name: scripts/review/nill_gateway_apply.py
  detail: Parsed the Tribal Code, Tribal Constitution, Tribal Court Opinions and Contact Info blocks, added listed links to profiles the way the Nov. 21 session did, wrote source records, governance search log entries and research/reviews/2026-11-24-nill-gateway-remaining.json and .csv.
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: Wrote the scripts, matched the 7 pages the name match missed and the 4 that matched two profiles by hand, and reviewed every listing that was not a NILL table of contents.
purpose: 'Continue the Nov. 24, 2026 NILL coverage spike (research/analyses/2026-11-24-national-indian-law-library-coverage.md, PR #471): read the 138 Tribal Law Gateway pages the project had not recorded, record their constitution, code and court listings with links, and log empty results, without the frequent or systematic requests NILL refuses.'
queries:
- https://narf.org/robots.txt
- https://narf.org/nill/tribes/<slug>.html for the 138 slugs with read_by_project = no (spaces and apostrophes in three slugs percent-encoded)
sources_added:
- national-indian-law-library-accohannock
- national-indian-law-library-affiliated-ute
- national-indian-law-library-agdaagux
- national-indian-law-library-alturas
- national-indian-law-library-asacarsarmiut
- national-indian-law-library-augustine-cahuilla
- national-indian-law-library-beaver-village
- national-indian-law-library-berry-creek
- national-indian-law-library-big-pine
- national-indian-law-library-big-sandy
- national-indian-law-library-birch-creek
- national-indian-law-library-bridgeport-paiute
- national-indian-law-library-brothertown
- national-indian-law-library-cabazon-mission
- national-indian-law-library-cahuilla-band
- national-indian-law-library-california-valley-miwok
- national-indian-law-library-campo-band
- national-indian-law-library-cayuga-nation
- national-indian-law-library-cedarville
- national-indian-law-library-chalkyitsik
- national-indian-law-library-cheeshna
- national-indian-law-library-chickahominy-eastern
- national-indian-law-library-chickahominy
- national-indian-law-library-chicken-ranch
- national-indian-law-library-chignik-bay
- national-indian-law-library-chignik-lake
- national-indian-law-library-chinik
- national-indian-law-library-cloverdale
- national-indian-law-library-cold-springs-rancheria
- national-indian-law-library-cortina
- national-indian-law-library-cow-creek-umpqua
- national-indian-law-library-coyote-valley
- national-indian-law-library-duwamish
- national-indian-law-library-eastern-pequot
- national-indian-law-library-eklutna
- national-indian-law-library-elk-valley
- national-indian-law-library-enterprise-rancheria
- national-indian-law-library-ewiiaapaayp-kumeyaay
- national-indian-law-library-fort-independence
- national-indian-law-library-fort-sill
- national-indian-law-library-grindstone-rancheria
- national-indian-law-library-guidiville-rancheria
- national-indian-law-library-gulkana
- national-indian-law-library-haliwa-saponi
- national-indian-law-library-holy-cross
- national-indian-law-library-igiugig
- national-indian-law-library-iipay-santa-ysabel
- national-indian-law-library-inaja-diegueno
- national-indian-law-library-ione-miwok
- national-indian-law-library-iqurmuit
- national-indian-law-library-ivanoff
- national-indian-law-library-jackson-rancheria
- national-indian-law-library-jamul
- national-indian-law-library-jena-choctaw
- national-indian-law-library-kaguyak
- national-indian-law-library-kaktovik
- national-indian-law-library-king-salmon
- national-indian-law-library-knik
- national-indian-law-library-koi-nation
- national-indian-law-library-kokhanok
- national-indian-law-library-la-jolla-luiseno
- national-indian-law-library-la-posta-diegueno
- national-indian-law-library-levelock
- national-indian-law-library-lone-pine
- national-indian-law-library-los-coyotes-band
- national-indian-law-library-lytton-rancheria
- national-indian-law-library-manley-hot-springs
- national-indian-law-library-manzanita
- national-indian-law-library-mcgrath
- national-indian-law-library-mechoopda
- national-indian-law-library-middletown-rancheria
- national-indian-law-library-mission-creek
- national-indian-law-library-modoc-oklahoma
- national-indian-law-library-mooretown-rancheria
- national-indian-law-library-naknek
- national-indian-law-library-nansemond
- national-indian-law-library-nanticoke-delaware
- national-indian-law-library-nanticoke-lenni-lenape
- national-indian-law-library-native-afognak
- national-indian-law-library-native-akutan
- national-indian-law-library-native-brevig-mission
- national-indian-law-library-native-cantwell
- national-indian-law-library-native-chignik-lagoon
- national-indian-law-library-native-council
- national-indian-law-library-native-eek
- national-indian-law-library-native-ekwok
- national-indian-law-library-native-georgetown
- national-indian-law-library-native-goodnews-bay
- national-indian-law-library-native-larsen-bay
- national-indian-law-library-native-marys-igloo
- national-indian-law-library-native-nightmute
- national-indian-law-library-native-ouzinkie
- national-indian-law-library-native-teller
- national-indian-law-library-native-unga
- national-indian-law-library-newhalen
- national-indian-law-library-nipmuc-tribe
- national-indian-law-library-northfork-rancheria
- national-indian-law-library-northwestern-shoshone
- national-indian-law-library-onondaga
- national-indian-law-library-pamunkey
- national-indian-law-library-paskenta-california
- national-indian-law-library-pauloff
- national-indian-law-library-pechanga-california
- national-indian-law-library-picayune-rancheria
- national-indian-law-library-pilot-station
- national-indian-law-library-pinoleville-pomo
- national-indian-law-library-portage-creek
- national-indian-law-library-potter-valley
- national-indian-law-library-qawalangin
- national-indian-law-library-ramona-band
- national-indian-law-library-rappahannock
- national-indian-law-library-redwood-valley
- national-indian-law-library-robinson-rancheria
- national-indian-law-library-saint-francis-abenaki
- national-indian-law-library-san-pasqual
- national-indian-law-library-santa-rosa-cahuilla
- national-indian-law-library-santa-rosa-community
- national-indian-law-library-santa-ynez
- national-indian-law-library-scotts-valley
- national-indian-law-library-seldovia
- national-indian-law-library-sherwood-valley
- national-indian-law-library-shinnecock
- national-indian-law-library-skagway
- national-indian-law-library-snoqualmoo
- national-indian-law-library-soboba
- national-indian-law-library-table-mountain
- national-indian-law-library-takotna
- national-indian-law-library-tejon
- national-indian-law-library-tonawanda
- national-indian-law-library-torres-martinez
- national-indian-law-library-traditional-togiak
- national-indian-law-library-tuscarora
- national-indian-law-library-united-auburn
- national-indian-law-library-village-iliamna
- national-indian-law-library-village-salamatoff
- national-indian-law-library-village-sleetmute
- national-indian-law-library-wampanoag-gay-head
- national-indian-law-library-yocha-dehe
limits: 'Links were recorded as NILL lists them and were not opened, so their verification is title-only; NILL''s table-of-contents pages were not fetched again (profiles already held 35 of the 42 such links from the Nov. 21 session). Pages that point only to NILL''s catalog (27) were not followed: the catalog shows a CAPTCHA to scripts. Other legal materials (a gaming compact, a recognition petition, a state executive order, decisions and orders) were left out as not constitutions, codes or courts. Wayback captures were not made: the cloud session cannot reach web.archive.org, and the archive catch-up job adds them later.'
---

# Remaining National Indian Law Library Gateway pages: session notes

The research note [National Indian Law Library: how much of it we cover](../../analyses/2026-11-24-national-indian-law-library-coverage.md) counted 138 Gateway pages as never read. The Nov. 21 session had in fact fetched all 596 pages, but it kept source records only for pages that produced facts of their own: 126 matched pages listed nothing usable apart from NILL tables of contents, which it recorded under separate `national-indian-law-library-constitution-*` and `national-indian-law-library-code-*` sources. Those pages were not saved, so this session read them again.

## How the pages were read

One page at a time, six seconds apart, each fetched once, under an honestly named user agent, after reading robots.txt (which allows the pages). The fetch script stops at the first 403, 429 or challenge page; none came. The saved pages stay in a private work folder and are not redistributed.

## What they list

- 34 pages list a constitution or code with a link: 47 links, 42 of them to NILL's own table-of-contents pages. Profiles already held 35 of the 47 links. The 11 new links went to 9 nations, all state-recognized or not federally recognized groups (Affiliated Ute Citizens, Brothertown, Eastern Pequot, Haliwa-Saponi, Missisquoi St. Francis-Sokoki, Nanticoke Lenni-Lenape, Nipmuc, Chaubunagungamaug Nipmuck, Snoqualmoo).
- 104 pages list nothing with a link. 27 of them point only to NILL's catalog for a print copy, mostly of a constitution. Augustine Band's page says its ordinances are available only to its members and that it has no tribal court (as of March 2017). The Mission Creek page is an unfilled template.
- One Contact Info block names a tribal court (Holy Cross); the profile already lists it.
- Tribal Court Opinions blocks point only to Westlaw or VersusLaw, so nothing was recorded from them.

## Matching

Seven pages had no profile by name match and were matched by hand; four name matches that found two profiles were narrowed (Tuscarora to the New York nation from the page's address, Northfork to the federally recognized rancheria, Mission Creek to the Band) or split by link (the Nipmuc page lists both the Nipmuc Nation's and the Chaubunagungamaug Band's constitutions). The reasons are in `MATCHES` and `LINK_NATIONS` in `scripts/review/nill_gateway_apply.py`. The profiles `missisquoi-st-francis-sokoki-band` and `st-francis-sokoki-band-of-abenakis-of-vermont` described the same group, so the second was merged into the first: the federal petitioner #68, the St. Francis/Sokoki Band of Abenakis of Vermont, gave its address as Swanton, Vermont, in care of April Merrill (Final Determination, 72 FR 36022, July 2, 2007, read on govinfo.gov); the Abenaki Nation of Missisquoi in Swanton lists April St. Francis/Rushlow/Merrill as its chief from 1996 to 2012 (abenakination.com/abenaki-chiefs); and the Vermont Commission on Native American Affairs names the band Vermont recognized on May 7, 2012 under 1 V.S.A. § 856 as the Abenaki Nation at Missisquoi (vcnaa.vermont.gov/recognition/recognized-tribes). The old profile's names, recognition entries and searches moved to the surviving profile, and its old page address redirects there through the new `former_ids` field.

## Counts

`python3 scripts/analysis/national_indian_law_library_coverage.py --gateway-only` refreshed `research/nill-coverage/gateway-nations.csv` and the Gateway totals in `counts.json` without fetching anything: all 596 pages are now read and matched; 343 list a constitution (305 of those nations have documents in the governing documents index) and 294 list a code (271 have code text captured).
