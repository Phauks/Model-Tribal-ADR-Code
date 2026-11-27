# Biographies of Native people

Trevor approved these rules on Nov. 24, 2026. Pages live at /biographies/<name> (the site's /people page is already the contributors page).

## Who gets a page

1. A Native person a case on this site names as a party or petitioner, or as the person whose act, death, land or rights the case turns on. Examples: Crow Dog and Spotted Tail (*Ex parte Crow Dog*, 109 U.S. 556 (1883)).
2. A Native leader that a source on this site names as leading the nation: a treaty signer, the head of government when a governing document on the site was adopted, or a leader who brought the nation's case.
3. A person who signed a ratified treaty for the United States: the commissioners, governors and officers who negotiated the treaties (Trevor chose to add them to Biographies on Nov. 26, 2026). Their page lists the treaties they signed; a President or Justice also links to that page.
4. No page for minors, for people a record names only by initials or a pseudonym, or for people known only from family, juvenile or sealed matters. Other non-Native people in the cases (for example Samuel Worcester, a missionary) stay on the case pages.

## Living people and the recently dead

- People who died more than 25 years ago get the full page.
- Living people, and people who died within the last 25 years, get their public role only: what court records and official records say about their part in the case or their office. No birth date, home, family, health, or criminal history beyond what the case itself decided, and no picture unless they or their family published it for that use.
- The person, their family or the nation can ask for a change or removal from the page's status badge; we honor it. The case page still names the person as the official report does.

## Names

- The title is the name the case or the main sources use.
- Other names sit under the title, spelled exactly as each source prints it and labeled by the source, for example "Kan-gi-shun-ca, as the Supreme Court Reporter prints it".
- A name in the nation's language in the nation's current spelling appears only when the nation, the family or a dictionary the nation publishes gives it. We never transliterate a name ourselves.

## Pictures

- Public domain only: published in the United States before 1931 (17 U.S.C. § 304), or a work of the U.S. government (17 U.S.C. § 105). The credit links to the archive's own record (Library of Congress, National Archives, Smithsonian).
- Some nations and families ask that pictures of the dead not be shown. Where a nation's published policy or a family's request says so, the page has no picture, and any picture comes down on request.

## CARE principles

Following the CARE Principles for Indigenous Data Governance (Global Indigenous Data Alliance, 2019; Carroll et al., 19 Data Sci. J. 43 (2020)):

- Collective benefit: a page exists to show how the law touched the person and the nation, not as a curiosity.
- Authority to control: a nation that claims its page can review, correct or hide the pages of its people, as with stories ("Unverified" until then).
- Responsibility: every fact has a source with a pin cite in Indigo Book form; a fact without a source is left out. No ceremonial or sacred information.
- Ethics: no speculation. Where only one side's account exists, such as a court's recital of a conviction, the page says whose account it is.

## One info page for every item

Every item page (people, Courts, cases, nations, stories, and next glossary terms, federal offices, forms and licenses) uses one shared layout, InfoPage: title, other names, one-line lead and status badge; Key facts with the picture and key facts, each with its source markers; the page's own sections; References.

A person's own sections are Cases (each case linked to its page), Treaties and Life and events. Treaties lists every treaty the person signed, read from the life events that cite a treaty record: the treaty's name linked to its page at /laws/<key>, its first page in the Statutes at Large, the date signed, whom the treaty prints the person as signing for, the title printed beside the name, and the copy of the treaty's text this site keeps (Trevor, Nov. 24, 2026: "we say this man signed treaties. We should link to those treaty pages or documents"). The same treaty name is linked in the life event, and each treaty's page lists the signers who have a page.

## How the first thousand pages were made

On Nov. 24, 2026 Trevor asked for many more pages than the first seven. They were made by script, with small AI readers for the reading, and every page starts Unverified. The scripts are in `scripts/biographies/` and their working data in `research/biographies/2026-11-24/`.

- **People in the Supreme Court cases.** The opinions of the 533 cases in `research/supreme-court-coverage/native-cases-scdb.csv` were read from the Library of Congress scans of the United States Reports. A reader listed each person the opinion itself says is Native, named with at least two words, and not a minor, with a word-for-word quote for each fact. `verify_drafts.py` finds every quote on its page and drops what it can't find. A person whose only tie is citizenship in a nation (which also covered adopted and intermarried citizens and freedmen) was left out. A case decided in 1945 or later is treated as possibly about a living person, so the page gives the public role only.
- **Treaty leaders.** The signature pages of the 370 ratified treaties were read from the Statutes at Large on GovInfo, and every Native signer was listed as printed (`treaty-signers.json`, 9,250 names, each found on its page by `verify_treaties.py`). A signer gets a page when the treaty prints a title such as chief, head man or principal chief beside the name, or when the same printed name signs two or more treaties for the same nation with no more than 30 years between signings. The treaties print names, not identities: two signings under one name may be two people, and one person may appear under two spellings. The page says only what each treaty prints.
- **Nations.** A page links a nation only where the case names it and its successor is clear (`nation-map.json`), or where the treaty records link the signing nation to today's nation with high confidence.

## Repeat signers and United States signers (Nov. 26, 2026)

Trevor expected every Native signer of two or more treaties to have a page, and chose to add the United States signers too. The signer count (`research/analyses/2026-11-26-treaty-signer-count.md`) tested how reliably printed names can be matched, and the pages follow its strict threshold.

- **Native repeat signers.** `make_repeat_signer_records.py` joins two signings only when they come from different treaties, the nations they were signed for share a nation family (all Sioux bands, all Chippewa bands, Sac and Fox, and so on), the treaties are no more than 30 years apart, and the printed names are the same letters or have the same sound key (`signer_count/matching.py`). It made 163 pages for repeat signers the first rule missed. Closer calls, where only the English name is the same or the sound keys are 85% or more alike, are listed in `research/reviews/2026-11-26-treaty-signer-matches.csv`. Christian names many signers shared (John, Charley, Louison) are left out, as before.
- **Closer calls, best effort.** Trevor asked for best effort on the 1,128 closer calls instead of reading them himself. Two Haiku readers judged each pair separately (`research/biographies/2026-11-26/signer-match-readers`), and `decide_signer_matches.py` calls a pair the same person only when both said so and at least one was highly confident (both, when the spellings are far apart). That joined 543 pairs, written to `research/reviews/2026-11-26-treaty-signer-match-decisions.csv`; `make_repeat_signer_records.py` reads that file. A joined group that would span more than 40 years or 12 treaties is split back. Signings found for a person who already has a page are added to it, and a new group whose name and nation match an existing page goes on that page (Samuel Garland, Choctaw). Groups that touch two or more existing pages are left alone, since the site has no way to send one page's address to another. All these pages stay Unverified.
- **United States signers.** `make_us_signer_records.py` reads the signers from Kappler's text (`research/biographies/2026-11-26/treaty-us-signers.json`) and joins signings with the same family name whose given names agree ("Wm." is William, "H." is Henry; two different middle initials are two people) within 40 years, with the hand calls from the signer count. It made 224 pages. Each signing cites the treaty's signature page in the Statutes at Large.
- **Offices and positions (Nov. 27, 2026).** Trevor asked that signer pages say what position a signer held. `add_signer_offices.py` sets each U.S. signing's "listed as" to the offices that treaty's own text gives the signer (read by Haiku, kept only when printed in the treaty: `check_signer_offices.py`), adds terms in Congress for the 51 signers matched by hand to a member (cited to the Biographical Directory of the United States Congress by Bioguide ID), and rewrites signer leads to open with the position: seats in Congress and offices for U.S. signers, the printed title ("Head chief", "Headman") for Native signers. See `research/sessions/2026/2026-11-27-treaty-signer-offices.md`.
- **Stubs.** A page that holds only treaty signings (no cases, no picture, no other life events) carries the Stub badge and note, and is listed in Workspace › Stubs.

## Records

Each person is one file, `content/biographies/<key>.yaml`, checked by `schemas/biography.schema.json`. Every name, nation, case role and life event carries the key of its source record and the pinpoint (`where`), such as "109 U.S. at 557"; the page shows the marker and the References list gives the citation. A picture sits in `site/static/biographies/portraits/` with its archive record, the legal basis for public domain and its SHA-256, and the build fails if the file differs. The build also fails if a living person's record has life events, or a picture without `portrait_released` (`src/lib/server/biographies.ts`).
