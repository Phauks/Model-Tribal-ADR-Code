# Part I, Foundations: state of the part and a plan for the two Gate 1 chapters

Nov. 22, 2026. Part I is the background a reader needs before the model code: the history, the leading cases, the models others have built, and what nations do today ([outline, Part I](../../docs/outline.md#part-i-foundations)). Three chapters are drafted. Two wait on Gate 1, the lead author's review of the dataset ([roadmap](../../docs/roadmap.md#gate-1-review-of-the-pull-request-2-data)). This note records where each chapter stands after the Nov. 22 source work and sets out how the two waiting chapters will be built. It states no findings for those two chapters; those come only from reviewed data.

## Where the three drafted chapters stand

| Chapter | State after Nov. 22 | Still needed before publication |
| --- | --- | --- |
| Federal Indian law and Tribal justice: a timeline | Sources audited ([audit](../reviews/2026-11-22-foundations-source-audit.md)); treaty dispute clauses, the bad-men cases, Hawaiʻi and the territories added; decision dates for the Cherokee cases verified; points readers to an annotated list of standard works | KeyCite for the remaining cases; clean page images for the NCAI guide and the noisy Statutes at Large scans; pinpoints from Cohen's Handbook (2024) and Deloria and Lytle where the timeline's framing should rest on them; the items in its "Gaps" section |
| Key cases in federal Indian law | Quotations and Supreme Court pinpoints confirmed; stale notes fixed | KeyCite for 54 cases; a decision on whether to add the bad-men cases (Tsosie, Richard, Jones) as entries, since they are the only line of cases enforcing a treaty dispute clause today |
| Comparing model codes and dispute frameworks | Internal file references removed; gaming compact counts brought up to date with the Nov. 22 recheck | The open checks in its "Limits" section (Oklahoma Part 12 official text, Native Title Act sections, Nisg̱a'a appendices, the 2009 Australian report) |

A sixth chapter may be worth adding. The new Hawaiʻi and territories section of the timeline shows a separate legal track: kingdoms and chiefly orders, cessions, and territorial courts that apply custom, such as American Samoa's required meeting before the Secretary of Samoan Affairs. Whether that becomes its own chapter or stays a section is a question for the outline at Gate 2 (project analysis).

## Chapter 4. Dispute resolution in Native nations today

**Purpose (from the outline).** What the nations' own published law shows, from the reviewed data.

**What it will answer.**

1. How many nations have published law on each kind of forum: Tribal courts, peacemaking, mediation, arbitration, other forums, and dispute clauses in compacts.
2. How those forums are connected to the nation's court: referral, consent, return to court, entry of agreements as judgments.
3. What nations' arbitration ordinances and immunity waivers provide.
4. What the gaming compact clauses show about government-to-government dispute steps.
5. Where the data cannot see: nations with no published law online, codes behind paywalls, practice that is not written down.

**Inputs, all after Gate 1.** The nation profiles in `content/tribes/` as reviewed; the re-run of `scripts/analysis/dispute_resolution_practice.py` on reviewed data (roadmap step 1); the compact clauses as rechecked Nov. 22; the court listings second pass; the per-nation search logs for the "cannot see" section.

**Secondary sources to frame it (verified Nov. 22, not yet read).** Fletcher's casebook on Tribal law [`fletcher-american-indian-tribal-law-2d-2020`], Richland and Deer [`richland-deer-introduction-to-tribal-legal-studies-3d-2016`], Newton's study of twenty Tribal courts [`newton-1998-tribal-court-praxis`], and Pommersheim's two books on Tribal courts [`pommersheim-braid-of-feathers-1995`, `pommersheim-tribal-justice-2016`].

**Outline.**

1. What the chapter counts and what it cannot see (method, coverage and limits first).
2. Courts: how many nations publish a court code, and the shapes those courts take.
3. Forums connected to the courts: peacemaking (cross-referring to chapter 5), mediation, other forums, with the connection points.
4. Arbitration and immunity.
5. Between governments: compact dispute clauses and other intergovernmental agreements.
6. What the numbers suggest for the code (labeled project analysis, framed as questions for Gate 2).

**Rules for writing it.** Every count comes from reviewed records and names its script and date. A nation is named only for what its own published law says, as its own source states it. No ranking of nations. Counts of federally recognized nations use the current list, not the 574 in older sources. "Peacemaking" is never counted as a kind of ADR.

**What can be done before Gate 1.** Nothing that states a finding. The method section's text, the table layouts and the source list can be drafted as empty shells, and the analysis script can be checked to make sure it reports every number the chapter needs.

## Chapter 5. Peacemaking in nations' own words

**Purpose (from the outline).** How nations describe their own practice and build their programs, quoted, not summarized.

**What it will answer.**

1. How nations that publish their peacemaking law or program descriptions define peacemaking, in their own words.
2. How the programs are built: who the peacemakers are, how a case comes in, whether participation is voluntary, how agreements return to court.
3. What the nations and Native scholars say peacemaking is not, including the Native American Rights Fund's statement that it is not ADR.
4. What the evaluations show and what they do not, including the domestic violence critique.

**Inputs, all after Gate 1.** The reviewed peacemaking records in the nation profiles; the peacemaking programs survey (`research/analyses/2026-11-21-peacemaking-programs.md`); NARF's Indigenous Peacemaking Initiative materials; Native-authored scholarship already recorded (Yazzie 1994, Austin 2009, Nielsen and Zion 2005, Bluehouse and Zion 1993, Zion 1983).

**Outline.**

1. Why this chapter quotes rather than summarizes, and whose words it uses.
2. Nations' own definitions, grouped by region, each quotation from the nation's own published law or program page.
3. How programs are built, quoted from codes and rules.
4. What peacemaking is not.
5. What the evidence shows, and its limits.
6. Questions for the peacemaking division (project analysis, for Gate 2).

**Rules for writing it.**

- Quote, do not summarize, each nation's description. Quotations stay short unless the source's rights record allows more.
- Use only what a nation has published for the public. Nothing ceremonial, restricted or community-held ([charter, commitment 5](../../docs/charter.md#5-cultural-knowledge-and-restricted-material)).
- Before publication, each nation quoted gets the chance to correct or remove what is said about it ([charter, commitment 6](../../docs/charter.md#6-the-right-to-correct-restrict-or-withdraw)) and the consultation commitment ([commitment 4](../../docs/charter.md#4-consultation-before-publication)); this is Gate 3 work.
- Hoʻoponopono and other Native Hawaiian or territorial practices are not Tribal peacemaking and are not included here. If mentioned, it is only as a pointer to the timeline's Hawaiʻi section.

**What can be done before Gate 1.** As for chapter 4: shells and a source list only.

## Order of work

1. Now: the lead author's pulls for the drafted chapters (KeyCite, library copies, page images), all on the pull list.
2. After Gate 1: re-run the analysis, then draft chapter 4, then chapter 5 (chapter 5 cross-refers to chapter 4's counts).
3. At Gate 2: decide whether Hawaiʻi, American Samoa, Guam, the Northern Mariana Islands, Puerto Rico and the U.S. Virgin Islands become a chapter, and whether the bad-men cases get case boxes in the timeline (the key cases digest was merged into the timeline on Nov. 22, 2026).
4. Before publication: Gate 3 review by the nations quoted in chapter 5.
