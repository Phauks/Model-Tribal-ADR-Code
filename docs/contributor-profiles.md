# Contributor registration and profiles

**Status:** built on the website; the wording of each question is a draft for the lead author to review. Everything here is project design unless a source is cited ([decision record 0022](decisions/0022-open-registration-for-contributors.md)).

People who want to help with the project (writers, reviewers, researchers, translators, artists, people who know how disputes are resolved in their communities) register on the website, keep a profile, and choose how they are credited in the book and on the website. The project asks for this information when people first offer to help, so it does not have to chase it before an edition goes to print, and every person confirms what will appear on a review page before anything is used.

## The flow

1. **Learn what is asked.** `/join` explains what registering involves, what is asked and why, who sees it, and that registering does not give permission to use anything a person shares. It links to the request form for anyone who would rather not make an account.
2. **Sign in.** The person signs in with a code sent to their email address, or a password they chose later. Signing in proves they receive mail at that address, the same rule that protects invitations ([site/COLLABORATION.md](../site/COLLABORATION.md), "How sign-in works"). Someone who signs in and is not on the People list is no longer turned away: they go to their profile. The workspace stays closed to them.
3. **Fill in the profile** (`/profile/edit`), in six parts: about you, how to reach you, Native nations, your background, how you would like to help, and credit. Beside every answer that could be published are two boxes, Book and Website; anything not ticked is never published ("Answers and where they appear", below). Anything may be saved as a draft ("Save draft"), and "Review and confirm" goes on to step 4. The screen was redesigned from Trevor's notes of Nov. 23 and 24, 2026, and built to the mockup he approved on Nov. 24.
4. **Check the answers** (`/profile/review`). One page shows every answer, who can see it, and the credit exactly as it will be printed, with a "Change" link next to each answer. The GOV.UK Design System recommends a single check-answers page "immediately before the confirmation screen for small to medium-sized transactions," with "a ‘Change’ link next to each section," because it gives users "a second chance to notice and correct errors before submitting data."[^govuk-check] The person ticks a box and confirms.
5. **The project keeps a copy.** Each confirmation stores a numbered version: every answer as the person saw it and the credit line as it was previewed. The first confirmation signs the person up. There is no waiting step: everyone who confirms is accepted (lead author, 2026-11-22), and the credit goes under Contributors for writers, Reviewers for reviewers, or Thanks for everyone else.
6. **The lead author follows up** on the workspace's Contributors page. They can move a credit to another section, or remove anyone who should not be listed, with a reason the person sees on their profile. They give reviewers and writers workspace access with a role.
7. **Later changes.** The person can edit at any time. Edits are saved but not used until confirmed again: credits always come from the last confirmed version. Before each edition goes to print, the project asks every credited person to check their credit again (process step; email reminders are not built yet).

People the lead author invites from the People page also keep a profile: the workspace overview asks them to set one up, so their credit is their own choice too.

## What is asked, and why

Names, contacts, nations, relationships, languages, pronouns and specialties are each kept as separate rows, so a person can add as many as they need and changing one never touches another (Trevor, Nov. 23 and 24, 2026; migration `20261124T0100_redesign_contributor_profiles.sql`).

| Part | Question | Required to confirm? | Why it is asked |
| --- | --- | --- | --- |
| About you | Picture | No | Shown on the person's contributor page if they tick Website. Never printed, and never for someone under 18 ("Profile pictures", below) |
| About you | First name | Yes | To address the person and print a credit |
| About you | Last name | No | Only to sort the list of credits. "Not everyone’s name fits the first-name, last-name format,"[^govuk-names] and the W3C advises "don't require that people supply a family name."[^w3c-names] A person with one name writes it in the first box |
| About you | Other names, any number, each marked Name in my language, Name I go by, Pen name, or Other | No | Some people have a name in their nation's language, or go by another name. Each may be ticked for the book or the website; a ticked name prints in brackets after the full name, or alone when the full name is not ticked |
| About you | Pronouns: she/her, he/him, they/them, Use my name, Other, I'd rather not say (several may be chosen) | No | Shown on the contributor page if ticked. Never printed |
| About you | Birth year, from a list of the years 13 to 110 years ago | Yes | Signing up on the website is for people 13 or older (lead author, 2026-11-22), the age below which federal rules on children's data apply (16 C.F.R. § 312.2). Trevor asked for the year in place of an age group (Nov. 23, 2026). Only in the year someone turns 13 or 18 does the form ask "Have you had your 13th (18th) birthday yet?", and the answer counts only in that year (`ageGroupOf` in `site/src/lib/contributors.ts`). Someone younger helps with a parent or guardian through the request form and the consent for minors form ([docs/contributions.md](contributions.md#contributors-under-the-age-of-majority)). People under 18 may publish only a pen name, a description, nations, organization, pronouns, languages and specialties: never their full name, other names, picture or biography |
| How to reach you | The sign-in email address | Always listed | Proved by the sign-in code, so it cannot be mistyped or claimed by someone else |
| How to reach you | More email addresses and phone numbers, each with Email, Call or Text ticked, and one Preferred | A preferred phone needs Call or Text | Trevor asked for a table showing what each contact may be used for (Nov. 23, 2026). GOV.UK: "Not everyone has or can use a phone, so make sure you give users a choice about how they can be contacted."[^govuk-phone] Phone numbers are typed as digits with a country, spaced as that country writes them, checked against the country's numbering plan, and stored in E.164 form, using libphonenumber-js[^libphonenumber]. Contacts are never published |
| Native nations | Connected to a Native nation? Yes and list / No / Rather not say | If Yes, at least one nation | So the project knows whose knowledge and perspective it is drawing on, and so a person can choose to be credited with their nation (charter, [commitment 7](charter.md#7-credit-authorship-and-art)) |
| Native nations | Each nation, picked from the project's list or written in ("Not on the list"), with one or more relationships: Citizen or member, Descendant, Family by marriage or adoption, Live in the community, Work for the nation, Work with the nation, Other | No | Self-described, as the U.S. Census Bureau's race data are "based on self-identification"[^census]. A nation from the list is stored by its identifier, so the contributor page can link to it (Trevor, Nov. 24, 2026); a written-in name lets First Nations, state-recognized nations and nations the project has not listed fit too. The project never asks for enrollment numbers, cards or other proof, and listing a nation does not mean speaking for it. In a credit the nation's name is printed without the states that follow it in the federal list ("Navajo Nation", not "Navajo Nation, Arizona, New Mexico, & Utah") |
| Your background | About yourself; a CV or résumé (.pdf, .docx, .odt, .doc, .rtf, .txt, up to 10 MB) | No | To match work to people's experience. The CV is kept in the private bucket, checked by the virus scanner (`profile-document`, [site/SCANNING.md](../site/SCANNING.md)), and never published |
| Your background | Languages, each with Speak, Read and Write | No | Picked from a list built from the U.S. Census Bureau's language code list for the American Community Survey (codes 6800 to 7099 for the Native languages of North America, and the Pacific Island languages of the United States and its territories), with ISO 639-3 codes, plus American Sign Language and Plains Indian Sign Language, and Other written in[^census-languages][^iso639] (`site/src/lib/languages.ts`). Shown on the contributor page if ticked; never printed |
| Your background | Organization, office or school | No | To match work to people. May be ticked for the credit |
| Your background | Specialties: peacemaking, mediation, Tribal courts, Tribal codes and constitutions, language and translation, research and sources, and any others in the person's own words | No | Shown on the People page and the person's own page if ticked (lead author, 2026-11-23) |
| Help | Ways to help (write, review, share knowledge, research, translate, art, outreach, website) | At least one | Each choice shows what it involves next, so nobody is surprised later (below) |
| Help | Time available | No | For planning |
| Credit | A description, to use in place of a name | Only if ticked | For a credit such as "a peacemaker from the nation" |
| Credit | Short biography | Writers only | Writers appear in the list of contributors with a biography. A biography is never published with a description-only credit, because it could identify the person (project analysis) |

The project does not ask for a full date of birth, address, gender, race, enrollment number or blood quantum. None is needed to work with someone or credit them (project analysis, following the CARE principle of authority to control, [decision record 0001](decisions/0001-adopt-care-principles.md)).

### What each kind of help leads to

| Choice | Next |
| --- | --- |
| Write an essay or commentary | A short biography for the list of contributors, and a co-author agreement before the writing is used ([contributions.md](contributions.md#forms-not-yet-drafted)). Drafts are edited in the workspace once the lead author gives access |
| Review drafts | Workspace access, given by the lead author |
| Share knowledge or experience | A filing with its own contributor statement for anything shared ([contributions.md](contributions.md)). Registering never counts as permission to use material |
| Find and check sources | Access to sources and research notes |
| Translate | The project asks which languages and which pages before any work starts |
| Art | The art contest for Native artists, with a written agreement for each artist (charter, [commitment 7](charter.md#7-credit-authorship-and-art)) |
| Outreach | Contact with a nation goes through the nation's own offices first (charter, [commitment 4](charter.md#4-consultation-before-publication)) |
| Website | Changes go through the public repository |

## Who sees what

| Information | Who sees it |
| --- | --- |
| A profile not yet confirmed | Only the person |
| Every answer | The lead author and editors |
| Email addresses, phone numbers, birth year, background, CV, interests and time | The lead author and editors only. Never printed or published |
| Names, nations, organization, description and biography ticked for the book | Readers of the book, in the credit line |
| Names, nations, organization, description and biography ticked for the website, and the picture, pronouns, languages and specialties ticked for the website | Readers of the website: the credit and, for a name, the contributor page; never the picture, other names or biography for someone under 18 |
| The history of a profile | The lead author and editors; it names roles and actions, not personal details |

Advisors, co-authors and nation reviewers do not see profiles. Permissions are `read-contributors` (lead author, editors) and `manage-contributors` (lead author) in [site/src/lib/permissions.ts](../site/src/lib/permissions.ts).

## Credits

A credit is built from the person's last confirmed version, separately for the book and the website, from the answers ticked for each (`creditIn` and `creditsOf` in [site/src/lib/contributors.ts](../site/src/lib/contributors.ts)). It replaced a single choice of credit form (name, name and nation, description, chosen name or none) and a single choice of places, because Trevor asked to "just denote for all info what can and cannot be used" (Nov. 23, 2026) and found "Shown" unclear about online or print (Nov. 24, 2026).

| Ticked for that place | Prints |
| --- | --- |
| The first and last name, with other names | "Sample Name (Sample Native Name)" |
| Other names only | "Sample Native Name" |
| A description, and no name | "a peacemaker from the nation" |
| Then any nations | ", Navajo Nation; Sample Nation" |
| Then the organization | ", Sample Program" |
| Nothing with a name or description | No credit in that place |

When the book and the website read the same there is one credit for both; otherwise one for each. Confirmed versions kept before the redesign are read through `upgradeAnswers`, so they give the same credit (the line now puts nations after a comma rather than in brackets).

Each signed-up contributor's credit sits in one section of the book: contributors (with biographies), reviewers or acknowledgments (printed as Thanks). Advisors are not a separate section (lead author, 2026-11-22). The workspace shows the credits "as they would be printed today", sorted by family name. Credits for an essay's byline come from the editing workspace, which records who wrote each draft and reads the credited name and opt-in from the profile at publish time (thread "Plan collaborative editing for the website").

The roles are coarser than the Contributor Role Taxonomy (CRediT), "a community-owned taxonomy of 14 contributor roles" approved as an ANSI/NISO standard in 2022,[^credit] because the book credits people by section rather than by task. If the project later lists who did what for each essay, CRediT's roles are the ones to use (project analysis).

### Credits in the book

The lead author downloads the book's Credits page from the workspace Contributors page (`/workspace/contributors/credits.md`, lead author only). The file holds only credits that people chose to have in the book, grouped as Contributors, Reviewers and Thanks, each sorted by family name. Every name and biography is escaped so it prints as written and cannot become a citation, link or heading. Before each edition, the lead author asks everyone credited to check their credit, then saves the file as `content/front-matter/credits.md`. The print pipeline prints it after the Acknowledgments (`FRONT_MATTER_ORDER` in `pdf/pipeline/book.mjs`). The code is in `site/src/lib/credits-export.ts`.

### Credits on the website

The public `/contributors` page lists credits that people chose to have on the website, read live from the last confirmed versions, so the book and the website can differ by each person's choice. It is not built ahead of time and is cached for five minutes. The Acknowledgments page links to it.

### Contributor pages

Someone with a name ticked for the website gets a public page at `/contributors/<address>`, as Trevor asked on Nov. 23, 2026. The `/contributors` list links each such name to it. A credit by description gets no page, because a description is not a name, and nor does someone credited only in the book. The address comes from the name, with accents removed (`slugOf` in `site/src/lib/contributors.ts`); a second person with the same name gets "-2", and a name with no Latin letters, such as one in Cherokee syllabary, gets a neutral address. It is set each time the person confirms and is stored in `contributor_profiles.public_slug` (migration 0014).

The page is read from the last confirmed version, like the credit, and shows only what is ticked for the website: the names, nations, organization, pronouns, languages, specialties, biography and picture. It also shows the section they are credited in, the month they signed up, and the published work they helped with. That work is every published essay with a version they saved, and every published essay, nation record, glossary term or provision they reviewed, each once. A nation record held back until the nation approves it is left out. Contacts, birth year, background, CV, interests and anything not ticked are never shown. The code is `contributorPage` in `site/src/lib/server/contributor-pages.ts`; the page is not built ahead of time and is cached for five minutes.

Uploads people file through the shared upload path, and links to the person's own website, are not listed yet.

### Profile pictures

A person 18 or older can add one picture on the profile form, beside their name (Trevor, Nov. 23, 2026: "allow for adding picture"). In the browser it is cropped to a square from its middle and made into a 400 by 400 JPEG (`site/src/lib/square-picture.ts`), so the original photo never leaves the device. The server accepts only a JPEG of at most 1 MB and 1,200 pixels a side, and removes every segment but the picture: Exif (camera details and location), XMP, colour profiles, Photoshop data and comments (`cleanJpeg` in `site/src/lib/server/profile-pictures.ts`). It is kept in the private bucket under `profile-pictures/<profile>/` and served only through the contributor page, at `/contributors/<address>/picture`, while the page shows it and the person has ticked Website for it. It is never printed in the book. A person can change or remove it at any time; the old file is deleted at once, and so is the picture when the profile or account is deleted or a removed sign-up expires. Someone under 18 cannot add one, and an existing picture stops showing as soon as they save a birth year that makes them under 18.

### The People page

The public `/people` page lists everyone with a contributor page, each linked to it, as Trevor asked on Nov. 23, 2026. The nonprofit's board comes first. Below it, everyone else is grouped by contribution (Helped write, Reviewed and Thanks, from their credit section) or by specialty, chosen with two links so it works without scripts (`/people?group=specialty`). A person with several specialties appears under each. Each card shows the picture or initials, the name, and a short count of published essays written and public pages reviewed. People credited by a description, or only in the book, stay on the `/contributors` list. The People page is in the footer and linked from the Contributors and Acknowledgments pages; it is not in the sidebar, which follows the working outline's main menu.

Board members are marked by the lead author on the person's workspace Contributors page, with an optional office such as President, left empty until the nonprofit's offices are set (`board_member`, `board_office`, migration 0014). Only someone with a public contributor page can be listed. The code is `peopleDirectory` in `site/src/lib/server/contributor-pages.ts` and `site/src/routes/people/`.

## Keeping and deleting

A removed sign-up is deleted, with its answers and every confirmed version, 12 months after the decision (`deleteExpiredDeclinedProfiles` in `site/src/lib/server/contributor-profiles.ts`). The check runs each time the workspace Contributors page opens, like the request purge, so no scheduled job is needed. The history keeps only that a profile was deleted and why.

## Deleting an account

Anyone signed in can delete their own account from the profile page (`/profile/delete-account`), as Trevor asked on Nov. 22, 2026. The page lists what is deleted and what stays, asks one question and needs a ticked box. The code is `deleteAccount` in `site/src/lib/server/account-deletion.ts`.

- **Deleted at once:** the account, its sessions and unused sign-in codes, the contributor profile with every confirmed version, the contributor page and picture, and the pages the person follows with their email setting (those tables cascade from `accounts`). The person is signed out everywhere.
- **Workspace members:** the row in `people` stays, because reviews, drafts and the sealed activity log point to it. Its email address and sign-in are removed, its access ends, and its name is kept or replaced by "Former contributor", as the person chose.
- **Credits:** if the person keeps their name, the credit line they last confirmed is kept in `retained_credits` (migration 0009), with nothing else about them, and still prints and shows where they chose. If they remove it, the credit goes. A credit already printed cannot be recalled; the next edition follows the choice (the same rule as [contributions.md](contributions.md#changes-and-withdrawal)).
- **Files the person sent** (docs/uploads.md) are deleted unless they were filed or kept for reference; those stay, no longer tied to the account. `deleteAccount` calls `forgetAccountUploads` before the account row goes.
- **Signed forms** stay on file, because they record consent. The person changes or withdraws what they shared with the Change or withdrawal form.
- **This device:** starred and saved pages live in the browser, not the account, and are cleared in Settings, under Data.
- The only lead author cannot delete their account until someone else is lead author.

## How it is built

- **Tables** (`site/migrations/0003_contributor_profiles.sql`, redesigned in `20261124T0100_redesign_contributor_profiles.sql`): `contributor_profiles` (one per account, `sign_in_subject` holding the account identifier; `person_identifier` links to `people` once the lead author gives workspace access), one table for each repeatable answer (`contributor_names`, `contributor_pronouns`, `contributor_contacts`, `contributor_nations` with `contributor_nation_relationships`, `contributor_languages`, `contributor_specialties`, `contributor_interests`), `contributor_placements` (Book and Website for the picture, full name, pronouns, organization, specialties, description and biography), and `contributor_profile_versions` (one row per confirmation, with a JSON copy of the answers and the previewed credit line). History goes to the shared `events` table with target `profile`, which migration 0002 (permission tiers) allows.
- **Pages:** `/join` (public, built ahead of time), `/contributors`, `/contributors/<address>` and `/people` (public, live), `/profile`, `/profile/edit`, `/profile/review`, `/workspace/contributors` and `/workspace/contributors/<identifier>`. All work without JavaScript: on the profile form, Add and Remove save the form and come back with the row added or removed. The profile pages are never cached or framed, like the workspace.
- **Sign-in:** `src/routes/sign-in/callback/+server.ts` sends a verified account that is not on the People list to `/profile` instead of refusing it. `src/hooks.server.ts` sets `locals.account` on profile and workspace pages; `requirePerson` sends an account without workspace access to its profile.
- **Tests:** `tests/contributors.test.ts` (credit lines, required answers, the form), `tests/contributor-profiles.test.ts` (drafts stay private, versions, credits only from confirmed versions, workspace access, deletion, the 12-month cleanup), `tests/contributor-pages.test.ts` (page addresses, what a page shows, pictures, the People page) and `tests/credits-export.test.ts` (the book's Credits page).

## Not built yet

- Email to the lead author when someone signs up, and to contributors before each edition goes to print. This waits on a domain for sending email.

## References

[^govuk-check]: GOV.UK Design System, *Check answers*, "When to use this pattern" and "How it works," [design-system.service.gov.uk](https://design-system.service.gov.uk/patterns/check-answers/) (accessed Nov. 21, 2026).
[^govuk-names]: GOV.UK Design System, *Names*, "Single or multiple name fields," [design-system.service.gov.uk](https://design-system.service.gov.uk/patterns/names/) (accessed Nov. 21, 2026).
[^w3c-names]: World Wide Web Consortium, Internationalization, *Personal Names Around the World*, "Strategies for splitting up names," [w3.org](https://www.w3.org/International/questions/qa-personal-names) (accessed Nov. 21, 2026).
[^govuk-phone]: GOV.UK Design System, *Phone numbers*, "When to use this pattern" and "Allow different formats," [design-system.service.gov.uk](https://design-system.service.gov.uk/patterns/phone-numbers/) (accessed Nov. 21, 2026).
[^census]: U.S. Census Bureau, *About the Topic of Race*, "What is Race?" (rev. Apr. 2, 2026), [census.gov](https://www.census.gov/topics/population/race/about.html) (accessed Nov. 21, 2026). The page describes the 1997 federal standards; the Office of Management and Budget revised them on March 28, 2024.
[^libphonenumber]: *libphonenumber-js* (MIT License), the JavaScript port of Google's libphonenumber, [gitlab.com/catamphetamine/libphonenumber-js](https://gitlab.com/catamphetamine/libphonenumber-js) (version 1.13.15).
[^census-languages]: U.S. Census Bureau, *Language Code List* (American Community Survey, 2024), [www2.census.gov](https://www2.census.gov/programs-surveys/demo/about/language-use/primary_language_list.pdf).
[^iso639]: SIL International, *ISO 639-3 Code Tables*, [iso639-3.sil.org](https://iso639-3.sil.org/code_tables/639/data).
[^credit]: NISO, *CRediT – Contributor Role Taxonomy*, [credit.niso.org](https://credit.niso.org/) (accessed Nov. 21, 2026).
