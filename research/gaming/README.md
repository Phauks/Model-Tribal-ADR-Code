# Indian gaming compacts, ordinances and negotiation context

A catalog of every Class III tribal-state gaming compact, amendment, extension, disapproval and set of Secretarial Procedures on the Office of Indian Gaming list, every Tribal gaming ordinance and amendment on the National Indian Gaming Commission list, the Federal Register notices of the federal action on each compact, and cited research on how compacts are negotiated and how compact disputes are resolved. Gathered Nov. 21, 2026; how is recorded in [the research session](../sessions/2026/2026-11-21-gaming-compacts-and-ordinances.md).

The model code may touch on negotiation, including compact negotiation, even though compact negotiation between governments is not dispute resolution as such. These files are research material, not findings about any nation's law, and nothing here changes a nation profile.

## Files

| File | One row per | Built by |
| --- | --- | --- |
| [`compact-documents`](compact-documents.csv) (`.csv`, `.json`) | Document on the Office of Indian Gaming list of compacts ([list](https://www.bia.gov/as-ia/oig/gaming-compacts)) | [`scripts/gaming/compact_list.py`](../../scripts/gaming/compact_list.py), [`build_catalog.py`](../../scripts/gaming/build_catalog.py) |
| [`ordinance-documents`](ordinance-documents.csv) | Ordinance or amendment on the Commission's list of approved gaming ordinances ([list](https://www.nigc.gov/office-of-general-counsel/gaming-ordinances/)) | [`ordinance_list.py`](../../scripts/gaming/ordinance_list.py), `build_catalog.py` |
| [`federal-register-notices`](federal-register-notices.csv) | Bureau of Indian Affairs notice about a Class III compact, amendment, extension or procedures, from the Federal Register API, with the list documents it was matched to | `build_catalog.py` |
| [`compact-context`](compact-context.csv) | Cited fact on compact negotiation, good-faith litigation, Secretarial Procedures, compact review rules, revenue sharing, and each state's negotiating authority and current talks | [`build_context.py`](../../scripts/gaming/build_context.py), [`check_quotes.py`](../../scripts/gaming/check_quotes.py) |
| [`compact-clauses`](compact-clauses.csv) | Governing compact document, with the dispute resolution, renegotiation, term, revenue sharing and immunity clauses AI reviewers found in it | [`clause_evidence.py`](../../scripts/gaming/clause_evidence.py) |
| [`compact-history-versions`](compact-history-versions.csv) (`.csv`, `.json`; full histories in `content/documents/`) | Version of a nation's compact with a state, in order: what it did, what it amends or supersedes, its dispute clause, and how that clause changed from the version before | [`build_histories.py`](../../scripts/gaming/build_histories.py) |
| [`secretarial-procedures`](secretarial-procedures.csv) | Set of Secretarial Procedures, amendment of one, or request for one: how it came about, mediator, Federal Register notice, term, dispute process, payments and later history | [`build_procedures.py`](../../scripts/gaming/build_procedures.py) |
| [`part-291-history`](part-291-history.csv) | Rulemaking or court event in the history of 25 C.F.R. part 291, and each of its 15 sections | `build_procedures.py` |

Each Federal Register notice also has a source record, `content/sources/f/federal-register-<document number>.yaml`, which prints in the Indigo Book form "<title>, 89 Fed. Reg. 24853 (Apr. 9, 2024)". Each case, regulation and rule the context relies on has a source record too.

## Fields every row carries

- `source`, `confidence` and `verification`, as defined in [the data model](../../docs/data-model.md#every-fact-is-cited). List rows copied without opening the document are `bulk-import`; rows whose nation or Federal Register notice was matched by a rule are `inferred`; context facts are `read-in-full` only when a script found their quotation word for word on the cited page, and `title-only` otherwise.
- `nations`: profile ids, taken from the profile fact that already cites the same list row or link (the matching done in the [gaming session](../sessions/2026/2026-11-21-gaming.md)), never matched again here. A row no profile cites has an empty list and a flag.
- `flags`: what a reader should check, for example a scanned document with no text layer, or a Federal Register notice published long after the listed date.

## Version histories

Every document on the compact list is also a version in a document history record (`content/documents/`, [decision record 0018](../../docs/decisions/0018-document-version-history.md)), built by [`build_documents.py`](../../scripts/gaming/build_documents.py): one record for each nation's compact with each state, each Oklahoma off-track wagering compact and each Minnesota blackjack or video games of chance compact (which the list files under the same title as the nation's other compact), and each set of Secretarial Procedures. Each version has a source record of its own file that names the version back. The order of versions, the kind of each event (original, amendment, extension, replacement, restatement, disapproval) and which version is in effect are inferred from the list and the first pages of each file (`verification: bulk-import`); "in effect" means no later document on the list took its place, not that its term was checked. Dispute resolution and renegotiation clauses and the changes between versions are a small model's reading of excerpts; a change marked `not-compared` is one the excerpts could not settle. The Ak-Chin Indian Community's Arizona compact was recorded by hand first and was left as it is.

## The documents themselves

The PDFs (1,200 compact documents, 48,182 pages; 1,166 ordinance documents, 34,814 pages) and their extracted text are kept privately with the project's working files under `research/captures/gaming/`, not in this repository. The compacts are agreements of the nations and the states, and ordinances are the nations' own laws: the project cites and links them and records facts from them, but does not republish them (charter, CARE principles). Each row gives the capture path, SHA-256 and page count, so a copy can be checked against the list's link. A nation may ask for any row to be corrected or removed ([charter, commitment 6](../../docs/charter.md#6-the-right-to-correct-restrict-or-withdraw)).

## Relation to earlier work

- The profiles' `gaming.compacts` and `gaming.ordinances` facts came from the same two lists on the same day (session `2026-11-21-gaming`). This catalog adds what those facts lack: every document link, the Federal Register citation in Indigo Book form, captures and the clauses.
- [The data gap review](../reviews/2026-11-21-data-gap-review.md#compact-dispute-clauses) (pull request #33) compared 256 copied dispute clause summaries with each nation's own compact and left the decisions to the lead author. The clause rows here cover the governing documents of every nation and state, mark the nations that review covered, and do not repeat or decide its verdicts.

## Limits

- The Office of Indian Gaming list's Tribe column is sometimes out of line with the title. Rows keep both; the nation comes from the profile match, which used the title.
- The list labels most amendments as compacts. `document_kind` is `amendment` only when the title or file name says so.
- 159 rows have no Federal Register citation: most compacts approved from 1990 to 1993 (before the Federal Register API's coverage), and some recent rows the list does not link. They are in the project's Westlaw list.
- 43 Federal Register notices matched no list row; some may announce compacts the list does not post.
- `listed_date` is the date the list shows, often the Federal Register publication or effective date rather than the signing date.
