# 0021. Edit essays on the website; keep them in the private bucket

- **Status:** Accepted
- **Date:** 2026-11-21 (revised and accepted 2026-11-22)

## Context

Co-authors and contributors who write essays need to write and edit on the website without learning git (lead author's request, Nov. 21, 2026; decision record 0004 already expected "a website comment path that does not require GitHub"). The text must still feed the website, the Typst print book and the custom ebook pipeline (decision records 0005, 0011), and every published change must keep a lasting, public history.

The first version of this record sent each finished essay to git by pull request. On Nov. 22, 2026 the lead author chose the R2 bucket as the home for essays with an automatic copy in git, and then asked for the Part I text to be edited on the website: "I am going to make so many changes to this. So many, that constant pr's are unfeasible," and "we should get this onto the website, that is the main place to edit."

## Decision

- **Essays live in the private R2 bucket**, from draft to publication. Every save is a new file under `essays/<id>/versions/` that is never overwritten (`If-None-Match: *`), listed in D1 with who saved it and why. Database triggers refuse changes to saved versions and publications. This narrows decision record 0004 for essays (and later commentary and other long prose written by people); research records stay as files in git.
- **Publishing** makes a saved version the essay's page. It runs the print reader's rule first (unknown citation keys and glossary links refuse publication). A publication can be held back from readers but never deleted.
- **Git keeps an automatic, read-only copy.** The website serves published versions publicly with their SHA-256; an hourly GitHub workflow copies new ones to a `published-essays` branch. No Cloudflare key goes into GitHub (decision record 0006) and the website gets no write access to GitHub. The print and ebook builds will fetch from the same public copy.
- **Editor:** our own, built on ProseMirror with a schema limited to what all three editions can render, read and written with `prosemirror-markdown` and the project's Markdown reader (with "typographer" off), plus a Markdown view. Writing back copies every block that did not change exactly as it was. The essay boxes for cases, quotations and analysis use `markdown-it-container` fences agreed with the Foundations chapters.
- **Working together:** in this first step, a save names the version it started from and a later conflicting save is refused and shown side by side. Live co-editing with one SQLite-backed Durable Object per draft holding a Yjs document, and comments anchored with Yjs relative positions, come next, with access checked using the levels of decision record 0023 (comment, contribute, full).
- Not chosen: essays in git by pull request (the first version of this record); the bucket with no git copy (no outside backup or public git history, and the print build would need a Cloudflare key); Collabora Online (a separate server, word-processor files); Tiptap's paid platform (comments and history need its cloud); Lexical (collaboration documented mainly for React).

The full design is in [docs/editing.md](../editing.md).

## Consequences

- `site/COLLABORATION.md` now says essays are edited on the website while other records still change by pull request.
- Essay pages are rendered by the Worker from the bucket instead of built ahead of time, and the site build bundles the full citation of every source record so an essay can cite any of them.
- The essays in `content/essays/` are brought into the bucket from the workspace; until the Foundations chapters settle, newer git text can be brought in again as a new version.
- Removing published material for a nation means holding the publication back at once, then lifting the bucket lock for that removal and rewriting the copy branch, not `main`.
- The Typst and EPUB builds need the essay boxes and, later, figure support.

## Sources

- The lead author's requests: project threads "Plan collaborative editing for the website" (Nov. 21 and 22, 2026), "Build the Foundations part with strong sources" and "Edit essays on the website" (Nov. 22, 2026).
- Cloudflare, "Consistency model," *R2*, [developers.cloudflare.com/r2/reference/consistency/](https://developers.cloudflare.com/r2/reference/consistency/); "Bucket locks," *R2* (last updated Oct. 28, 2026), [developers.cloudflare.com/r2/buckets/bucket-locks/](https://developers.cloudflare.com/r2/buckets/bucket-locks/).
- Further sources: [docs/editing.md](../editing.md#sources).
