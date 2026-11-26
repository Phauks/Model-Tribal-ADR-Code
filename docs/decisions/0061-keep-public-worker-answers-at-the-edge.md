# 0061. Keep the Worker's public answers at Cloudflare's edge, and nothing personal

- **Status:** Accepted
- **Date:** 2026-11-26
- **Extends:** decision records [0039](0039-website-map-uses-maplibre-and-our-own-tiles.md) (map tiles), [0056](0056-let-nations-restrict-their-laws-and-opinions.md) (nation restrictions) and [0058](0058-draw-item-pages-on-request.md) (item pages drawn on request)

## Context

Since decision record 0058 the Worker draws every case, law, biography and Supreme Court page when a reader opens it, and every map tile is read from the private bucket with ranged reads. The site's own address, `triballawproject.org`, has been live since Nov. 25, 2026, and Cloudflare's edge can keep a Worker's answers only on a domain of its own, not on `workers.dev`.[^cache-api] Measured from one cloud machine on Nov. 26, 2026 (`docs/edge-caching.md`, "Measurements"), a tile took a median 290 to 612 ms to arrive and a record page 168 to 192 ms, against 154 ms for a prebuilt page Cloudflare already keeps. Over the 24 hours before, none of the 376 map tile requests was answered from a cache.

Cloudflare offers two ways for a Worker to have its answers kept. The Cache API keeps an answer in the one Cloudflare location that made it, and only a call from that location can remove it.[^cache-api] Workers Cache, switched on in the Worker's configuration, answers a repeat request at the edge without running the Worker at all, keeps each Worker version's answers apart, and lets the Worker purge what it kept everywhere at once by tag, with no key or token.[^workers-cache][^purge] But Workers Cache keeps any answer that does not say otherwise, for two hours by default, and a request's cookies are not part of what it keeps an answer under.[^workers-cache-keys] Without care, one person's signed-in page could be kept and shown to the next reader.

## Decision

- **Workers Cache is on** (`"cache": { "enabled": true }` in `site/wrangler.jsonc`).
- **Kept only by a list, never by default.** The outermost wrapper of the built Worker (`site/tools/edge-cache-worker.js`, added by `site/tools/add-edge-cache.mjs` after every other build step) puts `Cloudflare-CDN-Cache-Control` on every answer. Answers on its list get `public, max-age=…`; every other answer gets `no-store`. The list holds only answers that are the same for every reader: the record pages drawn from built data and their portraits, map tiles, map pictures and the map's fonts and icons, and the site search's two files. An answer is never kept if it sets a cookie, says `private` or `no-store`, varies on everything, or did not go well. Signed-in and personal pages are not on the list, and the tests check every private and signed-in prefix of `src/hooks.server.ts` against it.
- **Browsers are told nothing new.** `Cloudflare-CDN-Cache-Control` is read by Cloudflare only, so what browsers keep is unchanged.
- **Deploys purge by themselves.** Each deploy is a new Worker version, and Workers Cache keeps versions apart, so a new version starts with nothing kept. Publishing site text starts a deploy (decision record 0054), so it purges too, at the moment the new words go live; nothing kept can show words older than the version serving it.
- **A nation's new choice purges the search files.** The search files leave out what nations chose to hide (decision record 0056). They are kept for five minutes under the tag `nation-restrictions`, and saving a nation's choice purges that tag (`src/lib/server/edge-cache.ts`). If a purge failed, the old files would be gone within five minutes. Nation pages and the other files filtered for restrictions are not kept.
- **Tiles are kept across deploys too.** A deploy empties Workers Cache, but tiles do not change when the site does, so the tile route also keeps each tile in its location's Cache API cache (`src/lib/server/kept-answers.ts`). Its key names every tile set served, so a tile set replaced after a nation withdraws a land area (decision record 0039) can never be answered from a kept copy.
- **Static files are unchanged.** Cloudflare already keeps the prebuilt pages and files of the static assets; `/_app/immutable/` files are kept by browsers for a year.

## Consequences

- A record page, tile or search file asked for again at the same location is answered without running the Worker or reading the bucket. Measurements before and after are in `docs/edge-caching.md`.
- With Workers Cache on, requests for static files count as Worker requests for billing, though they use no CPU.[^pricing] At about 22,000 requests a day (Nov. 26, 2026), that stays far inside the 10 million requests a month of the Workers Paid plan.
- A new page family drawn on request, or any new public answer worth keeping, must be added to the list in `site/tools/edge-cache-worker.js` on purpose; anything not added is never kept.
- A page that comes to depend on who is reading, on the database, or on a nation's choices must leave the list, or carry a tag that the change purges.
- Cloudflare's dashboard cannot yet show or change Workers Cache; it is set in `site/wrangler.jsonc` only.[^workers-cache]

## Sources

[^cache-api]: Cloudflare, "Cache," Workers documentation, <https://developers.cloudflare.com/workers/runtime-apis/cache/>; Cloudflare, "How the Cache works," Workers documentation, <https://developers.cloudflare.com/workers/reference/how-the-cache-works/>.

[^workers-cache]: Cloudflare, "Cache," Workers documentation (Workers Cache), <https://developers.cloudflare.com/workers/cache/>; Cloudflare, "Configuration," <https://developers.cloudflare.com/workers/cache/configuration/>; Cloudflare, "Limitations," <https://developers.cloudflare.com/workers/cache/limitations/>.

[^workers-cache-keys]: Cloudflare, "Cache keys," Workers documentation, <https://developers.cloudflare.com/workers/cache/cache-keys/>.

[^purge]: Cloudflare, "Purge," Workers documentation, <https://developers.cloudflare.com/workers/cache/purge/>.

[^pricing]: Cloudflare, "Pricing," Workers documentation, <https://developers.cloudflare.com/workers/platform/pricing/>.
