# Second data gap review, Nov. 22, 2026

This review follows up nine rows of the
[dataset gap audit](../analyses/2026-11-21-dataset-gap-audit.md) that a script
or a small-model reviewer could check: rows 4 and 20 (quotations in method and
glossary records), 8 (Indian Child Welfare Act designated agents), 10
(governing document links), 12 (government structure), 15 (petition status),
16 (gaming operations), 21 (source links) and 23 (outreach search results).
The [first data gap review](2026-11-21-data-gap-review.md) covered rows 1, 7
and 11.

AI reviewers wrote every verdict that a script did not settle. They are leads
for the lead author, not findings, and no profile, source or method record was
changed. Changes the lead author accepts are made in a separate pull request,
as [the reviews README](README.md) requires. Each spreadsheet has an empty
`lead_author_decision` column.

How it was run: `python3 scripts/review/second_gap_review.py gather` fetched
the sources and ran the checks a script can settle; reviewers followed the
[briefs](briefs/) dated 2026-11-22; `second_gap_review.py merge` wrote the
files below. All counts in this report come from
[`2026-11-22-second-gap-review-counts.json`](2026-11-22-second-gap-review-counts.json)
unless another file is named.

| Check (audit row) | Items | Files |
| --- | --- | --- |
| Petition status (15) | 74 petitions on the Office of Federal Acknowledgment pages | [`.csv`](2026-11-22-petition-status.csv) |
| ICWA designated agents (8) | 581 facts, plus 6 profiles with no fact | [`.csv`](2026-11-22-icwa-agents.csv), [brief](briefs/2026-11-22-icwa-agents.md) |
| Quotations (4, 20) | 67 quotations in `content/methods/` and `content/glossary/` | [`.csv`](2026-11-22-quotations.csv), [brief](briefs/2026-11-22-quotations.md) |
| Outreach search results (23) | 30 links marked "search-result-only" | [`.csv`](2026-11-22-outreach-search-results.csv), [brief](briefs/2026-11-22-outreach-search-results.md) |
| Source links (21) | 5,386 source addresses; the 876 that did not load cleanly or moved to another site are listed | [`.csv`](2026-11-22-source-links.csv) |
| Governing documents (10) | 1,577 links | [`.csv`](2026-11-22-governing-documents.csv), [brief](briefs/2026-11-22-governing-documents.md) |
| Government structure (12) | 182 profiles with a historical structure fact | in the `.json` |
| All checks, one record per item | | [`2026-11-22-second-gap-review.json`](2026-11-22-second-gap-review.json) |

## Petition status (row 15)

The script read today's Petitions in Process and Petitions Resolved pages of
the Office of Federal Acknowledgment and compared each petition number with
the `recognition` facts. All 73 petitions that a profile cites agree with the
page: 51 resolved and 22 in process.

One lead: the resolved page lists the Fernandeño Tataviam Band of Mission
Indians as petition 158, with no decision shown, while its profile records
only petition 403, which is in process. The lead author should decide whether
the profile notes both numbers.

The audit's other row 15 item, the 7 possible duplicate groups marked "not
verified", needs the lead author and is not covered here.

## Indian Child Welfare Act designated agents (row 8)

The script downloaded the notice at 91 Fed. Reg. 30,667 (May 26, 2026), read
its page images with Tesseract OCR, and looked for each profile's listed name.

| Result | Facts |
| --- | ---: |
| Name found word for word | 70 |
| Words of the name found together | 495 |
| Checked by a reviewer: listed | 11 |
| Checked by a reviewer: listed under another name | 5 |
| Total | 581 |

Every fact was found in the notice. The five listed under another name are
combined or component rows: Barona and Viejas share one Capitan Grande Band
row, and the Minnesota Chippewa Tribe, the Passamaquoddy Tribe and the Pribilof
Islands Aleut Communities appear as their component rows.

Leads:

- The six Minnesota Chippewa Tribe band profiles (Bois Forte, Fond du Lac,
  Grand Portage, Leech Lake, Mille Lacs, White Earth) each have their own row
  in the notice but no ICWA fact. Each could get one, cited to the notice.
- The Chenega note says the notice prints "aka Chanega"; the notice prints
  "aka Chenega".

## Quotations in method and glossary records (rows 4 and 20)

The script looked for each of the 67 quotations word for word in its cited
source and found 38. Reviewers checked the other 29 against the full source.

| Verdict | Quotations |
| --- | ---: |
| Exact (script) | 38 |
| Exact (reviewer) | 21 |
| Minor difference | 2 |
| Wrong | 2 |
| Not a quotation | 3 |
| Cannot check | 1 |

What needs a decision:

- **Wrong.** `content/methods/collaborative-law.yaml` quotes text that the
  reviewer could not find in the Uniform Collaborative Law Rules and Act. A
  follow-up search on Nov. 22 found the sentence in none of seven law review
  articles and bar ethics opinions on collaborative law that use its key
  phrases, so it has no known source. The Act's prefatory note defines the
  process on its first page (page 6 of the PDF): "Collaborative law is a
  voluntary, contractually based alternative dispute resolution process for
  parties who seek to negotiate a resolution of their matter rather than
  having a ruling imposed upon them by a court or arbitrator." It adds that
  "[t]he parties agree in advance that their lawyers are disqualified from
  further representing parties by appearing before a tribunal if the
  collaborative law process ends without complete agreement." These are the
  likely replacement.
  `content/methods/restorative-justice.yaml` quotes KTOO (2016) as "built on
  tribal mentorship and tradition", where the story says "a strong emphasis
  on".
- **Minor difference.** `content/methods/restorative-justice.yaml`: the Pit
  River peacemaker title prints "peace-making". `content/glossary/native-american.yaml`:
  the National Museum of the American Indian text includes "using valid
  reasoning and", which the quotation drops without an ellipsis.
- **Not a quotation (3).** Correction, Nov. 22: these are not paraphrases in
  quotation marks. The script paired a closing quotation mark with the next
  opening one and took the record's own unquoted words between two short
  quotations as a quotation. The quoted words themselves match their sources:
  `government-to-government-issue-resolution.yaml` quotes NRS 233A.260 ("must
  follow the policy", "to attempt to resolve the issue in collaboration with
  the Indian tribe"); `indian-country.yaml` quotes the terms "Indian country"
  and "Indian Country" (the Native Governance Center style guide says
  "Capitalize the term Indian Country"); `nation.yaml` quotes "Red Lake
  Nation Tribe" from Native Governance Center, How to Talk About Native
  Nations, p. 3. No change is needed.
- **Cannot check, since checked.** `content/methods/screening-panel.yaml`
  cites Sander (1976), which has no free online copy. On Nov. 22 its three
  quotations ("screening-adjudication model", "costing out" or "screening
  out", and the three-person Board sentence) were found word for word in the
  project's Westlaw copy of 70 F.R.D. 79, at *128-29.

Caveats: the two Samoan sources were read through a web fetch tool, and the
Organized Village of Kake source through OCR of a scanned PDF.

## Outreach search results (row 23)

Reviewers opened the 30 links marked "search-result-only" in
`research/outreach/`.

| Verdict | Links |
| --- | ---: |
| Supports the record | 23 |
| Partly supports | 3 |
| Does not support | 1 |
| Page unavailable | 3 |

The one that does not support: `alaska-native-justice-center.yaml` cites a CIRI
page for the Center being a CIRI subsidiary, and the page does not say so. The
three partly supporting are the American Bar Association section,
Las Vegas Indian Center and Native Arts and Cultures Foundation records. The
three unavailable pages (one mediate.com article, two National Museum of the
American Indian pages) refused the request and need a person to open them.

## Source links (row 21)

The script requested every source record's address once.

| Result | Sources |
| --- | ---: |
| Loads | 4,510 |
| Loads, but moved to another site | 769 |
| Gone (404 or 410) | 16 |
| Refused an automated request | 49 |
| No response | 38 |
| Server error (5xx) | 4 |

The 16 gone include four Crown-Indigenous Relations pages
(rcaanc-cirnac.gc.ca), three Cherokee Nation pages, two Guam court pages, both
National Indian Gaming Commission gaming tribe reports, the 2008 petitioner
list and Tulalip Resolution 2024-473. Every source record still says
`history.status: live`. Sources that are gone or moved need an archived copy
or a new address, and their status set; the lint from decision record 0014
will then catch them going forward.

## Gaming operations (row 16)

Both National Indian Gaming Commission Gaming Tribe Reports that the 164
`operates_gaming` facts and the 93 machine-extracted facility lists cite now
return 404, after the commission redesigned its site. The Internet Archive has
no copy of the alphabetical report and a May 23, 2025 copy of the by-state
report (found with the archive.org "available" lookup; the archive itself
could not be reached from the review environment). These facts cannot be
re-checked against their cited sources until the lead author finds a current
copy or the archived one is downloaded by hand.

## Governing documents (row 10)

Follow-up, Nov. 22: every one of the 1,577 links has since been checked, not just a sample; see the [governing document link review](2026-11-22-governing-documents-full.md).

The script downloaded each of the 1,577 governing document links and confirmed a link automatically when the page names both the nation and the kind of document.

| Step | Links |
| --- | ---: |
| Confirmed by text | 1,220 |
| Not fetched (refused 190, no response 41, server error 17, gone 13, other 1) | 262 |
| Sent to reviewers | 95 |

A reviewer checked a random sample of 60 automatic confirmations: 23 were the
document itself, 36 were a page that names or links to it (mostly National
Indian Law Library tables of contents), and 1 was a different document (the
Native Village of Koyuk tribal code link). So "names the nation and the kind
of document" mostly means the page lists the document, which is title-only,
not the text. The lead author should not treat the 1,220 as read in full.

The 95 others, reviewed in full:

| Verdict | Links |
| --- | ---: |
| The document | 32 |
| A page that names or links to it | 13 |
| A different document | 19 |
| Error page or empty | 27 |
| Wrong nation | 2 |
| Cannot tell | 2 |

What needs a decision:

- **Wrong nation.** Two Native Village of Buckland (Alaska) documents from
  1950, a constitution and a corporate charter, are filed under the Lumbee
  Tribe of North Carolina profile.
- **Error page or empty (27).** Bot-check and CAPTCHA pages, sign-in pages, a
  parked domain, a 404, a retired host, and two addresses that now serve
  unrelated gambling pages (St. Croix and a Tohono O'odham address). The two
  gambling addresses should be removed whatever else is decided.
- **A different document (19).** Mostly nation home pages or law library pages
  that do not name the document. The reviewer marked a constitution link
  "different" when the linked page does not name the constitution, which the
  lead author may read as page-linking instead.

Nineteen of the 32 confirmed documents were scanned PDFs with no text layer;
the reviewer read them through OCR. The reviewer treated "Chanega" in the
documents as the village the dataset spells "Chenega", and the Papago Tribe as
the former name of the Tohono O'odham Nation.

## Government structure (row 12)

Of the 182 profiles whose government structure facts are historical, 174 also
list a current constitution among their governing documents. Eight do not:
Havasupai Tribe, Kickapoo Tribe in Kansas, Kickapoo Tribe of Oklahoma, Moapa
Band of Paiute Indians, Native Hawaiian Community, Sac and Fox Nation of
Missouri in Kansas and Nebraska, Seminole Tribe of Florida and Sokaogon
Chippewa Community. Seven of the eight have only historical facts; one has a
current fact but no current constitution listed. These are the profiles to
search for a current constitution, recording the search in the per-nation
search log if nothing is found.

## Applied

After this review was merged, a second, independent check of rows 21, 8 and 10 was run, and only the clear, mechanical changes that both checks agree on were made to records, each with a dated note. Everything that needs judgment stays in this review's files above for the lead author; no new review file was added. Scripts: `scripts/review/source_links.py`, `scripts/review/child_welfare_agents.py` and `scripts/review/governing_documents.py` (see `scripts/README.md`).

### Source links (row 21)

Session: [2026-11-22-source-link-check](../sessions/2026/2026-11-22-source-link-check.md). The second check requested 2,902 of the 4,617 addresses before it was stopped.

| Change | Sources |
| --- | ---: |
| `history.status: removed` (gone in both checks) | 9 |
| `history.status: moved`, new address in `history.changes` (same new address in both checks) | 2 |

The nine removed are the two National Indian Gaming Commission gaming tribe reports, the 2008 petitioner list, Tulalip Resolution 2024-473, two Guam court documents, a Navajo Judicial Branch quarterly report, the 2016 Michigan Indian directory and a vLex journal page. The two moved are Mont. Code Ann. § 2-1-301 (archive.legmt.gov to mca.legmt.gov) and an Oneida Indian Nation page (.com to .org). `archives` was not touched.

Not applied, because the checks disagree: five sources this review lists as gone answered 200 to the second check (three Cherokee Nation pages and two Crown-Indigenous Relations pages), and two others it lists as gone redirect to a longer address on the same site (Crown-Indigenous Relations). The lead author can decide these from the spreadsheet as before.

Correction to the table above: 760 of the 769 sources listed as "loads, but moved to another site" are FederalRegister.gov notices whose redirect goes to unblock.federalregister.gov, the site's CAPTCHA page for scripts. The second check looked up 316 of them through the FederalRegister.gov API by document number, and all 316 exist at their recorded addresses. They have not moved. Six more are Uniform Law Commission download addresses that hand the file to a signed link on a file host; the addresses still work.

### Indian Child Welfare Act designated agents (row 8)

Session: [2026-11-22-child-welfare-agents-reread](../sessions/2026/2026-11-22-child-welfare-agents-reread.md). The second check transcribed the Tribe column of every page image by eye ([`2026-11-22-child-welfare-agents-table.csv`](2026-11-22-child-welfare-agents-table.csv), 582 rows with the printed page) and found all 575 facts, as this review did with OCR.

| Change | Facts |
| --- | ---: |
| `locator` set to the page the nation's row is on, and a dated note that the row was re-read | 575 |
| `verification: read-in-full`, where this review's OCR also matched the name word for word | 70 |
| Note corrected: Chenega, which the table prints "Native Village of Chenega (aka Chenega)", not "(aka Chanega)" (checked at 300 dpi) | 1 |

The other 505 facts keep their level (inferred, or bulk-import for the five combined rows), because their names were matched word for word only in the transcription, not in machine-read text. The six Minnesota Chippewa band profiles were left without a fact for the lead author, as above.

### Governing documents (row 10)

Session: [2026-11-22-governing-documents-opened](../sessions/2026/2026-11-22-governing-documents-opened.md). Of the 1,760 governing document facts still recorded by title only, the second check set aside 151 that the constitutions pull request (#55, merged since) edits, 520 law codes and court rules that the tribal law texts work fetched, and 192 with no link. For the other 897 it read the text of each document from the copies the constitution catalog and tribal law texts work saved, without fetching anything new.

| Change | Facts |
| --- | ---: |
| `verification: read-in-full`: the document's heading gives its own title for its kind, it names the nation and the fact's title words and year, it is a full text, and this review also confirmed the link | 301 |

The 301 are 147 constitutions and 154 corporate charters: 271 University of Oklahoma transcriptions of the 1930s and 1940s texts and 30 copies on other sites, almost all the nations' own or their courts'. The check was tightened after reading the opening of every copy outside the University of Oklahoma pages that passed a looser version: a page that only mentions a constitution, such as a convention page, a code's definitions or a National Indian Law Library table of contents, does not count. The rest stay title-only and are covered by the spreadsheet above. No dead link was replaced, because no replacement was clear in both checks.

One lead for the lead author: four facts recorded as a constitution link to a University of Oklahoma corporate charter page (Angoon Community Association, Klawock Cooperative Association, Native Village of Barrow Inupiat Traditional Government, Native Village of Kotzebue); their kind or link needs correcting.

## Still for the lead author or Westlaw

Rows 5 (KeyCite the legal history cases), 9 (Public Law 280), 13 (Alaska place-name languages), 14 (Alaska related entities), the duplicate groups in row 15, 18 (citator checks) and 22 (sensitivity flags) need the lead author or Westlaw and were not part of this review.
