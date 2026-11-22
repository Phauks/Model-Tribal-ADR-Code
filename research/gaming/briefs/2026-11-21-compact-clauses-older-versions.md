# Brief: compact clause extraction

You are reading excerpts of Class III tribal-state gaming compacts (agreements between a Native nation and a state under the Indian Gaming Regulatory Act, 25 U.S.C. § 2710(d)), amendments, and Secretarial Procedures (rules the Secretary of the Interior issues in place of a compact). The excerpts were cut by a script from text extracted from the PDFs, so they may start mid-sentence, include signature blocks, or miss a section entirely.

Each batch file is a JSON list of documents. For each document you get: id, state, nations, title, decision, document_kind, listed_date, pages, opening (first 1,200 characters), sections (passages found under headings about each subject) and sometimes text_start (the first part of a short amendment).

For EVERY document in the batch, write one answer object. Read only what is in the file; never use outside knowledge about a compact, and never guess. If a subject is not in the excerpts, set "present" to null (unknown) — not false. Use false only when the text says the subject does not apply.

Answer object keys:
- "id": the document id, copied exactly
- "document_is": one of "full-compact", "amendment", "secretarial-procedures", "extension", "letter", "other", "cannot-tell", judged from the opening and text
- "dispute_resolution": {"present": true/false/null, "summary": one neutral sentence on how disputes between the nation and the state are resolved (steps in order: notice, meet and confer, negotiation, mediation, arbitration (name the body or rules, e.g. AAA, JAMS), court (which court), and whether the result binds), "steps": list from ["notice","meet-and-confer","negotiation","mediation","arbitration","court","federal-court","state-court","tribal-court","secretary-of-the-interior","other"], "binding_arbitration": true/false/null, "locator": the section number and heading as printed, "quote": an exact quotation of 10 to 40 words copied character for character from the excerpt}
- "renegotiation": {"present", "summary": one sentence on how the compact can be amended or reopened for negotiation (who can request it, triggers such as a change in law or new games, time limits, what happens if talks fail), "triggers": short list of words, "locator", "quote"}
- "term": {"present", "summary": one sentence on how long the compact lasts and how it renews, ends or is extended, "years": number or null, "automatic_renewal": true/false/null, "locator", "quote"}
- "revenue_sharing": {"present", "summary": one sentence on any payments from the nation to the state or local governments (percentage, fund, what the state gives in return such as exclusivity), "locator", "quote"}
- "sovereign_immunity": {"present", "summary": one sentence on any waiver of sovereign immunity for compact disputes, "locator", "quote"}
- "difficulty": "easy" or "hard" (hard = garbled text, contradictory sections, cannot find the governing clause, or the amendment only changes part of a section)
- "note": anything a lawyer should know, for example "amendment replaces Section 15" or "text garbled"

Rules: quotes must be copied exactly from the excerpt (they are checked by a script; a quote that is not found is discarded). Neutral wording; say "the compact provides", never characterize it as good or bad. Use "Native nation" or the nation's name, not "the tribe", in your own summaries (quotes stay as written). When present is null, omit summary/locator/quote or set them to null.

Write your answers for batch-NNN.json as a JSON list to /tmp/claude-0/work/clauses/history-answers/batch-NNN.json (same number). Validate it with `python3 -c "import json,sys; json.load(open(sys.argv[1]))" FILE`. Process your batches one at a time: read one batch file, write its answers, then go on.
