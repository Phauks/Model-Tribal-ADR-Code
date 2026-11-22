# Native nation constitutions and their versions

A catalog of the constitutions, articles of association, amendments and
federal corporate charters of the 581 federally recognized nations in
`content/tribes/`, with every dated version found, the judicial, dispute
resolution, peacemaking, election dispute, removal and sovereign immunity
articles in each, and how those articles changed between versions. Gathered
Nov. 21, 2026; how is recorded in
[the research session](../sessions/2026/2026-11-21-constitutions.md).

Lead author's request (Nov. 21, 2026): "Noting this difference between
different versions is important ... Try to get every constitution for the
tribes?" The versions are recorded in the document history records of
[decision record 0018](../../docs/decisions/0018-document-version-history.md).

These files are research material. They are not findings about any nation's
law, and they do not change what a profile says: the only profile edit is a
`document_version` beside facts that already cite an older text, naming the
version they describe.

## What was found

| Coverage status | Nations | Meaning |
| --- | ---: | --- |
| `current-text-found` | 128 | The newest dated text came from the nation's own site (or another live site) on Nov. 21, 2026 |
| `text-found-currency-unknown` | 48 | A dated text from a live site or library, but not shown to be the latest |
| `archival-copies-only` | 174 | Only the University of Oklahoma Law Library pages, the Library of Congress copies or the Bureau of Indian Affairs files below, often decades old |
| `undated-text-only` | 41 | A text was found but no date could be read from it |
| `listed-but-not-retrieved` | 29 | A profile or list cites a link that could not be fetched |
| `nation-says-no-written-constitution` | 1 | A document from the nation says so (Native Village of Eek, 2013 letter) |
| `none-found` | 160 | Nothing found by these methods (90 in Alaska, 29 in California) |

`none-found` does not mean a nation has no written constitution. Many Alaska
villages and California rancherias have constitutions that are not online,
and some nations keep theirs to citizens; the project records what it found
and does not guess.

Totals: 1,279 documents (11,374 pages) for 396 nations, of which 1,130 are
distinct texts; 219 version histories (nations with two or more dated
versions) holding 630 versions; 571 new source records; 2,012 article rows.

## Files

| File | One row per | Built by |
| --- | --- | --- |
| [`coverage`](coverage.csv) (`.csv`, `.json`) | Federally recognized nation: status, versions found, newest version and its status, topics found in it, where it was looked for | [`scripts/constitutions/build_catalog.py`](../../scripts/constitutions/build_catalog.py) |
| [`documents`](documents.csv) | Captured document classed as a constitution, constitution and bylaws, bylaws, amendment, articles of association, proposed constitution or corporate charter: printed title, dates, Secretarial approval clause, version, source record, capture | `build_catalog.py` |
| [`articles`](articles.csv) | Article of a captured text that a word match tied to a tracked topic, with the AI reviewer's confirmation and one-sentence summary where one was asked for | `build_catalog.py`, [`summarize_articles.py`](../../scripts/constitutions/summarize_articles.py) |
| [`briefs/`](briefs/) | The instructions the AI reviewers followed | |

The version histories are `content/documents/<letter>/<nation>-constitution.yaml`
(schema [`document-history`](../../schemas/document-history.schema.json)).
Each version's text has a source record
`content/sources/c/constitution-<nation>-<version>.yaml` (kind
`tribal-constitution`), unless a record for the same link already existed.
A nation with one dated version gets a source record but no history record
(decision record 0018: a single version needs none); its row in
`coverage` still gives the version and its topics.

## Where the texts came from

| Where | Documents | Notes |
| --- | ---: | --- |
| Bureau of Indian Affairs files ("US Tribal Constitutions", 11 Internet Archive items) | 497 | Scans of the Bureau's own constitution files released under the Freedom of Information Act and posted by The Memory Hole 2 with the Public Domain Mark; the National Indian Law Library's constitutions page describes the set. Text is the Internet Archive's optical character recognition. |
| University of Oklahoma Law Library, Native American Constitution and Law Digitization Project | 357 | Mostly texts of 1934 to the 1970s with their approval certificates. Classified by the page's file name and dated by rule from the certificates. |
| Library of Congress | 115 | The copies the profiles cite, downloaded on Nov. 22, 2026 through each item's JSON view (`?fo=json`); 2 of the 120 cited items returned no data. Mostly 1930s and 1940s printed texts, with a text layer. |
| Nation websites and other live sites | 258 | Crawled from each profile's official website (home page, up to eight navigation pages, two links deep). |
| National Indian Law Library Tribal Law Gateway (Native American Rights Fund) | 51 | |
| Tribal Law and Policy Institute constitutions list | 1 | The list was matched to nations; most of its links point to the sites above. |

The Wayback Machine (web.archive.org) resets connections from the research
environment during the secure handshake (the environment's own network access
is unrestricted), so dead links were not opened there; they are on the pull
list.

## How rows were classified

- **University of Oklahoma pages:** by rule. The file name says constitution
  (`cons`) or charter (`chrt`); adoption and approval dates come from the
  last certificates on the page, skipping the dates of the acts the nation
  organized under (June 18, 1934; May 1, 1936; June 26, 1936).
- **Everything else:** an AI reviewer (Claude Haiku, 33 batches) read the
  title, opening, closing and article headings of each document and gave its
  type, whether it belongs to the nation searched for, printed title,
  completeness, dates, amendments named, whether the text requires the
  Secretary of the Interior's approval, and evidence copied word for word.
  Rows say `classified_by: ai-reviewer`; none has been checked by the lead
  author yet.
- **Wrong nation:** a document the reviewer said belongs to another nation is
  moved to that nation only when the name matches one federally recognized
  nation closely (83 documents); otherwise it is left out.
- **Copies:** texts of the same year and kind that share at least 90% of
  their three-word runs are one version; a date one copy prints and another
  lacks is taken from the copy that has it, and the note says so. The
  primary copy is the live one, preferring the nation's own site, then the
  National Indian Law Library, a code publisher, the University of Oklahoma,
  the Library of Congress and the Bureau's files, and a text layer over
  scanned text. On the same date, archival copies are ordered before a live
  one.

## Versions, statuses and changes

- **Events:** the first full text is `original` (or `edition` when it says it
  includes amendments); a full text with a new adoption year is `revision`;
  other later full texts are `edition`; amendment-only files are `amendment`;
  drafts are `revision` with status `proposed`.
- **Status:** `in-effect` only for the newest full text found live on the
  nation's own site; earlier full texts are `superseded`; amendments and
  newest texts from libraries are `unknown`. These are project inferences:
  a later amendment may not be posted.
- **Dates:** compiled texts print their original adoption and approval dates;
  those are moved to the note, and the version is dated by the latest
  amendment it says it includes (`listed`). An approval date printed before
  the adoption date (often the approval to hold the election) is left out.
  When a Bureau scan has no legible date, its file name's date is used and
  flagged.
- **Clauses:** an article is listed as a clause when an AI reviewer read it
  and confirmed the topic (`read-in-full`, with a summary and any dispute
  resolution methods named), or when its heading names the topic
  (`title-only`, "not yet read"). Articles matched only by words in the body
  stay in `articles` as leads. Reviewers saw at most 3,500 characters of each
  article, so a provision later in a long article can be missed.
- **Changes:** for each version that supersedes another, each topic is
  `added` or `removed` when only one text has an article on it (a word-match
  inference), `unchanged` when the article texts share at least 97% of their
  three-word runs, and `not-compared` otherwise, or when an amendment or a
  text that could not be split into articles is involved. Every change is
  `inferred`; none was read side by side yet.

## The documents themselves

The PDFs and pages (2,688 files, about 2.0 GB with their text) are kept
privately with the project's working files under
`research/captures/constitutions/`, not in this repository. Constitutions are
the nations' own law: the project cites and links them and records facts from
them, but does not republish them (charter, CARE principles; tribal legal
texts are link-only, see [the data model](../../docs/data-model.md)). Each row
gives the capture path and SHA-256, so a copy can be checked against its link.
Copying them to the R2 bucket is still to do.

A nation may ask for any row, version or summary to be corrected, restricted
or removed ([charter, commitment 6](../../docs/charter.md#6-the-right-to-correct-restrict-or-withdraw);
[requests](../../docs/requests.md)). A constitution a nation keeps to its
citizens should not be added from another source.

## Federal context

Under section 16 of the Indian Reorganization Act, 25 U.S.C. § 5123
([source](../../content/sources/i/indian-reorganization-act-1934.yaml)), a
nation organizing under the Act adopts its constitution, and amendments, in an
election called by the Secretary of the Interior, and the Secretary approves
them; many of the approval certificates in these texts are that approval.
Some nations have since amended their constitutions to remove the
Secretarial approval requirement; 212 of the distinct texts here say
amendments need the Secretary's approval, and 3 say the requirement was
removed (reviewer readings, not checked). The election rules are in 25 C.F.R.
part 81 (Secretarial Elections), and Oklahoma and Alaska nations organized
under their own acts (the Oklahoma Indian Welfare Act and the 1936 Alaska
amendment to the Indian Reorganization Act). Those three have no source
record yet; they are on the pull list.

## Limits

- Scanned text (549 documents) has reading errors; dates and quotations need
  checking against the scan. 154 documents have no legible date.
- AI reviewers made judgment calls the lead author has not reviewed: document
  types, mixed files (a constitution with a charter or a Bureau letter in
  one scan), outcomes of elections when the certificate is garbled, and the
  dispute resolution methods named. Their notes say where they were unsure.
- Some Alaska scans saved under one village are another village's, and some
  Bureau files in one region's folder were matched to the wrong nation by
  name and moved back only when the reviewer named the right one.
- `added` and `removed` changes rest on word matches and are the weakest
  rows here.
- Wayback Machine copies of dead links, 2 Library of Congress items, and
  constitutions not online were not reached.
- Citation form: The Bluebook's 22nd edition adds a rule for Tribal Nations
  (Rule 22, constitutions at 22.2); the source records use the project's
  Indigo Book style and have not been checked against Rule 22.
