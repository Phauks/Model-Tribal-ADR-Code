---
id: 2026-11-26-self-governance-programs
date: '2026-11-26'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: One session wrote scripts/tribes/federal_programs.py and ran it. Names the script could not match exactly were reviewed by three smaller Claude models, and a sample of their decisions was checked by the session.
- kind: page-fetch
  name: bia.gov, ihs.gov, hud.gov, fns.usda.gov, biamaps.geoplatform.gov, api.usaspending.gov, govinfo.gov
  detail: The participant lists and funding lists described in research/analyses/2026-11-26-self-governance-programs.md.
purpose: 'Trevor asked for a list of Native self-governance programs (project thread "Gather tribal self-governance programs", Nov. 26, 2026), then for the programs on each nation''s page ("somehow include it in the info for tribes", then "get it in there"). This session turns the participant lists into `federal_programs` facts on the nation profiles and a federal-ties search entry for every federally recognized nation.'
queries:
- Office of Self-Governance list of self-governance tribes, July 24, 2024
- Indian Health Service Self-Governance Tribes, as of July 1, 2025
- Interior's 477 Plan Directory map services, plan and program fields only
- HUD fiscal year 2026 Indian Housing Block Grant formula allocations
- Interior funding agreements outside the Bureau of Indian Affairs for fiscal year 2024, 89 Fed. Reg. 103858
- Food and Nutrition Service FDPIR self-determination projects, rounds 1 and 2
- News reports of Tribal Transportation Self-Governance Program compacts
- USAspending recipients for fiscal year 2025 under Assistance Listings 15.022, 93.210 and 93.441
sources_added:
- bia-office-of-self-governance-tribes-2024-07-24
- bia-pl-102-477-plan-directory
- fns-fdpir-self-determination-demonstration-projects
- usaspending-fy2025-assistance-listing-15-022
- usaspending-fy2025-assistance-listing-93-210
- usaspending-fy2025-assistance-listing-93-441
- ict-news-2024-08-20-potawatomi-transportation-compact
- citizen-potawatomi-nation-2024-05-27-transportation-compact
- wrhi-2025-02-17-catawba-transportation-compact
sources_updated:
- indian-health-service-self-governance-tribes
- hud-ihbg-fy2026-formula-allocations
- federal-register-2024-30252
limits: 'Consortia and regional organizations (the Association of Village Council Presidents, Tanana Chiefs Conference and others) hold many compacts and plans for their member nations; their members are not credited, because the lists do not name them. Health corporations are credited to a nation only when their name names it. Self-determination contracts with Interior, Tribally controlled school grants, Tribal Forest Protection Act agreements, Tribal TANF and Title IV-E plans have no per-nation list here yet. The Department of Transportation refused requests from the cloud, so its compacts come from news reports. The 477 services hold officials'' names and email addresses, which were never read into the project. Every fact is Unverified.'
---

# Self-governance and federal programs on nation pages: session notes

## What was built

`scripts/tribes/federal_programs.py` has three steps. `match` writes `research/self-governance/crosswalk.csv`, every name on every list with the nation profile it names, how that was decided and by whom; a row decided by a person or a review keeps its decision when the step runs again. `sources` writes the source records the facts cite and saves private copies under `research/captures/self-governance/` in the project files. `batch` writes `research/self-governance/2026-11-26-batch.json`, which `scripts/jurisdiction/apply.py` adds to the profiles.

## Matching

Of 1,512 names on the eight lists, 690 matched a profile's official name, alias or former name exactly, or a row of HUD's fiscal year 2025 list already matched for enrollment figures. The other 822 were reviewed by three smaller Claude models against the list of federally recognized profiles: 651 were accepted as the nation, 24 as an organization acting for one nation (recorded as `through`), and 139 were left out (regional corporations, consortia, intertribal organizations and state-recognized groups with no federal profile). The session checked 40 accepted rows at random and found no errors, and changed eight of the reviewers' least certain decisions (crosswalk rows marked `spot-check`).

## Results

1,381 facts on 578 of 581 federally recognized profiles: 266 Interior self-governance compacts (with obligations), 233 Indian Health Service compacts (with obligations), 173 Indian Health Service self-determination contract obligations, 73 477 plans, 579 housing block grant allocations, 37 Interior funding agreements outside the Bureau of Indian Affairs, 15 FDPIR projects and 5 transportation compacts. Amounts are kept apart from the lists: a fact from HUD's list is an allocation for fiscal year 2026, a fact from USAspending is the year's obligations for fiscal year 2025.

## Next

Lists for the programs with none yet (Tribal TANF, Title IV-E plans, Tribally controlled schools), the Department of Transportation's own list by hand, and the consortia's member lists, so member nations can be credited as inferred.
