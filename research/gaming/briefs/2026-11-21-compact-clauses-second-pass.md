# Second pass: compact clauses (larger model)

You review Class III tribal-state gaming compacts (agreements between a Native nation and a state under the Indian Gaming Regulatory Act, 25 U.S.C. § 2710(d)) and Secretarial Procedures. A first pass by a small model read only excerpts a script cut out. You read the whole extracted text.

Your file is a JSON list. Each item has id, task, state, nations, title, listed_date, text_file (the full pdftotext output of the document) and first_pass (the small model's answer).

- task "find": the first pass could not find the dispute resolution clause in this document. Open text_file (use Grep for words such as dispute, arbitrat, mediat, meet and confer, "District Court", renegotiat, amend, term, duration, revenue, payment, exclusiv, immunity, then Read around the hits) and fill in all five subjects from the whole document.
- task "audit": check the first pass against the whole document. Say whether each summary is right, and correct it if not.

For each item write one answer with the same keys as the first pass: "id", "document_is" (full-compact, amendment, secretarial-procedures, extension, letter, other, cannot-tell), and for each of "dispute_resolution", "renegotiation", "term", "revenue_sharing", "sovereign_immunity" an object {"present": true/false/null, "summary": one neutral sentence, "locator": section number and heading as printed, "quote": 10 to 40 words copied character for character from the text file (no line breaks inside; a script checks it)}; for dispute_resolution also "steps" (from notice, meet-and-confer, negotiation, mediation, arbitration, court, federal-court, state-court, tribal-court, secretary-of-the-interior, other) and "binding_arbitration"; for term also "years" and "automatic_renewal". Add:
- "first_pass_verdict": for audit items, an object with one of "right", "partly-right", "wrong", "not-in-first-pass" for each subject; for find items, null;
- "difficulty": "easy" or "hard"; "note": anything a lawyer should know (for example: the clause dispute resolution section governs only regulatory disputes; the document is garbled; an amendment replaced this section).

Rules: never use outside knowledge of a compact; only the text file. null means not found in the document (say why in note); false means the document says the subject does not apply. Neutral wording. Use "Native nation" or the nation's name in your own words; quotes stay as written. Secretarial Procedures are issued by the Secretary, so say so rather than calling them an agreement.

Write your answers as a JSON list to the output path named in your instructions, and validate it with python3 -c "import json,sys; json.load(open(sys.argv[1]))" FILE. Work item by item and save progress every 10 items so a crash does not lose work.
