# Gaming compacts: how they are negotiated and how compact disputes are resolved

**Status:** provisional, written Nov. 21, 2026, before the lead author, Trevor
Goldsmith, has reviewed the data. It summarizes the catalog and context
research in [`research/gaming/`](../gaming/README.md) for a possible part of
the model code on negotiation. Compact negotiation between a Native nation and
a state is government-to-government bargaining, not dispute resolution as
such; it is here because the model code may touch on negotiation. Counts come
from the files named in each footnote. Groupings and interpretations are
project analysis unless a footnote cites a source.

## What was collected

- **1,201 rows, 1,200 documents** on the Office of Indian Gaming list: 819
  approvals, 198 compacts deemed approved, 121 extensions, 31 disapprovals and
  26 sets of Secretarial Procedures, in 28 states. All 1,200 PDFs were saved
  privately (48,182 pages); 38 are scans with no text layer.[^compacts]
- **1,042 rows carry a Federal Register citation**: 1,019 from the list's own
  link and 23 matched by rule (the only gaming notice that day, or a notice
  naming the nation within 150 days). 710 notices have a source record in
  Indigo Book form.[^notices]
- **Ordinances: 321 nations, 1,167 documents** on the National Indian Gaming
  Commission list (the original approval and each amendment). 1,166 were
  saved privately (34,814 pages); 266 are scans with no text layer, and the list's
  link for the Cahto Indian Tribe's 1996 ordinance is broken.[^ordinances]
- **140 context facts**, 83 with a quotation a script found word for word on
  the cited page.[^context]
- **Clauses**: AI reviewers read the dispute resolution, renegotiation, term,
  revenue sharing and immunity sections of 526 governing documents for 295
  nation and state pairs (see [Compact clauses](#compact-clauses)).

## The federal framework

The Indian Gaming Regulatory Act lets a Native nation ask a state to negotiate
a compact for Class III gaming and requires the state to negotiate in good
faith; the compact takes effect only when the Secretary of the Interior
approves it, or when the Secretary does not act within 45 days and it is
"considered to have been approved" to the extent it is consistent with the
Act.[^usc-2710] The 1,017 approved and deemed-approved rows, and the Federal
Register notices of each, are the record of that second step.[^compacts]

The Act also gave the nation a remedy when talks fail: a suit in federal
court, then a court-ordered 60 days of further talks, then a mediator who
picks one side's last best offer, and, if the state does not consent,
Class III procedures issued by the Secretary.[^usc-2710] *Seminole Tribe of
Florida v. Florida*, 517 U.S. 44 (1996), held that Congress could not make a
state answer that suit without its consent.[^seminole] Three paths have been
used since (project analysis of the context file):

1. **States that consent.** California waived its immunity for these suits,
   and its courts' bad-faith findings led to mediators' choices and then to
   Secretarial Procedures: Rincon in 2013, North Fork and Enterprise in 2016,
   Big Lagoon in 2018, and, after *Chicken Ranch*, more than a dozen sets in
   2024 and 2025.[^procedure-letters][^chicken-ranch]
2. **Procedures without a suit.** Interior's 1999 rule, 25 C.F.R. part 291,
   let the Secretary issue procedures when a state asserts immunity.[^part-291-rule]
   The Fifth Circuit (*Texas v. United States*, 2007) and the Tenth Circuit
   (*New Mexico v. Department of the Interior*, 2017) held the rule
   invalid; the part is still printed in the Code of Federal
   Regulations.[^texas][^new-mexico][^part-291]
3. **Bargained remedies inside the compact.** *Michigan v. Bay Mills Indian
   Community*, 572 U.S. 782 (2014), observed that states can bargain for
   waivers and remedies in compacts.[^bay-mills] *Seneca Nation of Indians v.
   New York* (2d Cir. 2021) confirmed an award made under a compact's own
   arbitration clause.[^seneca]

## Revenue sharing as the main subject of dispute

Interior presumes that a payment to the state beyond the cost of regulation is
a tax, fee or assessment the Act forbids, unless the state gives "meaningful
concessions" of "substantial economic benefit," usually exclusivity; the 2024
rule revising part 293 put that test in regulation.[^part-293-rule][^section-293-27]
The Ninth Circuit held California bargained in bad faith by demanding
general-fund revenue sharing (*Rincon*, 2010) and by insisting on terms far
outside the Act's list of subjects (*Chicken Ranch*, 2022), after upholding
the Revenue Sharing Trust Fund in 2003 because exclusivity was a real
concession.[^rincon][^chicken-ranch][^coyote-valley] Interior applied the
same test when it disapproved a 2022 compact that required payments to local
governments and when it found twenty years of exclusivity a meaningful
concession for the Pokagon Band's 2020 Indiana compact.[^middletown][^pokagon]

## Who negotiates for the state

Statutes found for 17 states split three ways (project analysis of the
context file; several are `title-only` and need a check):[^context]

| Pattern | States found |
| --- | --- |
| Governor (or a state agency) signs without the legislature | Nebraska, North Carolina, North Dakota (after sending it to legislators 21 days ahead), South Dakota (after public hearings), Washington (Gambling Commission negotiates, Governor executes), Wisconsin, Iowa (agency director) |
| Legislature must ratify or approve | California, Connecticut (deemed approved by the General Assembly), Florida, Indiana, Kansas, Massachusetts, New Mexico, New York (certification) |
| A statute sets the compact's terms | Arizona (standard form compact), Oklahoma (State-Tribal Gaming Act model compact) |

Oklahoma's 2020 dispute shows what follows when the two views collide: a
federal court held the model compacts renewed automatically, and the state
supreme court held compacts the Governor signed alone invalid under state law
although Interior had let them take effect.[^stitt][^treat]

## Current talks (as of November 2026)

From the context file, mostly news and agency pages:[^context]

- **New compacts and renewals**: California's 2026 compacts (Yurok, Fort
  Mojave; Pinoleville's amendment dropping the trust fund payment), Montana
  and the Confederated Salish and Kootenai Tribes (deemed approved January
  2026), Seneca Nation and New York (extensions since 2023; the Nation says a
  compact is agreed in principle, the Governor's office says not), and North
  Dakota's 2022 compacts.
- **Sports betting and online gaming** drive most current amendments:
  Kansas and Washington compact amendments, Arizona's 2021 compacts, Wisconsin's 2026 law
  that requires the state to negotiate online wagering, and stalled bills in
  Minnesota and Oklahoma.
- **Disputes**: the Southern Ute Indian Tribe's good-faith suit against Colorado's
  Governor (news reports say a federal court ruled for the state in October
  2025 and the nations said they would appeal) and Alaska's refusal to negotiate any Class III compact.

## Compact clauses

Small-model reviewers summarized the clauses of 526 governing documents
(for each nation and state, the latest full compact, the amendments after it
and any Secretarial Procedures) from excerpts a script cut out under matching
headings. A larger model then read the whole text of 116: the 86 full
compacts and procedures whose dispute clause the first pass could not find,
and a random 30 of the rest as an audit. A script found 1,451 of the 1,453
quotations in the final file word for word in the extracted text; the two it
did not find are marked `quote_found: false`.[^clauses]

The reviewers judged 247 documents to be full compacts, 243 amendments and 23
Secretarial Procedures. Among the 247 full compacts (counts from the
reviewers' answers, so leads only):[^clauses]

- **233 have a dispute resolution clause.** The steps named most often are
  written notice (185), arbitration (164), federal court (154), a meeting or
  meet-and-confer (146), negotiation (73), state court (72) and mediation
  (20). 72 make arbitration binding, 98 do not, and 77 do not say.
- **Arbitration is the norm in some states and absent in others**: every
  Michigan, Oregon, Kansas, Iowa and Idaho compact read names it, as do most
  in California, Oklahoma and New Mexico, while none read in Montana,
  Nevada, Minnesota or North Carolina does (project analysis of the
  reviewers' step lists).
- **225 have a renegotiation or amendment clause** (triggers such as a change
  in federal or state law, new games, or a set reopener date), **198 a term
  clause** (25 and 20 years are most common; 90 renew automatically) and
  **159 a revenue sharing clause**.
- The 15 sets of Secretarial Procedures from 2024 and 2025 that the second
  pass read have no government-to-government dispute clause; they address patron and employee disputes only, because
  the state is not a party.

The audit shows how far the first pass can be trusted: of 30 dispute clause
summaries, 21 were right, 9 partly right and none wrong; of term summaries, 3
were wrong; and the first pass missed revenue sharing in 15 of the 30 and
immunity in 13, because those sections often sit under headings the script
did not look for.[^clauses] Missing revenue sharing or immunity in a first-pass
row therefore means "not found," not "none."

446 of the 526 rows concern a nation and state that the data gap review
(pull request #33) also covered. Those rows give that review's item numbers
so the two can be read side by side; this file does not change or decide any
of its verdicts.

## Secretarial Procedures in practice

The list holds 28 documents of Secretarial Procedures for 21 nations in
three states, and the texts and the Federal Register name four more amendments the list does not
post.[^procedures] Every California set (Rincon 2013 through the four sets of
July 8, 2025) and the three Northern Arapaho sets came through the
court-and-mediator route of § 2710(d)(7)(B)(vii), not through part 291; so
did the Mashantucket Pequot procedures of 1991.[^procedures] Part 291 itself
was used once to the point of an eligibility finding (Pueblo of Pojoaque),
and the Tenth Circuit held it invalid in that case; it has not been amended
since 1999, and no proposal to rescind it was found in the Federal
Register.[^part-291-history]

The California sets fall into three groups (project analysis of the
procedures file): the 2013 to 2018 sets let the State opt in to regulate,
send Tribe-State disputes to arbitration and court, require payments to the
Special Distribution Fund, run for fixed terms and give way to any later
compact; the 2024 sets give the State no role, leave regulation to the
National Indian Gaming Commission, have no fixed term, require only Revenue
Sharing Trust Fund payments and still give way to a compact; and the July
2025 sets keep that structure, with lighter or no payments and no clause
found that lets a compact replace them.[^procedures] Only the Mashantucket
procedures and their amendments have Federal Register notices; the
California and Wyoming sets were issued by letter.[^procedures]

## How dispute clauses changed between versions

Every document on the list is now a version in a document history (336
records: 315 compacts, among them 12 Oklahoma off-track wagering compacts
and 22 Minnesota blackjack or video games of chance compacts that the list
files under the nation's general title, and 21 sets of Secretarial
Procedures), each version with a source record of its own file.[^histories]
253 histories have more than one version; the longest has 32.

Of the 1,197 versions, 833 amend, extend, replace or restate an earlier
one. For dispute resolution between the nation and the state, 417
comparisons settled the question: 233 unchanged, 172 changed, 6 reworded, 3
renumbered, 2 removed and 1 added; 372 were not compared (the 120 extensions,
and pairs whose excerpts did not show both clauses).[^histories] Replacements
and restatements usually changed the clause (91 of 109 settled), and
amendments usually left it alone (222 of 308) (project analysis of the same
records). In an audit of 30 small-model comparisons, "unchanged" calls were
reliable (15 of 16 right) and every "added" call was wrong; a larger model
then reread all 216 "added", "changed" and "removed" calls on the full texts,
agreeing with 90, partly with 52 and not with 74. Most of the first pass's
"added" calls were changes to a clause the earlier compact already had, such
as an appendix with its own meeting step. Reviewers differed on whether an
appendix that only routes its disputes to the compact's existing clause
changes it; those calls are split between "changed" and "unchanged".
Renegotiation clause changes had no second pass.

Thirteen profile facts cite a compact version that a later version
superseded: eleven Wisconsin nations' `gaming.compacts` facts cite the
Menominee Indian Tribe's 1992 compact, and two North Carolina facts cite the
Catawba Indian Nation's 2021 compact (record lint, `superseded-citation`).
The profiles were not changed; the decision belongs with the data gap
review's compact clause items.

## For the model code (project analysis)

- Compacts already contain a layered dispute process (notice, meeting,
  negotiation, then arbitration or court), so a Tribal code provision on
  intergovernmental agreements can borrow their sequence and must sit
  alongside it.
- After *Seminole Tribe*, consent in the compact is what makes any remedy
  work, so a model provision on negotiation should say how the nation's
  negotiators get authority and how a waiver of immunity is limited.
- Revenue sharing, exclusivity and renewal are the recurring subjects of
  talks; a negotiation chapter could treat them as examples without taking a
  side.

## Limits

- Every clause summary is AI-written and is a lead, not a finding. Quotations
  were checked against the extracted text by a script.
- Context facts marked `title-only` rest on a summary of the page, not the
  passage itself. Cases need KeyCite; they are in the project's Westlaw list.
- The Office of Indian Gaming list does not show whether a compact is still
  in force.

[^compacts]: [`research/gaming/compact-documents.json`](../gaming/compact-documents.json), built from the Office of Indian Gaming list (source `office-of-indian-gaming-compacts-list-2026`).
[^notices]: [`research/gaming/federal-register-notices.json`](../gaming/federal-register-notices.json); records `federal-register-<document number>`.
[^ordinances]: [`research/gaming/ordinance-documents.json`](../gaming/ordinance-documents.json), from source `nigc-gaming-ordinances-table-2026`.
[^context]: [`research/gaming/compact-context.json`](../gaming/compact-context.json).
[^usc-2710]: 25 U.S.C. § 2710(d)(3), (7), (8) (source `usc-25-2710`).
[^seminole]: Seminole Tribe of Fla. v. Florida, 517 U.S. 44 (1996) (source `seminole-tribe-v-florida-1996`).
[^procedure-letters]: Interior letters issuing Secretarial Procedures, Feb. 8, 2013 (Rincon) through July 8, 2025 (Pauma), context facts `litigation-020` to `litigation-026`.
[^chicken-ranch]: Chicken Ranch Rancheria of Me-Wuk Indians v. California, 42 F.4th 1024 (9th Cir. 2022) (source `chicken-ranch-rancheria-of-me-wuk-indians-v-california-2022`).
[^part-291-rule]: Class III Gaming Procedures, 64 Fed. Reg. 17535 (Apr. 12, 1999) (source `federal-register-99-8910`).
[^texas]: Texas v. United States, 497 F.3d 491 (5th Cir. 2007) (source `texas-v-united-states-2007`).
[^new-mexico]: New Mexico v. Dep't of the Interior, Nos. 14-2219 & 14-2222 (10th Cir. Apr. 21, 2017) (source `new-mexico-v-department-of-the-interior-2017`; reporter citation to be confirmed).
[^part-291]: 25 C.F.R. pt. 291 (2026) (source `cfr-25-part-291`).
[^bay-mills]: Michigan v. Bay Mills Indian Cmty., 572 U.S. 782 (2014) (source `michigan-v-bay-mills-indian-community`).
[^seneca]: Seneca Nation of Indians v. New York, No. 19-4022 (2d Cir. Feb. 22, 2021) (source `seneca-nation-of-indians-v-new-york-2021`).
[^part-293-rule]: Class III Tribal State Gaming Compacts, 89 Fed. Reg. 13232 (Feb. 21, 2024) (source `federal-register-2024-03456`).
[^section-293-27]: 25 C.F.R. § 293.27 (2026) (source `cfr-25-293-27`).
[^rincon]: Rincon Band of Luiseno Mission Indians v. Schwarzenegger, 602 F.3d 1019 (9th Cir. 2010) (source `rincon-band-of-luiseno-mission-indians-of-the-rincon-reservation-v-schwarzenegger-2010`).
[^coyote-valley]: In re Indian Gaming Related Cases, 331 F.3d 1094 (9th Cir. 2003) (source `in-re-indian-gaming-related-cases-2003`; holding seen only in an excerpt).
[^middletown]: Letter from the Secretary of the Interior to the Middletown Rancheria of Pomo Indians (July 22, 2022), context fact `litigation-057`.
[^pokagon]: Interior's review of the 2020 Pokagon Band compact, context facts `negotiations-a-m` for Indiana.
[^stitt]: Cherokee Nation v. Stitt, No. CIV-19-1198-D (W.D. Okla. July 28, 2020) (source `cherokee-nation-v-stitt-2020`).
[^clauses]: [`research/gaming/compact-clauses.json`](../gaming/compact-clauses.json); reviewer briefs in [`research/gaming/briefs/`](../gaming/briefs/).
[^procedures]: [`research/gaming/secretarial-procedures.csv`](../gaming/secretarial-procedures.csv), from the issuing letters and procedures on the list (source `office-of-indian-gaming-compacts-list-2026`) and 84 Fed. Reg. 11122 (Mar. 25, 2019) and 86 Fed. Reg. 53340 (Sept. 27, 2021) (sources `federal-register-2019-05683`, `federal-register-2021-20933`).
[^part-291-history]: [`research/gaming/part-291-history.csv`](../gaming/part-291-history.csv): 61 Fed. Reg. 21394 (May 10, 1996) through 64 Fed. Reg. 17535 (Apr. 12, 1999) and the two appellate decisions (sources `federal-register-96-11287`, `federal-register-99-8910`, `texas-v-united-states-2007`, `new-mexico-v-department-of-the-interior-2017`).
[^histories]: `content/documents/` (records found in session `2026-11-21-gaming-compact-histories`) and [`research/gaming/compact-history-versions.csv`](../gaming/compact-history-versions.csv); comparisons by reviewers under the briefs in [`research/gaming/briefs/`](../gaming/briefs/).
[^treat]: Treat v. Stitt, 2021 OK 3 (source `treat-v-stitt-2021`; holding seen only in an excerpt).
