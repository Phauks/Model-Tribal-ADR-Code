# Provision pre-review

**Status:** pre-review findings, written Nov. 21, 2026, for the lead author,
Trevor Goldsmith, to accept, change or reject. Nothing here changes a profile,
and no verdict is a finding about any nation's law or practice. Every verdict
says what the cited source shows about one provision record. Changes the lead
author approves will be made in a separate pull request.

Every count comes from
[`2026-11-21-provision-pre-review-counts.json`](2026-11-21-provision-pre-review-counts.json),
written by [`scripts/review/provision_pre_review.py`](../../scripts/review/provision_pre_review.py)
from the verdicts in
[`2026-11-21-provision-pre-review.json`](2026-11-21-provision-pre-review.json).
The same verdicts are in
[`2026-11-21-provision-pre-review.csv`](2026-11-21-provision-pre-review.csv),
which has an empty `lead_author_decision` column for the review. Interpretation
is labeled as project analysis.

## Lead author's decision

On Nov. 22, 2026 the lead author accepted these recommendations and kept diversion to a consensual process and restorative justice in scope. The `lead_author_decision` column of the JSON and CSV files gives each record's outcome ([decision record 0027](../../docs/decisions/0027-diversion-and-restorative-justice-in-the-research-base.md)).

## Why this review

The provisional analysis of dispute resolution practice (pull request #10)
found that 938 of the 1,327 provision records are bulk imports from the
National Center on Restorative Justice database, 291 rest on section titles
alone, and only 98 come from text a research session read. Its review queue
asked for the bulk and title-only records to be checked one by one, for
duplicates to be merged, and for a decision on whether diversion and
restorative sentencing belong in a dispute resolution code.[^analysis][^ncorj]
This pre-review does the checking so the lead author's review can start from
evidence instead of from the raw records.

## Method

1. **Sources fetched.** The script fetched every page and PDF that a provision
   cites as its link or locator: 1,358 addresses, of which 1,279 returned
   (62 refused automated access, 12 were not found, 5 failed). All 938
   database pages returned. PDFs were converted to text.[^counts-fetch]
2. **Evidence matched.** For each record, the script found the passage of the
   cited text nearest the record's title or section number and kept it with
   the database's own quotation, if any. It also flagged likely duplicates
   within each profile by title, citation or page.
3. **First pass.** Twenty-nine automated reviewers, AI assistants working in
   parallel, each read one batch of about 45 records (all of a nation's
   records in one batch) and answered the questions in the
   [first-pass brief](briefs/2026-11-21-provision-pre-review-first-pass.md):
   does the provision exist in the source, is the record accurate, is it a
   dispute resolution provision, is it a duplicate, which method does it map
   to, and what should happen to it, with a confidence level and a quotation.
   They worked only from the fetched evidence.
4. **Second pass.** A more capable assistant re-checked the 114 hardest cases
   under the [second-pass brief](briefs/2026-11-21-provision-pre-review-second-pass.md):
   every record the first pass could not verify or rated low confidence, every
   "not found," and every proposed drop of a record already labeled with a
   dispute resolution kind or whose title names a process. It could search the
   full fetched text and fetch a source again. The second pass changed 53 of
   the 114 verdicts.[^counts-second]
5. **Checks.** Every verdict file was checked for one verdict per record,
   allowed values, and duplicate references that resolve within the same
   profile. No duplicate points to another duplicate. A sample of first-pass
   "drop" verdicts was read against the evidence by the lead session (project
   analysis).

### What "dispute resolution provision" meant

The brief used a working test, not a decision on scope (project choice, for
this review only). A provision counted as dispute resolution when it creates,
governs, refers matters to, or enforces the result of a process that resolves a
dispute by agreement or by a neutral other than ordinary trial: negotiation,
mediation, arbitration (including award enforcement and immunity waivers for
arbitration), peacemaking, circles and family group conferences that decide a
matter, settlement conferences, elders' councils and traditional forums, and
ombuds. Diversion or restorative sentencing that sends a case into a
consensual or community process was marked **borderline**, and left to the
lead author. Diversion to treatment, probation or services, ordinary court
procedure, and sentencing options were marked **not** dispute resolution.

Peacemaking was mapped to the `peacemaking` method and kept as its own track,
not described as alternative dispute resolution.[^charter-3]

## Results

| Suggested action | Records | What it means |
| --- | ---: | --- |
| drop-candidate | 671 | Not dispute resolution under the working test, or not in the source |
| merge-duplicate | 180 | Same provision as another record in the profile (`duplicate_of`) |
| scope-question | 161 | Borderline: diversion or restorative sentencing into a consensual or community process |
| keep | 145 | Exists, accurate enough, dispute resolution, right kind |
| keep-relabel | 129 | Keep, but change the kind, title or citation as noted |
| check-source | 41 | The source text could not be reached or read; no call made |

Source: counts file.[^counts]

By evidence tier, the picture splits:[^counts]

| Tier | Records | keep or keep-relabel | scope-question | merge-duplicate | drop-candidate | check-source |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Bulk database record | 938 | 107 | 150 | 22 | 657 | 2 |
| Section title only | 291 | 117 | 7 | 128 | 8 | 31 |
| Text read | 98 | 50 | 4 | 30 | 6 | 8 |

In the project's view, three things follow:

- **The bulk records are mostly outside dispute resolution.** Of 938, 657 are
  drop-candidates: treatment and wellness courts, court-ordered services,
  probation, dispositions and sentencing options. Another 150 are scope
  questions, chiefly informal adjustment conferences, family conferences and
  peacemaker referrals inside juvenile, child welfare or criminal cases. Only
  107 look like dispute resolution provisions on their own terms.
- **The title-only records are mostly real but duplicated.** 128 of 291 repeat
  another record, usually the same table of contents read twice under two
  source keys (review queue item 3 of the analysis estimated 71 repeated
  titles; matching by section found more). Their keep verdicts are medium
  confidence at best, because only the title was seen.
- **After review, 99 of the 182 nations with a provision record keep at least
  one.** The rest have only drop-candidates, scope questions, duplicates or
  unverified records.[^counts]

Of the 647 provisions judged dispute resolution or borderline, the closest
methods are peacemaking (209), arbitration (86), mediation (71),
family group conference (30), settlement conference (18), conciliation (15),
elders' council (12) and administrative adjudication (12); 171 fit no listed
method, often because only a title was seen.[^counts][^methods]

### The scope decision

The 161 scope questions are the decision the analysis flagged: whether the
code covers diversion and restorative sentencing when the matter goes to a
consensual process. By category: 121 diversion into a consensual process
(conferences, peacemaker referrals, community accountability boards), 23
restorative sentencing (sentencing circles, peacemaker input at disposition),
and 17 others close to that line.[^counts] Filtering the spreadsheet on
`verdict` = `scope-question` and `practice_category` gives the list. A
nation's own use of these processes is described by its code; whether the
model code addresses them is a drafting choice (project analysis).

## Reliability and limits

- **Automated pre-review, not review.** The verdicts were written by AI
  assistants from fetched text. They are a starting point for the lead
  author's review, which is still required before any record is changed or
  relied on.
- **The second pass changed nearly half of the hard cases.** Of 114 records
  re-checked, 53 changed verdict: 47 records the first pass could not verify
  were resolved once the full text was searched or refetched (18 keep, 9
  keep-relabel, 10 scope-question, 10 drop-candidate), and 5 of the 26 proposed drops sent for a second look were reversed (one more became check-source). One
  first-pass search missed a rule that was in the fetched text (Little
  Traverse Bay Bands Rule XXIX). Treat first-pass verdicts, especially
  title-only "keep" calls, as leads.[^counts-second]
- **Existence of bulk records mostly rests on the database's quotation.** Many
  bulk records link to a court home page or whole-code index, or to a site
  that refused automated access, so the reviewers confirmed the section from
  the database's quoted text rather than from the nation's own document. Each
  such record says so in `accuracy_issues`. 781 records are marked `partly`
  accurate, mostly for this reason or because the title is the database's
  paraphrase.[^counts]
- **Database titles often misdescribe the section.** Thirty-six records are
  marked inaccurate; Appendix B lists them. Typical problems are a title that
  names a treatment program for a penalty section, a truncated citation, or a
  section number that disagrees with the code's table of contents.
- **Some sources could not be read at all.** Forty-one records stay
  check-source (Appendix A): scanned PDFs without a text layer, code hosts that
  refuse automated access, and NILL pages that return "not found."
- **Some second-pass quotations are transcriptions.** Where a PDF was a page
  image, the second-pass reviewer transcribed the passage; those quotations
  were not machine-checked against a text layer.
- **Versions.** The code versions fetched in November 2026 may differ from the
  version a record was taken from; the reviewers noted several renumberings
  (for example Nisqually Title 50 and Mississippi Band of Choctaw Indians
  Title 11).
- **Nations have not been consulted.** As with every profile, nothing here has
  been sent to the nations, and no nation is used as an example before
  consultation.[^charter-4]

## Reviewer notes worth a look

These came from the reviewers' reports and are not all captured in a single
field. Each is a lead to check, not a finding.

- **Duplicates kept in the wrong direction.** Klamath Tribes #5 quotes the Chapter 18 text but was marked the duplicate of #0, which was confirmed only from a table of contents;
  Kiowa Tribe #1 has the purpose clause but was marked the duplicate of #0.
  The lead author may prefer to keep the fuller record.
- **Records to split or narrow.** Confederated Tribes of the Coos, Lower Umpqua and Siuslaw Indians #15 joins
  Chapter 2-3 (Arbitration) and Chapter 2-14 (Peacegiving Court) under one
  citation. Squaxin Island #11 lists the 4.52 Arbitration Code inside a run of
  table of contents entries. Alabama-Coushatta #1 is the whole constitution;
  the Peacemaker Court is Article XIII, § 3(c).
- **Section numbers to correct.** Oneida Nation #14 cites "Rule 1.10" for
  8 O.C. 801.6; Oneida Indian Nation #2 and #5 swap Rules 803 and 804; Osage
  Nation #5 and #9 cite 1-123 and 1-135 for text numbered 2-123 and 2-135;
  Seminole Nation of Oklahoma #3 cites section 809 where the table of
  contents shows 810; Red Cliff #16 cites 17.12 for 17.11; Pascua Yaqui #12
  points to the custody chapter for a conciliation division at 5 PYTC
  §§ 2-260 to 2-290; Minnesota Chippewa Tribe #10 and Mississippi Band of
  Choctaw Indians #14 disagree with the National Indian Law Library table of
  contents.
- **Mediation bars are dispute resolution.** Several codes prohibit court-
  ordered mediation in domestic violence cases (for example Omaha, Ponca
  Tribe of Indians of Oklahoma, Dry Creek Rancheria, Chitimacha). The
  reviewers kept these as dispute resolution provisions, since a limit on a
  process matters to drafting (project analysis).
- **Possible elders' councils marked as drops.** Lummi #5 (Grandparents
  Committee) and Minnesota Chippewa Tribe #5 (court taking elders' advice)
  may deserve a second look as elders' council records.
- **Kind labels outside the schema list.** Some records use
  `traditional-dispute-resolution`, which the schema's suggested kinds do not
  include; the reviewers suggested a listed kind for each.[^schema]
- **Tier labels.** A few records counted as "text read" by the analysis rest
  only on a NARF description or a search title (for example Tulalip #0,
  Skokomish #7, Snoqualmie #1), because the tier comes from the record's note.

## How to use this

1. Open the spreadsheet and sort by `verdict`.
2. Decide the scope question once, for the 161 records in that group, by
   `practice_category`.
3. Accept or reject the duplicates (`duplicate_of`) and drop-candidates in
   bulk where the reasons hold, reading the quotations for any that look
   wrong.
4. Fill in `lead_author_decision`. A follow-up pull request can then apply the
   decisions to the profiles and record how each surviving provision was
   verified.

## Appendix

The tables below are generated from the JSON file; reasons are shortened.

### A. Records the reviewers could not verify (check-source)

| Record | Title | Why |
| --- | --- | --- |
| `cherokee-nation#8` | ARBITRATORS | A heading for arbitrators in the court rules, followed by a rule on workers’ compensation disputes. Whether it sets an arbitration process was not seen. |
| `colorado-river-indian-tribes-of-the-colorado-river-indian-reservation#1` | Diversion for Child Offenders | The section lets a probation officer condition release on completing a Diversion Program and dismiss the case if it is completed. The quoted text does not say … |
| `confederated-tribes-of-the-chehalis-reservation#5` | 15.01.210 Dispute resolution. | A section headed Dispute Resolution in the ordinance on general welfare benefits. The text was not read, so it is not clear whether it sets a process. |
| `confederated-tribes-of-the-colville-reservation#0` | Juveniles – Peacemaking Circle | Per NARF, juvenile offender and child-in-need-of-care cases are referred to a peacemaking circle, with notice, confidentiality and enforcement of the … |
| `confederated-tribes-of-the-grand-ronde-community-of-oregon#0` | Tribal Court Ordinance (peacemaking provisions) | Per NARF, Chapter 302 contains peacemaking provisions on purpose, authorization and qualifications. The text could not be read, so the content is unverified. |
| `confederated-tribes-of-the-umatilla-indian-reservation#8` | Section 7.06. Dispute Resolution Included in Plan | The title says a parenting plan includes a dispute resolution term, but the text was not obtainable (the CTUIR family law PDF was blocked), so the process … |
| `kalispel-indian-community-of-the-kalispel-reservation#7` | 23-9.03 Claimant Attorney’s Fees and Other Related Arbitration Costs | The table of contents lists this fee provision in the worker protection code's adjudication of disputes section, and its title mentions arbitration costs. … |
| `kickapoo-traditional-tribe-of-texas#17` | Section 11. Patron Dispute Resolution | A gaming ordinance section on patron disputes, probably a complaint process with the gaming operation or commission. The text was not available, so the form … |
| `klamath-tribes#7` | 36.11 Dispute Resolution. | A section titled Dispute Resolution in the Bond Ordinance. Without the text it is unclear whether it sets an arbitration, negotiation or other process. |
| `klamath-tribes#8` | 45.63 Dispute Resolution betwen Management Contractor or Tribes and … | A Gaming Ordinance section on resolving disputes between customers and the management contractor or the Tribes. The process it sets, if any, was not seen. |
| `lac-du-flambeau-band-of-lake-superior-chippewa-indians-of-the-lac-du-flambeau-reservation-of-wisconsin#2` | 43.417 Patron Dispute Resolution. | A gaming ordinance section on patron disputes. The process it sets was not seen. |
| `little-river-band-of-ottawa-indians#11` | Appendix 1 – Peacemaking Guidelines | The Juvenile Code and the tribal court page refer to the Odenaang Enjinoojimoying Peacemaking Guidelines as the governing document for peacemaking, but the … |
| `little-traverse-bay-bands-of-odawa-indians#7` | 7.412 PATRON DISPUTE RESOLUTION | A section of the gaming regulatory statute headed patron dispute resolution, probably a way for gaming patrons to raise complaints. Who decides and by what … |
| `mashantucket-pequot-indian-tribe#16` | 11. Arbitration | Section 11 of the Employee Review Code, between rulings and appeal, is titled Arbitration, so it probably provides arbitration of employee appeals. The text … |
| `menominee-indian-tribe-of-wisconsin#11` | Chapter 50 DISPUTE RESOLUTION | Chapter 50 is titled Dispute Resolution, but its listed sections cover housing partnership documents, enforcement of agreements and sovereign immunity. … |
| `minnesota-chippewa-tribe#2` | Cultural causes of action; panel of elders decisions | The summary describes a panel of elders' decision in a cultural cause of action entered by the court as a judgment, which would be a traditional forum. The … |
| `minnesota-chippewa-tribe#3` | Cultural actions | The summary describes a court cause of action for cultural harm with sanctions consistent with Band traditions, which reads as court procedure. The text could … |
| `minnesota-chippewa-tribe#25` | SECTION XLI PATRON DISPUTE RESOLUTION | The table of contents lists Section XLI, Patron Dispute Resolution, in the White Earth Gaming Ordinance. Whether it sets a neutral or agreed process, or only … |
| `mohegan-tribe-of-indians-of-connecticut#0` | Sec. 2-185. - Dispute Resolution. | A dispute resolution section inside the gaming revenue allocation plan, likely for disagreements over per capita distributions. The text could not be read, so … |
| `native-village-of-white-mountain#0` | Article 5. Court of Elders | The table of contents lists Article 5, Court of Elders, in the Children's Code. The page states the full text is not online, so the court's role in resolving … |
| `native-village-of-white-mountain#1` | Ordinance No. 87-03: Ordinance Establishing a Court of Elders | The table of contents lists Ordinance No. 87-03 establishing a Court of Elders. The text is not online, so the court's powers are unknown. |
| `northern-arapaho-tribe-of-the-wind-river-reservation#22` | DRAFT Title XVI: Peacemaker Court (Dated: June 20, 1989 | The index lists a draft peacemaker court title with chapters on requests for peacemaking, appointment of a peacemaker, and transfer of cases. The text is … |
| `oneida-indian-nation#6` | Sentencing Goal is to Restore the Victim and the Nation | The database lists Rule 702 of the Rules of Criminal Procedure as a sentencing goal of restoring the victim and the Nation. No text was shown, so it cannot be … |
| `poarch-band-of-creek-indians#9` | Sec. 41-1-9 Enforcement and Dispute Resolution | A section of the per capita payment ordinance headed Enforcement and Dispute Resolution. It could be an appeal or court route for payment disputes rather than … |
| `poarch-band-of-creek-indians#10` | Sec. 44-4-7 Dispute Resolution | A section headed Dispute Resolution in the Tribal Council service recognition benefit program. It likely covers disputes over benefits; the text was not read, … |
| `pueblo-of-isleta#0` | Resolution Establishing Pueblo of Isleta Peacemaking Program and … | The research summary describes a resolution making the Tribal Court peacemaking program permanent, with rules on referral, confidential sessions and binding … |
| `pueblo-of-laguna#10` | Section 14-1-9. – Dispute resolution. | The table of contents lists a Dispute Resolution section in the gaming control chapter, but I could not read it, so the process is unknown. |
| `pueblo-of-laguna#11` | Section 15. - Dispute Resolution. | The table of contents lists a Dispute Resolution section in a procurement policy appendix, but its text was not read, so the process is unknown. |
| `reno-sparks-indian-colony#4` | Arbitration. | A Tribal Court title section named Arbitration, placed among provisions on applicable law. Its content was not seen. |
| `rincon-band-of-luiseno-indians#3` | 6.1.61 Dispute Resolution of Violation of the Ordinance and/or … | The heading follows penalty, sanctions and garnishment sections, which suggests an administrative review of violations rather than a neutral process, but the … |
| `sauk-suiattle-indian-tribe#0` | 7.3 Dispute Resolution. | The table of contents lists 7.3 Dispute Resolution under the gaming ordinance's operation section. The content and type of process are not shown. |
| `skokomish-indian-tribe#9` | PATRON DISPUTE RESOLUTION | The table of contents lists 4.02.118 Patron Dispute Resolution in the gaming code. Whether it provides an agreed or neutral process cannot be judged from the … |
| `snoqualmie-indian-tribe#1` | Judiciary Act 3.1, Section 7.4 – Peacemaker Court | The record is titled Peacemaker Court, with a NARF note about authorization and appointment requirements. No text could be read to confirm Section 7.4. |
| `southern-ute-indian-tribe-of-the-southern-ute-reservation#4` | 11. Pre-Hearing, Scheduling or Settlement Conference; Stipulations. | A prehearing rule in the administrative appeals office that covers scheduling and settlement conferences. Whether it creates a real settlement conference … |
| `the-choctaw-nation-of-oklahoma#8` | Article XII. Oversight, Dispute Resolution, Enforcement | The article heading names dispute resolution among compact members under the commission's oversight. Its operative text was not available, so whether it … |
| `the-seminole-nation-of-oklahoma#3` | Section 809. Internal Dispute Resolution Policy | An employee policy section titled Internal Dispute Resolution Policy next to grievances. Whether it uses a neutral or consensual process is not shown. |
| `three-affiliated-tribes-of-the-fort-berthold-reservation#4` | Dispute resolution. | The arbitration headings concern disputes on highway department contracts and are a different source from the gaming ordinance and compact items called … |
| `tolowa-dee-ni-nation#0` | Diversion/mediation/family unity. | The heading names diversion, mediation and family unity in a child welfare code, but no text was found, so whether a consensual process is involved cannot be … |
| `tolowa-dee-ni-nation#1` | Diversion, mediation and family unit programs. | The heading lists diversion, mediation and family unit programs in the court ordinance; no text was found, so the process cannot be described. |
| `tulalip-tribes-of-washington#0` | Amendment to Tulalip Tribal Code 2.25, adding 2.25.200 enacting an … | Only the title of an alternative court code (adding 2.25.200) is known. Its contents are needed to tell whether it is a dispute resolution or treatment-court … |
| `yurok-tribe-of-the-yurok-reservation#5` | 9.20 Dispute Resolution | A gaming title section named Dispute Resolution; the process, such as a patron claim procedure or court appeal, was not seen. |

### B. Records whose title, citation or link does not match the source (accurate: no)

| Record | Title | Problem |
| --- | --- | --- |
| `assiniboine-and-sioux-tribes-of-the-fort-peck-indian-reservation#5` | Suspended Sentence for Endangering Unborn Child with Substance Abuse | The citation field reads only 'substance abuse.'. The excerpt cites Title 7, Chapter 2, Sec. 240-D(e). The link matched the title only. |
| `bad-river-band-of-the-lake-superior-tribe-of-chippewa-indians-of-the-bad-river-reservation#0` | Restorative Options for Dispositions in Child Welfare | The title 'Restorative Options for Dispositions' misdescribes the section, which lists court dispositions (counseling, restitution, community service, … |
| `grand-traverse-band-of-ottawa-and-chippewa-indians#1` | Alcohol or Substance Abuse Treatment Program | The title 'Alcohol or Substance Abuse Treatment Program' does not describe section 107, which is a list of offenses and penalties. A treatment order appears … |
| `grand-traverse-band-of-ottawa-and-chippewa-indians#12` | Treatment for Sustance Abuse by Pregnant Woman | The title 'Treatment for Sustance Abuse by Pregnant Woman' (typo: 'Sustance') does not describe section 110, which is the duties of protective services … |
| `hannahville-indian-community#1` | Alternative Sentencing for First Aggravated Domestic … | Title 'Alternative Sentencing' misdescribes the section, which sets incarceration, a fine and mandatory batterers' intervention and other programs as … |
| `hannahville-indian-community#2` | Alternative Sentencing for First Domestic Violence Offence | Title 'Alternative Sentencing' misdescribes the section, which sets penalties for a first domestic assault and a suspended or no-incarceration probation … |
| `ho-chunk-nation-of-wisconsin#3` | Domestic Abuse Treatment Program | Title 'Domestic Abuse Treatment Program' misdescribes the section, which requires the Domestic Abuse Division to maintain an annual prevention and … |
| `hoh-indian-tribe#1` | Deferred Prosecution for Treatment (Domestic Violence) | Title says 'Deferred Prosecution', but the text sets a court-ordered domestic violence treatment program after a guilty plea or conviction, with contempt for … |
| `lummi-tribe-of-the-lummi-reservation#1` | Declaration of Restorative Justice | The citation reads only 'Justice'; it should cite Title 5, Chapter 5.00, Section 5.00.005. The title matches the section heading. |
| `menominee-indian-tribe-of-wisconsin#2` | Expected Mother Treatment Programs for Ubstance Abuse | Title 'Expected Mother Treatment Programs for Ubstance Abuse' has a typo and does not describe section 278-44, which is headed 'Expectant mother/unborn child' … |
| `menominee-indian-tribe-of-wisconsin#5` | Informal Dispositions for Juveniles in Need of Protection | Title says informal dispositions, but the quoted text of section 278-48 is the preliminary assessment for a juvenile in need of protection. Section 278-49 is … |
| `menominee-indian-tribe-of-wisconsin#13` | Chapter 50 DISPUTE RESOLUTION | Same Chapter 50 heading as record #11, taken from a second source key. Record #11 is recommended as a drop-candidate, and this record should follow it. Title … |
| `miami-tribe-of-oklahoma#1` | Alternative Types of Hearings for Juvenile Cases | Title 'Alternative Types of Hearings for Juvenile Cases' does not describe section 106, which sets parent and guardian duties to attend hearings and bring the … |
| `minnesota-chippewa-tribe#11` | Family Services Treatment Plan for Parents | The title 'Family Services Treatment Plan for Parents' does not match the section, which is the Family Services Report; a treatment plan appears only as item … |
| `minnesota-chippewa-tribe#19` | Restorative Case Planning in Child Welfare | The title calls this 'Restorative Case Planning', but the section sets case plan tasks and services for reunification and describes no restorative process. … |
| `minnesota-chippewa-tribe#30` | PEACEMAKING CIRCLE. | The locator places the heading under Chapter VIII, Panel of Elders, but the table of contents in the link window lists 'chapter 12a. peacemaking circle' in … |
| `mississippi-band-of-choctaw-indians#15` | Treatment Program for Parole | The title says 'Parole', but the section governs suspended sentences and probation, and treatment is one of twelve possible conditions. Existence rests on the … |
| `mississippi-band-of-choctaw-indians#20` | § 11-4-14 Informal Hearing or Transfer to Peacemaker Court | The 2015 NILL heading used older numbering. In the current Title 11, section 11-4-14 is Modification of Dispositional Order, and child welfare matters under … |
| `northern-arapaho-tribe-of-the-wind-river-reservation#2` | Court Ordered Treatment for Offenses Against Persons | Title Court Ordered Treatment for Offenses Against Persons does not match the excerpt, which defines aggravated assault (Section 303) and sexual assault … |
| `northern-cheyenne-tribe-of-the-northern-cheyenne-indian-reservation#4` | Kings of Rehabilitative Punishment for Benefit of Tribe | Citation Civil Code Rule 33 does not match the excerpt, which is Rule 33 Kinds of Punishments; the code index lists civil procedure Rule 33 as harmless error. … |
| `northern-cheyenne-tribe-of-the-northern-cheyenne-indian-reservation#5` | Least Restrictive Treatment Program Approach | Citation says Civil Code Rule 2.1, but the excerpt is section 2.5 (Court Proceedings) of the civil commitment rules. Title describes only one subsection. … |
| `northern-cheyenne-tribe-of-the-northern-cheyenne-indian-reservation#6` | Rehabilitation for Substance Abuse | Citation 7-9-3 is Possession of liquor in the code index. The rehabilitation option is a discretionary sentence within that offense. Title Rehabilitation for … |
| `poarch-band-of-creek-indians#4` | DUI Court program / Drug Court Program | Title misdescribes the section: Sec. 8-8-1 defines drunk driving and sets penalties, and the DUI Court or drug court referral is one clause (f). Link returned … |
| `prairie-band-potawatomi-nation#4` | Sex Offender Treatment Program for Sentence Reduction | Title 'Sex Offender Treatment Program for Sentence Reduction' misdescribes Sec. 15-11-21, which sets registration frequency and reduction of registration … |
| `pueblo-of-laguna#1` | CONTENTS RESERVED | Placeholder: the database entry is a reserved part with no text; the link is a general codes page (Municode-hosted code not searchable here). |
| `pueblo-of-laguna#3` | Domestic Violence Counseling/Program | The title says counseling or program; the section is civil orders of protection. Existence rests on the NCORJ quotation; the link is a general page. |
| `pueblo-of-laguna#5` | Opportunity for Wellness Court Program | The title says Wellness Court program, but the shown text is the drunk-driving offense and its sentencing (15-14-16). Any wellness court provision would be in … |
| `pyramid-lake-paiute-tribe-of-the-pyramid-lake-reservation#2` | Treatment of Domestic Violence Cases | Title says treatment of domestic violence cases, but the shown text is the list of domestic violence crimes and their penalties (3.09.200). Link is a general … |
| `sac-and-fox-nation-of-missouri-in-kansas-and-nebraska#3` | Requirement for Sac and Fox Domestic Violence Offender’s Program | Title says this section requires a domestic violence offender's program, but the section is titled Required hearings; service; duty of court when order for … |
| `sac-and-fox-tribe-of-the-mississippi-in-iowa#0` | Condition for Participation in Wellness Court | Title 'Condition for Participation in Wellness Court' does not match the quoted text, which is Sec. 24-3102 on enforcement of and arrest for violation of an … |
| `skokomish-indian-tribe#10` | iii) Submit the dispute to mediation processes provided for under … | The citation field holds the clause text rather than a section number. The quoted clause sits in a self-governance compact with the federal government (near … |
| `squaxin-island-tribe-of-the-squaxin-island-reservation#11` | 4.04.140 Informal dispute resolution.) 4.08 Administrative Rules … | Title and citation are a run of table of contents entries (4.04.140, Administrative Rules, and the Arbitration Code 4.52), not one provision. The kind … |
| `swinomish-indian-tribal-community#11` | 7 - Arbitration of Disputes (4/5/05 | The citation merges two chapters from different titles: chapter 7 (arbitration, Title 3) and chapter 6 (court hearings and mediation, juveniles). The … |
| `the-choctaw-nation-of-oklahoma#14` | Former Judge or Arbitrator | Rule 1.12 is an attorney conduct rule in Appendix A, not a dispute resolution process; the arbitration kind came from the title word. |
| `the-muscogee-nation#8` | Required Rehabilitative Process in an Order for Protection | Citation gives Section 1-406, but the excerpt quotes Section 1-808, Order of protection. Title says Required Rehabilitative Process, but the text says the … |
| `the-osage-nation#1` | Committed to Treatment Facility | Title 'Committed to Treatment Facility' misdescribes the cited sections, which are 6 ONC § 5-136 (intoxication offense) and § 5-139 (abuse of psychotoxic … |

### C. Second-pass changes

| Record | First pass | Second pass | Note |
| --- | --- | --- | --- |
| `alabama-coushatta-tribe-of-texas#1` | check-source | keep-relabel | The first reviewer searched only the opening pages; searching the full text found Article XIII. I disagree with check-source and suggest narrowing the … |
| `confederated-tribes-of-siletz-indians-of-oregon#2` | drop-candidate | keep-relabel | Disagree with drop: the chapter does create mediators, confirmed by the 2025 Law Court ordinance. Section text still unread, so medium. |
| `confederated-tribes-of-the-coos-lower-umpqua-and-siuslaw-indians#15` | check-source | keep-relabel | Confirmed both chapters in the table of contents and read the Chapter 2-14 purpose and section list; the record needs splitting rather than a check-source. |
| `confederated-tribes-of-the-umatilla-indian-reservation#5` | check-source | drop-candidate | Read Section 2.05 in the CTUIR Elders Services Code (2009 version); it is an agency decision plus court appeal, so I disagree with check-source. |
| `confederated-tribes-of-the-umatilla-indian-reservation#6` | check-source | drop-candidate | Read Section 3.07 of the same code; same structure as 2.05, so I disagree with check-source. |
| `curyung-tribal-council#1` | check-source | scope-question | Found subsection K in the Curyung code PDF and the NCORJ page; it is a sentencing circle, so a scope question rather than check-source. |
| `dry-creek-rancheria-band-of-pomo-indians#1` | check-source | keep | Found the related consensual traditional-custom provisions in the Civil Procedure rules; could not find the G-1(d) wording, hence medium. |
| `ho-chunk-nation-of-wisconsin#12` | check-source | keep | Followed the table of contents link to the ordinance PDF and read it; this resolves the first reviewer's check-source. The listed duplicate #13 is outside … |
| `hopi-tribe-of-arizona#0` | check-source | keep | Found the reserved-powers list in the OCR text, which the first reviewer could not locate. |
| `jamestown-sklallam-tribe#1` | check-source | drop-candidate | Found 33.02.08(J) in the youth code PDF. It is a deferral with no dispute resolution process, so I read the PDF and could settle it, where the first reviewer … |
| `kickapoo-traditional-tribe-of-texas#7` | drop-candidate | scope-question | Read Section 4.64 in the code and the database page. The record's kind and title name the Peacemaker System, so it should go to the lead author as a scope … |
| `klamath-tribes#0` | check-source | keep | The NILL table of contents lists the chapter and its section titles; title evidence is enough for medium confidence that the provision exists and is … |
| `little-river-band-of-ottawa-indians#12` | check-source | keep-relabel | The first reviewer saw only the opening text; the code text has peacemaking sections (4.01(b), referrals). Relabel to the specific sections. |
| `little-traverse-bay-bands-of-odawa-indians#0` | check-source | keep | The cached PDF text does contain Rule XXIX Mnodaawin (the first reviewer's search missed it). The text matches the summary. |
| `mashantucket-pequot-indian-tribe#0` | check-source | keep-relabel | The local text file does contain Chapter 4 (Peacemakers Council) starting at about line 234, so the first review's no-match result was wrong; I read the … |
| `mashantucket-pequot-indian-tribe#12` | check-source | drop-candidate | First reviewer said check-source low; the table of contents places the section in Title 6 Ch. 4 divorce procedure, which points to ordinary court procedure. … |
| `mashantucket-pequot-indian-tribe#22` | check-source | scope-question | I fetched the 2009 Title 32 PDF (saved in second-downloads/s4) and read section 7. It is adjudication by a special master or board, not mediation or … |
| `match-e-be-nash-she-wish-band-of-pottawatomi#2` | check-source | scope-question | Read the NCORJ quotation: section 5.2-8(I) has an informal conference and consent-based written agreement, so a scope-question rather than check-source. |
| `menominee-indian-tribe-of-wisconsin#11` | drop-candidate | check-source | The headings alone neither show a dispute process nor rule one out, so I do not support a drop on this evidence. The duplicate candidate #13 is outside this … |
| `minnesota-chippewa-tribe#1` | check-source | keep | The PDF is a scan with no text layer; I downloaded it with a browser user agent and read the page image containing Rule 58. It matches the summary, so the … |
| `minnesota-chippewa-tribe#4` | check-source | scope-question | I downloaded the scanned code with a browser user agent and read Chapter VIII from the page images. First reviewer's check-source is resolved; I classify it … |
| `mississippi-band-of-choctaw-indians#16` | check-source | keep | Read Section 10 in the 1993 Federal Register compact text (the code index itself carries the same section list); it is a government-to-government dispute and … |
| `mississippi-band-of-choctaw-indians#19` | check-source | scope-question | Read current Title 11; found the Peacemaker transfer section with its consent terms, so a scope-question rather than check-source. |
| `mississippi-band-of-choctaw-indians#20` | check-source | drop-candidate | Searched current Title 11: no 11-4-14 informal hearing and an express bar on child welfare Peacemaker referral. Medium because an earlier version may have had … |
| `mohegan-tribe-of-indians-of-connecticut#1` | check-source | scope-question | Agree with borderline; I tried to find the text and could not, so confidence stays medium. Changed verdict to scope-question because the title names a claim … |
| `mohegan-tribe-of-indians-of-connecticut#2` | check-source | drop-candidate | Read the full Part IV listing in the table of contents; none of its sections is a dispute resolution process. The Elders' review procedure (Sec. 1-83 to 1-88) … |
| `nez-perce-tribe#4` | check-source | keep-relabel | Found the current-code counterpart, which the first reviewer lacked. Mapping from 6-2-23 to 6.20.017 is inferred from the title. |
| `nez-perce-tribe#5` | check-source | keep | Read the operative section in Title 9. Agree on content; I upgrade to keep because the text is now in hand. |
| `nez-perce-tribe#6` | check-source | keep | Read section 11-9-2 to 11-9-4 in Title 11; arbitration is the first-level appeal. Agree it belongs; the first reviewer lacked text. |
| `nisqually-indian-tribe#8` | check-source | keep | The first reviewer held it as check-source. The section is in a corporations chapter in the official table of contents and the title names arbitration … |
| `nisqually-indian-tribe#10` | check-source | scope-question | I read the same chapter in the Title 50 PDF (50.40, mediation of disputes). It is a real mediation inside a juvenile case, which the brief treats as … |
| `nisqually-indian-tribe#11` | drop-candidate | keep-relabel | The first reviewer proposed dropping it as a whole-code record. I read Title 50 and the NARF note matches Chapter 50.20, so I suggest relabeling; if the … |
| `oneida-indian-nation#0` | check-source | keep | The cached PDF text contains Article 8 verbatim; this settles existence and kind. |
| `oneida-indian-nation#7` | check-source | keep | Ordinances page lists Rules of Peacemaking and Article 8 of the court ordinance refers to them; rule text itself not read. |
| `oneida-nation#14` | check-source | keep-relabel | Read 801.6 in the PDF; the 'Rule 1.10' label does not match the text, so the citation should change to 8 O.C. 801.6 (Chapter 801 - Judiciary). |
| `oneida-nation#18` | check-source | keep-relabel | Found the heading three times under Title 7 in the table of contents, so existence is clear but the locator is ambiguous; relabel with a chapter number. Not a … |
| `organized-village-of-kake#5` | drop-candidate | scope-question | The NCORJ text puts the Peacemakers or a Circle in charge of orders, so a plain drop is not right; it is borderline restorative sentencing. |
| `organized-village-of-kake#9` | check-source | keep | Whole-code record; the code exists per the database quotation, though the NARF PDF returned page not found. |
| `pascua-yaqui-tribe-of-arizona#11` | check-source | keep | Read the section text. It is thin, but it is a dispute resolution provision; keep. |
| `pascua-yaqui-tribe-of-arizona#12` | check-source | keep-relabel | Read sections 260-290 and 360. The first reviewer suggested settlement-conference; mediation-program fits a court conciliation division better. |
| `pueblo-of-laguna#2` | check-source | scope-question | The first reviewer saw only 7-2-333; the database page also quotes 7-3-7, which has the family conference. I would flag it as a scope question rather than … |
| `pueblo-of-laguna#9` | check-source | keep-relabel | Found the operative text in the EPA copy; the first reviewer had only the title. Relabel as an intergovernmental water quality dispute referral. |
| `red-cliff-band-of-lake-superior-chippewa-indians-of-wisconsin#2` | check-source | scope-question | Fetched the Chapter 17 text (saved in second-downloads/s4) and read the dispute resolution section. It is a patron grievance and appeal process, so I changed … |
| `rincon-band-of-luiseno-indians#0` | check-source | keep | Read 2.107 in the Limited Waiver of Sovereign Immunity Ordinance; it names arbitration as a permitted forum, so it fits the arbitration-or-immunity category. |
| `sac-and-fox-tribe-of-the-mississippi-in-iowa#8` | check-source | drop-candidate | Read the full Title 5 contents: no mediation or peacemaking section appears, only the courts and a Community Panel. Medium because section text was not read. |
| `sokaogon-chippewa-community#1` | drop-candidate | keep-relabel | Read sections 1.1.8 to 1.1.12 in the PDF text. The chapter as a whole is governance, but it contains a full peacemaking court, so the record should be … |
| `southern-ute-indian-tribe-of-the-southern-ute-reservation#5` | check-source | scope-question | Read the Article III section list; it is a claim appeal sequence. Verdict changed to scope-question because the content (reconsideration, hearing) is now … |
| `stockbridge-munsee-community#1` | check-source | keep | Read the operative text in the cited PDF; it settles existence and kind. Noted a numbering ambiguity in the amendment history. |
| `the-chickasaw-nation#13` | check-source | keep | Read Section 6-101.37 in the Chickasaw Title 6 PDF; subsections H and I set court-appointed mediation. |
| `the-choctaw-nation-of-oklahoma#9` | check-source | keep | The first reviewer held it as check-source. The title names a mediation referral in an official code table of contents, which supports keep at medium; I could … |
| `the-muscogee-nation#2` | check-source | drop-candidate | Database page text was in the cache; the first reviewer called it not-checked. It shows a conditions-based deferral, so drop. |
| `the-muscogee-nation#4` | check-source | drop-candidate | Database page text was in the cache. Services only, so drop. |
| `winnemucca-indian-colony-of-nevada#0` | check-source | drop-candidate | Read the full quoted section; the deferral is to conditions and services, and plea bargaining is ordinary criminal procedure, so I would drop rather than keep … |

## References

[^analysis]: Project analysis, [*Documented dispute resolution practice: provisional analysis*](../analyses/2026-11-21-dispute-resolution-practice.md) (Nov. 21, 2026), summary and section 9 (review queue), merged in pull request #10.
[^ncorj]: National Center on Restorative Justice, *Restorative Justice Tribal Laws Database*, [ncorj.org/tribal-laws](https://ncorj.org/tribal-laws) (accessed Nov. 21, 2026). Source record: `national-center-on-restorative-justice-restorative-justice-tribal-laws-database`.
[^counts-fetch]: Fetch log of `provision_pre_review.py gather`, Nov. 21, 2026 (project analysis). The cache itself is not committed; re-running `gather` fetches the current versions.
[^counts]: [`2026-11-21-provision-pre-review-counts.json`](2026-11-21-provision-pre-review-counts.json) (project analysis).
[^counts-second]: Counts file, `second_pass_records` and `second_pass_agreed`, and Appendix C (project analysis).
[^methods]: Method records in [`content/methods/`](../../content/methods/), merged in pull request #5.
[^schema]: [schemas/tribe.schema.json](../../schemas/tribe.schema.json), `dispute_resolution.forums.kind` and `provisions.kind`.
[^charter-3]: [Charter, commitment 3](../../docs/charter.md#3-peacemaking-as-its-own-track).
[^charter-4]: [Charter, commitment 4](../../docs/charter.md#4-consultation-before-publication).
