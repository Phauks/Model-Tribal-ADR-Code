# Roadmap for documenting the model code

**Status:** draft, Nov. 21, 2026. This roadmap sets the order of work from the
data now in the repository to a drafted model code. It has gates: points where
work stops until the lead author, Trevor Goldsmith, has reviewed and decided.
**No model provision is drafted before Gate 1 and Gate 2 are passed.** The
roadmap itself is written now so the review can be aimed at what drafting will
need; it will be revised after each gate (project choice).

The phases below follow the charter's commitments, the provision schema and
the [provisional analysis](../research/analyses/2026-11-21-dispute-resolution-practice.md)
of the documented practice. Where a step rests on that analysis, the analysis
is cited; everything else is project planning.

## Overview

| Phase | What happens | Can start | Ends with |
| --- | --- | --- | --- |
| 0. Preparation | Work that does not depend on reviewed data | Now | Nothing to approve |
| **Gate 1** | **Trevor's review of the pull request #2 data** | | Review checklist below complete |
| 1. Reviewed evidence | Re-run the analysis on reviewed data; settle scope questions | After Gate 1 | Updated analysis and a scope memo |
| **Gate 2** | **Scope and outline approved** by Trevor, with the faculty advisors' input | | Approved outline |
| 2. Drafting | Provisions and commentary, chapter by chapter | After Gate 2 | Draft chapters in `in-review` status |
| **Gate 3** | **Consultation** with any nation cited or named in commentary | | Review status recorded per nation |
| 3. Edition | Essays, methods and manners, website, print and ebook | After Gate 3 for affected text | 1st Edition |

Peacemaking runs as its own track through every phase, not as a chapter of
the alternative dispute resolution code ([charter, commitment 3](charter.md#3-peacemaking-as-its-own-track)).

## Phase 0: preparation (now)

These steps do not depend on reviewed data and can proceed in parallel with
Trevor's review:

- **Methods vocabulary.** The open list of methods (pull request #5) has
  merged. Rename profile forum kinds to method ids in one pull request. The
  methods thread has proposed a mapping, for example mediation-program to
  mediation and employment-tribunal to administrative-adjudication; it is not
  yet applied (review queue item 6 in the analysis).
- **Archived copies.** Run the archive workflow. Only 4 of 1,970 source
  records have an archived copy, and the citation rules require one for every
  web source ([citation-style.md](citation-style.md#rules-the-project-adds);
  analysis, review queue item 9).
- **Citation style for tribal law.** Finish the open tasks in
  [citation-style.md](citation-style.md#open-tasks): how the *Indigo Book*
  treats tribal codes and court decisions, and the statute pinpoint fix.
- **Law library pulls.** Westlaw and other pulls listed in the United States
  dispute resolution bibliography (pull request #5).
- **Reference texts.** Gather the uniform acts a drafter will compare against,
  such as the Uniform Mediation Act and the Revised Uniform Arbitration Act,
  as source records with rights noted ([charter, commitment 9](charter.md#9-copyright-and-permissions)).
- **Analysis tooling.** Keep
  [`scripts/analysis/dispute_resolution_practice.py`](../scripts/analysis/dispute_resolution_practice.py)
  current so the analysis can be re-run after each review pass.

Not in Phase 0: choosing chapters, writing provision text, writing commentary
or illustrations.

## Gate 1: review of the pull request #2 data

The analysis found that most of the dispute resolution record has not been
read closely: 938 provisions are unreviewed bulk database records and 291 rest
on section titles alone, against 98 drawn from read text. Sixty of the 185
nations with any record have at least one record from read text
([analysis, summary](../research/analyses/2026-11-21-dispute-resolution-practice.md#summary)).
Drafting on that base would risk describing practice the sources do not
support, so the review comes first (project analysis).

Gate 1 is passed when Trevor has:

1. **Decided the scope question for the bulk records**: whether diversion,
   treatment and restorative sentencing provisions belong in the dispute
   resolution data, a separate field, or neither (analysis, section 5).
2. **Triaged the bulk records** in line with that decision: kept, relabeled or
   dropped. Sampling is acceptable if the sample and its result are recorded.
3. **Confirmed the text-read tier** for every record a draft is likely to rely
   on: forums, clauses and text-read provisions, re-reading OCR and
   summary-tool reads where they matter (analysis, review queue item 10).
4. **Resolved the duplicates**: 71 repeated provision titles, four doubled
   source records and forums recorded under two kinds (review queue items 3
   to 5).
5. **Decided how bands inside one profile are counted**, starting with the
   Minnesota Chippewa Tribe profile (review queue item 7).
6. **Accepted or set aside the proposed method records** (32 at the merge of
   pull request #5), so every forum kind maps to a method or stays "other" for
   a stated reason.

A review session log records what was checked and decided, as for any
research session ([research/README.md](../research/README.md)).

## Phase 1: reviewed evidence

- Re-run the analysis script and publish a second analysis that replaces the
  provisional one, keeping the first in history.
- Test the six patterns listed in the analysis against the reviewed data
  ([analysis, section 8](../research/analyses/2026-11-21-dispute-resolution-practice.md#8-patterns-to-test-after-review)).
- Write a short scope memo answering the questions below.

### Scope questions for Gate 2

Each question comes from what the data shows (project analysis):

| Question | Why it arises |
| --- | --- |
| Does the code cover diversion and restorative sentencing, or only disputes between parties? | Most bulk records concern criminal, juvenile and child welfare processes (analysis, section 5) |
| Does it include commercial arbitration and the link to sovereign immunity waivers? | Four arbitration ordinances read share one structure tying awards to express waivers (analysis, section 4) |
| Are disputes between governments, such as compact disputes, a chapter or an essay? | Compact clauses mostly follow state templates (analysis, section 6) |
| Are employment disputes in scope? | One employment tribunal and one employment mediation clause were found (analysis, sections 3 and 4) |
| What does the code say about peacemaking, if anything? | Peacemaking is its own track; one option is provisions that only connect a court to a nation's own peacemaking forum (referral, return, entry of agreements) without defining peacemaking itself |
| Which family and child welfare matters are in scope? | Family and child welfare matters appear in both forums and bulk records (analysis, sections 3 and 5) |

### Candidate outline, to confirm at Gate 2

A starting point for discussion, not a decision. It follows the provision
schema's tracks (general, peacemaking, mediation, arbitration, restorative,
family and administration) and the recurring features in the analysis
([schemas/provision.schema.json](../schemas/provision.schema.json); analysis,
section 2):

1. General provisions: purpose, definitions, relation to the Tribal court,
   confidentiality, qualifications of neutrals.
2. Referral and transfer: consent, screening (including for domestic
   violence), return to court when a process ends without agreement.
3. Mediation.
4. Agreements: entry as a court order or judgment, appeal and modification.
5. Arbitration: enforceability of agreements, confirmation of awards, and the
   relation to immunity waivers.
6. Other chapters as the scope memo decides, such as restorative processes,
   family matters, employment or intergovernmental disputes.

Adding a track beyond the schema's list (for example intergovernmental) is a
schema change made at Gate 2.

## Gate 2: scope and outline approved

Passed when Trevor approves the scope memo and outline, after input from the
project's faculty advisors ([charter](charter.md)), and the outline is saved
as a decision record.

## Phase 2: drafting

- One file per provision and one per commentary, numbered as in
  [repository-layout.md](repository-layout.md#identifiers).
- Provisions follow the drafting rules in the
  [style guide, section 4](style-guide.md#4-model-provisions): must, must not
  and may; a named actor; template variables for nation-specific words; and
  lettered alternatives that each work alone.
- Commentary follows the Restatement pattern, with Source Notes citing every
  law relied on ([style guide, section 5](style-guide.md#5-commentary-illustrations-and-essays)).
- Illustrations use fictitious nations unless a nation approves its use
  ([charter, commitment 4](charter.md#4-consultation-before-publication)).
- Each chapter is drafted on its own branch and pull request, with status
  `draft`, then `in-review`.

## Gate 3: consultation

Before publication, every nation whose law is cited or described in
commentary is offered the chance to review what is said about it, through its
own offices, and the result is recorded in its profile's review status
([charter, commitment 4](charter.md#4-consultation-before-publication);
[requests.md](requests.md)). Every profile is now "drafted from public
sources" (analysis, review queue item 12).

## Phase 3: edition

Essays, the methods and manners collection, the website, the print interior
and the ebook are built from the same records. Their own plans live with
those tracks.
