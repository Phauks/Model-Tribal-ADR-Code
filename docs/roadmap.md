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

Peacemaking runs as its own track through every phase. In the model code it
is its own division, never a kind of mediation or arbitration
([charter, commitment 3](charter.md#3-peacemaking-as-its-own-track);
[decision record 0026](decisions/0026-model-peacemaking-code.md)).

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
   *Decided Nov. 21, 2026: a separate field,
   `dispute_resolution.database_listings`
   ([decision record 0015](decisions/0015-database-listings-apart-from-provisions.md)).*
2. **Triaged the bulk records** in line with that decision: kept, relabeled or dropped. Sampling is acceptable if the sample and its result are recorded. *Decided Nov. 22, 2026: the pre-review's recommendations accepted, with diversion to a consensual process and restorative justice kept; 258 listings and 229 provisions remain, and 41 records wait for their sources ([decision record 0027](decisions/0027-diversion-and-restorative-justice-in-the-research-base.md)).*
3. **Confirmed the text-read tier** for every record a draft is likely to rely
   on: forums, clauses and text-read provisions, re-reading OCR and
   summary-tool reads where they matter (analysis, review queue item 10).
4. **Resolved the duplicates**: 71 repeated provision titles, four doubled source records and forums recorded under two kinds (review queue items 3 to 5). *Provision duplicates removed Nov. 22, 2026 (decision record 0027).*
5. **Decided how bands inside one profile are counted**, starting with the
   Minnesota Chippewa Tribe profile (review queue item 7).
   *Decided Nov. 21, 2026: each of the six component bands has its own
   profile, linked by `part_of`
   ([decision record 0016](decisions/0016-component-bands-own-profiles.md)).*
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

Each question comes from what the data shows (project analysis). The
[working outline](outline.md#open-scope-questions) restates them with a
recommendation for each and adds four more:

| Question | Why it arises |
| --- | --- |
| Does the code cover diversion and restorative sentencing, or only disputes between parties? | Most bulk records concern criminal, juvenile and child welfare processes (analysis, section 5) |
| Does it include commercial arbitration and the link to sovereign immunity waivers? | Four arbitration ordinances read share one structure tying awards to express waivers (analysis, section 4) |
| Are disputes between governments, such as compact disputes, a chapter or an essay? | Compact clauses mostly follow state templates (analysis, section 6) |
| Are employment disputes in scope? | One employment tribunal and one employment mediation clause were found (analysis, sections 3 and 4) |
| What does the code say about peacemaking, if anything? | *Decided Nov. 22, 2026: model peacemaking provisions of their own, which set up or recognize a nation's forum and connect it to the court without defining the process ([decision record 0026](decisions/0026-model-peacemaking-code.md)).* |
| Which family and child welfare matters are in scope? | Family and child welfare matters appear in both forums and bulk records (analysis, sections 3 and 5) |
| Does the code or its commentary address nations divided by an international border? | Akwesasne, the Blackfoot Confederacy, Tohono O'odham and others live on both sides of the Canadian or Mexican border, and each country sets their status by its own law ([Canada note](../research/analyses/2026-11-21-canada-dispute-resolution.md#7-what-the-comparison-suggests-project-analysis); [Mexico note](../research/analyses/2026-11-21-mexico-indigenous-dispute-resolution.md)) |

### Candidate outline, to confirm at Gate 2

The full working outline of the code, the book and the website, with
recommendations on each scope question, is now kept in
[outline.md](outline.md) (version 0.1, Nov. 22, 2026). The list below is the
starting point it grew from, kept for history.

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

### Parked research

Research that is done enough to stop, kept here so it is not lost while other
threads run. Each row says which gate or chapter brings it back and what the
next step is. Add a row whenever a spike or side thread ends without being
used yet; remove it when the work is picked up (project choice, Nov. 22, 2026).

| Topic | Where it is | Comes back at | Next step when it does |
| --- | --- | --- | --- |
| Provision pre-review: records kept but not yet read | [Pre-review files](../research/reviews/2026-11-21-provision-pre-review.md) (PR #19; `lead_author_decision` column filled per decision record 0027) | Phase 1 reading of the evidence; drafting of any section that cites a nation's code | Read and summarize the 258 kept listings before moving any to `provisions`; apply the relabel notes on titles and citations; settle the 41 unverified records when the pull list (sections 1e, 2f, 4c) returns their texts |
| Indigenous dispute resolution in Canada (comparative sidebar) | [Canada note](../research/analyses/2026-11-21-canada-dispute-resolution.md) (PR #62; PR #70 adds its Gate 2 scope question and Phase 2 sidebar step) | Gate 2 scope question on nations divided by a border; Phase 2 sidebar drafting | Review the draft sidebar in section 8 of the note; clear Westlaw list section 12; follow-ups from section 9 |
| Indigenous dispute resolution in Mexico (comparative sidebar) | [Mexico note](../research/analyses/2026-11-21-mexico-indigenous-dispute-resolution.md) (PR #59) | Same as Canada: Gate 2 border question; Phase 2 sidebar drafting | Check whether Mexico's general law on Indigenous rights has passed; clear Westlaw list section 11 |
| Peacemaking programs (peacemaking track) | [Peacemaking note](../research/analyses/2026-11-21-peacemaking-programs.md) (PRs #49, #56) | Drafting of the model peacemaking code ([outline, Part III](outline.md#part-iii-the-model-peacemaking-code)) | Outcome evidence is thin (one comparison study); weigh the domestic violence critique; start further sweeps from the gaps in section 7 |
| Native nations' stories about making peace | [Stories catalog](../research/analyses/2026-11-21-peacemaking-stories.md) (PRs #60, #66, #68) | Essays and the methods and manners collection (Phase 3), after the second search | Finish the second search; then outreach to nations' cultural offices and reprint permissions |
| Reader profiles and shared collections (website) | [Proposal](https://claude.ai/artifact/2MjsixaGafnQvepg4MTzqC) (permission tiers thread) | Step 1 any time; step 2 (sync) after the model code has stable section numbers | All decisions made: build on-device saves first, then linked accounts and shared anonymous links |
| "Nemesis" adversarial review agent | Idea only (project memory) | After Gate 2, when drafting starts | Trevor defines its scope; then design an agent that hunts loopholes in the model code and systems |
| Tribal rules of evidence and dispute resolution confidentiality | [Spike note](../research/analyses/2026-11-21-tribal-rules-of-evidence.md) (PRs #65, #67) | Gate 2, outline item 1 (confidentiality) and items 2 and 4 (return to court, agreements); then drafting of those sections | Compare the four confidentiality models across the 85 provisions with the Uniform Mediation Act; check Uniform Mediation Act enactments (Westlaw list, section 13) |
| Native nations' constitutions and their versions | [Constitutions catalog](../research/constitutions/README.md) (PR #55); captures kept privately in the project files | Gate 1 data review; drafting of the sections on courts, removal and sovereign immunity | Check the AI readings and inferred changes; fix the Lumbee profile's citations to Buckland's constitution; pull the Wayback copies and ask about the 189 nations without a text (pull list, parts 1c, 1d, 2e and 6); captures move to R2 under decision record 0030 |

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
- Comparative sidebars on Canada and Mexico: start from the research notes
  ([Canada](../research/analyses/2026-11-21-canada-dispute-resolution.md), whose
  section 8 holds a draft sidebar; [Mexico](../research/analyses/2026-11-21-mexico-indigenous-dispute-resolution.md)).
  Before the text is final, clear the open pulls for both in the project's
  Westlaw list (sections 11 and 12) and re-check the 2026 Criminal Code
  restorative justice part and the Teslin Tlingit Peacemaker Court's status.

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
those tracks. Work that waits on the project's domain (moving the website,
sign-in and notice email, the address printed in the book) is listed in
[Waiting on the domain](domain-to-do.md).
