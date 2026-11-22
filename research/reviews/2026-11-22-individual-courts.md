# Individual courts, Nov. 22, 2026

Trevor asked on Nov. 22, 2026 that nation pages list every court of a nation, not only "Tribal Court": "navajo nation has 11 district courts, we should list all of them. same for other tribes." This review looked for each court of the 416 nations whose profile listed at least one court or court-like body: trial, district, circuit, family, juvenile, healing to wellness, peacemaking and appellate courts, and intertribal courts or Courts of Indian Offenses that serve a nation. Because Trevor asked for the courts to be listed, the courts that passed the checks below were added to the profiles at once. Every added fact can be removed with the `lead_author_decision` column of the spreadsheet.

| File | What it holds |
| --- | --- |
| [`2026-11-22-individual-courts.json`](2026-11-22-individual-courts.json) | One record per nation: each court found (name as the page writes it, kind, the group it belongs to, where it sits, link, the page that names it, a quote from that page, where its appeals go when the page says so, the listed court it matches) and every place searched |
| [`2026-11-22-individual-courts.csv`](2026-11-22-individual-courts.csv) | One row per court found, with what happened to it and an empty `lead_author_decision` column |
| [`2026-11-22-individual-courts-counts.json`](2026-11-22-individual-courts-counts.json) | The counts below |
| [Search logs, topic `courts`](../search-logs/README.md) | Every place searched, added to each nation's log (321 logs extended, 91 new) |
| [Brief](briefs/2026-11-22-individual-courts.md) | What the readers were asked to do |

## How it was done

The Navajo Nation was read by hand: the Judicial Branch page "Judicial District Courts" (courts.navajo-nsn.gov/?p=89073) lists eleven judicial districts with addresses; the Crownpoint district also has the Pueblo Pintado Circuit Court, and the Alamo/Tó'hajiilee district has two courts. The other 415 nations were split into 19 batches. Two batches of nations with large court systems were read by a mid-size model and the rest by a small model, following the brief. The readers looked first at the nation's or the court's own website, then at official directories (state court systems' tribal court directories, including the Alaska Tribal Court Directory of 2022; the Bureau of Indian Affairs list of Courts of Indian Offenses; intertribal courts' own lists of the nations they serve). Partway through, the shared budget of the web-fetch tool ran out, so the readers switched to the project's own fetcher, [`scripts/review/individual_courts_fetch.py`](../../scripts/review/individual_courts_fetch.py), which saves each page it reads.

[`scripts/review/individual_courts.py`](../../scripts/review/individual_courts.py) then checked every court's quote against the saved copy of its page (or a fresh fetch, or the text of the PDF for the Alaska directory), and added a court to the profile only if:

- the quote was found on the page (516 of 549; 9 quotes were not on the page and 10 pages could not be read again);
- the reader did not rate it low confidence (52 were, mostly Alaska directory entries that say the court is not active now, and courts named only in a link or a staff heading);
- the profile did not already list it. A court the profile lists under the same name was added again only when the page gives its street address, its group or where its appeals go (53), so the page shows one court with two sources. A court the profile lists under another name (often just "Tribal Court") was not added again (122), so the page does not show it twice; where the page said where its appeals go, that path was added to the listed court (18).

`part_of` (the group a court belongs to) and `appeals_to` were kept only when they name a court in the same profile; a court the reader matched to a listed court under another name points to the listed name. Each added fact cites a new source record for its page (141 new), at the reader's confidence, with verification `read-in-full`, and its note quotes the words that name the court.

## Results

| Result | Courts |
| --- | ---: |
| Added (a court the profile did not list) | 214 |
| Added again with its address, group or appeals, for a listed court | 53 |
| Not added: listed under another name | 104 |
| Not added: listed under another name; its appeal path added to the listed court | 18 |
| Not added: already listed, nothing new | 89 |
| Not added: low confidence | 52 |
| Not added: quote not found on the page | 9 |
| Not added: page not read again | 10 |
| **Total** | **549** |

280 facts (267 courts and 13 paths of appeal on listed courts) were added to 137 profiles. The kinds most often added: tribal courts and their divisions (63), healing to wellness courts (43), courts of appeals (40), supreme courts (23), district courts (20), juvenile courts (16), intertribal courts (10). The nations with the most courts added: the Navajo Nation (14), Pueblo of San Felipe (6), and the Cherokee Nation, Muscogee (Creek) Nation, Prairie Band Potawatomi Nation, Squaxin Island Tribe and White Earth Nation (5 each).

## On the page

A court that names its group in `part_of` is listed under the group, with where it sits ("Chinle, Arizona"); a long list takes two columns where there is room. A court with its own path of appeal is shown on the path instead. The rules are in `site/src/lib/nation-services.ts`.

## Limits and what is left

- No court was found for 122 nations: mostly Alaska villages whose directory entry says the tribe could not be reached in 2021 or has no active court, and nations whose sites refused the fetcher (25 searches `blocked`) or failed (97 `error`). Their search logs list each place.
- Readers sometimes recorded divisions or dockets (for example the Muscogee (Creek) Nation District Court's criminal, family and small claims judges) as courts in a group. These are kept, named as the page names them, and can be removed in the spreadsheet.
- The Navajo Nation's family courts are named only as a kind on the pages read, so they are not listed one by one.
- Some readers matched a found court to a listed "Tribal Court" by judgment; the match only decides whether a court is added, never changes a listed fact.
- One reader per batch; no second reader checked the readings. The quote check confirms the words are on the page, not that the reading of them is right.
