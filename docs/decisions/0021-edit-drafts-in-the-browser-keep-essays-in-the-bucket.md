# 0021. Edit drafts together in the browser; keep essays in the private bucket

- **Status:** Proposed
- **Date:** 2026-11-21 (revised 2026-11-22)

## Context

Co-authors and contributors who write essays need to write and edit on the
website, together, with comments, without learning git (lead author's
request, Nov. 21, 2026; decision record 0004 already expected "a website
comment path that does not require GitHub"). What they need is bold, italic,
underline, images, tables and other media. The text must still feed the
website, the Typst print book and the custom ebook pipeline (decision records
0005, 0011), and every published change must keep a lasting, public history.

The first version of this record sent each finished essay to git by pull
request. The lead author asked why essays should go to GitHub at all, and on
Nov. 22, 2026 said most editing will happen in the R2 bucket and published
essays could stay there too.

## Decision (proposed)

- **Essays live in the private R2 bucket**, from draft to publication. Each
  published version is a new file under `essays/<id>/versions/` that is never
  overwritten, protected by a bucket lock. This narrows decision record 0004
  for essays (and later commentary and other long prose written by people);
  research records stay as files in git.
- **Git keeps an automatic, read-only copy.** The website serves published
  versions publicly; a scheduled GitHub workflow copies new ones to a
  `published-essays` branch, and the print and ebook builds fetch them from
  the same public copy and record each version's SHA-256. No Cloudflare key
  goes into GitHub (decision record 0006) and the website gets no write
  access to GitHub.
- **Checks run at publish time** in the website: the print build's Markdown
  reader (unknown citation keys and glossary links fail), alternative text
  and credit for every figure, and a filing for contributed material.
- **Editor:** our own, built on ProseMirror with a schema limited to what all
  three editions can render, read and written with `prosemirror-markdown` and
  the project's Markdown reader options (with "typographer" off). Underline is
  written `++like this++`. Images and other media are figures pointing to
  media records, with files in the private bucket.
- **Working together:** one SQLite-backed Durable Object per draft, holding a
  Yjs document, with hibernating WebSockets, presence through Yjs awareness,
  and access checked by the Worker at connection and again during the session
  using the permission levels of decision record 0023 (comment, contribute,
  full).
- **Comments** on drafts in D1, anchored with Yjs relative positions and the
  quoted words; sign-offs stay in `reviews`.
- **History:** live changes in the draft room; named versions and published
  versions as Markdown in the bucket, each with a D1 row and an `events` row.
- **Writing back** copies every block that did not change exactly as it was,
  so comparisons show only real edits.
- Not chosen: essays in git by pull request (the first version of this
  record); the bucket with no git copy (no outside backup or public git
  history, and the print build would need a Cloudflare key); Collabora Online
  (a separate server, word-processor files); Tiptap's paid platform (comments
  and history need its cloud); Lexical (collaboration documented mainly for
  React). One writer at a time remains the fallback for live editing.

The full design, costs and open questions are in [docs/editing.md](../editing.md).

## Consequences

- `site/COLLABORATION.md`'s rule that "content still changes only by pull
  request" will no longer hold for essays once this is built; it must be
  updated in the same pull request.
- Essay pages are rendered by the Worker from the bucket instead of built
  ahead of time; the three existing essays move to the bucket once.
- Removing published material for a nation means lifting the bucket lock for
  that removal and rewriting the copy branch, not `main`.
- The site gains a Durable Object class, declared with SQLite storage; how it
  is exported next to the SvelteKit Worker is settled in the first build step.
- The Typst and EPUB builds need figure support before the first image is
  published.
- On the Workers Paid plan, which the account uses, the expected use fits in
  the included usage (project analysis of Cloudflare's published prices;
  docs/editing.md, "Cost").

## Sources

- The lead author's requests: project thread "Plan collaborative editing for
  the website," Nov. 21 and 22, 2026.
- Round-trip test of the three essays (measured): `spikes/editing/` in the
  project's shared files; results in [docs/editing.md](../editing.md#evidence).
- Cloudflare, "Pricing" and "Limits," *Durable Objects* (last updated Nov.
  13, 2026),
  [developers.cloudflare.com/durable-objects/platform/pricing/](https://developers.cloudflare.com/durable-objects/platform/pricing/),
  [developers.cloudflare.com/durable-objects/platform/limits/](https://developers.cloudflare.com/durable-objects/platform/limits/);
  "Bucket locks," *R2* (last updated Oct. 28, 2026),
  [developers.cloudflare.com/r2/buckets/bucket-locks/](https://developers.cloudflare.com/r2/buckets/bucket-locks/).
- Further sources: [docs/editing.md](../editing.md#sources).
