# State statutes sweep

One pipeline finds the Indian law sections in a state's code and writes a link-only record for each. The steps are the same for every state; only the first two (download and split) differ, and those live in a small adapter per state. The method is the Oklahoma pilot's (research/analyses/2026-11-26-state-statutes-pilot.md, section 7).

## Steps

```
python3 scripts/law/state_statutes/run.py fetch WA      # download the official code into the work folder
python3 scripts/law/state_statutes/run.py parse WA      # split into sections, run the keyword pass
python3 scripts/law/state_statutes/run.py batches WA    # blind reading batches
# readers answer each batch (research/state-statutes/reader-prompt.md wraps reading-instructions.md)
python3 scripts/law/state_statutes/spot_check.py WA     # every batch answered? then 40 random verdicts to read
python3 scripts/law/state_statutes/run.py review WA     # strong hits a reader marked none: read each again, settle in settled.json
python3 scripts/law/state_statutes/run.py merge WA      # the state's list of Indian law sections
python3 scripts/law/state_statutes/run.py write WA      # the records, in content/sources/
```

Downloads, the sections file and the batches go in the work folder (`--work`, or `STATE_STATUTES_WORK`, default `/tmp/state-statutes/<state>/`), not in git. What goes in git, in `research/state-statutes/<state>/`: `sweep.json` (counts from the keyword pass and the reading), `pool-key.json` and `readings.jsonl` (every reader's verdict, so the recall figures can be checked), `indian-law-sections.csv` (the list the records are written from) and, when needed, `settled.json` (hand fixes by section number, which win over a reader).

## The keyword pass and the reading

`core.py` holds the shared term families (STRONG and WEAK). Each adapter adds its own nations' names to WEAK and lists place names (counties, rivers, towns named for nations) to take out before WEAK matches. Readers see four pools without being told which: A, every strong hit; B, every weak-only hit; C, a sample of non-hits enacted by the same session law as a strong hit or printed within two sections of one; D, a random sample of every other section. A fifth pool, E, holds every non-hit in a chapter whose own name is Indian law (a definition in a state Indian child custody chapter names no Native term but is part of that law). A chapter name counts when it has a strong term or a word in `CHAPTER_LAW` ("Indians", "Indian Antiquities", "Indigenous Affairs"), which Delaware's and North Carolina's recall samples added. A `core` or `incidental` verdict in C or D is a miss by the keyword pass: if misses exceed 5% of what was found, widen the terms and read again.

The readers are good at saying no to weak hits and less good at strong ones: in the first three states they marked about one strong hit in twenty `none` when the section gives tribes a role (a seat on a council, a consultation duty). `review` lists every strong hit marked `none`; read each and settle it. Then read about 40 other verdicts at random as a spot check (`spot_check.py`, which first checks that every batch line has an answer; `--misses` lists the recall samples' yes verdicts). After a change to the terms or the parser, `batches --extend` keeps what was read and adds only the new hits.

## Adding a state

Write `adapters/<state>.py` with a `State` subclass (`adapters/base.py`) named `ADAPTER`, and add it to `NAMES` in `adapters/__init__.py`. Fill in:

- the class attributes: `STATE`, `CODE_NAME`, `CODE_SHORT` (the Indigo Book abbreviation), `AUTHOR`, `EDITION`, `RETRIEVED`, `KEY_PREFIX`, `SOURCE_NOTE`, `NATION_NAMES`, `PLACE_NAMES`;
- `fetch(raw)`: download the code from the legislature's own site into `raw`, skipping files already there (`download_all` does this);
- `parse(raw)`: yield a `core.Section` for every section in code order, with its number, catchline, text (without history or editor's notes), history line, a link to the section on the official site, the chapter it sits in, the session law that enacted it (`act`, so the readers' recall pool can find its siblings) and its first enactment year;
- `short_citation(number)` when the Indigo Book form is not `<CODE_SHORT> § <number>`.

Check the split against the code's own table of contents before reading: a section count far from the code's is a parsing bug, not a finding.

Records the project already holds under the same key (most were made by hand for a nation page) are left as they are; so are any listed in the adapter's `HELD`.

## States

| State | Adapter | Source |
| --- | --- | --- |
| Washington | `adapters/washington.py` | Full-text chapter pages, app.leg.wa.gov/RCW |
| Oregon | `adapters/oregon.py` | Chapter pages, oregonlegislature.gov/bills_laws/ors (2025 edition) |
| Montana | `adapters/montana.py` | Section pages, mca.legmt.gov (2025) |
| Nevada | `adapters/nevada.py` | Chapter pages, leg.state.nv.us/nrs |
| Delaware | `adapters/delaware.py` (cited by title: section numbers are `<title>:<section>`) | Chapter and subchapter pages, delcode.delaware.gov |
| North Carolina | `adapters/north_carolina.py` | Whole-chapter pages, ncleg.gov; each record links to the section's own page |
| Rhode Island | `adapters/rhode_island.py` | Section pages, webserver.rilegislature.gov/Statutes |
| South Carolina | `adapters/south_carolina.py` | Chapter pages, scstatehouse.gov/code (no section anchors: records link to the chapter) |
| Virginia | `adapters/virginia.py` | Section pages, law.lis.virginia.gov/vacode |
| Alaska | `adapters/alaska.py` (no history lines in the print view; readers are told that Alaska Native Claims Settlement Act corporations count as Native) | Print view of each title, akleg.gov/basis/statutes.asp |
| Arizona | `adapters/arizona.py` (no history lines) | Section pages, azleg.gov/ars, listed on each title's page |
| South Dakota | `adapters/south_dakota.py` | The Legislature's statutes service, one call per chapter (sdlegislature.gov/api/Statutes) |
| Minnesota | `adapters/minnesota.py` (the Revisor prints catchlines in capitals; the adapter gives them title case) | Full-text chapter pages, revisor.mn.gov/statutes |
| North Dakota | `adapters/north_dakota.py` (no source notes in the PDFs, so no enactment years) | Chapter PDFs, ndlegis.gov/cencode, listed with section names on the Century Code page |
| Idaho | `adapters/idaho.py` | Section pages, legislature.idaho.gov/statutesrules/idstat, listed on each chapter's page |
| Kansas | `adapters/kansas.py` | Section pages, ksrevisor.gov/statutes, listed on each chapter's page |
| Vermont | `adapters/vermont.py` (cited by title: section numbers are `<title>:<section>`; appendix titles, such as the municipal charters of title 24, number sections within each chapter) | Full-chapter pages, legislature.vermont.gov/statutes; each record links to the section's own page |
| New Jersey | `adapters/new_jersey.py` | The Legislature's plain-text file of the statutes, pub.njleg.state.nj.us/statutes (no stable address for one section: records link to the statutes database's search for the section's number) |
| Pennsylvania | `adapters/pennsylvania.py` (cited by title: `<title>:<section>`; Consolidated Statutes only) | Whole-title pages, palegis.us/statutes/consolidated; each record links to the section's own page |
| Connecticut | `adapters/connecticut.py` (the site omits its intermediate certificate, which fetch() adds) | Chapter pages of the revision of Jan. 1, 2025, cga.ct.gov/current/pub, with the 2026 Supplement's sections in their place |
| Oklahoma | `adapters/oklahoma.py` (read in the pilot; `run.py seed OK` turns the pilot's list into this pipeline's list) | Title PDFs, oklegislature.gov |
