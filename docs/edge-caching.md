# Edge caching and the www address

How the website's answers are kept at Cloudflare's edge, what is never kept, how kept answers are purged, and how `www.triballawproject.org` reaches the site. The decision is in decision record [0061](decisions/0061-keep-public-worker-answers-at-the-edge.md).

## What is kept

The site has three kinds of answers.

- **Prebuilt pages and files** (most pages, `/_app/`, downloads). Cloudflare's static assets serve and keep these already. Files under `/_app/immutable/` have a hash in their name, and browsers keep them for a year. Nothing here changed.
- **Public answers the Worker makes.** Workers Cache (`"cache"` in `site/wrangler.jsonc`) answers a repeat request at the edge without running the Worker. Only the answers on the list in `site/tools/edge-cache-worker.js` may be kept:

  | Addresses | Kept for | Tag |
  | --- | --- | --- |
  | `/cases/<id>`, `/laws/<key>`, `/biographies/<person>`, `/supreme-court/justices/<key>`, `/supreme-court/presidents/<key>`, `/supreme-court/<court>`, and the `__data.json` of each | 1 day | `record-pages` |
  | `/supreme-court/portraits/<person>` | 30 days | `record-pages` |
  | `/map-tiles/<set>/<z>/<x>/<y>.mvt`, `/map-tiles/imagery/<name>/<z>/<x>/<y>` | 30 days | `map-tiles` |
  | `/map-tiles/assets/…` (the map's fonts and icons) | 7 days | `map-tiles` |
  | `/search/index.json`, `/search/records.json` | 5 minutes | `nation-restrictions` |

  "Kept for" is the longest; a deploy ends it sooner (see "Purging"). Only answers that went well are kept (200, and 204 for an empty map tile).
- **Everything else the Worker answers** is marked `no-store` for the edge: the workspace, sign-in, accounts, profiles, uploads, orders, events, rooms, sponsorship, recent changes, nation pages, essays, the inbox, and every other page. An answer is never kept, even on the list, if it sets a cookie, says `private` or `no-store`, or varies on everything.

The edge is told in the `Cloudflare-CDN-Cache-Control` header, which only Cloudflare reads, so what browsers keep is unchanged. Workers Cache does not tell answers apart by cookie, which is why the list is short and everything off it says `no-store`; `tests/edge-cache.test.ts` checks every private and signed-in prefix of `site/src/hooks.server.ts` against the list.

Map tiles are also kept in each Cloudflare location's own cache across deploys (`site/src/lib/server/kept-answers.ts`), since a deploy empties Workers Cache but does not change any tile. That key names every tile set served, so a replaced tile set is never answered from a kept copy.

## Adding to the list

A new page family drawn on request, or any other public answer that is the same for every reader until the next deploy, can be added to `edgeCacheRules` in `site/tools/edge-cache-worker.js`, with a test in `site/tests/edge-cache.test.ts`. Never add an answer that depends on who is reading, on the database, or on a nation's choices, unless the change that alters it purges its tag.

## Purging

- **Deploys.** Each deploy is a new Worker version, and Workers Cache keeps versions apart, so a new version starts with nothing kept. Nothing needs purging by hand.
- **Site text.** Publishing site text starts a deploy (decision record 0054), and the deploy purges everything as above, at the moment the new words go live.
- **A nation's choices.** Saving what a nation shows of its laws and court opinions purges the tag `nation-restrictions` everywhere at once (`site/src/lib/server/edge-cache.ts`). Nation pages and the other files filtered for restrictions are not kept at all.
- **By hand, if ever needed.** Code in the Worker can call `purgeEdgeCache(['record-pages'])` (or `map-tiles`). Cloudflare's dashboard purge does not reach Workers Cache, and the dashboard cannot yet show it.[^purge]

## The www address

`www.triballawproject.org` answers with a permanent redirect (301) to the same path and query on `https://triballawproject.org`. It is a proxied DNS record (`AAAA` to `100::`, an address that only lets Cloudflare answer) and a redirect rule named "www to apex" on the zone (Rules > Redirect Rules), so the Worker never runs for it.[^redirect]

## Measurements

Measured from one cloud machine in Cloudflare's IAD location (Ashburn, Virginia), ten requests per address in a row, time to first byte (`curl`'s `time_starttransfer`, which includes the round trip to Cloudflare). The cache hit counts are from Cloudflare's zone analytics (`httpRequestsAdaptiveGroups`, eyeball requests).

### Before (Nov. 26, 2026, 22:58 UTC)

| Address | Median | 90th percentile | Kept? |
| --- | --- | --- | --- |
| `/` (prebuilt, for comparison) | 154 ms | 242 ms | HIT 10 of 10 |
| `/cases/worcester-v-georgia` | 184 ms | 357 ms | not kept |
| `/cases/worcester-v-georgia/__data.json` | 146 ms | 188 ms | not kept |
| `/laws/treaty-with-the-cheyenne-and-arapaho-1867` | 168 ms | 212 ms | not kept |
| `/biographies/a-c-hunt` | 173 ms | 196 ms | not kept |
| `/supreme-court/justices/abe-fortas` | 192 ms | 254 ms | not kept |
| `/search/index.json` | 262 ms | 290 ms | static HIT 10 of 10 |
| `/map-tiles/land-areas-fe4ab6eac717/5/7/12.mvt` | 612 ms | 643 ms | not kept |
| `/map-tiles/basemap-20261122/6/15/24.mvt` | 441 ms | 649 ms | not kept |
| `/map-tiles/basemap-20261122/4/3/5.mvt` | 290 ms | 406 ms | not kept |
| `/map-tiles/imagery/satellite/6/15/24` | 151 ms | 206 ms | not kept |
| `/map-tiles/assets/sprites/white.json` | 281 ms | 321 ms | not kept |

Over the 24 hours to 23:00 UTC on Nov. 26, 2026: 14,428 requests were answered from a cache, 2,695 missed it, and 4,992 were made by the Worker with no cache at all (65% of all requests from a cache). None of the 376 map tile requests came from a cache.

### After

To be measured after the deploy.

## Sources

[^purge]: Cloudflare, "Purge," Workers documentation, <https://developers.cloudflare.com/workers/cache/purge/>.

[^redirect]: Cloudflare, "Single Redirects," Rules documentation, <https://developers.cloudflare.com/rules/url-forwarding/single-redirects/>; Cloudflare, "Redirecting one domain to another," <https://developers.cloudflare.com/rules/url-forwarding/examples/redirect-all-different-hostname/>.
