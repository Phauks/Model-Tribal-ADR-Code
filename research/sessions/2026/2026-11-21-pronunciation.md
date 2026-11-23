---
id: 2026-11-21-pronunciation
date: '2026-11-21'
researchers:
- Claude (AI assistant)
tools:
- kind: page-fetch
  name: scripts/tribes/find_pronunciations.py
  detail: 'Fetched the official website of each nation that has one (545 of 948 profiles): the home page,
    up to seven same-site pages whose links suggest about, history, culture or language, and up to fifteen
    such pages from the site map. Saved every passage mentioning pronunciation and every linked audio
    file for review. Writes nothing to the profiles.'
- kind: page-fetch
  name: Python requests and Beautiful Soup
  detail: Re-read each page whose passage was kept, and every Tanana Chiefs Conference community page.
- kind: web-search
  name: Web search tool
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: Reviewed each saved passage by hand. Kept only a pronunciation of a name of the nation or its
    community, copied exactly as published.
purpose: Add how to say each nation's names, only as an authoritative source publishes it, preferring
  the nation's own website, language program or recordings.
queries:
- Official websites listed in the profiles (contacts, kind website)
- https://www.tananachiefs.org/about/communities/ (all 42 community pages)
- https://montanatribes.mt.gov/Learning-Activities/Tribal-Names-and-pronunciations
- Web searches for state, intertribal and regional pronunciation guides (Washington, Wisconsin, Alaska
  regional consortia)
sources_added:
- cheroenhaka-return-of-the-natives
- chickahominy-eastern-division-about-us
- coquille-how-do-you-pronounce-that
- hualapai-about-the-hualapai-tribe
- jemez-history-and-culture
- montana-tribes-tribal-names-and-pronunciations
- pojoaque-home-page
- quechan-about-us
- ramona-band-of-cahuilla-history
- salt-river-pima-maricopa-history
- seneca-nation-history
- tanana-chiefs-conference-community-alatna
- tanana-chiefs-conference-community-allakaket
- tanana-chiefs-conference-community-anvik
- tanana-chiefs-conference-community-beaver
- tanana-chiefs-conference-community-chalkyitsik
- tanana-chiefs-conference-community-galena-louden
- tanana-chiefs-conference-community-grayling
- tanana-chiefs-conference-community-healy-lake
- tanana-chiefs-conference-community-hughes
- tanana-chiefs-conference-community-huslia
- tanana-chiefs-conference-community-kaltag
- tanana-chiefs-conference-community-koyukuk
- tanana-chiefs-conference-community-manley-hot-springs
- tanana-chiefs-conference-community-mcgrath
- tanana-chiefs-conference-community-minto
- tanana-chiefs-conference-community-nenana
- tanana-chiefs-conference-community-nikolai
- tanana-chiefs-conference-community-nulato
- tanana-chiefs-conference-community-rampart
- tanana-chiefs-conference-community-ruby
- tanana-chiefs-conference-community-shageluk
- tanana-chiefs-conference-community-takotna
- tanana-chiefs-conference-community-tanacross
- tanana-chiefs-conference-community-tanana
- tanana-chiefs-conference-community-telida
- tanana-chiefs-conference-community-tetlin
- tanana-chiefs-conference-community-venetie
- tulalip-about-us
- united-keetoowah-band-about-us
- yavapai-prescott-about
- zia-about-us
limits: '403 profiles list no official website and were not searched one by one. 59 listed websites could
  not be read (firewall refusals, certificate errors or proxy refusals), among them Agua Caliente, Mashantucket
  Pequot, Mohegan, Siletz, Swinomish, Snoqualmie, Ohkay Owingeh, Standing Rock and Ute. Only pages reachable
  from the home page or the site map were read, so a pronunciation deeper in a site, in a PDF or in a
  video was missed. Language-lesson pages (alphabets, word lists) were not used: they teach the language
  but do not say how to say the nation''s name. Pronunciations of a band, a place or an English word in
  a name (for example Arctic Village and Fort Yukon on the Tanana Chiefs Conference pages) were left out.
  The Confederated Salish and Kootenai Tribes'' page ''Pronunciation of Séliš & Ql̓ispé'' was read through
  the web fetch tool because plain fetching was refused; its text gave no pronunciation and any player
  loaded by script was not seen. Secondary sources (Tanana Chiefs Conference and the State of Montana)
  are recorded at medium confidence and say so in each note.'
---

Every pronunciation in the profiles is copied from the cited page. None was worked out from a spelling. A nation without an entry has no source found yet, which does not mean the nation has no published pronunciation.

Profiles with an entry: alatna-village, allakaket-village, anvik-village, assiniboine-and-sioux-tribes-of-the-fort-peck-indian-reservation, beaver-village, blackfeet-tribe-of-the-blackfeet-indian-reservation-of-montana, chalkyitsik-village, cheroenhaka-indian-tribe, chickahominy-indian-tribe-eastern-division, chippewa-cree-indians-of-the-rocky-boys-reservation, confederated-salish-and-kootenai-tribes-of-the-flathead-reservation, coquille-indian-tribe, crow-tribe-of-montana, fort-belknap-indian-community-of-the-fort-belknap-reservation-of-montana, healy-lake-village, hualapai-indian-tribe-of-the-hualapai-indian-reservation, hughes-village, huslia-village, koyukuk-native-village, little-shell-tribe-of-chippewa-indians-of-montana, louden-tribe, manley-hot-springs-village, mcgrath-native-village, native-village-of-minto, native-village-of-ruby, native-village-of-tanacross, native-village-of-tanana, native-village-of-tetlin, native-village-of-venetie-tribal-government, nenana-native-association, nikolai-village, northern-cheyenne-tribe-of-the-northern-cheyenne-indian-reservation, nulato-village, organized-village-of-grayling, pueblo-of-jemez, pueblo-of-pojoaque, pueblo-of-zia, quechan-tribe-of-the-fort-yuma-indian-reservation, ramona-band-of-cahuilla, rampart-village, salt-river-pima-maricopa-indian-community-of-the-salt-river-reservation, seneca-nation-of-indians, shageluk-native-village, takotna-village, telida-village, tulalip-tribes-of-washington, united-keetoowah-band-of-cherokee-indians-in-oklahoma, village-of-kaltag, yavapai-prescott-indian-tribe.
