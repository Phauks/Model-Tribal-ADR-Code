# Brief: does each listed court still operate?

A research dataset of Native nation profiles lists courts and justice institutions copied from two directories: the Tribal Law and Policy Institute directory of tribal justice systems (2022) and the National Indian Law Library nation pages (contact listings). No one checked whether each court still operates or whether the link still works. A script fetched, for each listing, the listing's own link and the nation's official website (from the federal Tribal Leaders Directory), and up to two pages linked from that website whose link text or address mentions court, judicial, justice, peacemaking or judge. Your job is a first-pass check that a law student will review.

Each item has: `item_id` (add it if missing: use the position in the file, starting at 1, prefixed by the batch name), `profile`, `fact_number`, `fingerprint`, `nation`, `source`, `kind`, `name`, `link`, `as_of`, `nation_sites`, and `pages`. Each page has `url`, `status` (HTTP status, or null with `error`), `final` (address after redirects), `title`, `court_snippets` (text around the words court, judicial, justice, peacemaking or judge) and sometimes `court_links` (link text and address found on the page) and `via` (the page it was linked from).

For each item decide `verdict`:
- `confirmed`: a page on the nation's own website or an official court website, fetched now, shows a court or institution of this kind for this nation that appears to operate now (for example a court page with contact details, judges, filing information, hours, or a court name in the site's navigation). The court's name may differ slightly; record the name the page uses.
- `confirmed-other-name`: confirmed, but under a clearly different name (for example "Tribal Court" listed, page shows "Judicial Branch" with a Supreme Court and trial court). Give the page's name.
- `link-dead-court-found`: the listing's link fails or redirects to an unrelated page, but another fetched page confirms the court. Give the working address.
- `not-found`: the nation's website was fetched (status 200) but nothing about this court appears in the snippets or court links.
- `cannot-tell`: nothing usable was fetched (errors, 403, no website), or the snippets are ambiguous.

Rules:
- Use only the item data. Do not browse.
- A page from a third party (a directory, Wikipedia, a law firm, a news story) does not confirm a court.
- A single mention like "Court" in a long menu is enough only if the link or snippet clearly belongs to this nation's site.
- `not-found` does not mean the court closed; the reviewer will decide.

Output: write a JSON array to the output path you are given, one object per item, in input order: {"profile": "...", "fact_number": 12, "fingerprint": "...", "verdict": "confirmed|confirmed-other-name|link-dead-court-found|not-found|cannot-tell", "evidence_url": "the page that shows it, or null", "name_on_page": "or null", "working_link": "a working address for the court page if different from the listed link, or null", "reason": "one short sentence"} Write valid JSON only. When done, reply with the counts of each verdict and nothing else.
