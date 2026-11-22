---
id: 2026-11-22-court-appeal-paths
date: '2026-11-22'
researchers:
- Claude (AI assistant)
tools:
- kind: web-search
  name: Web search
  detail: Found each nation's court code, constitution or court page that says where appeals go.
- kind: page-fetch
  name: curl and pdftotext
  detail: Fetched court pages and code PDFs and extracted their text. Scanned PDFs without a text layer were read as page images.
- kind: page-fetch
  name: Web-fetch tool
  detail: Read the Navajo Nation courts' public guide, which refused the project's own fetcher.
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: Read the passages and recorded each path of appeal with its citation. No subagent reviewed the readings.
purpose: >-
  Record, for each nation whose profile lists more than one level of court, which court hears appeals from which, so that the nation's page can show the path of appeal from the court that hears a case first to the highest court (Trevor, Nov. 22, 2026).
queries:
- court of appeals, supreme court, appellate jurisdiction, appeals from the district court (per nation)
sources_added:
- chickasaw-nation-code-title-5-2026
- muscogee-creek-nation-code-title-26
- colville-tribal-court-page
- rincon-appellate-court-rules-2019
- rincon-civil-procedure-2026
limits: >-
  Only the 22 profiles that already listed more than one court name were considered, and only those with more than one level of court were searched. The Navajo Nation's Title 7 copy at the Native American Rights Fund now answers 404, so the Navajo path rests on the courts' 2021 public guide. One model made each reading; no second reader checked it.
---

# Paths of appeal between a nation's courts

## What was asked

Trevor asked on Nov. 22, 2026 that a nation page with several courts show their order, from the court that hears a case first to the court that hears the last appeal. The profile schema gained `appeals_to` on each court in `justice_institutions`: the name of the court that hears its appeals, with its own citation ([data model](../../../docs/data-model.md#courts-and-the-path-of-appeal)).

## What was done

Of the 22 profiles listing more than one court name, most list one court twice (two directories naming the same court) or a court and its building. Eight list more than one level. Each was searched for a primary source that states the path of appeal, and every place looked is in the nation's `courts` search log.

| Nation | Path recorded | Source |
| --- | --- | --- |
| Navajo Nation | Judicial District Courts to Supreme Court | Courts' public guide, rev. Feb. 23, 2021 |
| The Chickasaw Nation | District Court to Supreme Court | Chickasaw Nation Code Title 5, §§ 5-103.7(2), 5-207.4(A) |
| The Muscogee (Creek) Nation | District Court to Supreme Court | Muscogee (Creek) Nation Code Title 26, § 2-105 |
| Confederated Tribes of the Colville Reservation | Colville Tribal Court to Court of Appeals | Colville Tribal Court page |
| Blackfeet Tribe | Blackfeet Tribal Court to Court of Appeals | Blackfeet Tribal Law and Order Code ch. 11, pt. I, § 1 |
| Rincon Band of Luiseño Indians | Intertribal Court of Southern California, and the Rincon Civil Trial Court, to the Rincon Court of Appeals | Rincon Tribal Ordinance § 3.800 (2019); Rincon Tribal Code § 3.310 (2026) |
| Seneca Nation of Indians | Peacemakers and Surrogates Courts of both reservations to the Court of Appeals | Constitution of 1848, as amended (2026), Section IV |
| Gila River Indian Community | None: the second listed court is an office of the Community Court | Logged as partly searched |

## Changes to profiles

- Rincon: added the Rincon Civil Trial Court, established Feb. 11, 2021, which the profile did not list.
- Seneca: the Tribal Law and Policy Institute directory (2022) listed a Court of Appeals for each reservation. The Nation's constitution provides for one Court of Appeals, so those two entries were replaced by one "Seneca Nation Court of Appeals" cited to the constitution.

## Left for later

- The Navajo family courts and the Blackfeet Family Court: no source read says where their appeals go.
- Rincon: the 2026 code also names a Court of Appeals within the Intertribal Court of Southern California; which court now hears appeals of cases still in that court was not confirmed.
- Every other nation lists one court. Many have an appellate court that the profiles do not list yet, and intertribal appellate courts (such as the Southwest Intertribal Court of Appeals) are not yet recorded for the nations they serve. The constitution articles on judicial power in `research/constitutions/articles.json` (305 articles) are the place to start.
