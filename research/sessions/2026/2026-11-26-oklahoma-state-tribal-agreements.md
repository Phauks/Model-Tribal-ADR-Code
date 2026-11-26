---
id: 2026-11-26-oklahoma-state-tribal-agreements
date: '2026-11-26'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: One session wrote scripts/agreements/oklahoma_register.py and ran it. Four smaller Claude models each read a quarter of the register's lines (title and description only) for the nations, other parties, subject, kind of filing and a plain title; where their reading and the script's differed, the session settled each line by hand.
- kind: page-fetch
  name: execleg.sos.ok.gov
  detail: The Oklahoma Secretary of State's register data file (json/dataTribal.json) and each filing's PDF (documents/filelog/<id>.pdf).
purpose: 'Trevor asked on Nov. 26, 2026 to "grab" the tier 3 state-tribal compacts counted in research/analyses/2026-11-26-tier-2-and-3-data-sources.md, section 3.4: the 1,087 filings in Oklahoma''s register of tribal compacts and agreements.'
queries:
- Every filing in the Oklahoma Secretary of State's register of tribal compacts and agreements, 1968 to Nov. 2026
- Which nations, other governments and subject each filing names, and whether it is an agreement, an addendum, an amendment, a letter, an approval or a notice
- Which class III gaming filings are the State's copies of compacts the project already holds from the Office of Indian Gaming
sources_added: []
limits: 'The filed PDFs are scans with no text layer and were not read; every fact comes from the register''s own one-line title and description. The filing date is not the signing date. Gaming filings were matched to held compacts by nation and date only (research/state-agreements/oklahoma/gaming-matches.csv); filings outside the date window were kept as their own records, so some of the 2005 and 2006 model compacts may be the same instruments as held compacts. Records start unverified.'
---

# Oklahoma's register of state-tribal compacts and agreements: session notes

The script and how to run it are described at the top of `scripts/agreements/oklahoma_register.py`. Its outputs are in `research/state-agreements/oklahoma/`: `register.json` (the State's data file as downloaded), `readings.json` (the AI readers' readings of each line), `settled.json` (lines settled by hand), `filings.csv` (one row per filing, with the checks), `gaming-matches.csv` and `nation-facts.json` (the nation-page facts, applied with `scripts/jurisdiction/apply.py`).
