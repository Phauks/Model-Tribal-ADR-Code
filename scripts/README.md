# Scripts

Checks that run on every pull request (see `.github/workflows/checks.yml`). Run them from the repository root before opening a pull request.

The workflow's final job, `All checks`, passes only when every other check passes, and it is the only check the `main` ruleset requires. To add a check, add a job to the workflow and list it under `all-checks.needs`.

| Script | Checks | Needs |
| --- | --- | --- |
| `check_text.py` | Every text file is UTF-8 without a byte order mark, in Unicode Normalization Form C, with LF line endings and a final newline | Python 3 standard library |
| `check_prose.py` | Warnings only, never a failure: on the lines a pull request adds to Markdown in `content/` and `docs/`, flags watch-list words, "serves as" and similar stand-ins for "is", trailing claims of significance, vague attributions, "not X but Y" frames, dashes and sentences over 40 words ([style guide, section 8](../docs/style-guide.md#8-sound-and-rhythm)). Words inside quotation marks are not checked. Without `--base` it checks every file, as an audit | Python 3 standard library |
| `check_migrations.py` | Every database migration in `site/migrations/` is named for the UTC time it was written and what it does (`20261123T0430_add_file_scans.sql`), apart from the 21 numbered files already applied; no two share a timestamp; each opens with a comment of at least five words saying what it changes, with no TODO left; and with `--base <ref>` no migration already on the base is changed, renamed or deleted ([site/migrations/README.md](../site/migrations/README.md)) | Python 3 standard library |
| `validate_records.py` | Every schema, example and content record is valid, and every citation key, glossary link, research session reference and document version link resolves; each search log (decision record 0025) sits in its topic and letter folder, names an existing profile, and has a status and `last_searched` date that agree with its searches; the data files the website reads (the tribal law provisions, the gaming compact tables, the tribal court opinions, the Supreme Court files and the reading link sites) match their schemas, and the nations, sources, seats and Presidents they name exist. A record pattern that matches no file is a warning, not an error | `pip install -r scripts/requirements.txt` |
| `lint_records.py` | Catches unchecked data (decision record 0014): profile facts with no `verification` level, services (`justice_institutions` and `dispute_resolution.forums` entries) with no `link`, two source records at one address, forum kinds with no method record, sources still unarchived 30 days after retrieval, sources cited by content headed for an edition that are unarchived, lack a citator result or are marked unverified, and (decision record 0018) document versions whose dates, order or status disagree, clause topics with no recorded change between versions, source records whose `document_version` does not match, and profile facts citing a version no longer in effect without naming it. With `--base <ref>` it fails only on problems the pull request adds or changes; run it with `--edition` before exporting an edition | `scripts/requirements.txt` |
| `find_archived_copies.py` | Asks the Wayback Machine to capture (`--save`) or find a capture of each source record's original link that has no archived copy, and writes a report (`--report FILE`); it never edits records. `--reuse-days D` reuses a copy the Archive already holds when it was taken within D days of the record's retrieval date, looking up every record before it saves any, `--state FILE` remembers lookups with no recent copy and failed saves between runs, `--minutes M` stops starting new records after M minutes, and the report is rewritten after each record. The archive workflow runs it on each pull request's sources and in back-to-back catch-up runs on older ones | `scripts/requirements.txt` |
| `apply_archive_report.py` | Writes the captures in one or more archive reports into the records' empty `archives` lists, changing only those lines. The archive workflow's catch-up job runs it after each capture run, checks the records and adds them to one rolling pull request from branch `archive/captures` | Python 3 standard library |
| `coverage_report.py` | Counts how much of the dataset has been checked and how closely: facts by section and verification level, dispute resolution coverage by region, archives, citator checks, document histories and their versions, clauses and changes, method and glossary status, and search logs (nations by status per topic, dispute resolution searches by region, failed searches by kind of place and outcome). With `--base <ref>` it shows each count beside the base's. In continuous integration the report goes to the job summary | `scripts/requirements.txt` |

`record_facts.py` holds the helpers both share.

## Analysis

| Script | Does | Needs |
| --- | --- | --- |
| `analysis/dispute_resolution_practice.py` | Counts the dispute resolution records in the profiles by kind, evidence tier, recognition and region, and lists data quality flags, as JSON for `research/analyses/` | `scripts/requirements.txt` |

## Legal help

| Script | Does | Needs |
| --- | --- | --- |
| `legal-help/match_nations.py` | Matches each legal help provider in `research/legal-help/providers/` to the nation pages it serves (named in its source, a nation's own members, or every nation in a state its source covers statewide) and writes `research/legal-help/nation-matches.csv`. Fails if a record names a nation page that does not exist or a source it does not list. `--check` validates without writing | `scripts/requirements.txt` |

## Model forms

| Script | Does | Needs |
| --- | --- | --- |
| `forms/build_forms.py` | Builds a Word (.docx) and a PDF copy of each model court form in `content/forms/`, leaving off its front matter and its notes for courts and putting in each placeholder's model text from `content/variables/`, then writes `SHA256SUMS.txt` and `checksums.json` with each file's SHA-256 hash (decision record 0049). `--out DIR` (default `site/static/help/forms`, served at `/help/forms/`), `--no-pdf` | `scripts/requirements.txt`, pandoc, LibreOffice |

## Native nations dataset

Scripts that built the first profiles in `content/tribes/` from cited facts in `research/raw/` (see [research/raw/README.md](../research/raw/README.md)). They are kept so the first edition can be reproduced; once profiles are edited by hand, add new facts by hand or in a new raw file and review the diff.

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
| `review/apply_provision_decisions.py` | Applies the lead author's decisions on the provision pre-review to the profiles (decision record 0027) and fills the pre-review's `lead_author_decision` column; `--check` only reports | `pip install -r scripts/requirements.txt` |

## Data gap review

Run by hand, never in continuous integration. They follow up rows 1, 7 and 11 of the [dataset gap audit](../research/analyses/2026-11-21-dataset-gap-audit.md) and fill in the `verification` level from [decision record 0014](../docs/decisions/0014-verification-levels-and-record-lint.md).

| Script | Does | Needs |
| --- | --- | --- |
| `review/apply_title_only_reading.py` | Applies the Nov. 22, 2026 reading of provisions known only by a section title (review queue item 2) from `research/reviews/2026-11-22-title-only-provisions.json`: read sections get the printed title, a citation and link to the text, a summary and `read-in-full` (a new source record when the project had none for that address); repeats and out-of-scope sections are removed; the rest become `title-only`; every search is appended to the nation's [search log](../research/search-logs/README.md). Records are matched by title, citation and link | `pip install -r scripts/requirements.txt` |
| `review/name_matches.py` | `gather` lists every profile fact joined to a nation by name, beside the label its source uses, and marks the exact matches; it never changes a profile | `pip install -r scripts/requirements.txt` |
| `review/compact_clauses.py` | `gather` downloads each nation's own gaming compacts for every compact dispute clause copied from another nation's compact, extracts the text and writes evidence files with the dispute resolution sections; it never changes a profile | `pip install -r scripts/requirements.txt`, plus `curl` and `pdftotext` |
| `review/court_listings.py` | `gather` fetches the listed link, the nation's website and its court pages for every court listed from a directory, and keeps the passages that mention a court; it never changes a profile | `pip install -r scripts/requirements.txt requests beautifulsoup4` |
| `review/gap_review.py` | `merge` combines the reviewers' verdicts into the reviewable files in [`research/reviews/`](../research/reviews/README.md); `levels` sets `verification` on every profile fact that has none (except provisions) from the fact's note or its group's level in `research/reviews/2026-11-21-verification-levels.json`, adding only that key; `apply` makes the review's clear fixes (copied compact clauses both reviewers found the same, cited to the nation's own compact; dead court links replaced with the court page the review fetched); `rewrite-compacts` rewrites copied compact clauses from the nation's own compact (both Nov. 21 reviewers found them different, or the Nov. 22 re-check in `research/reviews/2026-11-22-compact-clauses-recheck.json` came out clear) and cites that compact | `pip install -r scripts/requirements.txt` |
| `review/court_listings_second_pass.py` | Second pass on the directory-listed courts the first review could not confirm: `gather` searches the first two websites on record for each nation more deeply (robots.txt obeyed, sitemaps, up to five court pages), reads state court system, Bureau of Indian Affairs and intertribal court directories and the collected law codes, and logs every address fetched; `merge` checks that each cited address was fetched with status 200 and writes the reviewable files in [`research/reviews/`](../research/reviews/README.md) and one [search log](../research/search-logs/README.md) per nation for the topic `courts`; `apply` replaces a dead listed link with the court page the review fetched, keeping the listed link in the note | `pip install -r scripts/requirements.txt beautifulsoup4`, plus `curl` and `pdftotext` |

## Dispute resolution coverage search

Run by hand, never in continuous integration. It follows up row 2 of the [dataset gap audit](../research/analyses/2026-11-21-dataset-gap-audit.md) and writes the [search logs](../research/search-logs/README.md) of decision record
0025. It never changes a profile.

| Script | Does | Needs |
| --- | --- | --- |
| `review/coverage_search.py` | `gather` reads what the project already holds for every federally recognized nation with no dispute resolution record (tribal law texts, constitution readings, justice institutions, raw facts, peacemaking sources, the Alaska Court System's restorative justice plans), then fetches its National Indian Law Library page, its website (home page, sitemap, site search and linked law and court pages), court pages and code links with an honestly named link checker that obeys robots.txt and logs a refusal as `blocked`, keeping passages around dispute resolution words in a private work folder; `batches` writes review batches and a fixed 10 percent sample of nations with nothing found; `second` re-fetches the evidence page of every first-pass candidate for the second reader; `merge` drops candidates the second reader set aside and writes `research/reviews/2026-11-22-dispute-resolution-coverage.{json,csv}` (empty decision column), a counts file and one search log per profile | `pip install -r scripts/requirements.txt requests beautifulsoup4`, plus `pdftotext` |

## Gaming ordinance dispute procedures

Run by hand, never in continuous integration. It reads the gaming ordinances already captured for [`research/gaming/`](../research/gaming/README.md), downloads nothing, writes the [search logs](../research/search-logs/README.md) of topic `gaming-dispute-procedures` and never changes a profile.

| Script | Does | Needs |
| --- | --- | --- |
| `review/ordinance_disputes.py` | `batches` reads the saved text of every ordinance and amendment in `research/gaming/ordinance-documents.json`, marks pages with no text layer, approval letter pages and tables of contents, finds sections on patron disputes, employee grievances, licensing hearings and appeals, mediation, arbitration, peacemaking and Tribal court review by heading and keyword, picks each nation's newest document with each kind of procedure, records every document checked (scanned ones as `scanned-unreadable`; no OCR) and writes review batches for reviewers following [the brief](../research/reviews/briefs/2026-11-22-ordinance-disputes.md) into a private work folder; `merge` checks every reviewer snippet against the document text, queues low-confidence and garbled items for a second look and applies its verdicts, and writes `research/reviews/2026-11-22-ordinance-disputes.{json,csv}` (empty decision column), a counts file, one search log per profile and a private file of the snippets; `grab` (Nov. 23, 2026) adds the compact passages readers set aside, flags items with no steps, and marks every item keep, under the lead author's grab-now answer | Python 3 standard library and the saved text (`pdftotext` only for a missing text file); `merge` also `scripts/requirements.txt` |
| `review/ordinance_scans.py` | Reads the scanned ordinances (no text layer) as page images, in steps run in the `ordinance_disputes.py` work folder. `select` picks, for each nation whose `gaming-dispute-procedures` search log is `partly-searched` (or a list given with `--nations`), the newest full ordinance on the list if it is scanned and the scanned amendments listed on or after it, at most 3, and lists the same choice for every other nation as a second tier that is not downloaded. `download` fetches each first-tier PDF from its public link on the Commission's site, one at a time with a pause; it stops on a refusal and never tries to get around one. `pages` classifies each page as approval letter, other text, blank or image (no OCR). `batches` writes reading batches for reviewers following [the scan brief](../research/reviews/briefs/2026-11-23-ordinance-scans.md); it refuses to overwrite existing batches without `--force`. `merge-scans` adds the readers' items to `research/reviews/2026-11-22-ordinance-disputes.{json,csv}` (ids ending `#p<n>`, `partly-read` flags, the `grab` flags and decision, and spot-check verdicts from the work folder), appends a search entry per document to each nation's search log and sets its status, updates the counts file and the private snippets file. `second-tier --from WORK --work WORK2` writes the second tier's choice as the reading list of a new work folder, so the same steps can read it; `merge-scans` then replaces only the documents read in that folder. `merge-scans` also flags a document as `wrong-file`, with nothing recorded, when its file has the same sha256 as another nation's document and its link names that nation. `spot-check` prints the seeded sample of items to check by hand. Run `merge-scans` after `ordinance_disputes.py merge` and `grab`, because `merge` rewrites the review files and search logs from scratch | Python 3, `curl`, poppler (`pdfinfo`, `pdftotext`, `pdftoppm`); `merge-scans` also `scripts/requirements.txt` |
| `review/dispute_resolution_retry.py` | The second try (Nov. 23, 2026) at the nations whose dispute resolution search stayed `partly-searched`. `build --data FILE` turns the private work file (each nation's web searches, archived copies from the "fetch archived copies" workflow, and the 2022 Alaska Tribal Court Directory reading, plus the lead session's candidates) into `research/reviews/2026-11-23-dispute-resolution-retry.{json,csv}` (empty `lead_author_decision` column) and a counts file. `apply` appends those searches to the `dispute-resolution` search logs, never adding the same date, place and address twice, and sets each status (found, partly-searched while a place still failed, otherwise none-found). `grab` applies the lead author's grab-now rule: every candidate is kept and its weak spots go in a `flags` column. It never changes a profile | Python 3, `scripts/requirements.txt` |

## Applying the second gap review, Nov. 22, 2026

Run by hand, never in continuous integration. They re-check rows 21, 8 and 10 of the [dataset gap audit](../research/analyses/2026-11-21-dataset-gap-audit.md) independently of the [second gap review](../research/reviews/2026-11-22-second-gap-review.md) and write to records only the clear results both checks agree on (its "Applied" section). Everything else stays in that review's files for the lead author. None of them tries to get past a site that refuses scripts.

| Script | Does | Needs |
| --- | --- | --- |
| `review/source_links.py` | `check` requests every source record's address (HEAD, then GET for HTML pages; FederalRegister.gov documents through its API) and caches the result; `apply --agree` sets `history.status` to `removed` or `moved` (with the new address in `history.changes`) and `history.last_checked` where the review's `2026-11-22-source-links.csv` agrees, editing only the `history` block | `pip install -r scripts/requirements.txt requests` |
| `review/child_welfare_agents.py` | `compare` matches the Indian Child Welfare Act designated agent facts with a transcription of the notice's table, which is printed only as page images (`research/reviews/2026-11-22-child-welfare-agents-table.csv`); `apply` sets each fact's locator to its page, notes the re-reading, corrects names misread from the images, and sets `read-in-full` where the review's OCR also matched the name word for word | `scripts/requirements.txt` |
| `review/governing_documents.py` | `gather` opens each governing document still recorded by title only that no other work covers, from saved captures (with `--no-fetch`, nothing else), and checks the kind, nation, title and year in its opening text; `apply --agree` sets `read-in-full` where every check passes and the review's `2026-11-22-governing-documents.csv` also confirmed the link | `scripts/requirements.txt`, `requests`, `pdftotext` |

## Service links, Nov. 22, 2026

Run by hand, never in continuous integration. It follows the lead author's rule of Nov. 22, 2026, "If we list a service, it should have a link", for every `justice_institutions` and `dispute_resolution.forums` entry with no link ([review](../research/reviews/2026-11-22-service-links.md)). It never gets around a site that refuses scripts.

| Script | Does | Needs |
| --- | --- | --- |
| `review/service_links.py` | `gather` joins each service with no link to the Nov. 21 and Nov. 22 court reviews and to the linked entries of the same profile, then reads the nation's website, court pages and peacemaking pages where those give no own page, with the helpers of `review/court_listings_second_pass.py` (robots.txt obeyed; pages that review already fetched are read from its saved copies with `--reuse`); `merge` picks each link in the lead author's order (the service's own page, then the official directory entry that lists it, else none) with the hand decisions in `DECISIONS`, checks each link against a fetch log, and writes `research/reviews/2026-11-22-service-links.{json,csv}` and a search log entry for every place looked; `apply` sets `link` and adds to the note where it came from and when it was fetched, leaving `verification` and every other line as it was, and leaves alone a service that already has the review's link; `second WORK_DIRECTORY` records the second, deeper search of Nov. 23, 2026 (web searches and state court lists, kept in the work folder as `searches.tsv` and `fetch-log.json`): it checks each link in `SECOND_DECISIONS` against the fetch log, updates the review rows those decisions change and adds every search to the nation's search log, appending to its text so earlier entries stay as they were; run `apply` after it | `pip install -r scripts/requirements.txt beautifulsoup4`, plus `curl` and `pdftotext` |

## Gaming compacts and ordinances

Run by hand, never in continuous integration. They build the catalog in [`research/gaming/`](../research/gaming/README.md) and never change a profile. The documents they download stay private, outside the repository.

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

Run by hand, never in continuous integration. They build [`research/tribal-law/`](../research/tribal-law/README.md) and never change a profile. The documents they download, and the quotations, stay private.

| Script | Does | Needs |
| --- | --- | --- |
| `law/collect_law_texts.py` | `targets` lists every law code, court rules and dispute resolution link the profiles cite; `fetch` downloads each one and the chapters its index page links to, pacing each site; `scan` cuts the passages around dispute resolution terms into batches for reviewers; `merge` checks their quotations against the text and writes the provision files | `scripts/requirements.txt`, `curl`, `pdftotext`, `pandoc` |
| `law/second_pass.py` | `prepare` writes review batches of the hard cases and a fixed random sample; `apply` writes the second reader's verdicts beside the provisions | Python 3 standard library |

## Supreme Court people

Run by hand, never in continuous integration.

| Script | Does | Needs |
| --- | --- | --- |
| `law/supreme_court_people.py` | Writes `content/supreme-court/people.yaml`, one entry per Justice and per appointing President, from the Federal Judicial Center's Biographical Directory, the Library of Congress list of Presidents and the inaugural committee's list of ceremonies, with a portrait from Wikimedia Commons where its license is free. Downloads each portrait at the size the website shows, records its SHA-256 and, with the R2 keys, puts it in the bucket under `supreme-court/portraits/`. Commons limits requests hard, so it waits between files; `--cache` keeps what it fetched for a re-run | `scripts/requirements.txt`, `boto3` and the R2 keys to upload |
| `law/small_sets.py` | The data roadmap's small sets (`docs/data-roadmap.md`): reads `research/data-roadmap/small-sets.yaml`, one entry per document (federal reports, land, international); `fetch` downloads and checks each file, `file` stores it in the bucket (served for U.S. government and public domain works, private otherwise) and `records` writes or updates the source records, all Unverified. Add a document by adding an entry and re-running | `scripts/requirements.txt`, `curl`, `pdfinfo`; `boto3` and the R2 keys to store |

## Free case law sources

Run by hand, never in continuous integration. Both use free public data with no account or key, find the newest data on their own, and can be re-run whenever new data or new case records arrive ([sources note](../research/analyses/2026-11-23-free-legal-information-sources.md)).

| Script | Does | Needs |
| --- | --- | --- |
| `caselaw/check_case_citations.py` | Looks up every case source record's citations in CourtListener's newest quarterly bulk files and compares the case name and year; writes `research/reviews/<date>-case-citations-courtlistener.csv`, and with `--apply` (or later `--apply-report`) a `courtlistener` block (cluster number and link) in each record that matches. About 2.6 GB of downloads, cached for re-runs | `scripts/requirements.txt`, `curl` |
| `caselaw/tribal_court_opinions.py` | Indexes the tribal court opinions in the Caselaw Access Project reporters named in `research/tribal-court-opinions/sources.yaml`: nations, topics and the case records each opinion cites; with `--file-captures` files each volume as a private capture and each opinion as a page the website serves (decision record 0047) ([README](../research/tribal-court-opinions/README.md)) | `scripts/requirements.txt`, `curl`; R2 keys for `--file-captures` |
| `caselaw/reading_links.py` | Builds and checks the other places to read each case and law record (official texts, free sites, Westlaw and Lexis, Wikipedia) from `research/reading-links/sites.yaml`; writes `research/reviews/<date>-reading-links.csv`, and with `--apply` a `reading_links` block in each record that the website prints after the citation ([README](../research/reading-links/README.md)) | `scripts/requirements.txt`, `curl` |
| `caselaw/caselaw_sources.py` | Shared helpers for these: downloads, the newest CourtListener release, citation parsing and case name comparison | |

## Constitutions

Run by hand, in this order, never in continuous integration. They build the catalog in [`research/constitutions/`](../research/constitutions/README.md) and the constitution version histories in `content/documents/`. The documents they download stay private, outside the repository; the work files (JSON between steps) go in a scratch folder.

| Script | Does | Needs |
| --- | --- | --- |
| `constitutions/collect_seeds.py` | Lists each federal profile's governing-document links and official websites | `scripts/requirements.txt` |
| `constitutions/fetch_documents.py` | Fetches those links and crawls each nation's site for constitution links (one request a second per host), saving each document and its text | `pip install requests beautifulsoup4 lxml`, `pdftotext` |
| `constitutions/find_more_versions.py` | `listed` adds the Tribal Law and Policy Institute list and looks up dead links in the Wayback Machine; `versions` lists earlier captures of known links | `requests` |
| `constitutions/fetch_library_of_congress.py` | Downloads the PDF of each Library of Congress item the profiles cite, through the item's JSON view | `pip install requests`, `pdfinfo`, `pdftotext` |
| `constitutions/fetch_archive_collection.py` | Downloads the Bureau of Indian Affairs constitution files on the Internet Archive and matches each file name to a nation | `requests` |
| `constitutions/combine_found.py` | Joins the fetched lists into one | Python 3 standard library |
| `constitutions/read_documents.py` | Reads each document (optical character recognition for scans), splits it into articles and tags articles by topic | `pdftotext`, `pdftoppm`, `tesseract` |
| `constitutions/review_batches.py` | `split` writes batches for AI reviewers to classify (skipping those already answered); `merge` joins the answers | Python 3 standard library |
| `constitutions/summarize_articles.py` | `split` writes the tagged articles of each newest text for AI reviewers to confirm and summarize; `merge` joins the answers. The summaries stay in the private work files: no AI summaries of constitutions are published | `scripts/requirements.txt` and `requests` |
| `constitutions/build_catalog.py` | Classifies, groups copies, orders versions and writes the catalog, a history record for every nation with a text, and source records | `scripts/requirements.txt` and `requests` |
| `constitutions/name_versions_in_profiles.py` | Adds `document_version` beside profile facts that cite a superseded or undated version | `scripts/requirements.txt` |

## Indian law journals sweep, Nov. 23, 2026

Run by hand, never in continuous integration. It reads the public catalogs that law school repositories publish for harvesters, so later sweeps can compare new articles against `content/sources/` ([session note](../research/sessions/2026/2026-11-23-indian-law-journals.md)).

| Script | Does | Needs |
| --- | --- | --- |
| `review/journal_oai_harvest.py` | Harvests the OAI-PMH catalog of each named repository collection (for example the American Indian Law Review at the University of Oklahoma) into one JSON list of titles, authors, dates, keywords, abstracts and landing pages; downloads no articles | Python standard library only |

## Governance

Run by hand, in this order, never in continuous integration. They write the `governance` facts in the profiles and the logs in `research/search-logs/governance/` ([decision record 0042](../docs/decisions/0042-governance-facts-from-governing-documents.md); [readings](../research/governance/README.md)). The constitution texts are the private captures' text extracts.

| Script | Does | Needs |
| --- | --- | --- |
| `governance/prepare_batches.py` | Picks each nation's constitution version to read and splits the texts into batches for AI readers, who follow `governance/reader-brief.md` | `scripts/requirements.txt` |
| `governance/crawl_websites.py` | Saves the government, council, constitution, election and court pages linked from each nation's home page, politely (one request at a time per site, at most 10 pages); a site that refuses is logged as blocked, not worked around | `scripts/requirements.txt`, `pdftotext` |
| `governance/prepare_website_batches.py` | Groups the saved pages into batches for AI readers, who follow `governance/website-brief.md` | |
| `governance/add_site_constitutions.py` | Adds the constitution texts found on nations' sites that the catalog lacked (`research/governance/site-constitutions.json`) to the document histories, with a source record and a private capture | `pdfinfo` |
| `governance/apply.py` | `readings` checks every quote against its text and writes `research/governance/readings.json`; `websites` does the same for the website readers and writes `website-readings.json`; `sources` writes a source record for each website page a fact cites; `directory` records the title of each leader's office from a saved query of the Tribal Leaders Directory; `write` puts the facts in the profiles and writes the search logs | `scripts/requirements.txt` |

## Source library

The text of every document in the private bucket, page by page, in one SQLite file with a full-text index, for Claude and other writers to find passages and the page to cite (decision record [0051](../docs/decisions/0051-search-the-source-documents-through-a-private-full-text-library.md)). The library lives in the bucket, never in git.

| Script | Does | Needs |
| --- | --- | --- |
| `library/library.py` | Searches the library: `search` (FTS5 queries with phrases, `NEAR`, `OR`, prefixes; filters by nation, topic, format, citing record or served copies), `titles`, `read` (a page, star page or passage, with `--around`), `document`, `nation`, `record`, `original` (download the file itself), `stats` and read-only `sql`. Downloads the library on first use to `~/.cache/model-tribal-library/` | `boto3`; bucket credentials in the environment |
| `library/build_library.py` | Builds the library. `update` is the usual command after files land in the bucket: it lists the bucket, downloads and reads only the files the published library has not read (`--ocr` reads their scanned pages with Tesseract), rebuilds and publishes. A nightly scheduled task runs it. The steps can also be run one at a time: `sync` downloads every text-bearing file to a work folder, `extract` reads each file once by SHA-256 (PDF text layer, OCR with `--ocr`, saved web pages with menus left out, opinions split at their star pages; `--seed` reuses the published library's text, passage by passage, so a rebuild keeps each document's passages and number), `index` writes the SQLite file with the capture index's metadata, keeping each document's number from the last build, and `publish` uploads it with a manifest and writes the website's change files under `_library/d1/` (`--d1-whole` writes the whole library from an empty database, to reload the website's copy). `d1-sql` writes the whole library as one SQL file for D1's import. The website's own files (request proofs, uploads, essay drafts, page versions) are never read | `boto3`, `pymupdf`, `lxml`; `tesseract` for `--ocr` |

## Printed book

| Script | Does | Needs |
| --- | --- | --- |
| `books/publish_file_sets.py` | Uploads the editions that `npm run build:editions` writes in `pdf/output/editions/` to the bucket under `books/`, where the website's order routes read them; skips files already there and sends `details.json` last ([docs/book-orders.md](../docs/book-orders.md)). Lists the plan unless given `--confirm` | `boto3` and the R2 keys in the environment |
