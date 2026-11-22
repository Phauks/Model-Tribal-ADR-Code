# Editing on the website

How essays are written, edited, versioned and published on the website, and how a finished essay reaches git and the book. Essays live in the private R2 bucket; the website is the main place to edit them ([decision record 0021](decisions/0021-edit-drafts-in-the-browser-keep-essays-in-the-bucket.md), Accepted). The workspace side is described for maintainers in [site/COLLABORATION.md](../site/COLLABORATION.md#essays).

Everything here is project design unless a source is cited. Statements labeled "measured" come from the round-trip test described under [Evidence](#evidence). Prices and limits are as Cloudflare published them on Nov. 21, 2026.

## In short

- **Essays live in the private R2 bucket**, from first draft to final publication (lead author's direction, Nov. 22, 2026: "this should be in cloudflare r2, I am going to make so many changes to this. So many, that constant pr's are unfeasible," and "we should get this onto the website, that is the main place to edit"). Every save is a new file that is never overwritten.
- **Git gets an automatic, read-only copy** of each published version, made by a scheduled GitHub workflow that fetches it from the website's public copy. It keeps a public history and an outside backup without any Cloudflare key in GitHub or any GitHub key on the website (see [Where published essays live](#where-published-essays-live)).
- **Research records stay in git** as they are now (sources, nation profiles, document histories, glossary entries; [decision record 0004](decisions/0004-content-as-plain-files.md)). Only essays, and later commentary and other long prose written by people, move to the bucket.
- **Our own small editor**, built on ProseMirror, offers exactly what the print book, the ebook and the website can all show: headings, paragraphs, **bold**, *italic*, underline, links, lists, quotations, tables, citations, glossary links, and the essay boxes for cases, quotations and analysis. Nothing else can be typed or pasted in, so nothing a writer does can break the print build. A Markdown view is one click away for anything easier to type as text.
- **Version history** keeps every saved version for good. Any two can be compared paragraph by paragraph, any one can be restored as a new version, and any one can be published.
- **Working on the same draft at once** is protected, not yet live: a save names the version the writer started from, and a save made after someone else's is refused and shown side by side, so nothing is lost. Live co-editing on a Durable Object is the next step ([Built so far and still to build](#built-so-far-and-still-to-build)).

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
| Case box | `:::: case <source key>` with `::: background`, `::: question`, `::: holding`, `::: quotes` and `::: treatment` inside, in that order, closed by `::::` | yes | yes (Foundations work) | to be added |
| Law box | `:::: law <source key>` with `::: summary` (shown as "What it does"), `::: quotes` and `::: treatment` inside, closed by `::::` | yes | yes (Foundations work) | to be added |
| Quotation box | `::: quote`, with a last paragraph that is only the citation, such as `[@key, p. 17]` or `[@key, p. 17] (Gorsuch, J., dissenting)`, as the attribution | yes | being added | to be added |
| Analysis box | `::: analysis [title]` | yes | being added | to be added |
| Figures | `::: figure <media id>` with the caption inside | to be added | to be added | to be added |

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

A case or law box is headed by the full citation of its source record, so the writer types only the key; under the heading come the lines the book prints too, from the same record: when the case was decided, the nations or peoples it concerns, and for the Supreme Court of the United States the Court, the vote, and who wrote and joined each opinion (src/lib/server/case-facts.ts). Each box also carries an anchor (`#case-<key>`, `#law-<key>`) that other pages, such as the cases by topic list, link to. Quoted words are set in italics on the website and in print. A quotation that starts with a lowercase letter (or a bracketed change such as "[w]e") needs a leading "... ", and one that does not end in ".", "?" or "!" needs a trailing " ..."; the editor's preview and the version page list quotations that break this rule, and publishing still goes ahead, because the writer may be quoting a whole fragment on purpose. A box that holds another box opens with more colons than the box inside it, because markdown-it-container ends a block at the first bare fence at least as long as its opening; the editor counts the colons itself. On the website a case box is outlined, a quotation has a bar at its left, and analysis is filled, and each box is labeled, so color is never the only cue ([site/DESIGN.md](../site/DESIGN.md)). Body paragraphs have a first-line indent except after a heading or a box (lead author, Nov. 22, 2026: "Use proper tabbing please").

**Underline** is a plain underline in the text color, in every edition; links keep the site's link color and underline (lead author's decision, Nov. 22, 2026). The Indigo Book's italics remain the form for case names and titles (docs/citation-style.md).

## On the essay page

Review and editing happen on the essay's own page, not in a separate place (lead author, Nov. 22, 2026: "integrate it into where it would actually show up, and just delineate there its current status"). Readers see the published text only; the draft and its status show only to people with access to the essay (lead author's choice, Nov. 22, 2026).

- **The page is the same for everyone.** It is rendered from the published version and cached. When the browser holds the signed-in hint (`site/src/lib/signed-in-hint.ts`), the newest publication asks `/workspace/essays/<id>/page` what this person may do. That answer is never cached and is refused to anyone without at least comment access (`site/src/lib/server/essay-page-state.ts`).
- **The bar above the text** says where the draft stands (the newest version, who saved it, how many blocks changed, which version readers see) and holds two choices: **Show** (Published only, or With drafts) and, for contribute access and above, **Mode** (Reading or Editing). It links to the essay's History, and a person with full access can publish the draft from it.
- **With drafts** shows the newest version with each changed block marked "Draft" (a solid bar in the margin) and each new block marked "New" (a dashed bar). The marks come from a line comparison of the published and newest bodies (`lineChanges` in `site/src/lib/essays/merge.ts`); a removed paragraph is not marked yet.
- **Editing** opens the editor in place of the text, loaded only then. It saves by itself a few seconds after typing stops, at least every half minute while typing goes on, and when the tab is hidden or the editor closes. Those versions carry the note "Auto-saved", and the History page folds a run of them under the newest. "Name this version" saves the text as it stands as a version with a note of its own, even when nothing changed since the last save, because a saved version never changes.

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
- **Website pages.** Essay pages are rendered by the Worker from the bucket on request and cached per file and site build. Part I chapters are at `/foundations/<id>`, back matter pages such as the index of cases by topic at `/back-matter/<id>`, and the rest at `/essays/<id>`. Sources and glossary entries still come from git with each site build: the build bundles the full citation of every source record (about 5,350, formatted in about 3 seconds by one citation processor) and the glossary terms, so an essay can cite any source that is merged. Earlier publications stay readable from each page's list of versions. A link to a case or law box on another page, such as `[*Worcester v. Georgia* (1832)](#case-worcester-v-georgia)` in the index of cases by topic, goes to the page that holds the box, as the essays in git place it. A back matter page says `part: back-matter` in its front matter. A page that also says `generated: cases-by-topic` shows its own text followed by the index of cases by topic, built when the page is shown from the Topics parts of every essay's case boxes: the newest published versions on the public page, the newest saved versions in the workspace (`site/src/lib/essays/case-topics.ts`, mirrored for print in `pdf/pipeline/case-topics.mjs`).
- **Public copy.** `/published-essays.json` lists every listed publication with its SHA-256, and `/published-essays/<id>/<number>.md` serves each as Markdown, exactly as saved. Held-back publications are not listed.
- **Git copy.** A scheduled GitHub workflow (hourly, and on demand) reads that list, downloads new versions, checks their SHA-256 and commits each to a separate `published-essays` branch, one commit per version (`scripts/copy_published_essays.py`). It is a branch of its own, not `main`, because `main` accepts changes only by pull request with checks ([decision record 0008](decisions/0008-pull-requests-without-required-approval.md)) and a pull request opened by a workflow's own token does not start other workflows (GitHub Docs, "Triggering a workflow"). A copy branch can also be rewritten for a removal request without touching `main`'s history.
- **Removal.** If a nation asks for material to be removed ([docs/requests.md](requests.md)), a person with full access holds the publication back at once, with the reason recorded. Deleting the file itself means lifting the bucket lock for that removal, which is deliberate friction, and rewriting the copy branch.
- **Print and ebook.** The build will fetch the published essays it needs from the public copy and record each version's SHA-256 in the book's build record, so an edition can be rebuilt exactly. Until then it reads `content/essays/`.
- **Text from git comes in by itself.** Each site build bundles the essays in `content/essays/` and the back matter pages in `content/back-matter/`. The first essay page or workspace page a Worker serves after a build compares them with the bucket (`site/src/lib/server/essay-git-sync.ts`). An essay new to the bucket is saved as its first version. Changed git text is saved as a new version when nothing was edited on the website since git's text last came in. Otherwise the two are merged paragraph by paragraph (`site/src/lib/essays/merge.ts`): a paragraph changed on one side takes that change, and the git text is kept beside the versions (`essays/<id>/git/<hash>.md`, named in the version's note) so the next merge starts from it. When both sides changed the same paragraph, nothing is saved; the workspace Essays page lists the essay, and a person with full access edits the paragraph or saves the git text as a new version ("Use the git text"). Versions from git name nobody and are never published by themselves: readers see them once someone with full access publishes (Trevor, 2026-11-22). Once the Foundations chapters settle, `content/essays/` will hold a note pointing to the copy branch.

## Version history

| Layer | What it holds | Where | Kept |
| --- | --- | --- | --- |
| Saved versions | A full copy of the essay each time someone saves, with who, when and a note ("Sent to advisors") | Markdown in the private bucket under `essays/<id>/versions/`; a row in `essay_versions`; an activity log entry | For good |
| Publications | Which saved version readers see, and since when | A row in `essay_publications` pointing at a saved version | For good; can be held back from readers |
| Live history (to be built) | Every keystroke while several people edit together | The draft's Durable Object | While the draft is open |

Any two saved versions can be compared, paragraph by paragraph and word by word within a changed paragraph, and any one can be restored by someone with full access (restoring saves it as a new version, so nothing is lost). Each version is dated with its number and the moment it was saved or published, for example "Nov. 22, 2026, 10:30 p.m. PT", not added to the content version number (lead author, Nov. 22, 2026). This is the history of the project's **own** writing; the history of documents the project **cites** is a separate record ([decision record 0018](decisions/0018-document-version-history.md)).

**Untouched text stays untouched.** When the editor writes an essay back to Markdown, it copies every top-level block that did not change exactly as it was, so a save changes only the paragraphs that were edited and comparisons show real changes only. With no edits the file comes back identical; this is tested for every essay in `content/essays/` (`site/tests/essay-document.test.ts`).

## Built so far and still to build

Built (pull request "Edit essays on the website"): the editor with its Markdown view and preview, saved versions in the bucket, conflict protection, compare, restore, publish, hold back, the public essay pages and their version lists, the public copy, the hourly git copy, and bringing in the git text. Then (pull request "Edit essays in place"): the essay page's bar, the With drafts view, and editing in place with saving by itself.

Next, in this order:

1. **Live co-editing.** One SQLite-backed Durable Object per draft, holding a Yjs document, with hibernating WebSockets and presence (who is in the draft and where), so several people can type at once. Access is checked by the Worker at connection and again during the session (comment-level connections can read but their edits are dropped). Cloudflare's `y-partyserver` (ISC) or the `yjs` package on the WebSocket Hibernation API directly; the Durable Object class is exported from a small second Worker or after the SvelteKit build, settled when built.
2. **Comments** on drafts in D1, anchored with Yjs relative positions and the quoted words, so they follow the text as it changes. Sign-offs stay in `reviews`.
3. **Print and ebook from the public copy**, recording each essay's SHA-256 in the build record.
4. **Figures and media records**, including images in the Typst and EPUB builds.
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
- ProseMirror, `prosemirror-markdown`, [github.com/ProseMirror/prosemirror-markdown](https://github.com/ProseMirror/prosemirror-markdown); markdown-it, `markdown-it-container` and `markdown-it-ins`, [github.com/markdown-it](https://github.com/markdown-it).
- Tiptap, "Pricing," [tiptap.dev/pricing](https://tiptap.dev/pricing).
- The lead author's requests: project threads "Plan collaborative editing for the website" (Nov. 21 and 22, 2026), "Build the Foundations part with strong sources" and "Edit essays on the website" (Nov. 22, 2026).
