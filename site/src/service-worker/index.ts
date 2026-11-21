/**
 * Service worker: lets the site be read offline (site/DESIGN.md, section 10).
 *
 * - On install, saves the app shell (scripts and styles), the Atkinson
 *   Hyperlegible Next fonts, the static files and the core pages.
 * - Other pages are saved as they are read and refreshed in the background
 *   the next time they are opened online (stale while revalidate).
 * - Noto fallback fonts, and the fonts a reader can pick in Settings, are
 *   saved when a page first uses them. A new build keeps the ones already
 *   saved whose files have not changed, so a font picked earlier still
 *   works offline after an update.
 * - Each build has its own cache, named after the build version, and the
 *   old caches are deleted when the new worker takes over.
 * - When a page is neither saved nor reachable, the /offline page is shown.
 *
 * Restricted records are never published, so they are never cached. The
 * co-author workspace, sign-in and the request form are answered by the
 * Worker for one person at a time, so they are never cached either.
 */
import { version } from '$app/env';
import { assets, immutable, prerendered } from '$app/manifest';
import { self } from '$app/service-worker';

const cacheName = `site-${version}`;
const offlinePage = '/offline';
const corePages = ['/', '/glossary', '/changelog', offlinePage];
const neverCached = ['/workspace', '/sign-in', '/sign-out', '/requests'];

function isNeverCached(path: string): boolean {
	return neverCached.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

function isFallbackFont(path: string): boolean {
	return /\.woff2?$/.test(path) && !path.includes('atkinson-hyperlegible-next');
}

/** The manifest lists paths relative to the site root, without the leading slash. */
function absolute(path: string): string {
	return `/${path}`;
}

// Only the woff2 files are used by current browsers; the woff copies are a fallback for old ones.
const shell = immutable
	.map((file) => absolute(file.path))
	.filter((path) => !isFallbackFont(path) && !path.endsWith('.woff'));
const staticFiles = assets.map((file) => absolute(file.path));
const builtPaths = new Set(prerendered.map((page) => absolute(page.path)));
const corePageFiles = corePages.flatMap((page) => [
	page,
	page === '/' ? '/__data.json' : `${page}/__data.json`
]);
const precached = [
	...shell,
	...staticFiles,
	...['/manifest.webmanifest', '/icon.svg', ...corePageFiles].filter((path) => builtPaths.has(path))
];
const cacheFirst = new Set([...shell, ...staticFiles, '/manifest.webmanifest', '/icon.svg']);

self.addEventListener('install', (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(cacheName);
			await cache.addAll(precached);
			await self.skipWaiting();
		})()
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(cacheName);
			const currentFiles = new Set(immutable.map((file) => absolute(file.path)));
			for (const name of await caches.keys()) {
				if (name === cacheName) continue;
				// Font file names carry a hash of their content, so a saved copy
				// with a name in this build is still the same file.
				const oldCache = await caches.open(name);
				for (const request of await oldCache.keys()) {
					const path = new URL(request.url).pathname;
					if (isFallbackFont(path) && currentFiles.has(path) && !(await cache.match(path))) {
						const response = await oldCache.match(request);
						if (response) await cache.put(path, response);
					}
				}
				await caches.delete(name);
			}
			await self.clients.claim();
		})()
	);
});

async function respond(request: Request): Promise<Response> {
	const url = new URL(request.url);
	const cache = await caches.open(cacheName);

	// Files that never change for this build: cache first.
	if (cacheFirst.has(url.pathname) || isFallbackFont(url.pathname)) {
		const saved = await cache.match(url.pathname);
		if (saved) return saved;
		const response = await fetch(request);
		if (response.ok) await cache.put(url.pathname, response.clone());
		return response;
	}

	// Pages and page data: answer from the saved copy at once, refresh it in the background.
	const saved = await cache.match(request, { ignoreSearch: true });
	const refreshed = fetch(request)
		.then(async (response) => {
			if (response.ok && response.type === 'basic') await cache.put(request, response.clone());
			return response;
		})
		.catch(() => undefined);

	if (saved) return saved;
	const response = await refreshed;
	if (response) return response;

	if (request.mode === 'navigate') {
		const fallback = await cache.match(offlinePage);
		if (fallback) return fallback;
	}
	return new Response('Offline and not saved on this device.', {
		status: 503,
		headers: { 'content-type': 'text/plain; charset=utf-8' }
	});
}

/** Pages answered by the Worker for one person: always from the network. */
async function networkOnly(request: Request): Promise<Response> {
	try {
		return await fetch(request);
	} catch {
		const fallback = await (await caches.open(cacheName)).match(offlinePage);
		return (
			fallback ??
			new Response('Offline. This page needs a connection.', {
				status: 503,
				headers: { 'content-type': 'text/plain; charset=utf-8' }
			})
		);
	}
}

self.addEventListener('fetch', (event) => {
	const url = new URL(event.request.url);
	if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
	if (isNeverCached(url.pathname)) {
		// Never saved, but a page opened offline still gets the site's own
		// offline page rather than the browser's error page.
		if (event.request.mode === 'navigate') event.respondWith(networkOnly(event.request));
		return;
	}
	event.respondWith(respond(event.request));
});
