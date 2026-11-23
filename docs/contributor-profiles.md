# Contributor registration and profiles

**Status:** built on the website; the wording of each question is a draft for the lead author to review. Everything here is project design unless a source is cited ([decision record 0022](decisions/0022-open-registration-for-contributors.md)).

People who want to help with the project (writers, reviewers, researchers, translators, artists, people who know how disputes are resolved in their communities) register on the website, keep a profile, and choose how they are credited in the book and on the website. The project asks for this information when people first offer to help, so it does not have to chase it before an edition goes to print, and every person confirms what will appear on a review page before anything is used.

## The flow

1. **Learn what is asked.** `/join` explains what registering involves, what is asked and why, who sees it, and that registering does not give permission to use anything a person shares. It links to the request form for anyone who would rather not make an account.
2. **Sign in.** The person signs in with a code sent to their email address, or a password they chose later. Signing in proves they receive mail at that address, the same rule that protects invitations ([site/COLLABORATION.md](../site/COLLABORATION.md), "How sign-in works"). Someone who signs in and is not on the People list is no longer turned away: they go to their profile. The workspace stays closed to them.
3. **Fill in the profile** (`/profile/edit`), in six parts: about you, how to reach you, Native nations, background, how you would like to help, and credit. Everything except a name is optional while editing, and the person can save and finish later.
4. **Check the answers** (`/profile/review`). One page shows every answer, who can see it, and the credit exactly as it will be printed, with a "Change" link next to each answer. The GOV.UK Design System recommends a single check-answers page "immediately before the confirmation screen for small to medium-sized transactions," with "a ‘Change’ link next to each section," because it gives users "a second chance to notice and correct errors before submitting data."[^govuk-check] The person ticks a box and confirms.
5. **The project keeps a copy.** Each confirmation stores a numbered version: every answer as the person saw it and the credit line as it was previewed. The first confirmation signs the person up. There is no waiting step: everyone who confirms is accepted (lead author, 2026-11-22), and the credit goes under Contributors for writers, Reviewers for reviewers, or Thanks for everyone else.
6. **The lead author follows up** on the workspace's Contributors page. They can move a credit to another section, or remove anyone who should not be listed, with a reason the person sees on their profile. They give reviewers and writers workspace access with a role.
7. **Later changes.** The person can edit at any time. Edits are saved but not used until confirmed again: credits always come from the last confirmed version. Before each edition goes to print, the project asks every credited person to check their credit again (process step; email reminders are not built yet).

People the lead author invites from the People page also keep a profile: the workspace overview asks them to set one up, so their credit is their own choice too.

## What is asked, and why

| Part | Question | Required to confirm? | Why it is asked |
| --- | --- | --- | --- |
| About you | First name | Yes | To address the person and print a credit |
| About you | Last name | No | Only to sort the list of credits. "Not everyone’s name fits the first-name, last-name format,"[^govuk-names] and the W3C advises "don't require that people supply a family name."[^w3c-names] A person with one name writes it in the first box |
| About you | A Native name, or another name they go by | No | Some people have a name in their nation's language. It is printed only if the person writes it in their credit |
| About you | Age: 13 to 17, or 18 or older | Yes | Signing up on the website is for people 13 or older (lead author, 2026-11-22), the age below which federal rules on children's data apply (16 C.F.R. § 312.2). Someone younger helps with a parent or guardian through the request form and the consent for minors form ([docs/contributions.md](contributions.md#contributors-under-the-age-of-majority)). People under 18 are credited only by a description or a name they choose, with no biography and no picture, so nothing published can identify them (migration 0013 replaced the single "13 or older" box, and earlier answers are asked again) |
| Contact | Email address | Comes from sign-in | Proved by the sign-in code, so it cannot be mistyped or claimed by someone else |
| Contact | Phone number | Only if the person asks to be called or texted | "Only collect phone numbers from people if you genuinely need them,"[^govuk-phone] in any format, with country or area code[^govuk-phone] |
| Contact | Best way to reach you | No (email by default) | GOV.UK: "Not everyone has or can use a phone, so make sure you give users a choice about how they can be contacted."[^govuk-phone] |
| Native nations | Connected to a Native nation? Yes and list / No / Rather not say | No | So the project knows whose knowledge and perspective it is drawing on, and so a person can choose to be credited with their nation (charter, [commitment 7](charter.md#7-credit-authorship-and-art)) |
| Native nations | Each nation, and the connection in the person's own words | No | Self-described, as the U.S. Census Bureau's race data are "based on self-identification"[^census]. The project never asks for enrollment numbers, cards or other proof, and listing a nation does not mean speaking for it. A name may be picked from the project's list or typed freely, so First Nations, state-recognized nations and nations the project has not listed fit too |
| Background | About yourself; languages; organization or school | No | To match work to people's experience |
| Background | Specialties: peacemaking, mediation, Tribal courts, Tribal codes and constitutions, language and translation, research and sources, and Other in the person's own words | No | Shown with the person's name on the People page and their own page, when they have one (lead author, 2026-11-23) |
| Help | Ways to help (write, review, share knowledge, research, translate, art, outreach, website) | At least one | Each choice shows what it involves next, so nobody is surprised later (below) |
| Help | Time available | No | For planning |
| Credit | Kind of credit | Yes | The five forms of [schemas/common.schema.json](../schemas/common.schema.json) `credit`, the same as the contributor statement: name, name and nation, a description, a name the person chooses, or none |
| Credit | Name as printed | No | For a middle initial, a name in the person's language or script, or diacritics. Stored as written, in Unicode NFC (repository rule) |
| Credit | In the book; on the website | No (both by default) | The person decides where |
| Credit | Short biography, and whether to print it | Writers only | Writers appear in the list of contributors with a biography. A biography is never printed with a description-only credit, because it could identify the person (project analysis) |

The project does not ask for date of birth, address, gender, pronouns, race, enrollment number, blood quantum or a photograph. None is needed to work with someone or credit them (project analysis, following the CARE principle of authority to control, [decision record 0001](decisions/0001-adopt-care-principles.md)).

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
| Name, background, languages, organization, interests, time, nations | The lead author and editors |
| Email address and phone number | The lead author and editors. Never printed or published |
| The credit line, and the biography if chosen | Readers of the book and the website, only in the form and places the person confirmed |
| The contributor page, the picture and the specialties | Readers of the website, only while the person is credited on the website by name or by a chosen name; the picture never for someone under 18 |
| The history of a profile | The lead author and editors; it names roles and actions, not personal details |

Advisors, co-authors and nation reviewers do not see profiles. Permissions are `read-contributors` (lead author, editors) and `manage-contributors` (lead author) in [site/src/lib/permissions.ts](../site/src/lib/permissions.ts).

## Credits

A credit is built from the person's last confirmed version by `creditOf` in [site/src/lib/contributors.ts](../site/src/lib/contributors.ts):

| Kind | Prints |
| --- | --- |
| Name | The name as printed, or the given and family names |
| Name and nation | The name, then the nations the person ticked, in brackets: "Ada Example (Sample Nation)" |
| Description | The description only: "a peacemaker from the nation" |
| A chosen name | The chosen name |
| No credit | Nothing |

Each signed-up contributor's credit sits in one section of the book: contributors (with biographies), reviewers or acknowledgments (printed as Thanks). Advisors are not a separate section (lead author, 2026-11-22). The workspace shows the credits "as they would be printed today", sorted by family name. Credits for an essay's byline come from the editing workspace, which records who wrote each draft and reads the credited name and opt-in from the profile at publish time (thread "Plan collaborative editing for the website").

The roles are coarser than the Contributor Role Taxonomy (CRediT), "a community-owned taxonomy of 14 contributor roles" approved as an ANSI/NISO standard in 2022,[^credit] because the book credits people by section rather than by task. If the project later lists who did what for each essay, CRediT's roles are the ones to use (project analysis).

### Credits in the book

The lead author downloads the book's Credits page from the workspace Contributors page (`/workspace/contributors/credits.md`, lead author only). The file holds only credits that people chose to have in the book, grouped as Contributors, Reviewers and Thanks, each sorted by family name. Every name and biography is escaped so it prints as written and cannot become a citation, link or heading. Before each edition, the lead author asks everyone credited to check their credit, then saves the file as `content/front-matter/credits.md`. The print pipeline prints it after the Acknowledgments (`FRONT_MATTER_ORDER` in `pdf/pipeline/book.mjs`). The code is in `site/src/lib/credits-export.ts`.

### Credits on the website

The public `/contributors` page lists credits that people chose to have on the website, read live from the last confirmed versions, so the book and the website can differ by each person's choice. It is not built ahead of time and is cached for five minutes. The Acknowledgments page links to it.

### Contributor pages

Someone credited on the website by name, by name and nation, or by a chosen name gets a public page at `/contributors/<address>`, as Trevor asked on Nov. 23, 2026. The `/contributors` list links each such name to it. A credit by description gets no page, because a description is not a name, and nor does someone credited only in the book. The address comes from the name, with accents removed (`slugOf` in `site/src/lib/contributors.ts`); a second person with the same name gets "-2", and a name with no Latin letters, such as one in Cherokee syllabary, gets a neutral address. It is set each time the person confirms and is stored in `contributor_profiles.public_slug` (migration 0013).

The page is read from the last confirmed version, like the credit, and shows only what the credit allows. That is the name, the nations the person ticked for a credit by name and nation, and the biography if they chose to print it. It also shows the picture, the section they are credited in, the month they signed up, and the published work they helped with. That work is every published essay with a version they saved, and every published essay, nation record, glossary term or provision they reviewed, each once. A nation record held back until the nation approves it is left out. Phone, email, background, interests and the nations not ticked are never shown. The code is `contributorPage` in `site/src/lib/server/contributor-pages.ts`; the page is not built ahead of time and is cached for five minutes.

Uploads people file through the shared upload path, and links to the person's own website, are not listed yet.

### Profile pictures

A person 18 or older can add one picture on their profile page. In the browser it is cropped to a square from its middle and made into a 400 by 400 JPEG (`site/src/lib/components/ProfilePicturePicker.svelte`), so the original photo never leaves the device. The server accepts only a JPEG of at most 1 MB and 1,200 pixels a side, and removes every segment but the picture: Exif (camera details and location), XMP, colour profiles, Photoshop data and comments (`cleanJpeg` in `site/src/lib/server/profile-pictures.ts`). It is kept in the private bucket under `profile-pictures/<profile>/` and served only through the contributor page, at `/contributors/<address>/picture`, while the page shows it. It is never printed in the book. A person can change or remove it at any time; the old file is deleted at once, and so is the picture when the profile or account is deleted or a removed sign-up expires. Someone who answers that they are under 18 cannot add one, and an existing picture stops showing as soon as they save that answer.

### The People page

The public `/people` page lists everyone with a contributor page, each linked to it, as Trevor asked on Nov. 23, 2026. The nonprofit's board comes first. Below it, everyone else is grouped by contribution (Helped write, Reviewed and Thanks, from their credit section) or by specialty, chosen with two links so it works without scripts (`/people?group=specialty`). A person with several specialties appears under each. Each card shows the picture or initials, the name, and a short count of published essays written and public pages reviewed. People credited by a description, or only in the book, stay on the `/contributors` list. The People page is in the footer and linked from the Contributors and Acknowledgments pages; it is not in the sidebar, which follows the working outline's main menu.

Board members are marked by the lead author on the person's workspace Contributors page, with an optional office such as President, left empty until the nonprofit's offices are set (`board_member`, `board_office`, migration 0013). Only someone with a public contributor page can be listed. The code is `peopleDirectory` in `site/src/lib/server/contributor-pages.ts` and `site/src/routes/people/`.

## Keeping and deleting

A removed sign-up is deleted, with its answers and every confirmed version, 12 months after the decision (`deleteExpiredDeclinedProfiles` in `site/src/lib/server/contributor-profiles.ts`). The check runs each time the workspace Contributors page opens, like the request purge, so no scheduled job is needed. The history keeps only that a profile was deleted and why.

## Deleting an account

Anyone signed in can delete their own account from the profile page (`/profile/delete-account`), as Trevor asked on Nov. 22, 2026. The page lists what is deleted and what stays, asks one question and needs a ticked box. The code is `deleteAccount` in `site/src/lib/server/account-deletion.ts`.

- **Deleted at once:** the account, its sessions and unused sign-in codes, the contributor profile with every confirmed version, the contributor page and picture, and the pages the person follows with their email setting (those tables cascade from `accounts`). The person is signed out everywhere.
- **Workspace members:** the row in `people` stays, because reviews, drafts and the sealed activity log point to it. Its email address and sign-in are removed, its access ends, and its name is kept or replaced by "Former contributor", as the person chose.
- **Credits:** if the person keeps their name, the credit line they last confirmed is kept in `retained_credits` (migration 0009), with nothing else about them, and still prints and shows where they chose. If they remove it, the credit goes. A credit already printed cannot be recalled; the next edition follows the choice (the same rule as [contributions.md](contributions.md#changes-and-withdrawal)).
- **Signed forms** stay on file, because they record consent. The person changes or withdraws what they shared with the Change or withdrawal form.
- **This device:** starred and saved pages live in the browser, not the account, and are cleared in Settings, under Data.
- The only lead author cannot delete their account until someone else is lead author.

## How it is built

- **Tables** (`site/migrations/0003_contributor_profiles.sql`): `contributor_profiles` (one per account, `sign_in_subject` holding the account identifier; `person_identifier` links to `people` once the lead author gives workspace access), `contributor_nations`, `contributor_interests`, and `contributor_profile_versions` (one row per confirmation, with a JSON copy of the answers and the previewed credit line). History goes to the shared `events` table with target `profile`, which migration 0002 (permission tiers) allows.
- **Pages:** `/join` (public, built ahead of time), `/contributors`, `/contributors/<address>` and `/people` (public, live), `/profile`, `/profile/edit`, `/profile/review`, `/workspace/contributors` and `/workspace/contributors/<identifier>`. All work without JavaScript. The profile pages are never cached or framed, like the workspace.
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
[^credit]: NISO, *CRediT – Contributor Role Taxonomy*, [credit.niso.org](https://credit.niso.org/) (accessed Nov. 21, 2026).
