---
id: 2026-11-23-recognition-basis
date: '2026-11-23'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: One session read every Act and checked every Federal Register date itself; no other readers were used.
- kind: page-fetch
  name: GovInfo and the Federal Register
  detail: Statutes at Large PDFs and Public Law text from govinfo.gov (link service and content packages), read with pdftotext; the GovInfo link service's redirects gave the issue date of each Federal Register page; the Federal Register API gave the newest list notice and the titles of notices from 1994 on.
- kind: legal-database
  name: Legal Information Institute (United States Code)
  detail: Tables of contents of Title 25, chapters 14 and 19, and the section notes of each tribe-specific subchapter, which give the public law, date and Statutes at Large page of sections omitted from the Code.
purpose: 'Trevor asked why nation pages cite the Federally Recognized Indian Tribe List Act of 1994 (Pub. L. No. 103-454) as the source of a nation''s federal recognition, when that Act only requires the list to be published and does not show that any particular nation is recognized (Nov. 23, 2026). The task: cite the list itself, pinpointed to each nation''s entry, and the document that recognized each nation where one exists.'
queries:
- Federal Register API, notices of the Bureau of Indian Affairs titled "Indian Entities Recognized by and Eligible To Receive Services From the United States Bureau of Indian Affairs", newest first
- Title 25 U.S.C. chapter 14 and 19 subchapters named for a tribe, and their sections described as recognizing, restoring or reaffirming a tribe
- The Statutes at Large page of each such Act, read for the recognition section
- The Federal Register citations of final determinations already in the profiles, for their dates and titles
sources_added:
- public-law-93-197
- public-law-95-195
- public-law-95-281
- public-law-95-375
- public-law-97-391
- public-law-97-429
- public-law-98-165
- public-law-98-481
- public-law-99-398
- public-law-100-420
- public-law-101-42
- public-law-101-484
- public-law-103-323
- public-law-103-324
- public-law-103-434
- public-law-103-454
- public-law-106-568
- public-law-119-60
sources_updated:
- public-law-98-134
limits: 'Only Acts in Title 25, chapters 14 and 19, and the three recognition Acts already in the dataset (Virginia, 2018; Little Shell, 2019; Lumbee, 2025) were searched. Not searched: court judgments that restored terminated California rancherias, administrative recognitions before the 1978 acknowledgment regulations, and the treaties or Indian Reorganization Act documents that first organized many governments. Titles of Federal Register notices before 1994 were not looked up, so those final determinations are cited by volume, page and date only. Every reading awaits the lead author''s review.'
---

# Citing each nation's own recognition source: session notes

## Why the citation changed

Every federally recognized nation's page cited the Federally Recognized Indian Tribe List Act of 1994, Pub. L. No. 103-454, § 104, 108 Stat. 4791, 4792 (codified at 25 U.S.C. § 5131), as the legal basis of its status. Section 104 directs the Secretary of the Interior to publish the list of recognized tribes each year; it names no tribe ([Statutes at Large text](https://www.govinfo.gov/link/statute/108/4791)). The document that shows a particular nation is recognized is the list itself.

The newest list is still the notice of Jan. 30, 2026, 91 Fed. Reg. 4102 (Federal Register API search on Nov. 23, 2026, newest first: the next newest is 89 Fed. Reg. 99899 of Dec. 11, 2024). Each nation's first recognition fact now cites it, pinpointed to the page of the nation's entry, which the profile already recorded as the fact's locator: for example, *Indian Entities Recognized by and Eligible To Receive Services From the United States Bureau of Indian Affairs*, 91 Fed. Reg. 4102, 4104 (Jan. 30, 2026). The website links the citation to the notice and shows the pinpoint in the short form.

## The nation's own basis

Where a nation's status rests on a document of its own, the page now cites it as well (`scripts/tribes/recognition_basis.py` holds the list):

- **38 nations recognized, restored or reaffirmed by 26 Acts of Congress.** Each Act was read in the Statutes at Large on govinfo.gov for the section that extends, restores or reaffirms recognition, and the citation gives that section and page, for example Menominee Restoration Act, Pub. L. No. 93-197, § 3(a), 87 Stat. 770, 770 (1973). Facts that came from the Office of Federal Acknowledgment's lists and named the same Act in their own words ("Legislative recognition, P.L. 97-391", "Legislatively acknowledged") now use the same citation.
- **18 final determinations** under the federal acknowledgment regulations (25 C.F.R. pt. 54 from 1978, renumbered pt. 83 in 1982). These facts already existed; the Federal Register citation and its date now come first, so the page shows the determination instead of "25 C.F.R. Part 83". The note that the earliest ones were made under the regulations now in Part 83 corrects the old wording, which named Part 83 for decisions made in 1980 and 1981.
- **2 administrative decisions** (Ione Band of Miwok Indians and Tejon Indian Tribe) are left as the acknowledgment list words them; no Federal Register notice of either was found.

The Act that the Houlton Band of Maliseet Indians' status is cited to, the Maine Indian Claims Settlement Act of 1980, treats the Band as a federally recognized tribe in section 6(i) and refers in section 7(b) to "the recognition extended the Houlton Band"; the Passamaquoddy Tribe and the Penobscot Nation, which the same section names, are not given the Act as their basis, because the project has not checked whether their recognition came earlier.

## What was not found

The other 523 federal nations have a `recognition-basis` search log saying where the project looked and where to look next. For most of them, recognition rests on treaties, Acts and a long course of dealings rather than one instrument, and the list is the right document to cite. The gaps worth filling are named in each log: the court judgments that restored California rancherias terminated under the Rancheria Act (*Tillie Hardwick v. United States*, N.D. Cal. 1983, and the cases that followed), administrative recognitions before 1978, and Acts outside Title 25, chapters 14 and 19.
