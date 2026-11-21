---
id: 2026-11-21-dispute-resolution-practice
date: '2026-11-21'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: page-fetch
  name: page fetch (curl with browser user agent)
- kind: web-search
  name: web search
- kind: page-fetch
  name: fetch-and-summarize tool (for sites that timed out or blocked curl)
- kind: other
  name: WordPress REST API (NCORJ)
- kind: other
  name: pdftotext
- kind: other
  name: tesseract OCR for scanned PDFs
- kind: other
  name: python3 -I scripts for parsing, name matching and building the output
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: A research sub-agent searched, opened sources and returned cited facts in the raw file; the
    lead session reviewed the output and built the records.
purpose: 'Find how Native nations use dispute resolution in practice: peacemaking and other forums, published
  provisions, arbitration and waiver clauses, training programs and published materials, from the Native
  American Rights Fund peacemaking project, the National Center on Restorative Justice tribal laws database,
  the National Indian Law Library and nations own court and code sites.'
queries:
- https://peacemaking.narf.org/models/tribal-peacemaking-laws/
- https://peacemaking.narf.org/models/youth-family-peacemaking-laws/
- https://peacemaking.narf.org/models/other-tribal-materials/
- all PDFs linked from those three NARF pages (49 files; scanned ones read by OCR)
- https://peacemaking.narf.org/news-and-events/news/ pages 1-40 and selected posts (trainings, programs)
- https://ncorj.org/wp-json/wp/v2/tribal-law?per_page=100&page=1..10 and all 940 record pages
- https://www.narf.org/nill/triballaw/index.html, all 596 NILL tribe pages, and 189 NILL tribal code table-of-contents
  pages (keyword scan)
- https://www.tribal-institute.org/lists/traditional.htm (TLPI Tribal Court Clearinghouse)
- Navajo Nation Judicial Branch Peacemaking Program (web search); https://courts.navajo-nsn.gov/Peacemaking/Plan/peace.html
- Muscogee (Creek) Nation peacemaking program district court traditional (web search, 3 queries)
- Cherokee Nation OR Eastern Band of Cherokee tribal court peacemaking OR mediation (web search)
- Hopi Tribal Court peacemaker traditional dispute resolution village; Hopi Constitution Article III Section
  2 (web search); https://narf.org/nill/constitutions/hopi/hopi_const_1993.pdf
- Mille Lacs Band Court of Central Jurisdiction Court of Elders (web search); Mille Lacs Titles 5 and
  24 (mlbo.dev, via fetch tool)
- Grand Traverse Band peacemaking program (web search); https://gtbindians.org/tribal_court.asp; https://nnigovernance.arizona.edu/grand-traverse-band-tribal-court
- Puyallup Tribal Court peacemaking OR mediation OR talking circle (web search)
- Tlingit Haida Court of Elders tribal code (web search); https://tlingitandhaida.gov/wp-content/uploads/Title-06-Tribal-Courts-Enacted-2022.03.01.pdf
- White Earth Nation judicial code Panel of Elders (web search); https://www.whiteearth.com/divisions/judicial-services/codes-ordinances
  (15 codes downloaded)
- tribal code arbitration act / limited waiver of sovereign immunity (web search, 2 queries); Little River,
  Pascua Yaqui, Jamestown, Ho-Chunk arbitration codes; LCO and Turtle Mountain waiver sections
- tribe employment code grievance mediation OR arbitration (web search); Stockbridge-Munsee Chapter 53;
  Siletz Community Law Court 2025
- Pechanga tribal court peacemaking court (web search); https://www.mashpeewampanoagtribe-nsn.gov/peacemakers-court-1
- https://ltbbodawa-nsn.gov/judicial-branch/peacemaking/
- state-recognized tribe peacemaking circle OR tribal court OR mediation (web search; nothing found)
- https://www.courts.ca.gov/.../california-tribal-courts-directory (no program descriptions)
sources_added:
- alabama-coushatta-title-2-peacemaker-code
- ccthita-title-06-tribal-courts-2022
- chickasaw-title-5-courts-and-procedures
- chitimacha-title-1a-peacemaker-court
- choctaw-nation-peacemaking-act
- coos-lower-umpqua-siuslaw-ch-2-14-peacegiving-court
- coquille-ordinance-655-peacegiving
- grand-traverse-band-title-10-juvenile-code-415
- ho-chunk-1-hcc-1-judiciary-act
- ho-chunk-2-hcc-13-arbitration
- hopi-constitution-nill
- hopland-title-12-tribal-court
- isleta-resolution-2020-028-peacemaking
- jamestown-sklallam-title-33-youth-code
- jamestown-title-2-arbitration
- kake-keex-kwaan-judicial-peacemaking-code
- kalispel-law-and-order-code-chapter-3-civil-actions
- karuk-tribal-code-chapter-3-05
- kickapoo-traditional-tribe-texas-chapter-4-peacemaker-system
- klamath-title-2-chapter-18-peacemaker-ordinance
- ktoo-tlingit-haida-youth-court-2016
- lco-tct-1-3-030-nill
- leech-lake-judicial-code-title-2-rules
- little-river-900-02-juvenile-code-2011
- little-river-arbitration-code-01-300-02
- little-river-peacemaking-guidelines-2008
- little-traverse-civil-rules-2015
- ltbb-judicial-branch-peacemaking-page
- lummi-title-5-code-of-offenses
- mashantucket-title-1-judiciary
- mashpee-chapter-3-peacemaker-court
- mashpee-peacemakers-court-brochure
- mashpee-peacemakers-court-pages
- mille-lacs-title-24-judicial-proceedings
- mille-lacs-title-5-judicial-branch
- mississippi-choctaw-title-24-peacemaker-code
- narf-ipi-ebci-training-materials-2017-2018
- narf-ipi-news-central-california-training-2026
- narf-ipi-news-choctaw-training-2017
- narf-ipi-news-choctaw-training-2022
- narf-ipi-news-cow-creek-training-2023
- narf-ipi-news-ebci-training-2018
- narf-ipi-news-pokagon-training-2019
- narf-ipi-news-yakutat-training-2019
- narf-ipi-other-tribal-materials
- narf-ipi-tribal-peacemaking-laws
- narf-ipi-youth-family-peacemaking-laws
- national-center-on-restorative-justice-restorative-justice-tribal-laws-database
- national-indian-law-library-code-index-arapaho-wind-river
- national-indian-law-library-code-index-baymillscode
- national-indian-law-library-code-index-bishop-paiute
- national-indian-law-library-code-index-bluelakecode
- national-indian-law-library-code-index-cherokee-nation
- national-indian-law-library-code-index-chickasaw
- national-indian-law-library-code-index-chitimachacode
- national-indian-law-library-code-index-choctaw
- national-indian-law-library-code-index-confederated-chehalis
- national-indian-law-library-code-index-confederated-siletz
- national-indian-law-library-code-index-confederated-umatilla
- national-indian-law-library-code-index-cooscode
- national-indian-law-library-code-index-coquillecode
- national-indian-law-library-code-index-coushatta
- national-indian-law-library-code-index-dry-creek
- national-indian-law-library-code-index-eastern-band-cherokee
- national-indian-law-library-code-index-forest-county-potawatomi
- national-indian-law-library-code-index-fort-mcdowell
- national-indian-law-library-code-index-grand-traverse
- national-indian-law-library-code-index-hochunkcode
- national-indian-law-library-code-index-hoopacode
- national-indian-law-library-code-index-jamestown-sklallam
- national-indian-law-library-code-index-kalispelcode
- national-indian-law-library-code-index-karuk
- national-indian-law-library-code-index-kickapoo-texas
- national-indian-law-library-code-index-klamath
- national-indian-law-library-code-index-lac-du-flambeau-chippewa
- national-indian-law-library-code-index-little-river-band
- national-indian-law-library-code-index-ltraverse
- national-indian-law-library-code-index-mashantucket-pequot
- national-indian-law-library-code-index-menominee
- national-indian-law-library-code-index-mississippichoctaw
- national-indian-law-library-code-index-mohegan
- national-indian-law-library-code-index-muckleshoot
- national-indian-law-library-code-index-native-white-mountain
- national-indian-law-library-code-index-nez-perce
- national-indian-law-library-code-index-nisqually
- national-indian-law-library-code-index-nottawaseppi
- national-indian-law-library-code-index-omaha-of-nebraska
- national-indian-law-library-code-index-osage
- national-indian-law-library-code-index-pascua-yaqui
- national-indian-law-library-code-index-poarchcode
- national-indian-law-library-code-index-ponca-necode
- national-indian-law-library-code-index-port-gamble
- national-indian-law-library-code-index-prairie-band-potawatomi
- national-indian-law-library-code-index-pueblo-laguna
- national-indian-law-library-code-index-redcliffcode
- national-indian-law-library-code-index-reno-sparks
- national-indian-law-library-code-index-rincon-luiseno
- national-indian-law-library-code-index-sac-fox-miss-ia
- national-indian-law-library-code-index-salt-river
- national-indian-law-library-code-index-sauk
- national-indian-law-library-code-index-sault-ste-marie
- national-indian-law-library-code-index-seminole-nation-ok
- national-indian-law-library-code-index-shingle-springs-miwok
- national-indian-law-library-code-index-shoshonearapaho
- national-indian-law-library-code-index-shoshonepaiute
- national-indian-law-library-code-index-skokomish
- national-indian-law-library-code-index-snoqualmie
- national-indian-law-library-code-index-southernute
- national-indian-law-library-code-index-swinomishcode
- national-indian-law-library-code-index-white-earth
- national-indian-law-library-code-index-yurokcode
- navajo-peacemaking-plan-of-operations
- navajo-title-7-courts-and-procedures
- nez-perce-title-1-chapter-1-8-peacemaker-court
- nisqually-title-50-youth-code
- njc-justice-in-a-circle-2016
- nni-honoring-nations-gtb-tribal-court
- northern-arapaho-title-7-peacemaker-code
- oneida-indian-nation-ordinance-o-97-02
- oneida-wi-7-oc-702-divorce
- oneida-wi-7-oc-705-custody
- oneida-wi-8-oc-801-judiciary
- oneida-wi-trial-court-rules
- pascua-yaqui-7-pytc-6-arbitration
- pit-river-title-8-chapter-15-peacemaker-program
- pokagon-native-justice-page
- prairie-band-potawatomi-constitution-2007
- siletz-code-3-300-community-law-court-2025
- skokomish-stc-9-11-sentencing
- snoqualmie-judiciary-act-3-1
- sokaogon-chapter-1-tribal-governance-2011
- spirit-lake-title-21-wodakota
- stockbridge-munsee-chapter-53-employee-rights
- stockbridge-munsee-tct-04-peacemaker-ordinance
- tulalip-tribal-court-elders-panel
- tulalip-tribal-court-juvenile-diversion
- tulalip-tribal-court-mediation-services
- turtle-mountain-7-07-070
- web-search-navajo-peacemaking-2026-11-21
- web-search-tulalip-alternative-court-2026-11-21
- white-earth-judicial-code
- white-earth-juvenile-justice-code
- white-earth-probate-code
- white-earth-title-23-utilities-code
- white-earth-tribal-housing-ordinance-2019
limits: 'Coverage is uneven by design: depth comes from codes on the NARF Indigenous Peacemaking Initiative
  pages and from nations'' own sites; breadth comes from two bulk sources. (1) 940 NCORJ Restorative Justice
  Tribal Laws Database records were turned into dispute-resolution-provision facts automatically; they
  were not reviewed one by one, their kind is assigned from NCORJ''s taxonomy, and many concern restorative
  sentencing, diversion or treatment rather than ADR as such. (2) 131 facts come only from section titles
  in National Indian Law Library tables of contents; the provision text was not read, so they have no
  summary and their kind is assigned from words in the title (watch for ''other'' = generic ''dispute
  resolution'' sections, many in gaming, workers'' compensation and labor codes). Two NARF-linked PDFs
  returned 404 (Colville juvenile peacemaking circle code, Grand Ronde tribal court ordinance 2013), so
  those facts rest on NARF''s summaries. Several codes were scanned images read by OCR (Isleta, Kake,
  Klamath, Leech Lake, Little River guidelines, Oneida NY rules, Snoqualmie, White Earth Judicial Code)
  and the Hopi constitution and White Earth housing ordinance have poor text layers; OCR errors are possible.
  Mille Lacs Titles 5 and 24, the Grand Traverse NNI page, the KTOO Tlingit & Haida article and the NJC
  Pechanga article were read through a fetch-and-summarize tool because direct download failed or for
  speed. Tulalip''s code moved to ecode360, which blocked fetching, so the Tulalip Alternative Court Code
  (Resolution 2024-473) is recorded from a search result only (low). ecode360, yurok.tribal.codes and
  karuk.tribal.codes returned 403; the Pechanga site reset connections; the Ponca (Nebraska) code PDF
  and the Northern Arapaho code page returned 404. Navajo brochure and referral form links are search-only
  (low). No specific peacemaking or ADR program was found for Muscogee (Creek) Nation, Cherokee Nation
  (beyond NILL section titles and NCORJ records), or Puyallup after two or more searches each; that means
  not found, not none. No NAICJA or BJS survey tables were used (no per-nation ADR data located in time).
  No state-recognized nation with a documented ADR practice was found, so no entities were added. Undated
  official web pages are marked low confidence per the contract even when they come from the nation itself.
  Minnesota Chippewa Tribe component bands (Leech Lake, White Earth, Mille Lacs) are recorded under minnesota-chippewa-tribe
  with value.component_band. Extra value keys used beyond the contract: own_term {name, language_tag,
  romanized, translation}, component_band, context_detail, title_as_listed, and NCORJ taxonomy keys on
  bulk records. Language tags were assigned where the source gives a Native-language term but does not
  name the language (each such case is explained in the fact note); ''und'' is used where the language
  could not be identified from the source.'
---

## What was done

Method: (1) Downloaded every code, rule and guide linked from the three NARF Indigenous Peacemaking Initiative model-law pages, extracted text (OCR for scans), and wrote curated forum, provision, material and training facts for each nation, recording Native-language names exactly as printed (for example Nanna alphi’sa ishtaa-asha ikbi, Itti-kāna-ikbi, Gwe-shvt-naga, Wodakota, Mnodaawin, Odenaang Enjinoojimoying, Bekaadziiwiin, Keex’ Kwaan, Haa Dachxanx’i Yan Jeeis, Wunahtyâhe8âôk, hózh̨óji naat’aah). (2) Pulled all 940 NCORJ tribal-law records through the site's REST API, scraped the tribe name from each record page, matched names to roster ids, and turned each record into a provision fact; about 20 records describing distinct programs were also written up as curated forum facts. (3) Read nations' own court pages and codes for nations named as priorities and for the strongest leads (Navajo, Tulalip, Ho-Chunk, Grand Traverse, Little Traverse, Little River, Mille Lacs, White Earth, Hopi, Tlingit & Haida, Siletz, Mashpee, Choctaw nations), upgrading confidence where the nation publishes the same or a newer text. (4) For clauses, read tribal arbitration ordinances and sovereign-immunity waiver sections in commercial, employment, housing and utilities codes (Little River, Pascua Yaqui, Jamestown S'Klallam, Ho-Chunk, Lac Courte Oreilles, Turtle Mountain, Stockbridge-Munsee, White Earth) and added Little Traverse loan statutes whose titles adopt arbitration law. Gaming compacts were left to the gaming helper. (5) Added training facts from NARF news posts and the Little River and Isleta rules. (6) Scanned all NILL tribal code tables of contents for dispute-resolution words to add breadth. The model keeps forum kinds open: besides the suggested values it records an employment tribunal (Prairie Band Potawatomi), village-reserved family dispute authority and a council hearing of inter-village disputes (Hopi), a Court of Elders that mediates by joint consent (Tlingit & Haida), elders panels that advise courts (White Earth, Mille Lacs, Tulalip), agreed arbitration by peacemakers (Siletz, Chitimacha, Northern Arapaho), settlement conferences, and family group conferencing.

## Output

`research/raw/2026-11-21/dispute-resolution-practice.json`: 1236 facts about 179 nations or communities from 145 sources. What the build kept and dropped is in `research/raw/2026-11-21/build-report.json`.

## Review by the lead session

- Source keys were spelled out on import (`nill-` to `national-indian-law-library-`, `ncorj-` to `national-center-on-restorative-justice-`).
- Value keys the schema has no place for (`component_band`, `context_detail`, `title_as_listed`, the restorative justice database's category keys, and `own_term` outside forums) were moved into each fact's note, word for word.
- 6 provisions that repeat a provision already taken from the National Indian Law Library in the justice and law file (same nation, link and title) were dropped. 36 more share a link with that file but name a different section, and were kept.
- 959 provisions come in bulk from the National Center on Restorative Justice database, and 131 come from section titles alone. Nobody has reviewed them one by one. Many cover diversion, treatment or restorative sentencing rather than dispute resolution as such. Their notes say so.
- Forum kinds used here that are not yet method records: restorative-justice, elders-council, mediation-program, family-or-talking-circle, traditional-forum and employment-tribunal.
