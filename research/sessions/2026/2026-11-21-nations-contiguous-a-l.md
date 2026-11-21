---
id: 2026-11-21-nations-contiguous-a-l
date: '2026-11-21'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: page-fetch
  name: page fetch (curl)
- kind: other
  name: HTML text extraction (BeautifulSoup) and PDF text extraction (pdftotext)
- kind: other
  name: regular-expression snippet extraction with manual review
- kind: web-search
  name: web search
- kind: page-fetch
  name: WebFetch
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: A research sub-agent searched, opened sources and returned cited facts in the raw file; the
    lead session reviewed the output and built the records.
purpose: Gather population, official websites, general office emails, self-designations, alternate and
  former names, and languages for federally recognized nations in the contiguous states, A through L,
  from the nations own sites and state agencies.
queries:
- Bulk crawl (curl, user agent 'Mozilla/5.0 (research crawler)') of each in-scope nation's website_in_bia_directory
  homepage plus up to 8 same-site links matching about/history/enrollment/language/culture/membership/citizen/government;
  second pass via sitemap.xml / wp-sitemap.xml for nations still lacking a population figure (up to 10
  more pages each)
- Regular-expression extraction of population, language and self-designation statements from page text,
  followed by manual review of every snippet used
- 'WebFetch of directory sites that refused curl (HTTP 403 or no response): aguacaliente.org (failed),
  bishoppaiute.net (+ /about-us/), ctsi.nsn.us, estoo-nsn.gov, fmyn.org (+ /about-fmyn/), lowersioux.com
  (+ /about-us/), koinationsonoma.com (+ /history/), crit-nsn.gov, coldspringsrancheria.gov/our-story/,
  yakamafish-nsn.gov/node/295'
- 'State and intertribal bulk pages (curl): tribalnations.mt.gov/Directory/* (Montana), sdtribalrelations.sd.gov/tribes/*
  (South Dakota), dpi.wi.gov/amind/tribalnationswi/* (Wisconsin), doa.nc.gov/divisions/american-indian-affairs/tribes
  (North Carolina), oregon.gov Native Americans in Oregon By the Numbers PDF (Oregon, 2020), sos.oregon.gov
  Oregon Blue Book tribal pages (no counts), itcaonline.com/member-tribes/* (Arizona), itcmi.org tribe
  pages (Michigan, no counts), oklahoma.gov State Department of Education tribal guide PDFs (Cheyenne
  and Arapaho, Caddo, Delaware Nation, Apache)'
- 'Official documents: Kiowa Tribe Annual Report FY 2025-2026 PDF; Grand Traverse Band media kit PDF (2019);
  Lummi Nation Community Plan final draft PDF (2022)'
- 'Web searches: ''Blackfeet Nation enrolled members number''; ''Tribes of Wisconsin Department of Administration
  enrollment ...''; ''Yakama Nation enrolled members''; ''Confederated Tribes of Warm Springs enrolled
  members''; ''Confederated Tribes of Siletz Indians tribal members number''; ''Eastern Band of Cherokee
  Indians enrolled members''; ''Lumbee Tribe of North Carolina enrolled members''; ''Michigan federally
  recognized tribes tribal enrollment numbers ...''; ''Hopi Tribe enrolled members''; ''Jicarilla Apache
  Nation enrolled tribal members''; ''Kiowa Tribe enrolled members''; ''Cheyenne and Arapaho Tribes enrolled
  members''; ''Oklahoma Indian Affairs Commission tribal directory enrollment ...''; ''oklahoma.gov osde
  american-indian-education Tribal Guide ...''; ''Lummi Nation enrolled members''; ''Grand Traverse Band
  number of tribal members''; ''Little River Band tribal members number''; ''Keweenaw Bay Indian Community
  enrolled members''; ''Eastern Shoshone Tribe enrolled members''; ''Hoopa Valley Tribe enrolled members'';
  official-website searches for Cabazon, Cahto, Cold Springs, Guidiville, Jicarilla, Chippewa Cree, Crow
  Creek, Jackson, Alturas, Big Lagoon, Fort Bidwell, Grindstone, Kialegee, Ewiiaapaayp'
sources_added:
- ak-chin-about
- ak-chin-home
- alabama-coushatta-about-us-chief-history
- alabama-coushatta-about-us-our-history
- alabama-quassarte-about-us
- alabama-quassarte-home
- astribe-about-us
- badriver-nsn-history
- baymills-about-3
- baymills-enrollment
- bearriverrancheria-about-1
- bearriverrancheria-home
- bigpinepaiute-contact-us
- bigsandyrancheria-membership
- bishoppaiute-about-us
- bishoppaiute-home
- bluelakerancheria-nsn-home
- burnspaiute-nsn-about-bpt
- burnspaiute-nsn-home
- burnspaiute-nsn-language-traditional-culture-program
- cahuilla-nsn-tribal-government-committees-cultural
- campo-nsn-home
- catawba-about-the-nation
- catawba-home
- cayuganation-nsn-history-culture
- cdatribe-nsn-home
- cdatribe-nsn-our-tribe-history
- cdatribe-nsn-our-tribe-language
- chehalistribe-about
- chehalistribe-home
- chemehuevi-tribal-council
- cherokee-home
- cheyenneandarapaho-nsn-home
- cheyenneandarapaho-nsn-language-culture
- cheyenneriversioux-history
- chickahominytribe-culture-community
- chickahominytribe-home
- chickenranchrancheria-home
- chitimacha-about-us-contact-us
- chitimacha-about-us-faq
- cied-about-us
- cied-home
- cloverdalerancheria-home
- cocopah-about-us
- cocopah-home
- coldspringsrancheria-home
- colvilletribes-colville-tribal-language
- colvilletribes-home
- comanchenation-about-page-history
- comanchenation-culture-page-language
- coquilletribe-our-heritage-our-languages
- coquilletribe-our-heritage-our-living-culture
- coquilletribe-our-people
- coushatta-our-language
- coushatta-our-story
- cowcreek-nsn-government
- cowcreek-nsn-home
- cowlitz-blog-mmip-may-2026
- cowlitz-contact-directory
- coyotevalleytribe-about-us
- coyotevalleytribe-coyotevalleyculture
- coyotevalleytribe-coyotevalleyhistory
- cskt-home
- cskt-ksanka-culture-committee
- cskt-our-story
- ctclusi-history
- ctclusi-languagepublic
- ctuir-about
- ctuir-about-language
- cvmt-nsn-home
- delawarenation-nsn-home
- delawaretribe-home
- delawaretribe-language-revitalization
- drycreekrancheria-home
- drycreekrancheria-language-revitalization
- easternshoshone-contact
- ebci-department-of-education
- ebci-home
- elk-valley-home
- elwha-culture-history-klallam-language
- elyshoshonetribe-about
- enterpriserancheria-contact-us
- estoo-nsn-home
- fmpst-history
- fmpst-home
- fmyn-about-fmyn
- fmyn-home
- fortindependence-contact
- fortsillapache-nsn-about
- fortsillapache-nsn-programs-cultural-language-program
- ftbelknap-home
- gilariver-index-php-about-history
- grand-traverse-band-media-kit-2019
- grandronde-culture-history-chinuk-wawa-language
- grandronde-culture-history-our-homelands
- grandronde-home
- gratonrancheria-culture-history
- gratonrancheria-home
- gtbindians-tribal-council-asp
- hannahville-about-us
- hbpi-home
- ho-chunknation-home
- hohtribe-nsn-culture
- hoopa-nsn-babies-learn-hupa-language-through-immer
- hualapai-nsn-community-about-the-hualapai-tribe-index
- iipaynationofsantaysabel-nsn-home
- ionemiwok-contact-us
- iowanation-about-us
- iowanation-about-us-language
- iowanation-home
- iowatribeofkansasandnebraska-about-us
- itca-gila-river-indian-community
- itca-havasupai-tribe
- jamestowntribe-history-and-culture-jamestown-sklallam-h
- jamestowntribe-home
- jenachoctaw-culture-history-culture
- jenachoctaw-culture-history-history
- kalispeltribe-home
- kalispeltribe-our-language
- kalispeltribe-our-story
- karuk-departments-language-program
- karuk-home
- kawnation-history-of-kaw-nation
- kawnation-home
- kawnation-language
- kickapootexas-home
- kiowa-tribe-annual-report-fiscal-year-2025-2026
- kiowatribe-department-kiowa-language-department
- klamathtribes-language
- klamathtribes-tribal-council
- kletseldehe-tribal-history
- kootenai-home
- ktik-nsn-history-and-language-resource
- lajolla-nsn-reservation-info
- ldftribe-education-ojibwe-language
- leaningrock-home
- lowerbrulesiouxtribe-about-us
- lowersioux-about-us
- lowersioux-home
- lppsr-wp
- lrboi-nsn-home
- ltbbodawa-nsn-home
- ltbbodawa-nsn-tribal-council-and-legislative-office-le
- lummi-nation-community-plan-final-draft-2022
- lummi-nsn-home
- lvd-nsn-content-history-cfm
- lyttonrancheria-home
- maliseets-about
- maliseets-language
- montanalittleshelltribe-government
- mt-tribal-nations-blackfeet
- mt-tribal-nations-chippewa-cree
- mt-tribal-nations-crow
- mt-tribal-nations-cskt
- mt-tribal-nations-fort-peck
- mycaddonation-language-preservation
- north-carolina-commission-of-indian-affairs-tribal-communities
- oklahoma-education-tribal-guide-apache
- oklahoma-education-tribal-guide-caddo
- oklahoma-education-tribal-guide-cheyenne-and-arapaho
- oklahoma-education-tribal-guide-delaware-nation
- oregon-department-of-education-native-americans-in-oregon-by-the-numbers-2020
- paiutetribelovelock-home
- potawatomi-government
- sd-tribal-relations-cheyenne-river-sioux-tribe
- sd-tribal-relations-crow-creek-sioux-tribe
- sd-tribal-relations-flandreau-santee-sioux-tribe
- sd-tribal-relations-lower-brule-sioux-tribe
- stewartspoint-wp2
- tribe-history-heritage
- tribe-home
- wisconsin-dpi-tribal-nations-bad-river
- wisconsin-dpi-tribal-nations-forest-county-potawatomi
- wisconsin-dpi-tribal-nations-lac-courte-oreilles
- wisconsin-dpi-tribal-nations-lac-du-flambeau
- yakama-nation-fisheries-about-the-yakama-nation
limits: 'Scope: 149 roster entries with list contiguous-48 and official_name A through L (the brief estimated
  about 170). Population found for 78 of 149; no published figure was found for the rest, mostly small
  California rancherias and several Oklahoma, Michigan, Washington and Arizona nations (for example Agua
  Caliente, Hopi, Colorado River Indian Tribes, Cheyenne-Arapaho has only an old state figure, Delaware
  Tribe of Indians, Eastern Shawnee, Kickapoo Tribe of Oklahoma, Keweenaw Bay, Lac Vieux Desert, Little
  River Band, Cowlitz, Jamestown S''Klallam, Lower Elwha, Chehalis, Chitimacha, Cayuga, Eastern Shoshone,
  Hoopa, Jicarilla). Many counts are rounded (''over'', ''about'') and most official pages are undated;
  for those, as_of is the access date (2026-11-21) and confidence is medium. Some state pages give two
  different figures on the same page; those are marked low. Sites refusing curl: aguacaliente.org (also
  failed in WebFetch), fortpecktribes.org, ctsi.nsn.us, estoo-nsn.gov, fmyn.org, koinationsonoma.com,
  crit-nsn.gov, lowersioux.com, bishoppaiute.net; I did not try to bypass these by imitating a browser
  and used WebFetch instead (facts from WebFetch say so in the note). bridgeportindiancolony.com returned
  503. No directory website for Capitan Grande and Kialegee, and no official site found by search for
  Alturas, Big Lagoon, Cabazon, Cahto, Fort Bidwell, Grindstone, Guidiville, Inaja-Cosmit, Crow Creek,
  Chippewa Cree or Jackson (Jackson''s directory entry is its casino site; Chippewa Cree''s is the Rocky
  Mountain Tribal Leaders Council page; Crow Creek''s is the South Dakota state page). Language tags are
  ISO 639-3 / BCP 47 codes chosen by me from the language the source names; where the source did not name
  the language exactly, the note says the tag was assigned by the researcher. Self-designations were recorded
  only where the nation''s site (or a state page, at medium/low) states the name; Kiowa self-names on
  kiowatribe.org use a special font that did not survive text extraction, so none were recorded. No leader
  names or personal contacts were recorded; only generic office emails. The Cherokee Nation and Eastern
  Band pages show Cherokee syllabary, but I did not record a syllabary self-designation because I could
  not confirm exactly which words form the name. The North Carolina page also profiles state-recognized
  tribes (for example Haliwa-Saponi, Meherrin); they were out of scope and were not recorded.'
---

## What was done

I crawled each nation's own website (directory URL) with curl, extracted text, and searched it for enrollment counts, language names, self-designations and generic office emails, reviewing every snippet by hand before recording it. For nations without a count on their own site, I used state agency pages that publish per-nation enrollment (Montana, South Dakota, Wisconsin, North Carolina, Oregon Department of Education, Oklahoma State Department of Education) and the Inter Tribal Council of Arizona, plus a few official PDFs found by search (Kiowa annual report, Lummi community plan, Grand Traverse media kit). Bulk state pages worked well; per-nation web searches were slow and often found nothing. California rancherias rarely publish counts. Values keep the source's spelling and diacritics (for example Nʉmʉnʉʉ, Ql̓ispé, Schitsu’umsh, Kaáⁿze Íe, nsəlxcin, Weyíiletpuu).

## Output

`research/raw/2026-11-21/nations-contiguous-a-l.json`: 235 facts about 112 nations or communities from 177 sources. What the build kept and dropped is in `research/raw/2026-11-21/build-report.json`.
