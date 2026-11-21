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
an item is removed once its check is recorded in that record.
