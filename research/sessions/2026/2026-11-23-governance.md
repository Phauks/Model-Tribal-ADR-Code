---
id: 2026-11-23-governance
date: '2026-11-23'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: AI readers (Claude Haiku, 36 batches) read the text of 372 nations' newest captured constitutions in full under scripts/governance/reader-brief.md and gave each governance fact with the exact words that state it; Claude Sonnet read five hard cases again. scripts/governance/apply.py kept a fact only when its quote was found in the text.
- kind: other
  name: ArcGIS feature service query
  detail: The Bureau of Indian Affairs Tribal Leaders Directory, queried on Nov. 23, 2026 for each row's name, component and jobtitle only (602 rows); names of officials were not requested.
purpose: Show how each nation's government is set up, after the lead author asked on Nov. 23, 2026, "Can we add information for these tribes relating to governance structure?"
queries:
- In each constitution text, the governing body, its size, selection and term; a general council; the head of government and other officers; elections, voting age and election authority; branches and separation of powers; courts, judges and protections for them; amendment and the Secretary of the Interior's approval; recall and removal
- The directory's jobtitle for each nation's row
sources_added: []
limits: >-
  The facts are AI readings, not yet checked by the lead author; the quote check proves only that the words are in the text. Most texts are library or archive copies of unknown currency, so a later version may be in effect. Nations without a captured constitution text, including every state-recognized and petitioning group, have no facts yet; their own websites are the next place to look. See research/governance/README.md.
---

Output: 5,396 facts from constitutions for 361 nations and the title of the leader's office for 572 nations, 5,968 facts on 576 profiles in all (`governance` in each profile); a governance search log for all 947 profiles; the readings with every quote in `research/governance/readings.json`; the Government section on each nation's page (decision record 0035).
