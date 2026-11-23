# Research sessions

One file per research session, so the record of how sources were found stays easy to read and search instead of growing into one long log.

- Path: `sessions/<yyyy>/<yyyy-mm-dd>-<topic>.md`
- Front matter: fields defined in [`schemas/research-session.schema.json`](../schemas/research-session.schema.json) (date, researchers, tools, purpose, queries, sources added or updated, limits).
- Body: what was searched, what was found, what was ruled out.
- Every source record names the session(s) that found it in its `found_in` field, so you can trace a citation back to how it was found.

When an AI research assistant is used, list it as a tool and say what it did. Organizations the project may ask for help are kept as records in [`outreach/`](outreach/README.md).

The website will generate a browsable index of sessions by month, tool and topic.

## Pull lists

`pull-lists/` holds dated lists of what to pull or check in subscription databases such as Westlaw (citator checks, treatises, law review articles) after a research session. Each item names the source record to update, and an item is removed once its check is recorded in that record. Since 2026-11-21 new items go in the project's single list of things to fetch by hand, `research/documents-to-get.md` in the project's working files. It is the only such list; older lists are kept as a record in `research/old-pull-lists/` there. It is grouped by action (downloads, pages to save, Wayback saves, searches and library copies, Westlaw, asking people), and its top section gives the rules for adding an item. The documents themselves are private copies, never in this repository: they move from the working files' `research/captures/` to the private bucket under the same paths (decision record [0030](../docs/decisions/0030-keep-research-captures-in-the-private-bucket.md)), filed by `scripts/captures/mirror_captures.py`. [`capture-index.csv`](capture-index.csv) lists every copy (key, size, SHA-256, how and when it was obtained, title, nations, citing records, rights), and [`capture-orphans.csv`](capture-orphans.csv) lists the ones no record cites yet. The dated lists here point to it.

## Analyses

`analyses/` holds dated analyses of the records, each with the script output it quotes, for example [`2026-11-21-dispute-resolution-practice.md`](analyses/2026-11-21-dispute-resolution-practice.md). An analysis describes what the sources document, never what a nation practices, and labels its own reasoning as project analysis. Re-run the script named in the analysis to reproduce its counts.

## Media

[`media/`](media/README.md) holds research on videos, sound recordings and pictures the website could use, with each source's reuse terms and cultural-sensitivity concerns.

## Quotations

`quotes/` holds checked quotations for epigraphs and pull quotes, each matched word for word against a published source and cited with a pinpoint, with a list of popular quotations that are misattributed or untraced: [2026-11-23-quotations-on-peacemaking-and-self-government](quotes/2026-11-23-quotations-on-peacemaking-and-self-government.md).

## Reviews

Reviews of the project's own data, done to help the lead author's review, are kept in [`reviews/`](reviews/README.md). They record findings and suggested actions; they never change a record by themselves.

## Search logs

[`search-logs/`](search-logs/README.md) holds one record per nation and topic saying where the project looked for that nation's information and what each search found or why it failed, so gaps can be told apart from places no one has looked ([decision record 0025](../docs/decisions/0025-search-logs.md)).

## Tribal law texts

[`tribal-law/`](tribal-law/README.md) lists the dispute resolution provisions found in Native nations' own law codes, court rules and ordinances, read by machine and awaiting the lead author's review. Quotations and fetched copies stay private.
