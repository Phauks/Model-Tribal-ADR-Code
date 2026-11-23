---
id: 2026-11-23-service-links-second-search
date: '2026-11-23'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: web-search
  name: Web search tool of Claude's session
  detail: 76 searches of the 150 allowed, by court or program name and state, by nation name with "tribal court", with site:<nation domain>, and for state judicial branch, state bar and intertribal lists of tribal courts. Nations with the most services without a link and lower-48 nations with their own websites came first; nations whose sites refused the project's requests on Nov. 22 were searched once, for other places only.
- kind: page-fetch
  name: curl
  detail: >-
    59 addresses fetched with the fetch helper of scripts/review/court_listings_second_pass.py (the same user agent as the earlier reviews); 45 answered with status 200 and a readable page, 8 refused the request or sent a challenge page and were logged as blocked (not worked around), 5 were dead links and 1 failed. Three more were read with curl directly: two sites' own page search (WordPress) for the word "court", and the Alaska Tribal Court Directory PDF.
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: No tool for starting separate reviewer agents was available, so Claude, in one session, read the search results and the pages and made the decisions recorded in scripts/review/service_links.py (SECOND_DECISIONS). There was no second reader.
- kind: other
  name: python3 script
  detail: scripts/review/service_links.py (second, then apply).
purpose: A second, deeper search for the 170 services (159 tribal courts) that the Nov. 22 service link review left with no link, under the lead author's rule that every listed service has a link, in his order (the service's own page, then an official directory entry, never a page that only mentions the court).
queries:
- '"<court name>" <state>, "<nation name>" tribal court, site:<nation domain> court'
- State judicial branch and state bar lists of tribal courts (South Dakota, North Dakota, Nebraska, New Mexico, Oregon, Minnesota, Montana, Arizona, Nevada, Idaho)
- Bureau of Indian Affairs Court of Indian Offenses pages for the Southern Plains and Western regions
- National American Indian Court Judges Association and Tanana Chiefs Conference lists of tribal courts
sources_added: []
limits: >-
  A link shows where a service is described, not that it operates now. The web search returns a limited number of results per query and was used once or twice per nation, so a page it did not return may still exist. Some places refused the request or sent a challenge page and were not worked around: the Minnesota Judicial Branch site, the Nevada courts' tribal resource file, two Bureau of Indian Affairs Western Region pages, one New Mexico courts address, and the Fort McDowell Yavapai Nation and Poarch Band of Creek Indians sites. The Alaska Tribal Court Directory is still the 2022 edition (a 2021 survey). Most Alaska villages left without a link have no website of their own and no active court in that directory, so a web search was made only for those with a website. Nineteen of the new links (seven decisions) and three Alaska entries left without a link are marked for the lead author.
---

Output:

- the "Second search, Nov. 23, 2026" section of [the report](../../reviews/2026-11-22-service-links.md);
- the rows changed in [`.json`](../../reviews/2026-11-22-service-links.json) and [`.csv`](../../reviews/2026-11-22-service-links.csv) (rule, link, evidence, note, question for the lead author), with the `lead_author_decision` column still empty;
- an entry for every search and every page read, finds included, in 133 [search logs](../../search-logs/README.md) under `research/search-logs/courts/` and `research/search-logs/dispute-resolution/`;
- `link` and a sentence added to `note` on 28 profile facts in 18 profiles; no `verification` level changed and no service removed.

Results: of the 170 services, 29 now have a link: 8 own pages and 21 official directory entries (one of them, the Oglala Sioux Judiciary, had already been linked to the same directory by the individual courts review). 141 keep no link.
