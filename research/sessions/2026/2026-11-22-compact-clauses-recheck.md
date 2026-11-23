---
id: 2026-11-22-compact-clauses-recheck
date: '2026-11-22'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: Read the dispute resolution section of each nation's own governing compact or Secretarial
    Procedures in full, compared it with the copied summary, wrote the replacement summaries and
    applied the clear fixes with scripts/review/gap_review.py rewrite-compacts.
- kind: other
  name: pdftotext and pdftoppm (Poppler)
  detail: Extracted text from the compact captures made in the Nov. 21, 2026 data gap review and
    rendered page images of scanned pages.
purpose: >-
  Finish row 1 of the dataset gap audit (approved by the lead author on
  Nov. 22, 2026): replace the 159 compact dispute clause summaries still copied
  from another nation's compact with summaries read from each nation's own
  compact, and re-read the 86 clauses the Nov. 21 review left undecided.
queries: []
sources_added: []
limits: >-
  Every reading is the assistant's and awaits the lead author's review. No
  subagent tool was available, so the third reading of the 86 undecided items
  was done by the lead session alone rather than by separate readers. Two
  documents were read from page images because they have no usable text layer
  (San Pasqual Band 2018 compact pages 118 to 119; Seneca-Cayuga Nation 2005
  compact pages 34 to 36). Amendments posted only as approval letters were not
  read. The `status` of each rewritten fact was not rechecked; it is still
  copied from the nation's latest Office of Indian Gaming list entry, as its
  note says.
---

## Reconciliation

- Every governing document already had a source record, matched by normalized address (from the Nov. 21 data gap review or the gaming thread's per-version sources), so no source record was added. The Tolowa Dee-ni' Nation's 2020 compact, which the Nov. 21 gather missed because the Office of Indian Gaming list files it under a title with a stray quotation mark, has the record `compact-ca-tolowa-dee-ni-nation-2020-12-11`.
- The 96 `compact-<state>-<nation>-<year>` source records made by the Nov. 21 data gap review do not duplicate the gaming thread's per-version sources: the gaming thread reused them and gave each a `document_version` link. None was repointed or removed.
- The gaming thread's findings in `research/gaming/` were used as cross-checks: `secretarial-procedures.json` for the 15 California Secretarial Procedures, `compact-clauses.json` for Montana and Nevada, and `compact-history-versions.json` to confirm that no later amendment changed a clause read here.

## Result

- 73 clauses that both Nov. 21 reviewers, with high confidence, found different now carry the reviewers' summary, cite the nation's own document and give its pinpoint. Two summaries were reworded first: Rincon Band (abbreviations spelled out, and the absence of a Tribe-State process stated) and Forest County Potawatomi Community (the arbitration rules' publisher named in full).
- Of the 86 undecided clauses, a third reading agreed with one earlier pass at high confidence for 81: 56 rewritten and 25 found the same and cited to the nation's own compact with their summary unchanged.
- 5 wait for the lead author in `research/reviews/2026-11-22-compact-clauses-recheck.{json,csv}`: Minnesota Chippewa Tribe (an umbrella profile citing a band's compact), Nez Perce Tribe (which compact governs), Nottawaseppi Huron Band of the Potawatomi (the printed clause lacks wording the summary gives), Red Lake Band of Chippewa Indians (its 1991 compact is not posted) and Shakopee Mdewakanton Sioux Community (the 1990 compact was replaced by a 1991 one not yet compared).
- 16 California Secretarial Procedures (15 from the third reading, plus Rincon Band) set out no dispute process between the Tribe and the State, and their summaries now say so.
