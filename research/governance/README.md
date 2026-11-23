# How each nation's government is set up

Plain facts about each nation's government, gathered on Nov. 23, 2026 for the `governance` list in the Tribe profiles and the Government section of each nation's page ([decision record 0035](../../docs/decisions/0035-governance-facts-from-governing-documents.md)). Lead author's request (Nov. 23, 2026): "Can we add information for these tribes relating to governance structure?"

## What was found

| | Nations | Facts |
| --- | ---: | ---: |
| Profiles with any governance fact | 576 | 5,968 |
| From the nation's own constitution or other governing document | 361 | 5,396 |
| of which from a text marked in effect on the nation's own site (`high` confidence) | 80 | |
| Title of the leader's office from the Tribal Leaders Directory | 572 | 572 |
| Profiles with none yet (search log `partly-searched`) | 378 | |

All 576 profiles with facts are federally recognized nations (5 of the 581 federal profiles have none). None of the 373 state-recognized, petitioning and other profiles has a governance fact yet: the constitution catalog covers federally recognized nations only, and the directory lists only them. Their nation pages say "None found yet" with how far the search went.

The most common aspects: recall and removal (511 facts), governing body (379), amendment (352), voting age (332), how the governing body is chosen (326), head of government (310). The fewest: judges' term (74), branches (44) and a stated separation of powers (33), since most constitutions here are 1930s to 1980s texts that set up a council without separate branches.

## How

1. **Which text.** [`prepare_batches.py`](../../scripts/governance/prepare_batches.py) picks one version of each of the 391 constitution histories in `content/documents/`: the version marked in effect, else the newest dated full text, else any full text, skipping versions whose capture has no text layer. 372 had readable text; 19 have only scans without text.
2. **Reading.** AI readers (Claude Haiku, 36 batches) read each text in full under [`reader-brief.md`](../../scripts/governance/reader-brief.md) and gave each fact with the exact words that state it and the article and section. Five hard cases were read again by Claude Sonnet (`hard-cases` in the readings): Tangirnaq Native Village (its text is the Leisnoi Village, or Woody Island, constitution, which is its own), the Tunica-Biloxi Tribe (the text is a 1974 state non-profit corporation's articles, so nothing is taken from it), and three files that bundle a federal corporate charter with the constitution (Craig, Seldovia, Citizen Potawatomi), where only the constitution was used.
3. **Checking.** [`apply.py`](../../scripts/governance/apply.py) keeps a fact only when its quote is found in the text (runs of spacing aside): 5,412 of 5,418 quotes were found. A text whose letters are garbled beyond reading (the Fort Peck copy, whose font shifts every letter) is not used at all.
4. **Directory.** The directory's `jobtitle` for each nation's row, in the office's own form (a listing of "Chairman" or "Chairwoman" is recorded as "Chairperson"; "Acting", "Interim" and a leadership-dispute flag are dropped; vice-presidents and secretaries listed as the contact are skipped). Names of officials are never copied.
5. **Search logs.** One log per profile in [`research/search-logs/governance/`](../search-logs/governance/), with each place looked and its outcome.

## Files

| File | What |
| --- | --- |
| [`readings.json`](readings.json) | One row per nation with a constitution history: the version read, the reader, whether the text was usable and the reader's note on it, and every fact the reader gave with its quote and whether the quote was found |
| [`directory-titles.json`](directory-titles.json) | Each directory row matched to a profile: the title as listed and as recorded |

## Limits

- Not checked by the lead author. Every fact's note says an AI read it. The quote check proves the words are in the text, not that the reader drew the right fact from them; a reviewer can compare the fact with the quote, which the website shows in the Sources list.
- Old texts. 281 of the 361 nations' texts are library or archive copies whose currency is unknown, often decades old. Those facts are `medium` confidence with a note that a later version may be in effect, and the page names the version read.
- Texts that were not the governing document itself: amendment-only files (Confederated Salish and Kootenai, Kalispel, Lac Courte Oreilles), another nation's constitution filed under this one (Lumbee: Buckland; Grayling: Holikachuk; Paiute Indian Tribe of Utah: Kanosh Band; Fond du Lac: the Minnesota Chippewa Tribe), a website watermark (Isleta) and unreadable scans (Fort Peck, Portage Creek). No facts were taken from them; finding the right text is on the pull list.
- Readers' notes on each text (scan damage, a version that differs from its label, appended amendments) are carried into each fact's note.

## Still to do

- The nation's own website, for nations without a usable text and for newer texts: a government, council or constitution page.
- State-recognized and other nations: their own governing documents or websites.
- A check by the lead author, starting with the 80 `high` facts.
