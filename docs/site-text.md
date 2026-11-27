# Site text

How the words written into the website's own pages (headings, labels, button names, sentences) are edited from the website, published, and built into the site. Trevor Goldsmith asked for it on Nov. 24, 2026, after a label on the Sponsor page had to be renamed through a code change: "We really should make it so we can edit any part of the website from the website, for text purposes." He approved the design and mockups (project files, `design/site-text-editing/`) the same day. The decision is [decision record 0054](decisions/0054-edit-the-site-text-from-the-website.md); maintainers' notes are in [site/COLLABORATION.md](../site/COLLABORATION.md#site-text).

Everything here is project design unless a source is cited.

## In short

- **Every fixed piece of text in the site's components can be edited in place.** A step in the build names each one; nobody has to move text out of the code by hand. On Nov. 24, 2026 the step found 3,952 pieces of text and 305 labels that readers do not see (button names, field hints, picture descriptions) in 280 files.
- **The words in the code stay the built-in default.** Edits live in the database with every version kept, and "Reset to built-in text" brings the default back.
- **Publishing rebuilds the site** with the new words baked in, so readers see them a few minutes later and nothing extra runs when a page is served.
- **Who may edit is set on the Access page**, like any document: full access publishes, contribute access writes drafts.

## How text gets a name

`site/src/lib/site-text-markers.ts` runs as a Svelte preprocessor while the site builds (`site/vite.config.ts`). For each `.svelte` file under `site/src` it reads the markup and:

- wraps each run of fixed text in `<site-text data-text="name">`, an element styled `display: contents` so the page looks and reads exactly as before;
- gives each `<option>` with fixed text a `data-text` attribute instead, since an option may hold only text;
- lists fixed `aria-label`, `title`, `placeholder` and `alt` values in a `data-text-attributes` attribute on their element;
- leaves alone text inside `script`, `style`, `pre`, `code`, `kbd`, `samp`, `noscript`, `template`, `textarea` and drawings (`svg`), text with `{…}` expressions in it, and the editor's own box (`SiteTextEditor.svelte`);
- substitutes the published words where there are any, escaped, so a reader's page holds only the published words. A page's `<title>` gets the substitution but no marker, because Svelte allows no attributes on it.

A piece's name is ten characters made from a hash of its file, the attribute (if any), its words and which occurrence of those words it is in the file. If a later code change rewords a piece that has an edit, the name changes and the edit stops matching. The site text list in the header then shows the edit under "No longer on the site", with the page it was made on, so the new wording can be edited there again or the edit let go (see [The site text list](#the-site-text-list)).

Out of scope: text with its own editor or from the research records (essays, nation pages, glossary entries), other than the parts of case and law boxes described under [Record text](#record-text), and text written inside program code, such as role names in `permissions.ts`, section headings passed to a component, or sentences built in a script. Wrapping that kind of text by hand is the next stage.

## Record text

The prose parts of a case's or a law's box (Background, Question, Holding, Summary and Treatment) come from the case's or law's research record in `content/sources/`, not from a component. Trevor Goldsmith found on Nov. 24, 2026 that the Indian Removal Act's Summary could not be selected in Edit mode, because the site text editor did not cover record text. Since then each of those parts is one more piece of site text, on every law, treaty, executive order and case page that shows it:

- **Its name** comes from the record and the part (`src/lib/record-text.ts`), not from its words, so an edit made on the website keeps showing after the record's own words change in the repository. "Reset to built-in text" goes back to the record's words, which are the built-in words.
- **Editing** works as for any other piece: in Editing, the part has a dotted outline, and clicking it opens a larger box with the part's Markdown, citations included (`[@key, pinpoint]`). Enter starts a new line, and Ctrl or Command with Enter saves. A draft is drawn in place; its citation numbers start again at 1 until the site is rebuilt.
- **Publishing** is the same Publish button and rebuild. The build puts the published words into the records before any page is built (`src/lib/server/record-text-build.ts`), so the case or law page and every essay box built from the record show them.
- **Quotations** stay in the records only. They must match the official report word for word, which is checked against the report, not on a page.
- **Not yet:** adding a part a record does not have, and copying published words back into the record files in the repository. Until then the repository keeps the built-in words, and each edited part's history page names its record's file.

## Editing

The header's mode buttons (from "Move editing controls into the header", PR #421) gain Editing on every page for anyone with contribute or full access to the site text. On a page that offers its own controls, such as an essay or the Sponsor page's text, the two are joined: one Editing button turns on the page's own editor, where the person may use it, and site text editing for the rest of the page (`site/src/lib/join-page-controls.ts`).

While editing, each piece of text has a faint dotted underline, and a label readers do not see shows a dotted outline when pointed at. Clicking a piece, or pressing Enter on it, opens a box beside it, or a sheet at the bottom on a phone, with the words, the built-in words when they differ, and buttons for Reset to built-in text, History, Cancel and Save draft. A saved draft shows on the page at once, for people with access only, with the project's draft color. Drafts show while the drafts switch is on.

## Publishing

Someone with full access sees Publish in the header, with how many drafts wait. It opens the list of drafts (page, old words, new words), each with an undo button, and a Publish button. Publishing records which version of each piece went live, in one publication, and asks Cloudflare to rebuild the site; the list then says "Live in a few minutes". A publication can be undone as a whole from the same list, which publishes the earlier words again as a new publication.

How the words reach readers:

1. Publish calls the website's deploy hook (the secret `SITE_REBUILD_HOOK_URL`). Cloudflare skips a duplicate build if the hook fires again before a build starts, so several publications in a row cost one build ([Deploy Hooks for Workers Builds](https://developers.cloudflare.com/changelog/post/2026-04-01-deploy-hooks/), Cloudflare changelog, April 1, 2026).
2. A build on Cloudflare (which sets `WORKERS_CI=1`, per [Workers Builds configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)) reads the published words from the live site at `/site-text/published.json` and bakes them in (`site/src/lib/server/site-text-build.ts`). If the site cannot be read after four tries, the build stops, so a deploy never takes published words away. A 404 means the live site predates this feature. Checks on GitHub and builds on a computer use the built-in words; `SITE_TEXT_FILE` names a file of published words to try on a computer.
3. Each build records the newest publication it carried. The hourly scheduled run (`/site-text/scheduled`) asks for another build if a newer publication has waited more than 30 minutes, up to three times for one publication, and records each ask.

Cost: a full local build took 2 minutes 31 to 37 seconds on a 4-processor machine (measured Nov. 24, 2026). Workers Builds on the paid plan include 6,000 build minutes a month, then $0.005 a minute ([Workers Builds limits and pricing](https://developers.cloudflare.com/workers/ci-cd/builds/limits-and-pricing/)), so 20 separate publications a day would add about $3 a month at most (20 × 5 minutes × 30 days × $0.005).

Until the deploy hook is set, published words go live with the next code change, and the Service checks page says so.

## Who can edit

Site text is one more kind of document on the Access page (decision record [0023](decisions/0023-permission-levels-per-document.md)), granted as a whole.

| Level | What it allows | Who has it by default |
| --- | --- | --- |
| Full | Edit, publish, undo a publication | Lead author |
| Contribute | Edit; drafts wait for someone with full access | Editors |
| Comment | See a piece's history page | Advisors, co-authors |
| No access | Nothing | Everyone else |

Every save and publication is checked on the server and written to the sealed activity log.

## Where it lives

- `site_text_versions`: every version of every piece, with the built-in words and file at the time, the page it was made on, who and when. Versions are never changed or deleted. Empty words mean "back to the built-in words".
- `site_text_publications` and `site_text_published`: each publication, who made it, what it undid, and which version of each piece it put live.
- `site_text_rebuilds`: each time the site asked for a rebuild, and the answer.

Migration `site/migrations/20261124T0119_add_site_text.sql` adds them and lets `access_grants` name the site text.

## The site text list

Trevor Goldsmith asked on Nov. 26, 2026 what the workspace's Site text page did and whether it was needed. It was a second view of what in-place editing already does, and nobody had used it (the live database held no site text versions or publications that day). He chose to fold it into in-place editing and approved the mockup the same day (project files, `design/site-text-fold/`). The page and its workspace menu entry are gone; what only it did now lives in one list in the header, opened by Publish or by History (`src/lib/components/SiteTextEditor.svelte`, data from `/workspace/site-text/list.json`):

- **Changes**: the drafts waiting to be published, each with an undo button, and Publish for someone with full access.
- **Published**: the three newest publications, who made each and when, and whether the newest is live yet. Someone with full access can undo the newest (`/workspace/site-text/undo`).
- **No longer on the site**: shown only when there is something in it. Each edit whose text a later code change reworded, with what it said and the words built in when it was made. A pencil opens the page it was made on in Editing, to edit the new wording; the cross lets the edit go (`/workspace/site-text/let-go`), which saves a version with no words so the edit leaves the list. Nothing on the site changes, since no page shows that text any more. The mockup showed what the page says now; the code cannot tell which new piece replaced a renamed one, so the list shows the old built-in words instead.

Each piece keeps its own page, `/workspace/site-text/<name>`, opened from the History button in the editing box: where it is, its built-in words, an edit box and its whole history, from which any version can be restored as a new draft.

## Later stages

1. Text written inside program code, wrapped by hand in a `siteText()` call, starting with the header, sidebar and section headings.
2. Review requests and comments on site text, reusing the essay review pieces.
