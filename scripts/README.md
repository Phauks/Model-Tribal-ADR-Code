# Scripts

Checks that run on every pull request (see `.github/workflows/checks.yml`).
Run them from the repository root before opening a pull request.

The workflow's final job, `All checks`, passes only when every other check
passes, and it is the only check the `main` ruleset requires. To add a check,
add a job to the workflow and list it under `all-checks.needs`.

| Script | Checks | Needs |
| --- | --- | --- |
| `check_text.py` | Every text file is UTF-8 without a byte order mark, in Unicode Normalization Form C, with LF line endings and a final newline | Python 3 standard library |
| `validate_records.py` | Every schema, example and content record is valid, and every citation key, glossary link, research session reference and document version link resolves | `pip install -r scripts/requirements.txt` |
| `lint_records.py` | Catches unchecked data (decision record 0014): profile facts with no `verification` level, two source records at one address, forum kinds with no method record, sources still unarchived 30 days after retrieval, sources cited by content headed for an edition that are unarchived, lack a citator result or are marked unverified, and (decision record 0018) document versions whose dates, order or status disagree, clause topics with no recorded change between versions, source records whose `document_version` does not match, and profile facts citing a version no longer in effect without naming it. With `--base <ref>` it fails only on problems the pull request adds or changes; run it with `--edition` before exporting an edition | `scripts/requirements.txt` |
| `coverage_report.py` | Counts how much of the dataset has been checked and how closely: facts by section and verification level, dispute resolution coverage by region, archives, citator checks, document histories and their versions, clauses and changes, method and glossary status. With `--base <ref>` it shows each count beside the base's. In continuous integration the report goes to the job summary | `scripts/requirements.txt` |

`record_facts.py` holds the helpers both share.

## Analysis

| Script | Does | Needs |
| --- | --- | --- |
| `analysis/dispute_resolution_practice.py` | Counts the dispute resolution records in the profiles by kind, evidence tier, recognition and region, and lists data quality flags, as JSON for `research/analyses/` | `scripts/requirements.txt` |

## Native nations dataset

Scripts that built the first profiles in `content/tribes/` from cited facts in
`research/raw/` (see [research/raw/README.md](../research/raw/README.md)).
They are kept so the first edition can be reproduced; once profiles are edited
by hand, add new facts by hand or in a new raw file and review the diff.

| Script | Does | Needs |
| --- | --- | --- |
| `tribes/federal_facts.py` | Parses the Federal Register list of recognized entities and the Bureau of Indian Affairs Tribal Leaders Directory into cited facts, keeping office contact points only | Python 3 standard library |
| `tribes/build_profiles.py` | Merges every raw file into profiles and new source records, drops facts the schema rejects and writes a build report | `scripts/requirements.txt` |
| `tribes/write_sessions.py` | Writes a research session log for each raw file that has none | `scripts/requirements.txt` |
| `tribes/move_database_listings.py` | Moves provision records copied in bulk from the National Center on Restorative Justice database into `dispute_resolution.database_listings`, with the database's tags as fields (decision record 0015); `--check` counts without writing | `scripts/requirements.txt` |
| `tribes/split_component_bands.py` | Creates profiles for the six component bands of the Minnesota Chippewa Tribe, linked by `part_of`, and moves the facts that concern one band to that band (decision record 0016); `--check` counts without writing | `scripts/requirements.txt` |
| `tribes/find_pronunciations.py` | Reads each nation's official website and lists passages that mention pronunciation, and linked audio, for review by hand; never writes to a profile | `scripts/requirements.txt` |
| `tribes/find_official_images.py` | Reads each nation's official website and saves candidate seal, flag and logo images, and every sentence about reusing site content, to a private folder for review by hand; never writes to a profile | `scripts/requirements.txt` |
| `tribes/write_official_images.py` | Writes the reviewed images, reuse signals and USPTO tribal insignia database entries from `research/raw/` into the profiles, with source records ([docs/official-images.md](../docs/official-images.md)) | `scripts/requirements.txt` |

## Outreach

Run by hand, never in continuous integration:

| Script | Does | Needs |
| --- | --- | --- |
| `build_outreach_overview.py` | Checks the private outreach plan against its schema and the public records in `research/outreach/`, and writes a private overview next to the plan ([decision record 0012](../docs/decisions/0012-outreach-list-split-public-and-private.md)) | `pip install -r scripts/requirements.txt` |

## Provision pre-review

Run by hand, never in continuous integration:

| Script | Does | Needs |
| --- | --- | --- |
| `review/provision_pre_review.py` | `gather` fetches the source cited by every provision record in `content/tribes/` into a local cache and writes evidence batches for reviewers; `merge` combines the reviewers' verdicts into the reviewable files in [`research/reviews/`](../research/reviews/README.md). It never changes a profile | `pip install -r scripts/requirements.txt`, plus `curl` and `pdftotext` for `gather` |

## Data gap review

Run by hand, never in continuous integration. They follow up rows 1, 7 and
11 of the [dataset gap audit](../research/analyses/2026-11-21-dataset-gap-audit.md)
and fill in the `verification` level from [decision record 0014](../docs/decisions/0014-verification-levels-and-record-lint.md).

| Script | Does | Needs |
| --- | --- | --- |
| `review/name_matches.py` | `gather` lists every profile fact joined to a nation by name, beside the label its source uses, and marks the exact matches; it never changes a profile | `pip install -r scripts/requirements.txt` |
| `review/compact_clauses.py` | `gather` downloads each nation's own gaming compacts for every compact dispute clause copied from another nation's compact, extracts the text and writes evidence files with the dispute resolution sections; it never changes a profile | `pip install -r scripts/requirements.txt`, plus `curl` and `pdftotext` |
| `review/court_listings.py` | `gather` fetches the listed link, the nation's website and its court pages for every court listed from a directory, and keeps the passages that mention a court; it never changes a profile | `pip install -r scripts/requirements.txt requests beautifulsoup4` |
| `review/gap_review.py` | `merge` combines the reviewers' verdicts into the reviewable files in [`research/reviews/`](../research/reviews/README.md); `levels` sets `verification` on every profile fact that has none (except provisions) from the fact's note or its group's level in `research/reviews/2026-11-21-verification-levels.json`, adding only that key; `apply` makes the review's clear fixes (copied compact clauses both reviewers found the same, cited to the nation's own compact; dead court links replaced with the court page the review fetched) | `pip install -r scripts/requirements.txt` |

## Gaming compacts and ordinances

Run by hand, never in continuous integration. They build the catalog in
[`research/gaming/`](../research/gaming/README.md) and never change a profile.
The documents they download stay private, outside the repository.

| Script | Does | Needs |
| --- | --- | --- |
| `gaming/compact_list.py` | `scrape` reads every page of the Office of Indian Gaming compact list; `download` saves each linked document and records its SHA-256, page count and text | `curl`, `pdfinfo`, `pdftotext` |
| `gaming/ordinance_list.py` | The same for the National Indian Gaming Commission's list of approved gaming ordinances | `curl`, `pdfinfo`, `pdftotext` |
| `gaming/build_catalog.py` | Joins both lists to the profiles and to Federal Register notices, writes the catalog files and a source record for each notice | `scripts/requirements.txt` |
| `gaming/check_quotes.py` | Fetches each cited page and marks whether each quotation appears on it word for word | `curl`, `pdftotext` |
| `gaming/build_context.py` | Merges the checked context research into `research/gaming/compact-context.*` and adds source records for its cases, regulations and rules | `scripts/requirements.txt`, `curl` |
| `gaming/clause_evidence.py` | `gather` cuts clause sections from the governing documents (or, with `gather-history`, from every older version) for reviewers; `check` checks their quotations against the text; `merge` writes `research/gaming/compact-clauses.*` | Python 3 standard library and the saved text |
| `gaming/build_histories.py` | `pairs` orders each nation's compact documents and pairs each amendment, replacement or set of Secretarial Procedures with the version before it for reviewers; `check` checks their quotations; `merge` writes `research/gaming/compact-history-versions.*` | `scripts/requirements.txt` and the saved text |
| `gaming/build_documents.py` | Writes a document history record (`content/documents/`) for each nation's compact with each state, each Oklahoma off-track wagering compact and each set of Secretarial Procedures, with a source record for every version | `scripts/requirements.txt` and the saved text |
| `gaming/build_procedures.py` | Merges the Secretarial Procedures research into `research/gaming/secretarial-procedures.*` and `research/gaming/part-291-history.*`, checking quotations against the saved text | `scripts/requirements.txt`, `curl`, `pdftotext` |

## Tribal law texts

Run by hand, never in continuous integration. They build
[`research/tribal-law/`](../research/tribal-law/README.md) and never change a
profile. The documents they download, and the quotations, stay private.

| Script | Does | Needs |
| --- | --- | --- |
| `law/collect_law_texts.py` | `targets` lists every law code, court rules and dispute resolution link the profiles cite; `fetch` downloads each one and the chapters its index page links to, pacing each site; `scan` cuts the passages around dispute resolution terms into batches for reviewers; `merge` checks their quotations against the text and writes the provision files | `scripts/requirements.txt`, `curl`, `pdftotext`, `pandoc` |
| `law/second_pass.py` | `prepare` writes review batches of the hard cases and a fixed random sample; `apply` writes the second reader's verdicts beside the provisions | Python 3 standard library |
