---
id: 2026-11-27-state-statutes-sweep
date: '2026-11-27'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: One session wrote the shared state statutes pipeline (scripts/law/state_statutes/) and one adapter per state, ran it, read a random sample of the readers' verdicts as a spot check, and settled the few it disagreed with in each state's settled.json. Smaller Claude models (Haiku) read every keyword hit and the recall samples blind to their pool, in batches of about 200, and gave each section a core, incidental or none verdict.
- kind: page-fetch
  name: Legislatures' code sites
  detail: 'Washington: every full-text chapter page of the Revised Code of Washington (app.leg.wa.gov/RCW). Oregon: every chapter page of the 2025 Oregon Revised Statutes (oregonlegislature.gov/bills_laws/ors). Nevada: every chapter page of the Nevada Revised Statutes (leg.state.nv.us/nrs). Oklahoma: the 88 title PDFs listed on oklegislature.gov, read again to move the pilot onto the pipeline.'
purpose: 'Trevor asked on Nov. 26, 2026 (Pacific time) to "start on tier 3 for states", and then that the work be "a general flow and modular nature for this, so all states can be port and seams".'
queries:
- Which sections of each state's code are Indian law, labeled core or incidental, by the Oklahoma pilot's method
- How well the keyword pass finds them in each state, measured on random samples of the other sections
sources_added: []
limits: 'Reader verdicts are Unverified until a person checks them; the session read about 40 random verdicts per state and agreed with all but one or two. Recall rests on samples of 300 non-hits near a strong hit and 300 other non-hits per state. Each record links to the official site and is not served (state statutes stay link only). Sections in force only: repealed, renumbered and replaced sections are left out. Montana and the other states are not yet read.'
---

# State statutes sweep: session notes

The pipeline and how to add a state are described in `scripts/law/state_statutes/README.md`. Each state's results are in `research/state-statutes/<state>/`: `sweep.json` (the keyword pass and reading counts), `pool-key.json` and `readings.jsonl` (every verdict, so the recall figures can be checked), `indian-law-sections.csv` (the list the records are written from) and `settled.json` (hand fixes). The reading instructions are `research/state-statutes/reading-instructions.md`, the pilot's with the state left open and one rule added: a section of a chapter whose own name is Indian law (such as a definition in a state Indian child custody chapter) is part of that law even when its words name no Native term. Nevada's recall sample found two such sections, so every state's batches now include a fifth pool, E, of every non-hit in a chapter whose name has a strong term.

Oklahoma was moved onto the pipeline: `run.py seed OK` turns the pilot's list into the pipeline's list, and `run.py write OK` writes the same 380 records the pilot's writer did. The only changes are the writer named in each record, a full history line where the pilot cut it at 600 characters, and history lines no longer taking body text that wraps at "from".
