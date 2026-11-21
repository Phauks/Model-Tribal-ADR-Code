# Data gap review, Nov. 21, 2026

This review follows up three rows of the
[dataset gap audit](../analyses/2026-11-21-dataset-gap-audit.md): row 7
(facts joined to a nation by name), row 1 (compact dispute clauses copied from
another nation's compact) and row 11 (courts copied from directory listings).
AI reviewers wrote every verdict here. They are leads for the lead author, not
findings, and no profile was changed. Changes the lead author accepts are made
in a separate pull request, as [the reviews README](README.md) requires.

Each spreadsheet has an empty `lead_author_decision` column.

| Review | Items | Files |
| --- | --- | --- |
| Name joins (row 7) | 3,778 label and nation pairs behind 4,309 facts | [`.json`](2026-11-21-name-joins.json), [`.csv`](2026-11-21-name-joins.csv) |
| Compact dispute clauses (row 1) | 256 compact facts | [`.json`](2026-11-21-compact-clauses.json), [`.csv`](2026-11-21-compact-clauses.csv) |
| Court listings (row 11) | 690 court and justice institution facts | [`.json`](2026-11-21-court-listings.json), [`.csv`](2026-11-21-court-listings.csv) |
| Counts for all three | | [`2026-11-21-data-gap-review-counts.json`](2026-11-21-data-gap-review-counts.json) |

The verification levels written to the profiles on the same day are a
separate review, listed in [the reviews README](README.md).

## Name joins

`scripts/review/name_matches.py gather` listed every fact whose note says it
was matched to the nation by name, beside the label its source prints. Facts
from the Public Law 280 statutes and the Alaska place-name and region lists
were left out, because the audit sends those to the lead author (rows 13 and
14). The script marks a pair `exact` when the label and the nation's name, or
one of its other names, are the same after case, punctuation and common words
such as "Tribe" and "of the" are dropped.

| Match | Verdict | Pairs |
| --- | --- | ---: |
| exact | same (no reviewer) | 1,752 |
| review | same | 1,991 |
| review | unsure | 25 |
| review | different | 10 |

How the 2,026 other pairs were reviewed: a first pass by small-model
reviewers ([brief](briefs/2026-11-21-name-joins-first-pass.md)); a second
look at the 139 pairs the first pass did not accept, and a re-check by a
larger model of the 1,176 pairs it did accept
([brief](briefs/2026-11-21-name-joins-recheck.md)), after a 100-pair sample
found the first pass wrong about 3 percent of the time. The second-pass
verdict is the one recorded.

What needs a decision:

- **Different (10 pairs, 21 facts).** Component bands joined to the umbrella
  nation. Eight Minnesota Chippewa Tribe pairs are the gaming ordinances,
  compact and report rows of the Bois Forte, Fond du Lac, Grand Portage, Leech
  Lake, Mille Lacs and White Earth bands, which game under their own names.
  Two Paiute Indian Tribe of Utah pairs are rows of the Kanosh and Shivwits
  bands in Haas (1947), table B. The likely fix is to move each fact to the
  band's own profile, or drop it where the band has no profile.
- **Unsure (25 pairs).** Fourteen are Oklahoma Tribal Statistical Areas
  shared by several nations (Kiowa-Comanche-Apache-Fort Sill Apache,
  Caddo-Wichita-Delaware, Citizen Potawatomi Nation-Absentee Shawnee). The
  question is whether a profile lists a shared area as its own. Four are
  membership lists that name a nation and its component councils in one
  entry (Passamaquoddy, Te-Moak, Minnesota Chippewa Tribe). Five are state
  reservations or state-designated areas whose link to the profile rests on
  other lists (Tama, Poospatuck, Santee, Schaghticoke, Waccamaw). One is a
  HUD allocation row cut off at "Mi" and joined to the Mi'kmaq Nation.
- One source problem: on the Office of Indian Gaming compact list page the
  Tribe column is sometimes out of line with the document title. Reviewers
  judged those rows by the title, which names the nation.

## Compact dispute clauses

`scripts/review/compact_clauses.py gather` took each `gaming.compacts[]` fact
whose note says "nation-specific text not checked", downloaded that nation's
own compacts, amendments and Secretarial Procedures for the same state from
the Office of Indian Gaming list, extracted the text, and cut out the sections
whose headings name dispute resolution. A first pass by small-model reviewers
([brief](briefs/2026-11-21-compact-clauses-first-pass.md)) and a second pass
by a larger model that read the full text of every document
([brief](briefs/2026-11-21-compact-clauses-second-pass.md)) each compared the
current summary with the nation's governing document. The second pass is the
one recorded; the two agreed on 188 of 256. Every quotation in the file was
checked word for word against the extracted text.

| Verdict | High confidence | Medium | Total |
| --- | ---: | ---: | ---: |
| same: the copied summary is right for this nation's own compact | 109 | 15 | 124 |
| differs: the nation's own clause says something else | 100 | 27 | 127 |
| cannot-tell | 3 | 2 | 5 |

By state, the copied summaries held up in Arizona (20 of 21 same), Oklahoma
(30 of 35), New Mexico (16 of 18), Michigan (10 of 10), Kansas, North Dakota
and Louisiana. They mostly failed in California (62 of 79 differ, chiefly
because the newer compacts add an optional JAMS or AAA arbitration step),
Washington (21 of 28 differ: older compacts let either party elect AAA or JAMS
arbitration after a 10-day meeting), Wisconsin (10 of 10), Nevada (7 of 9),
South Dakota (5 of 7) and Montana (5 of 6). Seventeen nations game under
Secretarial Procedures rather than a compact; those have no tribe-state
dispute process of the copied kind, and the proposed summary says so.

Each row gives the governing document, a pinpoint (`locator`), a quotation, a
`proposed_summary` where the verdict is `differs`, and the differences.

The five `cannot-tell` items: Red Lake (the 1991 video games compact the
summary describes is not among the listed documents), San Pasqual (the 2018
compact's text came out with only its contents and appendices), Seneca-Cayuga
(scanned, no text layer), Tolowa Dee-ni' (no compact documents listed) and
Yavapai-Prescott (the 2022 amended and restated compact is referred to but its
text is not in the listed file). Each needs the document fetched by hand.

## Court listings

`scripts/review/court_listings.py gather` fetched, for each court listed from
the Tribal Law and Policy Institute directory (2022) or a National Indian Law
Library nation page, the listing's link, the nation's official website and up
to two court pages that website links to. One pass of AI reviewers read the
passages around court words ([brief](briefs/2026-11-21-court-listings.md)).

| Verdict | National Indian Law Library | Tribal Law and Policy Institute | Total |
| --- | ---: | ---: | ---: |
| confirmed | 156 | 122 | 278 |
| confirmed-other-name | 23 | 14 | 37 |
| link-dead-court-found | 15 | 32 | 47 |
| not-found | 92 | 78 | 170 |
| cannot-tell | 90 | 68 | 158 |

`not-found` means the nation's website was fetched and no court text was
found on it or on the pages it links to. It does not mean the court closed:
many nations keep court pages off their main site. `cannot-tell` is mostly
sites that refused the request (403) or nations with no website on record.

Of the 378 verdicts that cite a page, 337 cite a page exactly as fetched and
36 cite the same page in another form (http or https, `www.` or not, a
trailing slash, a different letter case, or the same page with a longer or shorter path). Five cite an address that was not
fetched and should be treated as unconfirmed: Menominee
(`courts.menominee-nsn.gov`, the judiciary page fetched was on the main site),
Taos Pueblo (`taospueblo-nsn.gov`, fetched as `taospueblo.org`), Quapaw (the
same page under another address form) and two Intertribal Court of Southern
California items (`intertribalcourt.org`, not fetched).

The 47 `link-dead-court-found` rows give a working address. Replacing the
listed link with it is a clear fix once the lead author agrees.

## Clear fixes applied

Two kinds of finding needed no decision, and `scripts/review/gap_review.py
apply` made them in a separate pull request on Nov. 21, 2026:

- 96 compact dispute clauses that both reviewers, with high confidence, found
  the same in substance as the nation's own compact now cite that compact (96
  new source records) with the reviewers' pinpoint, at `read-in-full`. Their
  summaries did not change. The other 28 `same` items (13 where the passes
  disagreed, 15 at medium confidence) still cite the copied compact.
- 42 courts whose listed link no longer reached them now link to the court's
  page on the nation's own site, which the review fetched; the note keeps the
  listed link. The other 5 `link-dead-court-found` rows (Seneca Nation, four;
  Muscogee Nation, one) name a page the review did not fetch, so they wait.

Everything else waits for the lead author's decisions.

## Limits

- Every verdict is AI-written. In the provision pre-review a second pass
  changed 53 of 114 hard cases, so a single-pass verdict, as for courts, is a
  lead only.
- Name joins were judged from names, other names and states alone, without
  browsing.
- Compact text came from `pdftotext`; scanned compacts and garbled text
  limit what could be read.
- Websites change. The court verdicts hold for Nov. 21, 2026.
