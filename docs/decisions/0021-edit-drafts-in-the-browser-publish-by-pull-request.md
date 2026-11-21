# 0021. Edit drafts together in the browser; publish them by pull request

- **Status:** Proposed
- **Date:** 2026-11-21

## Context

Co-authors and contributors who write essays need to write and edit on the
website, together, with comments, without learning git (lead author's
request, Nov. 21, 2026; decision record 0004 already expected "a website
comment path that does not require GitHub"). What they need is bold, italic,
underline, images, tables and other media. The content must still feed the
website, the Typst print book and the custom ebook pipeline from the same
Markdown files (decision records 0004, 0005, 0011), and every change must keep
an orderly, public history.

## Decision (proposed)

- **Markdown in git stays the published text.** The website holds drafts;
  submitting a draft opens a pull request with the changed Markdown, and
  merging it publishes it.
- **Editor:** our own, built on ProseMirror with a schema limited to what all
  three editions can render, read and written with `prosemirror-markdown` and
  the project's Markdown reader options (with "typographer" off). Underline is
  written `++like this++`. Images and other media are figures pointing to
  media records in git, with files in the private bucket.
- **Working together:** one SQLite-backed Durable Object per draft, holding a
  Yjs document, with hibernating WebSockets, presence through Yjs awareness,
  and access checked by the Worker at connection and again during the session
  using the permission tiers (comment, contribute, full).
- **Comments** on drafts in D1, anchored with Yjs relative positions and the
  quoted words; sign-offs stay in `reviews`.
- **History:** live changes in the draft room; named versions as Markdown in
  the private bucket with a D1 row and an `events` row; published versions as
  git commits.
- **Writing back** copies every block that did not change exactly as it was,
  so pull requests show only real edits.
- **Not chosen: keeping the finished text in D1 or R2** instead of git. It
  would remove the pull request step but means rebuilding the checks, the
  public change history and edition snapshots, and giving GitHub a Cloudflare
  credential for the print build (comparison in docs/editing.md, "Why the
  finished text stays in git").
- Not chosen: Collabora Online (a separate server, word-processor files),
  Tiptap's paid platform (comments and history need its cloud), Lexical
  (collaboration documented mainly for React). One writer at a time remains
  the fallback.

The full design, costs and open questions are in [docs/editing.md](../editing.md).

## Consequences

- The site gains a Durable Object class, declared with SQLite storage; how it
  is exported next to the SvelteKit Worker is settled in the first build step.
- Opening pull requests from the website needs a GitHub App whose key is a
  Cloudflare secret (decision record 0006), unless the lead author prefers
  that the website only produce the Markdown.
- The Typst and EPUB builds need figure support before the first image is
  published.
- On the Workers Free plan the expected use fits in the daily allowance; on
  the Paid plan it fits in the included usage (project analysis of
  Cloudflare's published prices; docs/editing.md, "Cost").

## Sources

- The lead author's request: project thread "Plan collaborative editing for
  the website," Nov. 21, 2026.
- Round-trip test of the three essays (measured): `spikes/editing/` in the
  project's shared files; results in [docs/editing.md](../editing.md#evidence).
- Cloudflare, "Pricing" and "Limits," *Durable Objects* (last updated Nov.
  13, 2026),
  [developers.cloudflare.com/durable-objects/platform/pricing/](https://developers.cloudflare.com/durable-objects/platform/pricing/),
  [developers.cloudflare.com/durable-objects/platform/limits/](https://developers.cloudflare.com/durable-objects/platform/limits/).
- Further sources: [docs/editing.md](../editing.md#sources).
