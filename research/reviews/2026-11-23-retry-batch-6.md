# Retry of failed fetches, Nov. 23, 2026

On Nov. 23, 2026 the lead author asked that every document the project could not get be tried again, in other places. This review records what the retry found in the nations' own pages and codes, for the lead author to accept or reject before anything reaches a profile. It does not edit a profile.

The retry went back to every address that had failed in a search log (a refusal, a dead link, a timeout or a bot check) and to every link on the hand-pull list. Each address was first requested again directly. Where that still failed, the Wayback Machine's latest copy was read. Cloud sessions cannot open web.archive.org, so the copies were fetched by the repository's "fetch archived copies" workflow, which reads only Internet Archive addresses and never a nation's own site (`scripts/captures/fetch_archived_copies.py`). The project still does not try to get past a site's bot protection: a copy that holds only a bot check page is logged as `blocked`.

| File | What it holds |
| --- | --- |
| [`2026-11-23-retry-batch-6.csv`](2026-11-23-retry-batch-6.csv) | One row per retried address in a search log (186 rows, 133 logs): the address tried, the address read (often a Wayback Machine copy), the outcome, the reason, and an empty `lead_author_decision` column |
| [Search logs](../search-logs/README.md) | The same 186 entries, appended to `research/search-logs/courts/` and `research/search-logs/dispute-resolution/` (place kind `web-archive` where a Wayback copy was read) |
| [Capture index](../capture-index.csv) | The pages and documents kept, under `tribal-law/`, `tribal-courts/`, `stories/` and `canada/` (private unless the row says `redistribution: yes`) |

## Outcomes

| Topic | Found | Not found | Blocked | Dead link | Error | Total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `courts` | 59 | 37 | 11 | 10 | 5 | 122 |
| `dispute-resolution` | 14 | 38 | 2 | 8 | 2 | 64 |

A `dispute-resolution` log counts as `found` when the page read shows the nation's codes, a court or a dispute resolution forum, the test the data gap thread set for these pages (hand-pull list, Part 2f). A court alone is a lead, not a dispute resolution method; the lead author decides whether it belongs in the profile. Where the data gap thread's own reading of a log on Nov. 23 found no dispute resolution method (seven logs, among them Grand Portage, Guidiville, Manzanita and Ohkay Owingeh), this retry's entry was changed to `not-found` and that reading stands. About sixty logs moved from `partly-searched` to `found` or `none-found`; the rest keep their `next_steps`, naming the addresses still unreadable.

## Findings for the lead author

These are the retry's substantive leads. Each is a reading of a nation's own law or court page; tribal law is cited by link, not quoted at length.

| Nation | What the retry found | Where it is kept |
| --- | --- | --- |
| Karuk Tribe | Karuk Tribal Code § 10.10.270, Peacemaker Mediation Forum: the Tribal Court judge may order the parties to the Tribe's confidential Peacemaker Mediation Forum, or the family to family unity, and approves the resulting plan as a court order (Res. 22-R-037, Feb. 24, 2022). Also § 10.05.040, Dispute resolution, mediation and peacemaking. | `tribal-law/karuk-tribal-code-10-10-270-peacemaker-mediation-forum.html`, `tribal-law/karuk-tribal-code-10-05-040-dispute-resolution-mediation-peacemaking.html` |
| Sac and Fox Tribe of the Mississippi in Iowa (Meskwaki) | Tribal Code Title 5, Dispute Resolution: Sec. 5-2103 makes it the court's objective "to seek a resolution which restores balance to the community in accordance with the customs and traditions of the Tribe"; Secs. 5-2501 to 5-2506 set up a Community Panel of members knowledgeable of the Tribe's customs and traditions, whose determinations bind the court; Sec. 5-2105 exempts Panel of Elder proceedings from recording. | `tribal-law/meskwaki-tribal-code-title-5-dispute-resolution.pdf` |
| Mille Lacs Band of Ojibwe | Title 24, Judicial Proceedings, §§ 601-603: an action for causing cultural harm, with sanctions "consistent with the traditions and beliefs of the Band". | `tribal-law/mille-lacs-band-statutes-title-24-judicial-proceedings-through-2014-01-23.pdf` |
| White Mountain Apache Tribe | Judicial Code § 2.3, Determination of Tribal Custom; Apache Custom Advisory Panel: the court determines custom primarily from the Panel's journal. | `tribal-law/documents/white-mountain-apache-judicial-code-ou.html` (already held) |
| Mohegan Tribe | The Council of Elders advises on cultural matters "and enforce[s] rules of Tribal custom"; the court system includes a Gaming Disputes Court. | `tribal-courts/mohegan-tribe-of-indians-of-connecticut/` |
| Mashantucket Pequot Tribal Nation | The Tribal Court "counsels parties to seek mediated resolutions to their disputes" in civil matters and offers pretrial intervention. | `tribal-courts/mashantucket-pequot-indian-tribe/` |
| Northern Arapaho and Eastern Shoshone (Wind River) | Draft Title XVI, Peacemaker Court (June 20, 1989), with chapters on peacemakers and procedure. The National Indian Law Library says the Tribes have not given permission to put the text online; only the library can send it. | NILL contents page (already held) |
| Red Lake Band of Chippewa Indians | The Red Lake Nation Courts page links an "Ojibwe Based Culture Mediation Court". The linked article did not load. | `tribal-courts/red-lake-band-of-chippewa-indians/red-lake-nation-courts.html` |
| Quinault Indian Nation | The Tribal Courts page mentions dispute resolution, mediation, restorative justice and a Healing to Wellness Court. | search log only |
| Sitka Tribe of Alaska | The Tribal Court page says the court "also offers Mediation and Peacemaking services" and ties its work to Tlingit "traditional laws and peacemaking practices". | `tribal-courts/sitka-tribe-of-alaska/tribal-court.html` |
| Confederated Tribes of Siletz Indians | The court page offers "spokespersons and peacemakers available to Tribal Court users". The Siletz Tribal Court Rules and Procedures (as amended Apr. 17, 2015), linked from the Tribe's ordinances page, set up mandatory mediation in the Siletz Community Law Court, citing the Tribes' "strong public policy and tradition" of resolving disputes informally "using tribal elders where possible" (§ 3.004(b)), and a panel of mediators (§ 3.017). | `tribal-courts/confederated-tribes-of-siletz-indians-of-oregon/court-and-justice.html`, `tribal-law/documents/siletz-tribal-court-rules-and-procedures-2015-04-17.pdf` |
| Penobscot Nation | The court says the Nation "has moved away from being an adversarial system for resolving disputes to a problem-solving approach", with a culturally based Healing to Wellness Court. | `tribal-courts/penobscot-nation/tribal-court.html` |
| Pueblo of Nambé | The Tribal Courts apply "proper traditional and customary laws where appropriate". | `tribal-courts/pueblo-of-nambe/tribal-courts.html` |
| Snoqualmie Indian Tribe, Omaha Tribe of Nebraska, Yuhaaviatam of San Manuel Nation, Swinomish Indian Tribal Community | Arbitration laws: Snoqualmie Arbitration Act 3.3; Omaha Tribal Code Title 49, Arbitration Ordinance; San Manuel Tribal Code ch. 24, Arbitration Ordinance (and ch. 22, Judicial Code, kept); Swinomish Tribal Code Title 3, ch. 7, Arbitration of Disputes. | `tribal-courts/<nation>/`, `tribal-law/documents/san-manuel-judicial-code-2021.pdf` |
| Grand Portage Band | The Reservation Water Quality Standards (2005, revised 2006) send appeals from the Water Resources Board to the Tribal Court (§ 5). | `tribal-law/grand-portage-water-quality-standards-epa-copy.pdf` |
| Cahto Tribe; Manzanita Band; Guidiville Rancheria | The California Tribal Families Coalition directory names the court that serves each: the Northern California Intertribal Court System (Cahto) and the Intertribal Court of Southern California (Manzanita, Guidiville). | search logs only |
| Minnesota nations (Bois Forte, Fond du Lac, Grand Portage, Leech Lake, Mille Lacs, Red Lake, Shakopee Mdewakanton, White Earth) | The Minnesota Tribal Court/State Court Forum member list names each nation's tribal court judges. | `tribal-courts/minnesota/tribal-court-state-court-forum-members.pdf` |

## Sources

Every address read is in the CSV and the search logs, with the date of the Wayback Machine copy where one was used. The documents named above are in the private bucket under the keys shown (`research/capture-index.csv`). The hand-pull list items this retry finished are written up in the project files at `research/pull-results/2026-11-23-retry-batch-6.md`.
