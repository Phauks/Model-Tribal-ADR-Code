---
id: 2026-11-21-nations-contiguous-m-z
date: '2026-11-21'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: other
  name: python requests + BeautifulSoup bulk crawl (read only)
- kind: other
  name: regex snippet extraction and manual review
- kind: web-search
  name: WebSearch
- kind: page-fetch
  name: WebFetch (for sites that returned 403/429 to the plain client)
- kind: other
  name: pdftotext for PDFs
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: A research sub-agent searched, opened sources and returned cited facts in the raw file; the
    lead session reviewed the output and built the records.
purpose: Gather citizen counts, self-designations and heritage languages for contiguous-48 nations M through
  Z from their own websites.
queries:
- 'Bulk crawl: home page from website_in_bia_directory for all 201 roster entries (contiguous-48, official_name
  M-Z) plus up to 6 linked About/History/Enrollment/Language/Culture/Constitution pages; second pass of
  up to 12 more pages for nations still lacking a population figure'
- 'WebSearch: Navajo Nation enrolled members population official navajo-nsn.gov'
- 'WebSearch: Chickasaw Nation citizens number chickasaw.net'
- 'WebSearch: Osage Nation enrolled members number osagenation-nsn.gov'
- 'WebSearch: Oglala Sioux Tribe enrolled members Pine Ridge official'
- 'WebSearch: Diné Bikéyah Navajo Nation official "Diné" enrolled citizens 2026'
- 'WebSearch: Menominee Indian Tribe of Wisconsin enrolled members menominee-nsn.gov'
- 'WebSearch: Red Lake Band of Chippewa Indians enrolled members redlakenation.org'
- 'WebSearch: San Carlos Apache Tribe enrolled members number official'
- 'WebSearch: Pascua Yaqui Tribe enrolled members pascuayaqui-nsn.gov about'
- 'WebSearch: Turtle Mountain Band of Chippewa enrolled members number'
- 'WebSearch: Saint Regis Mohawk Tribe enrolled members Akwesasne srmt-nsn.gov'
- 'WebSearch: Penobscot Nation tribal members number penobscotnation.org'
- 'WebSearch: Passamaquoddy Tribe official website Sipayik Motahkomikuk tribal members'
- 'WebSearch: Pueblo of Laguna tribal members number lagunapueblo-nsn.gov'
- 'WebSearch: Mescalero Apache Tribe enrolled members number'
- 'WebSearch: Puyallup Tribe enrolled members number puyalluptribe-nsn.gov'
- 'WebSearch: Northern Arapaho Tribe enrolled members number Wind River'
- 'WebSearch: Seminole Nation of Oklahoma tribal members number sno-nsn.gov'
- 'WebSearch: Poarch Band of Creek Indians tribal citizens number about'
- 'WebSearch: Quapaw Nation citizens number quapawtribe.com history'
- 'WebSearch: Mohegan Tribe tribal members number mohegan.nsn.us'
- 'WebSearch: Mashantucket Pequot Tribal Nation number of tribal members'
- 'WebSearch: Omaha Tribe of Nebraska enrolled members Umoⁿhoⁿ official'
- 'WebSearch: Pueblo of Isleta tribal members population isletapueblo.com about'
- 'WebSearch: Quinault Indian Nation enrolled members number quinaultindiannation.com'
- 'WebSearch: Prairie Band Potawatomi Nation enrolled members number official'
- 'WebSearch: Saginaw Chippewa Indian Tribe tribal members number sagchip.org'
- 'WebSearch: Makah Tribe enrolled members number makah.com'
- 'WebSearch: Swinomish Indian Tribal Community enrolled members number'
- 'WebSearch: Shawnee Tribe Oklahoma citizens number shawnee-nsn.gov'
- 'WebSearch: Peoria Tribe of Indians of Oklahoma tribal citizens number'
- 'WebFetch: mptn-nsn.gov, mptn-nsn.gov/history/, mohegan.nsn.us, mohegan.nsn.us/about/government, miccosukee.com/miccosukee-tribe-history/,
  narragansettindiannation.org (+/history/), pci-nsn.gov (+/our-story/history/), meskwaki.org, swinomish-nsn.gov,
  choctawnation.com, tmchippewa.com, sanmanuel-nsn.gov, ohkay.org, pechanga-nsn.gov, opvp.navajo-nsn.gov
  enrollment release, PCI press kit PDF (failed)'
- 'Direct fetch of state-agency profile pages: sdtribalrelations.sd.gov/tribes/<tribe>.aspx; dpi.wi.gov/amind/tribalnationswi/<tribe>;
  dot.state.mn.us/tribaltraining/<tribe>.html; indianaffairs.nd.gov/turtle-mountain-band-chippewa-0; maine.gov
  Wabanaki Studies PDF; itcaonline.com/member-tribes/<tribe>/; itcmi.org/home/tribes/<tribe>/; naair.arizona.edu
  tribe pages'
sources_added:
- makah-indian-tribe-of-the-makah-indian-r-makah-tribal-info
- manchester-band-of-pomo-indians-of-the-m-home
- mashpee-wampanoag-tribe-home
- mashpee-wampanoag-tribe-language
- match-e-be-nash-she-wish-band-of-pottawa-home-tribes-match-e-be-nash-she-wish-ban
- mechoopda-indian-tribe-of-chico-rancheri-home
- menominee-indian-tribe-of-wisconsin-amind-tribalnationswi-menominee
- mesa-grande-band-of-diegueno-mission-ind-about-mesa-grande
- mescalero-apache-tribe-of-the-mescalero-handouts-iac-20071323-20item-205-20mat-2
- miami-tribe-of-oklahoma-about-us
- miccosukee-tribe-of-indians-miccosukee-tribe-history
- middletown-rancheria-of-pomo-indians-of-history-culture
- mikmaq-nation-home
- mississippi-band-of-choctaw-indians-home
- modoc-nation-tribal-enrollment
- monacan-indian-nation-about-us-html
- mooretown-rancheria-of-maidu-indians-of-tribal-history-index-html
- morongo-band-of-mission-indians-about-us
- muckleshoot-indian-tribe-about
- navajo-nation-arizona-new-mexico-and-uta-260608-navajo-nation-enrollment-continue
- nez-perce-tribe-about
- nez-perce-tribe-home
- nisqually-indian-tribe-heritage
- nisqually-indian-tribe-home
- nooksack-indian-tribe-about
- nooksack-indian-tribe-cultural-resources-culture-program
- northern-cheyenne-tribe-of-the-northern-home
- northfork-rancheria-of-mono-indians-of-c-our-people-history-culture
- northfork-rancheria-of-mono-indians-of-c-our-people-history-timeline
- northwestern-band-of-the-shoshone-nation-about
- northwestern-band-of-the-shoshone-nation-about-history
- nottawaseppi-huron-band-of-the-potawatom-about
- nottawaseppi-huron-band-of-the-potawatom-culture
- oglala-sioux-tribe-home
- oglala-sioux-tribe-tribes-oglala-sioux-tribe-aspx
- ohkay-owingeh-home
- omaha-tribe-of-nebraska-p-4596
- oneida-indian-nation-language-learning
- oneida-indian-nation-mission-vision-and-goals
- oneida-nation-home
- onondaga-nation-home
- otoe-missouria-tribe-of-indians-home
- otoe-missouria-tribe-of-indians-who-we-are-history
- ottawa-tribe-of-oklahoma-home
- paiute-indian-tribe-of-utah-enrollment
- paiute-indian-tribe-of-utah-home
- paiute-shoshone-tribe-of-the-fallon-rese-165-about-the-fpst
- pala-band-of-mission-indians-visitors-history
- pascua-yaqui-tribe-of-arizona-wp-content-uploads-2023-10-membership-st
- paskenta-band-of-nomlaki-indians-of-cali-about-the-nation
- passamaquoddy-tribe-doe-sites-maine-gov-doe-files-inline-fil
- passamaquoddy-tribe-page-id-14
- pauma-band-of-luiseno-mission-indians-of-about
- pauma-band-of-luiseno-mission-indians-of-culture
- pawnee-nation-of-oklahoma-pawnee-history
- pechanga-band-of-indians-home
- peoria-tribe-of-indians-of-oklahoma-207-culturelanguage
- pinoleville-pomo-nation-heritage-recent-history
- pinoleville-pomo-nation-home
- pokagon-band-of-potawatomi-indians-departments-education-higher-education-l
- ponca-tribe-of-indians-of-oklahoma-home
- ponca-tribe-of-nebraska-enrollment-home
- ponca-tribe-of-nebraska-home
- ponca-tribe-of-nebraska-ponca-language
- port-gamble-sklallam-tribe-home
- prairie-band-potawatomi-nation-home
- prairie-band-potawatomi-nation-pbpn-member-services-the-official-hub-of
- prairie-island-indian-community-in-the-s-home
- prairie-island-indian-community-in-the-s-tribaltraining-prairie-island-html
- pueblo-of-cochiti-home
- pueblo-of-isleta-tribal-programs-tiwa-language-program
- pueblo-of-jemez-about
- pueblo-of-jemez-about-pecos-pueblo
- pueblo-of-nambe-about-nambe-pueblo
- pueblo-of-pojoaque-home
- pueblo-of-san-felipe-home
- pueblo-of-san-ildefonso-home
- pueblo-of-san-ildefonso-visiting-the-pueblo
- pueblo-of-sandia-home
- pueblo-of-santa-ana-home
- pueblo-of-santa-clara-about-us
- pueblo-of-santa-clara-home
- pueblo-of-tesuque-history
- pueblo-of-tesuque-home
- pueblo-of-zia-home
- puyallup-tribe-of-the-puyallup-reservati-about-our-tribe
- pyramid-lake-paiute-tribe-of-the-pyramid-about-us
- quechan-tribe-of-the-fort-yuma-indian-re-about-us-html
- quileute-tribe-of-the-quileute-reservati-government-tribal-council
- quileute-tribe-of-the-quileute-reservati-home
- quinault-indian-nation-home
- rappahannock-tribe-inc-consultationpolicy
- red-cliff-band-of-lake-superior-chippewa-community-heritage-and-culture-index-php
- red-lake-band-of-chippewa-indians-tribaltraining-red-lake-html
- redding-rancheria-home
- reno-sparks-indian-colony-182-enrollment
- reno-sparks-indian-colony-27-about-us
- rincon-band-of-luiseno-indians-culture-history-history
- rosebud-sioux-tribe-of-the-rosebud-india-history-culture
- rosebud-sioux-tribe-of-the-rosebud-india-tribes-rosebud-sioux-tribe-aspx
- sac-and-fox-nation-about-council
- sac-and-fox-nation-home
- sac-and-fox-nation-talk-sauk-sauk-language-videos
- sac-and-fox-tribe-of-the-mississippi-in-home
- saginaw-chippewa-indian-tribe-of-michiga-language-index-asp
- salt-river-pima-maricopa-indian-communit-about
- salt-river-pima-maricopa-indian-communit-about-languages
- samish-indian-nation-home
- san-carlos-apache-tribe-of-the-san-carlo-faq
- san-juan-southern-paiute-tribe-of-arizon-home
- san-pasqual-band-of-diegueno-mission-ind-about-us
- san-pasqual-band-of-diegueno-mission-ind-home
- santa-rosa-band-of-cahuilla-indians-culture
- santa-ynez-band-of-chumash-mission-india-chumash-history
- santo-domingo-pueblo-home
- santo-domingo-pueblo-kewa-keres-language-program
- santo-domingo-pueblo-our-history
- sault-ste-marie-tribe-of-chippewa-indian-membership-services-tribal-enrollment
- seminole-tribe-of-florida-history-introduction
- seneca-nation-of-indians-about
- seneca-nation-of-indians-culture-history
- shakopee-mdewakanton-sioux-community-of-home
- shakopee-mdewakanton-sioux-community-of-tribaltraining-shakopee-mdewakanton-html
- shawnee-tribe-home
- shinnecock-indian-nation-home
- shoshone-bannock-tribes-of-the-fort-hall-language-culture
- shoshone-bannock-tribes-of-the-fort-hall-police
- shoshone-paiute-tribes-of-the-duck-valle-cultural-department
- sisseton-wahpeton-oyate-of-the-lake-trav-home
- sisseton-wahpeton-oyate-of-the-lake-trav-tribes-sisseton-wahpeton-oyate-aspx
- soboba-band-of-luiseno-indians-about-us
- soboba-band-of-luiseno-indians-home
- sokaogon-chippewa-community-our-history-about-us
- sokaogon-chippewa-community-our-history-history
- southern-ute-indian-tribe-of-the-souther-history
- spirit-lake-tribe-our-tribe
- spokane-tribe-of-the-spokane-reservation-home
- st-croix-chippewa-indians-of-wisconsin-amind-tribalnationswi-saintcroix
- standing-rock-sioux-tribe-of-north-and-s-tribes-standing-rock-sioux-tribe-aspx
- stillaguamish-tribe-of-indians-of-washin-our-history
- stillaguamish-tribe-of-indians-of-washin-our-history-faqs
- stockbridge-munsee-community-amind-tribalnationswi-mohican
- suquamish-indian-tribe-of-the-port-madis-home
- susanville-indian-rancheria-home
- te-moak-tribe-of-western-shoshone-indian-elko-shtml
- te-moak-tribe-of-western-shoshone-indian-history-shtml
- tejon-indian-tribe-who-we-are-today
- the-chickasaw-nation-reports-progress-reports-view-2024-2024
- the-choctaw-nation-of-oklahoma-home
- the-muscogee-nation-citizenship
- the-muscogee-nation-home
- thlopthlocco-tribal-town-home
- three-affiliated-tribes-of-the-fort-bert-home
- tohono-oodham-nation-of-arizona-about-tohono-oodham-nation
- tohono-oodham-nation-of-arizona-home
- tonkawa-tribe-of-indians-of-oklahoma-about
- tonkawa-tribe-of-indians-of-oklahoma-home
- tonto-apache-tribe-of-arizona-member-tribes-tonto-apache-tribe
- torres-martinez-desert-cahuilla-indians-home
- tulalip-tribes-of-washington-home
- tule-river-indian-tribe-of-the-tule-rive-casinorelocation
- tule-river-indian-tribe-of-the-tule-rive-history
- tunica-biloxi-indian-tribe-culture
- tunica-biloxi-indian-tribe-home
- tuolumne-band-of-me-wuk-indians-of-the-t-cultural-history
- tuolumne-band-of-me-wuk-indians-of-the-t-home
- turtle-mountain-band-of-chippewa-indians-home
- turtle-mountain-band-of-chippewa-indians-turtle-mountain-band-chippewa-0
- united-keetoowah-band-of-cherokee-indian-about-us
- upper-sioux-community-history
- ute-indian-tribe-of-the-uintah-and-ouray-home
- ute-mountain-ute-tribe-home
- utu-utu-gwaitu-paiute-tribe-of-the-bento-tribal-history-htm
- walker-river-paiute-tribe-of-the-walker-home
- wampanoag-tribe-of-gay-head-home
- wampanoag-tribe-of-gay-head-wampanoag-history
- white-mountain-apache-tribe-of-the-fort-history-html
- wichita-and-affiliated-tribes-home
- wichita-and-affiliated-tribes-justice
- wilton-rancheria-departments-enrollment
- winnebago-tribe-of-nebraska-tribal-council
- wyandotte-nation-aboutus
- wyandotte-nation-home
- yankton-sioux-tribe-of-south-dakota-tribes-yankton-sioux-tribe-aspx
- yavapai-apache-nation-of-the-camp-verde-yavapai-apache-nation
- yavapai-prescott-indian-tribe-about-ypit-htm
- yocha-dehe-wintun-nation-heritage-our-history
- yocha-dehe-wintun-nation-home
- ysleta-del-sur-pueblo-about-us
- ysleta-del-sur-pueblo-home
- yuhaaviatam-of-san-manuel-nation-home
- yurok-tribe-of-the-yurok-reservation-our-history
- zuni-tribe-of-the-zuni-reservation-home
- zuni-tribe-of-the-zuni-reservation-member-tribes-pueblo-of-zuni
limits: 'Population (any kind) found for 111 of 201 nations. No population published or found for: manchester-band-of-pomo-indians-of-the-manchester-rancheria,
  manzanita-band-of-diegueno-mission-indians-of-the-manzanita-reservation, mashantucket-pequot-indian-tribe,
  match-e-be-nash-she-wish-band-of-pottawatomi, miccosukee-tribe-of-indians, minnesota-chippewa-tribe,
  moapa-band-of-paiute-indians-of-the-moapa-river-indian-reservation, modoc-nation, mohegan-tribe-of-indians-of-connecticut,
  mooretown-rancheria-of-maidu-indians-of-california, muckleshoot-indian-tribe, nansemond-indian-nation,
  narragansett-indian-tribe, northern-arapaho-tribe-of-the-wind-river-reservation, ohkay-owingeh, onondaga-nation,
  pamunkey-indian-tribe, pauma-band-of-luiseno-mission-indians-of-the-pauma-and-yuima-reservation, pechanga-band-of-indians,
  penobscot-nation, peoria-tribe-of-indians-of-oklahoma, picayune-rancheria-of-chukchansi-indians-of-california,
  pinoleville-pomo-nation, pit-river-tribe, poarch-band-of-creek-indians, pokagon-band-of-potawatomi-indians,
  potter-valley-tribe, pueblo-of-acoma, pueblo-of-cochiti, pueblo-of-isleta, pueblo-of-laguna, pueblo-of-picuris,
  pueblo-of-pojoaque, pueblo-of-santa-clara, pueblo-of-taos, pueblo-of-zia, pulikla-tribe-of-yurok-people,
  puyallup-tribe-of-the-puyallup-reservation, quapaw-nation, quartz-valley-indian-community-of-the-quartz-valley-reservation-of-california,
  quinault-indian-nation, ramona-band-of-cahuilla, redding-rancheria, redwood-valley-or-little-river-band-of-pomo-indians-of-the-redwood-valley-rancheria-california,
  rincon-band-of-luiseno-indians, robinson-rancheria, round-valley-indian-tribes-round-valley-reservation,
  sac-and-fox-nation-of-missouri-in-kansas-and-nebraska, saginaw-chippewa-indian-tribe-of-michigan, saint-regis-mohawk-tribe,
  samish-indian-nation, san-juan-southern-paiute-tribe-of-arizona, santa-rosa-indian-community-of-the-santa-rosa-rancheria,
  santa-ynez-band-of-chumash-mission-indians-of-the-santa-ynez-reservation, sauk-suiattle-indian-tribe,
  scotts-valley-band-of-pomo-indians-of-california, seneca-cayuga-nation, shawnee-tribe, sherwood-valley-rancheria-of-pomo-indians-of-california,
  shingle-springs-band-of-miwok-indians-shingle-springs-rancheria, shoalwater-bay-indian-tribe-of-the-shoalwater-bay-indian-reservation,
  skokomish-indian-tribe, skull-valley-band-of-goshute-indians-of-utah, snoqualmie-indian-tribe, squaxin-island-tribe-of-the-squaxin-island-reservation,
  stillaguamish-tribe-of-indians-of-washington, summit-lake-paiute-tribe-of-nevada, suquamish-indian-tribe-of-the-port-madison-reservation,
  swinomish-indian-tribal-community, sycuan-band-of-the-kumeyaay-nation, table-mountain-rancheria, the-osage-nation,
  the-seminole-nation-of-oklahoma, timbisha-shoshone-tribe, tolowa-dee-ni-nation, tonawanda-band-of-seneca,
  torres-martinez-desert-cahuilla-indians, tuscarora-nation, twenty-nine-palms-band-of-mission-indians-of-california,
  united-auburn-indian-community-of-the-auburn-rancheria-of-california, upper-mattaponi-tribe, upper-skagit-indian-tribe,
  washoe-tribe-of-nevada-and-california, winnemucca-indian-colony-of-nevada, wiyot-tribe, yerington-paiute-tribe-of-the-yerington-colony-and-campbell-ranch,
  yocha-dehe-wintun-nation, yomba-shoshone-tribe-of-the-yomba-reservation, yuhaaviatam-of-san-manuel-nation,
  viejas-baron-long-group-of-capitan-grande-band-of-mission-indians. Nations with no facts at all: manzanita-band-of-diegueno-mission-indians-of-the-manzanita-reservation,
  mashantucket-pequot-indian-tribe, minnesota-chippewa-tribe, moapa-band-of-paiute-indians-of-the-moapa-river-indian-reservation,
  mohegan-tribe-of-indians-of-connecticut, nansemond-indian-nation, narragansett-indian-tribe, northern-arapaho-tribe-of-the-wind-river-reservation,
  pamunkey-indian-tribe, picayune-rancheria-of-chukchansi-indians-of-california, pit-river-tribe, poarch-band-of-creek-indians,
  potter-valley-tribe, pueblo-of-acoma, pueblo-of-laguna, pueblo-of-picuris, pueblo-of-taos, pulikla-tribe-of-yurok-people,
  quapaw-nation, quartz-valley-indian-community-of-the-quartz-valley-reservation-of-california, ramona-band-of-cahuilla,
  redwood-valley-or-little-river-band-of-pomo-indians-of-the-redwood-valley-rancheria-california, robinson-rancheria,
  round-valley-indian-tribes-round-valley-reservation, sac-and-fox-nation-of-missouri-in-kansas-and-nebraska,
  saint-regis-mohawk-tribe, santa-rosa-indian-community-of-the-santa-rosa-rancheria, sauk-suiattle-indian-tribe,
  scotts-valley-band-of-pomo-indians-of-california, seneca-cayuga-nation, sherwood-valley-rancheria-of-pomo-indians-of-california,
  shingle-springs-band-of-miwok-indians-shingle-springs-rancheria, shoalwater-bay-indian-tribe-of-the-shoalwater-bay-indian-reservation,
  skokomish-indian-tribe, skull-valley-band-of-goshute-indians-of-utah, snoqualmie-indian-tribe, squaxin-island-tribe-of-the-squaxin-island-reservation,
  summit-lake-paiute-tribe-of-nevada, swinomish-indian-tribal-community, sycuan-band-of-the-kumeyaay-nation,
  table-mountain-rancheria, the-osage-nation, the-seminole-nation-of-oklahoma, timbisha-shoshone-tribe,
  tolowa-dee-ni-nation, tonawanda-band-of-seneca, tuscarora-nation, twenty-nine-palms-band-of-mission-indians-of-california,
  united-auburn-indian-community-of-the-auburn-rancheria-of-california, upper-mattaponi-tribe, upper-skagit-indian-tribe,
  washoe-tribe-of-nevada-and-california, winnemucca-indian-colony-of-nevada, wiyot-tribe, yerington-paiute-tribe-of-the-yerington-colony-and-campbell-ranch,
  yomba-shoshone-tribe-of-the-yomba-reservation, viejas-baron-long-group-of-capitan-grande-band-of-mission-indians.
  Sites that blocked the plain HTTP client (403/429/Cloudflare challenge) and were only partly read through
  WebFetch or not at all: mptn-nsn.gov, mohegan.nsn.us, narragansettindiannation.org, miccosukee.com,
  pci-nsn.gov (and its press-kit PDF), meskwaki.org, swinomish-nsn.gov, choctawnation.com, tmchippewa.com,
  stcroixojibwe-nsn.gov, squaxinisland.org, qvir.com, sanmanuel-nsn.gov, scottsvalley-nsn.gov, opvp.navajo-nsn.gov;
  ohkay.org, pechanga-nsn.gov and summitlaketribe.org failed to connect from the plain client. Tonawanda
  Band of Seneca and Tuscarora Nation have no website in the BIA directory and none was found; Passamaquoddy
  websites were found via the Maine Department of Education. Oklahoma State Department of Education tribal
  education guides (sde.ok.gov) now redirect to oklahoma.gov and could not be used; Minnesota Indian Affairs
  Council pages returned a captcha; North Dakota Indian Affairs Commission statistics page returned 403
  (its 1998-era facts PDF was not used because it is outdated). Many figures are undated statements on
  current official pages: as_of is then the access date and confidence is medium. WebFetch-derived values
  come from a model summary of the page, so exact wording was requested and is quoted in notes, but they
  could not be checked against raw HTML. Language tags (ISO 639-3) were assigned by the researcher from
  the language named on the source; where the source names only a people or a broad group, no language
  fact was recorded. Self-designations were recorded only where the source presents the term as the people''s
  own name; band-level or ancestral terms are flagged in notes. Several nations publish conflicting figures
  on different pages (Northfork, Tesuque, Tunica-Biloxi, Tejon, Ysleta del Sur, Santo Domingo, NHBP, Salt
  River); conflicts are described in notes. Website facts were recorded only for Passamaquoddy (none in
  BIA directory) and San Carlos Apache (BIA lists an intertribal-council page). Email-general recorded
  only for Turtle Mountain and Zuni.'
---

## What was done

Read the contract, selected the 201 roster entries (list contiguous-48, official_name M-Z). Crawled each nation's directory website (home page plus key About/History/Enrollment/Language pages), extracted candidate sentences with regular expressions (numbers near enrolled/members/citizens/population; sentences naming languages or self-names), and reviewed them by hand. Recorded facts only where the page states them; each fact's URL was re-verified automatically against the fetched page text (exceptions are sums or numbers written in words, noted). A second, deeper crawl covered nations still lacking population. For blocked sites I used WebFetch. For large or unpublished nations I used targeted web searches that surfaced official news releases/PDFs (Navajo, Chickasaw, Pascua Yaqui, Mescalero, Omaha) and state-agency tribal profiles (South Dakota Tribal Relations, Wisconsin DPI, Minnesota DOT, North Dakota Indian Affairs Commission, Maine DOE) plus Inter Tribal Council of Arizona pages, at medium confidence. Wikipedia was not used as a source. Small California rancherias and many Washington and New Mexico nations do not publish enrollment counts on their sites.

## Output

`research/raw/2026-11-21/nations-contiguous-m-z.json`: 276 facts about 144 nations or communities from 194 sources. What the build kept and dropped is in `research/raw/2026-11-21/build-report.json`.
