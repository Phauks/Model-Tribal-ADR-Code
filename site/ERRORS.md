# Errors and problems

How the site and its Workers report what goes wrong. Trevor asked on Nov. 27, 2026 for every way the site reported errors to be found and brought into one framework, and approved this design the same day. Before then, 518 places in the code caught errors in five different ways, 321 of them dropped the error without a trace, nothing from a reader's browser was ever reported, and the map quietly swapped in an older drawn map when it failed.

## One error type

`src/lib/problems.ts` is shared by the pages in the browser, the site Worker and the other Workers.

- `Problem` is an Error with a short, stable `code`, such as `search.fill` or `map.style`, and optional `reader` words that are safe to show. Its message is for the people who run the site and is not shown to readers as it is.
- `messageOf(value)` reads anything thrown. Use it in place of `problem instanceof Error ? problem.message : String(problem)`.
- `codeOf`, `problemOf` and `causeChain` read a code, wrap anything thrown, and list an error's causes.
- `isMissingTable(value)` says whether D1 reported a missing table, as it does before a migration is applied.
- `newReference()` makes a reference such as `P-4F7K-92QD`, which a reader is shown and the log line carries.

Name a code for the part of the site and what failed, in lowercase words joined by dots or hyphens: `search.fill`, `map.tiles`, `wayback.save`.

## One way to report

`report(problem, context)` in `src/lib/server/report.ts` is the only way to log a problem. In the site Worker, call `reportHere(problem, context)` from `src/lib/server/report-here.ts`, which adds the site's database and keeps the database write going after the answer.

Each report does two things:

1. It logs one object to Cloudflare's Workers Logs, with `problem` (the code), `reference`, `source`, `place`, `message`, `causes`, `path`, `method`, `status`, `stack` and `details`. Each field can be filtered on in the dashboard. An Error passed to `console.error` reaches Workers Logs as its stack alone, which is how messages were lost before, so `report` logs the message as its own field.
2. When a database is given, it adds one to the problem's row in the `problems` table (one row per code, source and place). The Service checks page lists these under Problems, newest first.

Nothing secret is logged. Fields with secret-looking names are left out, and messages, stacks and paths lose web address queries, email addresses, bearer tokens, `name=value` pairs with secret-looking names, and long runs of letters and digits that look like keys (`withoutSecrets`, tested in `tests/problems.test.ts`).

`afterResponse(work, code)` reports a failure of work that runs after the answer under the code given.

## Worker runs

The live, scanner, Wayback and source watch Workers report the same way as the site, through `report` with their own short name as the source (`live`, `scanner`, `wayback` and `radar`) and the site's database, so their problems are counted in the same `problems` table. The Wayback Worker has the database binding for this alone.

Each Worker wraps its default export in `reported(source, handlers)` from `src/lib/server/reported.ts`, and each Durable Object's alarm in `runReported(place, work)`:

- A scheduled run or an alarm that throws is reported under the error's code, or `<source>.scheduled` or `<source>.alarm`, and still throws, so Cloudflare's cron events and alarm retries see it as before.
- A fetch that throws is reported as `<source>.fetch` and answered with 500 and the reference, instead of Cloudflare's error page.
- When a scheduled run or an alarm ends, finished or failed, it writes one row in the `worker_runs` table: when it last started, how long it took, whether it finished, how many runs and failures, and the last failure's code, reference and message. A fetch writes a row only when it fails. A run stopped at its time limit writes nothing, so it shows as late.

A Worker with more than one cron trigger names each, as the scanner does (`scheduled:wake` every minute, `scheduled:rebuild` once a day). The Wayback and source watch Workers now wait for their minute's run inside the handler, rather than handing it to `waitUntil`, so the row says how it ended.

The Service checks page's Scheduled runs and alarms row reads `worker_runs`. `expectedRuns` lists each scheduled run, when it runs and how late it may be (ten minutes for the minute runs, 26 hours for the daily one); `tests/reported.test.ts` checks the list against each Worker's cron triggers. A scheduled run that is late, has never recorded a run, or failed last time is Not working. An alarm or a fetch that failed in the last day Needs a look.

The site Worker's own scheduled runs are not recorded in `worker_runs` yet. Each passes through one of the site's addresses (`tools/add-scheduled-run.mjs`), so an unexpected error is reported by `handleError`, and a run whose address answers with an error throws.

## Problems in the browser

`src/hooks.client.ts` sends every error SvelteKit catches while moving between pages, and every error a page's scripts throw that nothing catches, to `POST /problems` (`src/lib/problem-reports.ts`). The site reports it with source `browser`. A page sends at most ten, and the same message once. Each network address may send 30 a minute (`problemReportLimit` in `wrangler.jsonc`). Nothing about the reader is sent: only the code, the message and stack without secrets, the path without its query, and the reference.

Errors from other sites' scripts, such as browser extensions, are ignored.

## Error pages

`src/hooks.server.ts` reports every error SvelteKit did not expect (`handleError`) and gives the error page its reference. An error the site raised itself with `error(404, …)` is an answer, not a problem, and is not reported.

The Page not found and Something went wrong pages (`src/routes/+error.svelte`) follow the mockups Trevor approved on Nov. 27, 2026 (project files `design/error-framework/`).

- Page not found names the address and lists up to three pages with a similar address, found by searching the words of the address's last part (`src/lib/similar-pages.ts`), the server first and the search files when the server cannot answer yet. It has no search box (Trevor). Home page comes first, then Try again, which loads the address again, and Report.
- Something went wrong says the page could not be shown, names the address, and offers Try again first, then Home page and Report, the reference with a copy button, and a search box.
- Not allowed (403) keeps its message and offers the home page.

## The error box

`src/lib/components/ProblemNotice.svelte` is the one box that tells a reader a part of a page failed. It keeps the frame of what failed (style A in the mockups), says what failed in a heading with an alert icon, gives one line, and offers Try again and Report, with the reference the problem was reported under and a copy button. `size` is `section` for a part that fills the page's width, `small` for a narrow panel, and `toast` for an action that failed, at the corner with a close button.

The map is the first user: `TileMap.svelte` shows the box in its own frame when it cannot start, on the Map page, a nation's page, a state's page and a treaty's page, and reports the failure (`map.webgl`, `map.load`, `map.tiles` or `map.timeout`). A browser that cannot draw maps, or a reader who is offline, gets no Try again, since it would fail the same way; offline nothing is reported.

## Report

Report opens Request a Change already filled in (`src/lib/report-request.ts`): the choice Report a broken page, the address without its query, and what failed with its reference in Details. A broken page needs the address but not details, and is kept as a correction whose details begin "Broken page." Without scripts, Report is a link to `/requests` with the same answers in its address.

## No silent fallbacks

Every catch does one of these:

- throws, or answers with an HTTP error;
- reports the problem with `report`, `reportHere` or `sendProblem`;
- keeps it to show the reader; or
- says why dropping it is right, with a comment that starts `expected:`, such as `// expected: storage is blocked in private windows.`

Showing something else in place of what failed, as the map did, is allowed only where this file or `DESIGN.md` names the case (no scripts, print, offline), and the failure is still reported.

`npm run check:silent-catches` (`tools/check-silent-catches.mjs`, run in continuous integration) fails when a file has more silent catches than `tools/silent-catches-baseline.json` allows. The baseline began at 321 and only falls: after fixing some, run `node tools/check-silent-catches.mjs --update` to lower it, and `--list <file>` to see a file's silent catches by line.
