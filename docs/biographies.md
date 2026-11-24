# Biographies of Native people

Trevor approved these rules on Nov. 24, 2026. Pages live at /biographies/<name> (the site's /people page is already the contributors page).

## Who gets a page

1. A Native person a case on this site names as a party or petitioner, or as the person whose act, death, land or rights the case turns on. Examples: Crow Dog and Spotted Tail (*Ex parte Crow Dog*, 109 U.S. 556 (1883)).
2. A Native leader that a source on this site names as leading the nation: a treaty signer, the head of government when a governing document on the site was adopted, or a leader who brought the nation's case.
3. No page for minors, for people a record names only by initials or a pseudonym, or for people known only from family, juvenile or sealed matters. Non-Native people in the cases (for example Samuel Worcester, a missionary) stay on the case pages.

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
- Authority to control: a nation that claims its page can review, correct or hide the pages of its people, as with stories ("Unreviewed" until then).
- Responsibility: every fact has a source with a pin cite in Indigo Book form; a fact without a source is left out. No ceremonial or sacred information.
- Ethics: no speculation. Where only one side's account exists, such as a court's recital of a conviction, the page says whose account it is.

## One info page for every item

Every item page (people, Courts, cases, nations, stories, and next glossary terms, federal offices, forms and licenses) uses one shared layout, InfoPage: title, other names, one-line lead and status badge; At a glance with the picture and key facts, each with its source markers; the page's own sections; References.

## Records

Each person is one file, `content/biographies/<key>.yaml`, checked by `schemas/biography.schema.json`. Every name, nation, case role and life event carries the key of its source record and the pinpoint (`where`), such as "109 U.S. at 557"; the page shows the marker and the References list gives the citation. A picture sits in `site/static/biographies/portraits/` with its archive record, the legal basis for public domain and its SHA-256, and the build fails if the file differs. The build also fails if a living person's record has life events, or a picture without `portrait_released` (`src/lib/server/biographies.ts`).
