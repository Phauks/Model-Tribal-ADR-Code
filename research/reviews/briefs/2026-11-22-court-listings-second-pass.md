# Brief: second pass on courts the first review could not confirm

The Nov. 21, 2026 review ([brief](2026-11-21-court-listings.md)) checked 690
courts that the dataset copied from two directories (the Tribal Law and Policy
Institute directory of tribal justice systems, 2022, and the National Indian
Law Library nation pages). It could not confirm 328: 170 `not-found` (the
nation's website was read and showed no court) and 158 `cannot-tell` (nothing
usable was fetched). The lead author approved a second, deeper look on Nov.
22, 2026. A law student will review your verdicts; each is a lead, not a
finding.

`scripts/review/court_listings_second_pass.py gather` wrote one item per court
to `WORK_DIRECTORY/evidence.json`, and every address it fetched, with its HTTP
status, to `WORK_DIRECTORY/fetch-log.json`. Each item has:

- `item_id`, `profile`, `nation`, `source`, `kind`, `name`, `listed_link`,
  `listed_as_of`, and the first pass's verdict, reason and pages;
- `listed_link_now`: the listed link fetched again (status, final address,
  title, passages around court words);
- `site_search`: for the nation's official website (and the listed link's own
  site when that is not a directory), the home page's court links and
  passages, the sitemaps tried and the court addresses in them, and up to five
  court pages read (`pages`: status, title, `court_snippets`, `signals` such
  as phone, judge, clerk, hours, filing), plus addresses its robots.txt
  disallowed;
- `directories`: each court directory checked, whether it could be read, and
  the passages (or, for the Alaska Tribal Court Directory, the court fields of
  the entry) that name the nation (`matched_key` is the name searched for);
- `national_indian_law_library`: the nation page the listing may have come
  from;
- `law_documents`: law codes and court rules the project collected (Nov. 21,
  2026) for the nation, with any passage that establishes a court.

## Verdicts

Give one `verdict` per item:

- `confirmed`: a page fetched now with status 200 shows this court for this
  nation, operating now (contact details, judges, filing information, hours, a
  docket, forms, or the court in the site's navigation). The page is on the
  nation's own website or the court's own website, or it is an official
  directory: a state court system's list of tribal courts or the Bureau of
  Indian Affairs. For the Alaska Tribal Court Directory (published in the
  Alaska Court System's court directory, prepared from a 2021 survey by Alaska
  Legal Services Corporation), an entry that answers "Yes" to "Active Court or
  Tribal Justice System" confirms the court as of that survey: use
  confidence `medium` and say so.
- `confirmed-other-name`: confirmed, but the page names it clearly differently
  (for example a Tribal Council acting as the court, a Judicial Branch, a
  Peacemaking Court). Give the page's name in `name_on_page`.
- `served-by-intertribal-court`: the nation's cases go to an intertribal court,
  shown by that court's own list of member or participating nations (the
  Intertribal Court of Southern California, the Northwest Intertribal Court
  System). Say whether the nation also seems to keep its own court.
- `served-by-court-of-indian-offenses`: the Bureau of Indian Affairs list of
  Courts of Indian Offenses names the nation.
- `link-dead-court-found`: the listed link fails, or redirects to an unrelated
  page, and another page fetched with status 200 confirms the court. Give the
  working address in `working_link`; it must be on the nation's own site or
  the court's own site.
- `not-found-after-search`: the nation's site was read (home page, sitemap or
  court pages) or a directory was read, and nothing confirms the court. Use
  this also when an official directory says the nation has no active court;
  say so in the reason, because that contradicts the listing.
- `cannot-tell`: nothing usable was read (no website on record, every page
  blocked or failing, and no directory names the nation), or the evidence is
  ambiguous.

## Rules

- Use only the item data and the fetch log. Do not browse.
- Cite only addresses the fetch log shows with status 200 (or, for
  `law_documents`, `http_status` 200).
- A news story, Wikipedia, Ballotpedia, a law firm, the Tribal Court
  Clearinghouse list, the National Indian Law Library and other third-party
  pages cannot confirm a court; they can be `supporting_urls`.
- A law code or court rules that establish the court show it exists in law,
  not that it operates now: record that address in `court_in_law` and do not
  confirm on it alone.
- A regional nonprofit's page (for example Tanana Chiefs Conference) that
  mentions a village's court is supporting only.
- A passage about another court (a state court, the United States Supreme
  Court, a "food court", a person named Courtney) is not evidence.
- `not-found-after-search` does not mean the court closed; the lead author
  decides.
- Do not copy names, telephone numbers or email addresses of court staff into
  the output.

## Output

A JSON array, one object per item, in input order:

```json
{"item_id": "court-001", "verdict": "confirmed", "evidence_kind": "nation-website | court-website | state-court-directory | bureau-of-indian-affairs-list | intertribal-organization | null", "evidence_url": "address fetched with status 200, or null", "supporting_urls": [], "name_on_page": "or null", "working_link": "or null", "court_in_law": "address of a law code or court rules establishing the court, or null", "confidence": "high | medium | low", "reason": "one or two sentences"}
```

## Second reader

A second reading covers every item not `confirmed` or `confirmed-other-name`,
and a fixed random sample of 10 percent of the confirmations (seed 20261122,
rounded up), with the same item data. It writes the same object with its own
verdict and a `second_reader_note` saying whether it agrees and why. Where the
readings disagree, the second reading's verdict stands and both are kept.

## How this review was actually run

No tool for starting separate reviewer agents was available in the session
that ran this review, so Claude (AI assistant), in that one session, read
every item itself against this brief. The second reading was a re-reading by
the same session, not an independent reader: it re-read the evidence for the
items above, and where it saw a gap (a profile listing only one of a nation's
states, a website that says it has moved, a second website on record that the
first gathering skipped) it had the script gather that evidence and read it.
Treat agreement between the two readings as one reader checking its own work.
