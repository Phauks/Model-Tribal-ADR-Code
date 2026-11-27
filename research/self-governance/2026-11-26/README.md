# Self-Governance Participant Lists, Nov. 26, 2026

Lists gathered for the [self-governance programs study](../../analyses/2026-11-26-self-governance-programs.md). Every row is Unverified. `scripts/tribes/federal_programs.py` turns them into `federal_programs` facts on the nation pages; its crosswalk of every listed name to a profile, with who decided each match, is [`../crosswalk.csv`](../crosswalk.csv), and the facts it applied are in [`../2026-11-26-batch.json`](../2026-11-26-batch.json). All are United States government works (17 U.S.C. § 105).

Each file except `smaller-programs.csv` ends with two columns from a quick name match against the federally recognized nations in `content/tribes/`: `candidate_profile` (a profile id, or empty) and `match_method` (`exact` after removing case and punctuation; `loose` after also removing words such as Tribe, Band, Indians and state names; `close` for a near spelling; `none`). Loose and close matches are candidates for a person or a small model to check, not facts.

| File | Rows | Source |
| --- | --- | --- |
| `doi-self-governance-tribes-2024-07-24.csv` | 140 | Bureau of Indian Affairs, Office of Self-Governance, [alphabetical list as of July 24, 2024](https://www.bia.gov/sites/default/files/media_document/2024_self_governance_tribes_alphabetically_as_of_07.24.24.pdf) (PDF read with pdftotext) |
| `ihs-self-governance-tribes-2025-07-01.csv` | 149 | Indian Health Service, [Self-Governance Tribes](https://www.ihs.gov/selfgovernance/tribes/) (as of July 1, 2025). The server leaves out its intermediate certificate; it was fetched by adding the issuer certificate from the certificate's AIA address, with verification on |
| `pl-102-477-plans.csv` | 84 | Interior map service [PL102_477_Contracts](https://biamaps.geoplatform.gov/server/rest/services/Hosted/PL102_477_Contracts/FeatureServer/0), plan fields only. The service's names, titles and email addresses of officials were not copied (charter, commitment 1) |
| `pl-102-477-integrated-programs.csv` | 686 | Interior map service [PL102_477_PartnerEnrollment](https://biamaps.geoplatform.gov/server/rest/services/Hosted/PL102_477_PartnerEnrollment/FeatureServer/0): each federal program merged into each plan |
| `hud-ihbg-fy2026-formula-allocations.csv` | 594 | HUD, [FY 2026 Indian Housing Block Grant formula allocations](https://www.hud.gov/sites/default/files/PIH/documents/FY26-IHBG-Formula-Allocations-Congressional-Notification.pdf); the rows add up to the list's total, $1,126,213,956 |
| `usaspending-fy2025-15-022-doi-tribal-self-governance.csv` | 143 | [USAspending API](https://api.usaspending.gov/), recipients under Assistance Listing 15.022, Oct. 1, 2024 to Sept. 30, 2025 |
| `usaspending-fy2025-93-210-ihs-self-governance-compacts.csv` | 151 | Same, Assistance Listing 93.210 |
| `usaspending-fy2025-93-441-ihs-self-determination-contracts.csv` | 197 | Same, Assistance Listing 93.441 |
| `usaspending-fy2025-14-867-hud-indian-housing-block-grants.csv` | 375 | Same, Assistance Listing 14.867 |
| `smaller-programs.csv` | 59 | Transportation self-governance compacts (news releases), FDPIR demonstration projects ([Food and Nutrition Service](https://www.fns.usda.gov/fdpir/self-determination)) and Interior's non-BIA funding agreements for fiscal year 2024 ([89 Fed. Reg. 103858](https://govinfo.gov/content/pkg/FR-2024-12-19/pdf/2024-30252.pdf)), typed from the sources |

The fetch was done with one-off scripts in the study session. The `candidate_profile` columns are the study's first guesses; the crosswalk supersedes them.
