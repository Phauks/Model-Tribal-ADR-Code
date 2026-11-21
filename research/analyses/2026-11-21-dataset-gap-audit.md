# Dataset gap audit

**Date:** Nov. 21, 2026. **Scope:** everything on `main` at commit `da73a7c`
and the data in open pull requests #11, #12, #14 and #15, except the 1,327
dispute resolution provisions (reviewed separately, one by one) and the 12-item review queue in
`research/analyses/2026-11-21-dispute-resolution-practice.md` §9. Nothing was
changed while auditing.

**Basis of the counts.** Every count below is project analysis: a script read
every `content/tribes/*/*.yaml` profile, collected each cited fact (any object
with a `source` key, as defined by `cited` in `schemas/common.schema.json`),
and sorted it by profile section, source and the wording of its own `note`.
"How verified" is read from those notes (for example "Bulk record from the
NCORJ…", "Title is the link text in the directory…", "matched to the nation by
name"), the same method `scripts/analysis/dispute_resolution_practice.py` uses
for provisions (`evidence_tier`). Source counts come from the 2,130
`content/sources/*/*.yaml` records. `scripts/coverage_report.py` reproduces
these counts, and its "note suggests" columns use the same note wording
(`NOTE_LEVELS` in `scripts/record_facts.py`).

## Headline

- **19,675 cited facts** sit in the 948 profiles. **15,725 of them (80
  percent)** come from just 42 sources that are each cited by 20 or more
  profiles: lists, directories and data tables imported in bulk.
- **No fact records how it was verified.** The schema has `confidence`
  (high, medium, low) but no field for "read in full," "title only," "bulk
  import" or "inferred," so the level has to be guessed from free-text notes.
- **About 3,400 facts were joined to a nation by name** rather than by an
  identifier (population, census areas, states, gaming ordinances, compacts,
  memberships). Name joins are where silent errors hide.
- **No legal authority has a citator check.** The source schema has a
  `citator` field, and 0 of 2,130 source records fill it, including the 115
  cases, statutes, regulations and court rules already on `main`.

## Gap table

Verification levels: **read in full** (the document itself was read),
**title only** (a title, link text or table-of-contents line), **bulk
import** (a row copied from a list, directory or data table), **inferred**
(a value derived by a rule, a name match or another nation's document).

| # | Area | Records | How verified | Proposed check | Who |
| --- | --- | ---: | --- | --- | --- |
| 1 | Gaming compact dispute clauses (`gaming.compacts[].dispute_resolution_summary`) | 286 | 30 read in full; 256 inferred from another nation's compact for the same state. Of those 256, 185 use a compact dated three or more years away from the nation's own latest listed compact (94 newer, 91 older) | Read each nation's own compact (its PDF link is in the Office of Indian Gaming list note) and confirm or rewrite the clause | Haiku, in batches by state; scanned 1990s PDFs to Trevor |
| 2 | Dispute resolution coverage | 185 of 948 profiles have any record; 390 federally recognized nations have none; Alaska 9 of 224 | Coverage follows the sources searched | For each of the 390, search the National Indian Law Library page, the nation's own code site and the NARF peacemaking lists; record "searched, not found" with a date | Haiku, in batches by region; Alaska also needs outreach (Trevor) |
| 3 | Source archive copies | 1,994 of 2,130 sources on `main`, plus all 133 new sources in PR #12 | None archived | Run the "archive sources" workflow (review queue item 9) | Trevor (Actions) |
| 4 | Method records (`content/methods/`) | 32, all `proposed` | 18 from sources, 14 also project analysis | Check every quotation in the definitions against its source; then review with advisors | Haiku for quotes; Trevor for adoption |
| 5 | Legal history PR #12 | 8 unverified items; 65 cases | Read in full from free reporters, no citator | KeyCite every case; pull the 8 items | Trevor (Westlaw) |
| 6 | Profile basics: contacts, official names, Bureau of Indian Affairs region | 3,217 contacts; 948 names; 575 regions | Bulk import: 2,725 contacts and all 575 regions from the Tribal Leaders Directory (dated Nov. 20, 2026); 373 non-federal names from lists such as the 2013 petitioner list (244) | Low risk for the directory. Spot-check 60 federal contacts against nations' own sites; check all 217 non-federal contacts | Haiku |
| 7 | Facts joined to a nation by name | about 3,400 (population 1,307; census areas 632; states 578; gaming ordinances 474; compacts 224; memberships 186) | Inferred (name match, sometimes "spelling variant") | Script lists every non-exact match beside the source's own label; reviewers confirm or reject | Script, then Haiku |
| 8 | Indian Child Welfare Act designated agents (`jurisdiction`) | 570 | Bulk import read from page images of 91 Fed. Reg. 30,667 | Re-read the page images and compare the list | Haiku (image input) |
| 9 | Public Law 280 status (`jurisdiction`) | 365 | Inferred from the office state in the directory, with retrocession notices added | Compare against 18 U.S.C. § 1162 exceptions and each state's retrocession history | Trevor (legal judgment); Haiku can gather notices |
| 10 | Governing documents | 1,769 | About 1,050 title only (767 Law Library listings, 246 Tribal Law and Policy Institute link texts from 2022, 37 tables of contents); 337 historical texts; 192 links already dead | Link-check every link; open each live document and confirm title, kind and date | Script, then Haiku |
| 11 | Courts and justice institutions | 723 | 572 bulk import from directory listings (341 Law Library contact listings, 231 from the 2022 Institute directory); notes say whether the court still operates was not checked; 102 link failures | Confirm each court on the nation's own site or a current court directory | Haiku; unresolved ones to Trevor |
| 12 | Government structure | 349 | Inferred or historical: 151 from a 1947 table, 146 historical constitutions | Find each nation's current constitution | Haiku |
| 13 | Languages | 376 | 212 inferred: the language of the community's Alaska place name, with the language tag assigned by the researcher | Decide whether to keep these as "language of the place name" or drop them | Trevor decision |
| 14 | Related entities (Alaska) | 897 | 661 inferred: State of Alaska affiliations listed for the community, not the tribal government | Decide on labeling or removal | Trevor decision |
| 15 | Recognition and petition status | 1,200 | 259 petition statuses rest on the 2013 petitioner list plus absence from today's list; 7 possible duplicate groups marked "not verified" | Compare all against current Office of Federal Acknowledgment pages; decide the 7 duplicates | Haiku; Trevor for duplicates |
| 16 | Gaming operations and ordinances | 164 operations; 1,167 ordinances | Bulk import; 93 facility lists "machine-extracted (verify)"; 474 ordinance rows matched by spelling variant | Re-read the National Indian Gaming Commission report pages | Haiku |
| 17 | Dispute resolution records other than provisions | 119 (77 forums, 18 clauses, 10 training programs, 14 materials) | Mostly read in full; 15 forums from the bulk database, 6 clauses title only, 2 from OCR text, 3 materials from a web search listing | Check each description against its cited text; include the 19 forum kinds PR #15 renames, whose mapping was not checked against nations' own texts | Haiku |
| 18 | Legal authorities on `main` with no citator check | 118 (9 federal cases, 6 territorial cases, 37 federal statutes, 31 state statutes, 15 territorial statutes, 3 federal regulations and 14 court rules, which the lint counts as 115, plus 3 executive orders) | Read in full from free sources; currency unchecked | KeyCite cases; confirm statute currency | Trevor (Westlaw); Haiku can check statute currency on official free sites |
| 19 | Bibliography annotations | 160 annotated sources | At least 17 say "full text not read" (catalog or abstract only) | Read the full text before any annotation is printed | Haiku for free works; Trevor for paywalled (Westlaw, HeinOnline) |
| 20 | Glossary | 27 entries, all `draft` | From sources and project analysis | Check quotations; review | Haiku for quotes; Trevor |
| 21 | Source metadata | 2,130 sources | 1,099 have no issued date; all 2,130 say `history.status: live`, even where the note records a 404 | Link-check script sets status; find dates | Script, then Haiku |
| 22 | Sensitivity flags | 948 profiles | All set `tribal_review_required: false` by default, including 91 with self-designations or own-language forum terms | Decide which profiles touch community-held knowledge | Trevor decision |
| 23 | Outreach records | 193 | 445 citations; 30 marked "search-result-only" | Open those 30 pages | Haiku |

Small item found on the way: two decision records share number 0012
(`docs/decisions/0012-open-list-of-dispute-resolution-methods.md` and
`docs/decisions/0012-outreach-list-split-public-and-private.md`).

## Suggested order

1. Rows 7 and 10 start with scripts, cost nothing, and shrink later work.
2. Haiku batches with the highest drafting value: rows 1, 17, 11, 2.
3. Trevor and Westlaw: rows 5 and 18 together (one Westlaw session), then
   the decisions in rows 13, 14, 15 and 22.

## Sources

- Profiles: `content/tribes/*/*.yaml` (948 files); their `note` fields state
  how each fact was gathered.
- Sources: `content/sources/*/*.yaml` (2,130 files); fields `archives`,
  `history`, `citator`, `annotation`, `citation.issued`.
- Methods and glossary: `content/methods/*.yaml` (`status`),
  `content/glossary/*.yaml` (`status`).
- Outreach: `research/outreach/*.yaml` (`sources[].verification`).
- Prior analysis and its review queue:
  `research/analyses/2026-11-21-dispute-resolution-practice.md` and
  `scripts/analysis/dispute_resolution_practice.py`.
- PR #12 pull list: `research/pull-lists/2026-11-21-legal-history-westlaw.md`
  on branch `claude/project-thread-s4x4ng`.
- PR #15 session: `research/sessions/2026/2026-11-21-profile-data-cleanup.md`
  on branch `claude/project-thread-0qls2m`.
- Validator output on `main`: `python3 scripts/validate_records.py` (five
  forum kinds without a method record).
