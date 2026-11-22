# Dispute resolution coverage search

**Status:** search results and candidates, written Nov. 22, 2026, for the lead
author, Trevor Goldsmith, to accept, change or reject (Gate 1 of the
[roadmap](../../docs/roadmap.md)). Nothing here changes a profile. A candidate
is a lead for review, not a finding about any nation's law or practice, and
"none found" means only that the places listed did not show anything on that
date.

Every count comes from
[`2026-11-22-dispute-resolution-coverage-counts.json`](2026-11-22-dispute-resolution-coverage-counts.json),
written by [`scripts/review/coverage_search.py`](../../scripts/review/coverage_search.py).
The candidates are in
[`2026-11-22-dispute-resolution-coverage.json`](2026-11-22-dispute-resolution-coverage.json)
and [`2026-11-22-dispute-resolution-coverage.csv`](2026-11-22-dispute-resolution-coverage.csv),
which has an empty `lead_author_decision` column. Each nation searched has a
search log in [`../search-logs/dispute-resolution/`](../search-logs/dispute-resolution/)
([decision record 0025](../../docs/decisions/0025-search-logs.md)).
Interpretation is labeled as project analysis.

## Why this search

Row 2 of the [dataset gap audit](../analyses/2026-11-21-dataset-gap-audit.md)
found that 395 federally recognized nations had no dispute resolution record.
The lead author asked on Nov. 22, 2026 for a standard log of how each nation
was searched, the places looked and why a search failed, so that gaps can be
found later. This search makes the first of those logs and looks for leads
the project already holds or can reach.

## What was searched

For each of the 395 nations, in this order:

1. **The project's own captures:** dispute resolution provisions read from the
   nation's law texts (`research/tribal-law/`), constitution articles marked
   dispute resolution or peacemaking in the private constitutions catalog,
   peacemaking or traditional programs listed under the profile's
   `justice_institutions`, raw research facts never carried into a profile, and
   source records found by the peacemaking and stories research.
2. **The Alaska Court System's list** of restorative justice referral plans
   made with Tribes under Alaska Criminal Rule 11(i), for the 216 Alaska nations.
3. **The nation's National Indian Law Library page** on narf.org.
4. **The nation's website, court pages and code pages** listed in its
   profile: the home page, its sitemap, the site's own search for
   "peacemaking" and "mediation" where it has one, and up to 14 pages chosen
   by link words (court, code, justice, peacemaking, mediation, dispute).

The script names its link checker honestly ("model-tribal-adr-code link
checker"), obeys robots.txt and waits one second between requests to a site.
It does not try to get past bot protection: a refusal or challenge page is
logged as `blocked`. The other 373 profiles (state-recognized, petitioning and
other groups without a record) have a log marked `not-searched`.

## Who read the results

This run had no subagent tool, so both readings were made by Claude
(Claude (AI assistant)) in the worker session itself, following the
[brief](briefs/2026-11-22-dispute-resolution-coverage.md). The first reading
judged the passages and capture leads of the 118 nations that had any. The
second reading re-opened the evidence page of every first-pass candidate (or,
for four scanned constitutions, the project's private OCR text of the same
PDF) and re-read a fixed random sample of 28 of the nations with nothing to
review (seed 20261122). A later run can repeat the first reading with small-model
batches and the second with a larger model from the same batch files.

## Results by region

| Region | Searched | Found | Candidates | None found | Partly searched | With a blocked place |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Alaska | 216 | 25 | 28 | 172 | 19 | 6 |
| Eastern | 23 | 6 | 9 | 15 | 2 | 2 |
| Eastern Oklahoma | 9 | 2 | 2 | 6 | 1 | 1 |
| Great Plains | 4 | 1 | 24 | 3 | 0 | 0 |
| Midwest | 8 | 1 | 3 | 5 | 2 | 1 |
| Northwest | 8 | 2 | 2 | 4 | 2 | 2 |
| Pacific | 81 | 13 | 48 | 47 | 21 | 20 |
| Rocky Mountain | 1 | 0 | 0 | 1 | 0 | 0 |
| Southern Plains | 10 | 1 | 3 | 6 | 3 | 2 |
| Southwest | 14 | 1 | 1 | 12 | 1 | 0 |
| Western | 21 | 3 | 3 | 13 | 5 | 3 |
| **Total** | **395** | **55** | **123** | **284** | **56** | **37** |

"Found" counts nations with at least one candidate kept after the second
reading. "Partly searched" means nothing was found but at least one place
failed (blocked, dead link, error, scanned without text, or a home page with
too few links to follow), so the log's `next_steps` names the places to try
by hand.

## Candidates

The 123 candidates come from 55 nations. Two nations account for 45 of them:
the Sisseton-Wahpeton Oyate (24, mostly the alternative dispute resolution
rules of its Judicial Code, published both on narf.org and on its own site,
and arbitration clauses in two financing agreements adopted into its code)
and Redding Rancheria (21, its claims ordinance's arbitration panels and the
binding dispute resolution clauses of its water agreement with the City of
Redding).

| Origin | Candidates |
| --- | ---: |
| Tribal law text collection (provisions read from the nation's own law) | 73 |
| Alaska Court System restorative justice plans | 22 |
| Pages fetched in this search | 15 |
| Constitutions catalog articles | 12 |
| Peacemaking research source records | 1 |

By profile field: 71 `provisions`, 31 `forums`, 20 `clauses`, 1
`training_programs`. By confidence: 74 high, 31 medium, 18 low.

Second reading: 110 confirmed, 10 changed (confidence lowered or wording
corrected), 3 not re-opened because the Fond du Lac Band's site refuses the
link checker in robots.txt, on the code host its documents use (their summaries are the tribal-law collection's
quote-checked readings of Nov. 21, 2026), and 10 set aside as not dispute
resolution:

- Seneca Nation of Indians: the Nation's page describes the Peacemakers Court
  as its court of general jurisdiction, with elected Peacemakers (two leads).
- Elk Valley Rancheria, San Juan Southern Paiute Tribe: articles titled
  dispute resolution that only give the Tribal Court jurisdiction.
- Fond du Lac Band: an appeal to a hearing officer under its employment
  rights program.
- Onondaga Nation: a history of the Great Peace, not a present forum.
- Ottawa Tribe of Oklahoma: Article X of the 1980 constitution is on filling
  vacancies (Article VII, the grievance committee, is kept).
- Sisseton-Wahpeton Oyate: an election-year rule on candidates' debts.
- Susanville Indian Rancheria: an exclusion hearing before the Business
  Council.
- Yakutat Tlingit Tribe: a training held at Yakutat whose page does not name
  the Tribe; the weak-record re-read of Nov. 21, 2026 removed the profile
  record built on it for the same reason.

The 28 sampled none-found nations were all confirmed. Every hit for a dispute
resolution word on their pages was a site search page echoing the query, a
regional borough's page, or an unrelated word ("immediate", "remediation").

## Limits

- **Readers.** One model made both readings. The second reading checked the
  evidence page, but it is not an independent reader.
- **Sites refused or missing.** 37 nations have at least one blocked place.
  Of the 43 blocked searches (22 nation websites, 10 for one regional
  organization's website, 8 code sites and 3 court sites), 36 got HTTP 403 or
  401, 4 were refused by robots.txt and 3 got a bot challenge page. 68 nations have no website in their profile.
- **Regional websites.** 77 nations, mostly Alaska villages, list a regional
  organization's website (for example Tanana Chiefs Conference, Kawerak or a
  borough) instead of their own. A search of those sites shows the
  organization's programs, not the village's, so they are logged as
  `intertribal-organization`.
- **Scanned documents.** Code and constitution PDFs without a text layer were
  not read, except four constitutions the project had already read by OCR. The
  Yavapai-Apache Nation's Arbitration Code PDF has no text layer, so its
  candidate rests on the page that lists it.
- **What was not counted.** Gaming compact dispute terms (recorded under
  `gaming`), election disputes decided by a council or board, and grants of
  judicial power that name no method were not counted, as the brief says.
  Gaming patron complaint procedures in a nation's own ordinance are kept at
  low confidence, because the ordinance calls them dispute resolution, but
  they are agency hearings, not mediation or arbitration (project analysis).
- **Absence.** Absence from public sources is not absence of practice. Many
  Alaska Tribes resolve disputes through their councils without a published
  code (project analysis).

## What is left for the lead author

1. Decide each candidate in the CSV (`lead_author_decision`): accept for the
   profile, change, or reject. Questions worth a decision first:
   - whether gaming patron complaint procedures and employee grievance
     committees belong in `dispute_resolution` (6 low-confidence candidates);
   - whether enabling clauses that only let a council create a forum belong
     in `provisions` (5 candidates);
   - whether the Nenana Peacemaking Circle plan belongs to the Nenana Native
     Association, since the plan does not name it;
   - whether the Saint Regis Mohawk Tribe's Peacemaker Court, named but not
     described, uses peacemaking or is a judge-run court;
   - which copy of the Sisseton-Wahpeton Judicial Code to cite.
2. Open the blocked places by hand in a browser (each log's `next_steps`
   names them) and add a `browser` entry to the log.
3. Ask the nations with no website, or whose only site is a regional one,
   about their dispute resolution practice, through official public contacts.

## Files

- Candidates: [JSON](2026-11-22-dispute-resolution-coverage.json),
  [CSV](2026-11-22-dispute-resolution-coverage.csv),
  [counts](2026-11-22-dispute-resolution-coverage-counts.json).
- Search logs: [`research/search-logs/dispute-resolution/`](../search-logs/dispute-resolution/).
- Brief: [`briefs/2026-11-22-dispute-resolution-coverage.md`](briefs/2026-11-22-dispute-resolution-coverage.md).
- Script: [`scripts/review/coverage_search.py`](../../scripts/review/coverage_search.py).
- Session log: [`research/sessions/2026/2026-11-22-dispute-resolution-coverage.md`](../sessions/2026/2026-11-22-dispute-resolution-coverage.md).
- The fetched pages, passages, batches and verdicts are kept in a private
  work folder outside the repository, because they hold copies of Tribal
  legal texts.
