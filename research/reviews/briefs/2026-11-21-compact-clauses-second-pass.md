# Brief: second-pass check of gaming compact dispute clauses

You are the second reviewer. Read first the first-pass brief at WORK_DIRECTORY/compacts/brief2.md for the task and the output fields. A smaller model already gave a first-pass verdict for each item; you check it independently and more carefully.

Inputs for each item_id in your range:
- Evidence file: WORK_DIRECTORY/compacts/evidence2/item-NNN.json (NNN zero-padded to 3 digits): the current summary and excerpts.
- Full extracted text of every document: WORK_DIRECTORY/compacts/text-files.json maps item_id to the nation's documents (newest first) with `text_file` paths. Use Grep/Read on those files to find the full dispute resolution section, especially when the excerpts are cut off or missing. Many compacts put the tribe-state dispute clause in a section titled "Dispute Resolution", "Resolution of Disputes", "Disputes" or "Meet and Confer"; amendments may rewrite it.
- First-pass verdicts: all files in WORK_DIRECTORY/compacts/out2/ (JSON arrays keyed by item_id).

Standard for `same`: every step in the current summary (notice, meet and confer or negotiation, mediation, arbitration and its rules and number of arbitrators, court and remedies, immunity waiver) is true of this nation's governing clause, and the summary leaves out no main step. A summary that is accurate but leaves out a minor detail (for example a time limit or that a limited waiver exists) is still `same`; say what is left out in `differences`. If the governing clause cannot be found in the full text (scanned file, missing document), the verdict is `cannot-tell`.

For `differs`, write `proposed_summary` in one plain sentence in the same style as the current summary, stating only what the clause says, and give the exact quote and locator.

Output: a JSON array, one object per item in your range, in item_id order, with the first-pass fields (item_id, profile, governing_document, locator, quote, verdict, proposed_summary, differences, confidence, note) plus "agrees_with_first_pass": true|false. Quote exactly from the text file (do not fix typos). Write valid JSON only. Do not browse. Do not modify any other file. When done, reply with counts of your verdicts and how many disagree with the first pass.
