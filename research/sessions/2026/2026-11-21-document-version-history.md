---
id: 2026-11-21-document-version-history
date: '2026-11-21'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: other
  name: pdftotext
  detail: Text of the five Ak-Chin Indian Community compact documents captured from the Office of
    Indian Gaming list on 2026-11-21 (research/captures/gaming/compacts/arizona/ in the project's
    working files), compared sentence by sentence with diff.
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: Designed the document history record (decision record 0018), read the dispute resolution,
    amendment and duration sections of each version and wrote the first history as a pilot.
purpose: Give every kind of document in the dataset a way to record its versions over time, after the
  compact clause review found that many differences between recorded and actual clauses came from
  different editions of the same compact; and try the record on one compact.
queries:
- Office of Indian Gaming list rows for the Ak-Chin Indian Community (five documents, 1993 to 2022)
sources_added:
- compact-az-ak-chin-indian-community-1993
- compact-az-ak-chin-indian-community-2009-amendment
- compact-az-ak-chin-indian-community-2021
- compact-az-ak-chin-indian-community-2022-amendment
- compact-az-yavapai-prescott-indian-tribe-2003
sources_updated:
- compact-az-ak-chin-indian-community-2003
limits: >-
  Only the sections that say how each version relates to the others (recitals, amendment paragraphs,
  Section 23) and the dispute resolution sections were read; the rest of each compact was not. The
  Federal Register notices for 2003, 2009, 2021 and 2022 were not opened: their dates are those the
  Office of Indian Gaming list links. Extensions of the 1993 compact between 2000 and 2003, if any,
  are not on that list and were not searched for. The 2021 comparison found wording changes only; it
  does not assess whether they change the legal effect of the clause.
---

Output: the document history [`content/documents/a/ak-chin-indian-community-arizona-gaming-compact.yaml`](../../../content/documents/a/ak-chin-indian-community-arizona-gaming-compact.yaml), four new source records and a `document_version` link on the existing record for the 2003 compact.

Method: each version's text was extracted from the captured PDF. The front matter (approval letters and, for 1993, the Federal Register notice) gave the dates. Section 23(a) of the 2003 and 2021 compacts and paragraph 4 of the 2008 and 2022 agreements say which earlier text each one replaces or leaves in force. Section 15 of the 1993, 2003 and 2021 compacts was read in full, and the 2003 and 2021 texts were compared sentence by sentence.

Finding: the Ak-Chin profile's dispute clause fact cites the 2003 compact, which the 2021 amended and restated compact superseded. Section 15 changed only in wording in 2021, so the fact's summary still describes the clause, but the new `superseded-citation` lint check now reports the fact so that it can be pointed at the 2021 version or marked as describing the 2003 one. The Office of Indian Gaming list labels the 2022 agreement to amend as a compact.

## Profile changes for Gate 1 review

After the first record was merged, the project coordinator chose (easy to reverse) to point current-state profile facts at the version in effect. Both changes are listed here for Trevor's Gate 1 review ([roadmap, item 3](../../../docs/roadmap.md#gate-1-review-of-the-pull-request-2-data)):

- **Ak-Chin Indian Community**, `gaming.compacts` dispute clause: now cites the 2021 amended and restated compact (Section 15, read in full) and names that version in `document_version`, instead of the superseded 2003 compact. The summary did not need to change, because Section 15 changed only in wording.
- **Yavapai-Prescott Indian Tribe**, `gaming.compacts` dispute clause: now cites the nation's own 2003 compact (Section 15, read in full; new source record `compact-az-yavapai-prescott-indian-tribe-2003`), instead of the Ak-Chin Indian Community's copy of the same form. Its Section 15 states the same process. The nation's version in effect, the 2022 amended and restated compact, could not be cited for the clause: the Office of Indian Gaming list posts only its approval letter and the 2022 Agreement to Amend, which routes disputes to Section 15 without amending it. Its text is a Westlaw or request item.
