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
  detail: Ten reviewer agents searched the web for the 403 nations with no website on file (239 queries) under written rules (official sources only, no aggregators, Wikipedia or casino sites, look-alike groups refused). The tool's search limit for one turn stopped them after about 170 nations. A script then opened each page they named and kept a value only when it was found on that page. Claude read the addresses the script left out and chose by hand the 30 general office accounts listed in scripts/tribes/write_contacts.py (HAND_EMAILS).
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
  A contact page or email shows how the nation asks to be reached on the date read, not that anyone answers. Only general office addresses were added; department addresses and addresses that name a person were never copied to a profile, and the findings only count them, since the repository may be public. Contact pages that answered the script with a bot check were recorded from the link alone (verification title-only). Web search found little for Alaska villages and for groups without federal or state recognition, so "none found" there reflects what the search index holds. About 230 nations with no website were not yet searched when the search limit was reached.
---

Output:

- 312 `contact-page` facts and 82 `email-general` facts from nations' own websites, each citing the page it was read on (336 new sources in `content/sources/`);
- for nations found by web search, 23 websites, 17 phone numbers, 16 street and 6 mailing addresses, from the nation's own site or, for five South Carolina tribes, the state's directory;
- the findings, in [`contact-pages.json`](../../raw/2026-11-22/contact-pages.json) and [`contact-searches.json`](../../raw/2026-11-22/contact-searches.json);
- 751 search logs under [`research/search-logs/contacts/`](../../search-logs/README.md).

Results: before this session 211 of 954 profiles had a general email and none had a contact page. Now 293 have an email, 312 a contact page, and 469 one or the other, among them 423 of the 581 federally recognized nations. 633 profiles have a phone, email or contact page.

Method: a contact page counts only on the nation's own website. Sites shared with other nations do not count, nor the pages of regional consortia, boroughs or corporations that the federal directory lists for some villages (`OTHERS_SITES`), social media, or a department's page (enrollment, court, health and the like). An email counts only when it is a general office address, such as info@, contact@, office@, reception@ or an account named for the tribe, village or council. It must be shown on the nation's own site and belong to the site's domain or a free mail service. At most one is added per nation, and none where the profile already has one. Addresses a site hides from scripts (Muscogee Nation's are scrambled) were left alone.
