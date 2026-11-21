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
| Nation representative: staff of a nation's court, legal department or cultural office | Check what the project says about the nation, and correct, restrict or remove it | A request takes minutes, needs no account, and protects first |
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
- **Custom icons.** An icon set will be chosen later. Until then, controls
  use words.

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

The code, Peacemaking, Nations, Glossary, Sources, About, and a Contribute
button. Search, the theme setting and the offline state sit beside them. The
footer of every page carries "Request a correction or removal," the requests
log, the licenses and the three version numbers
([requests.md](../docs/requests.md#where-the-request-starts)).

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
| Nations directory, map and table | `/nations` |
| Nation profile | `/nations/<id>` |
| Native Hawaiian community | `/nations/native-hawaiian` (its own page, never listed as a tribe) |
| Glossary and entry | `/glossary`, `/glossary/<id>` |
| Sources and source record | `/sources`, `/sources/<key>` |
| About, charter, methods, credits, licenses, accessibility | `/about/...` |
| Changelog and requests log | `/changelog`, `/changelog/requests` |
| Request form | `/requests` |
| Read offline | `/offline` |
| Settings | `/settings` |
| Later: sign-in, review queue, template builder, maintainer view, data | `/sign-in`, `/review`, `/templates`, `/admin/requests`, `/data` |

## 5. Page templates

| Template | Layout | Key parts |
| --- | --- | --- |
| Home | One column, then a four-part contents band | Purpose in one sentence; search; reserved art space; contents by part, with the two tracks side by side; "For Native nations" panel; recent changes |
| Section | Contents rail, text, margin | "Model text, not law in force" notice with the version and last change; hanging section number; status chips; text with alternatives and placeholders; Comment, Illustrations, Source note; previous and next; margin: On this page, notes, "Cite this section," "Adapt this section" |
| Track landing | One column | What the track is, cited; its chapters; for peacemaking, a step-by-step outline of how a process unfolds |
| Nation profile | Text and margin | Review status panel with the four review steps and "Is this about your nation?"; at a glance (a summary list); courts and dispute resolution, as a table; published law, linked not reproduced; Local Contexts Notices and Labels; sources; margin: On this page, small state grid, where the nation appears in the code, "Cite this profile" |
| Nations directory | One column | Search and filters (group, state, review status); Map and Table tabs holding the same data; the map's "what this shows" notice |
| Glossary entry | Entry rail, text, margin | Term, usage status, definition with sources, how the project uses it, where it appears, see also, "Suggest a change to this term" |
| Source record | Text and margin | Citation, original link, archived copies, change history, quotation basis, what cites it |
| Changelog | One column with tabs | Content, Website, Print and Requests log; each version's entries; comparison of a section between versions |
| Request | One question per page | Start page; what would you like to do; which material; how can we reply; details; credit (contribute only); check your request; request sent |
| Read offline | One column | Install the site; save the code, the profiles or both; PDF and EPUB downloads; what is saved and as of when |

## 6. Components

**Masthead.** Wordmark and edition, main menu, theme setting, Contribute.
Menu items are at least 44 px tall. The current section is marked with
`aria-current="page"` and a 3 px underline.

**Notices.** One style for status: "This is a working draft" on the home
page; "Model text, not law in force" with the version and last change on
every section, following legislation.gov.uk's status box; "You are offline;
showing content as of [date]" when offline. A notice is a `role="note"`
block, not an alert.

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
entry, so the card is never the only way to the content. A setting turns cards
off.

**Citations.** A numbered marker in the text; on wide screens the note sits
in the margin beside the line, and on narrow screens it opens inline under
the paragraph. Each note links to its source record and archived copy.

**Panels.** Outlined (`line`) or filled (`surface`). One panel per purpose;
the design does not chop pages into rows of identical cards (project choice).

**Summary list.** A `<dl>` of label and value pairs for nation facts and for
"Check your request," following the GOV.UK summary list.

**Tables.** For data a reader compares across rows. Wide tables scroll inside
their own box, so the page never scrolls sideways.

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

Every text color passes WCAG's 4.5:1 minimum for text[^wcag-143] on the
backgrounds it is used on, and control borders pass the 3:1 minimum for
non-text contrast.[^wcag-1411] Ratios were computed with the WCAG relative
luminance formula (project calculation).

| Token | Light | Ratio on paper | Dark | Ratio on paper |
| --- | --- | --- | --- | --- |
| paper | `#FFFFFF` | | `#121619` | |
| surface | `#F2F4F6` | | `#1A2026` | |
| ink | `#1A2027` | 16.4:1 | `#E9EDF0` | 15.5:1 |
| ink-muted | `#4B5662` | 7.5:1 | `#A7B1BA` | 8.4:1 |
| link, action, ADR track | `#1F4FA3` | 7.8:1 | `#8CB4FF` | 8.7:1 |
| link-visited | `#5A3D8C` | 8.5:1 | `#C3A8F0` | 8.8:1 |
| track-peacemaking | `#1C6B47` | 6.5:1 | `#6CCB9C` | 9.2:1 |
| control-border | `#66717D` | 5.0:1 | `#8A949E` | 5.9:1 |
| danger | `#B42318` | 6.6:1 | `#FF8A80` | 8.0:1 |
| placeholder-background | `#FFF0B3` | ink 14.4:1 | `#4A3B00` | ink 9.3:1 |
| focus | `#FFD34D` with a 3 px ink ring | | `#FFD34D` | |

Rules (project choice):

- Color only marks meaning: links, the two tracks, placeholders, focus,
  errors and the map classes. Everything else is ink on paper.
- Color is never the only cue. Links are underlined; tracks are named;
  compared text is struck through or underlined as well as highlighted;
  map tiles print their counts.
- The two track colors differ in lightness as well as hue, so they stay apart
  for readers who do not see the difference between blue and green.

### Type

One family, Atkinson Hyperlegible Next, from the Braille Institute, which
offers it in seven weights with italics and says it covers more than 150
languages.[^atkinson] Its letterforms are built to be told apart, which suits
an accessibility-first reference (project analysis). The site
uses 400, 600 and 700 only.

- **Scale:** 1.25 from an 18 px body: 16, 18, 22.4, 28, 35 and 44 px.
- **Line height:** 1.6 for reading, 1.25 for headings.
- **Measure:** at most 68 characters, inside the 45 to 90 character range
  Practical Typography recommends.[^butterick]
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
- **Hosting:** the font files are served by the site itself, not by a
  third-party font service, so offline reading works and no reader's address
  goes to another company (project choice). Its license is the SIL Open Font
  License, kept beside the files.

### Space, radius and layout

An eight-step space scale from 4 px to 72 px; 6 px corners on controls and
10 px on panels; a 1,240 px page width; a 44 px minimum target. All values
are in [design-tokens.json](design-tokens.json).

## 8. Themes

- **Choices:** Automatic (follows the device's `prefers-color-scheme`
  setting[^mdn-color-scheme]), Light and Dark. Automatic is the default.
- **How:** the root element carries `data-theme="light"` or `"dark"` when the
  reader picks one; otherwise the `prefers-color-scheme` media query decides.
  A small inline script sets the attribute before the page paints, so there is
  no flash of the wrong theme. The choice is stored on the device only.
- **Print:** a print stylesheet uses the light theme, drops the navigation and
  margin tools, and prints each note's full citation and each link's address.

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
- **Caching:** the app shell and fonts are cached first; sections, profiles,
  the glossary and sources use stale-while-revalidate, following web.dev's
  and MDN's caching guidance.[^webdev-caching][^mdn-caching] Cache names carry
  the content version so a release replaces the old copy.
- **What is saved:** on `/offline`, a reader saves the code, the nation
  profiles, or both, and sees how much space each takes and the version saved.
- **Never cached:** any record with `sensitivity.restricted: true`, which is
  never published, exported, cached offline or served by any API
  ([data model, sensitivity flags](../docs/data-model.md#sensitivity-flags)).
  When a record is withdrawn, the next service worker update deletes it from
  every saved copy.
- **Offline notice:** "You are offline. Showing content as of [version,
  date]."

## 11. Performance and hosting

- **Stack:** SvelteKit and TypeScript with `@sveltejs/adapter-cloudflare`,
  deployed to Cloudflare Workers with static assets, as Cloudflare's SvelteKit
  guide describes.[^cloudflare-sveltekit] Content pages are prerendered at
  build time; only the request form, and later sign-in and review, run on the
  server.
- **Budgets (project choice):** under 100 KB of JavaScript compressed on a
  section page; no map library in the browser (the map is a static SVG, per
  the map spike); fonts subset to the characters used.
- **Map:** drawn at build time with d3-geo as two SVG files, one themed by
  tokens for the web and one grayscale for print, with a table holding the
  same data (map tool spike, project files `spikes/map/REPORT.md`). The map
  shows presence by state only
  ([decision record 0007](../docs/decisions/0007-map-shows-state-presence.md)).

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
3. **Icon set:** to be chosen; it must not draw on Native motifs.
4. **Art:** sizes for the cover, part openers and the home page space, to
   give to the art contest.
5. **Track colors** are placeholders until the art is chosen; they may change
   to sit well beside it.
6. **Template builder:** how placeholders and alternatives become a nation's
   draft ordinance.

## References

[^illuminative]: IllumiNative, *Industry Guide* (June 2022), [illuminative.org](https://illuminative.org/wp-content/uploads/2022/06/IllumiNative_industry-guide_June-2022.pdf), as summarized in the earlier design notes (project files `design/website-exploration/reference-sites-and-ideas.md`).
[^nk360]: Smithsonian National Museum of the American Indian, *Native Knowledge 360°: Essential Understandings*, [americanindian.si.edu/nk360/about/understandings](https://americanindian.si.edu/nk360/about/understandings) (accessed Nov. 21, 2026).
[^uswds-banner]: U.S. Web Design System, *Banner*, [designsystem.digital.gov/components/banner](https://designsystem.digital.gov/components/banner/) (accessed Nov. 21, 2026).
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
