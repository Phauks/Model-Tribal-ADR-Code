# Working outline: model code, book and website

**Version 0.6, Nov. 23, 2026.** This is the project's framework: the parts, divisions and website sections, and what each one is for. It is a working draft that will change. Nothing here is provision text, which waits for Gate 1 and Gate 2 under the [roadmap](roadmap.md). A readable copy for review and comments is kept as a Claude Doc ([working outline](https://claude.ai/artifact/CMngzviK5V9QX2htVpgpT7)); this file is the record.

The project is built for the website first; the book's order, title and print form are settled later, at export time (lead author, Nov. 22, 2026).

## How this outline works

- **It is versioned.** Each change is a pull request and adds a row to the [version history](#version-history), so earlier shapes stay visible in git.
- **Gate 2 approves a version, not a final shape.** When the lead author and the faculty advisors approve it, that version is saved as a decision record, as the [roadmap](roadmap.md#gate-2-scope-and-outline-approved) requires. Later editions can change it the same way.
- **It stays top level.** Each item gets a name, a one-line purpose and a status. Section lists inside divisions come later, during drafting.
- **Markers.** "Exists" means a draft or records are already in the repository. "Decided" means the lead author has settled it. "Gate 1" means its contents depend on the lead author's data review. "Scope question *n*" means it waits for an answer in [Open scope questions](#open-scope-questions).

## How the pieces fit

Everything is written once as plain-file records in `content/` and built into each output, with a separate version and changelog for content, website and print ([decision record 0003](decisions/0003-three-version-tracks.md); [decision record 0004](decisions/0004-content-as-plain-files.md)). So one outline sets the shape that the book and the website both follow.

```text
content/ records (content track)
├── provisions (the model code)  ─┐
├── commentary on each section    │──> website (site track): every part, all
├── foundations + essays          │    nation profiles, library, version
├── methods, cases + stories      │    history, accounts
├── nation profiles, sources      │
└── glossary, bibliographies     ─┘──> print book and ebook (print track):
                                       front matter, Parts I to V, back matter
```

## The parts

The lead author's shape (Nov. 22, 2026): foundations, then the model code, then a separate part of commentary on the code, then essays. This outline adds a fifth part for methods and manners, which the repository already plans. Online, each part is a section of the website; when the book is made, the same parts become its parts, and their print order is settled then (scope question 16). The print build's three working parts in [`pdf/book.yaml`](../pdf/book.yaml) change at that point.

| Part | What it is for | Reads like |
| --- | --- | --- |
| I. Foundations | The legal, historical and cultural ground a reader needs before the code | Background and reference |
| II. The Model Code | The provisions alone, in divisions, ready for a nation to adapt | Enactable text |
| III. Commentary | Section by section: what each provision does, illustrations, and the sources behind it | Notes keyed to section numbers |
| IV. Essays | Why the code makes the choices it does, one choice per essay, in the manner of the Federalist Papers | Argument |
| V. Methods and Manners | How disputes are actually resolved: methods, case histories and stories | Practice |

Keeping the code and its commentary in separate parts also keeps their licenses apart: provisions are dedicated to the public domain (CC0), while commentary and essays carry CC BY ([decision record 0002](decisions/0002-license-by-material.md)).

### Front matter (the About pages online)

| Item | Purpose | Status |
| --- | --- | --- |
| Title and copyright pages | Title, edition, and the license for each kind of material | Exists ([`pdf/book.yaml`](../pdf/book.yaml)); title may change (scope question 15) |
| Preface | Why the project exists, and the lead author's positionality statement ([charter, commitment 10](charter.md#10-positionality-and-transparency)) | To write |
| How to use this book | A model, not law in force; adapt it through a nation's own law-making; how parts, divisions, alternatives and placeholders work | To write |
| Words used in this book | Short note on terms, pointing to the glossary and [terminology rules](terminology.md) | To write |
| Acknowledgments and credits | Contributors, reviewers and artists, credited as each chooses ([charter, commitment 7](charter.md#7-credit-authorship-and-art)), and a land acknowledgment for the William S. Boyd School of Law | Started: land acknowledgment in [`content/front-matter/acknowledgments.md`](../content/front-matter/acknowledgments.md), on the website and in the book; credits grow over time |

### Part I. Foundations

| Chapter | Purpose | Status |
| --- | --- | --- |
| Federal Indian law and Tribal justice: a timeline | Eras of federal policy, with the cases a drafter must know in boxes in their place, and how Tribal courts and peacemaking fit in them (the key cases digest was merged into it on Nov. 22, 2026, so readers read one timeline) | Exists ([draft](../content/essays/i-legal-history-timeline.md)) |
| Comparing model codes and dispute frameworks | Uniform acts, earlier model Tribal codes, compacts and international frameworks side by side | Exists ([draft](../content/essays/i-comparative-model-codes-and-frameworks.md)) |
| Dispute resolution in Native nations today | What the nations' own published law shows, from the reviewed data | Gate 1 |
| Peacemaking in nations' own words | How nations describe their own practice and build their programs, quoted, not summarized | Research exists; Gate 1 |

### Part II. The Model Code

One code in divisions; see [The model code](#the-model-code-part-ii).

### Part III. Commentary

Commentary follows the code's own numbering, division by division, so a reader can go from any section to its note and back. Each note has a Comment, Illustrations and a Source Note, as the [style guide, section 5](style-guide.md#5-commentary-illustrations-and-essays) already requires. On the website each note appears both under its section and in the Commentary part; the print layout is settled with the book (scope question 13).

### Part IV. Essays

Each essay explains and defends one design choice, so a nation can weigh the reasoning and choose differently. They are written as the code is drafted, since each depends on what the drafting settles. Candidate topics, from the scope decisions so far:

| Essay | The choice it explains | Status |
| --- | --- | --- |
| One code, many ways | Why one code with divisions, and why each division can be enacted alone | Decided; to write |
| Leaving peacemaking to each nation | Why the peacemaking division sets up and connects a forum but does not define the process ([decision record 0026](decisions/0026-model-peacemaking-code.md)) | Decided; to write |
| Alternatives, not answers | Why the code offers lettered alternatives instead of one rule ([charter, commitment 2](charter.md#2-respect-for-each-nations-own-institutions)) | To write |
| Consent and safety first | Why referral, the meaning of silence and screening for domestic violence come before any process | After drafting |
| Consent to be bound: immunity and enforcement | Why arbitration uses separate, limited waivers | Decided; after drafting |
| What stays confidential | Why confidentiality and privilege rules sit in the code rather than in an evidence code | Decided; after drafting |
| Disputes between governments | Why compact talks are treated as they are, and whether negotiation is a division | Scope question 4 |
| Beyond the border: Canada and Mexico | Why the code does not legislate for nations the border divides, and what it says instead | Decided; research exists |

### Part V. Methods and Manners

| Chapter | Purpose | Status |
| --- | --- | --- |
| Methods catalog | One entry per dispute resolution method (33 records now) | Exists; Gate 1 |
| Case histories | How real disputes moved through a nation's process, from published Tribal court opinions, nations' own program reports and first-hand accounts | Decided |
| Stories about making peace | Nations' own accounts, quoted in the tellers' words, published only with the permissions each needs | Decided: online as soon as possible |
| Practice notes | Training, program materials and evaluation, on nations' own terms | To write |

### Back matter (reference pages online)

| Item | Purpose | Status |
| --- | --- | --- |
| Model forms | Fill-in forms with placeholders: court forms for people filing in a Tribal court (nine drafted, decision record [0047](decisions/0047-draft-model-court-forms-before-gate-2.md)), and later forms for the code's divisions, such as an agreement to take part | Exists (court forms); decided (division forms) |
| Nations cited | A short directory of nations whose law the book cites; full profiles live on the website | Scope question 11; Gate 1 |
| Glossary | Plain explanations of words used in the essays and other prose, with sources; points to the code's own definition where one exists (scope question 12) | Exists |
| Table of authorities and bibliography | Every case, statute, Tribal law and reading cited | Exists in part |
| Index | Subject index (site search online) | Book form, later |
| Requests and corrections | How a nation asks to correct, restrict or remove material | Exists ([requests.md](requests.md)) |
| Edition notes | What changed since the last edition | Each edition |

## The model code (Part II)

There is one model code with a division for each way of resolving disputes (lead author's decision, Nov. 22, 2026). Rules every division needs sit once in the general division, and a nation can enact any division together with the general division alone. The research supports sharing those rules: the peacemaking codes collected address the same court connections as other dispute resolution provisions, such as how a case enters (32 nations) and return to court (27) ([peacemaking note, section 2.1](../research/analyses/2026-11-21-peacemaking-programs.md#21-what-the-code-texts-add); project analysis). Division numbers are fixed at Gate 2 and never reused after publication ([repository-layout.md](repository-layout.md#identifiers)).

| Division | What it covers | Status |
| --- | --- | --- |
| General provisions | Purpose, definitions, relation to the Tribal court, referral and return to court, safety screening (including for domestic violence), confidentiality and privilege, who may serve, entry and effect of agreements | Decided; contents wait on Gate 1 |
| Mediation | The process from start to close | Decided |
| Arbitration | Agreements to arbitrate, awards, and separate, limited waivers of immunity | Decided |
| Negotiation | Who may negotiate for the nation and how a settlement binds it | Tentative; scope question 4 |
| Peacemaking | Creating or recognizing a nation's peacemaking forum, choosing peacemakers, coming to and leaving peacemaking, protecting what is sacred, effect of agreements; the process itself is left to the nation's tradition | Decided ([decision record 0026](decisions/0026-model-peacemaking-code.md)) |
| Restorative processes | Only the hand-off points between a court case and a consensual process | Decided (scope question 2); contents wait on Gate 1 |
| Family matters | Family mediation with screening built in; how far it reaches is open | Scope question 6 (kept open); Gate 1 |

Every division uses the drafting rules already set: must, must not and may; a named actor; placeholders for nation-specific words; and lettered alternatives that each work alone ([style guide, section 4](style-guide.md#4-model-provisions)). Employment disputes appear only in commentary under the recommendation for scope question 5.

## The website

The website is the primary edition. It carries every part, plus what print cannot hold: every nation profile, the source library, version history and accounts. The menu adapts the one in the website design notes (project files, `design/website-exploration/`).

### Main menu

| Section | What it holds | Book part | Status |
| --- | --- | --- | --- |
| Model code | One page per section: provision, alternatives, its commentary below, "cite this section," compare versions; one entry per division | Parts II and III | After drafting |
| Peacemaking | A direct way in to the peacemaking division, its commentary and its essay, kept visibly separate | Parts II to IV | After drafting |
| Foundations | History, key cases, comparisons and current practice | Part I | Drafts exist |
| Essays | One page per design choice | Part IV | After drafting |
| Methods and stories | Methods catalog, case histories and the stories collection | Part V | Records exist |
| Nations | Map (state presence only) and table, one profile per nation with review status and sources | Directory | Built |
| Library | Sources, documents with version history, constitutions, compacts, bibliographies, data downloads | Back matter | Partly built |
| Glossary | Every defined term with hover cards | Back matter | Built |
| About | Charter, positionality, how to cite, the changes log for all three tracks | Front matter | Partly built |

### Always available

- **Report a problem**, once at the top of every page, and the private request route for nations ([requests.md](requests.md)).
- **Search**, **theme** (one sun and moon button), **read offline** and **downloads** (PDF, EPUB, data).
- **Profile** for readers: saves, notes and shared collections, built in two steps ([roadmap, parked research](roadmap.md#parked-research)).
- **Join and workspace** for contributors: access levels per document, reviews, requests and the activity log (built).

## Open scope questions

The lead author answered most questions on Nov. 22, 2026. Still open: 4 (deferred to Gate 2), 6 (kept open until Gate 1), and 11, 15 and 16 (waiting for the book). These replace and extend the roadmap's [scope questions for Gate 2](roadmap.md#scope-questions-for-gate-2).

| # | Question | Recommendation | Why |
| --- | --- | --- | --- |
| 1 | How does peacemaking appear? | *Decided Nov. 22, 2026:* a peacemaking division of the one model code, which sets up or recognizes the forum and leaves the process to each nation | [Decision record 0026](decisions/0026-model-peacemaking-code.md) |
| 2 | Does the code cover diversion and restorative sentencing? | *Decided Nov. 22, 2026:* only the hand-off points between a court case and a consensual process; no sentencing provisions | 161 records sit on this line: 121 diversion, 23 sentencing, 17 near it ([provision pre-review](../research/reviews/2026-11-21-provision-pre-review.md#the-scope-decision)) |
| 3 | How does the arbitration division treat immunity? | *Decided Nov. 22, 2026:* a separate, express waiver, with its limits offered as lettered alternatives; never a general waiver | The arbitration ordinances read tie awards to express waivers ([analysis, section 4](../research/analyses/2026-11-21-dispute-resolution-practice.md#4-arbitration-ordinances-and-immunity)) |
| 4 | Keep a negotiation division? | *Deferred to Gate 2* (lead author, Nov. 22, 2026). If kept, limit it to who may negotiate for the nation and how a settlement binds it, and explain compact talks in an essay | Compact negotiation is government-to-government bargaining and compact clauses mostly follow state templates ([gaming note](../research/analyses/2026-11-21-gaming-compact-negotiation.md); [analysis, section 6](../research/analyses/2026-11-21-dispute-resolution-practice.md#6-gaming-compacts)) |
| 5 | Employment disputes in scope? | *Decided Nov. 22, 2026:* commentary only, no division | One employment tribunal and one employment mediation clause found ([analysis, sections 3 and 4](../research/analyses/2026-11-21-dispute-resolution-practice.md#3-other-forums)) |
| 6 | Which family and child welfare matters? | *Kept open:* the lead author sees this as a large area and does not want it narrowed yet (Nov. 22, 2026). Leaning: a family division with safety screening, sized after Gate 1 | Family matters appear in both forums and bulk records ([analysis, sections 3 and 5](../research/analyses/2026-11-21-dispute-resolution-practice.md#5-the-restorative-justice-database-records)); counts wait on Gate 1 |
| 7 | How much evidence law? | *Decided Nov. 22, 2026:* the code carries its own confidentiality and privilege rules (including whether a neutral or peacemaker can be a witness) in the general division, not a general evidence code; one model rule or lettered alternatives is chosen during drafting | 85 confidentiality provisions from 38 nations differ in ways a drafter must choose among ([evidence spike](../research/analyses/2026-11-21-tribal-rules-of-evidence.md#recommendation)) |
| 8 | Where do Canada and Mexico go? | *Decided Nov. 22, 2026:* an essay in Part IV, plus short boxes in the commentary where a border-divided nation matters; no provisions | Each country sets status by its own law ([Canada note](../research/analyses/2026-11-21-canada-dispute-resolution.md); [Mexico note](../research/analyses/2026-11-21-mexico-indigenous-dispute-resolution.md)) |
| 9 | When do stories appear? | *Decided Nov. 22, 2026:* put the stories on the website as soon as possible, within decision record 0019's access and excerpt rules; full stories only with permission | Every shortlisted story needs a nation's or teller's permission ([stories catalog, section 4](../research/analyses/2026-11-21-peacemaking-stories.md#4-anthology-shortlist-and-whose-permission-each-needs)) |
| 10 | Include model forms? | *Decided Nov. 22, 2026:* yes, a small set tied to the general division first. *Nov. 23, 2026:* court forms for people filing in Tribal courts drafted ahead of Gate 2 (decision record [0047](decisions/0047-draft-model-court-forms-before-gate-2.md)) | Forms are already planned as CC0 files with placeholders ([repository-layout.md](repository-layout.md)) |
| 11 | Nation profiles in print? | *Deferred to book form.* Leaning: a short directory of nations cited; full profiles stay on the website | There are about 950 profiles, too many for a printed book (project count of `content/tribes/`) |
| 12 | Where do the code's definitions go? | *Decided Nov. 22, 2026:* defined terms that are enacted belong in the code itself, in the general division; the glossary is the reference for words used in the essays and other prose, and where a word is defined in the code the glossary points to that definition so the two match | Lead author's note, Nov. 22, 2026; readers meet the substance first (project judgment) |
| 13 | Where does commentary go? | *Decided Nov. 22, 2026:* its own part after the code, keyed to section numbers; on the website, also under each section | Lead author's shape for the book; the website can show both without cost |
| 14 | Include case histories? | *Decided Nov. 22, 2026:* yes, from all three sources: fictitious illustrations in the commentary, published Tribal court opinions and program reports, and first-hand accounts gathered through contribution filings; a nation is named only after it reviews the text (Gate 3), and private parties are referred to by role | Shows how processes work in practice; illustrations in commentary stay fictitious unless a nation approves ([style guide, section 5](style-guide.md#5-commentary-illustrations-and-essays); [charter, commitment 4](charter.md#4-consultation-before-publication)) |
| 15 | Does the book's title change? | *Deferred to book form.* Leaning: yes, to name both dispute resolution and peacemaking; pick the wording at Gate 2 | "Model Tribal ADR Code" ([`pdf/book.yaml`](../pdf/book.yaml)) no longer covers the peacemaking division, which the charter keeps apart from alternative dispute resolution |
| 16 | What order do the parts go in? | Online: the menu order below. *Book order deferred to book form;* leaning Foundations, Model Code, Commentary, Essays, Methods and Manners | A reader gets the background, reads the code clean, checks a section's note, then weighs the reasoning; practice material closes the book. The other order, essays before the code, suits readers who want the argument first (project judgment) |

## What waits on Gate 1

The data review changes contents, not the framework. These parts need its results before they can be filled:

- **Part I, "Dispute resolution in Native nations today" and "Peacemaking in nations' own words"**: rest on the re-run analysis of reviewed data.
- **General provisions**: which confidentiality, referral and agreement models a drafter can rely on depends on confirming the text-read records ([roadmap, Gate 1 item 3](roadmap.md#gate-1-review-of-the-pull-request-2-data)).
- **Restorative processes and family divisions**: whether they exist at all depends on triaging the bulk records (Gate 1 item 2).
- **Methods catalog**: no longer waits. The lead author adopted all 33 method records on Nov. 22, 2026 (Gate 1 item 6), so the catalog can be built from them.
- **Directory of nations cited**: waits on resolving duplicates (Gate 1 item 4).

## Where parked research lands

| Parked item ([roadmap](roadmap.md#parked-research)) | Lands in |
| --- | --- |
| Canada comparative notes | Part IV, "Beyond the border"; boxes in the commentary |
| Mexico comparative notes | Same as Canada |
| Peacemaking programs survey | Part I, "Peacemaking in nations' own words"; commentary on the peacemaking division |
| Stories catalog | Part V, "Stories about making peace" |
| Rules of evidence spike | General provisions (confidentiality, neutral or peacemaker as witness); peacemaking division (protecting what is sacred); Part IV, "What stays confidential" |
| Gaming compact research ([note](../research/analyses/2026-11-21-gaming-compact-negotiation.md)) | Part IV, "Disputes between governments"; negotiation division if kept |
| Reader profiles | Website, Profile |
| "Nemesis" review agent | Not part of the book; a review step during drafting |

## Editions

The 1st Edition covers Native nations in the United States, as the [charter's purpose](charter.md#purpose) states. Later editions can add divisions, essays, stories cleared for print, or wider comparative coverage; [charter commitment 11](charter.md#11-future-expansion-beyond-the-united-states) sets the data principles for any expansion beyond the United States. Partial editions, such as the code alone or one division with the general provisions, can be built from the same files.

## Version history

| Version | Date | Change |
| --- | --- | --- |
| 0.6 | Nov. 23, 2026 | Model court forms for people filing in Tribal courts drafted ahead of Gate 2 (decision record 0047); division forms still wait for the general division |
| 0.5 | Nov. 22, 2026 | Methods catalog unblocked: all 33 method records adopted (Gate 1 item 6) |
| 0.4 | Nov. 22, 2026 | Lead author's answers to scope questions 2, 3, 5, 7, 8, 9, 10, 12 and 14 recorded; definitions move into the general division; question 4 deferred to Gate 2 and question 6 kept open |
| 0.3 | Nov. 22, 2026 | Website first, book form later; five parts (Foundations, Model Code, Commentary, Essays, Methods and Manners); one model code in divisions with peacemaking as a division (decision record 0026); essays explain design choices; scope questions 15 and 16 added |
| 0.2 | Nov. 22, 2026 | Definitions moved to an appendix; case histories added; commentary placement stated; peacemaking reason in the project's own words; scope questions 12 to 14 added |
| 0.1 | Nov. 22, 2026 | First working outline, for Gate 2 discussion |
