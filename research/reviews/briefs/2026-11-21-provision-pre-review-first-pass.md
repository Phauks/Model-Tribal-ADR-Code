# Brief: pre-review of dispute resolution provision records

You are helping with a law school project that is drafting a model Tribal dispute resolution code. The project keeps, in each Native nation's profile, a list of "provision" records: sections of that nation's published law that a research pass thought were about dispute resolution. There are 1,327 of them, and almost none have been checked one by one. Your job is to check a batch of them against the evidence provided and record a verdict for each. These are **pre-review findings** for the lead author's own review. You do not delete or change anything; you only report.

## Evidence tiers (each record has a `tier`)

- `bulk_database_record`: imported in bulk from the National Center on Restorative Justice (NCORJ) Restorative Justice Tribal Laws Database. Its `kind` came from the database's tags, not from reading. The evidence includes `database_page_excerpt`, the law text the database quotes, and `link_window`, text found in the nation's own document near the section number or title (when the document could be fetched and searched).
- `section_title_only`: taken from a National Indian Law Library table of contents. Only the title was seen; the `kind` came from words in the title. The evidence includes the table of contents page (`link_window`) and, when available, a `locator_window`.
- `text_read`: the research pass read the text or a curated summary.

Many bulk records link to a court home page or a whole-code index rather than the section itself, so `link_window` is often empty. When that happens and the `database_page_excerpt` quotes the section with its number, mark `exists` as `found`, and note in `accuracy_issues` that existence rests on the database's quotation and that the link is a general page. The database's titles are its own paraphrases; say so only when the paraphrase misdescribes the section.

Evidence text in `link_window` and `locator_window` is lowercased and whitespace-collapsed. A `link_match` or `locator_match` line says how the window was found, or that nothing matched. An HTTP status other than 200 means the page could not be fetched.

## Questions to answer for each record

1. **Exists?** Does the evidence show this provision exists in the cited source? `found`, `not-found` (the source was fetched and searched and the provision is not there), or `not-checked` (no usable evidence).
2. **Accurate?** Do the title, citation, link and kind match the evidence? `yes`, `partly`, `no`, or `unknown`. Say what is wrong in `accuracy_issues` (for example a wrong section number, a title that is the database's paraphrase, or a link to a different chapter).
3. **Is it a dispute resolution provision?** `yes`, `no`, or `borderline`.
   - `yes`: it creates, governs, refers matters to, or enforces the result of a process for resolving a dispute or conflict by agreement or by a neutral other than ordinary trial: negotiation, mediation, arbitration (including enforcing awards and waiving immunity for arbitration), peacemaking, talking or healing circles used to resolve a matter, family group or family team conferences that decide a plan, settlement conferences, elders' councils or traditional forums that resolve disputes, ombuds, and similar.
   - `borderline`: diversion or restorative sentencing where the matter goes to a consensual or community process (a conference, a circle, a peacemaker, a community accountability board) inside a criminal, juvenile or child welfare case. Whether these belong in the code is an open scope question for the lead author; do not decide it, flag it.
   - `no`: diversion or deferral to treatment, probation, services, counseling or a program with no dispute resolution process; ordinary court procedure; sentencing options such as community service; or a title that merely contains a word like "arbitration" for an unrelated subject.
4. **Practice category**, one of: `dispute-resolution-process`, `peacemaking`, `arbitration-or-immunity`, `diversion-to-consensual-process`, `restorative-sentencing`, `diversion-to-services`, `treatment-or-services`, `court-procedure`, `other`.
5. **Duplicate?** If the same provision appears twice in your batch (same nation, same section, often from two research passes or two source keys), set `duplicate_of` on the later record to the id of the earlier one. The `duplicate_candidates` field is a hint from a text match, not a finding: confirm or reject it.
6. **Method**: the closest method id from this list, or `none`: administrative-adjudication, arbitration, case-evaluation, circle-process, collaborative-law, conciliation, conflict-assessment, conflict-coaching, council-hearing, customary-dispute-resolution, early-neutral-evaluation, elders-council, facilitation, fact-finding, family-group-conference, final-offer-selection, government-to-government-issue-resolution, mediation, minitrial, negotiated-rulemaking, negotiation, nonbinding-arbitration, ombuds, peacemaking, restorative-justice, settlement-conference, settlement-week, short-trial, summary-jury-trial. Peacemaking is its own track in this project, not a form of alternative dispute resolution: map it to `peacemaking` and do not describe it as ADR.
7. **Suggested kind** for the record: keep the current kind if it fits, or suggest one of peacemaking, traditional-forum, mediation-program, arbitration, family-or-talking-circle, elders-council, restorative-justice, settlement-conference, family-group-conference, sentencing-circle, healing-circle, negotiation-assistance, ombudsperson, other.

## Verdict (one per record)

- `keep`: exists, accurate enough, and a dispute resolution provision with the right kind.
- `keep-relabel`: keep, but the kind, title or citation should change (say how).
- `merge-duplicate`: the same provision as `duplicate_of`.
- `scope-question`: borderline (diversion or restorative sentencing into a consensual process). The lead author decides.
- `drop-candidate`: not a dispute resolution provision, or the evidence shows it does not exist in the source.
- `check-source`: the evidence is missing, unreadable or too thin to judge.

## Confidence

- `high`: a quoted passage in the evidence settles the question.
- `medium`: the evidence points one way but needs inference (for example only a title).
- `low`: little or no usable evidence, or the evidence is ambiguous.

Be honest: a title-only record with no text is rarely more than `medium`. Do not guess at text you were not shown.

## Writing rules

- `evidence_quote`: copy up to 300 characters exactly from the evidence (it will be lowercase; that is fine). Empty string if there is none.
- `evidence_location`: the URL the quote came from, plus a section if known.
- `reason`: one or two plain sentences. Describe what the law provides; do not rank or praise nations. Do not generalize about Native people. Describe; do not speak for any nation. Do not repeat ceremonial or restricted details beyond what the published text says.
- Use the nation's name as the record gives it.

## Output

Write a single JSON file to the output path you are given: an array with one object per record in your batch, in the same order, with exactly these keys:

```json
{
  "id": "bay-mills-indian-community#0",
  "verdict": "scope-question",
  "confidence": "high",
  "exists": "found",
  "accurate": "partly",
  "accuracy_issues": "Title is the database's paraphrase; the section is 1518 Criminal Prosecutions.",
  "is_dispute_resolution": "borderline",
  "practice_category": "diversion-to-consensual-process",
  "method": "none",
  "suggested_kind": "other",
  "duplicate_of": null,
  "evidence_quote": "the elder, adult, family or caretaker and suspected abuser agree to resolve conflicts through any dispute process recognized by the bay mills indian community",
  "evidence_location": "https://ncorj.org/tribal-law/dismissal-or-deferral-for-tribal-elder-and-adult-protection/",
  "reason": "Lets the court dismiss or defer a prosecution when the parties agree to resolve the conflict through a recognized dispute process. It is diversion into a consensual process."
}
```

Every record in the batch must appear exactly once. Valid JSON only, no comments. After writing the file, reply with one line: the number of records written and the count for each verdict.
