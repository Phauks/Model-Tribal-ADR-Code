# Research sessions

One file per research session, so the record of how sources were found stays
easy to read and search instead of growing into one long log.

- Path: `sessions/<yyyy>/<yyyy-mm-dd>-<topic>.md`
- Front matter: fields defined in
  [`schemas/research-session.schema.json`](../schemas/research-session.schema.json)
  (date, researchers, tools, purpose, queries, sources added or updated, limits).
- Body: what was searched, what was found, what was ruled out.
- Every source record names the session(s) that found it in its `found_in`
  field, so you can trace a citation back to how it was found.

When an AI research assistant is used, list it as a tool and say what it did.
Organizations the project may ask for help are kept as records in
[`outreach/`](outreach/README.md).

The website will generate a browsable index of sessions by month, tool and
topic.

## Pull lists

`pull-lists/` holds dated lists of what to pull or check in subscription
databases such as Westlaw (citator checks, treatises, law review articles)
after a research session. Each item names the source record to update, and
an item is removed once its check is recorded in that record. Since 2026-11-21 new items go in the project's single Westlaw list, kept
with the project's working files; the dated lists here point to it.

## Analyses

`analyses/` holds dated analyses of the records, each with the script output
it quotes, for example
[`2026-11-21-dispute-resolution-practice.md`](analyses/2026-11-21-dispute-resolution-practice.md).
An analysis describes what the sources document, never what a nation
practices, and labels its own reasoning as project analysis. Re-run the script
named in the analysis to reproduce its counts.

## Reviews

Reviews of the project's own data, done to help the lead author's review, are
kept in [`reviews/`](reviews/README.md). They record findings and suggested
actions; they never change a record by themselves.
