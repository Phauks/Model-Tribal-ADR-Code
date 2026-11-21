# 0017. Serve nations' seals and logos from the private bucket

- **Status:** Accepted
- **Date:** 2026-11-21

## Context

Tribe profiles record each nation's seal, emblem, flag or logo and whether
the project may show it (docs/official-images.md). The image files are kept
out of git, because a nation can ask for an image to be removed (charter,
commitment 6) and a public history cannot be fully rewritten. The website
needed a way to show the images it may show. The options were serving them
from the private R2 bucket through the Worker, linking to the nation's own
copy, committing them to the site's static files, or showing none. Trevor
Goldsmith chose the private bucket (2026-11-21).

## Decision

- The Worker serves a nation's image at `/nations/<nation id>/image` from the
  `sourceDocuments` bucket, under `nation-images/<nation id>/`.
- Only images whose reuse status allows showing them are listed when the
  site is built (no restriction found, conditions the website meets, or
  permission granted for the web). Nothing else is served.
- The Worker fills the bucket copy the first time an image is asked for, from
  the nation's own website, and keeps it only when its SHA-256 matches the
  copy that was reviewed.
- Image responses are cached for at most an hour and never saved for offline
  use. SVG files are served with a sandboxing content security policy.

## Consequences

- Withdrawing an image takes a status change, a rebuild and one delete in the
  bucket.
- An image whose nation has since changed it is not shown until someone
  reviews the new one; its page hides the figure.
- If a nation's website refuses the Worker, its image is not shown until a
  copy is uploaded to the bucket by hand (for example with
  `wrangler r2 object put`).
