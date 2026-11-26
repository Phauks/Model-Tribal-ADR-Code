# Source watch Worker

The Worker `tribal-law-project-watch` looks for new and changed legal material and puts what it finds in a queue for people. Nothing it finds is published without a person. The design, the catalog of sources and the reasons are in [docs/source-watch.md](../../docs/source-watch.md) and decision record [0059](../../docs/decisions/0059-watch-for-new-legal-sources-with-plug-in-watchers.md).

## What is here

- `worker.ts` runs every minute. It starts the watchers that are due, each as its own Workflows instance (`WatchRun`), asks the models about a few waiting items, and writes `watch/progress.json` to the private bucket. It serves a progress page at `/` and the same figures at `/status.json`, counts only, never an item's title or text.
- `host-desk.ts` is a Durable Object, one per host. Every request to a host asks its desk first. The desk reads robots.txt once a day, spaces requests (5 seconds for government hosts, 30 for any other, longer if robots.txt asks), and backs off when a host answers 429 or 503.
- `watchers/` holds one file per source and the list of every collection and nation page part no watcher feeds yet, with the reason (`watchers/index.ts`). `tests/source-watch-guard.test.ts` fails when a new collection or nation profile field has neither.
- `make-known-identifiers.ts` writes the index of the records the project already holds (Federal Register numbers, links, file hashes, nation names) to `known-identifiers.json`, which the Worker bundles. It runs in the build, so git does not keep the file.
- The shared code (the drivers, rules, matching, triage, storage) is in `site/src/lib/server/watch/`, so the site's workspace page uses the same code.

## Watchers

| Watcher | Source | When (UTC) | Starts |
| --- | --- | --- | --- |
| `federal-register` | Federal Register API: the Indian affairs agencies, Title 25 of the C.F.R., and presidential documents mentioning tribes | Each weekday hour, minute 7 | On |
| `federal-register-search` | Federal Register API: every agency, for "tribe", "tribal", "Indian country" and "Alaska Native" | Weekdays at 13:37 | Off until model triage runs, since most of its 4,900 documents a year are consultation notices |
| `ecfr` | eCFR versions API: Title 25, 42 C.F.R. parts 136, 136a and 137, and 43 C.F.R. part 4 | Daily at 14:23 | On |
| `cited-links` | Every original link a source record cites, re-checked once every 60 days, a few every 10 minutes | Every 10 minutes | On |

A first run only notes where each source stands (the Federal Register looks back 14 days), so the queue does not fill with old items.

## Setting it up

These steps are for the lead author, in the Cloudflare dashboard. None of them needs a secret.

1. **Apply the migration.** `site/migrations/20261126T1930_add_source_watch.sql` adds the tables `watch_candidates`, `watch_cursors`, `watch_runs`, `watch_pages` and `watch_model_spend`. The thread that lands the pull request applies it to the live database after checking `d1_migrations`.
2. **Create the Worker with Workers Builds.** Workers & Pages > Create > Import a repository, choose this repository, and set:
   - Project name: `tribal-law-project-watch`
   - Root directory: `site/watch`
   - Build command: `cd .. && npm ci && npm run watch:index`
   - Deploy command: `npx wrangler deploy`
   - Build watch paths: `site/watch/*`, `site/src/lib/server/watch/*`, `content/*` and `research/capture-index.csv`, so the Worker is rebuilt with a fresh index when the records change.
3. **Check it.** The progress page is at `https://tribal-law-project-watch.trevordgoldsmith.workers.dev/`. The site's Service checks page has two rows, "Source watch" and "Source watch models (AI Gateway)", which read the same progress from the bucket.

## Models

Items the rules cannot decide are sorted by Claude Haiku 5.5, and hard cases (does this amend a compact we hold) go to Claude Opus 5.5, through Cloudflare AI Gateway with Unified Billing: the calls are paid from credits on the Cloudflare account, so there is no Anthropic key and no secret (Trevor chose this on Nov. 26, 2026). On Mondays at 05:13 UTC, Opus 5.5 checks a random sample of 10 of the week's Haiku answers, and the progress page shows how many it disagreed with.

The models see only an item's title, the summary the source gave, its facts (agency, type, C.F.R. part) and the record it may match. They never see file text. Items from a host whose robots.txt or Content-Signal says no to AI use (Municode and eCode360, for example), items flagged as a child, family or protection order matter, and Tribal court opinions are never sent to a model; Tribal court opinions are held for the lead author by rule, so the step that puts initials in them is not needed yet.

Until the steps below are done, `WATCH_TRIAGE_PROVIDER` is `none`, and those items go straight to people.

1. Load credits: AI > AI Gateway > Credits (Unified Billing). A few dollars lasts a long time at the estimated rate (docs/source-watch.md, "Rate of work and cost").
2. Create a gateway named `source-watch` (AI > AI Gateway > Create gateway).
3. On the Worker (Settings > Variables and Secrets), set `WATCH_TRIAGE_PROVIDER` to `ai-gateway`. This is a plain variable, not a secret. To keep it in code instead, change it in `wrangler.jsonc`.
4. Optionally set `WATCH_TURN_ON` to `federal-register-search` to start the all-agency search.

Unified Billing allows a gateway 200 requests a minute; the Worker asks about at most 10 items a minute.

## Settings

| Variable | What it does |
| --- | --- |
| `WATCH_TRIAGE_PROVIDER` | `none` (the default: the middle band goes to people), `ai-gateway`, or `nightly-task` (not built) |
| `WATCH_GATEWAY` | The AI Gateway's name, `source-watch` |
| `WATCH_CHEAP_MODEL`, `WATCH_TOP_MODEL` | The model catalog names, `anthropic/claude-haiku-5.5` and `anthropic/claude-opus-5.5` |
| `WATCH_TURN_ON`, `WATCH_TURN_OFF` | Watchers to turn on or off, separated by commas, without a code change |

## Adding a source

Write the watcher in `watchers/` with `defineWatcher` (the Federal Register and eCFR files are short examples), add it to `watchers` in `watchers/index.ts`, and take the collections it feeds out of `notWatched`. Use a driver from `site/src/lib/server/watch/drivers/` where one fits: `api` for paged JSON, `feed` for RSS, Atom and sitemaps, `page` for a page or file compared with last time, and `by-hand` for a reminder card when a host refuses scripts. Every request goes through `context.fetch`, which keeps to the host's robots.txt and spacing.
