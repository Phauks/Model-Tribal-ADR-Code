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

## Problems in the browser

`src/hooks.client.ts` sends every error SvelteKit catches while moving between pages, and every error a page's scripts throw that nothing catches, to `POST /problems` (`src/lib/problem-reports.ts`). The site reports it with source `browser`. A page sends at most ten, and the same message once. Each network address may send 30 a minute (`problemReportLimit` in `wrangler.jsonc`). Nothing about the reader is sent: only the code, the message and stack without secrets, the path without its query, and the reference.

Errors from other sites' scripts, such as browser extensions, are ignored.

## Error pages

`src/hooks.server.ts` reports every error SvelteKit did not expect (`handleError`) and gives the error page its reference. An error the site raised itself with `error(404, …)` is an answer, not a problem, and is not reported.

The reader-facing error box, the Page not found and Something went wrong pages, and the Report choice in Request a Change follow the mockups Trevor approved on Nov. 27, 2026 (project files `design/error-framework/`; the Page not found page has no search box and has a Try again button). They are built in the next step of this work.

## No silent fallbacks

Every catch does one of these:

- throws, or answers with an HTTP error;
- reports the problem with `report`, `reportHere` or `sendProblem`;
- keeps it to show the reader; or
- says why dropping it is right, with a comment that starts `expected:`, such as `// expected: storage is blocked in private windows.`

Showing something else in place of what failed, as the map did, is allowed only where this file or `DESIGN.md` names the case (no scripts, print, offline), and the failure is still reported.

`npm run check:silent-catches` (`tools/check-silent-catches.mjs`, run in continuous integration) fails when a file has more silent catches than `tools/silent-catches-baseline.json` allows. The baseline began at 321 and only falls: after fixing some, run `node tools/check-silent-catches.mjs --update` to lower it, and `--list <file>` to see a file's silent catches by line.
