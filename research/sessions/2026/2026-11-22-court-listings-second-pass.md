---
id: 2026-11-22-court-listings-second-pass
date: '2026-11-22'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: page-fetch
  name: curl
  detail: scripts/review/court_listings_second_pass.py gather fetched 1,511 addresses (nation websites,
    their sitemaps and up to five court pages each, the listed links, and the court directories),
    obeying robots.txt; 166 were refused (logged as blocked, not worked around) and 264 failed.
- kind: web-search
  name: web search
  detail: Used to find the official court directories (state court systems, Bureau of Indian Affairs,
    intertribal courts); no search result was used as evidence.
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: No tool for starting separate reviewer agents was available, so Claude, in the one lead
    session, read all 328 items against the brief, then re-read the 183 not confirmed and a seeded 10
    percent sample of the confirmations; the re-reading had the script search two more kinds of site
    and changed four verdicts.
- kind: other
  name: python3 script
  detail: scripts/review/court_listings_second_pass.py (gather, merge, apply).
purpose: Second pass on row 11 of the dataset gap audit, approved by the lead author on Nov. 22, 2026,
  for the 328 directory-listed courts the Nov. 21 review could not confirm.
queries:
- California Courts tribal courts directory
- Washington State Court Directory tribal courts; Washington Tribal State Court Consortium directory
- New Mexico Tribal-State Judicial Consortium roster
- Michigan Supreme Court tribal courts in Michigan
- Wisconsin State-Tribal Justice Forum
- Minnesota Tribal Court/State Court Forum directory
- Arizona State, Tribal and Federal Court Forum
- Oklahoma tribal courts directory (state court system)
- Alaska Court System tribal court directory
- Bureau of Indian Affairs Courts of Indian Offenses
- Intertribal Court of Southern California member tribes; Northwest Intertribal Court System tribes
sources_added: []
limits: >-
  Only official directories (state court systems, the Bureau of Indian Affairs, an intertribal court's
  own list) and the nation's or court's own website confirmed a court. The Minnesota forum directory
  refused the request (403). No Oklahoma state court list was found. The Alaska Tribal Court Directory
  reflects a 2021 survey. Law codes show a court exists in law, not that it operates now. The second
  reading was the same session re-reading its own verdicts, not an independent reader.
---

Output:

- [the report](../../reviews/2026-11-22-court-listings-second-pass.md);
- one record per court, in [`.json`](../../reviews/2026-11-22-court-listings-second-pass.json)
  and [`.csv`](../../reviews/2026-11-22-court-listings-second-pass.csv), with an
  empty `lead_author_decision` column;
- every place searched, as one [search log](../../search-logs/README.md) per
  nation (226) under `research/search-logs/courts/`;
- the [brief](../../reviews/briefs/2026-11-22-court-listings-second-pass.md).

Results: 133 confirmed, 16 confirmed under another name, 10 served by an
intertribal court, 1 served by a Court of Indian Offenses, 4 with a dead link
and the court found elsewhere, 82 not found after search and 82 that cannot be
told. The four dead links (three Navajo Nation court pages and the Red Lake
court page) now link to the court's page on the nation's or the court's own
website. Each note keeps the listed link. Only `justice_institutions` was
changed. No court was removed.

Method: the script gathered the evidence for each court and wrote a log of
every fetch. Claude read each item against the brief and wrote a verdict that
cites an address from that log. The merge step checked every cited address
against the fetch log, or against `research/tribal-law/documents.json` for law
codes, and found none fetched with a status other than 200.

The second reading found three gaps in the first gathering:

- a profile that names only one of a nation's states (Washoe, whose court is
  in the California directory);
- a website on record that says the site has moved (Las Vegas Paiute);
- a second website on record that the gathering had skipped (San Carlos
  Apache, Oglala Sioux).

The script was changed to search the first two websites on record, plus a
site's announced new address. It was run again from its cache, and the new
evidence was read.

Data errors found are listed in the report for the lead author, including:

- a Comanche Nation court whose listed link is another nation's page;
- three websites that now belong to gambling sites: one listed link's site and two nation websites on record.
