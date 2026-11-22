# Brief: second-pass check of parsed tribal law provisions

A first reader (a smaller model) read passages from Native nations' law codes,
court rules and dispute resolution laws and recorded each dispute resolution
provision, following [the parsing brief](2026-11-21-parse-passages.md). You
are the second reader. You check the records most likely to be wrong (marked
`hard-case`: borderline scope, or low or medium confidence) and a random
sample of the rest (`random-sample`), so the lead author knows how far to
trust the first pass. These are findings for the lead author's review; you
change nothing else.

Read the parsing brief first: its definitions of a provision, `borderline`,
the method list and the field values apply here too. Two clarifications the
first readers applied unevenly:

- `borderline` is only for diversion or restorative sentencing of a
  criminal, juvenile or child welfare matter into a consensual or community
  process (including a criminal court's referral to a peacemaker to set
  restitution or recommend a sentence). Mediation or peacemaking of a family,
  child welfare or elder matter that is not diversion of a prosecution is
  `dispute-resolution`.
- These are **not** provisions: rules of professional or judicial conduct
  that only mention mediators or arbitrators; a power granted to a guardian,
  conservator, agent, partnership or company to settle claims "by
  arbitration or otherwise"; "arbitration and award" listed among
  affirmative defenses; a regulator or agency deciding a complaint against
  itself with no neutral (record as `administrative-adjudication` only when
  the text sets up a hearing before a separate officer or board); and
  federal or state statutes reprinted in a tribal compilation (keep, but
  say so).
- Prohibitions count: a section that bars mediation in domestic violence
  cases governs whether the process may be used, so it is a provision.

## For each record

Each record shows the first reader's fields, its quotation, and the passage
text around the quotation. Decide:

- `verdict`:
  - `confirm`: the record is right as it stands.
  - `change`: keep the record but correct one or more fields; list them in
    `changes` (field name to new value). Allowed fields: nation, document,
    locator, citation, method, setting, subject_area, entry, outcome,
    enforcement, scope, confidence, summary.
  - `drop`: not a dispute resolution provision under the rules above, or
    the passage does not support it.
  - `cannot-tell`: the passage is too cut off or garbled to judge.
- `reason`: one plain sentence.

Check especially: is it really a provision of this nation's own law; is the
nation right (the URL's site usually tells you which nation the document
belongs to); does the citation invent a section or year that the text does
not show; is the summary accurate and free of praise or generalization; and
is ceremonial content left unsummarized. Peacemaking is its own track, never
called ADR.

## Output

Write a JSON array to the output path you are given, one object per record,
in order:

```json
[
  {"id": "navajo-nation#812", "verdict": "change", "changes": {"scope": "borderline"}, "reason": "A criminal court's referral to the Peacemaker Court to set nályééh and recommend a sentence is restorative sentencing."},
  {"id": "oneida-nation#77", "verdict": "drop", "changes": {}, "reason": "Rule of judicial conduct that only mentions serving as a mediator."}
]
```

Every record id in your file must appear exactly once. Valid JSON only.
Reply with one line: counts of each verdict.
