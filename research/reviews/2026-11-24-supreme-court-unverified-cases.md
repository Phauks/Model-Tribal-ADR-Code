# Settling the Unverified Supreme Court case records (Nov. 24, 2026)

Trevor asked to "attempt to check unverified" after the 462 Supreme Court case records went in (PR #475): 385 were Verified (every cross-check agreed) and 77 were Unverified. This review settles each disputed fact by what the official report prints, and lifts a record to Verified only when the report itself bears the fact out.

## Result

458 of the 462 records are now Verified; 4 stay Unverified (below). Of the 77, 74 are now Verified. Running the stricter date check over all 462 records also found misread dates in records that had passed as Verified; those are corrected and confirmed too.

How each disputed check was settled (the record's `review.checks`; `confirmed` is the new result, with the words the report prints in `detail`):

- By script, in the report's text (scripts/caselaw/official_report.py): the scan's pages are mapped to the report's printed pages from their page numbers and running heads, so an inserted map or a final page that sits in the next case's scan no longer throws the count off; opinion headings ("MR. JUSTICE REED delivered the opinion of the Court.", "JUSTICE BLACKMUN, with whom ... join, dissenting.") are found on their printed pages; captions and "Argued ... Decided ..." lines are found in the scan's text layer or in a fresh OCR of the page image (tesseract at 300 dpi), and the figures in a date line must match, not just the words.
- By reading the page images, for 33 cases where no script can read the fact (ornamental type, OCR that confuses 3 and 8, statements at the end of an opinion): research/supreme-court-coverage/report-readings.json holds each reading with the lines it rests on, and the generator accepts a reading only when every line is found on its printed page. Lines the OCR cannot read at all (small capitals in the 1810s reports, figures in 1890s type) are marked `ocr_poor` and were checked by eye on the page image.
- Spot check: six script confirmations were checked against the page images (New York Indians p. 8, Preston v. Browder p. 121, Seminole Nation (1942) p. 310, Conley v. Ballinger p. 84, and the two old captions); all six were right.

## Corrections to records

Facts that changed, each now matching the official report:

- Argument dates: a parsing bug put the decision date among the argument dates whenever the report's line had no dash before "Decided" (67 records, most of them already Verified, such as Employment Division v. Smith, which listed April 17, 1989 as an argument date). Fixed in the parser.
- The Supreme Court Library's table of dates was misread for volumes 104 to 107 (the volume headings there print "U. S." with a space), so cases in those volumes took the dates of cases in volume 103. Pennock v. Commissioners (103 U.S. 44) had King v. Worthington's "Decided Oct. 31, 1881"; it now has its own dates, and United States v. McBratney now has dates at all.
- Misread figures in the Caselaw Access Project's text: In re Mayfield (submitted 1891, not 1881), Montoya v. United States (argued 1900, not "1000"), Sarlls v. United States (November 15), Choate v. Trapp (February 23), Oklahoma Tax Commission v. Sac and Fox Nation (March 23, not 28). Ex parte Joins now has its argument date (the report gives no year for it).
- Arizona v. California, 531 U.S. 1: the record gave "Decided June 3, 1963", the first date in the case's chain of decrees; it now gives the whole heading, ending with the supplemental decree of October 10, 2000.
- Opinions: Hynes v. Grimes Packing Co. (Rutledge's dissent starts on p. 127, not p. 129; the earlier AI reading counted the scan's two inserted pages as report pages); County of Oneida v. Oneida Indian Nation (Justice Stevens's "concurs in the judgment" in No. 83-1240 is a vote without an opinion and is no longer listed; his dissent is in part); Shade v. Downing and Metlakatla Indian Community v. Egan (joint dissenting statements now listed, with a note naming the Justices); Brendale (Justice White's opinion announces the judgment in two of the three cases); Bowen v. Roy, Washington v. Confederated Tribes of the Colville Indian Reservation and Delaware Tribal Business Committee v. Weeks (opinions "concurring in part and concurring in the result", which needed two new opinion kinds); Meigs v. M'Clung's Lessee (caption as printed).
- Opinion links: where the scan has inserted pages before an opinion, the record gives `scan_page` and the case page links there (Hynes).

## Still Unverified

- In re Mayfield, 141 U.S. 107: the Library of Congress scan holds only the case's first page, so the opinion (p. 111) cannot be checked. The date line on that page is confirmed.
- Isaacs v. United States, 159 U.S. 487: the report's "Submitted October 23 (or 28), 1895" cannot be read with confidence in the scan; the Caselaw Access Project reads 23 from a different copy.
- Midway Co. v. Eaton, 183 U.S. 619: the Library of Congress has no scan under this citation; the case's two pages are at the end of the scan of the earlier Midway Co. v. Eaton (183 U.S. 602).
- United States v. Mayrand, 154 U.S. 552: an unreported case printed in volume 154's appendix; no scan found.

## Rerunning

`python3 scripts/caselaw/supreme_court_native_cases.py --cache ~/caselaw-cache --write` (about 7 minutes with a warm cache; fresh OCR pages are cached in ~/caselaw-cache/ocr). The cache is rebuilt from R2 (caselaw-access-project/us/, tile.loc.gov/..., supremecourt.gov/opinions/boundvolumes/, scdb.wustl.edu/).
