# 0054. Edit the site text from the website, and rebuild the site to publish it

- **Status:** Accepted
- **Date:** 2026-11-24
- **Extends:** decision records [0021](0021-edit-drafts-in-the-browser-keep-essays-in-the-bucket.md) and [0023](0023-permission-levels-per-document.md)

## Context

The words written into the website's own pages (headings, labels, button names, short sentences) could only be changed through a code change and a pull request. On Nov. 24, 2026 a label on the Sponsor page was renamed from "Native nations with their own page" to "Identified Native Nations" that way, and Trevor Goldsmith asked: "We really should make it so we can edit any part of the website from the website, for text purposes. For example, that last part I could have done on my own." Most public pages are built ahead of time as fixed files (`site/src/routes/+layout.server.ts` sets `prerender = true`), so words kept in the database cannot reach them by themselves. Trevor approved the design and its mockups (project files, `design/site-text-editing/`) on Nov. 24, 2026.

## Decision

- A build step names every fixed piece of text, and every fixed `aria-label`, `title`, `placeholder` and `alt`, in the site's Svelte components, and marks it on the page so an editor can find it. The words in the code stay the built-in default; nobody moves text out of the code by hand. Text written inside program code is a later stage.
- Edits are kept in D1 as versions that are never changed or deleted, beside publications that say which version of each piece went live. Resetting to the built-in words is a version with no words.
- Site text is one more kind of document on the Access page. Full access publishes; contribute access writes drafts; the defaults follow decision record 0023.
- Editing happens in place on any page, from the header's Editing mode, and a page's own editor and the site text share that one button.
- Publishing calls the website's Workers Builds deploy hook, and the build bakes the published words in. A build on Cloudflare stops if it cannot read the published words, so a deploy never undoes them. The hourly scheduled run asks again for a build that seems to have been missed.

## Consequences

- Readers see published words a few minutes after Publish, not at once, and no work is added to serving a page. Rewriting each page as it is served was weighed: it would show words at once, but would run the Worker for every page, miss button labels and text inside code, and could flicker back to the default as a page starts up. It can be added later for page text on top of the same names and tables.
- Each publication costs one build, about 2.5 minutes locally; Cloudflare includes 6,000 build minutes a month on the paid plan and charges $0.005 a minute after ([Workers Builds limits and pricing](https://developers.cloudflare.com/workers/ci-cd/builds/limits-and-pricing/)).
- The deploy hook is a web address, so it is a secret (`SITE_REBUILD_HOOK_URL`) rather than a binding. Until it is set, published words go live with the next code change.
- When a code change rewords a piece of text that has an edit, the edit stops matching and is listed as no longer on the site, so the newer wording in the code wins until someone edits it again.

## Sources

- Cloudflare, [Deploy Hooks for Workers Builds](https://developers.cloudflare.com/changelog/post/2026-04-01-deploy-hooks/) (changelog, April 1, 2026).
- Cloudflare, [Workers Builds configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/) (the `WORKERS_CI` build variable).
- Cloudflare, [Workers Builds limits and pricing](https://developers.cloudflare.com/workers/ci-cd/builds/limits-and-pricing/).
- [Site text](../site-text.md), the design in full.
