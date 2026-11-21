# Editing on the website

How co-authors and contributors will write and edit essays and other content
on the website once it is running: the editor, working on the same draft at
the same time, comments, version history, images and tables, and how a
finished draft becomes part of the book. This is a **proposal**
([decision record 0021](decisions/0021-edit-drafts-in-the-browser-publish-by-pull-request.md),
status Proposed). Nothing here is built yet, and no code will be written until
the lead author approves the approach.

Everything here is project design unless a source is cited. Statements
labeled "measured" come from the round-trip test described under
[Evidence](#evidence). Prices and limits are as Cloudflare published them on
Nov. 21, 2026.

## In short

- **Work in progress lives in Cloudflare; finished text lives in git.**
  Drafts, comments, versions and images never touch GitHub (see
  [Why the finished text stays in git](#why-the-finished-text-stays-in-git-not-in-d1-or-r2)).
- **The Markdown files in git stay the published text**
  ([decision record 0004](decisions/0004-content-as-plain-files.md)). The
  website gets a drafting room, not a second copy of the book. When a draft is
  ready, the website opens a pull request with the changed Markdown, and the
  usual checks and merge publish it.
- **Our own small editor**, built on ProseMirror, offers exactly what the
  print book, the ebook and the website can all show: headings, paragraphs,
  **bold**, *italic*, underline, links, lists, quotations, tables, figures
  (an image with a caption, credit and alternative text), citations, glossary
  links, placeholders and provision alternatives. Nothing else can be typed or
  pasted in, so nothing a writer does can break the print build.
- **One Durable Object per draft** lets several people be in the same draft at
  once: they see each other's cursors and names, their edits merge as they
  type (with Yjs), and comments appear for everyone at once. When nobody is
  typing, the object sleeps and costs nothing.
- **Comments** are attached to a stretch of text and follow it as the text
  changes. Sign-offs keep using the existing review records.
- **Version history** has three layers: every keystroke inside the draft
  room, named versions a writer saves ("Sent to advisors"), and published
  versions, which are git commits on the content version track.
- **Cost**: on the Workers Free plan this fits inside the daily free
  allowance for a small writing team; on the Workers Paid plan it fits inside
  the included usage, so the cost is the plan's $5 a month minimum. A hosted
  suite such as Collabora Online or Tiptap's paid platform is not needed.

## What writers can do

Writers have asked for underline, italics, bold, images, tables and "other
rich media" (lead author's request, Nov. 21, 2026). The editor offers each
feature only if all three editions can show it ("to be added" means the
reader is ready but a build does not render it yet):

| Feature | In Markdown | Website | Print (Typst) | Ebook (EPUB) |
| --- | --- | --- | --- | --- |
| Bold, italic | `**bold**`, `*italic*` | yes | yes | yes |
| Underline | `++underlined++` (markdown-it-ins) | to be added, styled so it is not mistaken for a link | to be added (Typst's `underline`) | to be added |
| Links | `[text](https://...)` | yes | yes | yes |
| Headings, lists, quotations | standard Markdown | yes | yes | yes |
| Tables | pipe tables | yes, with the site's table component | yes | yes |
| Citations, glossary links, placeholders, alternatives | the project's syntax (docs/citation-style.md, docs/terminology.md) | yes | yes | yes |
| Figures | `::: figure <media id>` with the caption inside | yes | to be added to the Typst writer | to be added |
| Footnotes written by hand | `[^1]` | yes | yes | yes (not yet tested in the editor) |
| Audio, video, maps, embedded pages | a figure whose media record has a print stand-in | yes | the stand-in: a still image or a caption with a short link | stand-in, or the file where the store accepts it |

Not offered: font choices, colors, text size, alignment other than table
columns, raw HTML, and anything pasted from Word that has no row in the
table above. Pasting keeps the words and the features in the table and drops
the rest (project choice: the book's look is set once, in the print and site
styles).

**Underline needs a decision.** The site underlines every link and uses a
dotted underline for glossary terms ([site/DESIGN.md](../site/DESIGN.md),
"Dotted glossary links" and "Color is never the only cue"), and the Indigo
Book uses italics, not underlining, for case names and titles (docs/citation-style.md).
Underlined body text can therefore look like a broken link to a reader. The
proposal keeps underline, as asked, and shows it on the website with a
thicker, offset line in the text color; the style guide would say when to use
it (for example, for emphasis inside quoted law that is itself underlined).

### Images and other media

An uploaded image goes to the private `sourceDocuments` bucket under
`media/`, checked by its first bytes like request uploads
([site/COLLABORATION.md](../site/COLLABORATION.md), "Uploads"). It is never
committed to git, for the same reason nations' seals are not: a public history
cannot be fully rewritten if someone later asks for removal
([official-images.md](official-images.md), "Storage").

What goes into git is a **media record** (`content/media/<id>.yaml`), the same
pattern as a source record: the alternative text (required before a draft can
be submitted), the credit, where it came from, the permission to use it, the
SHA-256 of the file and the file's path in the bucket. Material contributed by
a person also carries the filing id and the shared consent fields from the
contributions work (pull request #57, `docs/contributions.md`); a draft that
uses contributed material without a filing cannot be submitted. The website,
print and ebook builds read the file from the bucket by that path.

## Why the finished text stays in git, not in D1 or R2

The lead author asked (Nov. 21, 2026) why the text should go to GitHub at all,
rather than living in the site's D1 database or R2 bucket. Three ways were
compared (project analysis):

| | Git holds the finished text (proposed) | D1 or R2 holds everything | Both, kept in sync |
| --- | --- | --- | --- |
| Drafts, comments, named versions, images | Cloudflare (Durable Object, D1, R2) | Cloudflare | Cloudflare |
| Finished, approved text | Markdown in git | Rows in D1 or files in R2 | Both, with one copied to the other |
| Public record of every change | Git history, readable by anyone, as the charter's legislative-style history expects ([decision record 0004](decisions/0004-content-as-plain-files.md)) | Would have to be built: a public change log page and diff viewer | Git, if the copy never fails |
| Checks before publishing | The existing ones: record lint, schema validation, site and print builds on every pull request | Would have to be rebuilt inside the Worker | Run twice, or only on one side |
| Website build | Unchanged: the site is built ahead of time from the files (about 981 pages) | The build would read D1 or R2. Workers Builds' automatic token has no D1 permission ([site/COLLABORATION.md](../site/COLLABORATION.md), "Database"), so it needs a new Cloudflare token | Unchanged |
| Print and ebook build | Unchanged: GitHub Actions reads the files | Needs a Cloudflare token inside GitHub, which [decision record 0006](decisions/0006-secrets-only-in-cloudflare.md) rules out, or moving the print build to Cloudflare | Unchanged |
| Rebuilding an exact edition later | Check out the commit or tag | Needs dated snapshots kept for good. D1's own point-in-time recovery reaches back 30 days on the Paid plan and 7 on Free (Cloudflare, "D1 limits"); R2's bucket documentation lists lifecycle rules and bucket locks but no object versioning (Cloudflare, "R2 buckets," as read Nov. 21, 2026) | Check out the commit |
| Research threads and Claude | Work on the files as now (about 5,900 files under `content/`, measured) | Would need tools to read and write the database | Two places to edit, so changes can collide |
| Copies kept elsewhere | Every clone of the repository and GitHub itself | Only Cloudflare, unless exports are scheduled | Both |
| Private material | Never enters git; restricted or contributed material stays in R2 under the consent rules | Same | Same |
| Cost | Nothing new | D1 and R2 free allowances are ample at this size | Same as git |
| What it adds | A GitHub App, or a person, to open the pull request | Instant publishing from the website, no GitHub step | The most moving parts |

**Recommendation (project analysis):** keep the split the proposal already
makes. Everything still being worked on lives in Cloudflare and never touches
GitHub: the draft text, every live change, named versions, comments, uploads
and images. Only the text that is approved for the book goes into git, once
per submission, where the checks, the public history and the print build
already are. Moving the finished text to D1 or R2 would save the pull request
step, but the project would then have to rebuild its checks, its public change
history and its edition snapshots, and give GitHub a Cloudflare credential for
the print build. Keeping both in sync would leave two places that can
disagree.

If the pull request step turns out to slow writers down, the website can
publish an essay to the live site straight from D1 as a "preview" and still
send it to git for the book; that can be added later without changing this
design.

## Working on the same draft at the same time

### Choices considered

| Option | What it is | Fit |
| --- | --- | --- |
| **Collabora Online** | LibreOffice in the browser; documents are ODF or DOCX files, served by a separate Collabora server (its free developer edition ships as a Docker image) through the WOPI protocol (Collabora, "CODE Docker image," seen as a search result, not read in full). | Poor. It needs a server that cannot run on Cloudflare Workers, its documents are word-processor files rather than our Markdown, and writers could use any formatting, which the print build would then have to undo. |
| **Tiptap platform** | Hosted editor services on top of the open-source Tiptap editor. Its pricing page says "Collaboration, and document history require Tiptap Platform's Cloud documents"; the lowest paid plan is $49 a month (Tiptap, "Pricing"). | Not needed. The open-source editor is usable without it, and its comments and history depend on Tiptap's cloud. |
| **Lexical** | Meta's editor. Collaboration is documented mainly for React; "`y-websocket` is the only officially supported Yjs connection provider" (Lexical, "Collaboration with React"). | Possible, but the site is Svelte and we would be off the documented path. |
| **ProseMirror + Yjs on a Durable Object** (proposed) | ProseMirror is the open-source editor toolkit Tiptap is built on; `prosemirror-markdown` reads and writes Markdown; Yjs merges edits from several people (a CRDT) and has a ProseMirror binding (`y-prosemirror`). | Good. All MIT or ISC licensed, runs in our Worker, and the round trip with our Markdown was measured (below). |
| **One writer at a time** | A draft is "checked out" to one person; others can read and comment. | Simplest, but it still needs a Durable Object or a database lease to hold the lock, and comments still need positions that survive edits. Kept as the fallback if live editing proves troublesome. |

### How it works

1. A signed-in person opens a draft at `/workspace/drafts/<id>`. The page
   loads the editor and connects a WebSocket to the Worker.
2. The Worker checks the session and the person's access level for that
   document (comment, contribute or full;
   [decision record 0023](decisions/0023-permission-levels-per-document.md))
   before passing the
   connection to the draft's Durable Object. The object is never reachable
   except through the Worker.
3. The object keeps the draft as a Yjs document in its own SQLite storage and
   sends each change to everyone connected. Names and cursors travel as Yjs
   "awareness" messages, so everyone sees who is in the draft and where.
4. Comment-level connections receive the text and can add comments; the
   object drops any text change they send. Contribute-level connections can
   edit and save named versions. Full access can also restore an earlier
   version, resolve or hide others' comments, and submit the draft.
5. Access is checked again on every named save and at least once a minute
   while edits arrive, so a removed or lowered grant takes effect during a
   session, not only at the next sign-in (OWASP, *Authorization Cheat Sheet*,
   as cited by the permissions work). When a grant changes, the room is also
   told at once and drops or downgrades that person's connection.

The checks use the permission tiers from pull request #63: the Worker calls
`requireDocumentLevel(event, database, subject, minimum)` before handing over
a connection; the room uses the pure `documentAccess(person, subject,
grants)` for its later checks; and `onAccessChanged(listener)` in
`site/src/lib/server/access.ts`, which fires when a grant is set or ended,
tells the room about a change. A grant for a whole kind (all essays) also
covers a draft of an essay that has no file yet; its subject identifier is the
planned file id.

The proposed library is `y-partyserver`, maintained by Cloudflare in the
PartyKit repository (ISC license). Its `YServer` "is a class that extends
`DurableObject`", and it saves through `onLoad` and `onSave` hooks, where
"`onSave` is called periodically after the document has been edited, and
when the room is emptied" (Cloudflare, `y-partyserver` README). Its base
class, PartyServer, supports the WebSocket Hibernation API with
`static options = { hibernate: true }` (PartyServer README). Two gaps, to be
confirmed in the first build step: the `y-partyserver` README does not say
whether `YServer` keeps that option, and lists "readonly mode" as not yet
done, so the comment-only rule in step 4 is our code. If the library does not
fit, the same design can use Cloudflare's WebSocket API directly with the
`yjs` package (or `y-durableobjects`, a smaller community library).

**The SvelteKit Worker and the Durable Object.** SvelteKit's Cloudflare
adapter writes the Worker's entry file, and a Durable Object class has to be
exported from that file. One community tool appends the export after the
build (`sveltekit-cloudflare-durable-objects`, a two-commit project, so
experimental). The other way is a small second Worker that holds only the
draft rooms, which the site's Worker reaches with a `script_name` binding.
Which one to use is settled in the first build step; either way the class is
declared with SQLite storage in `wrangler.jsonc` under `exports`, Cloudflare's
current form for Durable Object classes (Cloudflare, "Durable Object class
exports").

### Offline

Workspace pages are not cached today
([site/COLLABORATION.md](../site/COLLABORATION.md)). Yjs can keep a copy of a
draft in the browser and merge it when the connection returns, so offline
drafting can be added later without a new design. It is left out of the first
version because it would mean storing unpublished drafts on shared or public
computers.

## Comments and reviews

- **Comments on drafts** are attached to a stretch of text using Yjs
  "relative positions", which keep pointing at the same words as text is added
  or removed around them (Yjs, "Relative positions," seen as a search result).
  Each comment also stores the quoted words, so if its text is deleted the
  comment is still readable, marked "text removed."
- A comment has a thread of replies, and is open, resolved or hidden. Hiding
  is for full access only and is recorded. Comments are workspace-only; none
  are public.
- **Sign-offs** stay in the existing `reviews` table: Approved, Changes
  requested or Comment on a published version
  ([site/COLLABORATION.md](../site/COLLABORATION.md), "Reviews and
  sign-offs"). A draft's comments are working notes; a review is the record of
  who approved which version.
- Comments live in D1, not in the Durable Object, so the workspace can list
  "open comments on my drafts" without waking every room. The room sends new
  comments to everyone connected.

## Version history

| Layer | What it holds | Where | Kept |
| --- | --- | --- | --- |
| Live history | Every change, merged | The draft's Durable Object (Yjs updates, compacted into a snapshot as they pile up) | While the draft is open |
| Named versions | A full copy of the draft as Markdown when a writer saves a version ("Sent to advisors"), with who, when and a note | Markdown in the private bucket under `drafts/<id>/versions/`; a row in D1; an `events` row | For good, unless the lead author deletes a draft |
| Published versions | What readers and the book see | git commits from merged pull requests, numbered on the content version track ([decision record 0003](decisions/0003-three-version-tracks.md)) | For good |

Any named version can be compared with any other, or with the published text,
and restored by someone with full access (restoring creates a new version, so
nothing is lost). This is the history of the project's **own** writing. The
history of documents the project **cites**, such as compacts and
constitutions, is a separate record ([decision record 0018](decisions/0018-document-version-history.md)).

## From draft to book

1. Someone with full access chooses **Submit for review**. The Worker writes
   the Markdown and any new media records, opens a branch named after the
   draft, commits, and opens a pull request that names the draft, its writers
   and its open comments.
2. The pull request runs the usual checks (record lint, site build, print
   build). Merging publishes it, as with every other change.
3. The draft's status becomes "submitted", then "published" when the pull
   request merges.

**Untouched text stays untouched.** The essays are hand-wrapped at about 76
characters. Written back naively, an essay changes on 16 to 85 percent of its
lines even when nobody edited it (measured), which would bury real edits in
the pull request. The proposal writes back only the paragraphs, list items and
tables that changed and copies every other block exactly as it was; with no
edits the file comes back identical, and one edit changes only that paragraph
(measured). Changed paragraphs will be wrapped to the same width before
writing (not yet built).

**If the published file changed while the draft was open**, the room is told
when it next loads, and shows which paragraphs changed underneath it, so a
writer can accept them before submitting.

**Opening the pull request** needs the Worker to act on GitHub. The proposal
is a GitHub App installed only on this repository with permission to write
contents and pull requests, its private key stored as a Cloudflare secret
([decision record 0006](decisions/0006-secrets-only-in-cloudflare.md));
a Worker authenticating as a GitHub App with its key in a Worker secret is a
documented pattern (gr2m, `cloudflare-worker-github-app-example`). The
alternative is that the website only produces the Markdown and a person opens
the pull request, which keeps all write access to GitHub off the website.

## Credit

The room records who wrote or changed each named version and who commented,
so a list of contributors can be produced for each essay. Everyone who edits
a draft has a `people` row; the name to print, the credit form (name, name
and nation, role, pseudonym or none) and whether to be credited in the book
and on the website come from the contributor profile being designed in the
thread "Design contributor registration and profiles"
(`docs/contributor-profiles.md`, decision record 0022, in progress). The
editor reads the version of the profile the person last **confirmed**, at the
moment a draft is submitted, rather than copying it or reading fields the
person may still be editing.

## Data

New D1 tables (a later migration; names to be settled with the permission
tiers work, which adds migration `0002`):

| Table | Holds |
| --- | --- |
| `drafts` | One row per draft: the document kind and identifier (the planned file id for a new essay), the published commit it started from, status (drafting, submitted, published, abandoned), the pull request number. |
| `draft_versions` | Named versions: who, when, note, SHA-256 of the Markdown, its path in the bucket. |
| `draft_contributions` | Who wrote, edited or commented on a draft, for credits. |
| `comments` | Comment threads: the anchor (Yjs relative positions and the quoted words), author, replies, status. |
| `media_uploads` | Uploaded files waiting to become media records. |

The draft text itself lives in the Durable Object's own storage, and named
versions in the private bucket. Saving a named version, restoring one,
submitting, and resolving or hiding a comment each add an `events` row; the
thousands of small live changes do not.

## Cost

Durable Objects run on both Workers plans; the Free plan can use only the
SQLite storage the proposal uses (Cloudflare, "Durable Objects pricing").

| | Workers Free | Workers Paid |
| --- | --- | --- |
| Requests (connections, plus incoming WebSocket messages counted 20 to 1) | 100,000 a day | 1 million a month included, then $0.15 a million |
| Duration (only while running, not while hibernating) | 13,000 GB-s a day | 400,000 GB-s a month included, then $12.50 a million GB-s |
| Storage | 5 GB in total | 5 GB-month included, then $0.20 a GB-month |
| Minimum | none | $5 a month |

Source: Cloudflare, "Durable Objects pricing" and "Durable Objects limits";
"100 WebSocket incoming messages would be charged as 5 requests."

**Estimate (project analysis).** Three people writing together for two hours,
each sending about one change a second, send about 21,600 messages, billed as
about 1,080 requests. Each object is billed at 128 MB of memory, so even if it
never hibernated, two hours is 7,200 s × 0.125 GB = 900 GB-s, about 7 percent
of the Free plan's daily allowance; with hibernation it is far less. A draft
the size of the longest essay takes about 186 KB as a shared document
(measured), so 5 GB holds thousands of drafts. D1 rows and bucket storage
for named versions are small next to the limits already in use. The other
options cost more: Tiptap's platform starts at $49 a month (Tiptap,
"Pricing"), and Collabora needs a server of its own.

A Durable Objects spending limit can be set on the Paid plan so a fault cannot
run up charges (Cloudflare, "Durable Objects pricing," "Control usage
costs").

## Building it, in order

Each step is a separate pull request, after the lead author approves this
proposal.

1. **Editor schema and Markdown bridge**, shared by the site and the print
   build, with a check that every content file comes back identical. Settles
   how the Durable Object is exported from the SvelteKit Worker.
2. **Draft rooms**: the Durable Object, presence, named versions,
   `/workspace/drafts`.
3. **Comments** on drafts.
4. **Submit for review** as a pull request (or Markdown download, per the
   decision above).
5. **Figures and media records**, including images in the Typst and EPUB
   builds.
6. Later: suggested changes (tracked changes), offline drafting, wrapping of
   changed paragraphs if not done in step 1.

## Open questions for the lead author

1. Approve the approach (ProseMirror + Yjs on Durable Objects, Markdown in git
   stays the published text)?
2. Should the website open pull requests itself through a GitHub App, or only
   produce the Markdown for a person to submit?
3. Keep underline, and if so, how should the style guide limit it?
4. Which Workers plan the account is on. Both work; the Paid plan removes the
   daily caps.

## Evidence

A round-trip test (Nov. 21, 2026) read the three essays in `content/essays/`
and a sample with every construct into a ProseMirror document using the same
Markdown reader options as the print build (`pdf/pipeline/markdown.mjs`),
plus underline and figures, wrote them back, and read them again (measured):

| Essay | Same after round trip | Lines changed by a plain rewrite | Untouched save identical | One edit | Shared-document size |
| --- | --- | --- | --- | --- | --- |
| Comparative model codes and frameworks | yes | 614 of 824 | yes | 6 lines out, 1 in | 74,571 bytes (1.45 × the Markdown) |
| Key cases digest | yes | 224 of 1,443 | yes | 1 out, 1 in | 186,294 bytes (1.54 ×) |
| Legal history timeline | yes | 599 of 701 | yes | 8 out, 1 in | 66,308 bytes (1.52 ×) |

The editor must read Markdown with the "typographer" option off, so it never
turns straight quotes into curly ones in the source; the builds still do that
when they render. Not yet tested: footnotes written by hand (no essay has
any), images in the print build, and the Durable Object itself. The test
script, sample and results are kept outside the repository in the project's
shared files at `spikes/editing/`, like the ebook test build (decision record
0011).

## Sources

- Cloudflare, "Pricing," *Durable Objects* (last updated Nov. 13, 2026),
  [developers.cloudflare.com/durable-objects/platform/pricing/](https://developers.cloudflare.com/durable-objects/platform/pricing/).
- Cloudflare, "Limits," *Durable Objects* (last updated Nov. 13, 2026),
  [developers.cloudflare.com/durable-objects/platform/limits/](https://developers.cloudflare.com/durable-objects/platform/limits/).
- Cloudflare, "Use WebSockets," *Durable Objects*,
  [developers.cloudflare.com/durable-objects/best-practices/websockets/](https://developers.cloudflare.com/durable-objects/best-practices/websockets/).
- Cloudflare, "Limits," *D1* (Time Travel duration),
  [developers.cloudflare.com/d1/platform/limits/](https://developers.cloudflare.com/d1/platform/limits/),
  and "Time Travel and backups" (last updated Nov. 6, 2026),
  [developers.cloudflare.com/d1/reference/time-travel/](https://developers.cloudflare.com/d1/reference/time-travel/).
- Cloudflare, "Buckets," *R2* (last updated Apr. 21, 2026),
  [developers.cloudflare.com/r2/buckets/](https://developers.cloudflare.com/r2/buckets/).
- Cloudflare, "Durable Object class exports" (last updated Sept. 28, 2026),
  [developers.cloudflare.com/durable-objects/reference/durable-objects-migrations/](https://developers.cloudflare.com/durable-objects/reference/durable-objects-migrations/).
- Cloudflare, PartyKit repository and `y-partyserver` README,
  [github.com/cloudflare/partykit](https://github.com/cloudflare/partykit);
  PartyServer README, version 0.5.6,
  [cdn.jsdelivr.net/npm/partyserver@0.5.6/README.md](https://cdn.jsdelivr.net/npm/partyserver@0.5.6/README.md).
- `y-durableobjects`, [npmjs.com/package/y-durableobjects](https://www.npmjs.com/package/y-durableobjects).
- Tiptap, "Pricing," [tiptap.dev/pricing](https://tiptap.dev/pricing);
  "We're open sourcing more of Tiptap" (June 6, 2025),
  [tiptap.dev/blog/release-notes/were-open-sourcing-more-of-tiptap](https://tiptap.dev/blog/release-notes/were-open-sourcing-more-of-tiptap).
- Lexical, "Collaboration with React,"
  [lexical.dev/docs/collaboration/react](https://lexical.dev/docs/collaboration/react).
- Collabora Productivity, "CODE Docker image,"
  [sdk.collaboraonline.com/docs/installation/CODE_Docker_image.html](https://sdk.collaboraonline.com/docs/installation/CODE_Docker_image.html)
  (seen as a search result on Nov. 21, 2026; not read in full).
- Yjs, "Relative positions," [docs.yjs.dev/api/relative-positions](https://docs.yjs.dev/api/relative-positions),
  and "ProseMirror" binding, [docs.yjs.dev/ecosystem/editor-bindings/prosemirror](https://docs.yjs.dev/ecosystem/editor-bindings/prosemirror)
  (both seen as search results; behavior of the binding measured in the test).
- ProseMirror, `prosemirror-markdown`, [github.com/ProseMirror/prosemirror-markdown](https://github.com/ProseMirror/prosemirror-markdown)
  (version 1.14.0 used in the test).
- markdown-it, `markdown-it-ins`, [npmjs.com/package/markdown-it-ins](https://www.npmjs.com/package/markdown-it-ins)
  (version 4.0.0 used in the test).
- jillesme, `sveltekit-cloudflare-durable-objects`,
  [github.com/jillesme/sveltekit-cloudflare-durable-objects](https://github.com/jillesme/sveltekit-cloudflare-durable-objects).
- gr2m, `cloudflare-worker-github-app-example`,
  [github.com/gr2m/cloudflare-worker-github-app-example](https://github.com/gr2m/cloudflare-worker-github-app-example)
  (its webhook signature check is incomplete; a pattern, not code to copy).
- OWASP Foundation, *Authorization Cheat Sheet*,
  [cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
  (cited by the permission tiers work; not read for this page).
- The lead author's request: project thread "Plan collaborative editing for
  the website," Nov. 21, 2026.
