// Copied beside the built Worker by tools/add-edge-cache.mjs. Plain
// JavaScript with no imports, so Wrangler bundles it as it is and the tests
// can load it (tests/edge-cache.test.ts).
//
// The Worker's answers are kept at Cloudflare's edge by Workers Cache
// ("cache" in wrangler.jsonc; docs/edge-caching.md), which answers a repeat
// request without running the Worker. Workers Cache keeps any answer that
// does not say otherwise, whoever asked for it: a request's cookies are not
// part of what it keeps an answer under. So this wraps the Worker's fetch
// handler, the outermost wrapper of all, and says on every answer whether
// the edge may keep it:
//
// - Only answers on the list below may be kept, and only when they went well
//   (200, or 204 for an empty map tile), carry no cookie and do not say
//   private or no-store themselves. Every one of them is the same for every
//   reader: built record pages, map tiles and the search index.
// - Every other answer is marked no-store for the edge. Signed-in and
//   personal pages are never on the list, so they are never kept.
//
// The edge's instructions go in Cloudflare-CDN-Cache-Control, which only
// Cloudflare reads, so what browsers keep is unchanged. Each deploy is a new
// Worker version, and Workers Cache keeps each version's answers apart, so a
// deploy (including the one a site text publish starts) starts with nothing
// kept. Cache-Tag names each kind, for purging one kind at once.

const day = 86_400;

/**
 * What the edge may keep, by address. `seconds` is how long; `tags` name it
 * for a purge; `statuses` are the answers worth keeping.
 * @type {{ pattern: RegExp, seconds: number, tags: string[], statuses: number[] }[]}
 */
export const edgeCacheRules = [
	// Item pages the Worker draws from data built with the site (decision
	// record 0058): the same for every reader until the next deploy.
	{ pattern: /^\/(?:cases|laws|biographies)\/[^/]+(?:\/__data\.json)?$/, seconds: day, tags: ['record-pages'], statuses: [200] },
	{ pattern: /^\/supreme-court\/(?:justices|presidents)\/[^/]+(?:\/__data\.json)?$/, seconds: day, tags: ['record-pages'], statuses: [200] },
	{ pattern: /^\/supreme-court\/(?!justices$|presidents$|portraits$)[^/]+(?:\/__data\.json)?$/, seconds: day, tags: ['record-pages'], statuses: [200] },
	{ pattern: /^\/supreme-court\/portraits\/[^/]+$/, seconds: 30 * day, tags: ['record-pages'], statuses: [200] },
	// Map tiles: each tile set's name changes whenever its file does
	// (src/lib/server/map-tile-serving.ts), and pictures of the U.S. Geological
	// Survey's maps change seldom (src/lib/server/map-imagery.ts).
	{ pattern: /^\/map-tiles\/[a-z0-9-]+\/\d{1,2}\/\d{1,8}\/\d{1,8}\.mvt$/, seconds: 30 * day, tags: ['map-tiles'], statuses: [200, 204] },
	{ pattern: /^\/map-tiles\/imagery\/[a-z-]+\/\d{1,2}\/\d{1,8}\/\d{1,8}$/, seconds: 30 * day, tags: ['map-tiles'], statuses: [200, 204] },
	{ pattern: /^\/map-tiles\/assets\/.+$/, seconds: 7 * day, tags: ['map-tiles'], statuses: [200] },
	// The site search's files. They leave out what nations chose to hide
	// (src/routes/restricted-files), so a nation's new choice purges them
	// (src/lib/server/edge-cache.ts); five minutes is the longest they could
	// stay if that purge failed.
	{ pattern: /^\/search\/(?:index|records)\.json$/, seconds: 300, tags: ['nation-restrictions'], statuses: [200] },
	// The sitemap (src/lib/sitemap.ts) leaves out what nations hid too, so it
	// is purged with them. It also adds published essays and nations' own
	// page changes, which purge nothing: an hour is how late those can be.
	{ pattern: /^\/(?:sitemap|sitemaps\/[a-z]+(?:-[a-z]+)*(?:-\d+)?)\.xml$/, seconds: 3600, tags: ['nation-restrictions'], statuses: [200] },
	// The search on the server (src/routes/search/query): one answer per
	// search typed, the same for every reader and drawn from the same files,
	// so it is kept and purged as they are.
	{ pattern: /^\/search\/query$/, seconds: 300, tags: ['nation-restrictions'], statuses: [200] },
	// The sponsors in the home page's rolling row (src/routes/sponsor/row.json):
	// the same for every reader, without amounts. A new sponsor, logo or choice
	// shows within five minutes.
	{ pattern: /^\/sponsor\/row\.json$/, seconds: 300, tags: ['sponsors'], statuses: [200] }
];

export const edgeHeader = 'cloudflare-cdn-cache-control';
export const tagHeader = 'cache-tag';

/**
 * What the edge is told about one answer: how long it may keep it (or
 * no-store), and the tags it is kept under.
 * @param {string} method
 * @param {string} pathname
 * @param {Response} response
 * @returns {{ control: string, tags?: string[] }}
 */
export function edgePolicy(method, pathname, response) {
	const never = { control: 'no-store' };
	if (method !== 'GET' && method !== 'HEAD') return never;
	if (response.headers.has('set-cookie')) return never;
	if (/\b(?:private|no-store)\b/i.test(response.headers.get('cache-control') ?? '')) return never;
	if ((response.headers.get('vary') ?? '').includes('*')) return never;
	const rule = edgeCacheRules.find((candidate) => candidate.pattern.test(pathname));
	if (!rule || !rule.statuses.includes(response.status)) return never;
	return { control: `public, max-age=${rule.seconds}`, tags: rule.tags };
}

/**
 * @typedef {{ fetch: (request: Request, env: unknown, context: unknown) => Promise<Response>, [key: string]: unknown }} Worker
 */

/** @param {Worker} worker */
export function withEdgeCachePolicy(worker) {
	/** @type {Worker} */
	const wrapped = {
		...worker,
		/** @param {Request} request @param {unknown} env @param {unknown} context */
		async fetch(request, env, context) {
			const given = await worker.fetch(request, env, context);
			// A WebSocket answer (live editing) takes no added headers.
			if (given.status === 101) return given;
			const policy = edgePolicy(request.method, new URL(request.url).pathname, given);
			let response = given;
			try {
				response.headers.set(edgeHeader, policy.control);
			} catch {
				// An answer passed on as it came, such as one from the static files, has headers that cannot change; a copy's can.
				response = new Response(given.body, given);
				response.headers.set(edgeHeader, policy.control);
			}
			if (policy.tags) response.headers.set(tagHeader, policy.tags.join(','));
			else response.headers.delete(tagHeader);
			return response;
		}
	};
	return wrapped;
}
