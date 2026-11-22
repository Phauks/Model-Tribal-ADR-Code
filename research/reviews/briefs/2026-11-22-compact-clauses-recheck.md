# Brief: third reading of compact dispute clauses the Nov. 21 review left undecided

Read first the second-pass brief, research/reviews/briefs/2026-11-21-compact-clauses-second-pass.md (how to find the governing document and read its dispute resolution section). The Nov. 21, 2026 review (research/reviews/2026-11-21-compact-clauses.json) left 86 copied compact clauses undecided: the two passes disagreed, a pass gave medium confidence, or a pass could not tell. Each of these items gets a third reading.

For each item:
- Find the governing document: the nation's newest compact, amended and restated compact, or Secretarial Procedures in the Office of Indian Gaming list that has a dispute resolution section, together with any later amendment that changes that section. The extracted text is listed in WORK_DIRECTORY/compacts/text-files.json; a scanned document with no text layer is read from page images (pdftoppm), and the item says so.
- Read the whole dispute resolution section, and search the rest of the document for other steps (notice, meeting, mediation, arbitration, court, waiver of sovereign immunity, cure periods, board or panel review).
- Give a verdict: `same` (the copied summary is right in substance for this nation), `differs`, or `cannot-tell`, with your confidence.
- Copy one short verbatim quote from the clause, check it word for word against the text layer (or say it was read from a page image), and give the pinpoint locator (section number and heading, plus PDF pages for scans).
- When the verdict is `differs`, write a proposed summary of one or two sentences in plain language, and say in one clause what the copied summary got wrong.
- Secretarial Procedures that set out no dispute process between the Tribe and the State must say so plainly and neutrally; do not import the compact model's process.
- Use the gaming thread's findings as cross-checks, not as the reading itself: research/gaming/secretarial-procedures.json, compact-clauses.json and compact-history-versions.json (rows marked `changed` name the amendment that changed the clause).

An item is clear when the third verdict agrees with one earlier pass at high confidence. Anything else (an umbrella profile, a governing document that is not posted, a version history that disagrees with the reading) goes to the lead author with one sentence on why.

Output: a JSON array, one object per item: {"item_id": n, "third_pass": "same|differs|cannot-tell", "confidence": "high|medium|low", "governing_document": {"title", "date", "link"}, "locator": "...", "quote": "...", "quote_checked": "...", "proposed_summary": "or null", "copied_text_problem": "or null", "why_left": "or null"}.

## How this brief was used

No subagent tool was available in the Nov. 22, 2026 session, so the lead session (Claude (AI assistant)) did the third reading of all 86 items itself, on the full text of each governing document, and recorded the reader as `lead session (Claude (AI assistant)), full text` in `third_pass_reader`. Every quote taken from a text layer was checked word for word by script. Two documents were read from page images: the San Pasqual Band 2018 compact (PDF pages 118 to 119) and the scanned Seneca-Cayuga Nation 2005 compact (PDF pages 34 to 36). The Tolowa Dee-ni' Nation 2020 compact was read from the capture's extracted text, because the Nov. 21 gather found no document under the nation's name.
