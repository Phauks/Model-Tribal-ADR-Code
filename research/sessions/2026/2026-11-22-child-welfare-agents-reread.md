---
id: 2026-11-22-child-welfare-agents-reread
date: '2026-11-22'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: page-fetch
  name: curl, pdfinfo, pdftotext, pdftoppm
  detail: Downloaded the govinfo PDF of 91 Fed. Reg. 30,665 (May 26, 2026); pdftotext showed the table
    on pages 30,667-30,722 has no text layer, so the pages were rendered as images at 110 dpi (one entry
    at 300 dpi).
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: Read the Tribe column of every page image and transcribed it (no agent names, telephone
    numbers or email addresses), then compared the transcription and the second gap review's OCR
    results with the profile facts through scripts/review/child_welfare_agents.py.
purpose: Re-read the Indian Child Welfare Act designated agent list (gap audit row 8) and confirm each
  profile fact that cites it.
queries:
- https://www.govinfo.gov/content/pkg/FR-2026-05-26/pdf/2026-10420.pdf
sources_added: []
limits: >-
  The profile facts record only that a nation is listed, not its agent's office or address, so only
  the Tribe column was transcribed. The transcription is a reading of page images by an AI assistant;
  it agrees with the second gap review's separate OCR reading on every fact. The level was raised to
  read-in-full only for the 70 facts whose name that OCR text also matched word for word.
---

Output: the transcription of the table's Tribe column,
[`2026-11-22-child-welfare-agents-table.csv`](../../reviews/2026-11-22-child-welfare-agents-table.csv)
(582 rows with the printed page), and changes to the 575 profile facts that
cite the notice, described in the "Applied" section of
[the second gap review](../../reviews/2026-11-22-second-gap-review.md).

Method: every profile fact's "Listed as" name was matched to the
transcription, ignoring case, punctuation and "&" against "and". All 575 were
found, the multi-row ones (Minnesota Chippewa Tribe, Passamaquoddy Tribe,
Pribilof Islands, Native Village of Venetie, and the shared Capitan Grande
Band row) row by row. Every table row matched a fact.

Ruled out: no agent office or contact was added to any profile; the six
Minnesota Chippewa band profiles still have no fact, because that needs the
lead author's decision.
