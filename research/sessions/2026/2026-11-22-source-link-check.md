---
id: 2026-11-22-source-link-check
date: '2026-11-22'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: page-fetch
  name: scripts/review/source_links.py
  detail: HEAD, then GET for HTML pages, with redirects followed, at most 8 requests at once and 2 per
    site, a 20-second limit and a user agent naming the project's link checker; FederalRegister.gov
    documents were checked through the FederalRegister.gov API by document number, because the site
    answers scripts with a CAPTCHA page.
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: Wrote the script, compared its results with the second gap review's source link file and
    applied only the results both agree on.
purpose: Re-check the source record addresses that audit row 21 found all marked `history.status`
  live, and set the status where two independent checks agree that an address is gone or has moved.
queries:
- original_link (or citation.URL) of every record in content/sources/*/*.yaml
- https://www.federalregister.gov/api/v1/documents/<document number>.json
sources_added: []
sources_updated:
- gca-7-4301-alternate-dispute-resolution-office
- michigan-civil-rights-indian-directory-2016
- teichert-1999-resisting-temptations-samoan-custom
- tulalip-resolution-2024-473-alternative-court-code
- guam-misc-rules-mr-4-1-court-referred-mediation
- nigc-gaming-tribe-report-alphabetical-2025-06-17
- navajo-judicial-branch-quarterly-report-fy2025-q4
- nigc-gaming-tribe-report-by-state-2024-12-10
- ofa-list-of-petitioners-by-state-2008
- montana-code-annotated-2-1-301
- oneida-indian-nation-stories-and-heritage-page
limits: >-
  The run checked 2,902 of the 4,617 addresses before it was stopped when the second gap review
  (pull request #73) was merged with its own check of every address; the rest were not requested
  again. Only `removed` and `moved` results that both checks agree on were written; a `live`
  result changed no record. Sites that refused the request (403, 429 or a bot-check page) were
  recorded as blocked and not tried another way. No publication dates were filled in.
---

Output: `history.status` set on 11 source records (9 `removed`, 2 `moved` with the new address in `history.changes`) and the comparison written up in the "Applied" section of [the second gap review](../../reviews/2026-11-22-second-gap-review.md).

Method: `scripts/review/source_links.py check` requested each address and classed the answer: live (200 at the same address, or a download handed to a file host), moved (a redirect that keeps the page's own name), removed (404 or 410 to both requests), blocked (401, 403, 429 or a bot-check page) or unclear. `apply --agree research/reviews/2026-11-22-source-links.csv` wrote a status only where the second gap review's check found the same: gone for removed, moved to the same address for moved. It edited only the `history` block, so `archives`, comments and every other line stay as they were.

Found on the way: 760 of the 769 sources that the second gap review lists as "moved to another site" are FederalRegister.gov notices whose redirect goes to unblock.federalregister.gov, the site's CAPTCHA page for scripts. All 316 of those this run checked through the FederalRegister.gov API exist at their recorded addresses, so they have not moved.
