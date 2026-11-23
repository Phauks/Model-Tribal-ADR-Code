# Governing document links, every one checked, Nov. 22, 2026

The [second data gap review](2026-11-22-second-gap-review.md) checked a sample of 60 governing document links that a script had confirmed and found only 23 were the document itself. This review checks all 1,577 `governing_documents[].link` values in the profiles instead of a sample. It changes no profile. AI reviewers wrote the verdicts the script did not settle; they are leads for the lead author, and the spreadsheet has an empty `lead_author_decision` column.

| File | What it holds |
| --- | --- |
| [`2026-11-22-governing-documents-full.csv`](2026-11-22-governing-documents-full.csv) | One row per link: the script's call, the reviewer's verdict where there is one, the final verdict and its tier |
| [`2026-11-22-governing-documents-full.json`](2026-11-22-governing-documents-full.json) | The same, with what the script saw on each page |
| [`2026-11-22-governing-documents-full-counts.json`](2026-11-22-governing-documents-full-counts.json) | Every count in this report |
| [brief](briefs/2026-11-22-governing-documents-full.md) | What the reviewers were told |
| [`2026-11-23-governing-documents-without-links.csv`](2026-11-23-governing-documents-without-links.csv) | The 193 governing document facts with no link at all, which this review did not cover, and what the other searches hold for each |

## What the facts rest on

Every governing document fact already says how far it was checked: 1,568 of the 1,577 are `title-only` (counts file, `verification_levels`). No fact claims that anyone read the document. What this review measures is where the link takes a reader. (Update, Nov. 23: that was the state of the profiles when the links were gathered. On Nov. 23, 307 of the 1,765 governing document facts were `read-in-full`, nearly all of them links to a text the constitution catalog had saved and read; see [the section on the other document searches](#checked-against-the-other-document-searches-nov-23).)

| Where the link goes | Links |
| --- | ---: |
| The document's text is at the link | 685 |
| The text is one step away (a contents page or a page that links to it) | 410 |
| The page names the document but has no text and no link to it | 285 |
| A problem with the link | 197 |
| Total | 1,577 |

The 197 problems:

| Problem | Links |
| --- | ---: |
| Error, bot check, sign-in, dead or empty page | 144 |
| A page of the nation that is a different document | 25 |
| Could not settle | 16 |
| A page not about the nation at all | 8 |
| Another nation's document | 4 |

Two things qualify the 685.

- **Most are the original texts, not the current ones.** 593 of them are the University of Oklahoma Law Library's digitized Indian Reorganization Act documents (thorpe.law.ou.edu, 481) or Library of Congress prints (112), and 536 carry a year from the 1930s to the 1950s. Many nations have amended or replaced those constitutions and charters since. A link to the 1936 text supports "the nation adopted a constitution in 1936"; it does not show the constitution in force today. Gap audit row 12 and the constitution collection work are where current texts come from.
- **The script's own calls were spot-checked.** A reviewer judged 75 of the script's calls without seeing them (counts file, `calibration`). Of 25 links the script called the document itself, 20 were; the other 5 were a contents page or a page linking to the text, never a different document. Three of those 5 were National Indian Law Library tables of contents, so every National Indian Law Library page the script called full text is counted here as one step away. On no item did the reviewer find a wrong nation, a different document or an error where the script had found the document or a page leading to it.

## How it was checked

`python3 scripts/review/governing_documents_review.py gather` downloaded every link (Library of Congress item pages refuse automated requests, so it read each item's catalog record and full-text file instead) and sorted it:

| Script call | Links |
| --- | ---: |
| Full text: 800 or more words naming the nation and the kind of document, with five or more article or section headings or opening with the document's title | 758 |
| Table of contents with no text online (the National Indian Law Library lists many documents whose nation has not let it post the text) | 250 |
| Links to a PDF named for the document | 155 |
| Table of contents with links to articles, titles or chapters | 77 |
| Error or empty | 34 |
| Not fetched | 137 |
| Unclear | 166 |

Reviewers then opened the 303 unclear and unfetched links themselves, and judged the calibration sample. The reviewers' web-fetch allowance ran out partway through two batches, so a few unfetched links rest on one failed attempt instead of two; their reasons say so.

One shared page needed a rule. Thirty-four profiles link the National Indian Law Library's page of Alaska Native climate change resolutions (narf.org/nill/triballaw/climate/). Reviewers split on it, so every such link is counted the same way: where the fact is the nation's climate change resolution and the page names the nation, it is a page linking to the resolution (29); where the fact calls it a "tribal code", or the page does not name the nation, it is a page not about the nation (5).

## What needs a decision

- **Another nation's document (4).** The Lumbee Tribe of North Carolina profile links the Native Village of Buckland, Alaska constitution and corporate charter of 1950, at the University of Oklahoma and the Library of Congress. These four facts belong to Buckland, or nowhere.
- **Hijacked addresses (2).** The St. Croix Chippewa constitution link (stcciw.com) and a Tohono O'odham code link (tolc-nsn.gov) now serve unrelated gambling pages. They should be removed whatever else is decided.
- **Not about the nation (8).** Five "tribal code" facts for Alaska villages (Alatna, Allakaket, Koyuk, White Mountain) and Sokaogon that point to the climate resolutions page or an EPA page, a Fond du Lac water quality link, a Pribilof Islands climate resolution the page does not list under that name, and a Yankton constitution link that now opens a South Dakota state page.
- **A different document (25).** Mostly nation home pages or court pages that do not name the document; each row's reason says what the page is.
- **Error or dead (144).** Many sites refuse automated requests (Municode, Code Publishing, Cloudflare-protected nation sites); others are gone. Each needs a person to open it, an archived copy, or a new address.
- **Names the document only (285).** Mostly National Indian Law Library tables of contents for documents whose text is not online. The fact that the document exists is supported; the text is not available from that link, which `title-only` already records.
- **One step away (410).** Where a reviewer found the direct address of the text, the CSV gives it in `reviewer_direct_link`, so the link could be pointed at the text itself.

## Limits

The script read the first 15 pages of each PDF and OCR'd the first 2 pages of scanned ones. Reviewers are a small model; their verdicts on pages they could open are leads, and on pages they could not open they record what failed.

## Applied, Nov. 22

`python3 scripts/review/governing_documents_review.py apply` made the plain corrections in a separate content change: it removed the 2 hijacked links (each note keeps the old address), removed the 4 Buckland documents from the Lumbee profile (the Buckland profile already lists the same four links), and pointed 62 links at the document's text where a reviewer found a direct link, or the script found a PDF of a constitution, charter or articles of association, and a fresh download named the nation and opened as the document (each note keeps the old link). It left 73 suggested direct links alone: 54 whose text could not be confirmed, 10 it could not fetch, 6 that are not the whole document (a criminal code linked as the whole code, a single amendment, rules of conduct, an ERIC report and an unclear court file) and 3 that do not open as the document. Every other row waits for the decision column.

## Checked against the other document searches, Nov. 23

The lead author asked on Nov. 23 that these results be checked against the documents other work had found. `python3 scripts/review/governing_documents_review.py crosscheck` compares every row with the [constitution catalog](../constitutions/README.md) (1,279 documents read Nov. 21 and 22), the [tribal law texts](../tribal-law/README.md) (8,921 files fetched Nov. 21), the [capture index](../capture-index.csv), the search logs and the [Nov. 23 retry of failed fetches](2026-11-23-retry-batch-6.md). What it found is in the CSV's new `other_searches` column; counts are under `other_searches` in the counts file. Matching is by link, and by nation and kind of document; a match by nation says the project holds a text, not that it is the version the fact names.

**What this review got wrong.** Four links it counted as errors are the documents: Library of Congress items for the Native Village of Selawik charter and the Unalakleet, Venetie and Kasaan constitutions. This review's request timed out; the catalog had downloaded all four through each item's JSON view on Nov. 22 and read them. Those four facts are now `read-in-full`. Three direct links that the Nov. 22 `apply` could not confirm with its own download were confirmed by the other collections, and the facts now point to them: the Hopi Code PDF (tribal law texts), and the Cheyenne and Arapaho constitution of 2006 and the Walker River Paiute constitution and by-laws (constitution catalog).

**Problem links with a copy now found (197 in all).**

- Three constitution links (two Prairie Band Potawatomi facts and Shoshone-Bannock) are dead, but Wayback Machine prints of those pages, hand-pulled on Nov. 22, hold the constitution text.
- Fourteen links on six nations' pages (Eastern Shawnee, Fond du Lac, Kashia, Paiute Indian Tribe of Utah, Samish and San Manuel) have a Wayback Machine copy that the retry read on Nov. 23. The copies show the nation's codes or ordinances page, which is a page listing the documents, not the text of each.
- Twelve links to Code Publishing (Chehalis, Puyallup and Tulalip) now send readers to eCode360 (CH4710, PU4881, TU4849), as the pages saved on Nov. 21 say. eCode360 refuses automated requests, so the new addresses are unread.

**Constitutions, charters and articles with no text at the link.** Of the 289 such facts with a problem link or a page that only names the document, the project already holds a text of that kind for the nation in 258 cases: 250 in the constitution catalog and 8 hand-pulled since. The version matches the fact's year in 49 of the 250; 103 facts give no year, and 98 name a year the held texts do not have (often a newer amendment the National Indian Law Library lists without its text). For the 99 constitution facts with no link at all, 91 have a held text. That leaves 36 facts for 28 nations with no text anywhere in the project. All 28 nations are already on the hand-pull list's request to ask for constitutions.

**Text one step away (410).** For 149 of these rows, the direct text was already downloaded by another collection: 79 by the tribal law texts and 70 by the constitution catalog.

**Law codes with no text at the link.** The other searches do not change these much. The tribal law texts collection fetched the same pages on Nov. 21 and got the same bot checks, sign-in pages and errors; its captures confirm this review's verdicts.

