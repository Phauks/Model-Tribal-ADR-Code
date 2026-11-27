---
id: 2026-11-27-removal-evidence-all-journeys
date: '2026-11-27'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: One thread session with seven research subagents, one per region (Southeast, Great Lakes, Ohio Valley, New York and the upper Mississippi, Southern Plains and Texas, Southwest and Great Basin, Pacific Coast and northern Plains); the thread session re-matched every quotation by script, read the context of the strongest ones, and wrote the findings.
- kind: page-fetch
  name: archive.org, govinfo.gov, treaties.okstate.edu, tile.loc.gov, static.case.law, nations' own websites
  detail: The Commissioner of Indian Affairs' annual reports and S. Doc. No. 512 (1834) on the Internet Archive, Serial Set scans and Statutes at Large pages on GovInfo, Kappler's treaties, Caselaw Access Project opinions, and links (not copies) to nations' own accounts.
purpose: 'Trevor said the removals data "feels somewhat weak" and that "we will need strong evidence to showcase how tribes or peoples were forced to move"; he approved a three-part standard (the order, the move recorded at the time, the force), piloted on six journeys, and its extension to the other 49 ("sounds good").'
queries:
- For each journey, the treaty, statute or order that required the move
- 'Records made at the time of the move: dates, numbers moved, deaths'
- Records of troops, prisoners, escorts, threats, state laws, protests, or findings that the move was against the nation's will, and records that the move was negotiated or chosen
sources_added: []
limits: 'Every item is Unverified until a person reads it in the source. Pin pages read from scan running heads are often approximate (each says so). Quotations are matched to the fetched text, so they keep the scans'' spelling and OCR flaws. Nations'' own accounts are linked, not read in full. Seven Serial Set documents and two state laws could not be fetched and are in the hand-pull list.'
---

# Removal evidence for all journeys: session notes

## What was found

See `research/analyses/2026-11-27-removal-evidence-all-journeys.md`. Of 55 journeys, 23 were forced (troops, prisoners, escorts or orders to kill), 17 pressured without troops, 13 negotiated or chosen, and 2 never carried out. 49 have both the order and a record of the move.

## What was built

`research/historic-maps/removals/evidence.json` now has 531 items across all 55 journeys and a `findings` entry per journey (kind of move, strength of record, arrow style, one-line summary). `scripts/removals/fetch_source.py` and `scripts/removals/check_evidence_quotes.py` fetch the sources and re-match the quotations; 464 of 466 match.

## Next

Show the kinds of move on the Removals page; apply the corrections in section 4 of the note to `removals.json` when the page is built; read the items in their sources before marking them Verified.
