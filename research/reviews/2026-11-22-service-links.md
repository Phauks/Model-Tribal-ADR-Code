# Service links, Nov. 22, 2026

The lead author set a rule on Nov. 22, 2026: "If we list a service, it should have a link." A service is an entry in a profile's `justice_institutions` or `dispute_resolution.forums`. On `main` that day, 432 services in 305 profiles had no `link`: 408 tribal courts, most copied from the National Indian Law Library nation pages and the Tribal Law and Policy Institute directory; 15 peacemaking programs; 3 peacemaking forums; and 6 others. The lead author chose the order for each link:

1. the service's own official page, on the nation's website or the court's or program's own website, fetched and showing the service;
2. only where no such page exists, the official directory entry that lists the service, said to be a directory in the fact's note;
3. where neither is found, no link, with the search recorded in the nation's search log. No service is deleted.

This pass gave 262 of the 432 a link: 160 own pages and 102 directory entries. The other 170 keep no link and stay listed; each has a search log entry for every place looked. No service was removed, and no `verification` level was changed.

| File | What it holds |
| --- | --- |
| [`2026-11-22-service-links.json`](2026-11-22-service-links.json) | One record per service: profile, section, kind, name, source, the old link (none), the new link, the rule used (`own-page`, `directory` or `none-found`), what it is based on, the evidence, the date the page was fetched, the note added to the fact, whether the link was checked against a fetch log, and any question for the lead author |
| [`2026-11-22-service-links.csv`](2026-11-22-service-links.csv) | The same as a spreadsheet, with an empty `lead_author_decision` column |
| [Search logs](../search-logs/README.md) | An entry for every place looked, added to `research/search-logs/courts/<letter>/<profile id>.yaml` for courts (200 logs extended, 93 new) and `research/search-logs/dispute-resolution/<letter>/<profile id>.yaml` for peacemaking programs and forums (11 extended, 8 new) |

## Results

| Kind | Own page | Directory entry | None found | Total |
| --- | ---: | ---: | ---: | ---: |
| `tribal-court` | 147 | 102 | 159 | 408 |
| `peacemaking-program` | 7 | 0 | 8 | 15 |
| `peacemaking` (forum) | 2 | 0 | 1 | 3 |
| `other` (Yurok Justice Center) | 2 | 0 | 0 | 2 |
| `court-of-appeals` | 1 | 0 | 0 | 1 |
| `traditional-forum` | 1 | 0 | 0 | 1 |
| `healing-to-wellness-court` | 0 | 0 | 1 | 1 |
| `circle-process` (forum) | 0 | 0 | 1 | 1 |
| **Total** | **160** | **102** | **170** | **432** |

Where the own pages come from:

- 108 from the Nov. 21 court review ([`2026-11-21-court-listings.json`](2026-11-21-court-listings.json)): the court was confirmed on a page of the nation's or the court's own site that the review fetched with status 200.
- 20 from the Nov. 22 second pass ([`2026-11-22-court-listings-second-pass.json`](2026-11-22-court-listings-second-pass.json)), whose evidence was the nation's or the court's own website (`evidence_kind` `nation-website` or `court-website`, `evidence_checked` true).
- 9 from the same court listed twice in one profile, once with a link the court review confirmed (for example a National Indian Law Library "Tribal Court" and the Tribal Law and Policy Institute's named court). The note names the other entry.
- 23 decided by hand from pages read on Nov. 22, 2026, listed under "Decided by hand".

Where the directory entries come from: 99 from the second pass's evidence, and 3 decided by hand (Healy Lake Village and the two Mekoryuk entries, where the nation's home page names the court but has no court page). By directory: 83 Alaska Tribal Court Directory (Alaska Court System), 8 Washington State Court Directory, 1 Washington Tribal State Court Consortium directory, 4 New Mexico Tribal-State Judicial Consortium roster, 1 California Tribal Courts Directory, 2 Intertribal Court of Southern California member list, 2 Northwest Intertribal Court System list, and 1 Bureau of Indian Affairs list of Courts of Indian Offenses (Wichita and Affiliated Tribes).

Every new link was checked against a fetch log: this review's own, or the pages the two court reviews recorded as fetched with status 200. None failed the check.

## The Navajo Nation Peacemaking Program

The `justice_institutions` entry "Navajo Nation Peacemaking Program (Hózhóójí Naat’áanii)" now links to https://courts.navajo-nsn.gov/indexpeacemaking.htm, the page the Judicial Branch sidebar links. Fetches of that page through the proxy were often cut off: two of six tries by hand returned status 200 and four failed. The page is titled "The Navajo Nation Peacemaking Program". Its main frame, `Peacemaking/peacemain.htm`, is headed "Peacemaking Program of the Navajo Nation" and describes Hózhóji Naat’aah. The note also names the program's Plan of Operations (https://courts.navajo-nsn.gov/Peacemaking/Plan/peace.html), which the profile's published materials already cite.

## Decided by hand

Claude read each of these pages on Nov. 22, 2026. The decisions are in `DECISIONS` in [`scripts/review/service_links.py`](../../scripts/review/service_links.py), each with its evidence:

- Own page found on a court site the profile already links, under the program's name: Colville Tribes Peacemaker Circle, Coos, Lower Umpqua and Siuslaw Peacegiving Court, Leech Lake Bamenim Anishinaabeg Program, Oneida Nation Peacemaking and Mediation, Pueblo of Isleta Tribal Court Peacemaking Program, Chickasaw Nation Peacemaking Court (two entries), Spirit Lake Traditional Court (named as a division of the Tribal Court), Wilton Rancheria Traditional Court, Navajo Nation Peacemaking Program.
- Own page that an earlier review named but did not record as fetched, or a better page on the same site: Blue Lake Rancheria, Lac du Flambeau (two entries), Jamestown S’Klallam, Pueblo of Taos, Pueblo of Santa Ana (two entries), Seneca Nation Cattaraugus Court of Appeals, Tohono O’odham Judicial Courts, Ute Mountain Ute CFR Courts.
- Hopland Band of Pomo Indians (two entries): the nation's website links its Tribal Court to the Northern California Intertribal Court System's site, which is now the link.
- St. Croix Chippewa: the nation's home page, which the profile already uses for the same court.
- Not linked: seven courts the second pass confirmed only from a news post or notice on the nation's site (Cow Creek, Mescalero, Mississippi Choctaw twice, Omaha, Turtle Mountain twice), because a post is not the court's own page and no official directory lists the court; Winnemucca and Fort Berthold (two entries), where only the home page names the court; and five peacemaking entries whose pages do not name them or whose site refused the request.

## What needs a decision

The `for_lead_author` column marks 17 services:

- Links to check: the Colville Peacemaker Circle page does not say it covers the juvenile circle named in the code; the Hopland links go to an intertribal court's site that does not name Hopland; the St. Croix link is the nation's home page; the Ute Mountain Ute page shows a Court of Indian Offenses, while the entry's kind is `tribal-court`.
- Pages that refused the project's link checker and that a person could open in a browser: https://fbdcourt.com/ (Fort Berthold District Court, linked from the nation's home page), https://www.mptn-nsn.gov/ (Mashantucket Pequot), https://snoqualmietribe.us/ (Snoqualmie). Among the services still without a link, the sites on record for these nations also refused the request (logged as blocked): Fort McDowell Yavapai Nation (fmyn.org), Poarch Band of Creek Indians (pci-nsn.gov), Yerington Paiute Tribe (yeringtonpaiute.us), Miccosukee Tribe (miccosukee.com), Tonkawa Tribe (tonkawatribe.com), Standing Rock Sioux Tribe (standingrock.org) and Native Village of False Pass (apiai.org). Four more nations whose sites refused it now link to a directory entry: Kwigillingok, Minto, the Ute Indian Tribe of the Uintah and Ouray Reservation and the Wichita and Affiliated Tribes.
- Whether a news post, notice or home page that names a court is enough for a link where nothing better exists: Cow Creek, Mescalero, Mississippi Choctaw, Omaha, Turtle Mountain, Winnemucca. The candidate page is in the column.

## Method and limits

[`scripts/review/service_links.py`](../../scripts/review/service_links.py) `gather` listed every service with no link and joined it to the two court reviews by profile, source and name, and to the linked entries of the same profile. Where those gave no own page, it read the nation's website as the second pass did (robots.txt obeyed, sitemap, up to five court pages) and, for peacemaking programs and forums, the court pages the profile links to. Pages the second pass had already fetched were read from its saved copies, not fetched again: of the 1,176 addresses read, 440 were fetched on Nov. 22 for this review, of which 395 answered with status 200, 43 failed and 2 refused the request. `merge` applied the lead author's order and the hand decisions and wrote the review files and the search log entries; `apply` set `link` on the 262 facts and added a sentence to each note saying where the link came from and when it was fetched. It kept the earlier note text and changed no other key; only the edited facts' lines changed in the 177 profiles.

Limits:

- A link shows where the service is described. It does not show that the service operates now; the court reviews' verdicts say what is known about that.
- The directory entries are only as current as the directories: the Alaska Tribal Court Directory reflects a 2021 survey.
- No search was made beyond the nation's own website, its court pages and the directories the second pass read. A web search might find court pages on sites the profile does not record.
- No tool for starting separate reviewer agents was available, so Claude, in one session, read the pages and made the hand decisions. There was no second reader.
- `scripts/lint_records.py` now reports a service with no link (check `service-link`): an error for a new or changed service, a warning for the 170 left here.
