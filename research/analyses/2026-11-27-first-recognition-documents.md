# First federal recognition documents for Native nations

Nov. 27, 2026. Thread "Find each nation's first federal recognition document". Trevor asked: nation pages say "This site has not yet found the document by which the United States first recognized this nation. The federal list is the current record of its status." Can we get those documents?

Script: `scripts/tribes/first_recognition.py` (steps `fetch`, `appearances`, `candidates`). Review table: `research/reviews/first-recognition/candidates.csv`, one row per federal nation. List matches: `research/raw/2026-11-27/recognition-list-appearances.json`; reviewers' answers: `research/reviews/first-recognition/list-appearance-reviews.json`. Nothing on any nation page changes in this step.

## How many nations show the gap

581 profiles carry federal recognition from the Jan. 30, 2026 list, 91 Fed. Reg. 4102. 523 of them show the gap sentence. The other 58 already cite their own basis through `scripts/tribes/recognition_basis.py`: an Act of Congress (38), a final determination under 25 C.F.R. pt. 83 (18) or an administrative decision (2). Basis: the profiles under `content/tribes/`, counted with the same rule as `site/src/lib/recognition-explanation.ts` (the gap shows when every federal fact is the list entry).

## What the project already held

For the 523, existing records give these candidates (a nation can have several):

- A ratified treaty linked on its profile (`treaties`): 128 nations. Every link is marked `verification: inferred`. Each was made by name from Kappler's treaty headers, not from a source that names the successor nation. Many treaties are linked to several nations.
- An instrument that first set aside its land (`land_establishment`, "First set aside"): 105 nations. These are mostly executive orders and statutes, read in full with the instrument's words quoted.
- A constitution approved under the Indian Reorganization Act of 1934, the Oklahoma Indian Welfare Act of 1936 or the Act of May 1, 1936 (Alaska) (`government_structure` with a dated version in the nation's constitution history): 172 nations. The dates come from the constitutions' certificates, read by rule (`content/documents/*/*-constitution.yaml`).

## Earliest Federal Register list for every nation

The project holds copies of 40 Bureau of Indian Affairs lists, from 44 Fed. Reg. 7235 (Feb. 6, 1979) to 91 Fed. Reg. 4102 (Jan. 30, 2026) (`scripts/law/recognition_lists.py`, PR #465; the 2021 correction notice left out). The script walks each nation back from 2026 by its names, including "previously listed as" names. It flags every match that was not an exact match on the 1979 list. Those 332 matches were checked by a reviewer model against the three closest entries on each list. I settled 22 more by searching the list texts for names (for example, "Mountain Village" for the Asacarsarmiut Tribe, "Papago Tribe" for the Tohono O'odham Nation). Where the script and the reviewer disagree, the table uses the reviewer's answer and keeps the row in review.

Earliest list for the 523 (the reviewed value): 1979: 275, 1982: 186, 1988: 26, 1985: 15, 1993: 8, 2002: 3, and one or two each for 1980, 1983, 1995, 1996, 2003 and 2014.

What the lists themselves say about Alaska. The 1979 list "did not, however, contain the names of any Alaska Native entities". In 1982 the Department added a "preliminary list" of Alaska Native entities. The 1988 list "was expanded to include nine categories of Alaska entities, including the state-chartered regional, village and urban corporations established pursuant to ANCSA". Source: Indian Entities Recognized and Eligible To Receive Services From the United States Bureau of Indian Affairs, 58 Fed. Reg. 54,364, 54,364–65 (Oct. 21, 1993). So a village first named on the 1988 list may have been named as a corporation. The table flags those.

## The proposed earliest document, by kind

The earliest-dated candidate for each of the 523: a Federal Register list 255, a treaty 127, a constitution under the reorganization Acts 86, a land instrument 55 (31 executive orders, 19 statutes, 5 other). 245 of these carry no review reason. The other 278 are flagged in `review_reasons`: every treaty link (inferred, and often shared among several nations), every constitution date read by rule, and every list match a reviewer changed or rated below high confidence.

A list entry shows only that the nation was recognized by that date, not how. It is the honest earliest record for the 157 Alaska villages and 82 California rancherias with no other candidate. For those nations the original act lies outside what the project holds.

## Leads for the gaps (not yet checked)

- California rancherias first listed in 1983 or 1985: Big Sandy, Bear River (Rohnerville), Buena Vista, Chicken Ranch, Cloverdale, Elk Valley, Greenville, Mooretown, Picayune, Pinoleville, Potter Valley, Redding and Redwood Valley. Their timing fits the stipulated judgment in *Tillie Hardwick v. United States*, No. C-79-1710-SW (N.D. Cal. 1983), which restored terminated rancherias. This is my inference from the dates alone and must be checked against the judgment itself.
- Rancherias first listed in 1993: Guidiville, Lytton, Mechoopda (Chico) and Scotts Valley. They fit the later restoration judgments (for example *Scotts Valley Band of Pomo Indians v. United States*, N.D. Cal. 1991). This is an inference too.
- The 2002 list says the Assistant Secretary – Indian Affairs "reaffirmed the formal recognition" of the King Salmon Tribe, the Shoonaq' Tribe of Kodiak and the Lower Lake Rancheria (today's Koi Nation) on Dec. 29, 2000 (67 Fed. Reg. 46,328 (July 12, 2002), preamble). These are administrative decisions to cite, like Ione and Tejon in `recognition_basis.py`.
- Reservation executive orders for nations with no linked land instrument: the Oklahoma State University database's 562 orders are already source records (PR #467), but they carry no nation links.
- IRA elections of 1934–36 (Haas, *Ten Years of Tribal Government under I.R.A.*, Table A) would date a federal act for many California and Nevada communities that never adopted an IRA constitution. The project holds Table B only.

## Open decision

Trevor is choosing what a nation page should call its "first" recognition document: the earliest dealing with the nation as a nation (recommended), only documents that expressly recognize, or every step in date order. Profiles change after that choice. Matches still in review stay marked Unverified.
