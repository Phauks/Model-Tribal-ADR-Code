---
id: 2026-11-27-federal-awards
date: '2026-11-27'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: One session wrote scripts/tribes/federal_awards.py and ran it. Names the script could not match exactly were reviewed by three smaller Claude models, and the session read every name they accepted and changed five decisions (crosswalk rows marked `spot-check`).
- kind: page-fetch
  name: api.usaspending.gov
  detail: The search API's spending_by_category endpoints (recipient and awarding_agency), with no key, and one bulk download of the fiscal year's transactions to tribal governments to check the totals.
purpose: 'Trevor asked for federal awards ("Federal awards would be interesting", project thread "Add federal awards to nation pages", Nov. 27, 2026) and chose mockup A: a "Federal awards" group in each nation page''s Key facts with the money federal agencies obligated to the nation''s government in the latest complete fiscal year, broken down by agency.'
queries:
- USAspending recipients of the type Indian/Native American Tribal Government, Oct. 1, 2025 to Sept. 30, 2026
- USAspending obligations by awarding agency for each matched recipient, same period, all transactions
sources_added:
- usaspending-fy2026-awards-to-tribal-governments
limits: 'Only the nation''s own government is counted. Health boards and corporations, housing authorities, schools and school boards, colleges, utilities, businesses, consortia and regional organizations are separate bodies and are left out, even when their names name one nation, so for many nations the money that reaches their people through those bodies is larger than the figure shown (Acoma''s health board alone received $34.8 million against the Pueblo''s $13.8 million). Navajo chapters and Tohono O''odham districts are left out the same way. A recipient USAspending does not list as a tribal government in the year is missed unless its name was searched by hand; 21 of 581 federally recognized nations have no recipient matched, and 21 more net to nothing or less for the year and show no group. Every figure is Unverified.'
---

# Federal awards on nation pages: session notes

## What was built

`scripts/tribes/federal_awards.py` has five steps. `recipients` lists every recipient USAspending reports as an Indian/Native American Tribal Government for fiscal year 2026 (2,484 recipients) in `research/federal-awards/2026-11-27/recipients-fy2026.csv`. `match` writes `research/federal-awards/crosswalk.csv`, each recipient with the nation profile it is the government of, how that was decided and by whom; a row decided by a person or a review keeps its decision when the step runs again. `review` and `decide` hand the undecided rows to a review and merge the decisions back. `amounts` asks USAspending for each accepted recipient's obligations by awarding agency, on all of its transactions in the year, and writes `research/federal-awards/2026-11-27/fy2026-by-agency.csv`, which the site reads (`site/src/lib/server/federal-awards.ts`). Raw answers are kept in the project files under `research/captures/federal-awards/`.

## Matching

Of 2,484 recipients, 291 matched a federally recognized profile's official name, alias or former name exactly and do not look like a separate body. 1,063 share no word with any nation's names (cities, counties, states, companies) and were left out by the script. The other 1,127 were reviewed by three smaller Claude models against up to six likely profiles each, under written rules: 308 accepted as the nation's government (including a department or office named as such), 817 left out. The session read all 308 accepted names, and set five rows by hand: the Ute Indian Tribe at Fort Duchesne as the Ute Indian Tribe of the Uintah and Ouray Reservation, Arctic Village Council as part of the Native Village of Venetie Tribal Government, and the Orutsararmiut, Asa'carsarmiut and McGrath councils, which the script had wrongly set aside. 604 recipients are accepted for 560 nations; 35 nations have more than one.

## Results

$10.22 billion obligated to the governments of 560 nations in fiscal year 2026, the largest being the Cherokee Nation ($907.3 million), the Chickasaw Nation ($584.3 million) and the Navajo Nation ($463.3 million). The recipient-type filter applies to each transaction, so totals were taken by recipient over all of its transactions (the Cherokee Nation: $901.6 million on transactions tagged as a tribal government, $907.3 million in all).

## Next

Earlier fiscal years (USAspending's search reaches back to fiscal year 2008) for a trend, a table builder dataset of all nations, and a yearly refresh after each fiscal year's last reports (mid-November).
