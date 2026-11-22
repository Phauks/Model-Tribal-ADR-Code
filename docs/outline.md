# Working outline: model code, book and website

**Version 0.2, Nov. 22, 2026.** This is the project's framework: the parts,
chapters and website sections, and what each one is for. It is a working
draft that will change. Nothing here is provision text, which waits for
Gate 1 and Gate 2 under the [roadmap](roadmap.md). A readable copy for
review and comments is kept as a Claude Doc
([working outline](https://claude.ai/artifact/CMngzviK5V9QX2htVpgpT7)); this
file is the record.

## How this outline works

- **It is versioned.** Each change is a pull request and adds a row to the
  [version history](#version-history), so earlier shapes stay visible in git.
- **Gate 2 approves a version, not a final shape.** When the lead author and
  the faculty advisors approve it, that version is saved as a decision record,
  as the [roadmap](roadmap.md#gate-2-scope-and-outline-approved) requires.
  Later editions can change it the same way.
- **It stays top level.** Each item gets a name, a one-line purpose and a
  status. Section lists inside chapters come later, during drafting.
- **Markers.** "Exists" means a draft or records are already in the
  repository. "Gate 1" means its contents depend on the lead author's data
  review. "Scope question *n*" means it waits for an answer in
  [Open scope questions](#open-scope-questions).

## How the pieces fit

Everything is written once as plain-file records in `content/` and built into
each output, with a separate version and changelog for content, website and
print ([decision record 0003](decisions/0003-three-version-tracks.md);
[decision record 0004](decisions/0004-content-as-plain-files.md)). So one
outline sets the shape that the book and the website both follow.

```text
content/ records (content track)
├── provisions + commentary ─┐
├── essays + sidebars        │──> website (site track): every part, all nation
├── peacemaking materials    │    profiles, library, version history, accounts
├── methods + stories        │
├── nation profiles, sources │──> print book and ebook (print track): front
└── glossary, bibliographies ┘    matter, Parts I to IV, back matter
```

## The book

Front matter, four parts and back matter. The print build already names
three parts (Essays, Model Provisions and Commentary, Methods and Manners) in
[`pdf/book.yaml`](../pdf/book.yaml); this outline proposes a fourth,
Peacemaking, so the book matches the charter's separate track (scope
question 1).

### Front matter

| Item | Purpose | Status |
| --- | --- | --- |
| Title and copyright pages | Title, edition, and the license for each kind of material | Exists ([`pdf/book.yaml`](../pdf/book.yaml)) |
| Preface | Why the project exists, and the lead author's positionality statement ([charter, commitment 10](charter.md#10-positionality-and-transparency)) | To write |
| How to use this book | A model, not law in force; adapt it through a nation's own law-making; how alternatives and placeholders work | To write |
| Words used in this book | Short note on terms, pointing to the glossary and [terminology rules](terminology.md) | To write |
| Acknowledgments and credits | Contributors, reviewers and artists, credited as each chooses ([charter, commitment 7](charter.md#7-credit-authorship-and-art)) | Grows over time |

### Part I. Foundations

Essays that give a drafter the legal and historical ground before the
provisions.

| Chapter | Purpose | Status |
| --- | --- | --- |
| Federal Indian law and Tribal justice: a timeline | Eras of federal policy and how Tribal courts and peacemaking fit in them | Exists ([draft](../content/essays/i-legal-history-timeline.md)) |
| Key cases in federal Indian law | Digest of the cases a drafter must know, those most relevant to dispute resolution first | Exists ([draft](../content/essays/i-key-cases-digest.md)) |
| Comparing model codes and dispute frameworks | Uniform acts, earlier model Tribal codes, compacts and international frameworks side by side | Exists ([draft](../content/essays/i-comparative-model-codes-and-frameworks.md)) |
| Dispute resolution in Native nations today | What the nations' own published law shows, from the reviewed data | Gate 1 |
| Sovereign immunity, consent and enforcement | Why consent and limited waivers decide whether any remedy works | Scope question 3 |
| Disputes between governments | Gaming compacts, negotiation and intergovernmental agreements | Scope question 4 |
| Beyond the border: Canada and Mexico | Comparative essay for nations the border divides | Scope question 8 |

### Part II. The Model Code

Provisions with alternatives, each followed by commentary (Comment,
Illustrations, Source Note). Chapters are listed in
[The model code](#the-model-code-part-ii).

### Part III. Peacemaking

Peacemaking rests on each nation's own traditions rather than on the theory
behind mediation or arbitration, so the project treats it as its own track
(project analysis; the methods model already classes it as a nation's own
tradition, not alternative dispute resolution, in
[decision record 0012](decisions/0012-open-list-of-dispute-resolution-methods.md)).
This part is the companion to the code's peacemaking chapter, if one is
adopted (scope question 1).

| Chapter | Purpose | Status |
| --- | --- | --- |
| Peacemaking in nations' own words | How nations describe their own practice, quoted, not summarized | Research exists |
| How peacemaking programs are built | Patterns across programs: who serves, referral, return to court | Research exists; Gate 1 |
| Background to the peacemaking chapter | What a nation weighs before adopting the code's peacemaking chapter | Scope question 1 |
| Protecting what is sacred | Confidentiality, and teachings that must not be compelled | Research exists |

### Part IV. Methods and Manners

| Chapter | Purpose | Status |
| --- | --- | --- |
| Methods catalog | One entry per dispute resolution method (33 records now) | Exists; Gate 1 |
| Case histories | How real disputes moved through a nation's process, from published Tribal court opinions and nations' own program reports | New; scope question 14 |
| Stories about making peace | Nations' own accounts, printed only with the permissions each needs | Research exists; scope question 9 |
| Practice notes | Training, program materials and evaluation, on nations' own terms | To write |

### Back matter

| Item | Purpose | Status |
| --- | --- | --- |
| Definitions | The code's defined terms in one place, as an appendix a nation can enact with the code | Moved here from chapter 1; scope question 12 |
| Model forms | Fill-in forms with placeholders, such as an agreement to take part | Scope question 10 |
| Nations cited | A short directory of nations whose law the book cites; full profiles live on the website | Scope question 11; Gate 1 |
| Glossary | Plain explanations of terms used across the book, with sources (not enactable, unlike Definitions) | Exists |
| Table of authorities and bibliography | Every case, statute, Tribal law and reading cited | Exists in part |
| Index | Subject index | At print time |
| Requests and corrections | How a nation asks to correct, restrict or remove material | Exists ([requests.md](requests.md)) |
| Edition notes | What changed since the last edition | Each edition |

## The model code (Part II)

Five core chapters follow the roadmap's
[candidate outline](roadmap.md#candidate-outline-to-confirm-at-gate-2); up to
four optional chapters depend on the scope answers. Chapter numbers are fixed
at Gate 2 and never reused after publication
([repository-layout.md](repository-layout.md#identifiers)).

| Chapter | What it covers | Status |
| --- | --- | --- |
| 1. General provisions | Purpose, relation to the Tribal court, confidentiality and privilege, who may serve as a neutral (defined terms move to the Definitions appendix) | Core; confidentiality waits on Gate 1 and scope question 7 |
| 2. Referral and transfer | Consent, safety screening (including for domestic violence), what silence means, return to court when no agreement is reached | Core; Gate 1 |
| 3. Mediation | The process from start to close | Core |
| 4. Agreements and their effect | Entry as an order or judgment, review, change, whether a neutral can be a witness | Core; scope question 7 |
| 5. Arbitration | Agreements to arbitrate, awards, and limited waivers of immunity | Core if scope question 3 is yes |
| Peacemaking | Creating or recognizing a nation's peacemaking forum, choosing peacemakers, referral, return to court, entry of agreements; the process itself is left to the nation's tradition | Scope question 1 (decision pending) |
| Restorative processes | Only the hand-off points between a court case and a consensual process | Optional; scope question 2; Gate 1 |
| Family matters | Parenting and family mediation with screening built in | Optional; scope question 6; Gate 1 |
| Disputes between governments | Intergovernmental agreements and negotiation authority | Optional; scope question 4; needs a schema change |

Every chapter uses the drafting rules already set: must, must not and may; a
named actor; placeholders for nation-specific words; and lettered alternatives
that each work alone ([style guide, section 4](style-guide.md#4-model-provisions)).
Employment disputes appear only in commentary under the recommendation for
scope question 5.

**Where commentary goes.** Each section's commentary (Comment, Illustrations,
Source Note) sits right after that section, as in the Restatements and the
[style guide, section 5](style-guide.md#5-commentary-illustrations-and-essays).
On the website it sits under each section; the print dialog can leave it out
for a provisions-only copy (scope question 13).

## The website

The website mirrors the book part for part, and adds what print cannot hold:
every nation profile, the source library, version history and accounts. The
menu adapts the one in the website design notes (project files,
`design/website-exploration/`), splitting essays and methods out of "Dispute
resolution."

### Main menu

| Section | What it holds | Book part | Status |
| --- | --- | --- | --- |
| Model code | One page per section: provision, alternatives, commentary, "cite this section," compare versions | Part II | After drafting |
| Peacemaking | The peacemaking track, kept visibly separate | Part III | After Gate 2 |
| Essays | Foundations essays and the comparative sidebars | Part I | Drafts exist |
| Methods and stories | Methods catalog and the stories collection | Part IV | Records exist |
| Nations | Map (state presence only) and table, one profile per nation with review status and sources | Directory | Built |
| Library | Sources, documents with version history, constitutions, compacts, bibliographies, data downloads | Back matter | Partly built |
| Glossary | Every defined term with hover cards | Back matter | Built |
| About | Charter, positionality, how to cite, the changes log for all three tracks | Front matter | Partly built |

### Always available

- **Report a problem**, once at the top of every page, and the private request
  route for nations ([requests.md](requests.md)).
- **Search**, **theme** (one sun and moon button), **read offline** and
  **downloads** (PDF, EPUB, data).
- **Profile** for readers: saves, notes and shared collections, built in two
  steps ([roadmap, parked research](roadmap.md#parked-research)).
- **Join and workspace** for contributors: access levels per document,
  reviews, requests and the activity log (built).

## Open scope questions

Fourteen questions shape the framework. Each has a recommendation. Questions 2,
6 and 11 need Gate 1 results before a final answer. These replace and extend
the roadmap's [scope questions for Gate 2](roadmap.md#scope-questions-for-gate-2).

| # | Question | Recommendation | Why |
| --- | --- | --- | --- |
| 1 | How does peacemaking appear? | Its own chapter in the code: create or recognize a forum, choose peacemakers, refer, return and enter agreements, leaving the process to each nation; Part III as background; charter commitment 3 reworded to match | Programs differ most in who serves and how sessions run, least in how cases come from and go back to court; 580 peacemaking provisions from 39 nations' codes already exist ([peacemaking note, sections 2.1 and 6](../research/analyses/2026-11-21-peacemaking-programs.md#21-what-the-code-texts-add)) |
| 2 | Does the code cover diversion and restorative sentencing? | Only the hand-off points between a court case and a consensual process; no sentencing provisions | 161 records sit on this line: 121 diversion, 23 sentencing, 17 near it ([provision pre-review](../research/reviews/2026-11-21-provision-pre-review.md#the-scope-decision)) |
| 3 | Include arbitration and immunity waivers? | Yes, as chapter 5, with waiver limits offered as alternatives | The arbitration ordinances read tie awards to express waivers ([analysis, section 4](../research/analyses/2026-11-21-dispute-resolution-practice.md#4-arbitration-ordinances-and-immunity)) |
| 4 | Disputes between governments: chapter or essay? | An essay in Part I for the 1st Edition; a chapter later if the advisors want one | Compact clauses mostly follow state templates ([analysis, section 6](../research/analyses/2026-11-21-dispute-resolution-practice.md#6-gaming-compacts)), and a chapter needs a schema change |
| 5 | Employment disputes in scope? | Commentary only, no chapter | One employment tribunal and one employment mediation clause found ([analysis, sections 3 and 4](../research/analyses/2026-11-21-dispute-resolution-practice.md#3-other-forums)) |
| 6 | Which family and child welfare matters? | A short family chapter with safety screening; child welfare conferencing in commentary | Family matters appear in both forums and bulk records ([analysis, sections 3 and 5](../research/analyses/2026-11-21-dispute-resolution-practice.md#5-the-restorative-justice-database-records)); counts wait on Gate 1 |
| 7 | How much evidence law? | Confidentiality and privilege in chapter 1; neutral as witness in chapter 4; no general evidence code | 85 confidentiality provisions from 38 nations differ in ways a drafter must choose among ([evidence spike](../research/analyses/2026-11-21-tribal-rules-of-evidence.md#recommendation)) |
| 8 | Where do Canada and Mexico go? | One comparative essay in Part I, plus short boxes where a border-divided nation matters; no provisions | Each country sets status by its own law ([Canada note](../research/analyses/2026-11-21-canada-dispute-resolution.md); [Mexico note](../research/analyses/2026-11-21-mexico-indigenous-dispute-resolution.md)) |
| 9 | Stories in the 1st Edition? | Only stories whose permissions are in hand; the rest wait for a later edition | Every shortlisted story needs a nation's or teller's permission ([stories catalog, section 4](../research/analyses/2026-11-21-peacemaking-stories.md#4-anthology-shortlist-and-whose-permission-each-needs)) |
| 10 | Include model forms? | Yes, a small set tied to chapters 2 and 4 | Forms are already planned as CC0 files with placeholders ([repository-layout.md](repository-layout.md)) |
| 11 | Nation profiles in print? | A short directory of nations cited; full profiles stay on the website | There are about 950 profiles, too many for a printed book (project count of `content/tribes/`) |
| 12 | Where do the code's definitions go? | An appendix at the end of the code; back to chapter 1 only if the list ends up a few terms long | Lead author's note, Nov. 22, 2026; readers meet the substance first (project judgment) |
| 13 | Where does commentary go? | Right after each section, in print and online, with a provisions-only print option | Restatement pattern in the [style guide, section 5](style-guide.md#5-commentary-illustrations-and-essays) |
| 14 | Include case histories? | Yes, a Part IV chapter from published Tribal court opinions and nations' own program reports; a nation is named only after it reviews the text (Gate 3), and private parties are referred to by role | Shows how processes work in practice; illustrations in commentary stay fictitious unless a nation approves ([style guide, section 5](style-guide.md#5-commentary-illustrations-and-essays); [charter, commitment 4](charter.md#4-consultation-before-publication)) |

## What waits on Gate 1

The data review changes contents, not the framework. These parts need its
results before they can be filled:

- **Part I, "Dispute resolution in Native nations today"**: rests on the
  re-run analysis of reviewed data.
- **Chapters 1, 2 and 4**: which confidentiality, referral and agreement
  models a drafter can rely on depends on confirming the text-read records
  ([roadmap, Gate 1 item 3](roadmap.md#gate-1-review-of-the-pull-request-2-data)).
- **Restorative processes and family chapters**: whether they exist at all
  depends on triaging the bulk records (Gate 1 item 2).
- **Methods catalog**: waits on accepting or setting aside the proposed method
  records (Gate 1 item 6).
- **Directory of nations cited**: waits on resolving duplicates (Gate 1
  item 4).

## Where parked research lands

| Parked item ([roadmap](roadmap.md#parked-research)) | Lands in |
| --- | --- |
| Canada comparative notes | Part I, "Beyond the border"; boxes in chapters |
| Mexico comparative notes | Same as Canada |
| Peacemaking programs survey | Part III, "How peacemaking programs are built" |
| Stories catalog | Part IV, "Stories about making peace" |
| Rules of evidence spike | Chapter 1 (confidentiality), chapter 4 (neutral as witness), Part III (protecting what is sacred) |
| Gaming compact research ([note](../research/analyses/2026-11-21-gaming-compact-negotiation.md)) | Part I, "Disputes between governments" |
| Reader profiles | Website, Profile |
| "Nemesis" review agent | Not part of the book; a review step during drafting |

## Editions

The 1st Edition covers Native nations in the United States, as the
[charter's purpose](charter.md#purpose) states. Later editions can add
chapters, stories cleared for print, or wider comparative coverage;
[charter commitment 11](charter.md#11-future-expansion-beyond-the-united-states)
sets the data principles for any expansion beyond the United States. Partial
editions, such as the code alone, can be built from the same files.

## Version history

| Version | Date | Change |
| --- | --- | --- |
| 0.2 | Nov. 22, 2026 | Definitions moved to an appendix; case histories added to Part IV; commentary placement stated; peacemaking reason in the project's own words and a peacemaking chapter proposed; scope questions 12 to 14 added |
| 0.1 | Nov. 22, 2026 | First working outline, for Gate 2 discussion |
