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
// court opinions gets the same treatment, and the list of copies its offline
// set holds drops the copies the nation chose to cite only or hide
// (src/lib/nation-restrictions.ts).

const nationPage = /^\/nations\/([a-z0-9-]+)(?:\/opinions)?$/;
const offlineList = /^\/copies\/offline\/nations\/([a-z0-9-]+)\.json$/;

/**
 * @typedef {{ fetch: (request: Request, env: unknown, context: unknown) => Promise<Response>, [key: string]: unknown }} Worker
 * @typedef {{ getAttribute: (name: string) => string | null, setInnerContent: (content: string, options: { html: boolean }) => void }} SlotElement
 * @typedef {new () => { on: (selector: string, handlers: { element: (element: SlotElement) => void }) => { transform: (response: Response) => Response | Promise<Response> } }} RewriterClass
 * @typedef {{ stamp: string, slots: Record<string, string>, withheld?: string[] }} Overlay
 */

/**
 * The bucket key of a copy from its address on this site, as src/lib/server/document-zips.ts reads it.
 * @param {string} path
 */
function keyOfCopyPath(path) {
	return path
		.replace(/^\/copies\//, '')
		.split('/')
		.map((part) => decodeURIComponent(part))
		.join('/');
}

/**
 * The nation's offline list without the copies it withholds.
 * @param {Worker} worker
 * @param {Request} request
 * @param {Overlay} overlay
 * @param {unknown} env
 * @param {unknown} context
 */
async function withoutWithheld(worker, request, overlay, env, context) {
	const response = await worker.fetch(withoutConditions(request), env, context);
	if (response.status !== 200) return response;
	const withheld = new Set(overlay.withheld);
	const list = await response.json();
	const files = Array.isArray(list?.files) ? list.files.filter((/** @type {unknown[]} */ file) => !withheld.has(keyOfCopyPath(String(file[0])))) : [];
	const headers = new Headers(response.headers);
	headers.delete('content-length');
	headers.delete('etag');
	headers.set('cache-control', 'no-store');
	return new Response(request.method === 'HEAD' ? null : JSON.stringify({ ...list, files }), { status: 200, headers });
}

/**
 * The same request without the conditions that would let the assets answer "not modified".
 * @param {Request} request
 */
function withoutConditions(request) {
	const headers = new Headers(request.headers);
	headers.delete('if-none-match');
	headers.delete('if-modified-since');
	return new Request(request.url, { method: request.method, headers });
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
			const list = reading ? offlineList.exec(url.pathname) : null;
			if (list) {
				const overlay = await readOverlay(worker, url, list[1], env, context);
				return overlay?.withheld?.length ? withoutWithheld(worker, request, overlay, env, context) : worker.fetch(request, env, context);
			}
			const match = reading ? nationPage.exec(url.pathname) : null;
			if (!match) return worker.fetch(request, env, context);
			const overlay = await readOverlay(worker, url, match[1], env, context);
			if (!overlay) return worker.fetch(request, env, context);

			const page = await worker.fetch(withoutConditions(request), env, context);
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
