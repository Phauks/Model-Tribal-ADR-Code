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

A piece's name is ten characters made from a hash of its file, the attribute (if any), its words and which occurrence of those words it is in the file. If a later code change rewords a piece that has an edit, the name changes and the edit stops matching. The workspace's Site text page then lists the edit under "No longer on the site", so the new wording can be edited again or the edit let go.

Out of scope: text with its own editor or from the research records (essays, nation pages, glossary entries, cases, laws), and text written inside program code, such as role names in `permissions.ts` or sentences built in a script. Wrapping that kind of text by hand is the next stage.

## Editing

The header's mode buttons (from "Move editing controls into the header", PR #421) gain Editing on every page for anyone with contribute or full access to the site text. On a page that offers its own controls, such as an essay or the Sponsor page's text, the two are joined: one Editing button turns on the page's own editor, where the person may use it, and site text editing for the rest of the page (`site/src/lib/join-page-controls.ts`).

While editing, each piece of text has a faint dotted underline, and a label readers do not see shows a dotted outline when pointed at. Clicking a piece, or pressing Enter on it, opens a box beside it, or a sheet at the bottom on a phone, with the words, the built-in words when they differ, and buttons for Reset to built-in text, History, Cancel and Save draft. A saved draft shows on the page at once, for people with access only, with the project's draft color. Drafts show while the drafts switch is on.

## Publishing

Someone with full access sees Publish in the header, with how many drafts wait. It opens the list of drafts (page, old words, new words), each with an undo button, and a Publish button. Publishing records which version of each piece went live, in one publication, and asks Cloudflare to rebuild the site; the list then says "Live in a few minutes". A publication can be undone as a whole from the Site text page, which publishes the earlier words again as a new publication.

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
| Comment | See the Site text page and its history | Advisors, co-authors |
| No access | Nothing | Everyone else |

Every save and publication is checked on the server and written to the sealed activity log.

## Where it lives

- `site_text_versions`: every version of every piece, with the built-in words and file at the time, the page it was made on, who and when. Versions are never changed or deleted. Empty words mean "back to the built-in words".
- `site_text_publications` and `site_text_published`: each publication, who made it, what it undid, and which version of each piece it put live.
- `site_text_rebuilds`: each time the site asked for a rebuild, and the answer.

Migration `site/migrations/20261124T0119_add_site_text.sql` adds them and lets `access_grants` name the site text.

## The workspace page

`/workspace/site-text` lists drafts waiting (with Publish and undo for full access), the publications, and every piece of text in the site, searchable and filtered by edited, drafts and no longer on the site. Each piece has its own page with where it is, its built-in words, an edit box and its whole history, from which any version can be restored as a new draft.

## Later stages

1. Text written inside program code, wrapped by hand in a `siteText()` call, starting with the header, sidebar and section headings.
2. Review requests and comments on site text, reusing the essay review pieces.
