---
id: 2026-11-22-service-links
date: '2026-11-22'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: page-fetch
  name: curl
  detail: scripts/review/service_links.py gather read 1,176 addresses (nation websites, their sitemaps and court pages, peacemaking pages), obeying robots.txt; 736 were read from the saved copies of the Nov. 22 court review instead of being fetched again, and 440 were fetched (395 with status 200, 43 failed, 2 refused and logged as blocked, not worked around). The Navajo Nation Peacemaking Program page was also fetched by hand six times, because the proxy cut off most connections to the Judicial Branch site.
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: No tool for starting separate reviewer agents was available, so Claude, in one session, read the pages for the services the earlier reviews did not settle and made the hand decisions recorded in scripts/review/service_links.py (DECISIONS).
- kind: other
  name: python3 script
  detail: scripts/review/service_links.py (gather, merge, apply).
purpose: Give every listed service (justice_institutions and dispute_resolution.forums entries) a link where an official page exists, after the lead author's rule of Nov. 22, 2026, "If we list a service, it should have a link", in his order of preference (own page, then official directory entry, else none and a search log entry).
queries:
- The service's name and words for a court, judiciary, justice or peacemaking, on the nation's website and the court pages the profile links to
- The Nov. 21 and Nov. 22 court reviews' results, matched by profile, source and name
- Linked entries of the same profile that name the same court
sources_added: []
limits: >-
  A link shows where a service is described, not that it operates now. Only the nation's own website, its court pages and the directories the Nov. 22 court review read were searched; no web search was made. The Alaska Tribal Court Directory reflects a 2021 survey. Sites that refused the project's link checker were not worked around. There was no second reader of the hand decisions.
---

Output:

- [the report](../../reviews/2026-11-22-service-links.md);
- one record per service, in [`.json`](../../reviews/2026-11-22-service-links.json) and [`.csv`](../../reviews/2026-11-22-service-links.csv), with an empty `lead_author_decision` column;
- entries for every place looked in the [search logs](../../search-logs/README.md): 200 court logs extended and 93 created under `research/search-logs/courts/`, and 11 extended and 8 created under `research/search-logs/dispute-resolution/` for peacemaking programs and forums;
- the new `service-link` check in `scripts/lint_records.py` (decision record 0014, docs/data-model.md).

Results: of 432 services without a link, 160 now link to their own page, 102 to an official directory entry, and 170 keep no link. The Navajo Nation Peacemaking Program links to https://courts.navajo-nsn.gov/indexpeacemaking.htm, the page the Judicial Branch sidebar links. Only `link` and `note` changed on the 262 facts; no `verification` level was changed and no service was removed.

Method: most links reuse what the two court reviews already fetched: 108 pages the Nov. 21 review confirmed a court on, 20 own pages and 99 directory entries from the Nov. 22 second pass, and 9 links of the same court listed twice in one profile. Claude decided the rest by hand from the pages gathered. Seventeen services are marked for the lead author: links to check, sites that refused scripts, and courts named only in a news post, a notice or a home page.
