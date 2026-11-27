# Editing on the website

How essays are written, edited, versioned and published on the website, and how a finished essay reaches git and the book. Essays live in the private R2 bucket; the website is the main place to edit them ([decision record 0021](decisions/0021-edit-drafts-in-the-browser-keep-essays-in-the-bucket.md), Accepted). The workspace side is described for maintainers in [site/COLLABORATION.md](../site/COLLABORATION.md#essays).

Everything here is project design unless a source is cited. Statements labeled "measured" come from the round-trip test described under [Evidence](#evidence). Prices and limits are as Cloudflare published them on Nov. 21, 2026.

## In short

- **Essays live in the private R2 bucket**, from first draft to final publication (lead author's direction, Nov. 22, 2026: "this should be in cloudflare r2, I am going to make so many changes to this. So many, that constant pr's are unfeasible," and "we should get this onto the website, that is the main place to edit"). Every save is a new file that is never overwritten.
- **Git gets an automatic, read-only copy** of each published version, made by a scheduled GitHub workflow that fetches it from the website's public copy. It keeps a public history and an outside backup without any Cloudflare key in GitHub or any GitHub key on the website (see [Where published essays live](#where-published-essays-live)).
- **Research records stay in git** as they are now (sources, nation profiles, document histories, glossary entries; [decision record 0004](decisions/0004-content-as-plain-files.md)). Only essays, and later commentary and other long prose written by people, move to the bucket.
- **Our own small editor**, built on ProseMirror, offers exactly what the print book, the ebook and the website can all show: headings, paragraphs, **bold**, *italic*, underline, links, lists, quotations, tables, citations, glossary links, and the essay boxes for cases, quotations and analysis. Nothing else can be typed or pasted in, so nothing a writer does can break the print build. A Markdown view is one click away for anything easier to type as text.
- **Version history** keeps every saved version for good. Any two can be compared paragraph by paragraph, any one can be restored as a new version, and any one can be published.
- **Working on the same draft at once** is live on the essay pages: everyone editing an essay types into one shared text and sees the others' cursors, and the live room saves the versions (see [On the essay page](#on-the-essay-page)). A save from the workspace editor still names the version the writer started from, and a save made after someone else's is refused and shown side by side, so nothing is lost.

## What writers can do

Writers have asked for underline, italics, bold, images, tables and "other rich media" (lead author's request, Nov. 21, 2026). The editor offers each feature only if all three editions can show it ("to be added" means the reader is ready but a build does not render it yet):

| Feature | In Markdown | Website | Print (Typst) | Ebook (EPUB) |
| --- | --- | --- | --- | --- |
| Bold, italic | `**bold**`, `*italic*` | yes | yes | yes |
| Underline | `++underlined++` (markdown-it-ins) | yes: plain underline in the text color | to be added (Typst's `underline`) | to be added |
| Links | `[text](https://...)` | yes | yes | yes |
| Headings, lists, quotations | standard Markdown | yes | yes | yes |
| Tables | pipe tables | yes; on paper no row is split across pages | yes; rows never split across pages | yes |
| Citations, glossary links | the project's syntax (docs/citation-style.md, docs/terminology.md) | yes, as numbered markers with the Sources list | yes | yes |
| Case box | `:::: case <source key>` then `::::`, with the parts (background, question, holding, quotes, treatment, topics) kept on the case's source record as `case_box` | yes | yes (Foundations work) | to be added |
| Law box | `:::: law <source key>` then `::::`, with the parts (summary, shown as "What it does", quotes, treatment) kept on the law's source record as `law_box` | yes | yes (Foundations work) | to be added |
| Quotation box | `::: quote`, with a last paragraph that is only the citation, such as `[@key, p. 17]` or `[@key, p. 17] (Gorsuch, J., dissenting)`, as the attribution | yes | being added | to be added |
| Analysis box | `::: analysis [title]` | yes | being added | to be added |
| Figures | `:::: figure <kind> <address>` (kind `picture`, `video` or `sound`) or `:::: figure chart`, with the caption and parts inside | yes | pictures print in grayscale; video and sound print as a box saying where to find them; charts print as their table | to be added |

Not offered: font choices, colors, text size, alignment other than table columns, raw HTML, and anything pasted from Word that has no row in the table above. Pasting keeps the words and the features in the table and drops the rest (project choice: the book's look is set once, in the print and site styles).

### The essay boxes

The lead author asked on Nov. 22, 2026 for court cases to get "a specialized block," with "Quotes" and "Treatment" parts; for quotations to "get their own block"; and for the project's own analysis to sit "in special box, same as how we are separating cases out." Later that day the lead author added that "cases treat question and holding different from quotes and treatment," that "Acts and Laws should also have their own boxes," and that quotations "should be in italics" and "should use "..." when there is stuff before or after." The syntax was agreed with the Foundations chapters so the website and the print book read the same files:

```markdown
:::: case worcester-v-georgia
::: background
The law and events behind the case.
:::

::: question
Whether Georgia's laws had any force in the Cherokee Nation.
:::

::: holding
They did not: the Cherokee Nation is a distinct community in which the laws of Georgia "can have no force."
:::

::: quotes
> The Cherokee nation, then, is a distinct community.

[@worcester-v-georgia, at 561]
:::

::: treatment
How later courts treated it, including negative treatment.
:::
::::

:::: law usc-25-1301
::: summary
What the law does.
:::

::: quotes
> No Indian tribe in exercising powers of self-government shall ...

[@usc-25-1301, § 1302]
:::

::: treatment
Amendments and how courts have read it.
:::
::::

::: quote
Peacemaking is not alternative dispute resolution.

[@narf-ipi-home]
:::

::: analysis Why the holding matters here
The essay's own reading, set apart from what the sources say.
:::
```

Since Nov. 24, 2026 a case's or law's parts are kept on its source record, not in the essay (Trevor chose this so that a case reads the same in every essay, on its own page and in print). An essay places the box with its two fence lines and nothing between them:

```markdown
:::: case worcester-v-georgia
::::
```

and the record holds the parts, each in the syntax above (schemas/source.schema.json, `case_box` and `law_box`):

```yaml
case_box:
  holding: |-
    No. The Court held that the Cherokee Nation is a distinct political community ...
  quotes:
  - text: "The Cherokee nation, then, is a distinct community ..."
    pinpoint: "p. 561"
  - text: "..."
    pinpoint: "p. 595"
    parenthetical: "McLean, J., concurring"
  topics:
  - "Sovereign immunity"
```

The website and the print build fill each empty box from its record before they read the essay (`site/src/lib/essays/record-boxes.ts`, mirrored in `pdf/pipeline/record-boxes.mjs`), so the essay page, the case's page, its preview and the index of cases by topic all read the same parts. A box still written out in full in an essay, as every essay version published before the move has it, is shown as written. `scripts/move_record_boxes.py` moves written-out boxes onto their records. The essay's own Analysis boxes stay in the essay.

A case or law box is headed by the full citation of its source record, so the writer types only the key; under the heading come the lines the book prints too, from the same record: when the case was decided, the nations or peoples it concerns, and for the Supreme Court of the United States the Court, the vote, and who wrote and joined each opinion (src/lib/server/case-facts.ts). Each box also carries an anchor (`#case-<key>`, `#law-<key>`) that other pages, such as the cases by topic list, link to. Quoted words are set in italics on the website and in print. A quotation that starts with a lowercase letter (or a bracketed change such as "[w]e") needs a leading "... ", and one that does not end in ".", "?" or "!" needs a trailing " ..."; the editor's preview and the version page list quotations that break this rule, and publishing still goes ahead, because the writer may be quoting a whole fragment on purpose. A box that holds another box opens with more colons than the box inside it, because markdown-it-container ends a block at the first bare fence at least as long as its opening; the editor counts the colons itself. On the website a case box is outlined, a quotation has a bar at its left, and analysis is filled, and each box is labeled, so color is never the only cue ([site/DESIGN.md](../site/DESIGN.md)). Body paragraphs have a first-line indent except after a heading or a box (lead author, Nov. 22, 2026: "Use proper tabbing please").

**Underline** is a plain underline in the text color, in every edition; links keep the site's link color and underline (lead author's decision, Nov. 22, 2026). The Indigo Book's italics remain the form for case names and titles (docs/citation-style.md).

## On the essay page

Review and editing happen on the essay's own page, not in a separate place (lead author, Nov. 22, 2026: "integrate it into where it would actually show up, and just delineate there its current status"). Readers see the published text only; the draft and its status show only to people with access to the essay (lead author's choice, Nov. 22, 2026).

- **The page is the same for everyone.** It is rendered from the published version and cached. When the browser holds the signed-in hint (`site/src/lib/signed-in-hint.ts`), the newest publication asks `/workspace/essays/<id>/page` what this person may do. That answer is never cached and is refused to anyone without at least comment access (`site/src/lib/server/essay-page-state.ts`).
- **The bar above the text** is one slim bar, as in the approved mockups (essay-editor-mockups 3, 4 and v2-1). Reading, it holds the mode (Reading, Commenting or Editing), Published only or With drafts, and Edit, History and Publish. Editing, the same bar holds undo and redo with the list of this session's steps, the block style, bold, italic, underline, lists, link, Cite, Glossary, Add, Checks with how many it found, a saved mark, who else is here, Share, History and Publish, on one row at a laptop width. Tools the mockups leave out (the Markdown view, Preview, Comment on the selected words, Go to, Sources, Move up and down, Code, Name this version) sit under More, and the tools for the box the cursor is in (Change case, Add Holding, Add row and so on) show in a second row only there. Where the draft stands shows as labels under the title: "Published, version 2" in green, "11 draft changes" in amber, "1 section in review" in purple and "+ 2 new components" with a dashed amber edge, the colors of the approved mockups (tokens `status-published`, `status-draft` and `status-review` in `site/design-tokens.json`); who saved it and when is in their tooltips. Commenting adds the number of lines and words under them. The lead author asked on Nov. 23, 2026 why the editor looked different from the design: until then each feature had added text buttons to the first editor's toolbar.
- **Before the first publication.** An essay's page is there before anything is published. Readers see only "This page is not published yet," and the page asks search engines not to list it. People with access see the newest draft there, with the bar, to read, comment on and edit, and the index page of its part (Foundations, Essays or Back Matter) lists its drafts for them under "Drafts not published yet" (`/workspace/essays/drafts.json`). The lead author asked on Nov. 23, 2026, after not finding how to edit the Foundations chapters, which were not published yet and so had no page.
- **Edit and Done.** For contribute access and above, the bar has an Edit button beside Mode, and Done goes back to reading. An essay's page with `?edit` opens straight into editing.
- **No Workspace › Essays.** The lead author asked on Nov. 23, 2026 whether the workspace's Essays page was still needed "if all changes are done on the actual page," and said "yes, remove it." Each part's index page (Foundations, Essays, Back Matter) now shows the people working on its essays what the list showed: the drafts not published yet, an amber Draft badge on an essay with a saved draft newer than the published version, a purple In review badge on one with open review requests, and, for someone with full access to every essay, a plus button beside the heading that starts a new essay there and opens it in Editing (`/workspace/essays/new`). The same plus sits beside the section's name in the sidebar, as in essay-editor-mockups/4 and v2-1. Paragraphs changed both here and in git are settled on the essay's History page ("Use the git text"), which the red label under the title links to. The old addresses redirect: `/workspace/essays` to the Essays section, and the full-page editor (`/workspace/essays/<id>/edit`) to the essay's page in Editing. Other parts of the site can list the essays a person can edit from `/workspace/essays/editable.json`.
- **With drafts** shows the newest version with each changed block marked "Draft" (a solid amber bar in the margin) and each new block marked "New" (a dotted amber bar). In the editor, each component of a section in review that is not itself changed gets a purple bar, and the In review line under the section's heading is lavender with the reviewers' initials (`site/src/lib/essays/draft-marks.ts`). The marks come from a line comparison of the published and newest bodies (`lineChanges` in `site/src/lib/essays/merge.ts`); a removed paragraph is not marked yet.
- **The sidebar while editing.** In Commenting and Editing, the essay's entry in the left sidebar opens into the draft as it stands rather than the published headings: its sections and subsections, and under each the case, law and analysis boxes it holds, with a scale, a building and a light bulb before them and case names in italics (`site/src/lib/essays/editor-outline.ts`). A dot after an entry marks a draft change (amber), something new since the published version (an amber ring) or a section in review (purple); a heading also turns amber when anything under it changed, so a shut section still shows where the changes are. Entries open along the way to the changes and to the part being read, and each links to its place in the editor. Below the outline, "Your work" lists Review requests and Comments for you with their counts, and Your drafts, which opens into the essays with versions the person saved that are not published yet (as in essay-editor-mockups/4 and v2-1; lead author, Nov. 24, 2026).
- **Links open in a new tab.** In the editor, links to sources, opinions and citations, links in the text and the preview open in a new tab, so the draft stays open (lead author, Nov. 23, 2026). While editing, a click in the text only places the cursor.
- **Editing** opens the editor in place of the text, loaded only then. It saves by itself a few seconds after typing stops, at least every half minute while typing goes on, and when the tab is hidden or the editor closes. Those versions carry the note "Auto-saved", and the History page folds a run of them under the newest. "Name this version" saves the text as it stands as a version with a note of its own, even when nothing changed since the last save, because a saved version never changes.
- **Editing live.** Editing mode first joins the essay's live editing room. In the room, everyone edits one shared text, each person's cursor shows with their name, and Undo takes back only that person's own changes. Who else is there shows as initials in the bar; each person has one color, from their name, on their initials, their cursor and a small marker beside the line they are on (where they type, or for someone commenting, the top of what they are reading), and clicking their initials scrolls to them (`site/src/lib/essays/person-look.ts`; lead author, Nov. 23, 2026). The room saves a version about a minute after typing stops, so the editor does not save by itself. "Name this version" still saves a named version, which reaches the room at once, as do a restore and text arriving from git. The Markdown view is off while editing live, so everyone keeps one shared text. If the room cannot be reached within six seconds, or refuses (for example, when the sign-in has ended), the editor opens on its own and saves by itself as below. If the connection drops, typing goes on and the changes are sent when it is back; a copy is kept in the browser in case the tab closes first.
- **Nothing typed is lost to a failed save.** Until the site confirms a save, the browser keeps a copy of the text (`site/src/lib/essays/local-draft.ts`), and the editor offers it back ("Bring it back") the next time the essay opens, starting from the version it was based on so a newer save by someone else still shows as a conflict. When the sign-in has ended, the save addresses answer "401" instead of sending the person to sign in, and the editor says "Not saved". Only the save made as the tab is hidden uses keepalive, and only under about 60 KB, because browsers refuse keepalive requests over 64 KiB (Fetch Standard, "fetch" algorithm, keepalive quota); larger essays rely on the browser's copy if the tab closes. So unpublished text is not left on a shared computer, the copies are forgotten at sign-out and on any page opened while signed out, except the sign-in pages.

### Adding and moving blocks

The lead author asked on Nov. 22, 2026 that adding an item be easier: "consider that we don't want to force them to manually place things and move them around if we can make it easier." So the editor places blocks itself (`site/src/lib/essays/placement.ts`):

- **Add.** The "Add…" menu holds Section, Subsection, Paragraph, Case, Law, Quotation box, Analysis, "Picture, video or recording" and Chart. A new section goes after the section the cursor is in, subsections included, with its title selected to type over. A new subsection goes after the subsection the cursor is in, or after the section's opening text. Anything else goes after the paragraph, list or box the cursor is in, never inside it, and takes the place of an empty paragraph. The box buttons in the bar place boxes the same way, and still wrap selected text in a box when text is selected.
- **A chart from Build a table.** An essay's page opened with `?add-chart=` and a Build a table address (`/nations/data/build?data=…`) opens in Editing and adds that chart at the end of the essay: the result's title as the caption, its numbers as of today in the chart's table, and a source line naming the data and the day with a link back to the builder (`essayChartFrom` in `site/src/lib/table-builder.ts`). The address then drops the parameter, so a reload does not add it again. The lead author asked on Nov. 24, 2026 that making our own charts be "the same flow." A Build a table address that is not a chart of one grouping leaves the essay as it is and says so.
- **Move up and Move down** (Alt+Shift+Up and Alt+Shift+Down) swap the block the cursor is in with its neighbour. On a heading they move the whole section or subsection past the next one of the same level, and a subsection never leaves its section.
- **Every block is a box.** The lead author asked on Nov. 22, 2026 that no text sit loose: "I don't think we should have any "unboxed text". If the text is just raw, we can put it in a raw text box?" In the editor each top-level block has a dashed frame and a label: Text, Section heading, Subsection heading, List, Numbered list, Table, Quote and Code. Case, law, quotation, analysis and figure boxes keep their own label inside and get the frame only. The block the cursor is in is outlined, and its label carries its number among blocks of its kind, such as "Text · 13", so a writer or reviewer can name it. The frames are drawn by the editor only (`site/src/lib/essays/components.ts`); they change nothing in the essay's Markdown, and readers never see them.

### Credits

The lead author asked on Nov. 22, 2026 to "allow attestation of authors and editors within sections and sub-sections." On Nov. 24, 2026 he found attesting "all wrong": "need ability to add someone to a section, or do we even, we can just look at the edit history and go from there?" He chose "History plus Add someone" and approved its mockup (`essay-editor/screenshots/attest-proposal-mockup.png` in the project files). Under each section and subsection heading the editor shows a line such as "Written by Trevor Goldsmith · Edited by Ann Example · Researched by Ben Example" with each person's initials, and a Credits button (`site/src/lib/essays/credits.ts`, `credit-lines.ts`, `EssayCreditsPopover.svelte`). A section's credits include its subsections.

- **From the edit history.** Who wrote each word comes from the saved versions, as git blame does for lines, at the level of words (`site/src/lib/essays/word-blame.ts`; the method of WikiWho, Flöck and Acosta, WWW 2014). Each version is compared with the one before it, paragraphs first and then the words of the paragraphs that changed. A word still there keeps the person and version that first wrote it, and a paragraph moved whole keeps its words' people. Only words count, without punctuation, box fences, link addresses or front matter. Whoever has the most words still in a section wrote it, and so does anyone with at least half as many; everyone else whose words are there, or who changed one of its paragraphs (taking words out counts), edited it. The Credits popover says how: "Wrote it: 52 of the 73 words now here, Nov. 18 to 24", "Edited it: changed 2 paragraphs, Nov. 23". The history is of the newest saved version, so it catches up a moment after the live room saves.
- **Who typed what, live.** A version the live room saves names one person, the last to type. When more than one person typed, the room replays its changes at the save and keeps who typed each word beside the version (`essays/<id>/versions/<number>.authors.json` in the bucket), so each is credited for their own words (`site/src/lib/server/live/essay-room.ts`).
- **Versions without a person.** Text brought in from git carries no person, so it is credited to whoever started the essay, or else to the lead author.
- **What is kept.** Each version's blame is worked out once and kept in the bucket (`essays/<id>/blame/<format>/<number>.json`), with every twentieth version along the way, so a later version starts from the newest one kept (`site/src/lib/server/essay-credits.ts`).
- **From review requests.** Someone asked to review a section shows in the popover as "Reviewing, due Friday, November 27", and becomes "Reviewed by" in the line once they choose Done reviewing.
- **Added by hand.** For what the history cannot know, someone with full access to the essay picks a person and a role (Wrote, Edited, Researched or Reviewed) in the popover and chooses Add. Anyone on the project can be picked, since someone may have researched a section without having the essay open. Remove takes a credit away. Each credit is a row in D1 (`essay_section_credits`), and taking it away is another row, so nothing is changed or deleted; the newest row for a person, role and section says whether the credit stands. Each is also in the activity log.
- **Which section.** A section is named by its heading's id on the essay page, so renaming a heading starts its credits added by hand afresh; the old ones stay in the record under the old id.
- **What readers see.** On the published essay page, a line in small italics under a heading names who wrote, edited, researched and reviewed that section, such as "Written by Trevor Goldsmith. Edited by Ann Example." The history is of the published version. A name appears only when its person chose, once, in Profile and credit, to be credited on the website. It reads as their website credit there does (the names, description, nations and organization they ticked for the website) and links to their contributor page when they have one. Advisors stay unnamed on the public site until the lead author says otherwise. The credits are added when the page is served (`site/src/lib/server/essay-pages.ts`).
- **Attesting is gone.** The Attest button and dialog were removed. The `essay_attestations` table stays as a record; nothing adds to it now.
- Still to come: the same credits in the print book and ebook.

### Comments

The lead author approved the commenting mockup on Nov. 22, 2026: select words in the draft, comment on them, and pick quick asks such as "Show your sources." Comments are for the people working on the essay; readers never see them (`site/src/lib/essays/comments.ts`).

- **Commenting.** Commenting mode opens the newest draft in the editor without letting anyone change the text, so people with comment access, such as advisors, can comment too. It shows the text as readers see it, without the editing frames, and the bar holds only the mode, the line "Select words to comment or suggest wording. The text stays as the authors wrote it.", the saved mark, who is here and History (essay-editor-mockups/4-commenting).
- **Line numbers.** Commenting numbers each line of the text as it wraps on the screen, in a gutter on the left, with DRAFT or NEW beside the first line of a changed or new component, as on the mockup. The numbers follow the window's width, so they are for talking about the text now; a comment remembers its words, not its line.
- **Selecting words** opens a small dark menu above them: Comment, Suggest, Sources? and Expand. Comment opens a card in the margin beside the words, which stay highlighted, with "Line N:" and the words quoted, a "+" that shows the quick asks (Expand on this, Rewrite, Show your sources, Add a citation, Shorten, Check this fact, Unclear to me, Make this a case box), a box for the comment, "@ mention", Assign, Cancel and Send. Only the asks chosen stay on the card; the rest hide behind the "+" (lead author, Nov. 23, 2026). Suggest opens the same card with Rewrite chosen and the words in the box to rewrite. Sources? and Expand are one-click asks, sent at once with no words needed; the card then shows only the ask's tag. In editing, "Comment on the selected words" under More and Ctrl+Alt+M open the card. The lead author found the first version, a panel above the text, "dreadful" on Nov. 23, 2026, and asked for the approved design.
- **Threads** are cards in the right margin, each level with its words and pushing the next one down rather than overlapping. A card shows who wrote it, with their initials, the asks as tags, the comment and the replies, and Reply and Done. Clicking a card or its highlighted words marks both. Threads whose words have since changed follow the cards, and "Done" below them opens the finished ones, which can be reopened. On a narrow window the cards stack above the text. A thread is marked Done by the person who started it or by anyone with contribute access or above.
- **@ mention** lists the people who can open the essay; choosing one adds their name to the comment, and the thread shows on their "Comments for you" page (`/workspace/comments`) until they reply or it is marked done. The same page lists threads someone answered after the person wrote in them, and the Overview says how many are waiting. Each opens the essay at the thread (`?comment=`). Mentions are rows in D1 (`essay_comment_mentions`) and are never changed or deleted.
- **Assign.** A thread can be assigned to someone who can open the essay, or to one of the project's AI helpers, Claude or Nemesis (lead author, Nov. 23, 2026); the card shows who, and a thread assigned to a person is on their Comments for you page until it is done or assigned away, even after they reply. The person who started the thread may assign it, and so may anyone with contribute access. Each assignment is a new row in D1 (`essay_comment_assignments`) and an entry in the activity log; the newest counts. Claude and Nemesis do not answer an assigned thread by themselves yet.
- **Following the text.** A comment keeps the words selected and up to 32 characters on each side, the "text quote" selector of the W3C Web Annotation Data Model. As the text changes, the editor looks for every place those words appear and takes the one whose surrounding text matches best (`site/src/lib/essays/comment-anchors.ts`). When the words themselves were changed, the thread stays in the list with the words it was about and the note "These words have since changed." This replaced the plan to anchor with Yjs relative positions, because a quote also works on versions saved outside the live room, such as text brought in from git.
- **What is kept.** Each comment is a row in D1 (`essay_comments`) with the version the person was reading, and an entry in the activity log. A comment is never changed or deleted; only a thread's Done state changes.
- Still to come: the count of comments for you beside its sidebar entry, and a suggestion that applies to the text with one click.

### Comments on other pages

Trevor asked on Nov. 24, 2026 for commenting on the site's other pages, such as laws, cases, people and nations, which until then offered only Reading and Editing. The mockups are in `design/page-comments` (Nov. 26, 2026), and Trevor chose who may comment the same day: "Comment access or above" (`site/src/lib/components/PageComments.svelte`, `site/src/lib/server/page-comments.ts`).

- **Who.** On a nation's page, anyone with comment access or above on that nation, which counts the nation's team. On any other page, the person's role: advisors and co-authors comment, and editors and the lead author may also mark any thread done or assign it. Everyone else, readers included, never sees comments and keeps the flag to request a change.
- **Commenting** joins Reading and Editing in the masthead on every page, with the number of open comments on the button (Trevor, Nov. 27, 2026: commenting "should be" available on every page). That includes the home page (named `home`), lists such as the essays and Foundations lists, search, maps, tables and charts, source documents' copies, Verify File and Read offline. Essays and the pages edited like them, including the essay on About, Sponsor and Using AI, keep their own commenting on drafts. A few addresses take no comments, each for a reason (`site/src/lib/page-comment-paths.ts`):
  - pages private to a person or the team (the workspace, account and profile pages, signing in, your uploads and your book orders), since a comment's quoted words would show what only some people may see to everyone who reads the page's comments;
  - addresses that carry a secret (links from emails, sponsorship invitations), which a comment would keep;
  - video calls (rooms and an event's room), which fill the window without the masthead;
  - files and data rather than pages, and the internal address restricted pages are drawn at, whose comments are on the page's own address.
- **Selecting words** on the page opens the small dark menu: Comment, Suggest, Sources? and Check?. The cards are the essays' own, with the same quick asks (all but "Make this a case box"), @ mention, Assign, Reply and Done; under the comment being written, "Not shown to readers", and on a nation's page "Not shown to readers; the nation's team sees it". On a wide page the cards sit in a column on the right, each level with its words, which are highlighted (the CSS Custom Highlight API, so the page's own markup is never changed), and the page's text makes room for the column; on a narrow page they stack under the title, and the comment being written opens at the bottom of the screen.
- **Following the page.** A comment keeps its words with 32 characters on each side and is found again by the same rule as on essays, in the text of the page as shown (`site/src/lib/page-comment-anchors.ts`). When the words are gone, the thread is listed under "Words since changed".
- **What is kept.** Each comment is a row in D1 (`page_comments`, with `page_comment_mentions` and `page_comment_assignments`), named by the page's path, such as `laws/indian-removal-act-1830`, with the page's title, and an entry in the activity log. Comments are never changed or deleted, and are never written to git, so a nation's page keeps no public history of them. Threads waiting on someone show on their Comments for you page with the essays' threads.

### Sharing and asking for review

The lead author approved the "Share and review" mockup on Nov. 22, 2026: add people and pick their level, ask for review of a part by a date with a note, show "In review" on the page itself, and list the requests for each reviewer (`site/src/lib/essays/review-requests.ts`).

- **Share.** The Share button in the editor's bar opens a dialog that lists everyone who can open the draft and at what level, from their role and the lead author's grants. Only the lead author changes a level or adds someone from the workspace there, as on the Access page; the change is an ordinary grant on that essay, kept in its history. "Copy link" copies the essay page's address. Readers who follow it see only what is published.
- **Ask for review.** Anyone with contribute access asks one or more people who can open the essay to review the whole draft or one section, optionally by a date and with a message. The section the cursor is in is chosen to start with.
- **In review.** Under the section's heading, the editor shows "In review with Ann and Ben, due Friday, November 27", naming whoever has not finished. A request for the whole draft shows above the text. Each person asked has a "Done reviewing" button there; the request closes when all of them have finished, or when the person who asked, or someone with full access, closes it in the Share dialog.
- **Review requests.** A workspace page lists the requests waiting on each person, soonest due first, and the ones they asked of others; the Overview says how many are waiting. Each link opens the essay page in Commenting mode at the section to review (`?review=<heading id>`).
- **What is kept.** Each request is a row in D1 (`essay_review_requests`, with one row per person asked in `essay_review_reviewers`), with the version the draft was at, and an entry in the activity log. A request is never changed or deleted; only its done and closed times change.
- Still to come: an email to each person asked, once the site sends email, and the count of requests in the left sidebar.

### Pictures, videos and recordings

The lead author asked on Nov. 23, 2026 for pictures as their own block, to "allow digitally to add videos" ("we can figure out how to make that work with the physical book"), to "build with r2, we also might just end up with YouTube linking anyways," and for the website to "also accept just audio files." A figure is a picture, a video or a sound recording set between paragraphs:

```markdown
:::: figure picture /files/U-20261123-7KQ2MD/council%20house.jpg
The council house in 1934.

::: description
A wooden building with a porch and three people standing in front.
:::

::: credit
Photo by the Tribal archives.
:::
::::
```

- **Kinds.** `picture`, `video` or `sound`. The address is a file sent from the editor (`/files/<reference>/<name>`), or, for a video, a YouTube link. Any other address is refused when publishing, so an essay never shows a file from somewhere unknown (`site/src/lib/essays/figures.ts`).
- **Parts.** The paragraphs are the caption. **Description** is read aloud in place of a picture or video (the picture's alternative text); publishing warns when a picture or video has none. **Credit** says who made it. **Transcript** gives what is said in a video or recording; the page shows it folded under the figure and unfolds it for printing. All four are part of the essay's text, so they have the essay's version history and drafts.
- **Adding one.** "Picture, video or recording" in the editor's bar opens a dialog: choose a file, or paste a YouTube link, and fill in the caption, description, credit and transcript. A file goes through the shared upload path in pieces of 10 MB with a progress bar ([docs/uploads.md](uploads.md)); essay figures skip the review queue, because publishing the essay is the review. The figure lands after the block the cursor is in, never inside a paragraph, list or box. Inside a figure, "Add Description", "Add Credit" and "Add Transcript" add a missing part.
- **Files stay in the project's bucket**, not a video service (lead author, Nov. 23, 2026). They are served with byte ranges, so the browser's own player can seek. Co-authors (comment access and above) can see a draft's figures; everyone can once the essay is published. Each figure has a link to ask for its removal through the request form.
- **YouTube videos** show YouTube's still frame and a "Play the video" button. YouTube's player, from `youtube-nocookie.com`, loads only when someone presses it, so readers who never play a video load nothing from YouTube; without scripts, the button is a link to the video on YouTube (YouTube Help, "Embed videos & playlists").
- **In print** a picture prints itself, with its caption and credit centered under it in smaller type; its description becomes the picture's alternative text in the PDF, as it is on the website. The print build gets each file from the website at the address the essay names, now that the site has its own domain (`pictures.site` in `pdf/book.yaml`). It makes a grayscale copy for black-and-white ink (`pdf/pipeline/pictures.mjs`, `pdf/tools/prepare_pictures.py`), and the book's build record lists each picture by the SHA-256 of its original file. A picture spans the text width unless that would make it taller than three fifths of the text block. When it does not fit where the essay puts it, it moves to the top of the next page and the text runs on, so no page is left half empty. A picture the build cannot get prints as a box with its caption and "It appears with this essay on the website," with a warning in the build report. That happens when its essay is not yet published, the file is still in the virus check, or there is no network. A video or recording prints as a box with its caption, description, credit and transcript, and where to find it: the YouTube address, or the same line. On the website, the Print dialog loads every picture on the page before it opens the browser's print window, and a printed picture is kept to three fifths of the page with its caption.
- **Files in the virus check.** Every file is served only after the virus check passes (docs/uploads.md); until then its address answers 409. The page shows "This file is still being checked for viruses" in place of the picture or player, and the editor shows the same as a note above the text.
- **Charts.** `:::: figure chart` holds a small table: the first column names each bar and the second gives its number ("1,234" and "45%" are read as numbers). The website draws the bars as the Data and charts page does, each bar a list item a screen reader reads as its name and number, with "Show as a table" under it; print shows the table. The numbers are written in the essay, so a chart stays as it was when the essay was written (the data views plan keeps essay blocks "frozen as of a date" by default). Publishing is refused if the table has no numbers. "Chart" in the editor adds one with a starter table after the current block; "Add row" and "Remove row" work in any table. A chart takes a Credit part for its source, but no description (its bars are read aloud already) and no transcript.

### Checks and Go to

The editor's **Checks** button (contribute access and above) opens a panel of what may need a look. Each item is underlined in the text, wavy for spelling and grammar and dotted for definitions (lead author, Nov. 22, 2026: "spell-check ... as well as grammer-check functionality, try and find good libraries"). Choosing an item selects its words; the panel offers the fix, **Ignore**, and for spelling **Add to dictionary**. The choice to show Checks is remembered in the browser.

- **Spelling and grammar** come from Harper (`harper.js`, Apache-2.0, by Automattic), which runs in the browser, so no text is sent anywhere (Harper, "harper.js" documentation). Its dictionary and rules are one WebAssembly file of about 20 MB, fetched only when someone turns Checks on, kept by the browser after that, and left out of the offline copy of the site. The text is checked one block at a time, and each block's result is kept until it changes. A long essay takes about six to ten seconds the first time, then only the edited block is checked again (measured on the timeline essay, about 47,000 characters, Nov. 23, 2026). Citations are left out of the text checked.
- **What it is told to skip.** The dictionary also gets the names of nations (official, self-designation and former names), glossary terms and court case titles, about 1,500 words, and the words a person adds, which stay in that browser. Three Harper rules are off because the style guide decides otherwise: dashes, the en dash in number ranges, and the single ellipsis character. Spelling items for abbreviations ("v.", "U.S.C.", "Civ. Proc."), single letters and words joined by an apostrophe or ʻokina are dropped.
- **Has a glossary entry** marks the first unlinked use of each glossary term. **Link to the glossary** turns it into a glossary link. **May need a definition** lists two-to-four-word phrases used four or more times that have no glossary entry (`site/src/lib/essays/checks.ts`).
- **Citations and quotations** lists what the publishing checks would report: a citation key with no source record, a quotation with no citation, and the like.

**Go to** (Ctrl+G) shows the essay's counts of components, words and characters, which are not shown otherwise (lead author, Nov. 22, 2026: "instead of lines, use components, words, characters. This doesn't always need to be seen right away"), and moves to a component (a heading, paragraph or box), a word number or a character number.
- **Sources.** The lead author asked on Nov. 22, 2026 for "easy access to the source documents as well, so provide links to them." With the cursor on a citation, or in a case or law box, a line under the bar names the source and links to its documents: the copy this site keeps, the original address, and an archived copy, each opening in a new tab. "Sources" in the bar lists every source the essay cites, in the order it first cites them, with the same links; choosing one moves the cursor to its first citation. The links come from each source's full citation (`site/src/lib/essays/source-documents.ts`), fetched only for the sources the essay cites (`/workspace/essays/source-documents.json`), since every source's links at once would be about a megabyte.

## Where published essays live

The first version of this design kept drafts in Cloudflare and sent each finished essay to git by pull request. The lead author asked why the text should go to GitHub at all, and on Nov. 22, 2026 chose the bucket as the home for essays with an automatic copy in git. Three ways were compared (project analysis):

| | Bucket is home, git gets a copy (chosen) | Bucket only | Git is home |
| --- | --- | --- | --- |
| Drafts and saved versions | Cloudflare (R2 and D1) | Cloudflare | Cloudflare |
| Published essays | Never-overwritten files in R2 | Same | Markdown in git, by pull request |
| Publishing step | One button on the website | Same | A pull request |
| Website write access to GitHub | None | None | Needed for automatic pull requests |
| Print and ebook build | Fetches the published essays from the website's public copy; no secret | Needs a Cloudflare key in GitHub, which [decision record 0006](decisions/0006-secrets-only-in-cloudflare.md) rules out | Reads the files |
| Copies outside Cloudflare | The git copy, and every clone of it | None | Git |

### How it works

- **Saving** writes the whole file as a new object, `essays/<id>/versions/<number>-<first 12 characters of its SHA-256>.md`, with `If-None-Match: *` so an existing object is never replaced; R2 evaluates that condition atomically, so "two concurrent conditional writes cannot both observe success" (Cloudflare, "Consistency model"). D1 records the version in `essay_versions` (who, when, the writer's note, the SHA-256, the version it was based on) with an activity log entry in the same transaction. Triggers refuse any change to or deletion of a saved version.
- **Conflicts.** A save names the version the writer started from. If the essay has a newer version, the save is refused and the editor shows the writer's text next to a link to the newer version, with a choice to keep theirs as the next version or switch to the newer one. Nothing is overwritten either way.
- **Publishing** is one button for someone with full access. The website renders the chosen version first and refuses it if any citation key or glossary link points to nothing, the same rule the print build's reader applies (`pdf/pipeline/markdown.mjs`). It then adds a row to `essay_publications`, which can later only be held back or listed again, never changed or deleted.
- **Website pages.** Essay pages are rendered by the Worker from the bucket on request and cached per file and site build. Part I chapters are at `/foundations/<id>`, back matter pages such as the index of cases by topic at `/back-matter/<id>`, and the rest at `/essays/<id>`. Sources and glossary entries still come from git with each site build: the build bundles the full citation of every source record (about 5,350, formatted in about 3 seconds by one citation processor) and the glossary terms, so an essay can cite any source that is merged. Earlier publications stay readable from each page's list of versions. A link to a case or law box on another page, such as `[*Worcester v. Georgia* (1832)](#case-worcester-v-georgia)` in the index of cases by topic, goes to the page that holds the box, as the essays in git place it. A back matter page says `part: back-matter` in its front matter. A page that also says `generated: cases-by-topic` shows its own text followed by the index of cases by topic, built when the page is shown from the Topics of the cases every essay places (each case's record holds them): the newest published versions on the public page, the newest saved versions in the workspace (`site/src/lib/essays/case-topics.ts`, mirrored for print in `pdf/pipeline/case-topics.mjs`).
- **Pages about the site.** The About page (`/about`) and the Sponsorship page (`/sponsor`) are edited the same way, under the part "About the Site" (front matter `part: about`, migration `20261123T0435_add_essay_about_pages.sql`). Their text starts in `content/about/` in git, and each keeps the address it has always had, so a new page about the site needs its own route and an entry in `aboutPageAddresses` (`site/src/lib/server/essays.ts`) and cannot be started from the workspace. Until a page is first published, or when the database cannot be read, readers see the git text (`site/src/lib/server/about-pages.ts`), so the page is never missing. The Timeline to public review (`/about/timeline`) stays in code, because it is a list of steps with statuses rather than prose. The Acknowledgments page stays in git, because the book prints it from there; it can move once the print build reads the published copies (Trevor, Nov. 23, 2026: "Continue with page editing").
- **Public copy.** `/published-essays.json` lists every listed publication with its SHA-256, and `/published-essays/<id>/<number>.md` serves each as Markdown, exactly as saved. Held-back publications are not listed.
- **Git copy.** A scheduled GitHub workflow (hourly, and on demand) reads that list, downloads new versions, checks their SHA-256 and commits each to a separate `published-essays` branch, one commit per version (`scripts/copy_published_essays.py`). It is a branch of its own, not `main`, because `main` accepts changes only by pull request with checks ([decision record 0008](decisions/0008-pull-requests-without-required-approval.md)) and a pull request opened by a workflow's own token does not start other workflows (GitHub Docs, "Triggering a workflow"). A copy branch can also be rewritten for a removal request without touching `main`'s history.
- **Removal.** If a nation asks for material to be removed ([docs/requests.md](requests.md)), a person with full access holds the publication back at once, with the reason recorded. Deleting the file itself means lifting the bucket lock for that removal, which is deliberate friction, and rewriting the copy branch.
- **Print and ebook.** The build will fetch the published essays it needs from the public copy and record each version's SHA-256 in the book's build record, so an edition can be rebuilt exactly. Until then it reads `content/essays/`.
- **Text from git comes in by itself.** Each site build bundles the essays in `content/essays/`, the back matter pages in `content/back-matter/` and the pages about the site in `content/about/`. The first essay page or workspace page a Worker serves after a build compares them with the bucket (`site/src/lib/server/essay-git-sync.ts`). An essay new to the bucket is saved as its first version. Changed git text is saved as a new version when nothing was edited on the website since git's text last came in. Otherwise the two are merged paragraph by paragraph (`site/src/lib/essays/merge.ts`): a paragraph changed on one side takes that change, and the git text is kept beside the versions (`essays/<id>/git/<hash>.md`, named in the version's note) so the next merge starts from it. When both sides changed the same paragraph, nothing is saved; the workspace Essays page lists the essay, and a person with full access edits the paragraph or saves the git text as a new version ("Use the git text"). Versions from git name nobody and are never published by themselves: readers see them once someone with full access publishes (Trevor, 2026-11-22). Once the Foundations chapters settle, `content/essays/` will hold a note pointing to the copy branch.

## Version history

| Layer | What it holds | Where | Kept |
| --- | --- | --- | --- |
| Saved versions | A full copy of the essay each time someone saves, with who, when and a note ("Sent to advisors") | Markdown in the private bucket under `essays/<id>/versions/`; a row in `essay_versions`; an activity log entry | For good |
| Publications | Which saved version readers see, and since when | A row in `essay_publications` pointing at a saved version | For good; can be held back from readers |
| Live history | Every change while several people edit together | The essay's Durable Object (`EssayRoom`) | Until the room saves the next version |

Any two saved versions can be compared, paragraph by paragraph and word by word within a changed paragraph, and any one can be restored by someone with full access (restoring saves it as a new version, so nothing is lost). Each version is dated with its number and the moment it was saved or published, for example "Nov. 22, 2026, 10:30 p.m. PT", not added to the content version number (lead author, Nov. 22, 2026). This is the history of the project's **own** writing; the history of documents the project **cites** is a separate record ([decision record 0018](decisions/0018-document-version-history.md)).

**Untouched text stays untouched.** When the editor writes an essay back to Markdown, it copies every top-level block that did not change exactly as it was, so a save changes only the paragraphs that were edited and comparisons show real changes only. With no edits the file comes back identical; this is tested for every essay in `content/essays/` (`site/tests/essay-document.test.ts`).

## Built so far and still to build

Built (pull request "Edit essays on the website"): the editor with its Markdown view and preview, saved versions in the bucket, conflict protection, compare, restore, publish, hold back, the public essay pages and their version lists, the public copy, the hourly git copy, and bringing in the git text. Then (pull request "Edit essays in place"): the essay page's bar, the With drafts view, and editing in place with saving by itself. Then (pull request "Check spelling, grammar and definitions in the editor"): Checks and Go to. Then (pull request "Add pictures, videos and recordings to essays"): figures, then charts.

Next, in this order:

1. **Live co-editing.** The room is built (pull request "Add the live editing room"). Each essay gets one SQLite-backed Durable Object, `EssayRoom` in `site/src/lib/server/live/essay-room.ts`, that holds a Yjs document. It keeps hibernating WebSockets and presence (who is in the essay and where), so several people can type at once. It runs in a small second Worker, `tribal-law-project-live`, so the website's many deploys do not restart rooms mid-sentence. It uses the `yjs` package on the WebSocket Hibernation API directly rather than `y-partyserver`, which saves its copy only every few seconds and does not install beside this site's Cloudflare types. Comment-level connections can read along but their edits are dropped. The room saves one version after each pause, not one per automatic save (versioning option A of the editing review, Nov. 23, 2026). It saves about a minute after the typing stops, at least every ten minutes while it goes on, and a few seconds after the last person leaves. The website's handshake and the browser module came next (pull request "Connect the website to the live editing room"), then the editor joining the room (pull request "Edit essays live together").
2. **Comments** on drafts in D1 are built (pull request "Comment on words in a draft"; see "Comments" above). Sign-offs stay in `reviews`.
3. **Print and ebook from the public copy**, recording each essay's SHA-256 in the build record.
4. **Pictures in the EPUB build**, and bars for charts in print; then a timeline strip and a comparison grid as further figure kinds. Pictures print in the Typst build (pull request "Print essays' pictures"). Until step 3, the print build reads essays from `content/essays/`, so a picture added on the website prints once that essay's text is in git or step 3 is built.
5. **Bucket lock** on `essays/` (see below), and moving `content/essays/` to the copy branch once the Foundations chapters settle.
6. Later: suggested changes (tracked changes), offline drafting.

**Bucket lock.** Cloudflare's bucket locks stop objects under a prefix being deleted or overwritten "indefinitely, until the lock is explicitly removed" (Cloudflare, "Bucket locks"). The site already never overwrites a saved version; a lock adds protection against a mistake made outside the site, such as a script with the bucket's keys. It is set in the Cloudflare dashboard under R2, the bucket's Settings, "Bucket lock rules": prefix `essays/`, no expiry.

## Cost

The account is on the Workers Paid plan (lead author, Nov. 22, 2026). Saving and publishing use R2 and D1 within the amounts already in use: a few hundred kilobytes per saved version, one D1 row and one activity log entry. Live co-editing adds Durable Objects, which on the Paid plan include 1 million requests and 400,000 GB-s a month, with incoming WebSocket messages counted 20 to 1 (Cloudflare, "Durable Objects pricing": "100 WebSocket incoming messages would be charged as 5 requests"). Three people writing together for two hours, each sending about one change a second, send about 21,600 messages, billed as about 1,080 requests (project analysis). The other options cost more: Tiptap's platform starts at $49 a month (Tiptap, "Pricing"), and Collabora needs a server of its own.

## Evidence

A round-trip test (Nov. 21, 2026) read the three essays in `content/essays/` into a ProseMirror document using the same Markdown reader options as the print build, wrote them back, and read them again (measured): all three came back the same, an untouched save was identical, and a naive rewrite would have changed 16 to 85 percent of lines. The site's tests now repeat that check on every essay in `content/essays/`, plus documents with every essay box. The editor reads Markdown with the "typographer" option off, so it never turns straight quotes into curly ones in the source; the pages and the print build do that when they render.

## Sources

- Cloudflare, "Consistency model," *R2* (conditional writes), [developers.cloudflare.com/r2/reference/consistency/](https://developers.cloudflare.com/r2/reference/consistency/), and "Conditional operations" (last updated Nov. 10, 2026), [developers.cloudflare.com/r2/api/s3/conditional-operations/](https://developers.cloudflare.com/r2/api/s3/conditional-operations/).
- Cloudflare, "Workers API reference," *R2* (`put` with `onlyIf` returns `null` when a precondition fails), [developers.cloudflare.com/r2/api/workers/workers-api-reference/](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/).
- Cloudflare, "Bucket locks," *R2* (last updated Oct. 28, 2026), [developers.cloudflare.com/r2/buckets/bucket-locks/](https://developers.cloudflare.com/r2/buckets/bucket-locks/).
- Cloudflare, "Pricing" and "Limits," *Durable Objects* (last updated Nov. 13, 2026), [developers.cloudflare.com/durable-objects/platform/pricing/](https://developers.cloudflare.com/durable-objects/platform/pricing/), [developers.cloudflare.com/durable-objects/platform/limits/](https://developers.cloudflare.com/durable-objects/platform/limits/).
- Cloudflare, "Use WebSockets," *Durable Objects*, [developers.cloudflare.com/durable-objects/best-practices/websockets/](https://developers.cloudflare.com/durable-objects/best-practices/websockets/); PartyKit repository and `y-partyserver` README, [github.com/cloudflare/partykit](https://github.com/cloudflare/partykit).
- GitHub Docs, "Triggering a workflow" (on workflows started by the `GITHUB_TOKEN`), [docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow) (seen as a search result on Nov. 22, 2026; not read in full).
- Automattic, Harper and `harper.js` (Apache-2.0), [writewithharper.com/docs/harperjs/introduction](https://writewithharper.com/docs/harperjs/introduction), and the `harper.js` 3.2.0 package's type definitions (read Nov. 23, 2026).
- WHATWG, *Fetch Standard*, "fetch" (a keepalive request fails when in-flight keepalive bodies exceed 64 kibibytes), [fetch.spec.whatwg.org](https://fetch.spec.whatwg.org/#fetching); measured in headless Chromium on Nov. 23, 2026 (50,000 characters sent, 70,000 refused).
- YouTube Help, "Embed videos & playlists" (privacy-enhanced mode: youtube-nocookie.com stores no cookies for a viewer until they play the video), [support.google.com/youtube/answer/171780](https://support.google.com/youtube/answer/171780).
- ProseMirror, `prosemirror-markdown`, [github.com/ProseMirror/prosemirror-markdown](https://github.com/ProseMirror/prosemirror-markdown); markdown-it, `markdown-it-container` and `markdown-it-ins`, [github.com/markdown-it](https://github.com/markdown-it).
- Tiptap, "Pricing," [tiptap.dev/pricing](https://tiptap.dev/pricing).
- W3C, *Web Annotation Data Model* (Recommendation, Feb. 23, 2017), section 4.2.4, "Text Quote Selector" (the exact words with a prefix and suffix to tell apart repeated passages), [www.w3.org/TR/annotation-model/#text-quote-selector](https://www.w3.org/TR/annotation-model/#text-quote-selector).
- The lead author's requests: project threads "Plan collaborative editing for the website" (Nov. 21 and 22, 2026), "Build the Foundations part with strong sources" and "Edit essays on the website" (Nov. 22, 2026).
