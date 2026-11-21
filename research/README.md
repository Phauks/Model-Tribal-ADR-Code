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

## Analyses

`analyses/` holds dated analyses of the records, each with the script output
it quotes, for example
[`2026-11-21-dispute-resolution-practice.md`](analyses/2026-11-21-dispute-resolution-practice.md).
An analysis describes what the sources document, never what a nation
practices, and labels its own reasoning as project analysis. Re-run the script
named in the analysis to reproduce its counts.
