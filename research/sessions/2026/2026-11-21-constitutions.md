---
id: 2026-11-21-constitutions
date: '2026-11-21'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: page-fetch
  name: Python requests and Beautiful Soup
  detail: Crawled each profile's governing document links and official website (home page, up to eight
    navigation pages, two links deep), one request a second per host, with a user agent naming the
    project.
- kind: archive
  name: Internet Archive
  detail: Downloaded the 478 PDFs and their text in the 11 "US Tribal Constitutions" items (Bureau of
    Indian Affairs files released under the Freedom of Information Act, posted by The Memory Hole 2).
- kind: archive
  name: Wayback Machine
  detail: Availability lookups for dead links; web.archive.org refused connections from the research
    environment, so no capture was opened.
- kind: other
  name: pdftotext, pdftoppm and Tesseract
  detail: Text of each PDF; optical character recognition at 200 dots per inch for 189 scans without a
    text layer.
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: The lead session wrote scripts/constitutions/ and built the catalog and histories. Small-model
    reviewers (Claude Haiku) classified 1,029 documents in 29 batches and confirmed and summarized 1,107
    article topics in 22 batches; their answers are marked as AI readings not yet checked by the lead
    author.
purpose: Gather the current constitution of every federally recognized nation in the dataset, with
  earlier versions and amendments where they can be found, record how the judicial, dispute resolution,
  peacemaking, election dispute, removal and sovereign immunity articles changed between versions, and
  say plainly where nothing was found.
queries:
- The constitution, articles of association, corporate charter and similar governing_documents links in
  the 581 federal profiles (1,055 links)
- Each profile's official website (home page and navigation pages), following links whose text names a
  constitution, bylaws, articles of association or amendment
- https://narf.org/nill/triballaw/ (National Indian Law Library Tribal Law Gateway constitution pages)
- https://www.tribal-institute.org/lists/constitutions.htm (Tribal Law and Policy Institute list, matched
  to nations by name)
- https://archive.org/details/tribal-constitutions-<region> (11 items, 478 PDFs)
- https://archive.org/wayback/available for 94 dead links (no captures opened)
sources_added:
- constitution-absentee-shawnee-tribe-of-indians-of-oklahoma-1977-text
- constitution-absentee-shawnee-tribe-of-indians-of-oklahoma-1988-text
- constitution-ak-chin-indian-community-2005-text
- constitution-akiak-native-community-1949-text
- constitution-akiak-native-community-1949-text-2
- constitution-alabama-coushatta-tribe-of-texas-1938-text-2
- constitution-alabama-coushatta-tribe-of-texas-1990-text
- constitution-alabama-coushatta-tribe-of-texas-2016-text
- constitution-alabama-coushatta-tribe-of-texas-2023-text
- constitution-alabama-quassarte-tribal-town-1939-text
- constitution-allakaket-village-1996-text
- constitution-alutiiq-tribe-of-old-harbor-1970-text
- constitution-angoon-community-association-1963-amendment
- constitution-angoon-community-association-1964-text
- constitution-apache-tribe-of-oklahoma-1987-text
- constitution-apache-tribe-of-oklahoma-1987-text-2
- constitution-assiniboine-and-sioux-tribes-of-the-fort-peck-indian-reservation-1960-text
- constitution-assiniboine-and-sioux-tribes-of-the-fort-peck-indian-reservation-2013-text
- constitution-bad-river-band-of-the-lake-superior-tribe-of-chippewa-indians-of-the-bad-river-reservation-1978-amendment
- constitution-bad-river-band-of-the-lake-superior-tribe-of-chippewa-indians-of-the-bad-river-reservation-1978-text
- constitution-bay-mills-indian-community-1936-text-2
- constitution-big-lagoon-rancheria-1985-text
- constitution-birch-creek-tribe-1999-text
- constitution-blackfeet-tribe-of-the-blackfeet-indian-reservation-of-montana-1935-text-2
- constitution-blackfeet-tribe-of-the-blackfeet-indian-reservation-of-montana-1950-amendment
- constitution-blackfeet-tribe-of-the-blackfeet-indian-reservation-of-montana-1950-text
- constitution-blackfeet-tribe-of-the-blackfeet-indian-reservation-of-montana-1978-text
- constitution-blackfeet-tribe-of-the-blackfeet-indian-reservation-of-montana-1998-text
- constitution-blue-lake-rancheria-2001-text
- constitution-bridgeport-indian-colony-1994-text
- constitution-caddo-nation-of-oklahoma-1976-text
- constitution-caddo-nation-of-oklahoma-2002-amendment
- constitution-caddo-nation-of-oklahoma-2002-text
- constitution-cahto-tribe-of-the-laytonville-rancheria-1971-text
- constitution-cahto-tribe-of-the-laytonville-rancheria-2006-text
- constitution-central-council-of-the-tlingit-and-haida-indian-tribes-2013-text
- constitution-chemehuevi-indian-tribe-of-the-chemehuevi-reservation-1993-text
- constitution-cher-ae-heights-indian-community-of-the-trinidad-rancheria-1961-text
- constitution-cherokee-nation-1975-proposed
- constitution-cherokee-nation-1976-text
- constitution-cherokee-nation-2003-text
- constitution-cheyenne-and-arapaho-tribes-1937-text
- constitution-cheyenne-and-arapaho-tribes-1982-text
- constitution-cheyenne-and-arapaho-tribes-2021-text
- constitution-cheyenne-river-sioux-tribe-of-the-cheyenne-river-reservation-1992-text
- constitution-chilkat-indian-village-1959-text
- constitution-chilkat-indian-village-2006-text
- constitution-chilkoot-indian-association-1941-text
- constitution-chilkoot-indian-association-1941-text-2
- constitution-chippewa-cree-indians-of-the-rocky-boys-reservation-1935-text-2
- constitution-chippewa-cree-indians-of-the-rocky-boys-reservation-1935-text-3
- constitution-chitimacha-tribe-of-louisiana-2010-text
- constitution-chitimacha-tribe-of-louisiana-2018-text
- constitution-citizen-potawatomi-nation-1987-text
- constitution-colorado-river-indian-tribes-of-the-colorado-river-indian-reservation-1975-text
- constitution-confederated-tribes-of-the-coos-lower-umpqua-and-siuslaw-indians-2026-text
- constitution-confederated-tribes-of-the-umatilla-indian-reservation-1949-text-2
- constitution-confederated-tribes-of-the-umatilla-indian-reservation-1992-text
- constitution-confederated-tribes-of-the-umatilla-indian-reservation-2021-text
- constitution-confederated-tribes-of-the-warm-springs-reservation-of-oregon-1938-text
- constitution-confederated-tribes-of-the-warm-springs-reservation-of-oregon-1973-amendment
- constitution-confederated-tribes-of-the-warm-springs-reservation-of-oregon-1973-text
- constitution-confederated-tribes-of-the-warm-springs-reservation-of-oregon-1990-amendment
- constitution-confederated-tribes-of-the-warm-springs-reservation-of-oregon-1992-amendment
- constitution-confederated-tribes-of-the-warm-springs-reservation-of-oregon-1992-text
- constitution-coyote-valley-band-of-pomo-indians-of-california-2012-text
- constitution-craig-tribal-association-1938-text-2
- constitution-craig-tribal-association-1938-text-3
- constitution-crow-creek-sioux-tribe-of-the-crow-creek-reservation-1949-text
- constitution-crow-tribe-of-montana-1949-text
- constitution-crow-tribe-of-montana-1949-text-2
- constitution-crow-tribe-of-montana-2001-text
- constitution-delaware-nation-2008-text
- constitution-delaware-nation-2019-text
- constitution-dry-creek-rancheria-band-of-pomo-indians-1977-text
- constitution-dry-creek-rancheria-band-of-pomo-indians-1977-text-2
- constitution-duckwater-shoshone-tribe-1940-text
- constitution-duckwater-shoshone-tribe-1966-text
- constitution-eastern-shawnee-tribe-of-oklahoma-1994-text
- constitution-eastern-shoshone-tribe-of-the-wind-river-reservation-1938-text
- constitution-eastern-shoshone-tribe-of-the-wind-river-reservation-1938-text-2
- constitution-elem-indian-colony-of-pomo-indians-of-the-sulphur-bank-rancheria-1977-text
- constitution-ely-shoshone-tribe-of-nevada-2002-amendment
- constitution-emmonak-village-2000-text
- constitution-enterprise-rancheria-of-maidu-indians-of-california-2003-text
- constitution-federated-indians-of-graton-rancheria-1997-text
- constitution-federated-indians-of-graton-rancheria-2013-text
- constitution-flandreau-santee-sioux-tribe-of-south-dakota-1936-text
- constitution-flandreau-santee-sioux-tribe-of-south-dakota-1997-text
- constitution-flandreau-santee-sioux-tribe-of-south-dakota-2022-text
- constitution-fond-du-lac-band-1964-text
- constitution-fond-du-lac-band-2006-text
- constitution-forest-county-potawatomi-community-1975-text
- constitution-forest-county-potawatomi-community-1982-text
- constitution-fort-belknap-indian-community-of-the-fort-belknap-reservation-of-montana-1935-text-2
- constitution-fort-belknap-indian-community-of-the-fort-belknap-reservation-of-montana-1993-text
- constitution-fort-belknap-indian-community-of-the-fort-belknap-reservation-of-montana-1993-text-2
- constitution-fort-belknap-indian-community-of-the-fort-belknap-reservation-of-montana-2001-text
- constitution-fort-bidwell-indian-community-of-the-fort-bidwell-reservation-of-california-1971-text
- constitution-fort-independence-indian-community-of-paiute-indians-of-the-fort-independence-reservation-1972-text
- constitution-fort-sill-chiricahua-warm-springs-apache-tribe-1977-text
- constitution-gila-river-indian-community-of-the-gila-river-indian-reservation-1974-text
- constitution-grand-traverse-band-of-ottawa-and-chippewa-indians-1988-text
- constitution-grindstone-indian-rancheria-of-wintun-wailaki-indians-of-california-1974-text
- constitution-grindstone-indian-rancheria-of-wintun-wailaki-indians-of-california-1974-text-2
- constitution-gulkana-village-council-2001-text
- constitution-gulkana-village-council-2023-text
- constitution-habematolel-pomo-of-upper-lake-2004-text
- constitution-habematolel-pomo-of-upper-lake-2024-text
- constitution-habematolel-pomo-of-upper-lake-2026-text
- constitution-hannahville-indian-community-1936-text-2
- constitution-hannahville-indian-community-2020-text
- constitution-havasupai-tribe-of-the-havasupai-reservation-2005-amendment
- constitution-ho-chunk-nation-of-wisconsin-1963-text
- constitution-ho-chunk-nation-of-wisconsin-1994-text
- constitution-hoopa-valley-tribe-2008-text
- constitution-hopi-tribe-of-arizona-1936-text-2
- constitution-hopi-tribe-of-arizona-1993-text
- constitution-hopi-tribe-of-arizona-2017-text
- constitution-hopland-band-of-pomo-indians-2009-text
- constitution-hualapai-indian-tribe-of-the-hualapai-indian-reservation-1991-text
- constitution-huslia-village-1995-text
- constitution-hydaburg-cooperative-association-1938-text-2
- constitution-iipay-nation-of-santa-ysabel-2018-text
- constitution-ione-band-of-miwok-indians-of-california-2002-text
- constitution-iowa-tribe-of-kansas-and-nebraska-1973-text
- constitution-iowa-tribe-of-kansas-and-nebraska-1980-text
- constitution-iowa-tribe-of-kansas-and-nebraska-2013-text
- constitution-iowa-tribe-of-oklahoma-2008-amendment
- constitution-iowa-tribe-of-oklahoma-2008-text
- constitution-jackson-band-of-miwuk-indians-1997-text
- constitution-jamestown-sklallam-tribe-2000-amendment
- constitution-jamestown-sklallam-tribe-2022-text
- constitution-jamul-indian-village-of-california-1981-text
- constitution-jicarilla-apache-nation-1969-text
- constitution-jicarilla-apache-nation-1990-amendment
- constitution-jicarilla-apache-nation-2000-text
- constitution-kaibab-band-of-paiute-indians-of-the-kaibab-indian-reservation-1987-text
- constitution-kaibab-band-of-paiute-indians-of-the-kaibab-indian-reservation-1994-text
- constitution-kalispel-indian-community-of-the-kalispel-reservation-2019-text
- constitution-karuk-tribe-2008-text
- constitution-kashia-band-of-pomo-indians-of-the-stewarts-point-rancheria-1967-text
- constitution-kashia-band-of-pomo-indians-of-the-stewarts-point-rancheria-1979-amendment
- constitution-kashia-band-of-pomo-indians-of-the-stewarts-point-rancheria-2011-text
- constitution-kasigluk-traditional-elders-council-2008-text
- constitution-kasigluk-traditional-elders-council-2008-text-2
- constitution-kaw-nation-1990-text
- constitution-kaw-nation-2006-amendment
- constitution-kaw-nation-2016-text
- constitution-kenaitze-indian-tribe-1971-text
- constitution-kenaitze-indian-tribe-1997-text
- constitution-kenaitze-indian-tribe-1997-text-2
- constitution-kenaitze-indian-tribe-2019-text
- constitution-keweenaw-bay-indian-community-1936-text
- constitution-kickapoo-traditional-tribe-of-texas-2018-text
- constitution-kickapoo-tribe-of-indians-of-the-kickapoo-reservation-in-kansas-1937-text
- constitution-kickapoo-tribe-of-oklahoma-1977-text
- constitution-king-island-native-community-1939-text
- constitution-king-island-native-community-1939-text-2
- constitution-kiowa-tribe-1982-text
- constitution-kiowa-tribe-2017-text
- constitution-klamath-tribes-2013-text
- constitution-klawock-cooperative-association-1938-text
- constitution-kletsel-dehe-wintun-nation-of-the-cortina-rancheria-1973-text
- constitution-kletsel-dehe-wintun-nation-of-the-cortina-rancheria-1996-text
- constitution-knik-tribe-1991-text
- constitution-kokhanok-village-2004-text
- constitution-kootenai-tribe-of-idaho-1947-text-2
- constitution-koyukuk-native-village-1994-text
- constitution-la-jolla-band-of-luiseno-indians-1962-text
- constitution-la-posta-band-of-diegueno-mission-indians-of-the-la-posta-indian-reservation-1973-text
- constitution-lac-courte-oreilles-band-of-lake-superior-chippewa-indians-of-wisconsin-1980-amendment
- constitution-lac-courte-oreilles-band-of-lake-superior-chippewa-indians-of-wisconsin-1992-amendment
- constitution-lac-courte-oreilles-band-of-lake-superior-chippewa-indians-of-wisconsin-1992-amendment-2
- constitution-lac-du-flambeau-band-of-lake-superior-chippewa-indians-of-the-lac-du-flambeau-reservation-of-wisconsin-1953-text
- constitution-lac-du-flambeau-band-of-lake-superior-chippewa-indians-of-the-lac-du-flambeau-reservation-of-wisconsin-1974-amendment
- constitution-lac-du-flambeau-band-of-lake-superior-chippewa-indians-of-the-lac-du-flambeau-reservation-of-wisconsin-1985-amendment
- constitution-lac-du-flambeau-band-of-lake-superior-chippewa-indians-of-the-lac-du-flambeau-reservation-of-wisconsin-2005-text
- constitution-lac-vieux-desert-band-of-lake-superior-chippewa-indians-of-michigan-1992-text
- constitution-little-river-band-of-ottawa-indians-1998-text
- constitution-little-shell-tribe-of-chippewa-indians-of-montana-2015-text
- constitution-little-traverse-bay-bands-of-odawa-indians-2005-text
- constitution-lovelock-paiute-tribe-of-the-lovelock-indian-colony-1968-text
- constitution-lower-brule-sioux-tribe-of-the-lower-brule-reservation-1942-text
- constitution-lower-brule-sioux-tribe-of-the-lower-brule-reservation-1987-amendment
- constitution-lower-sioux-indian-community-in-the-state-of-minnesota-1977-text
- constitution-lower-sioux-indian-community-in-the-state-of-minnesota-2007-text
- constitution-lumbee-tribe-of-north-carolina-2003-text
- constitution-makah-indian-tribe-of-the-makah-indian-reservation-1936-text
- constitution-manchester-band-of-pomo-indians-of-the-manchester-rancheria-1981-text
- constitution-manzanita-band-of-diegueno-mission-indians-of-the-manzanita-reservation-1976-text
- constitution-mashantucket-pequot-indian-tribe-1988-text
- constitution-mashpee-wampanoag-tribe-2004-text
- constitution-menominee-indian-tribe-of-wisconsin-1990-amendment
- constitution-menominee-indian-tribe-of-wisconsin-1991-text
- constitution-mesa-grande-band-of-diegueno-mission-indians-of-the-mesa-grande-reservation-1972-text
- constitution-mesa-grande-band-of-diegueno-mission-indians-of-the-mesa-grande-reservation-2023-text
- constitution-mescalero-apache-tribe-of-the-mescalero-reservation-1981-text
- constitution-mescalero-apache-tribe-of-the-mescalero-reservation-1988-text
- constitution-miami-tribe-of-oklahoma-1964-amendment
- constitution-miami-tribe-of-oklahoma-2008-text
- constitution-miccosukee-tribe-of-indians-1977-text
- constitution-middletown-rancheria-of-pomo-indians-of-california-2005-text
- constitution-minnesota-chippewa-tribe-1964-text
- constitution-minnesota-chippewa-tribe-1972-text
- constitution-minnesota-chippewa-tribe-2006-text
- constitution-mississippi-band-of-choctaw-indians-1975-text
- constitution-mississippi-band-of-choctaw-indians-2006-amendment
- constitution-modoc-nation-1990-text
- constitution-modoc-nation-2007-amendment
- constitution-modoc-nation-2007-text
- constitution-mooretown-rancheria-of-maidu-indians-of-california-1999-text
- constitution-native-village-of-afognak-2002-text
- constitution-native-village-of-akutan-1991-text
- constitution-native-village-of-atka-1939-text-2
- constitution-native-village-of-atka-1939-text-3
- constitution-native-village-of-barrow-inupiat-traditional-government-1940-text
- constitution-native-village-of-cantwell-1968-text
- constitution-native-village-of-chenega-1940-text
- constitution-native-village-of-chignik-lagoon-2026-text
- constitution-native-village-of-chitina-2026-text
- constitution-native-village-of-deering-1945-text
- constitution-native-village-of-diomede-1940-text
- constitution-native-village-of-eagle-1989-text
- constitution-native-village-of-eyak-1980-text
- constitution-native-village-of-eyak-2023-text
- constitution-native-village-of-false-pass-1990-text
- constitution-native-village-of-fort-yukon-1940-text
- constitution-native-village-of-fort-yukon-1940-text-2
- constitution-native-village-of-fort-yukon-1940-text-3
- constitution-native-village-of-gambell-1939-text
- constitution-native-village-of-gambell-1939-text-2
- constitution-native-village-of-kanatak-1941-text
- constitution-native-village-of-kanatak-2001-text
- constitution-native-village-of-karluk-1939-text
- constitution-native-village-of-kivalina-1940-text
- constitution-native-village-of-kotzebue-1947-text
- constitution-native-village-of-koyuk-1946-text
- constitution-native-village-of-kwigillingok-1949-text
- constitution-native-village-of-minto-1939-text-2
- constitution-native-village-of-nanwalek-1995-text
- constitution-native-village-of-napaimute-2002-text
- constitution-native-village-of-noatak-1939-text-2
- constitution-native-village-of-nunapitchuk-1940-text
- constitution-native-village-of-perryville-1950-text
- constitution-native-village-of-point-hope-1940-text
- constitution-native-village-of-point-lay-1946-text
- constitution-native-village-of-point-lay-1946-text-2
- constitution-native-village-of-savoonga-1940-text
- constitution-native-village-of-savoonga-1940-text-2
- constitution-native-village-of-selawik-1940-text
- constitution-native-village-of-shaktoolik-1940-text
- constitution-native-village-of-shaktoolik-1940-text-2
- constitution-native-village-of-shungnak-1946-text-2
- constitution-native-village-of-stevens-1990-text
- constitution-native-village-of-stevens-1990-text-2
- constitution-native-village-of-tanacross-1942-text
- constitution-native-village-of-tanacross-1942-text-2
- constitution-native-village-of-tanana-1939-text
- constitution-native-village-of-tanana-1947-text
- constitution-native-village-of-tanana-1989-text
- constitution-native-village-of-tanana-1989-text-2
- constitution-native-village-of-tatitlek-1939-text-2
- constitution-native-village-of-tatitlek-1946-text
- constitution-native-village-of-tetlin-1940-text
- constitution-native-village-of-tetlin-1940-text-2
- constitution-native-village-of-tununak-1939-text
- constitution-native-village-of-tununak-1947-text
- constitution-native-village-of-tyonek-1939-text-2
- constitution-native-village-of-tyonek-1939-text-3
- constitution-native-village-of-unalakleet-1939-text-2
- constitution-native-village-of-unga-1989-text
- constitution-native-village-of-venetie-tribal-government-1940-text
- constitution-native-village-of-venetie-tribal-government-1940-text-2
- constitution-native-village-of-wales-1939-text-2
- constitution-native-village-of-white-mountain-1939-text
- constitution-nez-perce-tribe-2005-text
- constitution-ninilchik-village-2010-text
- constitution-nisqually-indian-tribe-1994-text
- constitution-nome-eskimo-community-1939-text
- constitution-nome-eskimo-community-1939-text-2
- constitution-nooksack-indian-tribe-2013-text
- constitution-noorvik-native-community-1939-text-2
- constitution-noorvik-native-community-1939-text-3
- constitution-northern-arapaho-tribe-of-the-wind-river-reservation-1938-text
- constitution-northern-arapaho-tribe-of-the-wind-river-reservation-1938-text-2
- constitution-northern-cheyenne-tribe-of-the-northern-cheyenne-indian-reservation-1996-text
- constitution-northern-cheyenne-tribe-of-the-northern-cheyenne-indian-reservation-1996-text-2
- constitution-northern-cheyenne-tribe-of-the-northern-cheyenne-indian-reservation-1996-text-3
- constitution-northern-cheyenne-tribe-of-the-northern-cheyenne-indian-reservation-1996-text-4
- constitution-northway-village-2004-text
- constitution-nottawaseppi-huron-band-of-the-potawatomi-2013-text
- constitution-nulato-village-1998-text
- constitution-nunakauyarmiut-tribe-1996-text
- constitution-oglala-sioux-tribe-1969-text
- constitution-oglala-sioux-tribe-1985-text
- constitution-oglala-sioux-tribe-2008-text
- constitution-omaha-tribe-of-nebraska-2025-text
- constitution-oneida-nation-2015-text
- constitution-organized-village-of-grayling-1964-amendment
- constitution-organized-village-of-kake-1948-text
- constitution-organized-village-of-kake-1948-text-2
- constitution-organized-village-of-kasaan-1938-text
- constitution-organized-village-of-kwethluk-1940-text
- constitution-organized-village-of-kwethluk-1940-text-2
- constitution-otoe-missouria-tribe-of-indians-2009-text
- constitution-ottawa-tribe-of-oklahoma-1980-text
- constitution-ottawa-tribe-of-oklahoma-1980-text-2
- constitution-pala-band-of-mission-indians-1973-text
- constitution-pascua-yaqui-tribe-of-arizona-1988-text
- constitution-pascua-yaqui-tribe-of-arizona-2015-text
- constitution-paskenta-band-of-nomlaki-indians-of-california-1993-text
- constitution-paskenta-band-of-nomlaki-indians-of-california-1998-text
- constitution-pauma-band-of-luiseno-mission-indians-of-the-pauma-and-yuima-reservation-1966-text
- constitution-pawnee-nation-of-oklahoma-1938-text
- constitution-pawnee-nation-of-oklahoma-1998-text
- constitution-pawnee-nation-of-oklahoma-2003-text
- constitution-pawnee-nation-of-oklahoma-2008-text
- constitution-pawnee-nation-of-oklahoma-2021-text
- constitution-peoria-tribe-of-indians-of-oklahoma-1939-text-2
- constitution-peoria-tribe-of-indians-of-oklahoma-1981-text
- constitution-peoria-tribe-of-indians-of-oklahoma-1997-text
- constitution-petersburg-indian-association-1948-text-2
- constitution-picayune-rancheria-of-chukchansi-indians-of-california-1988-text
- constitution-pit-river-tribe-1987-text
- constitution-pit-river-tribe-1987-text-2
- constitution-platinum-traditional-village-1994-text
- constitution-poarch-band-of-creek-indians-1985-text
- constitution-pokagon-band-of-potawatomi-indians-2010-text
- constitution-ponca-tribe-of-indians-of-oklahoma-1950-text-2
- constitution-ponca-tribe-of-nebraska-1994-text
- constitution-port-gamble-sklallam-tribe-2024-text
- constitution-potter-valley-tribe-2004-text
- constitution-prairie-band-potawatomi-nation-1965-text
- constitution-prairie-band-potawatomi-nation-2007-text
- constitution-prairie-island-indian-community-in-the-state-of-minnesota-1936-text-2
- constitution-prairie-island-indian-community-in-the-state-of-minnesota-1936-text-3
- constitution-prairie-island-indian-community-in-the-state-of-minnesota-2017-text
- constitution-pribilof-islands-aleut-communities-of-st-paul-and-st-george-islands-1950-text-2
- constitution-pueblo-of-isleta-1947-text
- constitution-pueblo-of-isleta-1947-text-2
- constitution-pueblo-of-isleta-1970-text
- constitution-pueblo-of-isleta-2014-text
- constitution-pueblo-of-santa-clara-1935-text-2
- constitution-pueblo-of-santa-clara-1939-text
- constitution-pyramid-lake-paiute-tribe-of-the-pyramid-lake-reservation-1936-text
- constitution-qagan-tayagungin-tribe-of-sand-point-2004-text
- constitution-qawalangin-tribe-of-unalaska-1997-text
- constitution-quartz-valley-indian-community-of-the-quartz-valley-reservation-of-california-1939-text-2
- constitution-quechan-tribe-of-the-fort-yuma-indian-reservation-1974-text
- constitution-quileute-tribe-of-the-quileute-reservation-2026-text
- constitution-red-cliff-band-of-lake-superior-chippewa-indians-of-wisconsin-1936-text-2
- constitution-red-cliff-band-of-lake-superior-chippewa-indians-of-wisconsin-1991-text
- constitution-red-lake-band-of-chippewa-indians-1979-text
- constitution-red-lake-band-of-chippewa-indians-1996-text
- constitution-redding-rancheria-1989-text
- constitution-redwood-valley-or-little-river-band-of-pomo-indians-of-the-redwood-valley-rancheria-california-1987-text
- constitution-rincon-band-of-luiseno-indians-1968-text
- constitution-robinson-rancheria-1995-text
- constitution-robinson-rancheria-1995-text-2
- constitution-rosebud-sioux-tribe-of-the-rosebud-indian-reservation-1935-text
- constitution-rosebud-sioux-tribe-of-the-rosebud-indian-reservation-1966-text
- constitution-rosebud-sioux-tribe-of-the-rosebud-indian-reservation-2007-text
- constitution-rosebud-sioux-tribe-of-the-rosebud-indian-reservation-2007-text-2
- constitution-round-valley-indian-tribes-round-valley-reservation-1975-text
- constitution-round-valley-indian-tribes-round-valley-reservation-1994-text
- constitution-round-valley-indian-tribes-round-valley-reservation-1994-text-2
- constitution-round-valley-indian-tribes-round-valley-reservation-2006-amendment
- constitution-sac-and-fox-nation-1991-text
- constitution-sac-and-fox-nation-2004-text
- constitution-sac-and-fox-nation-of-missouri-in-kansas-and-nebraska-1990-text
- constitution-sac-and-fox-tribe-of-the-mississippi-in-iowa-1937-text
- constitution-saginaw-chippewa-indian-tribe-of-michigan-1937-text-2
- constitution-saginaw-chippewa-indian-tribe-of-michigan-1986-text
- constitution-saint-regis-mohawk-tribe-1995-text
- constitution-salt-river-pima-maricopa-indian-community-of-the-salt-river-reservation-2024-text
- constitution-san-carlos-apache-tribe-of-the-san-carlos-reservation-1947-text
- constitution-san-juan-southern-paiute-tribe-of-arizona-1996-text
- constitution-san-pasqual-band-of-diegueno-mission-indians-of-california-1971-text
- constitution-santa-rosa-indian-community-of-the-santa-rosa-rancheria-1963-text
- constitution-santa-ynez-band-of-chumash-mission-indians-of-the-santa-ynez-reservation-1964-text
- constitution-santee-sioux-nation-1936-text-2
- constitution-sault-ste-marie-tribe-of-chippewa-indians-1975-text
- constitution-scotts-valley-band-of-pomo-indians-of-california-1992-proposed
- constitution-scotts-valley-band-of-pomo-indians-of-california-1994-text
- constitution-seldovia-village-tribe-2010-text
- constitution-seneca-cayuga-nation-1937-text-2
- constitution-seneca-cayuga-nation-1973-amendment
- constitution-seneca-cayuga-nation-1990-text
- constitution-seneca-cayuga-nation-2023-text
- constitution-seneca-nation-of-indians-1898-text
- constitution-seneca-nation-of-indians-2026-text
- constitution-shageluk-native-village-1949-text-2
- constitution-shakopee-mdewakanton-sioux-community-of-minnesota-1969-text
- constitution-shakopee-mdewakanton-sioux-community-of-minnesota-1980-text
- constitution-sherwood-valley-rancheria-of-pomo-indians-of-california-1974-text
- constitution-shingle-springs-band-of-miwok-indians-shingle-springs-rancheria-1976-text
- constitution-shinnecock-indian-nation-2015-text
- constitution-shoalwater-bay-indian-tribe-of-the-shoalwater-bay-indian-reservation-2022-text
- constitution-shoshone-bannock-tribes-of-the-fort-hall-reservation-2013-text
- constitution-shoshone-bannock-tribes-of-the-fort-hall-reservation-2013-text-2
- constitution-sisseton-wahpeton-oyate-of-the-lake-traverse-reservation-1946-text-2
- constitution-sisseton-wahpeton-oyate-of-the-lake-traverse-reservation-2006-text
- constitution-skagway-village-2018-text
- constitution-skagway-village-2021-text
- constitution-skokomish-indian-tribe-1980-text
- constitution-sokaogon-chippewa-community-1938-text
- constitution-sokaogon-chippewa-community-1973-amendment
- constitution-southern-ute-indian-tribe-of-the-southern-ute-reservation-1936-text
- constitution-southern-ute-indian-tribe-of-the-southern-ute-reservation-1975-text
- constitution-southern-ute-indian-tribe-of-the-southern-ute-reservation-1991-text
- constitution-spirit-lake-tribe-1996-text
- constitution-spokane-tribe-of-the-spokane-reservation-2020-text
- constitution-spokane-tribe-of-the-spokane-reservation-2021-text
- constitution-squaxin-island-tribe-of-the-squaxin-island-reservation-1965-text
- constitution-standing-rock-sioux-tribe-of-north-and-south-dakota-2008-text
- constitution-stebbins-community-association-1939-text-2
- constitution-stillaguamish-tribe-of-indians-of-washington-1953-text
- constitution-stillaguamish-tribe-of-indians-of-washington-1986-text
- constitution-stillaguamish-tribe-of-indians-of-washington-1986-text-2
- constitution-stockbridge-munsee-community-1937-text
- constitution-stockbridge-munsee-community-1995-amendment
- constitution-stockbridge-munsee-community-1995-text
- constitution-suquamish-indian-tribe-of-the-port-madison-reservation-1965-text
- constitution-suquamish-indian-tribe-of-the-port-madison-reservation-1965-text-2
- constitution-suquamish-indian-tribe-of-the-port-madison-reservation-1978-amendment
- constitution-susanville-indian-rancheria-2005-text
- constitution-swinomish-indian-tribal-community-2017-text
- constitution-sycuan-band-of-the-kumeyaay-nation-1972-text
- constitution-table-mountain-rancheria-1980-text
- constitution-te-moak-tribe-of-western-shoshone-indians-of-nevada-1982-text
- constitution-the-chickasaw-nation-1984-text
- constitution-the-chickasaw-nation-2002-text
- constitution-the-chickasaw-nation-2002-text-2
- constitution-the-choctaw-nation-of-oklahoma-1838-text
- constitution-the-choctaw-nation-of-oklahoma-1842-text
- constitution-the-choctaw-nation-of-oklahoma-1850-text
- constitution-the-choctaw-nation-of-oklahoma-1857-text
- constitution-the-choctaw-nation-of-oklahoma-1860-text
- constitution-the-choctaw-nation-of-oklahoma-1979-proposed
- constitution-the-choctaw-nation-of-oklahoma-1983-text
- constitution-the-muscogee-nation-1979-text
- constitution-the-muscogee-nation-1979-text-2
- constitution-the-osage-nation-2024-text
- constitution-the-seminole-nation-of-oklahoma-1969-text
- constitution-the-seminole-nation-of-oklahoma-1989-text
- constitution-three-affiliated-tribes-of-the-fort-berthold-reservation-1974-amendment
- constitution-three-affiliated-tribes-of-the-fort-berthold-reservation-1975-text
- constitution-three-affiliated-tribes-of-the-fort-berthold-reservation-1986-amendment
- constitution-timbisha-shoshone-tribe-1986-text
- constitution-tohono-oodham-nation-of-arizona-1986-text
- constitution-tolowa-dee-ni-nation-2024-text
- constitution-tonto-apache-tribe-of-arizona-1979-text
- constitution-tulalip-tribes-of-washington-1968-text
- constitution-tulalip-tribes-of-washington-1974-amendment
- constitution-tulalip-tribes-of-washington-1991-amendment
- constitution-tulalip-tribes-of-washington-1991-amendment-2
- constitution-tule-river-indian-tribe-of-the-tule-river-reservation-1940-text
- constitution-tule-river-indian-tribe-of-the-tule-river-reservation-1974-text
- constitution-tule-river-indian-tribe-of-the-tule-river-reservation-1974-text-2
- constitution-tule-river-indian-tribe-of-the-tule-river-reservation-1974-text-3
- constitution-tuluksak-native-community-1949-text
- constitution-tuolumne-band-of-me-wuk-indians-of-the-tuolumne-rancheria-of-california-1937-text
- constitution-tuolumne-band-of-me-wuk-indians-of-the-tuolumne-rancheria-of-california-2001-text
- constitution-turtle-mountain-band-of-chippewa-indians-of-north-dakota-1990-text
- constitution-turtle-mountain-band-of-chippewa-indians-of-north-dakota-2015-text
- constitution-twenty-nine-palms-band-of-mission-indians-of-california-1972-text
- constitution-united-keetoowah-band-of-cherokee-indians-in-oklahoma-1950-text
- constitution-upper-mattaponi-tribe-2023-text
- constitution-upper-sioux-community-1995-text
- constitution-upper-skagit-indian-tribe-1977-text
- constitution-ute-indian-tribe-of-the-uintah-and-ouray-reservation-1937-text
- constitution-ute-mountain-ute-tribe-1950-text
- constitution-utu-utu-gwaitu-paiute-tribe-of-the-benton-paiute-reservation-1979-text
- constitution-village-of-dot-lake-2016-text
- constitution-village-of-kotlik-2006-text
- constitution-village-of-red-devil-1989-text
- constitution-walker-river-paiute-tribe-of-the-walker-river-reservation-1937-text
- constitution-wampanoag-tribe-of-gay-head-1990-text
- constitution-washoe-tribe-of-nevada-and-california-1979-amendment
- constitution-washoe-tribe-of-nevada-and-california-1990-text
- constitution-washoe-tribe-of-nevada-and-california-1990-text-2
- constitution-white-earth-band-1972-text
- constitution-white-mountain-apache-tribe-of-the-fort-apache-reservation-1974-text
- constitution-white-mountain-apache-tribe-of-the-fort-apache-reservation-1993-text
- constitution-wilton-rancheria-2011-text
- constitution-winnebago-tribe-of-nebraska-1994-text
- constitution-winnemucca-indian-colony-of-nevada-1971-text
- constitution-winnemucca-indian-colony-of-nevada-1971-text-2
- constitution-wrangell-cooperative-association-1947-text
- constitution-wyandotte-nation-1937-text-2
- constitution-wyandotte-nation-1985-text
- constitution-wyandotte-nation-1999-text
- constitution-yankton-sioux-tribe-of-south-dakota-1998-text
- constitution-yavapai-apache-nation-of-the-camp-verde-indian-reservation-1992-text
- constitution-yavapai-prescott-indian-tribe-1975-text
- constitution-yocha-dehe-wintun-nation-1976-text
- constitution-yomba-shoshone-tribe-of-the-yomba-reservation-2014-text
- constitution-yurok-tribe-of-the-yurok-reservation-1993-text
- constitution-zuni-tribe-of-the-zuni-reservation-2014-text
limits: >-
  The 120 Library of Congress copies that profiles cite were not fetched (the site blocks automated
  access), and Wayback Machine copies of dead links could not be opened. AI reviewers read the title,
  opening, closing and headings of each document and at most 3,500 characters of each article; none of
  their readings has been checked by the lead author. Scanned texts have reading errors, and 154
  documents have no legible date. Changes between versions are inferred by script and none was read
  side by side. Constitutions not online, or kept by nations for their citizens, were not sought.
  "None found" for 160 nations is not a finding that a nation has no written constitution.
---

Output: the catalog in [`research/constitutions/`](../../constitutions/README.md)
(coverage by nation, documents and articles), 200 version histories in
`content/documents/`, 500 source records, and a `document_version` on 300
profile facts that cite a text a later version replaced, naming the version
they describe. The scripts are in `scripts/constitutions/`.

Method: governing-document links already in the profiles were the starting
point; each nation's own site was then crawled for constitution links, and the
National Indian Law Library, the Tribal Law and Policy Institute list and the
Bureau of Indian Affairs files on the Internet Archive were added. Each
document was read (text layer, page text, or optical character recognition)
and split into articles; a word match tied articles to tracked topics. The
University of Oklahoma pages were classified and dated by rule; every other
document was classified by an AI reviewer from its opening, closing and
headings. Copies of one text were grouped, versions ordered by date, and the
articles of each nation's newest text summarized by AI reviewers.

Findings:

- 125 nations have a current text on their own site; 51 more have a dated
  text whose currency is not known; 174 have only the University of Oklahoma
  pages or the Bureau's files, which are often decades old.
- 200 nations have two or more dated versions, 540 versions in all. The
  Bureau's files hold many texts no other source had, especially for Alaska
  villages and California rancherias.
- In the newest texts, the AI reviewers confirmed 134 articles on judicial
  power, 99 on dispute resolution, 75 on election disputes, 58 on sovereign
  immunity and 11 on peacemaking or traditional dispute resolution.
- 189 distinct texts say amendments need the Secretary of the Interior's approval; 3
  say that requirement was removed.
- The Native Village of Eek's council wrote in 2013 that it has no written
  constitution; it is recorded as the nation's statement.
- Many documents were filed under the wrong nation by the sources (Tanana
  Chiefs Conference articles under several villages; Montana and Wyoming
  scans under one nation); 81 were moved to the nation the text names.

Ruled out: the Federal Register (few constitution notices); scraping the
Library of Congress around its access check.
