# Court listings, second pass, Nov. 22, 2026

The [data gap review](2026-11-21-data-gap-review.md) checked 690 courts the
dataset copied from two directories (the Tribal Law and Policy Institute
directory of tribal justice systems, 2022, and the National Indian Law
Library nation pages). It could not confirm 328: 170 `not-found` and 158
`cannot-tell`. The lead author approved a deeper look at those 328 on Nov.
22, 2026. Every verdict is a lead, not a finding. Only four links were
changed in the profiles (see "Fixes applied"). No court was removed.

| File | What it holds |
| --- | --- |
| [`2026-11-22-court-listings-second-pass.json`](2026-11-22-court-listings-second-pass.json) | One record per court: verdict, evidence address, supporting addresses, any law code that establishes the court, confidence, reason, both readings, and whether every cited address was fetched with status 200 |
| [`2026-11-22-court-listings-second-pass.csv`](2026-11-22-court-listings-second-pass.csv) | The same as a spreadsheet, with an empty `lead_author_decision` column |
| [Search logs, topic `courts`](../search-logs/README.md) (`research/search-logs/courts/<letter>/<profile id>.yaml`) | One log per nation (226), per decision record 0025: every place searched for its listed courts, with date, method (script or AI review), kind of place, address, outcome and reason; 105 `found`, 60 `none-found`, 61 `partly-searched` |
| [Brief](briefs/2026-11-22-court-listings-second-pass.md) | Verdict definitions and rules, and how the review was actually run |

## Results

| Verdict | Courts | First pass `not-found` | First pass `cannot-tell` |
| --- | ---: | ---: | ---: |
| `confirmed` | 133 | 81 | 52 |
| `confirmed-other-name` | 16 | 7 | 9 |
| `served-by-intertribal-court` | 10 | 5 | 5 |
| `served-by-court-of-indian-offenses` | 1 | 0 | 1 |
| `link-dead-court-found` | 4 | 1 | 3 |
| `not-found-after-search` | 82 | 60 | 22 |
| `cannot-tell` | 82 | 16 | 66 |
| **Total** | **328** | **170** | **158** |

Every evidence and supporting address was checked against the fetch log (or,
for law codes, `research/tribal-law/documents.json`). None was fetched with a
status other than 200.

Where the confirmations come from:

- 109 from a state court system's directory. That is 97 `confirmed` and 12
  `confirmed-other-name`; 82 of them come from the Alaska Tribal Court
  Directory, at medium confidence.
- 40 from the nation's own website or the court's own website.
- 9 from an intertribal court's own list of the nations it serves.
- 1 from the Bureau of Indian Affairs list of Courts of Indian Offenses: the
  Wichita and Affiliated Tribes, Southern Plains.

The first pass mostly missed these because it read only the listed link and
one home page. Most confirmations came from official directories, and the
first pass did not read directories.

## Fixes applied

Four listed links failed or now go to an unrelated site, and the court's page
was found on the nation's or the court's own website. Each fact now links to
the page found. Its note keeps the listed link and points to this review.
These are the same kind of fix as `gap_review.py apply`. Only
`justice_institutions` was touched:

- Navajo Nation Judicial Branch, Supreme Court and Judicial District Courts.
  The navajocourts.org pages now redirect to an unrelated site. The new links
  are on courts.navajo-nsn.gov. The Supreme Court fact links to the Judicial
  Branch home page, because no separate Supreme Court page was fetched.
- Red Lake Band of Chippewa Indians Tribal Court. rlnn.org answers 502. The
  new link is redlakenation.org/courts/.

## What needs a decision

**`not-found-after-search` (82 courts).** Something was read and nothing
confirmed the court. This does not mean the court closed.

- 33 Alaska villages: the Alaska Tribal Court Directory, from its 2021
  survey, says the village had no active court ("Not currently", "Currently
  developing", or, for New Stuyahok, a council that is not currently active).
  This contradicts the listing.
- 13 Alaska villages: the directory could not reach the Tribe, and the
  village's own website was read and shows no court.
- 36 others: the nation's website was read (home page, sitemap, links that
  mention a court) and shows no court, and no official directory names it.
  Six of these (Ak-Chin, Havasupai, Yavapai-Prescott) are named only on a
  state health agency's contact list, which cannot confirm a court.

**`cannot-tell` (82 courts).** Nothing usable was read.

- 49 Alaska villages: the directory could not reach them, and no village
  website of their own is on record.
- 24 courts: the nation's website refused the automated request or failed.
  These are logged as blocked. They include Mashantucket Pequot, Mohegan,
  Standing Rock, Siletz, Poarch Creek, Fort McDowell and Yerington.
- 6 courts: the only website on record is a third party's page about the
  nation (a regional council, a state agency).
- 3 others: two Alaska directory entries leave the active-court question
  blank, and Kalskag has no directory entry of its own.

**Data errors to correct** (not changed here, because none of these is a
mechanical fix):

- Comanche Nation Children's Court (court-047): the listed link is the
  Citizen Potawatomi Nation's Judicial Branch page.
- Cahto Tribe (court-026): cahto.org now belongs to an unrelated gambling
  site.
- Oglala Sioux Tribe: the first website on record (oglalalakotanation.net) is
  now an unrelated gambling site. The Tribe's site is oglala.gov.
- Iñupiat Community of the Arctic Slope: the second website on record
  (inupiatgov.com) is now an unrelated gambling site.
- Las Vegas Paiute Tribe: the website on record says the Tribe's site has
  moved to lvpaiute.gov. The court was confirmed there (court-094), but the
  profile's contact and the court fact's empty link are left for a decision.

**Other judgment calls:**

- 16 `confirmed-other-name` courts. Twelve are Alaska villages where the
  Tribal Council serves as the justice system; four are courts known by
  another name (for example the Wind River Tribal Court for the Eastern
  Shoshone Tribe). Should the listed name stay?
- 10 `served-by-intertribal-court` courts: seven members of the Intertribal
  Court of Southern California, the Ute Indian Tribe (Northwest Intertribal
  Court System), and Bill Moore's Slough (an inter-tribal court with Kotlik
  and Hamilton).

## Method and limits

`scripts/review/court_listings_second_pass.py gather` searched each nation's
website, obeying robots.txt. It read the home page's court links and the
sitemap, and opened up to five court pages. It searched the first two
websites on record, plus one site whose home page says it has moved. The
script also:

- fetched the listed link again;
- read the official directories listed below;
- looked up the nation's law codes in the project's tribal law collection.

Directories read:

- state court systems: California, Washington (two directories), New Mexico,
  Michigan, Wisconsin, Arizona, and Alaska (the Alaska Tribal Court Directory);
- Bureau of Indian Affairs lists: Courts of Indian Offenses, and the 2020
  Federal Register list;
- intertribal courts: the Intertribal Court of Southern California and the
  Northwest Intertribal Court System;
- supporting only: the Southwest Intertribal Court of Appeals, Tanana Chiefs
  Conference, and the Tribal Court Clearinghouse.

Limits:

- The Minnesota Tribal Court/State Court Forum directory refused the request
  (403), so no Minnesota court was confirmed from a directory.
- No Oklahoma state court list of tribal courts was found.
- The Alaska directory reflects a 2021 survey.
- A law code that establishes a court (39 courts) shows the court exists in
  law, not that it operates now. It never confirmed a court by itself.
- Separate reviewer agents could not be started in this session. Claude (AI
  assistant) read every item against the brief, then re-read the 183 items
  not confirmed and a seeded 10 percent sample of the confirmations (15).
- The re-reading changed four verdicts:
  - Washoe, two courts: the California directory lists the court, but the
    profile names only Nevada.
  - Las Vegas Paiute: the site has moved.
  - San Carlos Apache: the Tribe's own site is the second on record.
  - For Oglala, it corrected the reason.
- Both readings are kept in the files. Because one reader checked its own
  work, agreement between the readings is weaker evidence than it would be
  with two independent readers.
- A search log's `found` means at least one listed court of the nation was
  confirmed or found to be served by another court. Other courts of the same
  nation may still be unresolved; the log's `next_steps` names them.
