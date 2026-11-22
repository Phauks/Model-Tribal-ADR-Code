# Search logs

One record per Native nation per topic, saying how the project searched for
that kind of information, every place it looked, and what each search found
or why it failed ([decision record 0025](../../docs/decisions/0025-search-logs.md)).
They exist so that an empty field in a profile can be told apart: never
searched, searched and nothing found, or blocked at certain places.

- Path: `<topic>/<letter>/<profile id>.yaml`, for example
  `dispute-resolution/a/augustine-band-of-cahuilla-indians.yaml`. The letter
  folder is the profile's (`_other` for a first character that is not a
  letter).
- Fields: [`schemas/search-log.schema.json`](../../schemas/search-log.schema.json);
  example: [`schemas/examples/search-log.example.yaml`](../../schemas/examples/search-log.example.yaml).
- Topics in use: `dispute-resolution`, `courts`, `gaming-dispute-procedures` (dispute procedures in Tribal gaming ordinances, [review of Nov. 22, 2026](../reviews/2026-11-22-ordinance-disputes.md)). A new topic is a new folder; the schema does not change.

## Adding a search

Append an entry to `searches` (never remove one), set `last_searched` to its
date, and update `status`:

| Status | When |
| --- | --- |
| `found` | At least one search found something on the topic |
| `none-found` | Every planned place was searched and nothing was found |
| `partly-searched` | Nothing found yet, but places remain (say which in `next_steps`) |
| `not-searched` | No one has searched yet |

Each entry says who searched (a person's chosen name, or "Claude (AI
assistant)"), how (`script`, `browser`, `ai-review`, `by-hand`), the kind of
place, its address, the query, the outcome and one sentence of reason. Kinds of
place are an open list; the suggested ones are `nation-website`,
`nation-code-site`, `national-indian-law-library`, `narf-tribal-law-gateway`,
`tribal-law-policy-institute`, `tribal-court-site`, `state-court-directory`,
`intertribal-organization`, `federal-register`, `database-listing`,
`project-capture` (something the project already gathered, such as
`research/tribal-law/`) and `other`.

A site that refuses the project's link checker, or shows a bot challenge, is
`blocked`, not `dead-link`. The project names its link checker honestly and
does not try to get past bot protection; a person can try the site in a
browser and add a `browser` entry.

## What a log does not say

A log records searches of public sources. "None found" does not mean a
nation has no dispute resolution practice, court or law; it means the
places listed did not show one on the date given. What a search finds goes to
a review in [`../reviews/`](../reviews/README.md) and reaches a profile only
after the lead author's review.

## Counts

`python3 scripts/coverage_report.py` counts nations by status for each topic,
dispute resolution searches by Bureau of Indian Affairs region, and failed
searches by kind of place and outcome.

## Logs so far

| Topic | Nations | Made by | Review |
| --- | --- | --- | --- |
| `courts` | The 226 nations with a directory-listed court the Nov. 21, 2026 court review could not confirm (328 courts); `found` means at least one of the nation's listed courts was confirmed or found served by another court | [`scripts/review/court_listings_second_pass.py`](../../scripts/review/court_listings_second_pass.py) | [Court listings second pass, Nov. 22, 2026](../reviews/2026-11-22-court-listings-second-pass.md) |
| `dispute-resolution` | The 395 federally recognized nations with no dispute resolution record on Nov. 22, 2026; the other 373 profiles without one are marked `not-searched` | [`scripts/review/coverage_search.py`](../../scripts/review/coverage_search.py) | [Dispute resolution coverage, Nov. 22, 2026](../reviews/2026-11-22-dispute-resolution-coverage.md) |
| `gaming-dispute-procedures` | The 315 nations with a profile that have a gaming ordinance on the National Indian Gaming Commission's list; each document on the list is one search | [`scripts/review/ordinance_disputes.py`](../../scripts/review/ordinance_disputes.py) | [Dispute procedures in gaming ordinances, Nov. 22, 2026](../reviews/2026-11-22-ordinance-disputes.md) |
