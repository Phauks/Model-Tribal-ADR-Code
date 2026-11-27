# Source watch Worker

The Worker `tribal-law-project-radar` looks for new and changed legal material and puts what it finds in a queue for people. Nothing it finds is published without a person. The design, the catalog of sources and the reasons are in [docs/source-watch.md](../../docs/source-watch.md) and decision record [0059](../../docs/decisions/0059-watch-for-new-legal-sources-with-plug-in-watchers.md).

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
| `federal-register-search` | Federal Register API: every agency, for "tribe", "tribal", "Indian country" and "Alaska Native" | Weekdays at 13:37 | On; most of its 4,900 documents a year are consultation notices, which the models sort out |
| `ecfr` | eCFR versions API: Title 25, 42 C.F.R. parts 136, 136a and 137, and subparts D, H and K of 43 C.F.R. part 4 | Daily at 14:23 | On |
| `cited-links` | Every original link a source record cites, re-checked once every 60 days, a few every 10 minutes | Every 10 minutes | On |

A first run only notes where each source stands (the Federal Register looks back 14 days), so the queue does not fill with old items.

## Setting it up

The migration is already applied to the live database (`site/migrations/20261126T1930_add_source_watch.sql`, Nov. 26, 2026). One step is left for the lead author, in the Cloudflare dashboard: create the Worker from this repository with Workers Builds. It needs no secret, no key and no gateway, and the models work as soon as it deploys.

1. Open the Cloudflare dashboard at dash.cloudflare.com and go to **Workers & Pages**.
2. Select **Create application**.
3. Under importing a repository, select **GitHub**. If Cloudflare asks, sign in to GitHub and allow it this repository, as for the other Workers.
4. Select the repository `Tribal-Law-Project`.
5. On the next page, fill in:
   - **Project name:** `tribal-law-project-radar`. It must match the name in `site/watch/wrangler.jsonc` exactly, or the build fails.
   - **Build command:** `cd .. && npm ci`. Wrangler makes the index of known records itself before it bundles the Worker (the `build` setting in `wrangler.jsonc`, per Wrangler's [custom builds](https://developers.cloudflare.com/workers/wrangler/custom-builds/)), so a longer build command that ends in `npm run watch:index` still works.
   - **Deploy command:** `npx wrangler deploy` (usually filled in already).
   - Open **Advanced settings** and set the **Root directory** (on some screens called **Path**) to `site/watch`.
6. Select **Deploy**. The first build takes a few minutes.
7. When it has finished, open the new Worker, then **Settings** > **Build** > **Build watch paths**, and set the included paths to `site/watch/*`, `site/src/lib/server/watch/*`, `content/*` and `research/capture-index.csv`. Then the Worker is rebuilt with a fresh index of the records only when those files change, not on every push.

To check it, open the progress page at `https://tribal-law-project-radar.trevordgoldsmith.workers.dev/`, which fills in within a few minutes. The site's Service checks page has two rows, "Source watch" and "Source watch models", which read the same progress from the bucket.

These steps follow Cloudflare's [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/) ("Connect a new Worker"), [build configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/) and [build watch paths](https://developers.cloudflare.com/workers/ci-cd/builds/build-watch-paths/) pages, and the name rule in [Workers Builds troubleshooting](https://developers.cloudflare.com/workers/ci-cd/builds/troubleshoot/#workers-name-requirement).

## Models

Items the rules cannot decide are sorted by a model that Cloudflare runs itself, through the Worker's Workers AI binding (`models` in `wrangler.jsonc`). It is billed on the account's Workers Paid plan, which includes 10,000 Neurons a day free ([Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)), so there is nothing to buy or set up. Trevor asked for this on Nov. 26, 2026, in place of the AI Gateway steps.

The model is Inkling 2 Small (`@cf/thinkingmachines/inkling-2-small`), from Thinking Machines Lab, added to Workers AI on Nov. 12, 2026. Cloudflare calls it "the first frontier open model from a US lab on Workers AI"; it supports function calling, which the Worker uses for a structured answer, and zero data retention, and it costs $0.30 a million input tokens and $1.00 a million output tokens ([model page](https://developers.cloudflare.com/workers-ai/models/inkling-2-small/), [announcement](https://developers.cloudflare.com/changelog/post/2026-11-12-inkling-2-small-workers-ai/)). It reads the middle band with low reasoning effort, and the hard cases (does this amend a compact we hold) with high effort. On Mondays at 05:13 UTC it checks a random sample of 10 of the week's answers again at high effort, and the progress page shows how many it disagreed with. Its limit is 20 requests a minute on the Workers Paid plan; the Worker asks about at most 10 items a minute.

At the design's estimate of about 6,000 items a year reaching a model (docs/source-watch.md, "Rate of work and cost"), each about 3,000 tokens in and up to 1,000 out with reasoning, that is about $5.40 of input and $6 of output a year before the free daily Neurons, by the project's own arithmetic from the prices above.

The models see only an item's title, the summary the source gave, its facts (agency, type, C.F.R. part) and the record it may match. They never see file text. Items from a host whose robots.txt or Content-Signal says no to AI use (Municode and eCode360, for example), items flagged as a child, family or protection order matter, and Tribal court opinions are never sent to a model; Tribal court opinions are held for the lead author by rule, so the step that puts initials in them is not needed yet.

Other choices, set with `WATCH_TRIAGE_PROVIDER` on the Worker (Settings > Variables and Secrets, a plain variable, not a secret):

- `ai-gateway`: Claude Haiku 5.5 for the middle band and Claude Opus 5.5 for hard cases and the weekly sample, through Cloudflare AI Gateway. It needs a gateway named `source-watch` (AI > AI Gateway > Create gateway) and Unified Billing credits loaded on the account (AI > AI Gateway > Credits).
- `none`: no model; every item the rules cannot decide goes to a person. Set `WATCH_TURN_OFF` to `federal-register-search` too, or its 4,900 documents a year go to people.

## Settings

| Variable | What it does |
| --- | --- |
| `WATCH_TRIAGE_PROVIDER` | `workers-ai` (the default), `ai-gateway`, `none`, or `nightly-task` (not built) |
| `WATCH_CHEAP_MODEL`, `WATCH_TOP_MODEL` | Empty for the provider's own models: Inkling 2 Small for both on Workers AI; `anthropic/claude-haiku-5.5` and `anthropic/claude-opus-5.5` on AI Gateway. Any Workers AI text model with function calling can be named instead. |
| `WATCH_GATEWAY` | The AI Gateway's name, `source-watch`, for `ai-gateway` only |
| `WATCH_TURN_ON`, `WATCH_TURN_OFF` | Watchers to turn on or off, separated by commas, without a code change |

## Adding a source

Write the watcher in `watchers/` with `defineWatcher` (the Federal Register and eCFR files are short examples), add it to `watchers` in `watchers/index.ts`, and take the collections it feeds out of `notWatched`. Use a driver from `site/src/lib/server/watch/drivers/` where one fits: `api` for paged JSON, `feed` for RSS, Atom and sitemaps, `page` for a page or file compared with last time, and `by-hand` for a reminder card when a host refuses scripts. Every request goes through `context.fetch`, which keeps to the host's robots.txt and spacing.
