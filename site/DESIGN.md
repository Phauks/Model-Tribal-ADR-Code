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

The code, Peacemaking, Nations, Glossary, Sources, About, and a Contribute button. One search box for the whole site sits beside the site's name, with the theme button, the Settings button and, at the far right, a "Sign in" link that becomes a profile button once someone has signed in (Trevor asked for both on Nov. 22, 2026). Downloads and the changelog are linked from the footer, and Print and Download sit on each page they act on (see [Masthead](#6-components) and Page tools below). Nobody needs to sign in to read the site or to make a request. The footer of every page carries "Request a correction or removal," the requests log, the licenses and the three version numbers ([requests.md](../docs/requests.md#where-the-request-starts)).

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
| Downloads: the book as PDF and EPUB, and data exports | `/downloads` (empty until the first edition) |
| Settings | `/settings` |
| Sign-in and the co-author workspace ([COLLABORATION.md](COLLABORATION.md)) | `/sign-in`, `/workspace` |
| Later: template builder, data | `/templates`, `/data` |

## 5. Page templates

| Template | Layout | Key parts |
| --- | --- | --- |
| Home | One column, then a four-part contents band | Purpose in one sentence; search; reserved art space; contents by part, with the two tracks side by side; "For Native nations" panel; recent changes |
| Section | Contents rail, text, margin | "Model text, not law in force" notice with the version and last change; hanging section number; status chips; text with alternatives and placeholders; Comment, Illustrations, Source note; previous and next; margin: On this page, notes, "Cite this section," "Adapt this section" |
| Track landing | One column | What the track is, cited; its chapters; for peacemaking, a step-by-step outline of how a process unfolds |
| Nation profile | Text and margin | One page for every nation; see [Nation pages](#nation-pages) below |
| Nations directory | One column | Links to one page per first letter and one per state, each a short table (name, recognition with its legal basis linked, states, review status); the small groups (the Native Hawaiian community, the Indigenous peoples of the territories) listed in full in their own tables; a link to the map; "Is your nation missing? Ask to be added", also shown when a search finds no nation. Finding one nation by name is the site search's job, so the tables have no search box of their own |
| Search | One column | The search box, a live count, and results grouped as nations and communities, glossary terms and pages; "Is your nation missing?" when nothing matches |
| Glossary entry | Entry rail, text, margin | Term, usage status, "Report a problem" under the term, definition, how the project uses it, use instead, related terms, about this entry, other entries that use it, and a Sources section at the end |
| Glossary | One column | "Report a problem" under the title; an A to Z index; every entry in full (term, usage, definition, how the project uses it, use instead, related terms), each with its own anchor such as `/glossary#native-nations`; one Sources section at the end |
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

**Order of sections.** Every page uses the same order, so readers and the
nation's staff always know where to look, as the Tribal Law Gateway does with
its fixed sections on each nation's page:

1. Name as the recognizing list gives it, and the nation's own name for
   itself, exactly as the nation writes it, once the nation confirms it. Beside it, the nation's seal or
   logo when its reuse status allows showing it, credited to the nation's
   website, with a link to ask for its removal
   ([official-images.md](../docs/official-images.md)).
2. Review panel: the review status (drafted from public sources, sent to the
   nation, reviewed by the nation, approved by the nation), what that means,
   and "Is this about your nation? Make a request."
3. What is distinctive here (below).
4. At a glance: a small map of the states with a presence, then recognition,
   states with a presence, government contacts, federal region.
5. Courts and dispute resolution: each forum with its kind, source and date.
6. Published dispute resolution law: linked, not reproduced, until the nation
   permits more ([data model, permission statuses](../docs/data-model.md#permission-statuses)).
7. Document history: each of the nation's documents that has recorded
   versions, such as a gaming compact or a constitution, with every version
   oldest first, its dates, what it did to earlier versions (amended,
   replaced), whether it is in effect, and how its key clauses changed
   ([decision record 0018](../docs/decisions/0018-document-version-history.md)).
   A line under each title names the versions in effect. Each version's
   source is listed under the document's title in Sources.
8. Notices and Labels from Local Contexts.
9. Sources, each followed by the facts on the page that come from it, and
   the date the page was last checked.

**What is distinctive here** has two parts:

- **In the nation's own words.** A short description the nation writes or
  approves. Until then the space says so and offers a link to contribute;
  the project never writes it for the nation.
- **Recorded features.** Short sentences generated from the record's cited
  facts, each listed under its sources in the Sources section, for example: a peacemaking program beside the
  Tribal court (`justice_institutions`, `dispute_resolution.forums`); a
  published peacemaking or mediation law (`dispute_resolution_law`); a court
  of appeals; presence in more than one state (`states`); a heritage language
  as the nation writes it (`languages`); jurisdiction facts such as Public Law
  280 (`jurisdiction`). A feature appears only when a source documents it,
  never inferred from silence, and features describe the one nation without
  comparing it with others
  ([style guide, section 1](../docs/style-guide.md#1-voice-and-tone)).

**Layout.** On screens at least 64 rem wide (1,024 px at the default text
size) the page has two columns: the text, held to the reading measure, and
beside it "At a glance" with its map, like a reference work's fact box. On
narrower screens the parts stack in the order above, so the map sits under
the "At a glance" heading (project choice, Nov. 21, 2026).

**Map of states.** "At a glance" opens with a small map that shades the
states and territories where the record's cited `states` facts place the
nation, with each shaded state's postal code printed on it, so color is not
the only cue. It draws no nation's land
([decision record 0007](../docs/decisions/0007-map-shows-state-presence.md)),
and its caption says so. It does not outline the nation's Bureau of Indian
Affairs region: the Navajo Region's outline follows the Navajo Nation's land,
so on that nation's page it would draw the nation's land; the region is named
under "At a glance" and links to the regions map instead (project choice). A
page whose record lists no state has no map.

**Reporting a problem.** One "Report a problem" link sits at the top of each
nation page, under the names, and opens the request form with the record
filled in, for example `/requests?kind=correct&record=tribes/<id>`. Trevor
asked on 2026-11-21 for one link per page instead of one beside every fact,
which repeated the same link down the page.

**Sources.** The sources of a nation page's facts are listed together in a
"Sources" section at the end of the page, not beside each fact (Trevor,
2026-11-21). Each source appears once, numbered, followed by every fact on
the page that comes from it, grouped by the heading the fact appears under,
with the place in the source and the date the value was true. Every fact
stays traceable to its source; the reader finds it by source rather than by
a mark beside the fact.

**Contacts.** An address links to a Google Maps search for it; a phone number
is a `tel:` link that opens the device's dialer; an email address is a
`mailto:` link. Fax numbers stay as text. A value that cannot be read
reliably, such as a phone number that is not ten digits, stays as text
(Trevor, 2026-11-21).

**Missing information.** Empty fields are left out rather than shown as
"unknown," so a page never suggests a nation lacks something it may simply
not have published. A single line at the end offers: "Know of a published
source we have missed? Add it."

**Restricted and withdrawn records.** A record marked restricted gets no page
at all. A withdrawn record's page says only that the material was withdrawn
at the nation's request ([charter, commitment 6](../docs/charter.md#6-the-right-to-correct-restrict-or-withdraw)).

**In print.** The book's profiles follow the same order, so the website and
Part III read alike. The page template uses relative units and no fixed page
size, because the book's trim size is not yet decided (project choice).

## 6. Components

**Masthead.** Two rows on the band, as Trevor asked on Nov. 22, 2026. The first holds the wordmark and edition, the site search box, then the theme button, the Settings button and, at the far right, the sign-in control. The second holds the main menu, with Contribute at its right end. On screens narrower than 60 rem the search box moves to its own line under the name and controls; narrower than 40 rem, the name, the controls and the search box each take a line. Print and Download are not in the masthead, because they act on one page (see Page tools). Pages are built ahead of time, so the sign-in control cannot ask the server who is signed in; after someone signs in, the Worker sets a cookie that says only "signed in," and "Sign in" then becomes a round profile button. It opens a short list (WAI-ARIA disclosure pattern, not a menu, since the items are plain links and a form): Your profile, Workspace (a person without workspace access is sent to their profile) and Sign out. Escape or a click elsewhere closes it. Without scripts it stays "Sign in," which still works. Sign-in itself is described in [COLLABORATION.md](COLLABORATION.md#how-sign-in-works). Menu items are at least 44 px tall. The current section is marked with `aria-current="page"` and a 3 px underline.

**Search.** One search box in the masthead searches the whole site, so lists do not need search boxes of their own (Trevor asked on Nov. 22, 2026). It is a plain form that opens `/search?q=…`. The search page is built ahead of time; in the browser it loads `/search/index.json`, built with the site from the nation records, the glossary and a short list of the site's own pages, and lists the matches as the reader types, grouped as nations and communities, glossary terms and pages, 25 to a group with "Show all" for the rest. Matching follows the tables' rules (`src/lib/site-search.ts`): case and accents are ignored and every word typed must appear. A match on a nation's official name ranks first, then a match on another name it is known by (shown as "also called"), then a match on the line under the name, such as a state. The index and the search page are kept for offline reading with the core pages. Without scripts the page says that search needs them and links to the nations by letter and state and the glossary from A to Z.

**Page tools.** Print and, where the page has a file to offer, Download sit together under a page's title (`PageTools.svelte`), as quiet buttons. Each download is a file built with the site: a nation's record as JSON, the full nations index as CSV, and the glossary's terms as JSON. The book and the data exports stay on the Downloads page.

**Icons.** All icons come from Lucide,[^lucide-license] chosen on Nov. 21,
2026, after a comparison of six packs ([research session](../research/sessions/2026/2026-11-21-icon-pack-comparison.md)).
The site imports single icons from `@lucide/svelte`, so only the icons used are
bundled.[^lucide-svelte] The book and the ebook use the same drawings from
`lucide-static`, at the same version number, which `site/package.json` pins
exactly. Rules:

- An icon sits beside words. The only icon-only controls are the theme button and the profile button (Trevor asked for a profile icon on Nov. 22, 2026), and each carries an `aria-label` that names it, because Lucide hides icons from screen readers by default.[^lucide-a11y] The text alignment choice in Settings also shows only symbols, as Trevor asked on Nov. 22, 2026; each symbol is a radio button with a hidden name that screen readers read, and the picked choice's name and hint show in words just below it.
- Beside 18 px body text, icons are 20 px with `strokeWidth` 1.75, which
  matches the stem of Atkinson Hyperlegible Next Regular (about 1.5 px; project
  measurement). Standalone controls use 24 px and the default 2 px stroke.
- Never use icons that read as Native imagery, even where Lucide offers them:
  `feather`, `tent`, `tent-tree` and `bow-arrow`.
- In print, Typst draws `currentColor` as black, which suits the black-and-white
  interior.

**Password fields.** Every password field is `src/lib/components/PasswordInput.svelte`: the field with a "Show" button beside it, carrying Lucide's `eye` icon (`eye-off` and "Hide" while the password shows), as Trevor asked on Nov. 22, 2026. It follows the GOV.UK password input: the button names its action for screen readers ("Show password", "Hide password"), a polite announcement says "Your password is visible" or "hidden", and the field goes back to hidden when the form is sent so the browser does not store the password as ordinary text.[^govuk-password] Without scripts the button does not appear.

**Modal.** One shared modal dialog, `src/lib/components/Modal.svelte`, for every dialog on the site. It is the browser's own `<dialog>` opened as a modal: focus moves into it, stays in it, Escape closes it, and the page behind is inert.[^mdn-dialog] With sections it has two panels, as Trevor asked on Nov. 21, 2026: a list of sections on the left and the chosen section on the right. The list follows the WAI-ARIA tabs pattern, so arrow keys move between sections and Home and End jump to the first and last.[^apg-tabs] The chosen section is marked by a bar and bold type as well as a fill. On narrow screens the list wraps above the section. A dialog may have buttons along the bottom, as Print does; Settings has none, because Close at the top closes it (Trevor, Nov. 22, 2026).

**Settings.** A "Settings" button with Lucide's `settings` icon at the right end of the masthead opens the Modal with five sections (project choice, asked for by Trevor on Nov. 21, 2026): **Text** (size, font, spacing, alignment), **Colors** (theme, contrast), **Citations**, **Glossary** and **Data** (saved pages, updates, reset and delete; "Saved for offline" was renamed Data on Nov. 22, 2026, at Trevor's request). The reading settings are:

- **Text size** (a dropdown): Standard, Large, Larger or Largest (100, 112.5, 125 or 150 percent). Only text grows, as Trevor asked on Nov. 22, 2026: the setting changes `--text-scale`, which multiplies every font size token (`src/lib/design-tokens.ts`), while boxes, spaces and controls keep their rem sizes. Controls still grow where their text needs room, because their heights are minimums. The root font size stays at the browser's own setting, so a reader's browser text size still scales the whole page.
- **Font** (a dropdown): Atkinson Hyperlegible Next (the default), Noto Serif, OpenDyslexic or the device's own font (see [Type](#type)). Each choice in the list, and the picked choice in the closed dropdown, is shown in its own typeface, as Trevor asked on Nov. 22, 2026, so a reader sees a font before picking it.
- **Text spacing:** Standard or Wide. Wide uses the values WCAG 2.2, 1.4.12 tests: line height 2 (at least 1.5), paragraph spacing 2 times, letter spacing 0.12 times and word spacing 0.16 times the font size.[^wcag-1412]
- **Text alignment:** Left aligned (the default) or Justified, asked for by Trevor on Nov. 21, 2026, shown as Lucide's `text-align-start` and `text-align-justify` symbols in one bordered strip (see Icons above). The picked symbol is filled and has a bar under it, so color is not the only cue. Justified applies to reading text in the page's main area (paragraphs, list items, definitions and quotations), not to headings, tables, forms or the masthead, and turns on automatic hyphenation (`hyphens: auto`), which uses each element's `lang` attribute to pick the hyphenation rules.[^mdn-hyphens] Links are never hyphenated, so nation names, citations and addresses stay whole. Left stays the default because WCAG's enhanced visual presentation criterion asks that text not be justified, since uneven word spacing makes reading harder for some readers.[^wcag-148]
- **Theme:** Match this device, Light or Dark (see [section 8](#8-themes)).
- **Contrast:** Standard or More. More turns gray text to ink and light dividing lines to the control border color; no new colors are added.
- **When you select a note number** (Citations): go to the notes at the end of the page (the default), or show the note under the paragraph. The number stays a link to the note, so without scripts it always jumps.
- **Links to sources** (Citations): the original page and the archived copy (the default), the original only, or the archived copy where there is one. An archived copy still opens when the original has moved or gone, which matters for tribal codes whose addresses change ([citation style](../docs/citation-style.md)).
- **Glossary cards** (Glossary): on (the default) or off. See [Glossary link and hover card](#6-components) below.

**Data** holds three things. Saving for offline and updates are described in [section 10](#10-offline-and-installable). "Reset settings to defaults" puts the reading settings and theme back at once. "Delete data on this device" lists what the site keeps (Settings, Print choices, Saved pages), all ticked; the reader can untick parts, and the button reads "Delete all data" or "Delete chosen data." Deleting asks once more in a box under the list, which takes focus: "Delete … from this device? This cannot be undone," with "Yes, delete" (danger color, with a trash icon and bold question so color is not the only cue) and "Cancel." Deleting saved pages removes every collection through the service worker, but keeps the site's own files, so the site still opens offline.

Each change applies at once and is kept in the browser's local storage on that device only, so it works offline and nothing is sent to the server. An inline script in `app.html` applies the stored settings before the page paints. Focus returns to the Settings button when the dialog closes. Text size and font are dropdowns (see [Dropdown](#6-components) below), asked for by Trevor on Nov. 22, 2026; the other choices are radio buttons in fieldsets, labels above hints. Without scripts the Settings and theme buttons are hidden, since they cannot work. The theme stays a one-press button in the masthead as well as a choice in the dialog, because the button is the faster way for the most common change and Trevor chose it on Nov. 21, 2026; the dialog adds "Match this device," which the button lacks.

**Dropdown.** One shared dropdown, `src/lib/components/Dropdown.svelte`, for picking one choice from a short list where a choice should be shown as it will look, such as the font setting. It follows the WAI-ARIA select-only combobox pattern rather than the browser's own `<select>`, because a `<select>` list cannot show each choice in its own typeface on every browser and device.[^apg-combobox] The label sits above the box and the picked choice's hint below it. Down, Up, Enter, Space or a letter opens the list; Up and Down move; Home and End jump to the first and last; Enter, Space or Tab picks; Escape closes the list without closing a dialog around it. The choice the keys are on is drawn like a focused control (yellow fill and ring), and the picked choice has a check mark and bold type, not color alone. Plain form fields elsewhere, such as the workspace filters, keep the browser's `<select>`.

**Print.** A "Print" button with Lucide's `printer` icon, among the page tools under a page's title (moved out of the masthead on Nov. 22, 2026, at Trevor's request), opens the Modal titled "Print this page" (asked for by Trevor on Nov. 21, 2026, after the delivery dialog of Westlaw, where a reader chooses what prints before printing). Westlaw splits its dialog into "Layout and Limits" (for example term highlighting, footnotes at the end or inline, and a cover page) and "Content to Append" (extra lists to add);[^westlaw-delivery] this dialog follows that split with two sections:

- **What to print:** a checkbox for each part the current page has, found when the dialog opens from the page's `data-print-part` markers: Page details, Review status, Seal or logo, Maps, Tables, Document history and Sources. All are on by default. The main text always prints; menus, buttons, request links and the footer never do. "Page details" is a line that exists only on paper, under the site's name and content version, giving the page's address and the date printed, so a paper copy leads back to the current version (Westlaw's cover page plays the same role).
- **Layout:** where citations go (note numbers with the Sources list, each note under its paragraph, or no note numbers), whether each outside link prints its web address, and whether defined terms keep their dotted underline. Each choice is offered only when the page has notes, outside links or defined terms.

"Print" at the bottom closes the dialog and opens the browser's print window, where the reader can also save a PDF and set paper size, margins and scale. Text size, font and spacing follow the reading settings. Choices are kept on the device in local storage (`print-options`, non-default values only) and become `data-print-*` attributes on the root element, set before paint by the same inline script as the reading settings; `global.css` reacts to them only inside `@media print`, so the screen never changes and the browser's own Print command follows the same choices. Notes under their paragraphs are copied in on the window's `beforeprint` event and removed on `afterprint`.[^mdn-beforeprint] Without scripts the button is hidden and pages print with every part.

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

**Glossary link and hover card.** A dotted underline marks a defined term.
The card opens on hover after a short delay and on keyboard focus, stays open
while the pointer is over it, and closes with Escape, as WCAG 1.4.13 requires
for content on hover or focus.[^wcag-1413] The link itself goes to the full
entry, so the card is never the only way to the content. The card shows the
term, its expansion and a one-line summary, holds no links of its own
(`role="tooltip"`, tied to the link with `aria-describedby`), and appears for a
mouse pointer or keyboard focus, not a touch, since a tap follows the link.
Summaries come from `/glossary/terms.json`, which the glossary pages are built
with, fetched once when first needed. The Glossary setting turns cards off.

**Glossary pages.** The glossary page and each entry's page are built from
one module, `src/lib/server/glossary-entries.ts`, and one component,
`GlossaryEntry.svelte`. An entry's citation is a numbered marker in its text
that leads to the page's Sources section, where each source is listed once,
in the project's Indigo Book style (formatted at build time by citeproc-js
with `pdf/styles/project-law-review.csl`, as the print edition is), followed
by every entry that cites it, as on nation pages. `/glossary/terms.json`
lists every entry's term, usage and a one or two sentence summary with no
citations, for the hover cards and for saving offline.

**Citations.** In prose, such as a section's commentary or a glossary entry,
a numbered marker in the text; on wide screens the note sits in the margin
beside the line, and on narrow screens it opens inline under the paragraph.
Until the margin layout is built, the marker links to the notes at the end,
and the Citations setting can open the note under the paragraph instead.
Each note links to the original page and, where the source record has one,
its archived copy with the capture date, for example "archived copy, Nov. 21,
2026"; the Citations setting can hide either link. Data pages, such as
a nation's facts, put no marker beside a fact; their sources are listed in a
Sources section at the end (see [Nation pages](#nation-pages)).

**Panels.** Outlined (`line`) or filled (`surface`). One panel per purpose;
the design does not chop pages into rows of identical cards (project choice).

**Summary list.** A `<dl>` of label and value pairs for nation facts and for
"Check your request," following the GOV.UK summary list.

**Tables.** For data a reader compares across rows. Wide tables scroll inside their own box, so the page never scrolls sideways. Data tables use the `DataTable` component, the project's own, not a data grid library (`spikes/tables/REPORT.md`; Trevor chose this on 2026-11-20). The page is built with every row in order, as a plain table that reads the same without scripts. Once scripts run, sortable column headers become buttons, following the WAI-ARIA Authoring Practices sortable table example (the sorted header carries `aria-sort`), and a table can get a search box with a live count, though public lists now leave finding to the site search. Sorting and search follow one set of rules in `src/lib/tables/table-definition.ts`: case and accents are ignored, numbers inside text sort as numbers, and empty cells stay last. A long list is split into short pages rather than drawn as one long table or a virtual-scrolling one: the table spike measured that a virtual-scrolling grid left most rows out of the page, so find-in-page, printing and reading without scripts could not reach them (`spikes/tables/REPORT.md`, "SVAR Svelte DataGrid: rejected").

**Recognition.** Wherever a nation's recognition status is shown, its legal basis follows it in parentheses, and each citation in it links to the official text (Trevor asked on Nov. 22, 2026): Code of Federal Regulations parts and sections to the eCFR, United States Code sections to the Legal Information Institute, and the Statutes at Large (from 1951), Public Laws (from 1995) and the Federal Register to GovInfo's link service (`src/lib/legal-citations.ts`). Those are the address forms the project's source records already use. A legal basis with no such citation, such as a state executive order, links to the source the fact came from. Lists show a short form, such as "(25 C.F.R. Part 83)"; the nation's page shows the whole legal basis. This is a link on the authority itself, not a citation marker, so the facts' sources stay in the Sources section.

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

**Footer.** Request a correction or removal; requests log; charter; changelog;
licenses by material; the three version numbers.

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

- Treats color as design, not as "Native meaning." The site's colophon says
  the palette carries no tribal symbolism, and later names the artist whose
  work informs it.
- Never uses a nation's directional, ceremonial or flag colors, or a
  medicine-wheel set, as decoration.
- Keeps teal and orange as plain fields. No feathers, patterns or borders
  that turn the palette into a "Southwest" costume standing in for 575
  nations. No Native-authored source found names that palette as a cliché;
  avoiding it follows from the guidance against pan-Indian imagery above.
- Brings the commissioned Native artist in as a co-designer of the palette,
  not a reviewer at the end, as IllumiNative's industry guide advises against
  consultants brought in "to only rubber stamp or fix an issue at the end of
  the creative process."[^illuminative]
- Keeps the nation profile template neutral, so one aesthetic is not wrapped
  around every nation. A nation's own seal or flag appears only with its
  permission and is never recolored.

### Type

One family, Atkinson Hyperlegible Next, from the Braille Institute, which
offers it in seven weights with italics and says it covers more than 150
languages.[^atkinson] Its letterforms are built to be told apart, which suits
an accessibility-first reference (project analysis). The site
uses 400, 600 and 700 only.

- **Scale:** 1.25 from an 18 px body: 16, 18, 22.4, 28, 35 and 44 px.
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
- **Reader's choice:** in Settings a reader can switch to Noto Serif,
  OpenDyslexic or the device's own interface font. Noto Serif was picked over
  Literata and Source Serif 4 because it covers ʻ, ō, ʷ and ʔ and matches the
  Noto fallbacks. OpenDyslexic was asked for by Trevor; a study found it did
  not improve reading rate or accuracy for students with dyslexia,[^wery] so
  the site only says it is "designed for readers with dyslexia." Both are
  under the SIL Open Font License; OpenDyslexic reserves its name, and the
  site serves its files whole and unchanged, which the license FAQ says keeps
  the name usable.[^ofl-faq] Details are in the research session
  [2026-11-21-reading-settings-fonts](../research/sessions/2026/2026-11-21-reading-settings-fonts.md).
  Each choice points the `--font-family-reading` custom property at another
  font token, so the map labels follow too.
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
| 1.4.13 Content on hover or focus[^wcag-1413] | Glossary cards can be dismissed, hovered and persist |
| 2.4.11 Focus not obscured (minimum)[^wcag-2411] | Nothing is fixed over the content; the "On this page" list scrolls with the margin, and anchors use `scroll-padding` |
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
- **Caching:** the app shell and Atkinson Hyperlegible Next are cached
  first; Noto fallbacks and the fonts picked in Settings are cached the first
  time they are used, and picking a font downloads all its weights at once so
  it also works on pages read later offline. A new build keeps saved font
  files whose names (which carry a hash of the content) have not changed.
  Sections, profiles, the glossary and sources use stale-while-revalidate, following web.dev's
  and MDN's caching guidance.[^webdev-caching][^mdn-caching] Cache names carry
  the build version, so each build replaces the old copy once the reader
  updates (see Updates below).
- **What is saved:** every page a reader opens is saved as they read it. In Settings, under Data (also on `/offline`), the site lists each collection, how many of its pages are saved, and the space they take, with a button to save the rest and one to remove them. The collections are Nation profiles, Glossary and Other pages; the model code joins them when its pages are built. A collection the reader saves is "kept": it is saved again from each new version. The section shows the space the whole site uses, from the Storage API's estimate, and offers "Keep saved pages when space runs low," which asks the browser for persistent storage, since otherwise the browser may clear the site's data under storage pressure.[^mdn-storage] Saving runs six files at a time inside the service worker, with a progress bar.
- **Never cached:** any record with `sensitivity.restricted: true`, which is
  never published, exported, cached offline or served by any API
  ([data model, sensitivity flags](../docs/data-model.md#sensitivity-flags)).
  When a record is withdrawn, the next service worker update deletes it from
  every saved copy.
- **Offline notice:** "You are offline. Showing content as of [version,
  date]."

### Updates

How a reader who keeps the site on a device gets a new edition (project
design, asked for by Trevor on Nov. 21, 2026). Each build has its own build
version, the website version plus the build time, and the service worker
names its cache after it. The three track versions come from release-please
(`content/version.txt`, `site/version.txt`, `pdf/version.txt`), so a build can
change the website without changing the content.

1. **Detect.** The browser checks the service worker script on every
   navigation, and a new build always changes it, because the script
   contains the build version.[^webdev-lifecycle] SvelteKit also checks the
   build version when the tab regains focus, on data responses and on a
   timer; when it sees a new build, the page asks the browser to check the
   worker at once.[^sveltekit-updated] "Check for updates" in Settings does
   both on demand.
2. **Install in the background.** The new worker saves the new build's
   scripts, styles and core pages into its own cache and then waits. It does
   not take over on its own: taking over mid-visit would mix two versions in
   one page.[^webdev-lifecycle] While it waits, the old worker keeps saving
   pages it reads only if they come from its own build (each built page names
   its build), so saved copies never point at scripts they lack.
3. **Withdrawals first.** As soon as the new worker installs, every saved
   page that is not in the new build is deleted from the saved copies, without
   waiting for the reader. A nation's request to withdraw material therefore
   reaches every device on its next visit online
   ([charter, commitment 6](../docs/charter.md#6-the-right-to-correct-restrict-or-withdraw)).
4. **Ask.** A small card fixed at the bottom left of the window (not a block in the page, as Trevor asked on Nov. 22, 2026) says what the update brings, read from `/edition.json` on the network: "It brings content version 0.3.0; you are reading 0.2.0," or that only the website changed. It offers "Update now," "What changed" (the changelog) and "Later." It is a notice, not an alert, so it does not take focus.
5. **Apply.** "Update now" tells the waiting worker to take over
   (`skipWaiting`), and the page reloads once it has.[^mdn-skip-waiting] "Later"
   hides the notice for the visit; the browser applies the update by itself
   once every tab of the site has closed.[^webdev-lifecycle] The new worker
   deletes the old cache, keeping font files that have not changed and the
   list of kept collections.
6. **Save again.** On the next page load, the page asks the new worker to save
   the kept collections from the new build, and a status line shows the
   progress. If the connection drops, it continues on a later visit.
7. **What the reader sees offline.** The offline notice names the content
   version of the copy being read, and Settings shows the content and website
   versions and the build date, so a stale copy is always labeled.

**Downloaded books.** A PDF or EPUB on the reader's device cannot be updated
by the site. Each edition will print its edition number and the address
`/downloads?edition=<number>`; that page compares the number with the current
print version and says whether a newer edition is out, with a link to what
changed. The print templates do not print the address yet.

## 11. Performance and hosting

- **Stack:** SvelteKit and TypeScript with `@sveltejs/adapter-cloudflare`,
  deployed to Cloudflare Workers with static assets, as Cloudflare's SvelteKit
  guide describes.[^cloudflare-sveltekit] Content pages are prerendered at
  build time; only the request form, and later sign-in and review, run on the
  server.
- **Budgets (project choice):** under 100 KB of JavaScript compressed on a
  section page; no map library in the browser (the map is a static SVG, per
  the map spike); fonts subset to the characters used.
- **Map:** drawn at build time with d3-geo, with a table holding the same data (map tool spike, project files `spikes/map/REPORT.md`). The site has one map, at `/nations/map`, with buttons above it that switch between views; Trevor asked on 2026-11-22 for one map with views rather than separate maps, so that more views can be added over time. The buttons are a tab list, the chosen view's address carries `?view=`, and a link to a row in a hidden view's table (such as a region linked from a nation's page) opens that view. Without scripts every view is shown, one after another, and print shows them all.
  - **Nations by state** shades states by how many nations have a recorded presence there, and draws no nation's land ([decision record 0007](../docs/decisions/0007-map-shows-state-presence.md)).
  - **Bureau of Indian Affairs regions** draws the twelve regions from the Bureau's own boundary file (`geography/`), with a note that they are the Bureau's administrative areas, not nations' lands. Trevor chose on 2026-11-21 to draw the official outlines even though the Navajo Region's follows the Navajo Nation's land.
  - **Land areas** draws the Census Bureau's 2020 American Indian and Alaska Native areas in three shades: federal reservations and trust lands, state reservations, and the Census Bureau's statistical areas ([decision record 0027](../docs/decisions/0027-map-adds-census-land-areas.md)). Areas too small to see get a dot. Each area links to a table row naming the nations whose entries cite that Census area. The view is heavy, so the page fetches its drawing and table from `/nations/map/land-areas.json` the first time a reader opens it.
  - **Layout.** The contiguous United States (the 48 contiguous states and DC) fills a framed, labeled box at the top. Alaska, Hawaiʻi, Guam and the Northern Mariana Islands, American Samoa, and Puerto Rico and the U.S. Virgin Islands sit in a row of smaller framed, labeled boxes below. Each box has its own equal-area projection, fitted to the box, and its own scale bar. Together they show that every box is at a different scale and none is in its true place (Trevor, 2026-11-22). Every shape is drawn only by its own box's projection. The earlier composite projection from d3-composite-projections placed the islands in the open water beside the contiguous states with no frames, which read as their real positions.
  - **Code.** `src/lib/map-geometry.ts` projects the shapes once, in `vite.config.ts`, so the browser gets SVG paths and no map library. `src/lib/nations-map-drawing.ts` turns them into each view's SVG markup. The page shows that markup with `{@html}` from a universal load. The outlines are sent once, in the page, and not again in the data the page hydrates from. A reader who arrives from another page without reloading gets the same markup from `/nations/map/drawings.json`. To add a view, add its drawing to `drawNationsMaps` and its entry and key to the page's list of views. The grayscale print version for the book is not built yet.
  - **Nation pages.** Each nation's page also draws a small map of its states from the same shapes and boxes (see [Nation pages](#nation-pages)). Its outlines keep 5 percent of their points, rounded to whole map units, so the map stays light on each of the 980 pages.

## 12. Words in the interface

The interface follows the style guide's voice: plain verbs, sentence case,
"they" for people, no praise or alarm. In addition (project choice):

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
[^wcag-2411]: W3C, *Understanding Success Criterion 2.4.11: Focus Not Obscured (Minimum)*, [w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html).
[^wcag-258]: W3C, *Understanding Success Criterion 2.5.8: Target Size (Minimum)*, [w3.org/WAI/WCAG22/Understanding/target-size-minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).
[^dtcg]: Design Tokens Community Group, *Design Tokens Format Module* (draft), [designtokens.org/tr/drafts/format](https://www.designtokens.org/tr/drafts/format/).
[^atkinson]: Braille Institute, *Atkinson Hyperlegible Font*, [brailleinstitute.org/freefont](https://www.brailleinstitute.org/freefont/) (accessed Nov. 21, 2026).
[^butterick]: Matthew Butterick, *Practical Typography: Line length*, [practicaltypography.com/line-length.html](https://practicaltypography.com/line-length.html) (accessed Nov. 21, 2026).
[^mdn-color-scheme]: MDN Web Docs, *prefers-color-scheme*, [developer.mozilla.org](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme).
[^mdn-reduced-motion]: MDN Web Docs, *prefers-reduced-motion*, [developer.mozilla.org](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion).
[^webdev-caching]: web.dev, *Learn PWA: Caching*, [web.dev/learn/pwa/caching](https://web.dev/learn/pwa/caching).
[^mdn-caching]: MDN Web Docs, *Caching (Progressive web apps)*, [developer.mozilla.org](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Caching).
[^cloudflare-sveltekit]: Cloudflare, *SvelteKit (Workers framework guide)*, [developers.cloudflare.com/workers/framework-guides/web-apps/sveltekit](https://developers.cloudflare.com/workers/framework-guides/web-apps/sveltekit/).
[^wcag-1412]: W3C, *Understanding Success Criterion 1.4.12: Text Spacing*, [w3.org/WAI/WCAG22/Understanding/text-spacing](https://www.w3.org/WAI/WCAG22/Understanding/text-spacing).
[^mdn-hyphens]: MDN Web Docs, *hyphens*, [developer.mozilla.org](https://developer.mozilla.org/en-US/docs/Web/CSS/hyphens).
[^wcag-148]: W3C, *Understanding Success Criterion 1.4.8: Visual Presentation*, [w3.org/WAI/WCAG22/Understanding/visual-presentation](https://www.w3.org/WAI/WCAG22/Understanding/visual-presentation).
[^apg-tabs]: W3C WAI, *ARIA Authoring Practices Guide: Tabs Pattern*, [w3.org/WAI/ARIA/apg/patterns/tabs](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/).
[^apg-combobox]: W3C WAI, *ARIA Authoring Practices Guide: Select-Only Combobox Example*, [w3.org/WAI/ARIA/apg/patterns/combobox/examples/combobox-select-only](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/examples/combobox-select-only/).
[^webdev-lifecycle]: Jake Archibald, *The service worker lifecycle*, web.dev, [web.dev/articles/service-worker-lifecycle](https://web.dev/articles/service-worker-lifecycle) (accessed Nov. 21, 2026). Sections "Updating the service worker," "Waiting" and "Skip the waiting phase."
[^sveltekit-updated]: SvelteKit, *$app/state: updated*, [svelte.dev/docs/kit/$app-state#updated](https://svelte.dev/docs/kit/$app-state#updated); the same text is in `@sveltejs/kit` 3.4.0's type definitions.
[^mdn-skip-waiting]: MDN Web Docs, *ServiceWorkerGlobalScope: skipWaiting() method*, [developer.mozilla.org](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerGlobalScope/skipWaiting).
[^mdn-storage]: MDN Web Docs, *Storage quotas and eviction criteria*, [developer.mozilla.org](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria), and *StorageManager: persist() method*, [developer.mozilla.org](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist).
[^mdn-dialog]: MDN Web Docs, *&lt;dialog&gt;: The Dialog element*, [developer.mozilla.org](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/dialog).
[^westlaw-delivery]: Thomson Reuters, *Westlaw Australia Guide: Document Delivery*, [support.thomsonreuters.com.au/node/10181](https://support.thomsonreuters.com.au/node/10181) (tabs "Layout and Limits," "Content to Append" and "The Basics"); Thomson Reuters, *Email, print, download, and share documents* (Westlaw Edge Canada), [thomsonreuters.com](https://www.thomsonreuters.com/en-ca/help/westlaw-edge/tools/other-tools/email-print-download-and-share-documents.html) (accessed Nov. 21, 2026). Trevor's screenshots of the U.S. Westlaw screens may refine this.
[^mdn-beforeprint]: MDN Web Docs, *Window: beforeprint event*, [developer.mozilla.org](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeprint_event).
[^wery]: J. J. Wery and J. A. Diliberto, *The effect of a specialized dyslexia font, OpenDyslexic, on reading rate and accuracy*, 67 Annals of Dyslexia 114 (2017), [doi.org/10.1007/s11881-016-0127-1](https://doi.org/10.1007/s11881-016-0127-1).
[^ofl-faq]: SIL International, *OFL-FAQ*, entries 2.2 and 2.6, [openfontlicense.org/ofl-faq](https://openfontlicense.org/ofl-faq/) (accessed Nov. 21, 2026).
[^lucide-license]: Lucide, *License*, [lucide.dev/license](https://lucide.dev/license) (accessed Nov. 21, 2026). ISC License, with the MIT License for icons drawn from Feather; full text in [`LICENSES/Lucide.txt`](../LICENSES/Lucide.txt).
[^lucide-svelte]: Lucide, *Lucide for Svelte*, [lucide.dev/guide/svelte](https://lucide.dev/guide/svelte) (accessed Nov. 21, 2026).
[^lucide-a11y]: Lucide, *Accessibility* (Svelte), [lucide.dev/guide/svelte/advanced/accessibility](https://lucide.dev/guide/svelte/advanced/accessibility) (accessed Nov. 21, 2026).
