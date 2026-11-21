---
id: 2026-11-21-official-images
date: '2026-11-21'
researchers:
- Claude (AI assistant)
tools:
- kind: page-fetch
  name: scripts/tribes/find_official_images.py
  detail: 'Read the official website of each nation that has one (545 of 948 profiles): the home page,
    up to four same-site pages whose links mention a seal, flag, emblem, logo or insignia, and up to two
    terms-of-use, copyright, legal or disclaimer pages. Scored each image for being the nation''s own
    seal, flag or logo, downloaded the five best candidates to a private folder, and saved every sentence
    about terms of use, copyright, trademarks, legal protection or permission. Writes nothing to the profiles.'
- kind: page-fetch
  name: Playwright with Chromium
  detail: Rendered the 61 home pages that the plain reader could read but that draw their logo with JavaScript,
    with the browser's default identity. Also used to search the USPTO trademark system, which needs a
    browser.
- kind: legal-database
  name: USPTO trademark search (tmsearch.uspto.gov)
  detail: Query nonRegistration:"Native American Tribal Insignia" returned 185 entries; images from tsdr.uspto.gov.
- kind: web-search
  name: Web search tool
  detail: Searched for tribal laws on the use of a seal, emblem or flag.
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: Chose one image per nation by eye from contact sheets, compared each with the nation's database
    entries, and read and classified every saved terms-of-use sentence and each law found.
purpose: Collect each nation's seal, emblem, flag or logo from its own website, and record every signal
  that the project may not reuse the image (Trevor Goldsmith asked that reuse be assumed unless a signal
  says otherwise).
queries:
- Official websites listed in the profiles (contacts, kind website)
- nonRegistration:"Native American Tribal Insignia" (USPTO trademark search)
- tribal code "official seal" unauthorized use prohibited tribe ordinance seal flag (web search)
sources_added:
- 29palmstribe-home-page
- alabama-coushatta-home-page
- algaaciq-home-page
- astribe-home-page
- auburnrancheria-home-page
- badriver-nsn-home-page
- baymills-home-page
- bentonpaiutereservation-home-page
- bentonpaiutereservation-legal-notice
- berrycreekmaiduindians-home-page
- bigpinepaiute-home-page
- bigsandyrancheria-home-page
- blackfeetnation-home-page
- bvrancheria-home-page
- bvtribe-home-page
- cahuilla-nsn-home-page
- cahuilla-nsn-terms
- cayuganation-nsn-home-page
- cheeshna-home-page
- cheyenneriversioux-home-page
- chickaloon-home-page
- chickasaw-home-page
- chickasaw-terms
- chilkat-nsn-home-page
- chilkoot-nsn-home-page
- chitimacha-home-page
- chitimacha-tribal-logo
- choctawapachetribeebarb-home-page
- chukchansi-nsn-home-page
- chumash-home-page
- clarkspointvillagecouncil-home-page
- colusa-nsn-home-page
- comanchenation-home-page
- coquille-tribal-seal
- coquilletribe-home-page
- coushatta-home-page
- cowlitz-home-page
- cowlitz-terms-use
- coyotevalleytribe-home-page
- craigtribe-home-page
- crow-nsn-home-page
- ctclusi-home-page
- ctgr-home
- ctuir-home-page
- curarpaluk-history
- delawaretribe-copyright-notice
- diataku-home-page
- dotlakevillage-home-page
- duckwatertribe-home-page
- easternpequottribalnation-home-page
- easternshoshone-home-page
- echotacherokee-home-page
- elemindiancolony-home-page
- elwha-home-page
- elyshoshonetribe-home-page
- enterpriserancheria-home-page
- enterpriserancheria-terms-of-use
- eyak-nsn-home-page
- facebook-peedeeindiantribe
- fcpotawatomi-copyright
- fcpotawatomi-home-page
- fortmojaveindiantribe-home-page
- fortsillapache-nsn-home-page
- fortyukon-home-page
- fpst-home-page
- fsst-nsn-home-page
- gcdbcc-home-page
- georgetowntc-home-page
- gilariver-home-page
- gilariver-terms-of-use
- gilariver-tribal-seal
- gratonrancheria-terms
- grth-home-page
- gtbindians-home-page
- gulkanacouncil-home-page
- gunlaketribe-nsn-home-page
- haliwa-saponi-home-page
- hannahville-home-page
- healylake-home-page
- hohtribe-nsn-home-page
- hoonahindianassociation-home-page
- hoopa-nsn-home-page
- hopi-nsn-home-page
- hpultribe-nsn-home-page
- hpultribe-nsn-terms-of-use
- hualapai-nsn-home-page
- hydaburgtribe-home-page
- ionemiwok-home-page
- iowanation-tribal-seal
- iowatribeofkansasandnebraska-home-page
- isledejeancharles-home-page
- isletapueblo-home-page
- itcaonline-san-carlos-apache-tribe
- ivanofbaytribe-home-page
- jamestown-sklallam-title-41
- jamulindianvillage-home-page
- jemezpueblo-home-page
- jicarillaoga-home-page
- kaibabpaiute-nsn-index
- kake-nsn-home-page
- kaltagtribe-home-page
- karuk-terms-conditions
- kasaan-home-page
- kbic-nsn-home-page
- kickapootribeofoklahoma-home-page
- kiowatribe-home-page
- klamathtribes-home-page
- klamathtribes-terms-and-condition
- kletseldehe-home-page
- klutikaah-home-page
- kniktribe-home-page
- kokhanok-home-page
- kotzebueira-home-page
- ktik-nsn-home-page
- lagunapueblo-nsn-home-page
- lajolla-nsn-home-page
- larsenbaytribe-home-page
- lco-nsn-home-page
- ldftribe-home-page
- little-river-band-tribal-seal-ordinance
- little-traverse-bay-bands-tribal-emblem-and-seal
- loudentribe-home-page
- lowerbrulesiouxtribe-home-page
- lowereasterncherokeenation-home-page
- lptribe-home-page
- lumbeetribe-home-page
- lvd-nsn-home-page
- lvpaiutetribe-home-page
- machistribe-home-page
- makah-home-page
- maliseets-home-page
- mattaponi-home-page
- mechoopda-nsn-terms-of-use
- meherrinnation-home-page
- meherrinnation-terms-of-use
- meherrinnation-tribal-seal
- mekoryuktc-home-page
- mentastacouncil-home-page
- mesagrandeband-nsn-home-page
- mescaleroapachetribe-disclaimer-and-terms-of-use
- mescaleroapachetribe-home-page
- miamination-home-page
- middletownrancheria-nsn-home-page
- mississippi-band-of-choctaw-title-36
- mnchippewatribe-home-page
- mnvcdev-muniweb-home-page
- moapabandofpaiutes-home-page
- modocnation-home-page
- mohican-nsn-home-page
- monacannation-home-page
- montanalittleshelltribe-home-page
- mooretownrancheria-nsn-home-page
- morongonation-home-page
- mowachoctawindians-home-page
- mpapomotribe-tribal-council
- muckleshoot-nsn-home-page
- nansemond-home-page
- narragansettindiannation-home-page
- nativevillageofpaimiut-home-page
- nativevillageofunalakleet-home-page
- nenananativeassociation-home-page
- nhbp-nsn-home-page
- ninilchiktribe-nsn-home-page
- nisqually-nsn-terms-use
- nnvctribe-home-page
- nooksacktribe-home-page
- northernarapaho-home-page
- nottowayindians-home-page
- nvb-nsn-home-page
- nvgakona-home-page
- nvnuiqsut-home-page
- nwbshoshone-home-page
- obsn-home-page
- omahatribe-home-page
- oneidaindiannation-home-page
- oneidaindiannation-terms-of-use
- orutsararmiut-home-page
- osagenation-nsn-home-page
- osagenation-nsn-terms-use
- pactribe-home-page
- palatribe-home-page
- pamunkey-home-page
- pascuayaqui-nsn-home-page
- paskenta-nsn-home-page
- patawomeckindiantribeofvirginia-home-page
- patawomeckindiantribeofvirginia-policies-terms-and-conditions
- paumatribe-home-page
- paumatribe-privacy-policy-and-terms-of-service
- pawneenation-home-page
- pawneenation-pawnee-nation-flag-and-seal
- penobscotnation-home-page
- peoriatribe-home-page
- picurispueblo-home-page
- piquashawnee-home-page
- piquashawnee-terms
- plpt-nsn-home-page
- pokagonband-nsn-home-page
- portlionstribe-home-page
- potawatomi-home-page
- prairieisland-terms-and-conditions
- puebloofacoma-home-page
- puliklatribe-home-page
- puyalluptribe-nsn-home-page
- qttribe-home-page
- quapawtribe-home-page
- quechantribe-home-page
- ramona-nsn-home-page
- rappahannocktribe-home-page
- redcliff-nsn-home-page
- redlakenation-home-page
- rincon-nsn-home-page
- rosebudsiouxtribe-nsn-home-page
- rrcbc-nsn-home-page
- rsic-home-page
- rvit-home-page
- rvrpomo-home-page
- sagchip-home-page
- samishtribe-nsn-terms-of-use
- sanjuanpaiute-nsn-terms-of-use
- santarosa-nsn-home-page
- sappony-home-page
- sauk-suiattle-home-page
- sbtribes-home-page
- scat-nsn-home-page
- sctribe-home-page
- semtribe-home-page
- semtribe-terms-and-conditions
- shinglespringsrancheria-home-page
- shoalwaterbay-nsn-home-page
- shopaitribes-home-page
- skagwaytraditional-home-page
- skokomish-home-page
- skullvalleygoshutes-home-page
- sni-home-page
- sno-nsn-home-page
- sokaogonchippewa-home-page
- southernute-nsn-terms-of-use
- southernute-nsn-tribal-seal
- spiritlakenation-home-page
- squaxinisland-home-page
- srmt-nsn-home-page
- srpmic-nsn-home-page
- stcroixojibwe-nsn-home-page
- stillaguamish-home-page
- stillaguamish-terms-of-use
- summitlaketribe-home-page
- sumtercherawindians-home-page
- sunaq-home-page
- svt-home-page
- sycuantribe-home-page
- tachi-yokut-nsn-home-page
- taospueblo-home-page
- tazlinavillage-my-canva-home-page
- tejonindiantribe-home-page
- temoaktribe-index-shtml
- theofficialhavasupaitribe-home-page
- timbisha-newsite
- tolowa-home-page
- trinidad-rancheria-home-page
- tsedina-home-page
- tulerivertribe-nsn-home-page
- ucantribe-home-page
- ukb-nsn-home-page
- umitribe-home-page
- unitedhoumanation-home-page
- uppersiouxcommunity-nsn-home-page
- upperskagittribe-nsn-home-page
- uspto-native-american-tribal-insignia-database
- viejasbandofkumeyaay-home-page
- villageofiliamna-home-page
- villageofsolomon-home-page
- waccamaw-home-page
- warmsprings-nsn-home-page
- washoetribe-home-page
- wassamasawtribe-home-page
- wcatribe-home-page
- wiltonrancheria-nsn-home-page
- winnebagotribe-home-page
- winnemuccaindiancolony-home-page
- wiyot-home-page
- woodyisland-home-page
- yakama-home-page
- yakutattlingittribe-home-page
- yanktonsiouxtribe-home-page
- yavapai-apache-home-page
- yombatribe-home-page
- ypit-flag-popup
- yuroktribe-home-page
limits: 403 profiles list no official website and were not searched. 62 listed websites could not be read
  from the cloud (connection refusals, certificate errors or proxy refusals), among them Agua Caliente,
  Mashantucket Pequot, Mohegan, Pechanga, Siletz, Standing Rock and Swinomish; per project practice they
  were not retried with another identity. Images on shared hosts (intertribal consortia, Alaska Native
  corporations, state agencies, casinos, website vendors) were rejected because the mark belongs to someone
  else. The database comparison is by eye. Three tribal laws found by search could not be read (Oneida
  Nation Seal and Flag Law, a page of the Nottawaseppi Huron Band code, the Delaware Tribe Tribal Seal
  Protection Ordinance) and one code section was not checked (Samish Tribal Code 1.20.120). Nations' laws
  not published online were not found.
---

## What was done

The crawler found candidate images on 472 of the 545 websites read. Each candidate was looked at on a
contact sheet, and one image was chosen per nation when it was clearly the nation's own seal, emblem,
flag or logo: 360 nations (294 logos, 61 seals, 3 flags, 2 emblems). The rest had only a casino, vendor,
consortium or social media image, or nothing usable. Nineteen of the chosen images were found only by
rendering the page in a browser.

Every chosen image is recorded in the nation's profile under `official_images`, with the page it came
from, its SHA-256 and the path of the private copy (`nation-images/<id>/`). The files are kept in the
project's private research captures, never in this repository.

## Reuse signals

How each signal is detected and what it does is set out in docs/official-images.md. In this pass:

- Terms of use, trademark notices and permission notes: 94 terms-of-use sentences, 54 trademark notices
  and 5 permission notes were saved by the crawler and read by hand. Most were privacy or cookie text.
  Twenty-eight nations' notices limit reuse of logos or site images, or ask to be contacted first.
- Trademark symbols: a registered trademark symbol is printed on two chosen images (Muckleshoot Indian
  Tribe; Mississippi Band of Choctaw Indians).
- USPTO Native American Tribal Insignia database: 183 of the 185 entries were matched to 92 profiles.
  Two were not: 89000952 (Fond du Lac Band of Lake Superior Chippewa, a component band of the Minnesota
  Chippewa Tribe without its own profile) and 89003098 (a Gabrieleno San Gabriel Band filing, with no
  profile). For the 74 nations with both a chosen image and entries, each entry was compared by eye: 60
  show the same design, 10 a similar design and 17 a different one.
- Tribal laws: five laws were read and are cited (Jamestown S'Klallam Title 41; Little River Band
  Ordinance 96-0107-01; Little Traverse Bay Bands WOS 2016-004; Coquille ch. 196; Mississippi Band of
  Choctaw Title 36, ch. 3). The Stockbridge-Munsee Community's flag ordinance (GOV.04.01) was found but
  governs the flag, not the seal chosen here.

Result: 270 images show no restriction, 1 may be shown on conditions (the Little Traverse Bay Bands
Emblem), 1 needs checking (Oneida Nation logo) and 88 are restricted, 57 of them only because the nation
filed the same or a similar design in the USPTO database.

## Other findings

- Two listed websites now show gambling spam and look like lapsed domains: oglalalakotanation.net
  (Oglala Sioux Tribe) and inupiatgov.com (a second website of the Inupiat Community of the Arctic
  Slope). Nothing was taken from them.
- The Prairie Island Indian Community's website terms (last updated January 10, 2023) contain "a
  mandatory individual arbitration and class action/jury trial waiver provision" for disputes with
  users of the site, which may interest the dispute resolution research:
  https://prairieisland.org/terms-and-conditions.
