# Brief: list every individual court of each Native nation

You are helping a law student's research project (a model tribal dispute resolution code and a reference website about Native nations). The nation pages list each nation's courts. The lead author wants EVERY individual court listed, not just "Tribal Court". Example: the Navajo Nation has eleven judicial district courts (Chinle, Crownpoint, Kayenta, ...), family courts, a Supreme Court, and a Peacemaking Program; each should be its own entry with where it sits and an official link.

"Grab now, classify later": record every court you find with its evidence; do not decide what to show.

## What to find, for each nation in your batch file

The batch file lists each nation's id, official name, states, website, and the courts the project already lists (`courts`: kind, name, link). For each nation:

1. Find the nation's court system on official sources (order of preference):
   - the nation's own website or the court's own website (judicial branch pages, "Tribal Court" pages, court directories, court rules/codes the nation publishes);
   - an official directory: a state court system's tribal court directory (e.g., the Alaska Court System's Alaska Tribal Court Directory, the Arizona/New Mexico/Washington/Oklahoma/Michigan/Minnesota/Wisconsin/California state judicial tribal court directories), the Bureau of Indian Affairs list of Courts of Indian Offenses (CFR courts) at bia.gov, or an intertribal court's own website listing the nations it serves (e.g., Northwest Intertribal Court System, Southwest Intertribal Court of Appeals, Northern Plains Intertribal Court of Appeals, Intertribal Court of Southern California).
   - NOT Wikipedia, news stories, Facebook, law firm blogs, or aggregator sites. Those may give you leads, but you must then confirm on an official page.
2. List EVERY individual court or court-like body the official source names: trial court(s), each district/circuit/division court, family or children's/juvenile court, healing to wellness/drug court, peacemaking court or program, traditional/elders court, court of appeals, supreme court, and any intertribal court or Court of Indian Offenses that serves the nation (including the appellate court it uses).
3. For each court record:
   - `name`: exactly as the official page writes it (keep diacritics; fix only ALL CAPS to normal capitals). If the page gives only a place, e.g. "10 - Aneth", write the name as the page's own heading pattern does (e.g. "Aneth Judicial District") and say so in `note`.
   - `kind`: one of tribal-court, district-court, family-court, juvenile-court, healing-to-wellness-court, peacemaking-program, traditional-forum, court-of-appeals, supreme-court, intertribal-court, intertribal-court-of-appeals, court-of-indian-offenses, other.
   - `part_of`: when the source groups courts (e.g. "District Courts" with 11 districts), the exact name of the group as the project already lists it in `courts` if it is listed there, else the group name as the source writes it (and also record the group itself as its own court entry). Leave out when there is no group.
   - `location`: `place` (town/community as the source names it), `state` (two-letter code), `address` (street address only if the source gives it). ONLY from the source page; never copy the nation's government address or guess from the name. Leave out what the page does not say.
   - `link`: the court's own official page if it has one; otherwise the official directory page that lists it. Every link you give must be a page you actually fetched successfully (status 200) and that names the court.
   - `evidence_url`: the page that says the court exists (often the same as link).
   - `evidence_title`: the page's title or main heading, and `evidence_publisher`: who publishes it (e.g. "Navajo Nation Judicial Branch", "Alaska Court System").
   - `evidence_date`: any date or "updated" line on the page (else null).
   - `quote`: the exact words on the page that name the court (copied, under 40 words).
   - `appeals_to`: ONLY if an official source says where appeals from this court go: `{ "court": <name of the court appeals go to, exactly as you record it>, "url": <page>, "quote": <exact words> }`. Never infer from the court's name.
   - `existing`: the exact `name` of the entry in the batch file's `courts` list that this is the same court as, or null if it is new.
   - `confidence`: high (nation's/court's own current page), medium (official directory, or nation's page with an old date), low (unclear).
   - `note`: anything a reviewer should know, in one or two plain sentences.

## Record your searches too

For each nation, list every place you looked in `searches`: `{ "address": url, "place_kind": nation-website | tribal-court-site | state-court-directory | bureau-of-indian-affairs-list | intertribal-organization | web-search | other, "outcome": found | not-found | blocked | dead-link | error, "reason": one sentence }`. A site that refuses you or shows a bot challenge is `blocked`; do not try to get around it.

## Output

Write ONE JSON file per nation to `RESULTS_DIR/<nation id>.json`, using the Write tool, with this shape:

```json
{
  "id": "navajo-nation",
  "searched_on": "2026-11-22",
  "courts": [ { ...as above... } ],
  "searches": [ { ...as above... } ],
  "summary": "One sentence: how many courts found, and anything unresolved."
}
```

Write a file even when you found nothing (empty `courts`, with the searches). Do not edit any other files. Do not write into the repository.

## Rules

- Accuracy over coverage. Never invent a court, link, place or quote. If unsure, leave it out and say so in `summary`.
- Use WebSearch to find the official court page fast (e.g. `"<nation name>" tribal court`), then WebFetch to read it. Spend at most about 6 fetches per nation; move on when stuck.
- Many small nations have only one court; that is a fine result: record the one court (matched to `existing`) with its location if the page gives it, and say so.
- When finished with the whole batch, reply with one line per nation: id, number of courts found, number new.

## How to fetch pages (IMPORTANT, replaces WebFetch)

The WebFetch tool has a small shared hourly budget that is already used up. Do NOT use WebFetch. Read pages with the Bash tool instead:

    python3 -I scripts/review/individual_courts_fetch.py URL
    python3 -I scripts/review/individual_courts_fetch.py URL --find court judicial judge appeal

It prints the HTTP status, final URL, page title, the visible text (or only the lines containing the --find words) and the page's links with absolute URLs, so you can follow a "Tribal Court" or "Judicial" link. Quotes you record must be copied from this printed text exactly (the merge step re-checks them against the saved page). If it prints FETCH FAILED or a 403/503/challenge page, record the search as `blocked` or `error` and move on. If it prints FRAMES, fetch the frame URLs. Use WebSearch only to discover the right page address.
