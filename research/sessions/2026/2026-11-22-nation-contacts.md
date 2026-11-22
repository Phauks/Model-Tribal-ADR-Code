---
id: 2026-11-22-nation-contacts
date: '2026-11-22'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: page-fetch
  name: python3 urllib
  detail: scripts/tribes/find_contacts.py read the home page of the 551 nations with a website on file and up to three same-site pages each whose link words or address say contact or directory, obeying robots.txt, about one request a second per site. 41 nations' sites did not answer; pages that answered with a bot check were not worked around.
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: Ten reviewer agents searched the web for the 403 nations with no website on file (239 queries) under written rules (official sources only, no aggregators, Wikipedia or casino sites, look-alike groups refused). The tool's search limit for one turn stopped them after about 170 nations; a second round of six agents searched the other 247 later the same day (516 queries in all). A script then opened each page they named and kept a value only when it was found on that page. Claude read the addresses the script left out and chose by hand the 30 general office accounts listed in scripts/tribes/write_contacts.py (HAND_EMAILS).
- kind: other
  name: python3 script
  detail: scripts/tribes/write_contacts.py (rules, sources, search logs).
purpose: Give every nation page a way to reach the nation, after the lead author asked on Nov. 22, 2026 for each nation's email and the like, "or at least" a link to its contact page.
queries:
- Links whose words or address say contact, contact us, reach us or directory, on the nation's own website
- mailto links and email addresses on those pages
- The nation's name (and other names), state, and "tribe official website" or "contact", by web search, for nations with no website on file
sources_added: []
limits: >-
  A contact page or email shows how the nation asks to be reached on the date read, not that anyone answers. Only general office addresses were added; department addresses and addresses that name a person were never copied to a profile, and the findings only count them, since the repository may be public. Contact pages that answered the script with a bot check were recorded from the link alone (verification title-only). Web search found little for Alaska villages and for groups without federal or state recognition, so "none found" there reflects what the search index holds. Twelve records look like the same group listed twice under different names; the second record did not get the site (see below).
---

Output:

- 312 `contact-page` facts and 82 `email-general` facts from nations' own websites, each citing the page it was read on (336 new sources in `content/sources/`);
- for nations found by web search, 23 websites, 17 phone numbers, 16 street and 6 mailing addresses, from the nation's own site or, for five South Carolina tribes, the state's directory;
- the findings, in [`contact-pages.json`](../../raw/2026-11-22/contact-pages.json) and [`contact-searches.json`](../../raw/2026-11-22/contact-searches.json);
- 751 search logs under [`research/search-logs/contacts/`](../../search-logs/README.md).

Results: before this session 211 of 954 profiles had a general email and none had a contact page. Now 293 have an email, 312 a contact page, and 469 one or the other, among them 423 of the 581 federally recognized nations. 633 profiles have a phone, email or contact page.

Method: a contact page counts only on the nation's own website. Sites shared with other nations do not count, nor the pages of regional consortia, boroughs or corporations that the federal directory lists for some villages (`OTHERS_SITES`), social media, or a department's page (enrollment, court, health and the like). An email counts only when it is a general office address, such as info@, contact@, office@, reception@ or an account named for the tribe, village or council. It must be shown on the nation's own site and belong to the site's domain or a free mail service. At most one is added per nation, and none where the profile already has one. Addresses a site hides from scripts (Muscogee Nation's are scrambled) were left alone.

Second round (same day, after the first pull request): the 247 nations the search limit had cut off were searched, and 16 more nations gained a website, with 11 contact pages, 9 general emails, 10 phone numbers and 17 addresses. In all, the session added 323 contact pages, 91 general emails, 39 websites, 27 phone numbers and 39 addresses; 482 profiles now have an email or a contact page and 646 a phone, email or contact page. The search logs hold 954 records: 360 found, 549 none found, 45 partly searched.

Records that may name the same group, for the lead author to decide whether to merge them. The site found for the first record of each pair is already the second's website, so it was not added again:

- meherrin-tribe and meherrin-tribe-of-north-carolina;
- mobile-washington-county-band-of-choctaw-indians-of-south-alabama and mowa-band-of-choctaw-indians;
- amah-mutsun-band-of-ohlone-costanoan-indians and amah-mutsun-tribal-band-of-mission-san-juan-bautista;
- eastern-pequot-indians-of-connecticut and eastern-pequot-tribal-nation;
- coharie-intra-tribal-council-inc and coharie-tribe-of-north-carolina;
- pokanoket-wampanoag-federation-wampanoag-nation-pokanoket-tribe-and-bands and pokanoket-tribe-of-the-wampanoag-nation;
- duwamish-tribe and duwamish-tribal-organization.

Two pairs got the same site in the first round, since both records were searched at once:

- mattaponi-indian-tribe and mattaponi-indian-tribe-and-reservation;
- the-chicora-waccamaw-indian-people and waccamaw-indian-people (the site says the group changed its name in 2002).

Left for review, since the sites found are look-alikes or unclear (nothing added):

- koasek-abenaki-of-the-koas and the Koasek Traditional Band (site run from New Hampshire);
- san-luis-rey-band-of-mission-indians (site shared with a foundation);
- yamassee-nation and the Yamassee Native American Moors (site of a South Carolina group);
- santee-indian-tribe (the state directory names "The Santee Indian Organization");
- nipmuc-nation (nipmuc.gov is the Hassanamisco Nipmuc Band);
- cowasuck (site of a New Hampshire band);
- the three Gabrieleno records (sites of the San Gabriel Band);
- indian-canyon-band-of-coastanoan-ohlone-people (site of a nonprofit);
- caddo-adais-indians-inc (the state list names the Adai Caddo Indians of Louisiana);
- mono-lake-indian-community, nevada-city-rancheria, ramapough-lenape-nation and nanticoke-lenni-lenape-tribal-nation (name or publisher unclear).
