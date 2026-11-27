---
id: 2026-11-27-title-25-enacting-acts
date: '2026-11-27'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: One session found why sections of Title 25 linked to the wrong enacting Act, fixed scripts/law/title_25_acts.py and reran it; no record was written by hand.
- kind: page-fetch
  name: govinfo.gov
  detail: The 2024 edition of Title 25 of the United States Code on GovInfo (HTML), current through Jan. 6, 2025, and GovInfo's link service and MODS metadata for the Statutes at Large pages of Acts not looked up before. The Office of the Law Revision Counsel's site (uscode.house.gov) answered 403 and 404 from this session, so its later release points were not compared.
purpose: 'The Title 25 navigation work (PR #647) found that content/law/title-25-sections.json gave 25 U.S.C. § 5321 to Pub. L. 100-446, a 1988 appropriations Act, though the section''s source credit begins with the Indian Self-Determination and Education Assistance Act, Pub. L. 93-638. This session audits every section''s enacting Act against its source credit and fixes the data.'
queries:
- Every section of the 2024 edition of Title 25, its source credit, and the first Act that credit names, compared with the record each section linked to
sources_added:
- act-1877-03-03-ch-101
- act-1912-08-24-ch-355
- act-1931-02-21-ch-271
- act-1936-06-16-ch-582
- act-1956-08-01-ch-808
- public-law-100-202
- public-law-101-624
- public-law-101-82
- public-law-104-134
- public-law-104-208
- public-law-104-313
- public-law-105-12
- public-law-105-244
- public-law-105-276
- public-law-105-277
- public-law-106-216
- public-law-108-267
- public-law-108-329
- public-law-109-147
- public-law-109-58
- public-law-110-453
- public-law-111-148
- public-law-113-4
- public-law-116-313
- public-law-85-488
- public-law-95-561
- public-law-98-192
- public-law-98-203
- public-law-98-250
- public-law-98-473
- public-law-98-608
- public-law-99-389
- public-law-99-498
- public-law-99-500
limits: 'The Code is the 2024 edition on GovInfo, the same edition the site shows; a section changed after Jan. 6, 2025 is not reflected. Records stay Unverified. The 34 new Act records carry the first run''s dates (retrieved Nov. 26, 2026, found in session 2026-11-26-title-25-acts) because the script writes those dates; they were looked up on Nov. 27.'
---

# The Act that enacted each section of Title 25: session notes

## What was wrong

The credits our data stored were right: every one of the 2,396 source credits in content/law/title-25-sections.json matched the 2024 edition on GovInfo character for character. The Act picked from each credit was not. The script's citation pattern stopped at any parenthesis, so a citation with a subsection in it, such as "Pub. L. 93-638, title I, §102, formerly §§102 and 103(c), Jan. 4, 1975, 88 Stat. 2206" (25 U.S.C. § 5321), was not read at all, and the first Act the pattern could read (there, Pub. L. 100-446) was taken as the enacting one. Three other misreadings came with it.

- A credit that starts with the Revised Statutes has no enacting Act of its own, but the script gave the section to the first Act after the semicolon, which only amended it. 25 U.S.C. § 71 ("Future treaties with Indian tribes", R.S. § 2079) was linked to the Technical and Miscellaneous Revenue Act of 1988.
- A section "as added" to one Act by another ("Pub. L. 94-437, title II, §203, as added Pub. L. 100-713, title II, §203(c), Nov. 23, 1988, 102 Stat. 4805") was read as one citation mixing both Acts.
- 25 U.S.C. § 276, "Vacant military posts or barracks for schools; detail of Army officers", is in force, but its heading's first word matched the pattern for vacant sections, so it was listed as not in force. Chapter 7's record now counts 30 sections in force, not 29.

For former sections, the note describing the section ("Section, acts Jan. 24, 1923, ch. 42, 42 Stat. 1185; May 29, 1928, ...") was read the same faulty way, and "acts" (plural) was not recognized, so 23 former sections changed too. An Act a "Prior Provisions" note names (which enacted an earlier section of the same number) is no longer used as a section's own enacting Act.

## The rule now

The enacting Act is the Act the credit's first citation names, up to the first semicolon outside brackets and parentheses. A section whose credit starts with the Revised Statutes has none. A section "as added" is credited to the Act that added it, whose date and Statutes at Large page the credit gives, and `partOf` names the Act it belongs to (for 25 U.S.C. § 1621b, enacted by Pub. L. 100-713 as part of the Indian Health Care Improvement Act, Pub. L. 94-437). Each section also lists, as `amendedBy`, the Acts after the first in its credit that have a record, in the credit's order. The test site/tests/title-25-enacting-acts.test.ts checks every section in force whose credit starts with a public law against the record it links to.

## Results

Of the 1,181 sections in force, 1,127 now link to the record of the Act that enacted them (before, 1,014 of 1,180 linked, many wrongly). 315 sections in force changed: 190 moved to a different Act, 119 gained a link they lacked, and 6 lost a link because they come from the Revised Statutes (§§ 8, 65, 71, 81, 179 and 264). 308 sections in force are "as added" and name the Act they belong to; 396 sections list the Acts that amended them. research/reviews/2026-11-27-title-25-enacting-acts.csv lists every changed section with its old and new Act and every section noted below.

Reading the credits correctly found 94 more Acts in them (562 citations in all, 447 Acts with a record). 34 got new records (Pub. L. 102-575 and 106-554 got theirs from the water rights settlements work, #659, which Title 25 now links to); 32 new Statutes at Large slips were stored; 7 Acts over 64 MB, most of them omnibus appropriations Acts, have no stored copy and link GovInfo. The 10 Acts first recorded as enacting a section that they only amended (Pub. L. 100-446, 100-647 and 118-15 among them) keep their records, which now say which sections they amended and that they enacted none. The Patient Protection and Affordable Care Act (Pub. L. 111-148) is named as such, not by the short title of the Indian health bill it enacted.

## Sections to check by hand

Sections "as added": the Code credits these to both Acts, and we follow the date and page the credit gives. If the project prefers the Act a section belongs to, `partOf` already holds it.

Sections in force with no linked Act though their credit names one: §§ 3, 46 and 63 (Act of May 17, 1882, ch. 163, 22 Stat. 88), §§ 81a and 81b (Joint Resolution of June 26, 1936, ch. 851, 49 Stat. 1984), §§ 133 and 135 (Act of Mar. 3, 1875, ch. 132, 18 Stat. 449-450), which are the unmatched Acts the first session listed, and § 5327 (Pub. L. 106-113, 113 Stat. 1535, 1501A-157), whose page GovInfo's link service does not answer for.

25 U.S.C. § 5807 has no source credit in the 2024 edition on GovInfo, so it has no enacting Act in our data.

Sections renumbered within their Act ("formerly § 102 and 103(c)") are credited to the Act as the credit's first citation names it; the review file notes them.
