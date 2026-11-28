# 0068. Store the text of the state statutes the site lists

- **Status:** Accepted
- **Date:** 2026-11-28
- **Extends:** decision records [0031](0031-serve-copies-of-documents-from-the-private-bucket.md) (the site serves its own copies of federal works and nations' governing documents) and [0060](0060-serve-state-agreements-and-state-court-opinions.md) (state court opinions served, the court's text only)

## Context

The state statutes sweep (`scripts/law/state_statutes/`, Nov. 27, 2026) wrote 11,119 records of kind `state-statute`, one for each section of a state code that bears on Indian law, across 39 states with an adapter and a few records made by hand. Each record linked the section on the legislature's site and stored no copy: the records' rights notes said "Linked, not served: state statutes stay link only", a project choice rather than a legal limit. Many of those links are a whole chapter page, a title's PDF or a search page, so a reader who follows one has to find the section on a long page or run a search, and a legislature's site can move or drop the page. On Nov. 28, 2026 Trevor Goldsmith decided that the site should store the text of the state statutes it lists, instead of only linking to them.

## Decision

- **Store each section's text.** Each `state-statute` record gets a plain UTF-8 text of its section, kept in the private bucket at `state-statutes/<state>/<record key>.txt` and served like the project's other copies. The text is the section's catchline, its text and its history line (source note) as printed in the official code, and nothing else: no publisher annotations, case notes, cross-reference notes or editor's notes. Statutory text has no copyright under the government edicts doctrine (*Georgia v. Public.Resource.Org, Inc.*, 590 U.S. 255 (2020)), so the capture index rows say `redistribution: yes`.
- **From the legislature's own site.** `scripts/law/state_statutes/texts.py` downloads each state's code again with the sweep's adapter, from the same official sources, splits it into sections and matches each record by its key (or, failing that, by its exact link when one section alone has it). It reads only the parts of a code the records need where the adapter lists sections or chapters first, asks slowly, and can be run again: files already downloaded, texts already in the bucket and rows already in the index are kept.
- **Found by the record, not the link.** Many sections share one address (an Oregon chapter page, a Colorado or Oklahoma title's PDF, Alaska's one statutes page with an anchor for each section). The site finds a state statute's text by the record's key in the index row's `records` column, and does not match a link that two stored texts share, so a citation of a chapter page never opens one section's text.
- **The official link stays first.** "Where to read it" still lists the legislature's page first; the stored text is in the Text card.

## Consequences

- On Nov. 28, 2026 the script stored 10,312 of the 11,119 texts. A state whose site refuses cloud sessions (North Carolina, whose ncleg.gov answers 503, and Wisconsin) keeps link-only records until its text can be fetched another way, and so do a few records that are not one section (a whole chapter, a session law); the law page then links the official text, as before.
- The records written by the sweep still say "Linked, not served" in their rights note; a later run of the sweep's `write` step should say the text is stored.
- The stored text is the code as read on Nov. 28, 2026, a day after the records were written; a section the legislature amends later needs the script run again.

## Sources

- *Georgia v. Public.Resource.Org, Inc.*, 590 U.S. 255 (2020).
- `scripts/law/state_statutes/README.md` (the sweep and its adapters).
