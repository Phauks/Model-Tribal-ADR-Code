# Dispute resolution search, second try

**Status:** search results and candidates, written Nov. 23, 2026, for the lead author, Trevor Goldsmith, to accept, change or reject (Gate 1 of the [roadmap](../../docs/roadmap.md)). Nothing here changes a profile. A candidate is a lead for review, not a finding about any nation's law or practice, and "none found" means only that the places listed did not show anything on that date.

Counts come from [`2026-11-23-dispute-resolution-retry-counts.json`](2026-11-23-dispute-resolution-retry-counts.json), written by [`scripts/review/dispute_resolution_retry.py`](../../scripts/review/dispute_resolution_retry.py). The places searched and the candidates are in [`2026-11-23-dispute-resolution-retry.json`](2026-11-23-dispute-resolution-retry.json), and the candidates also in [`2026-11-23-dispute-resolution-retry.csv`](2026-11-23-dispute-resolution-retry.csv), which has an empty `lead_author_decision` column. Interpretation is labeled as project analysis.

## Why

The first search on Nov. 22 ([review](2026-11-22-dispute-resolution-coverage.md)) left 62 nations `partly-searched`: their own websites or code pages refused the link checker, timed out or had moved. The lead author's coordinator asked on Nov. 23 to try those nations again.

## What was searched

For each of the 62 nations:

1. **Web searches** by Claude (AI assistant) search workers, at most 3 per nation, reading only official pages, the National Indian Law Library, state court lists, the Tribal Court Clearinghouse and intertribal pages, under the [brief](briefs/2026-11-23-dispute-resolution-retry.md). They are logged with method `browser`.
2. **Archived copies** of the pages that had failed, and of law and court pages found in the Wayback Machine's capture index, fetched in three rounds by the repository's "fetch archived copies" workflow. Cloud sessions cannot reach the Wayback Machine directly, so the workflow fetched them and returned them encrypted. Text was searched for dispute resolution terms; scanned PDFs were read from page images only where a lead pointed to them.
3. **The 2022 Alaska Tribal Court Directory** (Alaska Legal Services Corporation), read in full for the 21 Alaska nations. The search workers had only read parts of it, so their partial readings were replaced by this one.

| | Count |
| --- | ---: |
| Nations searched again | 62 |
| Places logged (all nations) | 294 |
| Found | 34 |
| Not found | 226 |
| Error (no answer in any round) | 22 |
| Scanned, not read | 9 |
| Blocked | 3 |

## What was found

12 candidates for 11 of the 62 nations:

- **Coeur d'Alene Tribe:** the Tribal Arbitration Act, Tribal Code ch. 4-28 (section titles in the library's index; high).
- **Yuhaaviatam of San Manuel Nation:** the San Manuel Arbitration Ordinance, SMTC ch. 24 (2004), for disputes under contracts with the Tribe, enforced by the Tribal Court (read from the scanned first page; high). Patron Dispute Regulation Nine of the Tribal Gaming Commission is logged as a gaming lead (low).
- **Eastern Shoshone Tribe:** a draft Peacemaker Court title (Title XVI, June 20, 1989) in the Shoshone and Arapaho code. The library says the tribe has not given permission for the full text to be online, so the archived text was not fetched (medium).
- **Native Village of White Mountain:** Ordinance 87-03 establishing a Court of Elders, and a Court of Elders article in its Indian Child Welfare Act ordinance (titles only; medium).
- **Red Lake Band of Chippewa Indians:** the Ojibwe Culture Based Mediation Court, a two-year federal grant program reported by Red Lake Net News in June 2007; whether it still runs is not known (medium).
- **Native Village of Kwigillingok:** its Tribal Court lists "Dispute resolution/Peacemaking" among the cases it hears (2022 directory; medium).
- **Samish Indian Nation:** a dispute resolution section in its procurement policies (4-90-060; medium) and an informal resolution section for employee grievances (5-14-002; low).
- **Confederated Tribes of the Chehalis Reservation:** the Tribal Housing Authority's Mediation and Eviction Policy (2023; medium).
- **Ponca Tribe of Indians of Oklahoma:** section 313 of its domestic violence code bars court-ordered mediation in domestic abuse cases. It is a limit, not a forum, but it bears on the model code's domestic violence rules (medium).
- **Cahto Tribe:** a Tribal Law and Policy Institute page on the Northern California Intertribal Court System, which serves Cahto and describes peacemaking (low).
- **Seminole Nation of Oklahoma:** an internal dispute resolution policy in its employment code, title only (low).

Candidates marked `inferred` were read by a search worker and not re-read by the lead session; the CSV's `note` column says which.

**Alaska nations outside the retry.** Reading the whole directory also showed 14 other Alaska nations whose entries list "Dispute resolution/Peacemaking" among the cases heard: Anvik, Minto, Paimiut, Kasigluk, Kipnuk, Nunapitchuk, Curyung, Iliamna, Qagan Tayagungin (Sand Point), St. Paul Island (Pribilof Islands Aleut Communities), Chickaloon, Eyak, Port Graham and Karluk. Each is a candidate. Seven of them (Anvik, Kipnuk, Nunapitchuk, Iliamna, St. Paul Island, Port Graham and Karluk) were `none-found` after the first search; their logs now say `found`. The first search did not read this directory, so other `none-found` Alaska logs may be worth checking against it too, but no other entry lists dispute resolution or peacemaking (project analysis of the directory's text).

## Search logs

| Change | Logs |
| --- | ---: |
| `partly-searched` to `none-found` | 41 |
| `partly-searched` to `found` | 11 |
| still `partly-searched` | 10 |
| `none-found` to `found` (directory) | 7 |
| `found`, entry added (directory) | 6 |

Curyung already has a dispute resolution record, so it has no search log; its directory entry is only in the candidates. The 10 still `partly-searched` are Chemehuevi, Eastern Shawnee, Greenville, Hualapai, Kwinhagak, Paiute Indian Tribe of Utah, Passamaquoddy, Timbisha Shoshone, Tonkawa and Yerington Paiute. Each has archived pages that did not answer in three rounds or scanned PDFs not read; their `next_steps` list them. Of the 75 logs touched, 24 are now `found`, 41 `none-found` and 10 `partly-searched`. Across all 847 dispute resolution logs, 150 are `found`, 321 `none-found`, 10 `partly-searched` and 366 `not-searched`.

## Limits

- **Search workers.** The web searches were run by AI search workers with at most 3 searches per nation. A worker's reading is not checked word for word, so their quotes are not carried into this review; only titles and plain summaries are.
- **Archived copies.** The Wayback Machine refused or dropped many requests. A capture can be years old: Red Lake's mediation court page is from 2007, and San Manuel's court page from 2010.
- **Withheld text.** The Shoshone and Arapaho draft Peacemaker Court title stays unread because the tribe has not allowed its full text online.
- **Directory.** The Alaska directory reflects what each Tribe told its makers in 2021 and 2022. It names the kind of case, not how disputes are resolved.
- **Absence.** "None found" means the places listed showed nothing on this date (project analysis). A phone call to the nation's office is the next step for those nations.

## Files

- Review: [JSON](2026-11-23-dispute-resolution-retry.json), [CSV](2026-11-23-dispute-resolution-retry.csv), [counts](2026-11-23-dispute-resolution-retry-counts.json).
- Search logs: [`research/search-logs/dispute-resolution/`](../search-logs/dispute-resolution/).
- Brief for the search workers: [`briefs/2026-11-23-dispute-resolution-retry.md`](briefs/2026-11-23-dispute-resolution-retry.md).
- Script: [`scripts/review/dispute_resolution_retry.py`](../../scripts/review/dispute_resolution_retry.py).
- Session log: [`research/sessions/2026/2026-11-23-dispute-resolution-retry.md`](../sessions/2026/2026-11-23-dispute-resolution-retry.md).
- The fetched text and page images stay private, outside the repository.
