---
id: 2026-11-27-president-pages
date: '2026-11-27'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: One session checked the Supreme Court cases decided while Andrew Johnson was President, added every President to content/supreme-court/people.yaml, wrote content/law/treaty-proclamations.yaml from the treaty check of Nov. 24, 2026, and rebuilt the President pages; no other readers were used.
- kind: page-fetch
  name: supremecourt.gov, tile.loc.gov, www.loc.gov, www.senate.gov, fjc.gov, guides.loc.gov
  detail: The Supreme Court Library's table of decision dates (datesofdecisions.pdf); the U.S. Reports as the Library of Congress scans them; the Library of Congress's catalog records for four portraits; the Senate's table of Supreme Court nominations; the Federal Judicial Center's judges.csv export; the Library of Congress chronological list of Presidents.
purpose: 'Trevor asked whether Andrew Johnson really had no Supreme Court cases involving Native Americans, as his page seemed to say, and asked that each President''s page work like a nation''s page, with a side column of sections and the executive orders and other things the President signed (Nov. 27, 2026).'
queries:
- Which Supreme Court cases on the site were decided between Apr. 15, 1865, and Mar. 4, 1869
- Whether Andrew Johnson appointed any Justice, and whom he nominated
- The party of each President who appointed no Justice
- The day each ratified treaty was proclaimed
sources_added:
- united-states-senate-supreme-court-nominations
limits: 'Treaties are listed on the page of the President who proclaimed them only where Kappler''s header gives a proclamation date (333 of 370 ratified treaties); the rest are on no President''s page until their dates are found. Acts of Congress are listed by the date each record gives, which is the day the Act became law; an Act passed over a veto is not marked. Every reading awaits the lead author''s review.'
---

# Pages for every President: session notes

## Andrew Johnson's cases

The site had six Supreme Court cases decided while Andrew Johnson was President (Apr. 15, 1865, to Mar. 4, 1869), each in the Supreme Court Database's Indian law issue codes and each dated by the Supreme Court Library's table of decision dates (https://www.supremecourt.gov/opinions/datesofdecisions.pdf), read again on Nov. 27, 2026:

| Case | Citation | Decided |
| --- | --- | --- |
| United States v. Holliday | 70 U.S. (3 Wall.) 407 | Mar. 5, 1866 |
| The Kansas Indians | 72 U.S. (5 Wall.) 737 | May 6, 1867 |
| The New York Indians | 72 U.S. (5 Wall.) 761 | May 16, 1867 |
| United States v. Mayrand | 154 U.S. 552 | May 16, 1867 (printed in the report; the table does not list volume 154's appendix) |
| Wilson v. Wall | 73 U.S. (6 Wall.) 83 | Dec. 16, 1867 |
| Kendall v. United States | 74 U.S. (7 Wall.) 113 | Feb. 1, 1869 |

The five in the Library of Congress's scans of the U.S. Reports were opened and their captions read. No other entry in the table for those years names a nation or Indians as a party ("The Ottawa", 3 Wall. 268, is a ship).

His page was missing for two reasons. Only Presidents who appointed a Justice had a page (content/supreme-court/people.yaml listed Presidents from the Court's list of Justices), and Andrew Johnson appointed none: the Senate's table of nominations lists one nomination from him, Henry Stanbery, received Apr. 16, 1866, with no action. And a President's "Cases on this site" counted only cases heard by the Justices that President appointed, not the cases decided during the term. William Henry Harrison, Zachary Taylor and Jimmy Carter also appointed no Justice and had no page.

## Every President

scripts/law/supreme_court_people.py now adds every President in the Library of Congress list, with the party the Federal Judicial Center's directory gives for the other federal judges each appointed: Zachary Taylor, Whig; Andrew Johnson, Democratic; Jimmy Carter, Democratic. William Henry Harrison appointed no federal judge, so his party is not recorded.

## Treaty proclamations

scripts/law/treaty_proclamations.py copies the ratification and proclamation dates the treaty check of Nov. 24, 2026 read from Kappler's headers (research/reviews/2026-11-24-treaty-verification-ratified.csv) into content/law/treaty-proclamations.yaml. Two headers needed care: the Treaty with the Miami of Oct. 6, 1818, is printed "Proclamation Jan. 15, 1319 [1819]", and the bracketed year is used; the Treaty with the Ponca of June 25, 1817, reads "Proclamation, Dec. 26,1877", sixty years after signing, which is taken as a misprint and left out until checked against the Statutes at Large.
