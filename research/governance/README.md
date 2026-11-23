# How each nation's government is set up

Plain facts about each nation's government, gathered on Nov. 23, 2026 in two passes (the nation's constitution, then its own website) for the `governance` list in the Tribe profiles and the Government section of each nation's page ([decision record 0042](../../docs/decisions/0042-governance-facts-from-governing-documents.md)). Lead author's request (Nov. 23, 2026): "Can we add information for these tribes relating to governance structure?"

## What was found

| | Nations | Facts |
| --- | ---: | ---: |
| Profiles with any governance fact | 623 | 6,808 |
| From the nation's own website (its pages, or a governing document it posts) | 294 | 1,686 |
| From a captured constitution or other governing document (first pass) | | 4,548 |
| Title of the leader's office from the Tribal Leaders Directory | 574 | 574 |
| Profiles with a `high` fact (the nation's own site, or a text it marks in effect) | 367 | |
| Profiles with none yet | 324 | |

The 324 without facts are 5 federally recognized nations and 319 state-recognized, petitioning and other groups. Of those 319, 289 list no website of their own, and the contacts search of Nov. 22, 2026 found none; the rest have a site that refused an automated reader or holds nothing on how the group governs itself. The website pass added 47 groups without federal recognition.

The most common aspects: recall and removal, governing body, amendment, voting age, how the governing body is chosen, head of government. The fewest: judges' term, branches and a stated separation of powers, since most constitutions here are 1930s to 1980s texts that set up a council without separate branches.

## How

1. **Which text.** [`prepare_batches.py`](../../scripts/governance/prepare_batches.py) picks one version of each of the 391 constitution histories in `content/documents/`: the version marked in effect, else the newest dated full text, else any full text, skipping versions whose capture has no text layer. 372 had readable text; 19 have only scans without text.
2. **Reading.** AI readers (Claude Haiku, 36 batches) read each text in full under [`reader-brief.md`](../../scripts/governance/reader-brief.md) and gave each fact with the exact words that state it and the article and section. Five hard cases were read again by Claude Sonnet (`hard-cases` in the readings): Tangirnaq Native Village (its text is the Leisnoi Village, or Woody Island, constitution, which is its own), the Tunica-Biloxi Tribe (the text is a 1974 state non-profit corporation's articles, so nothing is taken from it), and three files that bundle a federal corporate charter with the constitution (Craig, Seldovia, Citizen Potawatomi), where only the constitution was used.
3. **Checking.** [`apply.py`](../../scripts/governance/apply.py) keeps a fact only when its quote is found in the text (runs of spacing aside): 5,412 of 5,418 quotes were found. A text whose letters are garbled beyond reading (the Fort Peck copy, whose font shifts every letter) is not used at all.
4. **Directory.** The directory's `jobtitle` for each nation's row, in the office's own form (a listing of "Chairman" or "Chairwoman" is recorded as "Chairperson"; "Acting", "Interim" and a leadership-dispute flag are dropped; vice-presidents and secretaries listed as the contact are skipped). Names of officials are never copied.
5. **Websites (second pass).** [`crawl_websites.py`](../../scripts/governance/crawl_websites.py) took the home page listed in each profile (517 profiles whose facts came only from an old library copy or the directory, or that had none; 6 more from the domain of the nation's office email), followed links naming the government, council, constitution, officers, elections or courts and one level below the best of them, at most 10 pages a site, one request at a time per site with a pause between. 110 sites refused the request or answered with a "checking your browser" page; those are logged as blocked and were not worked around. [`prepare_website_batches.py`](../../scripts/governance/prepare_website_batches.py) grouped the other 407 into 54 batches, and AI readers (Claude Haiku) read every saved page under [`website-brief.md`](../../scripts/governance/website-brief.md), with the rule that no person's name is ever given or quoted. They judged 80 sites not the nation's own (a regional association, a borough, a corporation, a casino), which gave no facts. 1,686 of 1,688 quotes were found on their page. A website fact replaces a fact of the same aspect read from an old library copy, but not one from a text the nation's site marks in effect. A page that is a governing document the catalog already holds is cited as that version; four texts the catalog lacked are added to it ([`site-constitutions.json`](site-constitutions.json), [`add_site_constitutions.py`](../../scripts/governance/add_site_constitutions.py)): the Comanche Nation's 2026 text, Tlingit and Haida's 2025 text, the Meherrin Tribe's 1996 text and the Gabrielino/Tongva Nation's 2020 text. Every other page cited gets a source record (`<nation>-website-<page>`), unless a record from other work already cites its link.
6. **Search logs.** One log per profile in [`research/search-logs/governance/`](../search-logs/governance/), with each place looked and its outcome.

## Files

| File | What |
| --- | --- |
| [`readings.json`](readings.json) | One row per nation with a constitution history: the version read, the reader, whether the text was usable and the reader's note on it, and every fact the reader gave with its quote and whether the quote was found |
| [`directory-titles.json`](directory-titles.json) | Each directory row matched to a profile: the title as listed and as recorded |
| [`website-readings.json`](website-readings.json) | One row per website read: the pages saved (link, title, SHA-256), whether the reader judged it the nation's own site and its note, governing documents among the pages, and every fact with its quote, page and whether the quote was found |
| [`site-constitutions.json`](site-constitutions.json) | The four constitution texts found on nations' sites that the catalog lacked |

## Limits

- Not checked by the lead author. Every fact's note says an AI read it. The quote check proves the words are in the text, not that the reader drew the right fact from them; a reviewer can compare the fact with the quote, which the website shows in the Sources list.
- Websites change. A website fact is what the page said on Nov. 23, 2026; the saved copy is kept privately so it can be checked. Pages that are not governing documents state facts in ordinary prose ("governed by a five-member council"), which the readers copied as given.
- Blocked sites. 110 sites refused an automated reader. The project does not get past such checks; their government pages can be read by hand.
- Old texts. Many first-pass texts are library or archive copies whose currency is unknown, often decades old. Those facts are `medium` confidence with a note that a later version may be in effect, and the page names the version read.
- Texts that were not the governing document itself: amendment-only files (Confederated Salish and Kootenai, Kalispel, Lac Courte Oreilles), another nation's constitution filed under this one (Lumbee: Buckland; Grayling: Holikachuk; Paiute Indian Tribe of Utah: Kanosh Band; Fond du Lac: the Minnesota Chippewa Tribe), a website watermark (Isleta) and unreadable scans (Fort Peck, Portage Creek). No facts were taken from them; finding the right text is on the pull list.
- Readers' notes on each text (scan damage, a version that differs from its label, appended amendments) are carried into each fact's note.

## Still to do

- The 110 blocked sites and the 80 addresses that led to someone else's site: read by hand, or find the nation's own address.
- Groups with no website: ask their government office, or a state commission on Indian affairs.
- A check by the lead author, starting with the `high` facts.
