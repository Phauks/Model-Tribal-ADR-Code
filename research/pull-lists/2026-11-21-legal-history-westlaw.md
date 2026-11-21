# Westlaw pull list: legal history and key cases

What to pull or check on Westlaw for the timeline
(`content/essays/i-legal-history-timeline.md`) and the case digest
(`content/essays/i-key-cases-digest.md`). Made on 2026-11-21 from the
research session `2026-11-21-legal-history-and-key-cases`.

## How to record a check

After a KeyCite check, fill the `citator` field of the source record named in
the first column, for example:

```yaml
citator:
  service: keycite
  result: no-negative-treatment   # or some-negative-treatment, overruled-or-repealed, not-applicable
  detail: Red flag on other grounds; see Strate (1997) for nonmember land.
  checked: 2026-12-01
```

Then remove the item from this list in the same pull request. Facts confirmed
on Westlaw that the source record lists as "Not yet verified" go in the
record's `notes`, and the methods log for that day says what was checked.

## 1. Items to confirm first

These are marked unverified in the source records, and the timeline or
digest relies on them.

- `johnson-v-mintosh`: Johnson v. M'Intosh, 21 U.S. (8 Wheat.) 543. Confirm: decided.
- `cherokee-nation-v-georgia`: Cherokee Nation v. Georgia, 30 U.S. (5 Pet.) 1. Confirm: decided, vote.
- `worcester-v-georgia`: Worcester v. Georgia, 31 U.S. (6 Pet.) 515. Confirm: decided, vote count.
- `elk-v-wilkins`: Elk v. Wilkins, 112 U.S. 94. Confirm: later_treatment.
- `lone-wolf-v-hitchcock`: Lone Wolf v. Hitchcock, 187 U.S. 553. Confirm: later_treatment (Weeks/Sioux Nation).
- `rice-v-cayetano`: Rice v. Cayetano, 528 U.S. 495. Confirm: vote description.
- `haaland-v-brackeen`: Haaland v. Brackeen, 599 U.S. 255. Confirm: nations.
- `john-v-baker`: John v. Baker, 982 P.2d 738 (Alaska 1999). Confirm: key_quotes, decided.
- `sokaogon-gaming-enterprise-corporation-v-tushie-montgomery-associates`: Sokaogon Gaming Enterprise Corp. v. Tushie-Montgomery Associates, Inc., 86 F.3d 656 (7th Cir. 1996). Confirm: decided, vote, holding, key_quotes.
- `smith-v-hopland-band-of-pomo-indians`: Smith v. Hopland Band of Pomo Indians, 95 Cal. App. 4th 1 (2002). Confirm: key_quotes.
- `national-american-indian-court-judges-association-indian-courts-and-the-future-1978`: Indian Courts and the Future: Report of the NAICJA Long Range Planning Project. Only the cover OCR was readable (107 pages, mostly image-only). Title, NAICJA, 1978 and Olney as director were read from the cover. The planner's name is garbled in OCR ('Gavld H. eetehcs') and is read as David H. Getches: unverified. No quotes taken.
- `wisconsin-statutes-806-245`: Wis. Stat. § 806.245, Indian tribal documents: full faith and credit. The page could not be fetched by curl. WebFetch returned only short fragments (the tool caps quote length), not conditions (a)–(e) or the history note. The date field (1991) is a placeholder: enactment year NOT verified. Treat as unverified until pulled on Westlaw.
- `arizona-rules-of-procedure-recognition-tribal-court-civil-judgments`: Arizona Rules of Procedure for the Recognition of Tribal Court Civil Judgments. Official rule text was not opened (azcourts.gov rules are hosted on a Westlaw-based viewer; an unofficial mirror was not used). Only the rule set's existence and title were confirmed. Adoption date unknown. The 'largest number of tribal courts' remark is general knowledge.
- `laurence-enforcement-of-judgments-across-reservation-boundaries-1990`: The Enforcement of Judgments across Indian Reservation Boundaries: Full Faith and Credit, Comity and the Indian Civil Rights Act. Not opened. The citation is verified only through footnote 81 of Laurence's own 2002 National AgLaw Center primer, which cites '69 ORE. L. REV. 589, 612-19 (1990)'. The primary URL is that primer, not the article.
- `clinton-tribal-courts-and-the-federal-union-1990`: Tribal Courts and the Federal Union. Not opened. The citation comes only from a footnote in the U.S. Commission on Civil Rights' 1991 report (scanned OCR reads 'Clinton, Tribal Courts and the Federal Union, 26 WIWAM!mE L. REv. 841, 92~935 (1990)'). Volume, first page and year are readable; the pinpoint is garbled.

## 2. KeyCite every case

Check each for negative treatment and later history. The last column is the
specific question to answer.

| Source record | Case | What to check |
| --- | --- | --- |
| `johnson-v-mintosh` | Johnson v. M'Intosh, 21 U.S. (8 Wheat.) 543 (1823) | Check KeyCite for negative treatment and for recent opinions criticizing the discovery doctrine (several separate writings discuss it). Confirm the decision date: the U.S. Reports margin note reads "March 10th," while many secondary sources give February 28, 1823. |
| `cherokee-nation-v-georgia` | Cherokee Nation v. Georgia, 30 U.S. (5 Pet.) 1 (1831) | Confirm decision date (March 18, 1831 is the commonly reported date; not printed in the text read). Confirm the vote line-up (Duvall, J., participation). |
| `worcester-v-georgia` | Worcester v. Georgia, 31 U.S. (6 Pet.) 515 (1832) | Check how Castro-Huerta (2022) characterizes Worcester; KeyCite will show heavy citing history. Confirm decision date (March 3, 1832, not printed in text read). |
| `ex-parte-crow-dog` | Ex parte Crow Dog, 109 U.S. 556 (1883) | Check KeyCite; note the Major Crimes Act (18 U.S.C. § 1153) as the congressional response. Parallel cites taken from the Tenth Circuit's footnote in Native American Church v. Navajo Tribal Council. |
| `elk-v-wilkins` | Elk v. Wilkins, 112 U.S. 94 (1884) | Check later treatment; the 1924 Act is the congressional response. |
| `united-states-v-kagama` | United States v. Kagama, 118 U.S. 375 (1886) | LII has no text for this case; use Westlaw for a clean text and check quotes against the official PDF. Confirm the later-treatment characterization of Brackeen. |
| `talton-v-mayes` | Talton v. Mayes, 163 U.S. 376 (1896) | Check KeyCite; ICRA (25 U.S.C. §§ 1301-1304) is the congressional response. |
| `lone-wolf-v-hitchcock` | Lone Wolf v. Hitchcock, 187 U.S. 553 (1903) | LII text unavailable. Use KeyCite to confirm how Sioux Nation (1980) and Weeks (1977) limited Lone Wolf, and whether any court has expressly "disavowed" it. |
| `united-states-v-winans` | United States v. Winans, 198 U.S. 371 (1905) | Note a text discrepancy: LII reads "a grant of right from them," the official U.S. Reports scan reads "a grant of rights from them." Quote from the official reporter. |
| `winters-v-united-states` | Winters v. United States, 207 U.S. 564 (1908) | Check KeyCite; see Arizona v. Navajo Nation (2023) for the current limits on enforcement through breach-of-trust claims. |
| `united-states-v-sandoval` | United States v. Sandoval, 231 U.S. 28 (1913) | Check KeyCite; confirm the parties (the indictment concerned liquor taken into Santa Clara and San Juan Pueblos per the opinion). |
| `tee-hit-ton-indians-v-united-states` | Tee-Hit-Ton Indians v. United States, 348 U.S. 272 (1955) | Check KeyCite for criticism; note relation to ANCSA. |
| `williams-v-lee` | Williams v. Lee, 358 U.S. 217 (1959) | Check KeyCite; parallel citations taken from Santa Clara Pueblo's citation of Williams. |
| `native-american-church-v-navajo-tribal-council` | Native American Church v. Navajo Tribal Council, 272 F.2d 131 (10th Cir. 1959) | Pull the F.2d pagination for pinpoints; KeyCite for later treatment after ICRA (1968). |
| `menominee-tribe-v-united-states` | Menominee Tribe of Indians v. United States, 391 U.S. 404 (1968) | Check KeyCite. LII text contains OCR errors in this passage ("way a abrogating"); quote from the official reporter. |
| `mcclanahan-v-arizona-state-tax-commission` | McClanahan v. State Tax Commission of Arizona, 411 U.S. 164 (1973) | Check KeyCite for later preemption cases. |
| `morton-v-mancari` | Morton v. Mancari, 417 U.S. 535 (1974) | KeyCite for recent equal-protection challenges citing Mancari, including the separate writings in Brackeen. |
| `fisher-v-district-court` | Fisher v. District Court, 424 U.S. 382 (1976) | Check KeyCite; confirm whether any Justice wrote separately (none shown in the text read). |
| `bryan-v-itasca-county` | Bryan v. Itasca County, 426 U.S. 373 (1976) | Check KeyCite. LII text has OCR errors ("tribal governes"); quote the official reporter. The second quote is the Court quoting earlier authority (the Indian canon); cite accordingly. |
| `oliphant-v-suquamish-indian-tribe` | Oliphant v. Suquamish Indian Tribe, 435 U.S. 191 (1978) | KeyCite will show the VAWA 2013/2022 response; confirm current 25 U.S.C. § 1304 text with the timeline. |
| `united-states-v-wheeler` | United States v. Wheeler, 435 U.S. 313 (1978) | Check KeyCite for Lara, Denezpi and Gamble v. United States (2019). |
| `santa-clara-pueblo-v-martinez` | Santa Clara Pueblo v. Martinez, 436 U.S. 49 (1978) | Check KeyCite; confirm footnote number for the membership quote (n.32 on the LII text). |
| `white-mountain-apache-tribe-v-bracker` | White Mountain Apache Tribe v. Bracker, 448 U.S. 136 (1980) | Check KeyCite, especially Castro-Huerta's use of Bracker. |
| `montana-v-united-states` | Montana v. United States, 450 U.S. 544 (1981) | Check KeyCite for the Montana-exception line of cases in the relevant circuit. |
| `merrion-v-jicarilla-apache-tribe` | Merrion v. Jicarilla Apache Tribe, 455 U.S. 130 (1982) | Check KeyCite; note Atkinson's limitation. |
| `national-farmers-union-insurance-companies-v-crow-tribe` | National Farmers Union Insurance Cos. v. Crow Tribe of Indians, 471 U.S. 845 (1985) | Check KeyCite for circuit exhaustion exceptions. The first quote is itself quoted language within the opinion (from earlier cases); cite as such. |
| `iowa-mutual-insurance-company-v-laplante` | Iowa Mutual Insurance Co. v. LaPlante, 480 U.S. 9 (1987) | Check KeyCite; parallel citations taken from the Ninth Circuit's AT&T opinion. |
| `california-v-cabazon-band-of-mission-indians` | California v. Cabazon Band of Mission Indians, 480 U.S. 202 (1987) | Check KeyCite; IGRA (25 U.S.C. § 2701 et seq.) is the congressional response. |
| `mississippi-band-of-choctaw-indians-v-holyfield` | Mississippi Band of Choctaw Indians v. Holyfield, 490 U.S. 30 (1989) | Check KeyCite; review post-Brackeen ICWA litigation. |
| `duro-v-reina` | Duro v. Reina, 495 U.S. 676 (1990) | KeyCite will show "superseded by statute"; confirm the current text of 25 U.S.C. § 1301(2). |
| `oklahoma-tax-commission-v-citizen-band-potawatomi-indian-tribe` | Oklahoma Tax Commission v. Citizen Band Potawatomi Indian Tribe of Oklahoma, 498 U.S. 505 (1991) | Check KeyCite. |
| `sokaogon-gaming-enterprise-corporation-v-tushie-montgomery-associates` | Sokaogon Gaming Enterprise Corp. v. Tushie-Montgomery Associates, Inc., 86 F.3d 656 (7th Cir. 1996) | Read in full on Westlaw: confirm decision date, panel, vote, holding and the quoted sentence and its page. |
| `seminole-tribe-v-florida-1996` | Seminole Tribe of Florida v. Florida, 517 U.S. 44 (1996) | Check KeyCite; 25 C.F.R. part 291 and its litigation history (timeline). |
| `strate-v-a-1-contractors` | Strate v. A-1 Contractors, 520 U.S. 438 (1997) | Check KeyCite for how circuits treat rights-of-way and the "plainly lacking" exhaustion exception. |
| `wilson-v-marchington-1997` | Wilson v. Marchington, 127 F.3d 805 (9th Cir. 1997) | Confirm F.3d pinpoints (the list of mandatory and discretionary grounds is cited at 810; the "necessary predicate" sentence at 811). KeyCite for circuit adoption elsewhere. |
| `alaska-v-native-village-of-venetie-tribal-government` | Alaska v. Native Village of Venetie Tribal Government, 522 U.S. 520 (1998) | Check KeyCite and later Alaska developments (e.g., trust land acquisitions in Alaska). |
| `kiowa-tribe-v-manufacturing-technologies` | Kiowa Tribe of Oklahoma v. Manufacturing Technologies, Inc., 523 U.S. 751 (1998) | Check KeyCite. |
| `val-u-construction-company-v-rosebud-sioux-tribe` | Val-U Construction Co. v. Rosebud Sioux Tribe, 146 F.3d 573 (8th Cir. 1998) | Read the earlier opinion, Rosebud Sioux Tribe v. Val-U Constr. Co., 50 F.3d 560 (8th Cir. 1995), which decided the waiver question; confirm pinpoints. KeyCite. |
| `john-v-baker` | John v. Baker, 982 P.2d 738 (Alaska 1999) | Pull the P.2d pinpoints for both holdings; confirm the decision date (Opinion No. 5174 is dated September 8, 1999 in the text read); KeyCite for John v. Baker II and later Alaska cases. |
| `rice-v-cayetano` | Rice v. Cayetano, 528 U.S. 495 (2000) | Check KeyCite and later OHA litigation (e.g., Davis v. Guam (9th Cir.) for territorial analogs). |
| `ninigret-development-corporation-v-narragansett-indian-wetuomuck-housing-authority` | Ninigret Development Corp. v. Narragansett Indian Wetuomuck Housing Authority, 207 F.3d 21 (1st Cir. 2000) | Confirm pinpoints; KeyCite for First Circuit and district court applications. |
| `teague-v-bad-river-band-2000` | Teague v. Bad River Band of the Lake Superior Tribe of Chippewa Indians, 2000 WI 79, 236 Wis. 2d 384, 612 N.W.2d 709 (2000) | Confirm parallel citations (236 Wis. 2d 384; 612 N.W.2d 709 verified via CourtListener citation lookup and the 2003 opinion). KeyCite; check Wisconsin's later discretionary-transfer rule (Wis. Stat. § 801.54) as a response. |
| `c-and-l-enterprises-v-citizen-band-potawatomi-2001` | C & L Enterprises, Inc. v. Citizen Band Potawatomi Indian Tribe of Oklahoma, 532 U.S. 411 (2001) | KeyCite later cases applying C & L to AAA clauses, "sue and be sued" clauses, and limited waivers; check whether the waiver reaches federal court enforcement under the FAA. |
| `atkinson-trading-company-v-shirley` | Atkinson Trading Co. v. Shirley, 532 U.S. 645 (2001) | Check KeyCite. The LII text renders the dashes in the first quote as hyphens; confirm em dashes against the official reporter. |
| `nevada-v-hicks` | Nevada v. Hicks, 533 U.S. 353 (2001) | Check KeyCite; review how circuits limit Hicks to state officers. |
| `bird-v-glacier-electric-cooperative` | Bird v. Glacier Electric Cooperative, Inc., 255 F.3d 1136 (9th Cir. 2001) | Confirm F.3d pinpoints and KeyCite for later reliance on Bird. |
| `smith-v-hopland-band-of-pomo-indians` | Smith v. Hopland Band of Pomo Indians, 95 Cal. App. 4th 1 (2002) | Confirm the quotes (read only through a tool summary), the footnote number, and whether the court's analysis relied on tribal council resolutions as well as the arbitration clause. KeyCite. |
| `att-corporation-v-coeur-dalene-tribe` | AT&T Corp. v. Coeur d'Alene Tribe, 295 F.3d 899 (9th Cir. 2002) | Confirm decision date conventions (opinion filed March 19, 2002; amended July 17, 2002 = 295 F.3d 899) and F.3d pinpoints. KeyCite. |
| `teague-v-bad-river-band-2003` | Teague v. Bad River Band of the Lake Superior Tribe of Chippewa Indians, 2003 WI 118, 265 Wis. 2d 64, 665 N.W.2d 899 (2003) | Because no rationale commanded a majority, check how later Wisconsin courts cite this case; confirm reporter citations (CourtListener citation lookup returned two Teague records for 265 Wis. 2d 64 / 665 N.W.2d 899). |
| `united-states-v-lara` | United States v. Lara, 541 U.S. 193 (2004) | Check KeyCite. |
| `plains-commerce-bank-v-long-family-land-and-cattle-company` | Plains Commerce Bank v. Long Family Land & Cattle Co., 554 U.S. 316 (2008) | The LII page for this case shows only the syllabus; read the full opinion on Westlaw. Check KeyCite for circuit treatment of "nexus" to consensual relationships. |
| `michigan-v-bay-mills-indian-community` | Michigan v. Bay Mills Indian Community, 572 U.S. 782 (2014) | Check KeyCite; review the footnote reserving tort-victim cases (n.8). |
| `united-states-v-bryant` | United States v. Bryant, 579 U.S. 140 (2016) | Check KeyCite. |
| `dollar-general-corporation-v-mississippi-band-of-choctaw-indians` | Dollar General Corp. v. Mississippi Band of Choctaw Indians, 579 U.S. 545 (2016) | Read the Fifth Circuit opinion (746 F.3d 167) and KeyCite it; an equally divided affirmance is not precedent. |
| `lewis-v-clarke` | Lewis v. Clarke, 581 U.S. 155 (2017) | Check KeyCite. |
| `mcgirt-v-oklahoma` | McGirt v. Oklahoma, 591 U.S. 894 (2020) | Check KeyCite; review Castro-Huerta and Oklahoma decisions applying McGirt to other reservations. |
| `united-states-v-cooley` | United States v. Cooley, 593 U.S. 345 (2021) | Check KeyCite. |
| `yellen-v-confederated-tribes-of-chehalis-reservation` | Yellen v. Confederated Tribes of the Chehalis Reservation, 594 U.S. 338 (2021) | Check KeyCite. |
| `denezpi-v-united-states` | Denezpi v. United States, 596 U.S. 591 (2022) | LII page for this case lists opinions separately; read the full opinion on Westlaw and confirm the quotation punctuation. |
| `ysleta-del-sur-pueblo-v-texas` | Ysleta del Sur Pueblo v. Texas, 596 U.S. 685 (2022) | Check KeyCite; follow remand proceedings in the Fifth Circuit. |
| `oklahoma-v-castro-huerta` | Oklahoma v. Castro-Huerta, 597 U.S. 629 (2022) | Check KeyCite; monitor later cases on state jurisdiction over Indian defendants. |
| `haaland-v-brackeen` | Haaland v. Brackeen, 599 U.S. 255 (2023) | Check KeyCite; equal-protection challenges remain possible in cases with proper standing. |
| `lac-du-flambeau-band-v-coughlin` | Lac du Flambeau Band of Lake Superior Chippewa Indians v. Coughlin, 599 U.S. 382 (2023) | Check KeyCite for application to other generic "government" abrogations. |
| `arizona-v-navajo-nation` | Arizona v. Navajo Nation, 599 U.S. 555 (2023) | Check KeyCite; follow Navajo water-rights settlement legislation (timeline). |
| `becerra-v-san-carlos-apache-tribe` | Becerra v. San Carlos Apache Tribe, 602 U.S. 222 (2024) | Check KeyCite; watch for IHS guidance and appropriations responses. |

## 3. Statutes, regulations and court rules

KeyCite each and confirm current text and history. Statutes cited only for
history (for example the 1790 and 1834 acts) need no KeyCite; they are
listed only where a note asks for something.

| Source record | Law | What to check |
| --- | --- | --- |
| `general-crimes-act-1817` | An Act to provide for the punishment of crimes and offences committed within the Indian boundaries (General Crimes Act of 1817) | KeyCite 18 U.S.C. § 1152 for current annotations. |
| `trade-and-intercourse-act-1834` | An Act to regulate trade and intercourse with the Indian tribes, and to preserve peace on the frontiers (Trade and Intercourse Act of 1834) | KeyCite 25 U.S.C. § 177. |
| `indian-appropriation-act-1871` | Indian Appropriation Act of March 3, 1871, treaty-making proviso (25 U.S.C. § 71) | KeyCite 25 U.S.C. § 71. |
| `major-crimes-act-1885` | Major Crimes Act (Indian Appropriation Act of March 3, 1885, § 9) | KeyCite 18 U.S.C. § 1153. |
| `indian-reorganization-act-1934` | Indian Reorganization Act (Wheeler-Howard Act) | KeyCite 25 U.S.C. §§ 5101, 5123. |
| `solicitor-opinion-powers-of-indian-tribes-1934` | Powers of Indian Tribes, 55 I.D. 14 (Op. Solicitor, Dep't of the Interior, Oct. 25, 1934) | Search Westlaw for '55 I.D. 14' to see citing references; the I.D. volumes may not be on Westlaw, so verify. |
| `alaska-indian-reorganization-act-amendment-1936` | Act of May 1, 1936 (Alaska IRA amendment) | KeyCite 25 U.S.C. § 5119. |
| `oklahoma-indian-welfare-act-1936` | Oklahoma Indian Welfare Act (Thomas-Rogers Act) | KeyCite 25 U.S.C. § 5203. |
| `indian-claims-commission-act-1946` | Indian Claims Commission Act | Pull 25 U.S.C. § 70 et seq. (omitted) historical notes on Westlaw. |
| `public-law-83-280` | Public Law 280 (Act of Aug. 15, 1953) | KeyCite 18 U.S.C. § 1162 and 28 U.S.C. § 1360. |
| `indian-civil-rights-act-1968` | Indian Civil Rights Act of 1968 (Civil Rights Act of 1968, titles II–VII) | KeyCite 25 U.S.C. §§ 1301–1304; judicial limits on remedies are in the case digest. |
| `indian-civil-rights-act-title-iv-tribal-consent-1968` | ICRA Title IV: tribal consent to state jurisdiction (25 U.S.C. §§ 1321–1326) | KeyCite 25 U.S.C. §§ 1321–1326. |
| `alaska-native-claims-settlement-act-1971` | Alaska Native Claims Settlement Act | KeyCite 43 U.S.C. § 1601 et seq. |
| `menominee-restoration-act-1973` | Menominee Restoration Act | KeyCite 25 U.S.C. § 903. |
| `indian-self-determination-and-education-assistance-act-1975` | Indian Self-Determination and Education Assistance Act | KeyCite 25 U.S.C. § 5301 et seq. |
| `indian-child-welfare-act-1978` | Indian Child Welfare Act of 1978 | KeyCite 25 U.S.C. §§ 1911, 1919; check 25 C.F.R. Part 23. |
| `american-indian-religious-freedom-act-1978` | American Indian Religious Freedom Act | KeyCite 42 U.S.C. § 1996. |
| `indian-gaming-regulatory-act-1988` | Indian Gaming Regulatory Act | KeyCite 25 U.S.C. § 2710; pull sample compact dispute-resolution clauses (NIGC/Interior compact library) separately. |
| `usc-25-5331` | ISDEAA § 110, Contract disputes and claims (25 U.S.C. § 5331) | KeyCite 25 U.S.C. § 5331 and 25 C.F.R. Part 900 subpart N (not opened). |
| `usc-25-5329-c-model-agreement-disputes` | ISDEAA § 108 model agreement, § 1(b)(12) 'Disputes' (25 U.S.C. § 5329(c)) | KeyCite 25 U.S.C. § 5329; check whether the 2020 amendments altered ¶ (12). |
| `usc-25-1301` | 'Duro fix' amending 25 U.S.C. § 1301(2) and adding § 1301(4) | KeyCite 25 U.S.C. § 1301; Duro v. Reina (1990) and United States v. Lara (2004) are in the case digest. |
| `indian-tribal-justice-act-1993` | Indian Tribal Justice Act | KeyCite 25 U.S.C. §§ 3601–3631. |
| `native-hawaiian-apology-resolution-1993` | Joint Resolution to acknowledge the 100th anniversary of the January 17, 1893 overthrow of the Kingdom of Hawaii (Apology Resolution) | KeyCite Pub. L. 103-150 for later treatment. |
| `tribal-self-governance-act-1994` | Tribal Self-Governance Act of 1994 (ISDEAA Title IV) | KeyCite 25 U.S.C. § 5361 et seq. and 25 C.F.R. Part 1000 (not opened). |
| `usc-25-5130` | Federally Recognized Indian Tribe List Act of 1994 | KeyCite 25 U.S.C. § 5131; pull the current Federal Register list. |
| `usc-18-2265` | Full faith and credit given to protection orders (18 U.S.C. § 2265) | KeyCite 18 U.S.C. § 2265. |
| `usc-28-1738b` | Full faith and credit for child support orders (28 U.S.C. § 1738B) | KeyCite 28 U.S.C. § 1738B. |
| `indian-tribal-justice-technical-and-legal-assistance-act-2000` | Indian Tribal Justice Technical and Legal Assistance Act of 2000 | KeyCite 25 U.S.C. §§ 3651–3682. |
| `tribal-law-and-order-act-2010` | Tribal Law and Order Act of 2010 | KeyCite 25 U.S.C. §§ 1302, 2801 et seq. |
| `violence-against-women-reauthorization-act-2013-title-ix` | Violence Against Women Reauthorization Act of 2013, Title IX (Safety for Indian Women), §§ 904–905 | KeyCite 25 U.S.C. § 1304 (current version reflects 2022 amendments). |
| `violence-against-women-act-reauthorization-act-2022-title-viii` | Violence Against Women Act Reauthorization Act of 2022, Title VIII (Safety for Indian Women) | KeyCite 25 U.S.C. §§ 1304, 1305 and the 2022 DOJ implementing materials (not opened). |
| `cfr-25-part-11-courts-of-indian-offenses` | 25 C.F.R. Part 11 — Courts of Indian Offenses and Law and Order Code | Pull 25 C.F.R. Part 11 on Westlaw for the regulatory history and current CFR-court list. |
| `native-american-child-protection-act-2024` | Native American Child Protection Act | KeyCite 25 U.S.C. § 3208 once Westlaw reflects the amendment. |
| `lumbee-fairness-act-2025` | Lumbee Fairness Act (National Defense Authorization Act for Fiscal Year 2026, § 8803) | Pull Pub. L. 119-60 § 8803 on Westlaw once the codified Lumbee Act note appears. |
| `miami-tribe-of-oklahoma-illinois-land-claim-settlement-2026` | An Act to provide for the equitable settlement of certain Indian land disputes regarding land in Illinois | Pull on Westlaw when available. |
| `washington-superior-court-civil-rule-82-5` | Washington Superior Court Civil Rule 82.5, Tribal Court Jurisdiction | KeyCite Wash. CR 82.5. |
| `wisconsin-statutes-806-245` | Wis. Stat. § 806.245, Indian tribal documents: full faith and credit | Pull and KeyCite Wis. Stat. § 806.245 for full conditions and enactment history. |
| `michigan-court-rule-2-615` | Michigan Court Rule 2.615, Enforcement of Tribal Judgments | KeyCite MCR 2.615 for adoption date and amendment history. |
| `south-dakota-codified-laws-1-1-25` | S.D. Codified Laws § 1-1-25, When order or judgment of tribal court may be recognized in state courts | KeyCite S.D. Codified Laws § 1-1-25. |
| `oklahoma-statutes-title-12-section-728` | Okla. Stat. tit. 12, § 728, Standards for recognizing records and proceedings of tribal courts – Reciprocity | Pull 12 O.S. § 728 and Okla. Dist. Ct. R. 30 on Westlaw; OSCN blocked automated access. |
| `north-dakota-rule-of-court-7-2` | N.D. R. Ct. 7.2, Recognition of Tribal Court Orders and Judgments | KeyCite N.D. R. Ct. 7.2 and compare the pre-2025 version (version history link on the court site). |
| `minnesota-general-rules-of-practice-rule-10` | Minn. Gen. R. Prac. 10, Tribal Court Orders and Judgments | KeyCite Minn. Gen. R. Prac. 10. |
| `california-tribal-court-civil-money-judgment-act-sb-406-2014` | Tribal Court Civil Money Judgment Act, Cal. Code Civ. Proc. §§ 1730 et seq. | Pull current Cal. Civ. Proc. Code §§ 1730–1741 on Westlaw to confirm the sunset was removed and get chapter numbers. |
| `arizona-rules-of-procedure-recognition-tribal-court-civil-judgments` | Arizona Rules of Procedure for the Recognition of Tribal Court Civil Judgments | Pull the full rule set on Westlaw (Arizona Rules of Court, Tribal Court Civil Judgments). |

## 4. Secondary sources

Treatises, the Restatement and law review articles. Where a source is not on
Westlaw, the note says where to find it.

| Source record | Work | Where and what |
| --- | --- | --- |
| `yazzie-1994-life-comes-from-it` | Robert Yazzie, “Life Comes from It”: Navajo Justice Concepts, 24 N.M. L. Rev. 175 (1994) | Pull on Westlaw for the pinpoint pages and to KeyCite citing references. An open copy is at UNM Digital Repository. |
| `melton-indigenous-justice-systems-and-tribal-society-1995` | Ada Pecos Melton, Indigenous Justice Systems and Tribal Society, 79 Judicature (No. 3, Nov.–Dec. 1995) | Pull on Westlaw or HeinOnline to confirm the first page of the Judicature printing. |
| `martin-cherokee-supreme-court-1823-1835-dissertation-2018` | James M. Martin, The Cherokee Supreme Court: 1823-1835 (2018) (Ph.D. dissertation, University of Nevada, Reno) | Not on Westlaw; open repository. |
| `cohens-handbook-of-federal-indian-law-2024` | Cohen's Handbook of Federal Indian Law (Nell Jessup Newton & Kevin K. Washburn eds. in chief, 2024 ed.) | Published by LexisNexis. It is generally on Lexis+, not Westlaw, so the author should plan to use a print copy or a law library's Lexis access. Availability on Westlaw was not checked directly. |
| `ali-2022-restatement-law-of-american-indians` | Restatement of the Law, The Law of American Indians (Am. L. Inst. 2022) (approved May 14, 2021) | ALI Restatements are on Westlaw (the Berkeley catalog shows an online version through Thomson Reuters, record 1193202). Pull the black-letter sections and Reporters' Notes from there. |
| `canby-american-indian-law-in-a-nutshell-8th-2025` | William C. Canby, Jr., American Indian Law in a Nutshell (8th ed. 2025) | West Academic study aids are usually reached through a law school's West Academic subscription, not Westlaw. Westlaw availability was not checked. |
| `getches-cases-and-materials-on-federal-indian-law-8th-2025` | David H. Getches, Charles F. Wilkinson, Robert A. Williams, Jr., Matthew L.M. Fletcher, Kristen A. Carpenter & Wenona T. Singel, Cases and Materials on Federal Indian Law (8th ed. 2025) | Casebooks are not on Westlaw; use a print copy or West Academic's casebook platform. |
| `pommersheim-braid-of-feathers-1995` | Frank Pommersheim, Braid of Feathers: American Indian Law and Contemporary Tribal Life (1995) | A book. Westlaw does not carry it; use a library copy. |
| `austin-navajo-courts-and-navajo-common-law-2009` | Raymond D. Austin, Navajo Courts and Navajo Common Law: A Tradition of Tribal Self-Governance (2009) | A book; use a library copy. |
| `hagan-indian-police-and-judges` | William T. Hagan, Indian Police and Judges: Experiments in Acculturation and Control (Univ. of Neb. Press 1980) (1966) | A book; use a library copy. |
| `richland-deer-introduction-to-tribal-legal-studies-3d-2016` | Justin B. Richland & Sarah Deer, Introduction to Tribal Legal Studies (3d ed. 2016) | A book; use a library copy. |
| `leeds-cross-jurisdictional-recognition-enforcement-judgments-2000` | Stacy L. Leeds, Cross-Jurisdictional Recognition and Enforcement of Judgments: A Tribal Court Perspective, 76 N.D. L. Rev. 311 (2000) | Pull on Westlaw for pinpoints; open copy at UND Scholarly Commons. |
| `laurence-enforcement-of-judgments-across-reservation-boundaries-1990` | Robert Laurence, The Enforcement of Judgments across Indian Reservation Boundaries: Full Faith and Credit, Comity and the Indian Civil Rights Act, 69 Or. L. Rev. 589 (1990) | Pull on Westlaw or HeinOnline to confirm the citation and the last page. |
| `clinton-tribal-courts-and-the-federal-union-1990` | Robert N. Clinton, Tribal Courts and the Federal Union, 26 Willamette L. Rev. 841 (1990) | Pull on Westlaw or HeinOnline to confirm the citation and the page range. |
| `deer-tatum-tribal-efforts-violence-against-women-act-full-faith-and-credit-2003` | Sarah Deer & Melissa L. Tatum, Tribal Efforts to Comply with VAWA's Full Faith and Credit Requirements: A Response to Sandra Schmieder, 39 Tulsa L. Rev. 403 (2003) | Pull on Westlaw for pinpoints; open copy at TU Law Digital Commons. |
| `goldberg-overextended-borrowing-tribal-peacemaking-1997` | Carole E. Goldberg, Overextended Borrowing: Tribal Peacemaking Applied in Non-Indian Disputes, 72 Wash. L. Rev. 1003 (1997) | Pull on Westlaw for the last page and pinpoints; open copy at UW Law Digital Commons. |
| `valencia-weber-1994-tribal-courts-custom-innovative-law` | Gloria Valencia-Weber, Tribal Courts: Custom and Innovative Law, 24 N.M. L. Rev. 225 (1994) | Pull on Westlaw for pinpoints; open copy at UNM Digital Repository. |
| `zuni-cruz-southwest-intertribal-court-of-appeals-1994` | Christine Zuni Cruz, The Southwest Intertribal Court of Appeals, 24 N.M. L. Rev. 309 (1994) | Pull on Westlaw for pinpoints; open copy at UNM Digital Repository. |
| `fletcher-rethinking-customary-law-tribal-court-jurisprudence-2007` | Matthew L.M. Fletcher, Rethinking Customary Law in Tribal Court Jurisprudence, 13 Mich. J. Race & L. 57 (2007) | Pull on Westlaw for pinpoints; open copy at the University of Michigan Law School Scholarship Repository. |

## 5. Searches to run

Leads found in this research but not yet followed. Each is a suggested
Westlaw search or document to pull.

- Later history of John v. Baker: John v. Baker II (Alaska 2001) and State v.
  Central Council of Tlingit & Haida Indian Tribes of Alaska (Alaska 2016).
- Whether Wis. Stat. § 801.54 (discretionary transfer to Tribal court)
  responded to the Teague decisions.
- Cases applying C & L Enterprises to American Arbitration Association
  clauses, "sue and be sued" clauses and limited waivers, including
  enforcement in federal court under the Federal Arbitration Act.
- Cases enforcing Tribal arbitration awards or Tribal court judgments in
  state or federal court after Wilson v. Marchington (comity factors applied).
- Lone Wolf's later limits: Delaware Tribal Business Committee v. Weeks,
  430 U.S. 73 (1977), and United States v. Sioux Nation, 448 U.S. 371 (1980).
- Herrera v. Wyoming (2019) on treaty rights after Winans.
- Dolgencorp, Inc. v. Mississippi Band of Choctaw Indians, 746 F.3d 167 (5th
  Cir. 2014), the decision left in place by the 4-4 affirmance.
- 25 C.F.R. part 291 (Secretarial procedures after Seminole) and dispute
  clauses in current gaming compacts.
- 25 C.F.R. parts 23, 900 and 1000 for dispute-resolution provisions, and
  whether the PROGRESS for Indian Tribes Act (2020) changed 25 U.S.C.
  § 5329(c).
- Pending petition: Department of the Interior v. Shoshone-Bannock Tribes of
  the Fort Hall Reservation, No. 26-96 (with No. 26-109), set for the Dec. 4,
  2026 conference.
