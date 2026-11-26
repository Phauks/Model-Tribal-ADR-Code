# The remaining Supreme Court cases on the list (Nov. 26, 2026)

Trevor asked to "get those remaining Supreme Court cases" after the 462 records built from the Caselaw Access Project's volumes were all Verified (PRs #475, #494, #503). This review covers what was left of the list in research/supreme-court-coverage/native-cases-scdb.csv, a sweep for cases the list missed, and how each new record was checked.

## What was left

Of the 534 cases on the list (533 from the coverage study, plus one added below), every case already had a record except 14:

- Seven cases decided from 2016 to 2020, after the Caselaw Access Project's last volume (572): *Menominee Indian Tribe of Wisconsin v. United States*, 577 U.S. 250 (2016); *Nebraska v. Parker*, 577 U.S. 481 (2016); *Upper Skagit Indian Tribe v. Lundgren*, 584 U.S. 554 (2018); *Washington v. United States*, 584 U.S. 837 (2018) (per curiam); *Washington State Department of Licensing v. Cougar Den, Inc.*, 586 U.S. 347 (2019); *Herrera v. Wyoming*, 587 U.S. 329 (2019); *Sharp v. Murphy*, 591 U.S. 977 (2020) (per curiam). The list gave the last five by their Supreme Court Reporter citations; it now gives their United States Reports citations, read from the Court's own volumes.
- Six odd citations the first build set aside: an appendix case (131 U.S. lxx), a case decided in a note (92 U.S. 760 n.), two memorandum decisions (169 U.S. 733 and 172 U.S. 641), an order (429 U.S. 976) and an opinion in chambers (468 U.S. 1315).

## Sweep for cases the list missed

The list was built from the Supreme Court Database's codes and Wikipedia's list. To catch cases since 2014 that neither names, a script read the Court's own printing of every volume from 573 to 609 (bound volumes 573-587, preliminary prints 588-605 and the Court's per-case preliminary prints and slip opinions for the 2020-2025 terms) and counted words such as "Indian", "tribe", "tribal", "reservation" and "Pueblo" in each case. Every case with many such words was already on the list, with two exceptions:

- *Patchak v. Zinke*, 583 U.S. 244 (2018), on the Gun Lake Trust Land Reaffirmation Act, which confirmed land taken into trust for the Match-E-Be-Nash-She-Wish Band of Pottawatomi Indians. The Database codes it as a separation-of-powers case with no Native party. It is now on the list (Database case 2017-017) and has a record.
- *Trump v. Barbara*, 609 U.S. 719 (2026), on birthright citizenship. It discusses at length why members of Indian tribes were once outside the Citizenship Clause (*Elk v. Wilkins*), though no Native nation or person is a party. Trevor decided it belongs ("If it impacts native americans, it should be in there"), and it now has a record; see the next section.

The Database's own release (2026_01) runs through the October 2025 term and codes no Native case after *Becerra v. San Carlos Apache Tribe* (2024).

## How the new records were built and checked

The seven recent cases and *Patchak* were written by scripts/caselaw/supreme_court_native_cases.py, the same generator as the first 462, which now reads cases after volume 572 as follows. The second reading of the report, which the Caselaw Access Project gave for earlier cases, is the Legal Information Institute's text of the Court's slip opinion (law.cornell.edu/supremecourt/text/<docket>), a separate printing: its caption, its "Argued ... Decided ..." line and each opinion with its heading. The official report is the Court's bound volume (through volume 587) or its preliminary print (volumes 588-592, by part). The usual checks then run: the citation and name against the Database, the case's pages in the report, the caption and the date line found in the report's text, the decision date against the Database, the opinion writers against the Database and the start of each opinion found on its page of the report, and the bench against Oyez and the Database. For these cases one more check runs: each opinion's kind, read from its heading, must be a dissent exactly when the Database codes the writer's opinion as one.

All eight are Verified. Points a reader may notice:

- *Washington v. United States* was affirmed by an equally divided Court. Oyez counts every Justice in the majority; the Database records no votes. The record keeps the Database's bench and says why, and Justice Kennedy, who the report says took no part, is shown as not participating.
- *Sharp v. Murphy*: the slip opinion has no syllabus and names the parties in full; the report's caption ("SHARP, WARDEN v. MURPHY", p. 977) is read from the page and recorded in research/supreme-court-coverage/report-readings.json. Justice Gorsuch took no part.
- Each opinion's first page was compared by hand with the report's page for all eight cases (18 opinions); all were right.

The three odd citations that have a scan of the printed report were written by hand from it, with the same `review` block:

- *United States v. Chetimachas Indians*, 131 U.S. app. lxx (1852): from the appendix of cases omitted from the reports in volume 131, in the Internet Archive's scan of the volume (scan page 550); the Library of Congress has no scan of the appendix. Verified.
- *Missouri, Kansas & Texas Railway Co. v. United States*, 92 U.S. 760 n. (1876): decided in a note to *Leavenworth, Lawrence & Galveston Railroad Co. v. United States*. The report prints no date for the note case, so the decision date (April 10, 1876) rests on the Database alone, and the record stays Unverified.
- *National Farmers Union Insurance Cos. v. Crow Tribe of Indians*, 468 U.S. 1315 (1984) (Rehnquist, J., in chambers): one Justice's opinion as Circuit Justice continuing a stay, before the Court decided the case at 471 U.S. 845 (1985). Verified. The site now shows such an opinion as "Opinion of one Justice in chambers", with the Justice, in the case's facts, and as an opinion in chambers on the Justice's and the Court's pages.

## Not added

- 169 U.S. 733 (*United States and Comanche Indians v. Kemp*, 1898) and 172 U.S. 641 (*United States and Comanche Indians v. Hood*, 1898): memorandum decisions. Neither the Library of Congress, the Caselaw Access Project nor the Internet Archive has these pages, so nothing can be checked against the report. They need the printed volumes (a law library) or HathiTrust read by hand.
- 429 U.S. 976: not a decision. It is the order of November 29, 1976 granting certiorari in *Puyallup Tribe, Inc. v. Department of Game of Washington*, which the Court decided at 433 U.S. 165 (1977); that case already has a record.

## Copies

The Court's bound volumes 577, 583, 584, 586 and 587 and part 2 of the preliminary print of volume 591 are filed in R2 and the capture index (research/capture-index.csv). The Library of Congress scans and the Internet Archive volume are named in the records.

## Cases that affect Native people without a Native party (added later the same day)

Trevor's rule for the list: "If it impacts native americans, it should be in there." The list had been built from the Supreme Court Database's codes for a Native party or an Indian-law issue, so it missed decisions that turn on Native people or lands when no tribe or Indian is coded as a party.

### Trump v. Barbara

Written by hand from the Court's preliminary print of volume 609, part 2 (pp. 719-907), which is the official report until the bound volume is printed. The Database's 2026_01 release does not include the case and Oyez gives no votes, so the caption, the date line ("Argued April 1, 2026—Decided June 30, 2026"), each opinion's first page and the bench were all read from the report. Justice Kavanaugh's opinion is headed "concurring in the judgment and dissenting in part"; the schema, the scripts and the site now know that kind of opinion. Verified.

### The sweep

A script read the Caselaw Access Project's text of every case in volumes 1 to 572 that is not already on the list, removed case names inside citations (so that a case merely citing *Worcester v. Georgia* does not count), and counted words such as "Indian", "tribe", "tribal", "Pueblo", "Rancheria", "Alaska Native" and "Native Hawaiian". The 209 cases with eight or more such words and a Database entry were each read by a Haiku reader from the headnote, the opening of the opinion and up to six passages around those words, and marked include or exclude by whether the decision substantially concerns or affects Native people or nations. Each pick and each borderline exclusion was then checked by Claude (Opus) against the same passages and, where needed, the opinion text.

For volumes 573 to 609 the earlier sweep of the Court's own printings (above) already covered this: besides *Patchak* and *Barbara*, the cases there that use such words (among them *Torres v. Texas Department of Public Safety*, *PennEast Pipeline Co. v. New Jersey*, *Puerto Rico v. Sanchez Valle*, *Students for Fair Admissions v. Harvard*, *Dobbs v. Jackson Women's Health Organization* and *Trump v. CASA*) mention Indians or tribes only in passing.

83 cases were added. They include *Arizona v. California*, 373 U.S. 546 (1963), and its decrees of 1979, 1984 and 2006, which quantify the reserved water rights of the Colorado River reservations; *Colorado River Water Conservation District v. United States*, 424 U.S. 800 (1976); *Employment Division v. Smith*, 485 U.S. 660 (1988); *Amoco Production Co. v. Village of Gambell*, 480 U.S. 531 (1987); *Hawaii v. Office of Hawaiian Affairs*, 556 U.S. 163 (2009); *Hatahley v. United States*, 351 U.S. 173 (1956); *United States v. Wong Kim Ark*, 169 U.S. 649 (1898), which restates the exception for members of Indian tribes; *Greater New Orleans Broadcasting Ass'n v. United States*, 527 U.S. 173 (1999), where the exemption for Indian gaming was part of the reasoning; and many earlier cases on Indian title, allotments, Indian-country liquor and criminal jurisdiction, tribal trust funds and Indian depredation claims. Each row in research/supreme-court-coverage/native-cases-scdb.csv carries the reason "added: sweep of the official reports ...".

Not added, as judgment calls a reader may revisit:

- Cases on race-conscious programs that list Native Americans among the groups they cover, without deciding anything particular to them: *Fullilove v. Klutznick* (1980), *Adarand Constructors v. Pena* (1995), *Regents of the University of California v. Bakke* (1978), *Grutter v. Bollinger* (2003), *DeFunis v. Odegaard* (1974) and, after volume 572, *Students for Fair Admissions v. Harvard* (2023).
- *Scott v. Sandford* (1857), which compares the status of Indians with that of people of African descent; *Gonzales v. O Centro Espirita* (2006), which relies on the peyote exemption for the Native American Church by analogy; the state sovereign immunity cases that cite *Seminole Tribe*; and *United States v. New Mexico* (1978), on reserved water for a national forest.
- Orders and denials of certiorari that have no Database entry, though some name tribes (for example *New Rider v. Board of Education*, 414 U.S. 1097 (1973), and *Connecticut v. Mohegan Tribe*, 452 U.S. 968 (1981)).
- Cases in which "Indian Territory" is only the place or the court of an ordinary dispute, and land cases in which Indian title is only history.

### How the 83 records were checked

They were written by scripts/caselaw/supreme_court_native_cases.py, as the first 462 were. 60 agreed on every check at once. For the other 23 the Library of Congress scans were read: three scans had failed to download and were fetched again, and the facts the scripts could not read were read from the page images into research/supreme-court-coverage/report-readings.json, each counting only when its lines are found on the printed page. The report settled several errors in the Caselaw Access Project's text:

- The Court's opinion belongs to a different Justice than the Caselaw Access Project says in four cases: *United States v. Dawson* (Nelson, not McLean, who dissented), *Jaybird Mining Co. v. Weir* (Butler, not McReynolds), *Board of County Commissioners v. United States* (Frankfurter, not Black, who concurred) and *Ex parte Webb* (Pitney's opinion starts on p. 670, not p. 674).
- *Wagoner v. Evans* was decided May 23, 1898, as the report and the Database say, not May 28.
- *Slidell v. Grandjean* prints no date line; the reporter's note on p. 414 says the decision was announced March 3, 1884, and the order on rehearing it prints was announced March 24.
- *Lessee of Lattimer v. Poteet*: Chief Justice Taney and Justice Catron each concur in affirming the judgment, and Justice Wayne dissented without an opinion.
- The scan of *Arizona v. California* (1963) holds two blank leaves and two map pages after p. 602, which put the page count two pages off; scripts/caselaw/official_report.py now treats a page with no page number, no running head and hardly any prose as an inserted map or plate. The change alters the page count of no other saved scan.

82 of the 83 are Verified. *Mitchel v. United States*, 34 U.S. 711 (1835), stays Unverified: the report prints no decision date and the Court's table of decision dates has no entry for it, so the date (March 17, 1835) rests on the Database alone.
