---
id: 2026-11-23-nation-email-deep-dive
date: '2026-11-23'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: page-fetch
  name: Playwright (headless Chromium)
  detail: scripts/tribes/find_emails_deep.mjs read the 303 nations with a website on file and no general email in a browser, after their pages ran their scripts. It read the home page, the contact pages on file, and up to eight more same-site pages whose links or addresses suggest contact, about, government, council, office, staff or directory pages, with the site's sitemap. It obeyed robots.txt, waited about a second between pages of one site, and decoded addresses that Cloudflare hides from scripts. Pages that answered with a bot check were not worked around (36 sites).
- kind: other
  name: ArcGIS REST queries
  detail: The email field of the Bureau of Indian Affairs Tribal Leaders Directory (602 rows) and of the State of Alaska's list of federally recognized tribes (230 rows), both read in full on Nov. 23, 2026.
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: One reviewer agent searched the web (about 30 searches) for the 22 state-recognized groups with no website on file, under written rules (the group's own site or a state government page only, look-alike groups refused). Claude checked each address it reported on the page named, and chose by hand, for every nation, at most one general office address from all the addresses found.
- kind: other
  name: python3 script
  detail: scripts/tribes/write_email_deep_dive.py (facts, sources, search logs).
purpose: Find an official email for every nation, after the lead author asked on Nov. 23, 2026 for "a deep dive for the missing contact info," which may be used for bulk emails.
queries:
- Email addresses on the nation's own website, read in a browser (mailto links, text, addresses hidden from scripts, "name [at] tribe [dot] org")
- The email field of the federal Tribal Leaders Directory and of Alaska's tribal contacts list
- The group's name and state, with official website, contact, or the state commission on Indian affairs, by web search
sources_added: []
limits: >-
  An address shows how the nation asked to be reached when it was read, not that anyone answers it. The lead author decided on Nov. 23, 2026 that general office addresses (an office, reception, council or administration account) are published on nation pages, and that leaders' own addresses from the federal and state directories are kept only in the private outreach list in project files. So the repository holds no address that names a person, and the findings file counts the other addresses a site showed without copying them. Groups without federal or state recognition were not searched again, since two rounds of web search on Nov. 22 found little for them.
---

Output:

- 86 `email-general` facts: 60 read on the nation's own website (3 of them on sites the web search found, which were added as websites too), 19 from the federal Tribal Leaders Directory, 5 from Alaska's tribal contacts list and 2 from the Georgia Council on American Indian Concerns;
- 40 new sources in `content/sources/` (the pages the addresses were read on), and a note in the federal directory's source record that general office addresses are now recorded from it;
- the findings, with only the chosen addresses, in [`email-deep-dive.json`](../../raw/2026-11-23/email-deep-dive.json);
- searches added to 376 contacts search logs under [`research/search-logs/contacts/`](../../search-logs/README.md).

Results: before this session 302 of 947 profiles had a general email. Now 388 do, among them 338 of the 581 federally recognized nations (264 before) and 32 of the 69 state-recognized groups. 517 profiles have an email or a contact page.

The private outreach list (project files, `outreach/nation-emails.csv`, never committed) gives each nation its best address for an email: the public general address, or else the leader's address from the federal directory, or else an address a state government lists for the group. It has an address for 570 of the 581 federally recognized nations and 38 of the 69 state-recognized groups.

Method: the browser read found at least one address on 208 of the 303 sites. Most were department or staff addresses. Claude chose the general office account where a page showed one, and accepted an address on a second domain only when the nation's own page gave it as the office address (for example, the Alabama-Coushatta Tribe's info@actribe.org). Department accounts (court, health, enrollment, tourism, a district or youth council) and accounts named for an officeholder (chairman@, governor@, chief@) were not published; officeholders' accounts go to the private list. For the directories, an address counts as general when its name is an office or the tribe or village, not a person.

Left for review:

- nanticoke-indian-tribe-of-delaware and nanticoke-indian-association may name the same group: the search for the first found nanticokeindians.org, already the second's website, so the address went to the second only;
- schaghticoke-tribe: Connecticut has two Schaghticoke groups, and the site found (schaghticoke.com) is the Schaghticoke Tribal Nation's;
- grand-river-band-of-ottawa-indians: the only address is in Michigan's 2017 Indian directory, and the website that directory lists now shows unrelated content.
