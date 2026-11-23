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

## Pages that only mention a court

The lead author decided on Nov. 22, 2026 that a page on the nation's own site that only mentions a court (a news post, notice or home page) does not count as the court's link. The eight courts where that was the only page found (Cow Creek, Mescalero, Mississippi Choctaw twice, Omaha, Turtle Mountain twice and Winnemucca) stay without a link, and their rows keep the question in `for_lead_author` for the record.

## Second search, Nov. 23, 2026

A second, deeper search looked for the 170 services left without a link. It went beyond the nation's own website: Claude ran 76 web searches (of the 150 allowed), by court or program name and state, by nation name with "tribal court" and with `site:` the nation's domain, and read the state judicial branch, state bar and intertribal lists of tribal courts the searches turned up. It fetched 59 candidate pages, of which 8 refused the request or sent a challenge page and were logged as blocked. A link counted only where a fetched page names the service, in the lead author's order; a page that only mentions the court still did not count. The session is [`2026-11-23-service-links-second-search.md`](../sessions/2026/2026-11-23-service-links-second-search.md), and every search and page read, finds included, is in the nation's search log.

It linked 29 of the 170: 8 to the service's own page and 21 to an official directory entry. 141 still have no link.

| Kind | Own page | Directory entry | Still none | Searched |
| --- | ---: | ---: | ---: | ---: |
| `tribal-court` | 6 | 21 | 132 | 159 |
| `peacemaking-program` | 1 | 0 | 7 | 8 |
| `healing-to-wellness-court` | 1 | 0 | 0 | 1 |
| `peacemaking` (forum) | 0 | 0 | 1 | 1 |
| `circle-process` (forum) | 0 | 0 | 1 | 1 |
| **Total** | **8** | **21** | **141** | **170** |

With the first pass, the 432 services now stand at 168 own pages, 123 directory entries and 141 with no link.

Own pages found:

- Fort Belknap Indian Community (two entries): the nation's page headed "Courts", with the court's code and filing forms.
- Mississippi Band of Choctaw Indians (two entries): the "Judicial System" section of the nation's Tribal Government page, which describes the Choctaw Tribal Courts.
- Mescalero Apache Tribe: the nation's page "Mescalero Tribal Court".
- Ely Shoshone Tribe: the Judicial Center entry on the nation's Departments page.
- Mashpee Wampanoag Tribe, Peacemaker Court: the nation's page "About Peacemakers Court".
- Coos, Lower Umpqua and Siuslaw, Wellness Court: the nation's Tribal Court & Peacegiving Court page, which names the Healing to Wellness Court.

Directory entries found:

- South Dakota Unified Judicial System, [Tribal Courts](https://ujs.sd.gov/tribal-courts/): Oglala Sioux, Lower Brule Sioux and Crow Creek Sioux (two entries each). The Oglala Sioux Judiciary entry had already been linked to the same page by the individual courts review, so only its review row changed.
- North Dakota Court System, [Tribal Courts](https://www.ndcourts.gov/other-courts/tribal): Standing Rock Sioux, Three Affiliated Tribes (Fort Berthold) and Turtle Mountain Chippewa (two entries each).
- Nebraska Judicial Branch, [Consortium of Tribal, State, and Federal Courts](https://nebraskajudicial.gov/administration/committees-commissions/access-justice-commission-committees/consortium-tribal-state-and-federal-courts) member list: Omaha Tribal Court and Santee Sioux Nation Tribal Court (two entries).
- New Mexico Tribal-State Judicial Consortium, [list of tribal courts](https://tribalstate.nmcourts.gov/contact/): Pueblo of Sandia and Pueblo of San Ildefonso (two entries each).
- Oregon Judicial Department, [Oregon Tribal Court Contact Information](https://www.courts.oregon.gov/programs/jcip/Documents/Tribal%20contact%20info.pdf): Cow Creek Band of Umpqua.
- Bureau of Indian Affairs, [Southern Plains CFR Court](https://www.bia.gov/CFRCourts/southern-plains-cfr-court), list of the Tribes it serves: Apache Tribe of Oklahoma.

Five of these settle earlier questions in `for_lead_author` about a news post or notice (Cow Creek, Mescalero, Mississippi Choctaw twice, Omaha and Turtle Mountain twice): a better page or a directory entry was found, so the question is replaced. For Fort Berthold the court's own site, https://fbdcourt.com/, still refused the request; the North Dakota list is the link until a person can open that site.

What needs a decision (`for_lead_author`):

- Own pages to confirm, because the court has no page of its own on the nation's site: Fort Belknap ("Courts" holds only forms), Mississippi Choctaw (a section of the Tribal Government page) and Ely Shoshone (an entry on the Departments page).
- Directory entries to confirm: the South Dakota list gives each Tribe's own office under "South Dakota Tribal Court Contact Information", not a court office; the North Dakota list gives only the nation's name and website; the New Mexico entry for San Ildefonso sits under "Tribal Courts" and links the court handbook but is headed with the Pueblo's name.
- Apache Tribe of Oklahoma: the link is a Court of Indian Offenses that serves the Tribe, while the entry's kind is `tribal-court`.
- Three Alaska villages left without a link whose 2022 Alaska Tribal Court Directory entry the lead author could accept, though it does not say the court is active: Napakiak (active-court answer blank, a contact to open a case), Oscarville (blank, the Council named as the justice system) and Chitina ("Currently developing").

Still no link, and why:

- 101 Alaska services: most villages have no website of their own, and the 2022 Alaska Tribal Court Directory either could not reach the Tribe or answers that it has no active court. Web searches for the villages with a website found no court page.
- Arizona (Ak-Chin, Havasupai, Tonto Apache, Yavapai-Prescott, Fort McDowell): the Arizona courts publish no tribal court list; the lists found are a state health agency's, a child-welfare agency's and an insurer's, which are not official court directories.
- Montana (Chippewa Cree), Minnesota (Grand Portage), Nevada (Duckwater, Yerington, Winnemucca), California (Big Valley, Capitan Grande, Pulikla), Texas, Louisiana, Oklahoma (Tonkawa, Alabama-Quassarte), Rhode Island, Florida and Alabama: no court page of the nation's own and no official list came up. The Minnesota Judicial Branch site and the Nevada courts' tribal resource file refused the request; a person could open them.
- Seven peacemaking programs and two forums: the nation's court pages do not name them (Chitimacha, Karuk, Nez Perce, Habematolel Pomo), the program has only its code chapter (Kickapoo of Texas, Pit River, Chippewa Cree circle sessions), or the site refused the request (Mashantucket Pequot, Snoqualmie).

Method: `second` in [`scripts/review/service_links.py`](../../scripts/review/service_links.py) checks that each link in `SECOND_DECISIONS` was fetched with status 200, updates the review rows, rewrites the CSV and adds the searches to the search logs from the search list kept in the work folder; `apply` then set `link` and added a sentence to `note` on 28 facts in 18 profiles. No `verification` level changed and no service was removed. There was no second reader.
