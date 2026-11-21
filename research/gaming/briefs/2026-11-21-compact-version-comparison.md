# Brief: how a compact's dispute and renegotiation clauses changed

You are comparing two versions of a Class III tribal-state gaming compact between a Native nation and a state (Indian Gaming Regulatory Act, 25 U.S.C. § 2710(d)). Each item in a batch file pairs an EARLIER version (the compact in force) with a LATER document: an amendment to it, a replacement compact, or Secretarial Procedures issued in its place. The excerpts were cut by a script from text extracted from PDFs: they may start mid-sentence or miss a section. `excerpts` holds passages found under headings about dispute resolution and renegotiation; `whole_text_start` (for amendments, or when no heading was found) is the start of the document.

For EVERY item write one answer object. Read only what is in the file. Never use outside knowledge and never guess.

Answer object keys:
- "pair": copied exactly
- "dispute_resolution": how the process for resolving disputes between the nation and the state changed from EARLIER to LATER:
  {"change": one of "added" (LATER has a dispute process EARLIER lacked), "removed", "changed" (what the process provides is different: steps, deadlines, rules, forum, whether arbitration binds, who can sue where), "reworded" (the words differ but the process and its effect do not, e.g. a party's name or a cross-reference), "renumbered" (same text, new section number), "unchanged" (both clauses visible and the same; OR an amendment that does not amend the clause, for example one that lists the provisions it amends and says no other provision is amended, so the earlier clause still governs), "not-compared" (the excerpts do not show enough to tell),
   "summary": one neutral sentence saying what changed, e.g. "The replacement compact adds binding arbitration under AAA rules after 30 days of meeting and conferring, where the earlier compact went straight to federal court." For "unchanged" or "not-compared" say so briefly,
   "earlier_quote": exact 10-40 word quotation from EARLIER that shows the earlier rule, or null,
   "later_quote": exact 10-40 word quotation from LATER, or null,
   "earlier_locator" / "later_locator": section numbers as printed, or null}
- "renegotiation": the same shape, for how the compact can be amended or reopened for negotiation (who may ask, triggers such as a change in law or new games, time limits, what happens if talks fail).
- "difficulty": "easy" or "hard" (hard = garbled text, a section missing from one side, an amendment that rewrites only part of a section, or you cannot tell which clause governs)
- "note": anything a lawyer should know, or null

Rules: quotations are checked by a script against the documents; a quotation not found word for word is discarded, so copy character for character. "unchanged" for a replacement needs both clauses visible; for an amendment, say in the summary how you know the clause was not amended (e.g. "Section 15 is not among the provisions amended"). Use "reworded" rather than "changed" when only words differ. Neutral wording: say "the later compact provides", never call a change better or worse. Use "Native nation" or the nation's name in your own words, not "the tribe" (quotations stay as written).

Write your answers for batch-NNN.json as a JSON list to /tmp/claude-0/work/histories/change-answers/batch-NNN.json (same number), and check it parses with `python3 -c "import json,sys; json.load(open(sys.argv[1]))" FILE`. Do one batch at a time: read it, write its answers, go on. Do not post or send anything anywhere.
