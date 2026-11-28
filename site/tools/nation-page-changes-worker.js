// Copied beside the built Worker by tools/add-nation-page-changes.mjs. Plain
// JavaScript with no imports, so Wrangler bundles it as it is and the tests
// can load it (tests/nation-page-changes.test.ts).
//
// Nation pages are prerendered, so a nation's own published changes cannot be
// part of the build (decision record 0041, "Stage 2"). This wraps the
// Worker's fetch handler: for a nation's page it asks the site for the HTML
// of the nation's live changes (/nations/<id>/changes.json) and writes it into
// the page's empty places (data-nation-slot) as the page streams out. Pages
// of nations with no changes pass through untouched. The nation's table of
// court opinions gets the same treatment.
//
// Nor can the build know what nations chose the site shows of their own laws
// and court opinions (src/lib/nation-restrictions.ts). So the files and
// pages made at build time that name them go to the site first: files to
// /restricted-files/<address> (src/routes/restricted-files), pages and their
// data to /restricted-pages/<address> (src/lib/server/restricted-pages.ts).
// Each answers with the file or page as built when nothing in it is
// restricted. The list of a nation's restrictable items is for its team's
// page alone, which reads it from the built files, so it is never served;
// nor are the sitemap's lists as built, which the sitemap is written from,
// nor the Worker's private data files.

const nationPage = /^\/nations\/(?!(?:coverage|data|federal-offices|federal-programs|law|letter|map|recourse|state|timeline)$)([a-z0-9-]+)(?:\/opinions)?$/;
const restrictableList = /^\/nations\/[a-z0-9-]+\/restrictable\.json$/;
// The sitemap's pages as built (src/routes/sitemaps/built), which the Worker
// reads to write the sitemap less what nations hid since (src/lib/sitemap.ts).
const builtSitemap = /^\/sitemaps\/built\//;
// The Worker's private data files (src/lib/built-files.ts), such as the list
// of every copy it serves, which names copies nations chose to hide. Only
// the Worker reads them, through its ASSETS binding. The parts of the built
// files too large to serve whole are kept there too, and go out only joined
// at the file's own address (tools/split-large-files.mjs).
const privateData = /^\/page-data\/private\//;

/** Files the site filters (src/routes/restricted-files, restrictedFiles). */
export const filteredFiles = [
	/^\/search\/records\.json$/,
	/^\/search\/index\.json$/,
	/^\/search\/files\.json$/,
	/^\/copies\/list\.csv$/,
	/^\/copies\/offline\/nations\/[a-z0-9-]+\.json$/,
	/^\/copies\/details\/[0-9a-f]{2}\.json$/,
	/^\/nations\/[a-z0-9-]+\/timeline\.(json|csv)$/,
	/^\/nations\/timeline\/entries\.(json|csv)$/,
	/^\/nations\/law\/[a-z0-9-]+\.json$/,
	/^\/nations\/data\/build\/[a-z-]+\.json$/,
	/^\/zip\/data\.zip$/
];

/** Pages the site draws again when something on them is restricted (src/lib/restricted-pages.ts, restrictedPageViews), and the data a move within the site asks for. */
export const filteredPages = [
	/^\/nations\/timeline(\/__data\.json)?$/,
	/^\/nations\/(?!(?:coverage|data|federal-offices|federal-programs|law|letter|map|recourse|state|timeline)(?:\/|$))[a-z0-9-]+(\/opinions)?(\/__data\.json)?$/,
	/^\/copies\/list\/[a-z0-9-]+(\/__data\.json)?$/,
	/^\/nations\/data\/(?!(?:build|tables)\/)[a-z0-9-]+\/(?!sources(?:\/|$))[^/]+?(\/__data\.json)?$/,
	/^\/stats\/[a-z0-9-]+(\/__data\.json)?$/,
	/^\/courts\/[a-z0-9-]+(\/__data\.json)?$/
];

/**
 * @typedef {{ fetch: (request: Request, env: unknown, context: unknown) => Promise<Response>, [key: string]: unknown }} Worker
 * @typedef {{ getAttribute: (name: string) => string | null, setInnerContent: (content: string, options: { html: boolean }) => void }} SlotElement
 * @typedef {new () => { on: (selector: string, handlers: { element: (element: SlotElement) => void }) => { transform: (response: Response) => Response | Promise<Response> } }} RewriterClass
 * @typedef {{ stamp: string, slots: Record<string, string> }} Overlay
 */

/**
 * The request sent on to the site under another address, keeping its query.
 * @param {Request} request
 * @param {string} prefix
 * @param {boolean} [conditions] whether to keep the headers that let the answer be "not modified"
 */
function forwarded(request, prefix, conditions = true) {
	const url = new URL(request.url);
	const headers = new Headers(request.headers);
	if (!conditions) {
		headers.delete('if-none-match');
		headers.delete('if-modified-since');
	}
	return new Request(new URL(`${prefix}${url.pathname}${url.search}`, url), { method: request.method, headers });
}

/**
 * @param {Worker} worker
 * @param {URL} url
 * @param {string} nation
 * @param {unknown} env
 * @param {unknown} context
 * @returns {Promise<Overlay | undefined>}
 */
async function readOverlay(worker, url, nation, env, context) {
	try {
		const request = new Request(new URL(`/nations/${nation}/changes.json`, url), { headers: { accept: 'application/json' } });
		const response = await worker.fetch(request, env, context);
		if (!response.ok) return undefined;
		const overlay = await response.json();
		return overlay && typeof overlay.stamp === 'string' && overlay.slots ? overlay : undefined;
	} catch (error) {
		// The page without the nation's changes is better than no page.
		console.error('Nation page changes could not be read', nation, error);
		return undefined;
	}
}

/**
 * @param {Worker} worker
 * @param {RewriterClass} [Rewriter]
 */
export function withNationPageChanges(worker, Rewriter = /** @type {any} */ (globalThis).HTMLRewriter) {
	/** @type {Worker} */
	const wrapped = {
		...worker,
		/** @param {Request} request @param {unknown} env @param {unknown} context */
		async fetch(request, env, context) {
			const url = new URL(request.url);
			const reading = request.method === 'GET' || request.method === 'HEAD';
			if (!reading) return worker.fetch(request, env, context);
			if (restrictableList.test(url.pathname) || builtSitemap.test(url.pathname) || privateData.test(url.pathname)) return new Response('Not found', { status: 404, headers: { 'cache-control': 'no-store' } });
			if (filteredFiles.some((pattern) => pattern.test(url.pathname))) return worker.fetch(forwarded(request, '/restricted-files'), env, context);
			const asPage = filteredPages.some((pattern) => pattern.test(url.pathname));
			const match = nationPage.exec(url.pathname);
			if (!match) return asPage ? worker.fetch(forwarded(request, '/restricted-pages'), env, context) : worker.fetch(request, env, context);
			const overlay = await readOverlay(worker, url, match[1], env, context);
			if (!overlay) return worker.fetch(forwarded(request, '/restricted-pages'), env, context);

			const page = await worker.fetch(forwarded(request, '/restricted-pages', false), env, context);
			if (page.status !== 200 || !(page.headers.get('content-type') ?? '').includes('text/html')) return page;
			const built = (page.headers.get('etag') ?? '').replace(/^W\//, '').replaceAll('"', '');
			const headers = new Headers(page.headers);
			headers.set('etag', `W/"nation-${overlay.stamp}-${built}"`);
			headers.delete('content-length');
			if (request.headers.get('if-none-match') === headers.get('etag')) {
				return new Response(null, { status: 304, headers });
			}
			const rewriter = new Rewriter().on('[data-nation-slot]', {
				element(element) {
					const html = overlay.slots[element.getAttribute('data-nation-slot') ?? ''];
					if (html) element.setInnerContent(html, { html: true });
				}
			});
			return rewriter.transform(new Response(page.body, { status: page.status, statusText: page.statusText, headers }));
		}
	};
	return wrapped;
}
