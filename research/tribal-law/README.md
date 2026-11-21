# Dispute resolution provisions in tribal codes, court rules and ordinances

These files list the dispute resolution provisions found in Native nations'
own law codes, court rules and dispute resolution ordinances. That includes
mediation, arbitration, peacemaking referrals, court-annexed processes and how
agreements and awards are enforced. The texts were gathered on Nov. 21, 2026,
and the method is recorded in
[the research session](../sessions/2026/2026-11-21-tribal-law-texts.md).

Before this session the profiles in `content/tribes/` listed 611 law codes
only by title. None of them had been read for their dispute resolution
sections. This folder is that reading. It is research material awaiting the
lead author's review (Gate 1), so nothing here changes a nation profile.
Peacemaking provisions were also passed to the peacemaking research, which is
kept as a separate track.

## Files

| File | One row per | Built by |
| --- | --- | --- |
| [`documents.json`](documents.json) | Document fetched: each law code, court rules or ordinance link the profiles cite, plus the chapters and titles linked from those index pages. Each row records the HTTP status, file kind, SHA-256, text length, the profile facts that cite it and the pages that link to it | [`scripts/law/collect_law_texts.py`](../../scripts/law/collect_law_texts.py) `targets`, `fetch` |
| [`provisions`](provisions.csv) (`.csv`, `.json`) | Dispute resolution provision. Fields: nation, document, locator, Indigo Book citation, method, setting, subject area, how a case enters, outcome, enforcement, confidentiality, immunity waiver, a one-sentence summary, scope, confidence, peacemaking features, the second reader's verdict, and an empty `lead_author_decision` column | `collect_law_texts.py` `scan`, `merge`; [`second_pass.py`](../../scripts/law/second_pass.py) `apply` |
| [`no-provision-passages.json`](no-provision-passages.json) | Passage that matched a search term but held no provision, with the reason (for example, the term was used in another sense, or the passage was a table of contents). For tables of contents it also lists the headings, so chapters not yet fetched can be found | `collect_law_texts.py` `merge` |
| [`counts.json`](counts.json) | Totals by status, method, setting, subject area, scope, confidence and second-pass verdict | both scripts |
| [`briefs/`](briefs/) | The instructions the first and second readers followed | — |
| [`evidence-spike-passages.csv`](evidence-spike-passages.csv) | Passage about rules of evidence, proof of custom, traditional privileges or compromise offers, classified by machine for the [evidence spike](../analyses/2026-11-21-tribal-rules-of-evidence.md). No quotations; not checked by a person | [`scripts/law/evidence_spike_extract.py`](../../scripts/law/evidence_spike_extract.py), then smaller-model helpers |

## How the provisions were found

1. **Targets.** The script took every `governing_documents` link of kind
   `law-code`, `court-rules` or `other`, and every link on a dispute
   resolution provision, database listing or clause. That gave 820 links
   cited by 299 nation profiles.
2. **Fetch.** The script fetched each link, then followed up to 400 links per
   index page to its chapters and titles, one level deep. It sent at most
   one request per second to each site. It got 8,921 files, and 8,441
   answered with success. Text came from `pdftotext` or `pandoc`, which gave
   6,748 files with text.
3. **Scan.** It kept the text around each match of a search term (mediation,
   arbitration, peacemaking, conciliation, circle, family group conference,
   restorative justice, elders, traditional, neutral, diversion and similar
   terms). It skipped duplicate files by SHA-256. That left 2,700 passages.
4. **First reader.** Claude Haiku read each passage under
   [the parsing brief](briefs/2026-11-21-parse-passages.md). It recorded each
   provision with an exact quotation, and a script then checked every
   quotation against the fetched text. All 2,127 were found: 2,123 word for
   word and 4 differing only in spacing.
5. **Nation check.** A record's nation was corrected when the document's site
   belongs to exactly one nation's profile. That changed 8 records, and each
   carries a note. Records repeating the same quotation for the same nation,
   for example from two editions of one code, are marked `duplicate_of`.
6. **Second reader.** Claude Sonnet re-read, under
   [the second-pass brief](briefs/2026-11-21-second-pass.md), every record
   the first reader marked `borderline` or gave `low` or `medium`
   confidence (568). It also re-read a fixed random sample of 120 of the
   other 1,299 records, to estimate how far those can be trusted. Its
   verdicts are in the `second_pass_*` columns. They are not applied to the
   other fields, so the lead author can see both readings.

## Counts

| | Records |
| --- | --- |
| Provisions recorded | 2,127 |
| Not duplicates | 1,867 |
| Not duplicates, and not dropped or left undecided by the second reader | 1,671, from 108 nations and 425 documents |

Second reader's verdicts:

| Selected as | Confirm | Change | Drop | Cannot tell |
| --- | --- | --- | --- | --- |
| Hard case (568) | 257 | 117 | 189 | 5 |
| Random sample of the rest (120) | 84 | 34 | 2 | 0 |

What the verdicts mean for the 1,179 records nobody re-read:

- **Mostly real provisions.** In the sample only 2 of 120 were dropped. One
  was a charter power to agree to arbitration. The other was a council
  deciding claims against the Tribe itself.
- **Citation years often unsupported.** In 18 of 120, the only correction was
  to the citation, usually removing a year the passage itself does not show.
  The year may appear elsewhere in the document, such as the cover page, which
  the second reader did not see.
- **Some substantive errors.** In 13 of 120, a substantive field was
  corrected: method, outcome, entry, enforcement, locator or summary.
- **Hard cases.** Most drops were powers granted to an entity to settle "by
  arbitration or otherwise", conduct rules that only mention mediators, or
  ordinary court procedure. Most changes moved child welfare or family
  mediation from `borderline` to `dispute-resolution` (63).

Every record is `verification: read-in-full`, because a machine reader read
the passage and a script found the quotation in the fetched text. Its
`reviewer` says it was a machine pass. A record is not a finding about the
nation's law until the lead author decides it.

## Quotations and copies stay private

Tribal legal text is `link-only` by default
([data model](../../docs/data-model.md)). The public files therefore have
the citation, the link and a summary in the project's own words, and no
quotation. The quotations are kept in the private file
`/mnt/project-files/research/tribal-law/provisions-with-quotes.json`. The
fetched copies (4,848 files) are kept privately in
`/mnt/project-files/research/captures/tribal-law/documents/`, and the
`capture` field gives the path under `/mnt/project-files/`.

## Known limits

- **Scanned PDFs.** 1,753 of them have no text layer and were not read,
  because no OCR tool was available in this session.
- **Blocked or failed fetches.** eCode360 and Municode refused the fetches
  (403), so codes hosted there were not read. 287 more links failed to
  connect.
- **Unfetched chapters.** Some index pages link more chapters than the
  limit followed, and some codes are only one level deeper. The headings in
  `no-provision-passages.json` show where to look next.
- **Search terms.** A provision that uses none of the search terms was not
  found.
- **Editions.** Where several editions of one code were fetched, the records
  do not say which edition is in force. The project's
  [version history](../../docs/decisions/0018-document-version-history.md) format takes that up when a law is
  added to `content/documents/`.
- **Ceremonial content.** It was noted as present but not summarized.
