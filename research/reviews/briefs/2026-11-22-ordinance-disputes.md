# Brief: dispute procedures in Tribal gaming ordinances (Nov. 22, 2026)

For reviewers reading the batches written by `python3 scripts/review/ordinance_disputes.py batches --work WORK_DIRECTORY`.

The lead author approved this on Nov. 22, 2026: "gaming patron and employee grievances are worth investigating, we grab now, figure out later". So collect every procedure, and the lead author will decide later which ones belong in the model code or a profile. Nothing you write changes a profile.

## Background

Every Tribal gaming ordinance and amendment on the National Indian Gaming Commission's list was captured on Nov. 21, 2026 (`research/gaming/ordinance-documents.json`). From 1993 until Dec. 1, 2025, the Commission's rule on ordinance submissions required a Tribe to send its procedures for resolving disputes between the gaming public and the Tribe or the management contractor: 25 C.F.R. § 522.2(f) (1993 to Oct. 20, 2022, "a description of procedures"), then § 522.2(e) (from Oct. 21, 2022, "a copy of the procedures"; 87 Fed. Reg. 57590). The Commission removed the requirement effective Dec. 1, 2025 (90 Fed. Reg. 46754). Many ordinances therefore have a section on patron disputes, often marked "[25 C.F.R. § 522.2(f)]".

## What a batch holds

Each batch file, `WORK_DIRECTORY/batches/batch-NNN.json`, has up to 40 documents. For each nation the script picked the newest document (by the list's date) with a patron dispute section, the newest with an employee grievance section, and, when there was neither, the newest with another dispute or licensing hearing section. Each document gives:

- `document` (its id), `nations` (profile id, profile path, the list's name for the nation, and why the document was picked), `document_kind` (ordinance or amendment), `listed_date`, `title_in_text` (a guess, may be empty), `link`, `final_link` and `pages`;
- `other_documents_checked`: the nation's other documents and what the script found in them (context only; you cannot read them);
- `sections`: candidate passages, each with a `ref`, a `heading` (when the passage starts at a heading), `pages` (first and last PDF page, counted from 1 in the PDF file, not the page number printed on the page), `kinds_detected` (the script's guess, often wrong), `methods_named`, `on_approval_letter` (true when the passage is on the Commission's approval letter, not in the ordinance), `truncated` and `text`.

Text comes from `pdftotext`; scanned pages have no text and some pages were read by an earlier scanner's character recognition, so words may be misspelled ("Disuute", "patmn"). Runs of spaces were collapsed.

## What to record, for each document

One **item** for each distinct procedure the passages describe. If a procedure runs over several passages (a commission power in one place, the procedure in another), make one item and list every `ref`.

`kind` is one of:

- `patron-dispute`: how a patron or member of the gaming public raises a dispute, complaint or claim against the Tribe, the gaming operation or a management contractor (prize or wager disputes, tort or personal injury claims, refunds). Include an ordinance that only says such disputes follow the Tribal-State compact or the commission's regulations: record it, with `refers_to` naming what it refers to.
- `employee-grievance`: grievance, discipline or dismissal appeals, or other disputes of gaming operation or commission employees.
- `licensing-hearing`: a hearing or appeal on a license denial, suspension or revocation, **only if the text frames it as dispute resolution** (for example a heading "Adjudication of Licensing Disputes", or a section on "disputes concerning the issuance of licenses"). Set `framed_as_dispute_resolution` to true and copy the framing words into `snippet`. Ordinary license hearings and appeals with no such framing are not items; mention them in `skipped`.
- `other`: any other dispute procedure in the ordinance: disputes with a management contractor or vendor, a general dispute resolution section, a mediation, arbitration, peacemaking or Tribal court review step not covered above.

For each item give:

- `refs`: the section `ref`s it rests on;
- `locator`: `section` (the section number and heading as written, for example "Section 11. Patron Dispute Resolution"; if there is no heading, the nearest section number you can see, or "") and `pages` (the PDF pages from the passage, for example "17" or "25-26");
- `steps`: an object with
  - `who_hears`: each body that hears it, in order (for example "gaming operation management, then the Tribal Gaming Commission");
  - `time_limits`: every time limit, as written (for example "complaint within 30 days; decision within 15 days"), or "none stated";
  - `review_or_appeal`: the review or appeal step and to whom, or "none stated";
  - `mediation_arbitration_court`: any mediation, arbitration, peacemaking, Tribal court or other court step, or "none stated";
- `steps_summary`: one or two plain sentences on how the procedure runs;
- `final_decision_maker`: who decides last (for example "Tribal Gaming Commission (final, no appeal)", "Tribal Court", "arbitrator", or "not stated");
- `refers_to`: a compact, regulations or other law the procedure sends you to, or "";
- `framed_as_dispute_resolution`: true or false;
- `snippet`: a short **verbatim** quotation from the passage text, under 25 words, that shows the procedure. Copy it character for character from `text` (keep misspellings); do not join words from two places. It will be checked against the document;
- `confidence`: `high` (the passage plainly sets out the procedure), `medium` (it names the procedure but the passage is cut off or unclear), `low` (a passing mention, for example only a commission power "to hear patron complaints").

If the document has no item, set `items` to [] and give `none_found_reason` in one sentence (for example "the passages are license revocation hearings only, with no dispute framing" or "the only passage is the approval letter").

`skipped`: a short list of passages you set aside and why (one line each), for example `{"ref": "...#s3", "why": "license revocation hearing, no dispute framing"}`.

## Not an item

- Text on the Commission's approval letter (`on_approval_letter: true`): it is not the Tribe's ordinance.
- Enforcement by the commission against a licensee (complaints alleging a violation, notices of violation, fines), unless the text calls it a dispute procedure.
- Background investigations, Privacy Act notices, criminal complaints and prosecutions, report lists (for example "reports relating to customer disputes"), and tables of contents.
- Dispute terms of the Tribal-State compact itself between the Tribe and the State (they are recorded elsewhere), unless the ordinance sets out a procedure of its own.

## Rules

- Never guess. Every field comes from the passage. If a detail is not in the passage, write "not stated" or "none stated".
- Use the names the ordinance uses (commission, authority, board, court) as written. Say "citizen", not "member", in your own words.
- Summaries only: apart from `snippet`, do not copy the ordinance's words at length. Tribal legal text is link-only by default.
- Do not add anything about ceremony or tradition that the passage does not say.

## Output

One JSON list per batch, written to `WORK_DIRECTORY/verdicts/batch-NNN.json` (the same number as the batch), with one object for every document in the batch, in batch order:

(The values below are invented to show the shape.)

```json
[
  {
    "document": "example-nation-amendment-2020-01-01",
    "nations": ["example-nation"],
    "reader": "small-model reviewer",
    "items": [
      {
        "kind": "patron-dispute",
        "refs": ["example-nation-amendment-2020-01-01#s1",
                 "example-nation-amendment-2020-01-01#s2"],
        "locator": {"section": "Section 11. Patron Dispute Resolution", "pages": "17"},
        "steps": {
          "who_hears": "Gaming Commission",
          "time_limits": "none stated",
          "review_or_appeal": "none stated",
          "mediation_arbitration_court": "none stated"
        },
        "steps_summary": "The Gaming Commission resolves patron disputes under the Tribal-State compact and other applicable law.",
        "final_decision_maker": "not stated",
        "refers_to": "the Tribal-State compact",
        "framed_as_dispute_resolution": true,
        "snippet": "<words copied exactly from the passage text, under 25>",
        "confidence": "medium"
      }
    ],
    "skipped": [{"ref": "example-nation-amendment-2020-01-01#s3",
                 "why": "license denial appeal to the District Court, no dispute framing"}],
    "none_found_reason": ""
  }
]
```

`nations` lists the profile ids from the document's `nations` (use the list's name for the nation when `profile` is null). Write valid JSON only, UTF-8, with every document of the batch present.

## Afterwards

The lead session merges the verdicts with `scripts/review/ordinance_disputes.py`, checks every snippet against the document's text, and records documents with no text layer as `scanned-unreadable` (no OCR was available). Claude (AI assistant) takes a second look at every low-confidence item and every item drawn from text garbled by character recognition.
