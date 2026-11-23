# Website design

**Status:** design exploration, Nov. 21, 2026. Nothing here is built yet. This
document records the direction the website will follow: who it serves, how it
is organized, how it looks and behaves, and why. Mockups of the key pages, in
light and dark themes, are in a design canvas shared through the project
thread. Changes to this document are made by pull request.

Where a choice rests on a published source, a footnote cites it. Where it is
the project's own judgment, it says "project choice" or "project analysis."
The reference sites were reviewed in the research session
[2026-11-21-website-design-references](../research/sessions/2026/2026-11-21-website-design-references.md).

## 1. What the website is for

The website publishes the model code, its commentary, the profiles of Native
nations, the glossary and the sources, and it is the place where a nation asks
the project to correct, restrict or remove material about it
([charter, commitment 6](../docs/charter.md#6-the-right-to-correct-restrict-or-withdraw)).
The style guide names the audience: "Tribal lawmakers, judges, peacemakers,
court staff, advocates and students, not only lawyers"
([style guide, section 2](../docs/style-guide.md#2-plain-language)).

The design serves four jobs. They are composites drawn from that audience,
not findings from user research, which has not been done (project analysis).

| Person | Job | The site succeeds when |
| --- | --- | --- |
| Reader: a Tribal council member or court clerk drafting an ordinance | Compare the alternatives in a section and understand what each choice does | They compare alternatives and read the comment without leaving the page |
| Researcher: a law student or scholar | Find which nations have published dispute resolution or peacemaking law, and cite it | Every fact is one step from its source, and a citation names the version |
| Nation representative: staff of a nation's court, legal department or cultural office | Check what the project says about the nation, and correct, restrict or remove it; or, if the nation is missing, ask to add it with proof from a government source | A request takes minutes, needs no account, and protects first |
| Contributor: a peacemaker, Indigenous author, reviewer or co-author | Offer sources, review, preferred terms or text, and be credited as they choose | They contribute without a GitHub account |

User research with people in each role is the most important next step for
the design; see [section 13](#13-open-questions-and-next-steps).

## 2. The feel: a drafting desk

The site should read as a careful legal reference, the way the style guide
asks the writing to: "precise, calm and specific"
([style guide, section 1](../docs/style-guide.md#1-voice-and-tone)). The
design spends its boldness in one place, the marks a drafter works with, and
keeps everything else quiet (project choice):

- **Hanging section numbers.** "§ 2-104" is set large, in the track's color,
  above the section title, so a reader always knows where they are in the code.
- **Lettered alternatives.** Alternative A and Alternative B are tabs a reader
  switches between, with a "Compare side by side" view.
- **Fill-in placeholders.** Template variables such as `{{nation.name}}`
  appear as highlighted fill-ins, "[Name of Nation]", the way the book prints
  them ([data model, built for templates](../docs/data-model.md#built-for-templates)).
  A future template builder fills them in.
- **Dotted glossary links.** Defined terms have a dotted underline and open a
  short card; ordinary links have a solid underline.
- **Track color.** The ADR track and the peacemaking track each have a color,
  always paired with the words "ADR track" or "Peacemaking track."

Each mark encodes something about the text; none is decoration.

### What the design avoids

- **Borrowed Native motifs.** No patterns, borders, colors or icons that
  imitate Native art. The IllumiNative industry guide advises against
  pan-Indian visuals and sacred objects and asks whether a project has "the
  blessing and consent of the community";[^illuminative] the project's art
  will come only from Native artists, chosen through a contest
  ([charter, commitment 7](../docs/charter.md#7-credit-authorship-and-art)).
  Until then, the spaces for art are left visibly empty and labeled.
- **A single "Native" look.** "There is no single American Indian culture or
  language,"[^nk360] so no part of the interface suggests one.
- **Official or governmental styling.** The site is not a government site.
  The U.S. Web Design System itself says not to use its official banner on
  non-government domains.[^uswds-banner] The site borrows government design
  patterns, not their look (project choice).
- **Custom icons.** The site and the book draw only from Lucide (see
  [section 6, Icons](#6-components)). No icons are drawn for the project.

## 3. What the design borrows

Observations below come from the pages listed in the research session.
"Borrow" and "avoid" are project analysis.

| Reference | What the project borrows | What it avoids |
| --- | --- | --- |
| [Cornell LII, 25 U.S.C. § 1302](https://www.law.cornell.edu/uscode/text/25/1302) | Breadcrumb down to the section; previous and next links that show the neighboring section's title; defined terms linked inline from the text | Hiding notes behind tabs; definition pop-ups built from frames; advertising |
| [legislation.gov.uk, Equality Act 2010, section 6](https://www.legislation.gov.uk/ukpga/2010/15/section/6) | A status box on every section saying how current it is; a timeline of changes; viewing a section as of an earlier version; printing one section or the whole act | Nothing noted |
| [eCFR reader aids](https://www.ecfr.gov/reader-aids/using-ecfr/reading-ecfr-content) | A contents rail beside the text; copy-citation and copy-link tools; comparing two dates | A crowded tool panel |
| [Uniform Law Commission catalog](https://www.uniformlaws.org/acts/catalog/current) | An A to Z index that leaves empty letters unlinked | Publishing the text only as downloads. Here, every provision is a web page with its own address |
| [GOV.UK Design System: question pages](https://design-system.service.gov.uk/patterns/question-pages/), [start pages](https://design-system.service.gov.uk/patterns/start-using-a-service/), [summary list](https://design-system.service.gov.uk/components/summary-list/) | The request flow: a start page, then one question per page,[^govuk-one-thing] a "check your request" summary, then a confirmation; "Continue" buttons and a Back link; "(optional)" instead of asterisks | The GOV.UK look and typeface |
| [USWDS in-page navigation](https://designsystem.digital.gov/components/in-page-navigation/) | An "On this page" list beside long pages | Fixed elements that could cover keyboard focus (WCAG 2.4.11) |
| [NARF, National Indian Law Library, Tribal Law Gateway](https://narf.org/nill/triballaw/index.html) | Consent framing: the gateway says material is missing when "the Tribal Nation did not consent," and aims at "ensuring Tribal Nations remain in control of their own information"; a fixed order of sections on each nation's page, with dates on sources | Leaving the correction and removal process undescribed |
| [Native Land Digital](https://native-land.ca/about/how-it-works) | Saying plainly, next to the map, what it is not: its maps "are not official sources" and do not "represent or intend to represent official or legal boundaries" | A map with no text alternative; drawing territories |
| [Smithsonian NMAI, Native Knowledge 360](https://americanindian.si.edu/nk360/about/understandings) | A credit line on every image | Core content only in PDF |
| [Tufte CSS](https://edwardtufte.github.io/tufte-css/), [The Rust Programming Language](https://doc.rust-lang.org/book/ch04-01-what-is-ownership.html), [R for Data Science](https://r4ds.hadley.nz/) | Notes in the margin on wide screens, inline on phones; automatic, light and dark themes; keyboard paging between sections; a print view; a "report an issue" link on every page, routed here to the private request form | Tufte's checkbox trick for notes, which is not documented for assistive technology |
| [Wikipedia Page Previews](https://www.mediawiki.org/wiki/Page_Previews) | Hover cards for glossary terms, with a setting to turn them off | Previews that screen readers skip; here, the card's link leads to the same content |

The earlier design notes also drew on the Federal Register's "not an
official legal edition" notice and the DC Code's clean section pages; those
fed the "Model text, not law in force" notice in section 6.

## 4. Information architecture

### Main menu

The site's sections sit in a sidebar on the left of every page, in the order of the working outline's main menu: Model code, Peacemaking, Foundations, Essays, Methods and stories, Nations, Library, Glossary and About ([outline, The website](../docs/outline.md#the-website)). A section whose pages are not published yet is named but not linked. The sidebar opens the current section into the outline of the page being read (see [Sidebar](#6-components)); Trevor asked for it on every page on Nov. 22, 2026, so the layout never changes from page to page. The masthead keeps one row: the site's name, then "Report a problem" and Contribute, then the search control, Print and Download as icons, the theme button, the Settings button and, at the far right, a "Sign in" link that becomes a profile button once someone has signed in (Trevor asked for these on Nov. 22, 2026). Downloads and the changelog are linked from the footer (see [Masthead](#6-components)). Nobody needs to sign in to read the site or to make a request. The footer of every page carries "Request a correction or removal," the requests log, the licenses and the three version numbers ([requests.md](../docs/requests.md#where-the-request-starts)).

Peacemaking has its own menu item and landing page, because the project
treats it as its own track, not a variant of ADR
([charter, commitment 3](../docs/charter.md#3-peacemaking-as-its-own-track)).

### Addresses

Addresses reuse the identifiers in the repository, which never change once
published ([repository layout, identifiers](../docs/repository-layout.md#identifiers)).

| Page | Address |
| --- | --- |
| Home | `/` |
| Contents of the code | `/code` |
| Section, with its commentary | `/code/02-104` |
| Section history and comparison | `/code/02-104/history` |
| Section as of a version | `/code/02-104?version=0.0.1` |
| Essay | `/essays/i-history-of-adr` |
| Form | `/forms/agreement-to-participate` |
| Peacemaking landing page | `/peacemaking` |
| Nations directory | `/nations` |
| Nations by first letter and by state | `/nations/letter/a`, `/nations/state/nv` |
| Search | `/search?q=<words>` |
| Nation profile | `/nations/<id>` |
| Native Hawaiian community | `/nations/native-hawaiian` (its own page, never listed as a tribe) |
| Glossary and entry | `/glossary`, `/glossary/<id>` |
| Sources and source record | `/sources`, `/sources/<key>` |
| About, charter, methods, credits, licenses, accessibility | `/about/...` |
| Changelog and requests log | `/changelog`, `/changelog/requests` |
| Request form | `/requests` |
| Read offline | `/offline` |
| Starred pages, and a collection a reader shared | `/starred`, `/starred/shared#c=…` |
| Downloads: the book as PDF and EPUB, and data exports | `/downloads` (empty until the first edition) |
| Settings | `/settings` |
| Sign-in and the co-author workspace ([COLLABORATION.md](COLLABORATION.md)) | `/sign-in`, `/workspace` |
| Later: template builder, data | `/templates`, `/data` |

## 5. Page templates

| Template | Layout | Key parts |
| --- | --- | --- |
| Home | One column, then a four-part contents band | Purpose in one sentence; search; reserved art space; contents by part, with the two tracks side by side, giving no counts of what each part holds, since counts change with every update (Trevor, Nov. 22, 2026); "For Native nations" panel; recent changes |
| Section | Contents rail, text, margin | "Model text, not law in force" notice with the version and last change; hanging section number; status chips; text with alternatives and placeholders; Comment, Illustrations, Source note; previous and next; margin: On this page, notes, "Cite this section," "Adapt this section" |
| Track landing | One column | What the track is, cited; its chapters; for peacemaking, a step-by-step outline of how a process unfolds |
| Nation profile | Text and margin | One page for every nation; see [Nation pages](#nation-pages) below |
| Nations directory | One column | Links to one page per first letter and one per state, each a short table (name, recognition with its legal basis linked, states, review status); the small groups (the Native Hawaiian community, the Indigenous peoples of the territories) listed in full in their own tables; a link to the map. Finding one nation by name is the site search's job, so the tables have no search box of their own |
| Search | One column | The search box, a live count, and results grouped as nations and communities, stories, glossary terms and pages |
| Glossary entry | Entry rail, text, margin | The entry laid out as a dictionary entry (see Glossary pages below), about this entry, other entries that use it, the entries near it in alphabetical order, and a Sources section at the end |
| Stories | One column | A notice while stories await their nations' review; stories grouped by nation, each with its kind and first quoted excerpt with credit ([0029](../docs/decisions/0029-show-stories-while-nations-review-them.md)) |
| Story | Record page (see Record pages below) | Title and any title in the nation's language; a not-yet-reviewed notice with a removal link; At a glance beside the text with nations, community, kind, length, methods and topics; then, in the main column, "The story" in full where the rights allow, leading the page; "In the teller's words" (exact excerpts of 50 words or fewer, with credit and pinpoint), titled "In other tellings" under a full text; passages cited, not quoted; where it is told, each telling with whose voice it is and a link to read it in full; cultural protocols and how the site follows them; Sources at the end. Never a summary or retelling |
| Glossary | One column | An A to Z index under large letter headings; every entry in full, laid out as a dictionary entry, each with its own anchor such as `/glossary#native-nations` and a link to its own page; one Sources section at the end |
| Source record | Text and margin | Citation, original link, archived copies, change history, quotation basis, what cites it |
| Changelog | One column with tabs | Content, Website, Print and Requests log; each version's entries; comparison of a section between versions |
| Request | One question per page | Start page; what would you like to do; which material; how can we reply; details; credit (contribute only); check your request; request sent. Adding a missing nation branches to: which nation; which government source names it (kind, citation or upload); how can we reply; who is making this request (statement); check your request; request sent; and later a written decision with reasons and buttons to apply again or ask for reconsideration ([requests.md](../docs/requests.md#adding-a-nation-that-is-missing)) |
| Read offline | One column | Install the site; save the code, the profiles or both; what is saved and as of when |
| Downloads | One column | Each download with its format, version, date and size; until the first edition, an empty state saying what will appear |

### Nation pages

Every nation and community with a record in `content/tribes/` gets its own
page, built from that record at build time: 575 federally recognized nations
today, plus the Native Hawaiian community and territorial Indigenous peoples
in their own groups, never described as tribes. Trevor asked for this so that
each page makes it easy to report information and to show what is
distinctive about each nation.

**Order of sections.** Every page uses the same order, so readers and the nation's staff always know where to look, as the Tribal Law Gateway does with its fixed sections on each nation's page. Trevor chose this layout, the "reference page", from three mockups on Nov. 22, 2026:

1. The nation's name, and the nation's own name for itself, exactly as the nation writes it, once the nation confirms it. The name shown, in the title and in every list, is the name on the recognizing list without the states the list adds after a comma: "Navajo Nation, Arizona, New Mexico, & Utah" shows as "Navajo Nation" (Trevor, Nov. 22, 2026; `displayName` in `src/lib/nation-labels.ts`). A state that belongs to the name stays, as in "Paiute Indian Tribe of Utah". When the two differ, a line under the title gives the listed name, which the search also finds and the CSV download keeps; when they are the same, no line is shown and the name's source is only in the Sources list (Trevor, Nov. 22, 2026, removed "Name as the recognizing list gives it").
2. Review status: one small line, not a panel (Trevor, Nov. 22, 2026): a pill with a clock icon and the status (drafted from public sources, sent to the nation, reviewed by the nation, approved by the nation), then what that means and the date the sources were last checked, written out ("Nov. 21, 2026"). Report a problem in the masthead takes requests, so the line has no link of its own.
3. At a glance (see below), with the government contacts card under it.
4. Courts and dispute resolution: one heading for each kind of service (Courts, Peacemaking, Mediation and so on), so a kind is never repeated after a name; under Courts, how appeals move from the court that hears a case first to the highest court, where sources record it ([data model](../docs/data-model.md#courts-and-the-path-of-appeal)). A nation's judicial branch or judiciary (`judicial-branch`) is the court system as a whole, so it has its own "Judicial branch" heading before Courts and is never listed as a court, here or in At a glance; a directory's bare "Tribal Court" entry at the branch's own address is shown as the branch (Nov. 22, 2026).
5. Laws and agreements: where the nation publishes its laws and any published dispute resolution law, linked, not reproduced, until the nation permits more ([data model, permission statuses](../docs/data-model.md#permission-statuses)); then each of the nation's documents that has recorded versions, such as a gaming compact or a constitution ([decision record 0018](../docs/decisions/0018-document-version-history.md)). This one section replaced "Published dispute resolution law" and "Document history" (Trevor, Nov. 22, 2026). Two sources listing the same document (the same title, ignoring case, and the same address) make one line with both markers; two different links with the same title, such as two "Tribal code" links, are told apart by the site each is on, and a document that has its own history is not listed again as a link.
6. Jurisdiction: who has authority over what, as federal law and federal lists record it for the nation, such as Public Law 280 or a designated agent for Indian Child Welfare Act notices (`jurisdiction` in the record). Each line is the record's own cited wording.
7. Other nations in the same states: for each state, the other nations sources record there, alphabetically, or a link to the state's list when there are more than 30. A plain list, never a ranking or comparison; not printed (Trevor, Nov. 22, 2026).
8. Notices and Labels from Local Contexts.
9. Sources, each with links back to the markers that cite it, followed by the facts on the page that come from it.

**Legal sections always show.** Courts and dispute resolution, Laws and agreements and Jurisdiction appear on every nation's page, even with nothing to show, because this is a legal reference and a reader needs to see whether recourse may be available (Trevor, Nov. 22, 2026). An empty section says so in one line: a short answer in bold, then how far the search went, from the nation's search log where there is one (`src/lib/search-status.ts`). "None found" means every planned place was searched, and the line names how many places, the kinds of place and the date; "None found yet" means the search is not finished or has not been made; "None shown yet" means a search found a lead that is still being checked. Laws and agreements gets a "Constitution" row and a "Published laws" row when either is missing (articles of association count as a governing document; a corporate charter counts as neither). The page never says that a court or a law does not exist, since a nation can settle disputes through its council or keep its laws off the web, and a finished search for courts ends by suggesting the reader ask the nation's government office.

Each section from At a glance on, including Sources, is collapsible (Trevor, Nov. 22, 2026): its heading is the summary of a `<details>` element that starts open (`Collapsible.svelte`), so it works without scripts, and every folded section opens before printing so paper always has the whole page. The glossary pages' Sources section uses the same component. The review status line is not a section and does not fold. Sources is spaced like the other sections, with no rule above it.

The page no longer has "About this Nation" or its recorded features, the short sentences generated from the record's facts (Trevor, Nov. 22, 2026): the facts they repeated are in At a glance and Jurisdiction. A short description the nation writes or approves can open the page once a nation sends one; until then the page shows no placeholder for it, and the site never writes that description for the nation.

**Document headings.** Each document with recorded versions is headed by a short name: the nation's name is dropped from the front, "State of Arizona Gaming Compact" reads "Gaming compact with Arizona", and the nation's own constitution reads "Constitution" (`documentHeading` in `src/lib/server/document-history.ts`). The sidebar lists the headings under Laws and agreements. Under a heading, one line names the versions in effect. Each version's name links to a public copy of its text, the source's own address or else its archived copy (Trevor, Nov. 22, 2026); the project's private captures are never linked. Beside it are the markers of its sources, then a pill: "In effect" filled, any other recorded status outlined, so color is not the only cue, and no pill where the sources record no status. A line under it gives its dates, grouped where they are the same ("Published and listed Feb. 5, 2003"), and what it did to earlier versions (amended, replaced). Above each version list, a line places each version by the earliest date its sources give (filled dot: in effect; hollow: no longer in effect). It is drawn from recorded dates and kinds only, and hidden from screen readers because the list says the same (`DocumentTimeline.svelte`, Trevor, Nov. 22, 2026). The section opens straight onto the documents, with no introductory sentence (Trevor, Nov. 22, 2026). It shows no clause summaries or clause comparisons and no generated summary of the document, because a small model wrote them from excerpts (Trevor, Nov. 22, 2026); the records keep them for review.

**At a glance.** A filled panel, like a reference work's fact box. The nation's seal or logo heads it, centered, when its reuse status allows showing it ([official-images.md](../docs/official-images.md)); it has no caption (Trevor, Nov. 22, 2026): its Sources entry credits the nation's website and says the image belongs to the nation, which does not endorse this site, and the nation asks for its removal through Report a problem. Under the seal is a label and value table:

- Recognition: one line for each status, with the markers of every source that gives it, and under it the short form of the legal basis, such as "Pub. L. No. 103-454", linked to the official text. The full wording is in the Sources list.
- States with a presence: the states in one line, and under it, in smaller type, what sources record in each ("Government office: Arizona. Land: Arizona, New Mexico, Utah.").
- Bureau of Indian Affairs region, spelled out: the region, linked to the regions view of the big map, and under it the agency that serves the nation (Trevor asked for the region on Nov. 22, 2026).
- Languages, and "Member of" for organizations of nations the nation belongs to, such as the Coalition of Large Tribes (`memberships` in the record), where sources record them. Each organization's name links to the home page of its own website, taken from the source that records the membership when the organization itself published it (Trevor, Nov. 22, 2026).
- No courts or laws: the page's own sections show them, so the panel does not repeat them (Trevor, Nov. 22, 2026, after a short time when it listed "Courts and forums" and "Published law").

The map comes last in the panel. In a narrow panel each label sits above its values.

**Layout.** A nation's page is a record page (see Record pages below): the text, held to the reading measure, and beside it the At a glance panel and the contacts card, whenever the page's own column has room for both. In the page's order At a glance comes right after the title, so on a phone the key facts come first, and every section of the main column follows it, so selecting text in the main column never takes in the panel (Trevor, Nov. 22, 2026, found a selection pulling in the map, recognition and states when the panel came first in the middle of the text).

**Record pages.** Pages about one record, a nation's page and a story's page so far, use one layout, `src/lib/components/RecordPage.svelte`, so the pages read alike and a new kind of record gets the same layout for free (Trevor asked for a framework that is not tied to nations on Nov. 22, 2026). The layout knows nothing about the record. A page passes four parts as snippets: `introduction` (the title and what belongs under it), `glance` (the key facts and other short panels, optional), the record's sections as the body, and `sources` (optional). The key facts go in `GlancePanel.svelte`, a filled box with an optional picture on top, such as a seal, and an "At a glance" heading the reader can fold away. Inside it a page usually puts `FactGroups`, whose labels are plain text. When the page's own column is at least 52 rem wide, the sections sit on the left at the reading measure and the glance column on the right, at least 17 rem wide and at most the `side-column` token. Near that width the text column narrows first, to about 45 characters at the threshold. The threshold follows the width of `<main>`, not the window, so it counts the sidebar. Until Nov. 22, 2026 it was 62 rem, which stacked the columns on a 1,280 pixel laptop with the sidebar open but not with it hidden (Trevor found this; the page had 915 pixels of room against the 992 it needed). When the glance column is under 22 rem, each fact's label sits above its values, so names such as a heritage language do not break mid-word. Links to other websites inside a record page open in a new tab.

**The nation's map.** The map in At a glance has the big map's views as tabs, so a reader can see more than the states (Trevor, Nov. 22, 2026; [decision record 0033](../docs/decisions/0033-nation-page-map-has-the-big-maps-views.md)), each with its own caption naming its source. The tabs follow the WAI-ARIA tabs pattern in one bordered strip, the picked tab bold with a bar under it; without scripts every view shows, one after another. A view is offered only when the record has what it needs, and a page whose record lists no state has no map.

- **States** (the first view) shades the states and territories where the record's cited `states` facts place the nation, with each shaded state's postal code printed on it, so color is not the only cue. It shows only what is relevant to the nation (Trevor, Nov. 22, 2026): the boxes that hold its states and no others, with the contiguous United States zoomed to the region around them but never closer than 40 percent of the country's width, so neighbors stay in view. Alaska, Hawaiʻi or a territory shown without the main box is drawn up to three times larger. Zoomed boxes use more detailed outlines than the full-size small map, and only the states in view go into the page (`src/lib/presence-map.ts`).
- **Region** outlines the nation's Bureau of Indian Affairs region among its neighbors and names it on the map, zoomed no closer than a quarter of the country's width. Its caption says the lines are simplified for a national map and links to all the regions.
- **Land areas** draws the Census Bureau's 2020 areas whose codes the nation's record lists (`census_areas`), with a dot where an area is too small to see, and lists the areas by name and kind. Its caption says the outlines are the Census Bureau's, simplified, and are not a statement of the nation's own boundaries, as on the big map ([decision record 0028](../docs/decisions/0028-map-adds-census-land-areas.md)).

State outlines are written into the page once and shared by the views (`NationMap.svelte`), so three views do not triple the map's size.

**Reporting a problem.** One "Report a problem" button sits in the masthead, beside Contribute, on every page (Trevor, Nov. 22, 2026); pages carry no report links of their own. It opens a dialog over the page, the shared Modal, rather than a new page (Trevor's request the same day; `ReportProblem.svelte`). The dialog first asks what is wrong: correct, add a nation that is missing (with its note that one federal or state government source naming the nation is enough), restrict, remove, or ask a question. Contribute has its own button. It then asks the request form's questions for that choice (`RequestForm.svelte`, shared with the request page), with the material filled in: the record on a nation page (`tribes/<id>`) or glossary page, or else the page's address. The form is sent in place and the dialog shows the reference number and what happens next. Without scripts the button is a link to the request page with the record filled in, for example `/requests?record=tribes/<id>`, which asks the same questions. The pages no longer carry an "Is your nation missing?" line. This replaces the Nov. 21 rule of one link at the top of each page, which itself replaced a link beside every fact.

**Sources.** Each fact on a nation page ends with a numbered marker for each of its sources, as Wikipedia cites, and the sources are listed together in a "Sources" section at the end of the page (Trevor, Nov. 22, 2026; this replaced the rule of Nov. 21, 2026, that kept citations out of the text and listed them only at the end). Each source appears once, numbered in the order the page first cites it, with links back to the markers that cite it, followed by every fact on the page that comes from it, grouped by the heading the fact appears under, with the place in the source and the date the value was true. A fact with several facts from one source behind it, such as a state with both reservation and trust land, gets one marker for that source. See [Citations](#6-components) for how markers behave.

**A compact Sources list.** So the list stays short however many sources a page cites, Trevor chose on Nov. 23, 2026, from three mockups, a list grouped by the part of the page and folded (`SourceList.svelte`, `src/lib/source-groups.ts`). Each source is one row between thin lines, led by its number, which links back to the first place it is cited. Under the citation, a source cited more than once gets a line such as "Cited 7 times: a b c d e f g", with a link back to each place. The facts each source supports wait behind a "Show what each source supports" button above the list; without scripts, and on paper, they always show. A list of more than 8 sources from two or more parts of the page folds into groups, one for each part, in the page's order. Each source goes under the part that first cites it (`SourceUses.part()`), so on a nation page the groups are At a glance, Map, Courts and dispute resolution, Laws and agreements and Jurisdiction. Each group is a `<details>` that starts folded and shows its count and its numbers, such as "12 sources · 15–26". Within a group that covers several documents, a small label names each document, such as "Gaming compact with Arizona", before its sources. "Open all groups" opens or folds them all. A marker, a link back, or "See it in the Sources list" opens the group its source is in before the page moves there, and printing opens every group. A shorter list, or one with a single part, such as an essay's or a glossary entry's, stays one list of the same rows. The heading shows the number of sources after it, small and gray.

**Contacts.** A phone number is a `tel:` link that opens the device's dialer; an email address is a `mailto:` link. Fax numbers stay as text. A value that cannot be read reliably, such as a phone number that is not ten digits, stays as text (Trevor, 2026-11-21). The contacts appear as a contact card, described under [Components](#6-components).

**Missing information.** Empty fields are left out rather than shown as "unknown," so a page never suggests a nation lacks something it may simply not have published. The page has no "Add it" line for missed sources (Trevor, Nov. 22, 2026); readers offer them through Contribute or Report a problem in the masthead.

**Restricted and withdrawn records.** A record marked restricted gets no page
at all. A withdrawn record's page says only that the material was withdrawn
at the nation's request ([charter, commitment 6](../docs/charter.md#6-the-right-to-correct-restrict-or-withdraw)).

**In print.** The book's profiles follow the same order, so the website and
Part III read alike. The page template uses relative units and no fixed page
size, because the book's trim size is not yet decided (project choice).

## 6. Components

**Masthead.** One row on the band. It holds the wordmark, then "Report a problem" (a button that opens a dialog; see Reporting a problem under Nation pages) and Contribute, then the search icon (see Search), Star (on a page that can be starred; see Star), Print and Download (see Download) as borderless icon buttons named by `aria-label` and a tooltip, the theme button, the Settings cog and, at the far right, the sign-in control (Trevor, Nov. 22, 2026). Until the sidebar was added it had a second row with the main menu; the sections now live in the sidebar, so the row was removed rather than repeat them. Print and Download act on the page the reader is on (Trevor moved them there from under each page's title on Nov. 22, 2026). The content version is not shown under the name on screen (Trevor, Nov. 22, 2026); it is in the footer, and on paper it prints under the name. When the row runs out of room the controls wrap under the name. On phones (40rem and narrower) the masthead is one short row: the name, search and a "More" button (Trevor approved this on Nov. 22, 2026, so a phone reader reaches the page's title sooner). More opens a panel under the masthead, in the band's colors, that holds Report a problem, Contribute, Star, Print, Download, the theme button, Settings and sign-in. The panel is a native popover, so it opens and closes without scripts, and Escape or a tap outside closes it; on wider screens the same controls show in the row and More is hidden. Pages are built ahead of time, so the sign-in control cannot ask the server who is signed in; after someone signs in, the Worker sets a cookie that says only "signed in" and which workspace pages the person's role opens (no name, role or token), and "Sign in" then becomes a round profile button. It opens a short list (WAI-ARIA disclosure pattern, not a menu, since the items are plain links and a form): who is signed in ("Signed in as" the name and role, which the workspace and profile pages keep on the device so other pages can show it), Your profile, Workspace (only for people with workspace access), Password and Sign out. Trevor asked on Nov. 22, 2026 for "Signed in as" and Sign out to live here rather than across the top of the workspace and profile pages. Escape or a click elsewhere closes it. Without scripts it stays "Sign in," which still works. Sign-in itself is described in [COLLABORATION.md](COLLABORATION.md#how-sign-in-works).

**Sidebar.** A column on the left of every page, beside the text (Trevor, Nov. 22, 2026; `SiteSidebar.svelte`). It always lists the site's sections. The current section, in the link color, opens into the outline of the page being read, which each page passes from its load function as `outline` (`site/src/lib/site-sections.ts`): the code's divisions, chapters and sections, with the current section opening into Text, Comment, Illustrations and Source note; an essay's headings; a nation's page sections; the glossary's terms; the stories by title; the Nations section's Directory and Map. Until the methods catalog is published, "Methods and stories" links to the stories. The home page shows the sections only. The page or heading being read has an orange bar and a light fill, and `aria-current="page"` (or `"location"` for a heading). On wide screens (64 rem and up) the sidebar is 18 rem wide, stays in view as the page scrolls and scrolls on its own when its outline is long; "Hide sidebar" folds it to a narrow strip with one button to bring it back. Below 64 rem it becomes a "Menu" bar under the masthead that names where the reader is ("Navajo Nation") and opens the same list; the bar stays at the top of the screen, and `scroll-padding-top` keeps headings and focused controls clear of it. Both forms are `<details>` elements, so the sidebar works without scripts and the current page is marked when the site is built. A script adds two things when it runs: it remembers in the browser that the reader hid the sidebar, and it marks the heading being read as the page scrolls. The sidebar is not printed. Pages size their own columns by the width of `<main>`, which is a container (`container: page`), so a nation's "At a glance" column moves under the text when the sidebar takes the room. The pattern follows the contents rails of legal reference sites such as the eCFR (section 3). Under the sections, "Starred pages" links to the reader's own starred pages (see Star); it needs scripts, so it is hidden without them. For someone signed in with workspace access, a Workspace group sits between the sections and "Starred pages" and lists the workspace pages their role opens: Overview, Essays, Requests, Reviews, Contributors, People, Access and Activity log (`site/src/lib/workspace-menu.ts`). Trevor asked for it on Nov. 22, 2026, in place of a separate bar across the top of each workspace page. The workspace's own pages list it as they are rendered; the pages built ahead of time read it from the signed-in cookie once their script runs. Each workspace page still checks access for itself, so the list only decides what is shown.

**Search.** One search in the masthead covers the whole site, so lists do not need search boxes of their own (Trevor asked on Nov. 22, 2026). It is a plain search icon among the masthead's icon buttons. Pressing it opens a panel that floats over the page, under the masthead's right edge, so nothing in the masthead moves (Trevor asked for this and approved the mockup the same day; the earlier box that opened in place shifted the row). The panel holds a search box, with focus in it, and lists matches as the reader types: grouped as nations and communities, glossary terms and pages, each group a `<details>` element that starts open, five results to a group, then "See all N results" for the search page. The down and up arrows move between the box, the group headings and the results; Escape or the X closes the panel and returns focus to the icon; a click outside closes it; Enter in the box opens `/search?q=…`. On a phone the panel spans the screen just under the masthead. The / key opens the panel from anywhere on a page, as it does on Wikipedia and Wikiwand, unless the reader is typing in a field or an editor, holds a modifier key, or has a dialog open; the icon's tooltip says so and it carries `aria-keyshortcuts="/"` (Trevor approved this from the Wikiwand review on Nov. 22, 2026). A nation whose page may show its seal (see [docs/official-images.md](../docs/official-images.md)) has the seal, small, beside its name in the panel, so a reader can tell similar names apart; the index gives its address as `image`. Without scripts the icon is a link to `/search`, which has its own box. The search page is built ahead of time; in the browser it loads `/search/index.json`, built with the site from the nation records, the glossary and a short list of the site's own pages, and lists the matches as the reader types, grouped as nations and communities, glossary terms and pages, 25 to a group with "Show all" for the rest. Each group is a `<details>` element that starts open, so a reader can fold away a kind of result they do not want, with or without scripts (Trevor asked for this on Nov. 22, 2026). Matching follows the tables' rules (`src/lib/site-search.ts`): case and accents are ignored and every word typed must appear. A match on a nation's official name ranks first, then a match on another name it is known by (shown as "also called"), then a match on the line under the name, such as a state. The index and the search page are kept for offline reading with the core pages. Without scripts the search page says that search needs them and links to the nations by letter and state and the glossary from A to Z.

**Download.** An icon button with Lucide's `download` icon, labeled "Download," sits beside Print in the masthead on every page and opens a list of the kinds of download the page offers (Trevor asked for this on Nov. 22, 2026, in place of a link that fetched one JSON file; `src/lib/components/DownloadMenu.svelte`, `src/lib/page-downloads.ts`). Each choice has a Lucide icon, a plain name, its format in a small box (PDF, JSON, CSV, CSL JSON) and one line on what it is for. Every page offers "This page" as a PDF, which opens the Print dialog (see Print) so the reader picks what to include and then chooses Save as PDF in the browser's print window; then the page's own files; then, under a rule, "Read offline" (the `/offline` page) and "All downloads" (the Downloads page, with the book and the data exports). A nation's page offers its record as JSON and its sources as Citation Style Language JSON, which Zotero and other citation managers import (`/nations/<id>/sources.json`, the citation data of every source the record names); the index pages offer the full nations index as CSV; the glossary pages offer the terms as JSON. A page about one record (a nation, a glossary entry, a story) also offers "Copy a citation," which copies an Indigo Book citation to the page: its title (italic when pasted into a word processor), the site's name with the content version, the address and "last visited" with the day, since the page can change. A status message reads the citation out once it is copied, or gives it in full when the browser refuses to copy. The list follows the WAI-ARIA disclosure pattern, as the account list does, since its items are links and buttons: Up and Down move between them, Home and End jump to the ends, Escape closes the list and returns focus to the button, and a click elsewhere closes it. On a phone the button is in the More panel and the list opens across the screen under the masthead. Without scripts the button is a link to the Downloads page.

**Icons.** All icons but one (the GitHub mark, the last rule below) come from Lucide,[^lucide-license] chosen on Nov. 21, 2026, after a comparison of six packs ([research session](../research/sessions/2026/2026-11-21-icon-pack-comparison.md)). The site imports single icons from `@lucide/svelte`, so only the icons used are bundled.[^lucide-svelte] The book and the ebook use the same drawings from `lucide-static`, at the same version number, which `site/package.json` pins exactly. Rules:

- An icon sits beside words. The only icon-only controls are the search icon, the theme button, the Settings cog, the profile button (Trevor asked for the search icon, the cog and the profile icon on Nov. 22, 2026), the Star button, the X that closes the search panel and the Modal's close button (an X, asked for by Trevor the same day). They share the `icon-button` class: no box around them, since the icon shows it is a control (Trevor, Nov. 22, 2026), with a 44px target, a faint fill on hover and the usual focus ring. Each carries an `aria-label` that names it and a matching `title` tooltip, because Lucide hides icons from screen readers by default.[^lucide-a11y] The text alignment choice in Settings also shows only symbols, as Trevor asked on Nov. 22, 2026; each symbol is a radio button with a hidden name that screen readers read, and the picked choice's name and hint show in words just below it.
- Beside body text, icons are 20 px with `strokeWidth` 1.75, which matches the stem of Atkinson Hyperlegible Next Regular (about 1.5 px; project measurement). Standalone controls use 24 px and the default 2 px stroke.
- Never use icons that read as Native imagery, even where Lucide offers them:
  `feather`, `tent`, `tent-tree` and `bow-arrow`.
- In print, Typst draws `currentColor` as black, which suits the black-and-white
  interior.
- The one exception is the GitHub mark (`GithubMark.svelte`), GitHub's own logo from Primer Octicons (MIT License, `LICENSES/Octicons.txt`), because Lucide no longer ships brand icons. It appears only beside the word "GitHub" on a link that goes there (see Links stay on the site, below).

**Links stay on the site.** Three standing rules from Trevor, Nov. 22, 2026:

- *No link sends a reader to GitHub unless its words say so,* such as the footer's "GitHub" link with the GitHub mark, or "Every change to it on GitHub." What the project wrote for readers is a page on the site: the charter is `/charter`, and the licenses by material are `/licenses`, with each full license text under it. They are rendered at build time from the same files, `docs/charter.md`, `LICENSE.md` and `LICENSES/` (`src/lib/server/project-documents.ts`), so the files stay the one source. Inside them, a link to the other shown document goes to its page; a link to any other repository file becomes plain words; a link to github.com is followed by "(GitHub)"; and each page ends with links to its file and its history on GitHub, which say so. In code, link to the site page (`/charter`, `/licenses`), never to `repositoryLink` plus a file path, unless the link's words name GitHub. The co-authors' workspace may link to a record's file and history on GitHub, saying so.
- *No page names the project's internal documents:* no "(decision record 0007)," no file names such as `requests.md`, and no pointers to the roadmap, the outline, the data model or other specifications in `docs/`. Those explain the project to its maintainers; the site explains things to readers in its own words. Where the charter or `LICENSE.md` cross-references an internal document, the reference sits between `<!-- repository-only -->` and `<!-- /repository-only -->`: GitHub hides the markers and shows the text, and the site leaves it out.
- *On nation pages, links to other websites open in a new tab* (sources, laws, constitutions, a nation's own website), with `rel="noopener noreferrer"` and a hidden "Opens in a new tab" note that screen readers announce through `aria-describedby` (`src/lib/new-tab-links.ts`, WCAG technique G201). Links within the site open in the same tab.

`tools/check-built-site.mjs` enforces the first two: it fails when a link to github.com names GitHub neither in its words nor just before them, and when a page's text says "decision record" with a number or names a `.md` file.

**Password fields.** Every password field is `src/lib/components/PasswordInput.svelte`: the field with a "Show" button beside it, carrying Lucide's `eye` icon (`eye-off` and "Hide" while the password shows), as Trevor asked on Nov. 22, 2026. It follows the GOV.UK password input: the button names its action for screen readers ("Show password", "Hide password"), a polite announcement says "Your password is visible" or "hidden", and the field goes back to hidden when the form is sent so the browser does not store the password as ordinary text.[^govuk-password] Without scripts the button does not appear.

**Modal.** One shared modal dialog, `src/lib/components/Modal.svelte`, for every dialog on the site. It is the browser's own `<dialog>` opened as a modal: focus moves into it, stays in it, Escape closes it, and the page behind is inert.[^mdn-dialog] With sections it has two panels, as Trevor asked on Nov. 21, 2026: a list of sections on the left and the chosen section on the right. The list follows the WAI-ARIA tabs pattern, so arrow keys move between sections and Home and End jump to the first and last.[^apg-tabs] The chosen section is marked by a bar and bold type as well as a fill. On narrow screens the list wraps above the section. A dialog may have buttons along the bottom, as Print does; Settings has none, because the X at the top closes it (Trevor, Nov. 22, 2026).

**Settings.** A "Settings" button with Lucide's `settings` icon at the right end of the masthead opens the Modal with five sections (project choice, asked for by Trevor on Nov. 21, 2026): **Text** (size, font, spacing, alignment, line width), **Colors** (theme, contrast), **Citations**, **Glossary** and **Data** (saved pages, updates, reset and delete; "Saved for offline" was renamed Data on Nov. 22, 2026, at Trevor's request). The reading settings are:

- **Text size** (a slider, asked for by Trevor on Nov. 22, 2026): eleven steps, 50, 62.5, 75, 87.5, 100, 112.5, 125, 137.5, 150, 175 and 200 percent, so a reader can reach the 200 percent WCAG 1.4.4 names for resizing text[^wcag-144] and, as Trevor asked on Nov. 22, 2026, go down to half size. The current size shows beside the label and is read out as "125 percent"; there is no hint line under the slider (Trevor removed it on Nov. 22, 2026). On paper, 50 and 62.5 percent print at 75 percent, about 10 points, so printed text stays readable. Arrow keys move one step, Home and End jump to the ends. Small and large letter A's at the ends show which way is larger. Only text grows, as Trevor asked on Nov. 22, 2026: the setting changes `--text-scale`, which multiplies every font size token (`src/lib/design-tokens.ts`), while boxes, spaces and controls keep their rem sizes. Controls still grow where their text needs room, because their heights are minimums. The root font size stays at the browser's own setting, so a reader's browser text size still scales the whole page.
- **Font** (a dropdown): Atkinson Hyperlegible Next (the default), Noto Serif or OpenDyslexic (see [Type](#type)), with no description under them (Trevor removed the device's own font and the descriptions on Nov. 22, 2026; a stored "device" choice falls back to the default). Each choice in the list, and the picked choice in the closed dropdown, is shown in its own typeface, as Trevor asked on Nov. 22, 2026, so a reader sees a font before picking it.
- **Text spacing:** Standard or Wide. Wide uses the values WCAG 2.2, 1.4.12 tests: line height 2 (at least 1.5), paragraph spacing 2 times, letter spacing 0.12 times and word spacing 0.16 times the font size.[^wcag-1412]
- **Text alignment:** Left aligned (the default) or Justified, asked for by Trevor on Nov. 21, 2026, shown as Lucide's `text-align-start` and `text-align-justify` symbols in one bordered strip (see Icons above). The picked symbol is filled and has a bar under it, so color is not the only cue. Justified applies to reading text in the page's main area (paragraphs, list items, definitions and quotations), not to headings, tables, forms or the masthead, and turns on automatic hyphenation (`hyphens: auto`), which uses each element's `lang` attribute to pick the hyphenation rules.[^mdn-hyphens] Links are never hyphenated, so nation names, citations and addresses stay whole. Left stays the default because WCAG's enhanced visual presentation criterion asks that text not be justified, since uneven word spacing makes reading harder for some readers.[^wcag-148]
- **Line width:** Narrow (44ch, about 65 characters a line), Standard (51ch, about 75, the default) or Wide (58ch, about 85, the site's width before Nov. 22, 2026). Trevor approved this from the Wikiwand review on Nov. 22, 2026. Standard keeps lines inside the 80 characters that WCAG's enhanced visual presentation criterion asks for.[^wcag-148] It sets `--layout-measure` through the root's `data-line-width` attribute, so every column held to the reading measure follows it.
- **Theme:** Match this device, Light or Dark (see [section 8](#8-themes)).
- **Contrast:** Standard or More. More turns gray text to ink and light dividing lines to the control border color; no new colors are added.
- **When you select a note number** (Citations): show the source beside the number (the default; on a phone it opens at the bottom of the screen), go to the Sources list at the end of the page, or show the note under the paragraph. The number stays a link to the source's entry in the Sources list, so without scripts it goes there.
- **Links to sources** (Citations): the original page and the archived copy (the default), the original only, or the archived copy where there is one. An archived copy still opens when the original has moved or gone, which matters for tribal codes whose addresses change ([citation style](../docs/citation-style.md)).
- **Previews** (Glossary): on (the default) or off, for defined terms and links to nation pages. See [Glossary link and hover card](#6-components) and Link previews below.

**Data** holds four things. Saving for offline and updates are described in [section 10](#10-offline-and-installable). "Reset settings to defaults" puts the reading settings and theme back at once. "Export to a file" downloads `model-tribal-adr-code-data-YYYY-MM-DD.json` with the reading settings, theme, print choices, starred pages with their notes, and the list of parts kept for offline reading (not the saved pages themselves); "Import from a file" reads such a file, refuses anything else, and asks "Replace your settings, theme and print choices on this device with the ones in this file?" before applying it (asked for by Trevor on Nov. 22, 2026; `src/lib/reader-data.ts`). Starred pages in the file are added to the reader's own, and the reader's own notes are kept. If the file lists saved parts, the reader is told to save them on this device too. "Delete data on this device" lists what the site keeps (Settings, Print choices, Starred pages, Saved pages), all ticked; the reader can untick parts, and the button reads "Delete all data" or "Delete chosen data." Deleting asks once more in a box under the list, which takes focus: "Delete … from this device? This cannot be undone," with "Yes, delete" (danger color, with a trash icon and bold question so color is not the only cue) and "Cancel." Deleting saved pages removes every collection through the service worker, but keeps the site's own files, so the site still opens offline.

Each change applies at once and is kept in the browser's local storage on that device only, so it works offline and nothing is sent to the server. An inline script in `app.html` applies the stored settings before the page paints. Focus returns to the Settings button when the dialog closes. Text size and font are dropdowns (see [Dropdown](#6-components) below), asked for by Trevor on Nov. 22, 2026; the other choices are radio buttons in fieldsets, labels above hints. Without scripts the Settings and theme buttons are hidden, since they cannot work. The theme stays a one-press button in the masthead as well as a choice in the dialog, because the button is the faster way for the most common change and Trevor chose it on Nov. 21, 2026; the dialog adds "Match this device," which the button lacks.

**Dropdown.** One shared dropdown, `src/lib/components/Dropdown.svelte`, for picking one choice from a short list where a choice should be shown as it will look, such as the font setting. It follows the WAI-ARIA select-only combobox pattern rather than the browser's own `<select>`, because a `<select>` list cannot show each choice in its own typeface on every browser and device.[^apg-combobox] The label sits above the box and the picked choice's hint below it. Down, Up, Enter, Space or a letter opens the list; Up and Down move; Home and End jump to the first and last; Enter, Space or Tab picks; Escape closes the list without closing a dialog around it. The choice the keys are on is drawn like a focused control (yellow fill and ring), and the picked choice has a check mark and bold type, not color alone. Plain form fields elsewhere, such as the workspace filters, keep the browser's `<select>`.

**Star.** A reader can star a page and keep a private note on it, with no account (Trevor asked for this on Nov. 21, 2026, and approved the plan and the build on Nov. 22; [decision record 0032](../docs/decisions/0032-starred-pages-and-shared-collections-on-the-reader-s-device.md)). An icon button with Lucide's `star` icon, labeled "Star this page", sits before Print in the masthead on a page with a lasting address (`src/lib/starred-items.ts`). Those are nations, glossary entries, stories and, once published, sections of the code, essays, forms and sources. It is a toggle button (`aria-pressed`), so its name stays the same; a starred page shows a filled star, its tooltip says "Starred," and a status message says what changed. "Starred pages," under the sections in the sidebar, opens `/starred`, which lists the starred pages newest first. Each shows its kind and the day it was starred, a "Your note" box (plain text, up to 2,000 characters, saved as the reader types) and "Remove star," which can be undone. Stars and notes are kept in the browser's local storage (`starred-items`) on that device only, so nothing is sent to the site; Settings, Data exports them with the other reader data and can delete them. Step 2, keeping stars in step across devices through the reader's sign-in, waits until the model code has final section numbers.

"Share a collection," on the same page, makes a link to chosen starred pages, up to 100, with a title (up to 120 characters) and an optional description (up to 500), as Trevor decided on Nov. 21, 2026. The link carries the whole list after `#c=` in `/starred/shared`; the part of a link after `#` is not sent to the server, so the site stores nothing and never sees what was shared.[^url-fragment] The link names no one and never holds notes. The shared page shows the title and description as plain text, under the label "A reader's collection, shared by link," so it is not mistaken for the site's own text (site copy never calls itself "the project"). It names each page from the site's own search index, so a link cannot put other words on the site. "Star all of these" adds the pages to the reader's own stars. A link that cannot be read says so and points to the nations and the glossary.

**Print.** An icon button with Lucide's `printer` icon, labeled "Print this page", in the masthead beside Download (Trevor, Nov. 22, 2026), opens the Modal titled "Print this page" (asked for by Trevor on Nov. 21, 2026, after the delivery dialog of Westlaw, where a reader chooses what prints before printing). Westlaw splits its dialog into "Layout and Limits" (for example term highlighting, footnotes at the end or inline, and a cover page) and "Content to Append" (extra lists to add);[^westlaw-delivery] this dialog follows that split with two sections:

- **What to print:** a checkbox for each part the current page has, found when the dialog opens from the page's `data-print-part` markers: Page details, Review status, Seal or logo, Maps, Tables, Document history and Sources. All are on by default. The main text always prints; menus, buttons, request links and the footer never do. "Page details" is a line that exists only on paper, under the site's name and content version, giving the page's address and the date printed, so a paper copy leads back to the current version (Westlaw's cover page plays the same role).
- **Layout:** where citations go (note numbers with the Sources list, each note under its paragraph, or no note numbers), whether each outside link prints its web address, and whether defined terms keep their dotted underline. Each choice is offered only when the page has notes, outside links or defined terms.

"Print" at the bottom closes the dialog and opens the browser's print window, where the reader can also save a PDF and set paper size, margins and scale. Text size, font and spacing follow the reading settings. Choices are kept on the device in local storage (`print-options`, non-default values only) and become `data-print-*` attributes on the root element, set before paint by the same inline script as the reading settings; `global.css` reacts to them only inside `@media print`, so the screen never changes and the browser's own Print command follows the same choices. Notes under their paragraphs are copied in on the window's `beforeprint` event and removed on `afterprint`.[^mdn-beforeprint] Without scripts the button is hidden and pages print with every part.

Each section added at the end of a page, now Document history and Sources, starts on a new sheet of paper (`break-before: page`; Trevor, Nov. 22, 2026). A section the reader leaves out is not drawn, so it leaves no blank page, and the main text never starts with a break. New sections of that kind join the rule in `global.css`.

When the model code's provision pages are built, their parts join the list in `src/lib/print-options.ts` the same way: commentary, drafting notes, alternatives and version history are the expected ones. Leaving a part out of a print is a reader's choice; a page's notices (such as "This is a fictitious example") are never optional.

**Notices.** One style for status: "This is a working draft" on the home page; "Model text, not law in force" with the version and last change on every section, following legislation.gov.uk's status box; "You are offline; showing content as of [date]" when offline. A notice is a `role="note"` block, not an alert.

**Section heading.** Track label, then the section number at display size in
the track color, then the title as the page's `h1`.

**Alternatives.** A tab list: one tab per alternative plus "Compare side by
side." Arrow keys move between tabs (WAI-ARIA tabs pattern). With scripts
off, all alternatives are shown in order, each under its own heading.

**Placeholder.** `{{nation.name}}` renders as "[Name of Nation]" with the
placeholder fill and rule. The variable's identifier is available to assistive
technology through a visually hidden label such as "placeholder: name of the
nation."

**Glossary link and hover card.** A dotted underline marks a defined term. The card opens on hover after a short delay and on keyboard focus, stays open while the pointer is over it, and closes with Escape, as WCAG 1.4.13 requires for content on hover or focus.[^wcag-1413] The link itself goes to the full entry, so the card is never the only way to the content. The card shows the term, its expansion and a one-line summary, holds no links of its own (`role="tooltip"`, tied to the link with `aria-describedby`), and appears for a mouse pointer or keyboard focus, not a touch, since a tap follows the link. Summaries come from `/glossary/terms.json`, which the glossary pages are built with, fetched once when first needed. The Previews setting turns cards off.

**Link previews.** Links to a nation's page inside a page's text get the same kind of card, the way Wikipedia and Wikiwand preview articles (Trevor approved this from the Wikiwand review on Nov. 22, 2026). It shows the nation's name, its seal where its page shows one, its recognition status, its states and its page's review status, all copied from the cited facts on that page, from `/nations/previews.json`, built with the site and saved for offline reading. Links in menus, the sidebar, tables, dialogs and search results get no preview, because they sit in long lists, and neither does a link to the page the reader is on. `LinkPreviews.svelte` handles both kinds; the Previews setting (stored as `glossaryCards`) turns both off. Previews of model code sections and essays will use it too once those pages exist.

**Glossary pages.** The glossary page and each entry's page are built from one module, `src/lib/server/glossary-entries.ts`, and one component, `GlossaryEntry.svelte`. An entry follows the layout of a printed dictionary entry, as Merriam-Webster's explanatory notes describe it (Trevor asked on Nov. 22, 2026):[^merriam-webster-notes] the headword in bold; an italic label for the part of speech (`part_of_speech`), or "abbreviation of" the expansion for an acronym, with ", legal term" for a legal term; the usage label as a small badge with an icon (Preferred, Acceptable, Only in context, Avoid); "other forms" with the variants in bold; then the senses, each opened by a bold colon, numbered 1, 2, 3 only when there are two or more (`other_senses`), with an italic label for a sense that needs one, such as "often capitalized". The usage note follows under "As used here" (it replaced "How the project uses it"), then "Use instead" and "See also" with the other entries' names in capitals, as a dictionary sets cross-references. When the model code enacts a definition of the term (`code_definition`), a box with a section sign names that section and says that its definition is the one with legal effect. An entry's own page ends with the entries near it in alphabetical order. An entry's citation is a numbered marker in its text (see Citations below) for a source in the page's Sources section, where each source is listed once, in the project's Indigo Book style (formatted at build time by citeproc-js with `pdf/styles/project-law-review.csl`, as the print edition is), with links back to its markers and followed by every entry that cites it, as on nation pages. `/glossary/terms.json` lists every entry's term, usage and a one or two sentence summary with no citations, for the hover cards and for saving offline.

**Citations.** Every page cites the way Wikipedia does (Trevor asked on Nov. 22, 2026, because a marker that jumps to the end of the page loses the reader's place). A claim, a fact or a sentence ends with a small number in square brackets, such as [3], one for each source; the number is the source's place in the page's Sources section, numbered in the order the page first cites it. Prose (commentary, glossary entries, stories and essays) gets its markers from `[@key]` citations in Markdown (`src/lib/server/markdown.ts`); data pages, such as a nation's facts, get them from the facts' sources (`src/lib/server/source-uses.ts`, `CitationMarks.svelte`). Both write the same HTML (`src/lib/citation-marks.ts`).

- **Beside the marker.** On wide screens, pointing at a marker or moving to it with the keyboard shows the citation in a small window under it, as Wikipedia's Reference Previews do;[^reference-previews] the window stays while the pointer is over it, so its links can be used. Selecting the marker (click or Enter) keeps the window open; from the keyboard, focus moves into it, Tab moves through its links and out of it back to the marker, and Escape closes it and returns focus to the marker. On phones and other screens without hover, selecting a marker opens the citation in a drawer from the bottom of the screen, following Wikipedia's design for its mobile site;[^mobile-references] it is a modal dialog with a Close button, and Escape or a tap on the page behind closes it. Either shows the source's number, the citation (each outside link opens in a new tab and says so to screen readers), the place in the source the marker cites, and a link to the entry in the Sources list. Nothing jumps (`CitationPopup.svelte`).
- **In the Sources list.** Each entry's number links back to the place in the text that cites the source. A source cited in several places also gets a letter for each, a, b, c (after z come aa, ab), each linking back to one marker, as Wikipedia's backlinks do (Trevor, Nov. 22, 2026). The marker or entry a link goes to is highlighted. On paper the letters are left out and the number stays.
- **Without scripts,** with the Citations setting "Go to the Sources list," and on paper, a marker is a link to its entry in the Sources list, and the entry's number links back. The Citations setting can instead open the note under the paragraph.

Each note links to the original page and, where the source record has one, its archived copy with the capture date, for example "archived copy, Nov. 21, 2026"; the Citations setting can hide either link. The margin layout planned for wide screens (the note beside the line) is not built; the window beside the marker does its work.

**Panels.** Outlined (`line`) or filled (`surface`). One panel per purpose;
the design does not chop pages into rows of identical cards (project choice).

**Summary list.** A `<dl>` of label and value pairs for nation facts and for
"Check your request," following the GOV.UK summary list.

**Contact card.** A nation's government contacts are shown as cards in `src/lib/components/ContactCard.svelte`, approved by Trevor on Nov. 22, 2026, from a mockup (project files, `design/contact-card/`). The websites come first, in a card of their own, because a website is not part of an office's address (Trevor, Nov. 22, 2026); a website listed for an agency rather than the nation names that agency under it. Then each office is one card, named once in its header in title case ("Tribal Government Office"), so the office is not repeated on every line. Inside, each contact is a row with a Lucide icon and a label (Physical address, Mailing address, Phone, Fax, Email) beside its value; in a narrow card the value moves under its label. An address shows its street and its town on two lines, and a street address is itself the link to a Google Maps search, with no separate "Open in Google Maps" link (Trevor, Nov. 22, 2026); a post office box is not linked, since a map cannot find it. A mailing address is always written out, even when it repeats the physical address, so each row can be read or copied on its own (Trevor, Nov. 22, 2026). A website shows without `https://www.`, and an old directory address that now leads to the nation's site is shown as a note on that site rather than as a second website. Links that leave the site (websites and map searches) open in a new tab, with an external-link icon and hidden words for screen readers ("opens in a new tab," or "opens in Google Maps in a new tab"). The rules that read the office from each contact's label are in `src/lib/contact-card.ts`: a label such as "Arctic Village council office: …" or "Office of Hawaiian Affairs (state agency)" makes its own card; labels that only name the list a contact came from are dropped, because the Sources section already lists it. Each row ends with the marker of its source (see Citations below); a marker standing outside a sentence gets a 24 pixel target, as WCAG 2.2, 2.5.8 asks.

**Contact page row.** When a nation's own website has a "Contact us" page, the office card links it in a "Contact page" row (Lucide `contact` icon), after the email. A reader can then reach the nation the way it asks to be reached, even where it publishes a form or a staff list rather than one general address (Trevor asked for every nation's email, or at least its contact page, on Nov. 22, 2026). The page is recorded as a `contact-page` fact, cited like any other contact.

**Tables.** For data a reader compares across rows. Wide tables scroll inside their own box, so the page never scrolls sideways. Data tables use the `DataTable` component, the project's own, not a data grid library (`spikes/tables/REPORT.md`; Trevor chose this on 2026-11-20). The page is built with every row in order, as a plain table that reads the same without scripts. Once scripts run, sortable column headers become buttons, following the WAI-ARIA Authoring Practices sortable table example (the sorted header carries `aria-sort`), and a table can get a search box with a live count, though public lists now leave finding to the site search. Trevor chose filterable, downloadable tables on Nov. 23, 2026, so a page can also turn on three tools. Filters give each column marked filterable a menu of its values, with how many rows each leaves; a cell may list several values, such as a nation's states. "Download CSV" saves the rows as shown, after search, filters and sort, with each link's address in a column of its own. A shareable table writes the search, sort and filters into the page address as the reader changes them and adds "Copy link"; each parameter starts with the table's identifier, such as `nations-c-native-nation.states=Alaska`. The nations index pages use all three; the map's tables offer the download. Sorting and search follow one set of rules in `src/lib/tables/table-definition.ts`: case and accents are ignored, numbers inside text sort as numbers, and empty cells stay last. A long list is split into short pages rather than drawn as one long table or a virtual-scrolling one: the table spike measured that a virtual-scrolling grid left most rows out of the page, so find-in-page, printing and reading without scripts could not reach them (`spikes/tables/REPORT.md`, "SVAR Svelte DataGrid: rejected").

**Find recourse.** `/nations/recourse` lists the dispute resolution provisions read from Native nations' own law codes, court rules and ordinances (`research/tribal-law/provisions.csv`), the first of the data views Trevor chose on Nov. 23, 2026. It lists only provisions about dispute resolution, each once, and never one the second reader marked to drop (`src/lib/server/recourse.ts`). Each result shows the nation, its states and the citation, linked to the site's own copy of the law or, when there is none, the original address. Under them come a one or two sentence summary and tags for the method, the kind of dispute, where it happens, how it starts and the result. A result no second reader has checked carries a "Read once" tag, and a notice above the list says so and that no nation has reviewed it. Filters sit in a column on the left: method, kind of dispute, where it happens, how it starts, result, state or territory, recognition and checking. Each is a fieldset of checkboxes with how many rows each choice would leave given the other filters. Choices widen the list within a filter and narrow it across filters (`src/lib/recourse.ts`). Long filters show eight choices and "Show all". Picked choices show as chips above the results, each removable. The choices go into the page address (`?method=Mediation&subject=Family`), and "Copy link" and "Download CSV" sit beside the count. On a phone the filters fold behind a "Filters" button. The page is built with the first 25 rows; the browser loads every row from `/nations/recourse/provisions.json` and shows 25 more at a time. Without scripts the first 25 rows show, with links to the whole list as CSV and JSON, which the Download menu offers too. The recognition filter never offers "No federal recognition" (Trevor, Nov. 23, 2026). The site search thread's shared filter panel will replace this page's own filter code once it is merged.

**Bar charts.** Trevor chose bar charts on Nov. 23, 2026. `BarChart.svelte` draws horizontal bars, so long names read on one line, as plain HTML built ahead of time: it reads without scripts and prints. Each bar is a list item holding its name and number, which is what a screen reader reads; the drawn bar is decoration, in the link color, with gridlines on round numbers (`src/lib/bar-chart.ts`). A bar with an address is a link, and the bar turns the action color when its link is hovered or focused. A chart may draw only its first bars and offer "Show all". Under every chart, "Show as a table" opens the same numbers in a sortable table with a CSV download. A source line closes the figure. The Data and charts page, `/nations/data`, holds the first six: provisions by method, by kind of dispute and by state (each bar opens Find recourse with that filter), courts and forums by kind, constitutions found, and full gaming compacts by whether a dispute with the state goes to binding arbitration. The essay editor's planned Chart block is meant to use the same data shape.

**Scrollbars.** Trevor asked on Nov. 22, 2026, for scrollbars that match the design. Every scrollbar has a teal thumb on a track the color of the side rails (tokens `scrollbar-thumb` and `scrollbar-track`), set once on the root with the standard `scrollbar-color` property, which every box that scrolls inherits.[^mdn-scrollbar-color] The thumb has at least 3:1 contrast with its track and with the page in both themes, the non-text minimum that MDN points to for this property;[^wcag-1411] with "More contrast" on, it becomes ink. Forced colors mode resets the property so the system's own scrollbars return. The width is left to the browser, because `scrollbar-width: thin` makes the thumb harder to grab. `scrollbar-color` works in Chrome and Edge 121, Firefox 64 and Safari 26.2 on macOS and iOS, and has been Baseline since December 2025.[^web-features-scrollbar-color] There is no `::-webkit-scrollbar` fallback for older Safari: giving those pseudo-elements a size turns the Mac's overlay scrollbars into ones that always show,[^chrome-scrollbar-styling] and older Safari already draws light or dark scrollbars from each theme's `color-scheme`.

**Recognition.** Wherever a nation's recognition status is shown, its legal basis follows it in parentheses, and each citation in it links to the official text (Trevor asked on Nov. 22, 2026): Code of Federal Regulations parts and sections to the eCFR, United States Code sections to the Legal Information Institute, and the Statutes at Large (from 1951), Public Laws (from 1995) and the Federal Register to GovInfo's link service (`src/lib/legal-citations.ts`). Those are the address forms the project's source records already use. A legal basis with no such citation, such as a state executive order, links to the source the fact came from. Lists show a short form, such as "(25 C.F.R. Part 83)"; the nation's page shows the whole legal basis. This is a link on the authority itself, not a citation marker; the fact's own source keeps its marker and its entry in the Sources section.

**Forms.** Labels above fields; hints under labels; "(optional)" in the label;
large choice buttons for single choices; errors stated in words beside the
field and in a summary at the top.

**Buttons.** Primary (filled `action`) for the one main action on a page;
quiet (outlined `control-border`) for the rest. Labels say what happens, and
an action keeps its name through a flow: "Make a request" leads to "Send
request" and "Request sent" (project choice).

**Art reserved.** A dashed box in `art-reserved` with a line saying what will
go there. When art arrives, the box becomes a figure with a credit line naming
the artist and nation, as the artist chooses.

**Footer.** Request a correction or removal; requests log; charter; changelog; downloads; licenses by material; GitHub (with the GitHub mark, in place of "Source files", as Trevor asked on Nov. 22, 2026); the three version numbers. Trevor asked on Nov. 22, 2026 that it carry no notes beyond the version line: the "model text, not law in force" note and the colophon about colors, fonts and icons were removed. The font and icon licenses stay listed under Licenses by material (LICENSE.md).

## 7. Design tokens

Tokens live in [design-tokens.json](design-tokens.json) in the Design Tokens
Community Group format.[^dtcg] The build turns each into a CSS custom
property, for example `--color-paper`, so a theme changes in one file. Token
names are spelled out, like every identifier in the project
([style guide, section 7](../docs/style-guide.md#7-files-encoding-and-code)).

### Color

The palette is deep teal and burnt orange on warm paper. Trevor chose the two
hues on Nov. 20, 2026, after finding the first pass (white, near-black and
blue) stale and somewhat sad. It is still a placeholder: the commissioned
Native art may change it (see [Color and Native design](#color-and-native-design)
below and [section 13](#13-open-questions-and-next-steps), item 5).

Every text color passes WCAG's 4.5:1 minimum for text[^wcag-143] on the
backgrounds it is used on, and control borders pass the 3:1 minimum for
non-text contrast.[^wcag-1411] Ratios were computed with the WCAG relative
luminance formula (project calculation).

| Token | Light | Ratio | Dark | Ratio |
| --- | --- | --- | --- | --- |
| paper | `#FFFAF5` | | `#0F1E21` | |
| surface | `#F6EEE6` | | `#16292D` | |
| band (masthead) | `#0F4C54` | white text 9.6:1 | `#0A3237` | |
| ink | `#22201E` | 15.7:1 | `#F3EFEA` | 14.9:1 |
| ink-muted | `#5A524C` | 7.4:1 | `#B9C4C4` | 9.6:1 |
| link, peacemaking track | `#1A6D76` | 5.8:1 | `#6CCAD3` | 9.0:1 |
| action, ADR track | `#B4461A` | 5.3:1; white text on it 5.5:1 | `#FF9A66` | 8.2:1 |
| control-border | `#7A6F66` | 4.7:1 | `#7F9599` | 5.4:1 |
| danger | `#9C1C10` | 7.8:1 | `#FF8A80` | |
| placeholder-background | `#FFF0B3` | ink 14.4:1 | `#4A3B00` | ink 9.3:1 |
| focus | `#FFD34D` with a 3 px ink ring | | `#FFD34D` | |
| scrollbar-thumb | `#3F7F86` | 4.0:1 on its track | `#5A979E` | 4.6:1 on its track |
| scrollbar-track | `#F6EEE6` (surface) | | `#16292D` (surface) | |

Ratios are against each theme's paper unless stated.

Visited links keep the link color: Trevor asked on Nov. 22, 2026, that links not turn purple once used, so there is no separate visited-link token.

Rules (project choice):

- Color marks meaning and structure: the masthead band, links, the two
  tracks, the main action, placeholders, focus, errors and the map classes.
  Reading text stays dark ink on warm paper.
- Color is never the only cue. Links are underlined; tracks are named;
  compared text is struck through or underlined as well as highlighted;
  map tiles print their counts.
- The track colors are close in lightness, so they rely on hue and on their
  labels. Orange and teal remain distinct for the common red-green color
  vision differences, which is why the pair suits the tracks (project
  analysis), but the words "ADR track" and "Peacemaking track" always appear.

### Color and Native design

The lead author asked the project to look into "Native American color
theory." The research session
[2026-11-21-color-research](../research/sessions/2026/2026-11-21-color-research.md)
found that there is no single one, and that some color sets are sacred:

- "There is no single American Indian culture or language."[^nk360] Color
  meanings belong to each nation. In the Arizona Department of Education's
  *Tribal Seals and Flags*, the same color means different things for
  different nations, and its entry for the White Mountain Apache Tribe
  describes "the four Sacred colors, black, blue, yellow and white."[^arizona-seals] The Navajo
  Nation describes its flag's colors as those of "the four sacred mountains
  that define balance and order in Diné life," inspired by "the sacred
  practice of sandpainting."[^navajo-flag]
- The International Indigenous Design Charter, written "for both
  non-Indigenous and Indigenous designers," asks for design that is
  Indigenous led and community specific, and warns that "secret and sacred
  material is often restricted under customary law and therefore unsuitable
  for publication."[^design-charter]
- Sadie Red Wing (Lakota, Spirit Lake Nation): "If you do not know what you
  are communicating by using Native American symbols, don't use them," and
  "You cannot represent the tribes of California with New Mexican
  anything."[^red-wing]
- Native-led organizations use saturated, contemporary color. The live
  stylesheets of the Native Governance Center and the National Congress of
  American Indians, for example, pair deep teals with warm reds, clay or
  marigold (observed in each site's CSS, not in a published brand
  guide).[^org-palettes] The artist Jeffrey Gibson, who represented the
  United States at the 2024 Venice Biennale, has said, "We've been dismissed
  as garish and too much because of our use of color."[^gibson]

What the project does (project analysis):

- Treats color as design, not as "Native meaning." The palette carries no tribal symbolism. (The footer said so until Trevor asked on Nov. 22, 2026 for its notes to be removed.)
- Never uses a nation's directional, ceremonial or flag colors, or a medicine-wheel set, as decoration.
- Keeps teal and orange as plain fields. No feathers, patterns or borders that turn the palette into a "Southwest" costume standing in for 575 nations. No Native-authored source found names that palette as a cliché; avoiding it follows from the guidance against pan-Indian imagery above.
- Brings the commissioned Native artist in as a co-designer of the palette, not a reviewer at the end, as IllumiNative's industry guide advises against consultants brought in "to only rubber stamp or fix an issue at the end of the creative process."[^illuminative]
- Keeps the nation profile template neutral, so one aesthetic is not wrapped around every nation. A nation's own seal or flag appears only with its permission and is never recolored.

### Type

One family, Atkinson Hyperlegible Next, from the Braille Institute, which
offers it in seven weights with italics and says it covers more than 150
languages.[^atkinson] Its letterforms are built to be told apart, which suits
an accessibility-first reference (project analysis). The site
uses 400, 600 and 700 only.

- **Scale:** 1.25 from a 16 px body (12 points, the browser default): 14, 16, 20, 25, 31.2 and 39.2 px. Trevor asked on Nov. 22, 2026 for a smaller standard size than the earlier 18 px, which read large on a laptop; readers can still change it with the text size setting.
- **Line height:** 1.6 for reading, 1.25 for headings.
- **Measure:** at most 58ch, inside the 45 to 90 character range Practical
  Typography recommends.[^butterick] A `ch` is the width of the digit zero,
  which in Atkinson Hyperlegible Next is about 1.5 times an average letter, so
  58ch holds about 86 characters of English text (measured in Chromium at
  18 px, Nov. 21, 2026). The earlier 68ch held about 101, past the range.
- **Case:** sentence case for every heading and label
  ([style guide, section 6](../docs/style-guide.md#6-mechanics)); no text in
  all capitals.
- **Fallbacks:** Noto Sans, Noto Sans Cherokee, Noto Sans Osage and Noto Sans
  Canadian Aboriginal, loaded with `unicode-range` only when a page contains
  characters Atkinson Hyperlegible Next lacks. Names are written exactly as
  each nation writes them, including the ʻokina in Hawaiʻi
  ([style guide, section 3](../docs/style-guide.md#3-writing-about-native-nations-and-people)).
  Text in a Native language carries a `lang` attribute where the language is
  known.
- **Reader's choice:** in Settings a reader can switch to Noto Serif or OpenDyslexic. Noto Serif was picked over Literata and Source Serif 4 because it covers ʻ, ō, ʷ and ʔ and matches the Noto fallbacks. OpenDyslexic was asked for by Trevor; a study found it did not improve reading rate or accuracy for students with dyslexia,[^wery] so the site makes no claim about it. Both are under the SIL Open Font License; OpenDyslexic reserves its name, and the site serves its files whole and unchanged, which the license FAQ says keeps the name usable.[^ofl-faq] Details are in the research session [2026-11-21-reading-settings-fonts](../research/sessions/2026/2026-11-21-reading-settings-fonts.md). Each choice points the `--font-family-reading` custom property at another font token, so the map labels follow too.
- **Hosting:** the font files are served by the site itself, not by a
  third-party font service, so offline reading works and no reader's address
  goes to another company (project choice). Its license is the SIL Open Font
  License, kept beside the files.

### Space, radius and layout

An eight-step space scale from 4 px to 72 px; 6 px corners on controls and
10 px on panels; a 44 px minimum target. All values are in
[design-tokens.json](design-tokens.json).

The page uses the whole width of the screen, with a gutter that grows from
16 px on a phone to 48 px on a wide screen. Until Nov. 21, 2026 it was held
to 1,240 px and centered, which left wide empty margins on large screens;
Trevor asked for them to go. The trade-off (project choice): running text
stays at the reading measure, because long lines are harder to read and to
track back to the start of the next line,[^butterick] while tables, maps,
panels of contents, the masthead and the footer use the full width. Where a
page has more than text, such as a nation's page, a second column beside the
text uses the space; the `side-column` token (40 rem) caps it.

## 8. Themes

- **Choices:** Light and Dark, switched by one button in the masthead that
  shows a sun in the light theme and a moon in the dark theme (Trevor, Nov. 21,
  2026). Until the reader presses it, the device's `prefers-color-scheme`
  setting decides.[^mdn-color-scheme] Once pressed, the choice stays on that
  device. "Match this device" in Settings, or clearing the site's data,
  returns to the device's setting.
- **How:** the root element carries `data-theme="light"` or `"dark"` when the
  reader picks one; otherwise the `prefers-color-scheme` media query decides.
  A small inline script sets the attribute before the page paints, so there is
  no flash of the wrong theme. The choice is stored on the device only.
- **Print:** a print stylesheet uses the light theme, drops the navigation and
  margin tools, and prints each note's full citation and each link's address.
  Readers choose which parts print in the Print dialog (section 6, "Print").

## 9. Accessibility

The floor is WCAG 2.2 level AA (project choice). The GOV.UK Design System,
whose patterns the request flow borrows, states that it is "fully compliant"
with WCAG 2.2 AA.[^govuk-a11y] Criteria the design leans on:

| Criterion | What the design does |
| --- | --- |
| 1.4.3 Contrast (minimum)[^wcag-143] | Token pairs above |
| 1.4.11 Non-text contrast[^wcag-1411] | Control borders and focus rings at 3:1 or more |
| 1.4.10 Reflow[^wcag-1410] | Every page works at 320 CSS px without sideways scrolling; rails and margin stack under the text; wide tables scroll in their own box |
| 1.4.13 Content on hover or focus[^wcag-1413] | Glossary cards and link previews can be dismissed, hovered and persist |
| 2.4.11 Focus not obscured (minimum)[^wcag-2411] | Nothing is fixed over the content on wide screens; the sidebar sits beside the text and never over it. On narrow screens the Menu bar stays at the top, and `scroll-padding-top` is raised by its height so a focused control or linked heading is never under it |
| 2.5.8 Target size (minimum)[^wcag-258] | 44 px controls, above the 24 px minimum |
| 3.3.7 Redundant entry and 3.3.8 Accessible authentication | The request flow never asks twice; future sign-in uses an emailed link or a passkey, with no puzzle |

Also: a "Skip to main content" link; one `h1` per page and headings in order;
landmarks (`header`, `nav` with labels, `main`, `aside`, `footer`); a visible
yellow focus with an ink ring; motion only in answer to an action, and none
when `prefers-reduced-motion` is set;[^mdn-reduced-motion] every page readable
and every form usable without scripts.

**Testing.** Automated checks with axe-core run on every built page in
continuous integration, in both themes. Automated tools find only part of the
problems, so each template is also checked by hand with a keyboard, with
screen readers (NVDA with Firefox, VoiceOver with Safari), at 200 percent and
400 percent zoom, and in Windows high contrast mode (project choice). An
accessibility statement is published at `/about/accessibility`.

## 10. Offline and installable

- **Install:** a web app manifest and a service worker make the site
  installable.
- **Caching:** the app shell and Atkinson Hyperlegible Next are cached first; Noto fallbacks and the fonts picked in Settings are cached the first time they are used, and picking a font downloads all its weights at once so it also works on pages read later offline. A new build keeps saved font files whose names (which carry a hash of the content) have not changed. Sections, profiles, the glossary and sources use stale-while-revalidate, following web.dev's and MDN's caching guidance.[^webdev-caching][^mdn-caching] Cache names carry the build version, so each build replaces the old copy once the reader updates (see Updates below). Saved files that did not change are carried into the new copy rather than downloaded again.
- **What is saved:** every page a reader opens is saved as they read it. In Settings, under Data (also on `/offline`), the site lists each collection, how many of its pages are saved, the space they take, and about how much saving the rest would take (asked for by Trevor on Nov. 22, 2026), with a button to save the rest and one to remove them. The collections are Nation profiles, Glossary and Other pages; the model code joins them when its pages are built. A collection the reader saves is "kept": it is saved again from each new version. The section shows the space the whole site uses, from the Storage API's estimate, and offers "Keep saved pages when space runs low," which asks the browser for persistent storage, since otherwise the browser may clear the site's data under storage pressure.[^mdn-storage] Saving runs six files at a time inside the service worker, with a progress bar. The sizes come from `/offline-sizes.json`, which `tools/write-offline-sizes.mjs` writes after each build by adding up the built pages and data files of each collection; offline, or without the file, the sizes are left out.
- **Never cached:** any record with `sensitivity.restricted: true`, which is
  never published, exported, cached offline or served by any API
  ([data model, sensitivity flags](../docs/data-model.md#sensitivity-flags)).
  When a record is withdrawn, the next service worker update deletes it from
  every saved copy.
- **Offline notice:** "You are offline. Showing content as of [version, date]."

### Updates

How a reader who keeps the site on a device gets a new edition (project
design, asked for by Trevor on Nov. 21, 2026). Each build has its own build
version, the website version plus the build time, and the service worker
names its cache after it. The three track versions come from release-please
(`content/version.txt`, `site/version.txt`, `pdf/version.txt`), so a build can
change the website without changing the content.

1. **Detect.** The browser checks the service worker script on every navigation, and a new build always changes it, because the script contains the build version.[^webdev-lifecycle] SvelteKit also checks the build version when the tab regains focus, on data responses and on a timer; when it sees a new build, the page asks the browser to check the worker at once.[^sveltekit-updated] The worker never saves SvelteKit's version file (`/_app/version.json`), so that check always reaches the server; a saved copy would hide a new build from an open tab until the next check. "Check for updates" in Settings does both on demand.
2. **Install in the background.** The new worker saves the new build's scripts, styles and core pages into its own cache and then waits. It downloads only what changed, as Trevor asked on Nov. 22, 2026. Every page carries its build version, so every page differs from the last build's copy even when nothing on it changed: in a test, two builds of the same files differed in all 1,108 pages, and only there. So each build publishes `/offline-fingerprints.json`, a fingerprint of every file a reader may save, taken with the build version blanked out (`tools/write-offline-sizes.mjs`, `src/lib/offline-fingerprints.ts`). The new worker takes the same fingerprint of each saved file in the old cache. When the two match, it writes the new version into the old copy and saves that instead of downloading it; the result is exactly the file the server holds. Script, style and font files carry a hash of their content in their names, so one with the same name is copied as it is. Saved pages that changed are listed and downloaded on the next page load. This covers every saved page, not only kept collections, so a page the reader opened still opens offline after an update. In a test of a one-line change to one nation's page, a reader keeping Nation profiles made 8 requests (about 1 MB) instead of 3,155 (121 MB). It does not take over on its own: taking over mid-visit would mix two versions in one page.[^webdev-lifecycle] While it waits, the old worker keeps saving pages it reads only if they come from its own build (each built page names its build), so saved copies never point at scripts they lack.
3. **Withdrawals first.** As soon as the new worker installs, every saved
   page that is not in the new build is deleted from the saved copies, without
   waiting for the reader. A nation's request to withdraw material therefore
   reaches every device on its next visit online
   ([charter, commitment 6](../docs/charter.md#6-the-right-to-correct-restrict-or-withdraw)).
4. **Ask.** A small card fixed at the bottom left of the window (not a block in the page, as Trevor asked on Nov. 22, 2026) says what the update brings, read from `/edition.json` on the network: "It brings content version 0.3.0; you are reading 0.2.0," or that only the website changed. Below that it lists the pull requests merged since the build the reader is running ("#91 Rework Settings controls…"), up to eight and then "and N more," as Trevor asked on Nov. 22, 2026: each build reads its recent merges from git (`vite.config.ts`, `src/lib/recent-changes.ts`) and serves them in `/edition.json`. A build from a shallow clone may list fewer. When both builds' fingerprints can be read, it also says whether the update changes, keeps or removes the page being read. That comparison leaves out the names of the page's script files, so a change to the scripts alone does not count. It offers "Update now," "What changed" (the changelog) and "Later." It is a notice, not an alert, so it does not take focus.
5. **Apply.** "Update now" tells the waiting worker to take over (`skipWaiting`), and the page reloads once it has.[^mdn-skip-waiting] "Later" hides the notice for the visit; the browser applies the update by itself once every tab of the site has closed.[^webdev-lifecycle] The card appears only once the new worker has finished installing, so nothing is left to download when the reader presses the button. Taking over is kept to the bare minimum, because the browser holds back the reload until the new worker has taken over. Trevor asked on Nov. 22, 2026 for the button to apply at once. In a test with Nation profiles saved, tidying the old cache while taking over held the reload for about 20 seconds; with the tidying moved after it, the new page loaded in about 1.3 seconds. Once it has taken over, the new worker carries forward, as in step 2, any page the reader opened while it waited, then deletes the old cache, keeping font files that have not changed and the list of kept collections. Requests from the page to the worker (saving, the Data tab) wait for that tidying; loading a page does not, except offline, when a page not yet carried forward is looked for again once it ends.
6. **Save again.** On the next page load, the page asks the new worker to save the saved pages that changed and whatever the kept collections still lack from the new build, and a status line shows the progress. If the connection drops, it continues on a later visit.
7. **What the reader sees offline.** The offline notice names the content
   version of the copy being read, and Settings shows the content and website
   versions and the build date, so a stale copy is always labeled.

**Downloaded books.** A PDF or EPUB on the reader's device cannot be updated by the site. Each edition will print its edition number and the address `/downloads?edition=<number>`; that page compares the number with the current print version and says whether a newer edition is out, with a link to what changed. The print templates do not print the address yet.

## 11. Performance and hosting

- **Stack:** SvelteKit and TypeScript with `@sveltejs/adapter-cloudflare`, deployed to Cloudflare Workers with static assets, as Cloudflare's SvelteKit guide describes.[^cloudflare-sveltekit] Content pages are prerendered at build time; only the request form, and later sign-in and review, run on the server.
- **Budgets (project choice):** under 100 KB of JavaScript compressed on a
  section page; no map library in the browser (the map is a static SVG, per
  the map spike); fonts subset to the characters used.
- **Map:** drawn at build time with d3-geo, with a table holding the same data (map tool spike, project files `spikes/map/REPORT.md`). The site has one map, at `/nations/map`, with buttons above it that switch between views; Trevor asked on 2026-11-22 for one map with views rather than separate maps, so that more views can be added over time. The buttons are a tab list, the chosen view's address carries `?view=`, and a link to a row in a hidden view's table (such as a region linked from a nation's page) opens that view. Without scripts every view is shown, one after another, and print shows them all.
  - **Nations by state** shades states by how many nations have a recorded presence there, and draws no nation's land ([decision record 0007](../docs/decisions/0007-map-shows-state-presence.md)).
  - **Bureau of Indian Affairs regions** draws the twelve regions from the Bureau's own boundary file (`geography/`), with a note that they are the Bureau's administrative areas, not nations' lands. Trevor chose on 2026-11-21 to draw the official outlines even though the Navajo Region's follows the Navajo Nation's land.
  - **Land areas** draws the Census Bureau's 2020 American Indian and Alaska Native areas in three shades: federal reservations and trust lands, state reservations, and the Census Bureau's statistical areas ([decision record 0029](../docs/decisions/0028-map-adds-census-land-areas.md)). Areas too small to see get a dot. Each area links to a table row naming the nations whose entries cite that Census area. The view is heavy, so the page fetches its drawing and table from `/nations/map/land-areas.json` the first time a reader opens it.
  - **Layout.** The contiguous United States (the 48 contiguous states and DC) fills a framed, labeled box at the top. Alaska, Hawaiʻi, Guam and the Northern Mariana Islands, American Samoa, and Puerto Rico and the U.S. Virgin Islands sit in a row of smaller framed, labeled boxes below. Each box has its own equal-area projection, fitted to the box, and its own scale bar. Together they show that every box is at a different scale and none is in its true place (Trevor, 2026-11-22). Every shape is drawn only by its own box's projection. The earlier composite projection from d3-composite-projections placed the islands in the open water beside the contiguous states with no frames, which read as their real positions.
  - **Code.** `src/lib/map-geometry.ts` projects the shapes once, in `vite.config.ts`, so the browser gets SVG paths and no map library. `src/lib/nations-map-drawing.ts` turns them into each view's SVG markup. The page shows that markup with `{@html}` from a universal load. The outlines are sent once, in the page, and not again in the data the page hydrates from. A reader who arrives from another page without reloading gets the same markup from `/nations/map/drawings.json`. To add a view, add its drawing to `drawNationsMaps` and its entry and key to the page's list of views. The grayscale print version for the book is not built yet.
  - **Layout.** Trevor chose on 2026-11-22, from mockups in the project files (`design/map-layout/`), a smaller map pinned on the left with the view's table scrolling beside it, relying on zooming for detail. On wide screens the map is sized to fit the window's height and stays in place while the table scrolls. On narrower screens it is pinned to the top of the window and the table scrolls under it, when the window is tall enough. Print shows the map and then the table, as before. Map titles (the page heading and the view names) are in title case (Trevor, same day).
  - **Tables.** Each table has one row per state, region or area, with its name and its count. The name opens the list of its nations, with the arrow before the name, and a row with no nations has nothing to open (Trevor, 2026-11-22). Selecting a place on the map goes to its row and opens it.
  - **Zooming and moving.** Trevor asked on 2026-11-22 for the map to zoom and move. Every view, and the small map on each nation's page, can be zoomed up to eight times (the "Land areas" view sixteen). Buttons above the map zoom in, zoom out and show the whole map again (Lucide icons). The keys + and - and 0 do the same whenever focus is in the map. Ctrl or ⌘ with the scroll wheel zooms around the pointer, as do a trackpad pinch and a two-finger pinch on a touch screen. Once zoomed in, the mouse, one finger or the arrow keys move the map, and tabbing to a place off screen brings it into view. A plain scroll still scrolls the page and shows a short hint, so the map never traps a reader scrolling past it. Zooming changes only the drawing's `viewBox` (`src/lib/map-zoom.ts`, `src/lib/components/ZoomableMap.svelte`), so it adds no map tiles or library, fetches nothing, tracks no one, and works offline. Text, dots and line widths are multiplied by `--map-unzoom` so they keep their size on screen while the shapes grow. Printing always prints the whole map, and without scripts the map is drawn as before with no buttons.
  - **Nation pages.** Each nation's page also draws a small map of its states from the same shapes and boxes (see [Nation pages](#nation-pages)). Its outlines keep 5 percent of their points, rounded to whole map units, so the map stays light on each of the 980 pages.

## 12. Words in the interface

The interface follows the style guide's voice: plain verbs, sentence case, "they" for people, no praise or alarm. In addition (project choice):

- Name things by what readers know: "Make a request," not "Submit a ticket."
- Errors say what went wrong and how to fix it, in the interface's voice.
- Empty states say what will appear and how to add it, for example "No
  requests yet."
- The project never writes in a nation's voice. Profile pages say what a
  source records ("The nation's code provides"), and the review panel says
  plainly when the nation has not yet reviewed the page.

## 13. Open questions and next steps

1. **Research with real readers.** Short interviews or usability sessions with
   a few people in each role, especially Tribal court staff and peacemakers,
   before the templates are built. Nothing here has been tested with them.
2. **Advisor review** of the request flow and the nation profile wording.
3. **Icon set:** settled: Lucide ([section 6, Icons](#6-components)).
4. **Art:** sizes for the cover, part openers and the home page space, to
   give to the art contest.
5. **Color, second pass.** Trevor's review on Nov. 20, 2026 found the first
   palette stale and somewhat sad; he chose teal and burnt orange, now in the
   tokens. Judge it again once the site is built, and set the final palette
   with the commissioned Native artist ([Color and Native design](#color-and-native-design)).
6. **Template builder:** how placeholders and alternatives become a nation's
   draft ordinance.

## References

[^illuminative]: IllumiNative, *Industry Guide* (June 2022), [illuminative.org](https://illuminative.org/wp-content/uploads/2022/06/IllumiNative_industry-guide_June-2022.pdf), as summarized in the earlier design notes (project files `design/website-exploration/reference-sites-and-ideas.md`).
[^nk360]: Smithsonian National Museum of the American Indian, *Native Knowledge 360°: Essential Understandings*, [americanindian.si.edu/nk360/about/understandings](https://americanindian.si.edu/nk360/about/understandings) (accessed Nov. 21, 2026).
[^arizona-seals]: Arizona Department of Education, Office of Indian Education, *Tribal Seals and Flags* (Fall 2022), [naair.arizona.edu](https://naair.arizona.edu/sites/default/files/2024-08/Tribal%20Seals%20and%20Flags.pdf) (accessed Nov. 21, 2026).
[^navajo-flag]: Navajo Nation Office of the President and Vice President, *A Flag That Remembers* (Jan. 7, 2026), [opvp.navajo-nsn.gov](https://opvp.navajo-nsn.gov/260107-a-flag-that-remembers) (accessed Nov. 21, 2026).
[^design-charter]: Russell Kennedy, Meghan Kelly, Jefa Greenaway and Brian Martin, *International Indigenous Design Charter* (2018), [ico-D](https://www.theicod.org/resources/international-indigenous-design-charter) (accessed Nov. 21, 2026).
[^red-wing]: Sadie Red Wing, *Decolonizing Native American Design*, Communication Arts, [commarts.com](https://www.commarts.com/columns/decolonizing-native-american-design) (accessed Nov. 21, 2026).
[^org-palettes]: Native Governance Center stylesheet, [nativegov.org](https://nativegov.org/wp-content/themes/ngc/dist/css/spm.min.css); National Congress of American Indians, [ncai.org](https://www.ncai.org/) (both read Nov. 21, 2026). Colors were taken from live CSS, not from published brand guides.
[^gibson]: Colossal, article on Jeffrey Gibson's U.S. Pavilion at the 2024 Venice Biennale (Apr. 2024), [thisiscolossal.com](https://www.thisiscolossal.com/2024/04/jeffrey-gibson-us-pavilion/) (accessed Nov. 21, 2026).
[^uswds-banner]: U.S. Web Design System, *Banner*, [designsystem.digital.gov/components/banner](https://designsystem.digital.gov/components/banner/) (accessed Nov. 21, 2026).
[^govuk-password]: Government Digital Service, *Password input*, GOV.UK Design System, [design-system.service.gov.uk/components/password-input](https://design-system.service.gov.uk/components/password-input/) (accessed Nov. 22, 2026).

[^govuk-one-thing]: Government Digital Service, *Structuring forms: start with one thing per page*, [gov.uk/service-manual/design/form-structure](https://www.gov.uk/service-manual/design/form-structure#start-with-one-thing-per-page) (accessed Nov. 21, 2026).
[^govuk-a11y]: GOV.UK Design System, *Accessibility statement*, [design-system.service.gov.uk/accessibility-statement](https://design-system.service.gov.uk/accessibility-statement/) (accessed Nov. 21, 2026).
[^wcag-143]: W3C, *Understanding Success Criterion 1.4.3: Contrast (Minimum)*, [w3.org/WAI/WCAG22/Understanding/contrast-minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).
[^wcag-1411]: W3C, *Understanding Success Criterion 1.4.11: Non-text Contrast*, [w3.org/WAI/WCAG22/Understanding/non-text-contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).
[^wcag-1410]: W3C, *Understanding Success Criterion 1.4.10: Reflow*, [w3.org/WAI/WCAG22/Understanding/reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html).
[^wcag-1413]: W3C, *Understanding Success Criterion 1.4.13: Content on Hover or Focus*, [w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus](https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus.html).
[^merriam-webster-notes]: Merriam-Webster, *Explanatory Notes*: [entries](https://www.merriam-webster.com/help/explanatory-notes/dict-entries), [definitions](https://www.merriam-webster.com/help/explanatory-notes/dict-definitions), [functional labels](https://www.merriam-webster.com/help/explanatory-notes/dict-functional-labels) and [usage](https://www.merriam-webster.com/help/explanatory-notes/dict-usage) (accessed Nov. 22, 2026). The site follows the layout only; it copies no text, logo or branding.
[^wcag-2411]: W3C, *Understanding Success Criterion 2.4.11: Focus Not Obscured (Minimum)*, [w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html).
[^wcag-258]: W3C, *Understanding Success Criterion 2.5.8: Target Size (Minimum)*, [w3.org/WAI/WCAG22/Understanding/target-size-minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).
[^dtcg]: Design Tokens Community Group, *Design Tokens Format Module* (draft), [designtokens.org/tr/drafts/format](https://www.designtokens.org/tr/drafts/format/).
[^atkinson]: Braille Institute, *Atkinson Hyperlegible Font*, [brailleinstitute.org/freefont](https://www.brailleinstitute.org/freefont/) (accessed Nov. 21, 2026).
[^butterick]: Matthew Butterick, *Practical Typography: Line length*, [practicaltypography.com/line-length.html](https://practicaltypography.com/line-length.html) (accessed Nov. 21, 2026).
[^mdn-scrollbar-color]: MDN Web Docs, *scrollbar-color*, [developer.mozilla.org](https://developer.mozilla.org/en-US/docs/Web/CSS/scrollbar-color).
[^web-features-scrollbar-color]: W3C WebDX Community Group, *Web features explorer: scrollbar-color*, [web-platform-dx.github.io](https://web-platform-dx.github.io/web-features-explorer/features/scrollbar-color/); Apple, *Safari 26.2 Release Notes*, [developer.apple.com](https://developer.apple.com/documentation/safari-release-notes/safari-26_2-release-notes).
[^chrome-scrollbar-styling]: Chrome for Developers, *Scrollbar styling*, [developer.chrome.com](https://developer.chrome.com/docs/css-ui/scrollbar-styling).
[^mdn-color-scheme]: MDN Web Docs, *prefers-color-scheme*, [developer.mozilla.org](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme).
[^mdn-reduced-motion]: MDN Web Docs, *prefers-reduced-motion*, [developer.mozilla.org](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion).
[^webdev-caching]: web.dev, *Learn PWA: Caching*, [web.dev/learn/pwa/caching](https://web.dev/learn/pwa/caching).
[^mdn-caching]: MDN Web Docs, *Caching (Progressive web apps)*, [developer.mozilla.org](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Caching).
[^cloudflare-sveltekit]: Cloudflare, *SvelteKit (Workers framework guide)*, [developers.cloudflare.com/workers/framework-guides/web-apps/sveltekit](https://developers.cloudflare.com/workers/framework-guides/web-apps/sveltekit/).
[^wcag-1412]: W3C, *Understanding Success Criterion 1.4.12: Text Spacing*, [w3.org/WAI/WCAG22/Understanding/text-spacing](https://www.w3.org/WAI/WCAG22/Understanding/text-spacing).
[^wcag-144]: W3C, *Understanding Success Criterion 1.4.4: Resize Text*, [w3.org/WAI/WCAG22/Understanding/resize-text](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html).
[^mdn-hyphens]: MDN Web Docs, *hyphens*, [developer.mozilla.org](https://developer.mozilla.org/en-US/docs/Web/CSS/hyphens).
[^wcag-148]: W3C, *Understanding Success Criterion 1.4.8: Visual Presentation*, [w3.org/WAI/WCAG22/Understanding/visual-presentation](https://www.w3.org/WAI/WCAG22/Understanding/visual-presentation).
[^apg-tabs]: W3C WAI, *ARIA Authoring Practices Guide: Tabs Pattern*, [w3.org/WAI/ARIA/apg/patterns/tabs](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/).
[^apg-combobox]: W3C WAI, *ARIA Authoring Practices Guide: Select-Only Combobox Example*, [w3.org/WAI/ARIA/apg/patterns/combobox/examples/combobox-select-only](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/examples/combobox-select-only/).
[^webdev-lifecycle]: Jake Archibald, *The service worker lifecycle*, web.dev, [web.dev/articles/service-worker-lifecycle](https://web.dev/articles/service-worker-lifecycle) (accessed Nov. 21, 2026). Sections "Updating the service worker," "Waiting" and "Skip the waiting phase."
[^sveltekit-updated]: SvelteKit, *$app/state: updated*, [svelte.dev/docs/kit/$app-state#updated](https://svelte.dev/docs/kit/$app-state#updated); the same text is in `@sveltejs/kit` 3.4.0's type definitions.
[^mdn-skip-waiting]: MDN Web Docs, *ServiceWorkerGlobalScope: skipWaiting() method*, [developer.mozilla.org](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerGlobalScope/skipWaiting).
[^mdn-storage]: MDN Web Docs, *Storage quotas and eviction criteria*, [developer.mozilla.org](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria), and *StorageManager: persist() method*, [developer.mozilla.org](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist).
[^url-fragment]: T. Berners-Lee, R. Fielding & L. Masinter, *Uniform Resource Identifier (URI): Generic Syntax*, RFC 3986, § 3.5 (2005), [rfc-editor.org](https://www.rfc-editor.org/rfc/rfc3986#section-3.5) (the fragment "is separated from the rest of the URI prior to a dereference").
[^mdn-dialog]: MDN Web Docs, *&lt;dialog&gt;: The Dialog element*, [developer.mozilla.org](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/dialog).
[^westlaw-delivery]: Thomson Reuters, *Westlaw Australia Guide: Document Delivery*, [support.thomsonreuters.com.au/node/10181](https://support.thomsonreuters.com.au/node/10181) (tabs "Layout and Limits," "Content to Append" and "The Basics"); Thomson Reuters, *Email, print, download, and share documents* (Westlaw Edge Canada), [thomsonreuters.com](https://www.thomsonreuters.com/en-ca/help/westlaw-edge/tools/other-tools/email-print-download-and-share-documents.html) (accessed Nov. 21, 2026). Trevor's screenshots of the U.S. Westlaw screens may refine this.
[^mdn-beforeprint]: MDN Web Docs, *Window: beforeprint event*, [developer.mozilla.org](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeprint_event).
[^wery]: J. J. Wery and J. A. Diliberto, *The effect of a specialized dyslexia font, OpenDyslexic, on reading rate and accuracy*, 67 Annals of Dyslexia 114 (2017), [doi.org/10.1007/s11881-016-0127-1](https://doi.org/10.1007/s11881-016-0127-1).
[^ofl-faq]: SIL International, *OFL-FAQ*, entries 2.2 and 2.6, [openfontlicense.org/ofl-faq](https://openfontlicense.org/ofl-faq/) (accessed Nov. 21, 2026).
[^lucide-license]: Lucide, *License*, [lucide.dev/license](https://lucide.dev/license) (accessed Nov. 21, 2026). ISC License, with the MIT License for icons drawn from Feather; full text in [`LICENSES/Lucide.txt`](../LICENSES/Lucide.txt).
[^lucide-svelte]: Lucide, *Lucide for Svelte*, [lucide.dev/guide/svelte](https://lucide.dev/guide/svelte) (accessed Nov. 21, 2026).
[^lucide-a11y]: Lucide, *Accessibility* (Svelte), [lucide.dev/guide/svelte/advanced/accessibility](https://lucide.dev/guide/svelte/advanced/accessibility) (accessed Nov. 21, 2026).
[^reference-previews]: MediaWiki, *Help:Reference Previews*, [mediawiki.org/wiki/Help:Reference_Previews](https://www.mediawiki.org/wiki/Help:Reference_Previews) (accessed Nov. 22, 2026) ("shows a preview of a footnote when you hover over its footnote marker").
[^mobile-references]: MediaWiki, *Mobile design/Reference reveal*, [mediawiki.org/wiki/Mobile_design/Reference_reveal](https://www.mediawiki.org/wiki/Mobile_design/Reference_reveal) (accessed Nov. 22, 2026). A historical design page for Wikipedia's mobile site, whose goal was "to surface a reference when the footnote number is clicked in an article, in a small window that overlays the bottom of the" screen, because the old references "take you away from the page you are reading."
