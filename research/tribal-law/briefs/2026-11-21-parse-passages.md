# Brief: parse dispute resolution provisions from tribal law passages

You are helping with a law school project that is drafting a model Tribal
dispute resolution code. An earlier research pass recorded links to Native
nations' law codes, court rules and dispute resolution laws but never opened
them. A script has now downloaded those documents and cut out every passage
that mentions a dispute resolution term (mediation, arbitration, peacemaking,
conciliation, settlement conference, circles, family group conferences,
restorative justice, elders' councils, traditional or customary forums,
neutrals, ombuds, diversion). Your job is to read a batch of passages and
record each dispute resolution provision you find. These are **findings for
the lead author's review**. You change nothing else.

## What each passage looks like

Each passage starts with a header block:

```
=== PASSAGE <id> ===
url: <the document's address>
nations: <profile ids of nations that cite this document>
cited as: <how the profile lists it>
terms: <terms the script matched>
```

then about 2,500 characters of text taken from the document, including text
before and after the matched words. Text from PDFs can have broken lines,
page headers and hyphenation. A passage can come from a whole code, a single
chapter, a court rule, a database page quoting a law, or a web page that only
lists documents.

## What counts as a provision

Record a provision when the passage shows a section, rule or clause of a
nation's law that **creates, governs, refers matters to, or enforces the
result of** a process for resolving a dispute or conflict by agreement or by a
neutral other than ordinary trial. Examples: mediation (court-annexed,
voluntary or required), arbitration (including enforcing awards and waiving
immunity for arbitration), peacemaking, talking or healing circles used to
resolve a matter, family group or family team conferences that decide a
plan, settlement conferences, elders' councils or traditional forums that
resolve disputes, ombuds, negotiation requirements before suit, and
grievance or appeal panels that use a neutral.

Mark these but flag them (`scope: "borderline"`): diversion or restorative
sentencing where a criminal, juvenile or child welfare matter goes to a
consensual or community process (a conference, a circle, a peacemaker, a
community accountability board). The lead author decides whether these
belong.

Do **not** record: diversion only to treatment, probation, counseling or
services; ordinary trial procedure; the word "arbitrary"; a table of
contents line or menu link with no text of the provision (note it instead,
see below); contract boilerplate in a non-law document such as a website's
terms of use (note it instead).

One passage can hold several provisions (for example a mediation section and
the section on enforcing mediated agreements). Record each one. If two
passages in your batch show the same section of the same document, record it
once and list both passage ids.

## Fields for each provision

- `passages`: the passage ids it comes from.
- `nation`: the profile id from the header that the text belongs to. If the
  header lists several nations and the text names one, use that one. If you
  cannot tell, use the first and say so in `note`.
- `document`: the law's name as printed (for example "Ho-Chunk Nation
  Traditional Court Act"), or null.
- `locator`: the section, rule or chapter number and heading as printed
  ("§ 5-4-12 Mediation"; "Rule 16. Settlement Conferences"). Null if none is
  visible.
- `citation`: a citation in Indigo Book style built only from what is
  printed: nation's code name, title or chapter, section, and year if the
  passage shows one. Examples: "Ho-Chunk Nation Code tit. 2, § 4.5 (2019)";
  "Little Traverse Bay Bands of Odawa Indians Tribal Code § 5.102";
  "Oneida Nation (Wis.) Tribal Court R. 16". Never invent a year or a
  section number; leave out what is not shown.
- `method`: the closest id from this list, or `other`:
  administrative-adjudication, arbitration, case-evaluation, circle-process,
  collaborative-law, conciliation, council-hearing,
  customary-dispute-resolution, early-neutral-evaluation, elders-council,
  facilitation, fact-finding, family-group-conference, mediation,
  negotiation, nonbinding-arbitration, ombuds, peacemaking,
  restorative-justice, settlement-conference. Peacemaking is its own track
  in this project, not a form of alternative dispute resolution: map it to
  `peacemaking` and never call it ADR.
- `setting`: `court-annexed` (run by or inside the court), `court-referral`
  (court may or must send the case to an outside process),
  `pre-filing` (must be tried before suit), `contract-or-compact` (a clause
  in an agreement the nation is party to), `agency-or-government` (an
  agency, council or board process), `community-program`, or `other`.
- `subject_area`: one of civil, family, child-welfare, juvenile, criminal,
  probate, employment, housing, gaming, commercial, land-or-resources,
  elections, tribal-government, general (applies to all cases), other.
- `entry`: `mandatory`, `voluntary`, `consent-of-parties`,
  `court-discretion`, `not-stated`.
- `outcome`: `binding`, `non-binding`, `binding-if-agreed` (an agreement
  binds once signed or entered), `recommendation`, `not-stated`.
- `enforcement`: one plain sentence on how the result is enforced or
  reviewed if the text says (entered as a court order or judgment, contempt,
  return to court if the process fails, grounds for vacating an award,
  standard of review), else null.
- `confidentiality`: `stated`, `not-stated`.
- `immunity_waiver`: true if the text waives or limits sovereign immunity
  for this process (common with arbitration), else false.
- `summary`: one or two plain sentences on what the provision does, from the
  text only. Describe; do not praise, rank or generalize about Native
  people, and do not speak for the nation.
- `quote`: copy **exactly**, character for character, 40 to 400 characters
  from the passage text that best shows the provision. A script checks every
  quote against the passage; a quote that does not match is discarded. Do
  not fix spelling, spacing or hyphenation; do not join text from two
  places with an ellipsis.
- `scope`: `dispute-resolution` or `borderline`.
- `confidence`: `high` (the quote settles it), `medium` (needs some
  inference, for example a heading plus a fragment), `low`.
- `peacemaking_features`: only when `method` is `peacemaking` (or a circle or
  elders' council run as peacemaking): a list of tags the text supports,
  from forum-placement, peacemaker-selection,
  peacemaker-qualifications-or-training, matters-covered, matters-excluded,
  entry, non-member-participation, confidentiality,
  agreement-entered-as-judgment, return-to-court,
  peacemaker-decides-with-consent, appeal-or-review, fees. Otherwise `[]`.
- `note`: anything the reviewer should know (a cut-off passage, a
  provision that looks repealed, a heading whose text you were not shown),
  or null.

## Ceremonial and spiritual content

Some passages describe ceremonies, prayers or spiritual practices used in
peacemaking or traditional forums. Do not quote or summarize that content.
Record the provision with a neutral summary of its legal effect (for example
"Lets the peacemaker open the session according to custom") and set `note`
to "Passage describes ceremonial content; not summarized."

## Passages with no provision

For each passage with no provision, add an entry to `no_provision` with the
passage id and one of these reasons: `table-of-contents-only`,
`listing-or-menu`, `term-used-in-other-sense`, `diversion-to-services`,
`ordinary-court-procedure`, `not-law` (news, website terms, a report),
`unreadable`, `other`. For `table-of-contents-only` and `listing-or-menu`,
also give `headings`: the dispute resolution headings you can see (copied
exactly), so the reviewer knows which sections to fetch.

## Output

Write one JSON file to the output path you are given, with exactly this
shape, valid JSON only:

```json
{
  "batch": "batch-001",
  "provisions": [
    {
      "passages": ["0a1b2c3d4e5f6a7b8c9d-0"],
      "nation": "bay-mills-indian-community",
      "document": "Bay Mills Tribal Code, Chapter XV Tribal Elder and Adult Protection Code",
      "locator": "Section 1518 Criminal Prosecutions",
      "citation": "Bay Mills Indian Community Tribal Code ch. XV, § 1518",
      "method": "restorative-justice",
      "setting": "court-referral",
      "subject_area": "criminal",
      "entry": "consent-of-parties",
      "outcome": "binding-if-agreed",
      "enforcement": null,
      "confidentiality": "not-stated",
      "immunity_waiver": false,
      "summary": "Lets the prosecution be dismissed or deferred when the elder and the suspected abuser agree to resolve the conflict through a dispute process the Community recognizes.",
      "quote": "agree to resolve conflicts through any dispute process recognized by the Bay Mills Indian Community",
      "scope": "borderline",
      "confidence": "high",
      "peacemaking_features": [],
      "note": null
    }
  ],
  "no_provision": [
    {"passage": "0a1b2c3d4e5f6a7b8c9d-1", "reason": "table-of-contents-only", "headings": ["Chapter 8. Peacemaker Court"]}
  ]
}
```

Every passage id in the batch must appear at least once, in a provision's
`passages` or in `no_provision`. After writing the file, reply with one
line: the number of provisions and the number of no-provision passages.
