---
id: 2026-11-26-state-statutes-pilot
date: '2026-11-26'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: One session wrote the scripts in scripts/analysis/state_statutes/, ran them, surveyed the fifty states' code sites and wrote the note. Sixteen smaller Claude models (Haiku) read 3,515 Oklahoma sections blind to their pool and gave each a core, incidental or none verdict; the session read 73 of their verdicts at random as a spot check.
- kind: page-fetch
  name: oklegislature.gov
  detail: The 89 Oklahoma Statutes title PDFs (OK_Statutes/CompleteTitles/os<title>.pdf), updated Nov. 12, 2026.
- kind: page-fetch
  name: app.leg.wa.gov and leg.state.fl.us
  detail: Every chapter page of the Revised Code of Washington and the 2025 Florida Statutes, for keyword counts.
- kind: web-search
  name: Web search and the fifty legislatures' code pages
  detail: Each state's official code source, format and terms; Justia, the Legal Information Institute and Public.Resource.Org as bulk sources.
purpose: 'Trevor asked on Nov. 26, 2026 to "spike states for number of potential statutes and best method forward", starting "with a single test state".'
queries:
- How many Oklahoma statute sections are Indian law, read in full, and how well a keyword pass and small-model readers find them
- How many Indian law sections the fifty states have in all
- Where each state publishes its code, in what format and on what terms, and how hard each is to script
- Whether any national source can stand in for the states' own sites
sources_added: []
limits: 'Only Oklahoma was read in full; Washington, Oregon and Florida are keyword counts, and the other states are estimated from bands set by how many nations and how much Indian country each has. Recall in Oklahoma rests on random samples of non-hits (no Indian law found in 2,200 other sections; at least 86% at 95% confidence). Thirteen State-Tribal Gaming Act sections that name no Native term are not counted. Five states (Connecticut, Illinois, New Hampshire, West Virginia, Wisconsin) and the California and Hawaii sites could not be reached from the session and are rated from search results. Reader verdicts are Unverified until a person checks them.'
---

# State Indian law statutes pilot: session notes

The findings, method, survey and cost are in the [pilot note](../../analyses/2026-11-26-state-statutes-pilot.md). Its data is in `research/data-roadmap/2026-11-26-state-statutes/`: the Oklahoma list with links to the page of the official PDF where each section starts (`oklahoma-indian-law-sections.csv`), the readers' 3,515 verdicts (`oklahoma-readings.json`) and their instructions, the fifty-state survey (`fifty-state-survey.csv`), the Washington and Florida keyword counts, the nations-by-state counts behind the estimate bands, and draft records (`record-shape-examples.yaml`).

The scripts are in `scripts/analysis/state_statutes/`: `ok_parse.py` splits the converted title PDFs into sections and tags terms, `ok_batches.py` builds the blind reading pools, `wa_count.py` and `fl_count.py` count Washington and Florida, and `survey_rows.py` writes the survey table and the national range. The downloaded PDFs and chapter pages were not kept in the repository; the scripts fetch them again.
