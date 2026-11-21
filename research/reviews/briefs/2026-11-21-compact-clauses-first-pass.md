# Brief: check each nation's own gaming compact dispute clause

Context: a research dataset of Native nation profiles records, for each nation with a tribal-state class III gaming compact, a one-sentence summary of the compact's dispute resolution clause. For the items in your batch, that summary was NOT read from the nation's own compact: it was copied from another nation's compact in the same state (`current_summary_copied_from`). Your job is a first-pass check against the nation's own documents. A law student will review every result. Accuracy matters more than speed; never guess.

Each item file (JSON) has:
- `item_id`, `profile`, `nation`, `state`, `current_summary`, `current_summary_copied_from`
- `documents`: the nation's compact documents for that state from the U.S. Office of Indian Gaming list, newest first. Each has `title`, `category` (Approve, Deemed Approved, Secretarial Procedures), `date`, `link`, `pages`, `opening` (first ~700 characters of extracted text), `dispute_sections` (up to 2 excerpts of about 6,000 characters starting at a heading that names dispute resolution; read these first) and, where no such heading was found, `dispute_passages` (excerpts around the word "dispute"). `scanned_no_text: true` or `missing: true` means there is no usable text.

For each item:
1. Work out which document holds the dispute resolution clause that governs now. Usually the newest document that is a full compact, a full replacement ("amended and restated"), or secretarial procedures. An amendment that changes only other sections (revenue sharing, term, games) does not replace the dispute clause; then the governing clause is in the latest earlier full compact. If a newer amendment rewrites the dispute section, that amendment governs.
2. Read that clause in `dispute_passages`. Record its section number and heading as `locator` exactly as printed, and quote the single most important sentence (under 60 words) exactly as `quote`.
3. Compare the clause's substance with `current_summary`: the steps (notice, meet and confer, negotiation, mediation, arbitration, court), time limits, who decides (arbitrator rules such as AAA or CPR, number of arbitrators), which court, and the immunity waiver.
   - `same`: every step and detail in `current_summary` is true of this nation's clause, and the clause has no further step of the same weight that the summary leaves out.
   - `differs`: anything in the summary is wrong for this nation, or a main step is missing.
   - `cannot-tell`: the passages do not contain the clause (wrong excerpts, no text, scanned, or missing documents).
4. If `differs`, write `proposed_summary`: one sentence in the same plain style as `current_summary`, stating only what the quoted clause says. No legal opinion.
5. `confidence`: high (the clause is fully in the excerpts and the comparison is clear), medium, or low.

Output: write a JSON array to the output path you are given, one object per item, in item_id order:
{"item_id": 7, "profile": "...", "governing_document": {"title": "...", "date": "...", "link": "..."} or null, "locator": "..." or null, "quote": "..." or null, "verdict": "same|differs|cannot-tell", "proposed_summary": "..." or null, "differences": "one sentence on what differs, or null", "confidence": "high|medium|low", "note": "anything the reviewer should know, e.g. why an older compact governs, or that the newest document is secretarial procedures"}

Rules: use only the item files. Do not browse. Quote exactly; do not fix typos in quotes. Write valid JSON only. When done, reply with the counts of each verdict and nothing else.
