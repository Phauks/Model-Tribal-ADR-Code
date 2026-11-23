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
 * - A reader can save a whole collection at once from Settings ("Saved for
 *   offline", src/lib/offline-collections.ts). The worker remembers which
 *   collections the reader keeps, so it saves them again after an update.
 * - Each build has its own cache, named after the build version. A page from
 *   a newer build is not saved into an older build's cache, because its
 *   scripts would be missing offline.
 * - Updates wait for the reader (site/DESIGN.md, section 10, "Updates"): a
 *   new worker installs in the background and waits until the reader presses
 *   "Update now", which sends "skip-waiting", or until every tab of the site
 *   is closed. It then takes over at once, and only afterwards carries
 *   forward the pages read while it waited and deletes the old caches, so
 *   the reload after "Update now" is not held up.
 * - Updates download only what changed. A new worker carries every saved
 *   file whose fingerprint has not changed into its own cache
 *   (src/lib/offline-fingerprints.ts), and lists the saved pages that did
 *   change, which are downloaded again on the next page load.
 * - When a page is neither saved nor reachable, the /offline page is shown.
 *
 * Restricted records are never published, so they are never cached. The
 * co-author workspace, sign-in and the request form are answered by the
 * Worker for one person at a time, so they are never cached either.
 */
import { version } from '$app/env';
import { assets, immutable, prerendered } from '$app/manifest';
import { self } from '$app/service-worker';
import {
	collectionOf,
	collections,
	pageOf,
	type CollectionIdentifier,
	type CollectionStatus,
	type OfflineStatus,
	type WorkerReply,
	type WorkerRequest
} from '#lib/offline-collections.ts';
import {
	cacheNameOf,
	cachePrefix,
	fingerprintOf,
	fingerprintsAddress,
	savedFingerprintsKey,
	withBuild,
	withoutBuild,
	type Fingerprints
} from '#lib/offline-fingerprints.ts';

const cacheName = cacheNameOf(version);
const offlinePage = '/offline';
// The search page and its index are kept too, so the masthead's search box works offline,
// and so is the Starred page, since stars and notes live on the device.
const corePages = ['/', '/glossary', '/changelog', '/search', '/starred', '/starred/shared', offlinePage];
// edition.json, the fingerprints and SvelteKit's version.json say what the server has now, so
// they always come from the network; a saved version.json would hide a new build from open tabs.
// Copies of public documents (/copies/) can be large and are read in parts, so the browser fetches them itself.
// Map tiles (/map-tiles/) are many and never change under their address, so the browser's own cache keeps them.
const neverCached = [
	'/workspace',
	'/sign-in',
	'/sign-out',
	'/requests',
	'/following',
	'/edition.json',
	fingerprintsAddress,
	'/_app/version.json',
	'/copies',
	'/map-tiles'
];
/** Not a real address: the list of collections the reader keeps, stored in the cache. */
const keptCollectionsKey = '/__kept-collections';
/** This build's fingerprints, stored in its cache so the page can compare builds. */
const fingerprintsKey = savedFingerprintsKey;
/** Not a real address: saved pages that changed in this build, to download again. */
const changedKey = '/__changed';
const internalKeys = new Set([keptCollectionsKey, fingerprintsKey, changedKey]);

/**
 * A nation's seal or logo is never saved for offline use, so that an image a
 * nation asks to withdraw stops showing at once (charter, commitment 5;
 * docs/official-images.md).
 */
const nationImage = /^\/nations\/[^/]+\/image$/;

function isNeverCached(path: string): boolean {
	return (
		// The spelling checker's WebAssembly is large and for editors only; the browser's own cache keeps it.
		path.endsWith('.wasm') ||
		nationImage.test(path) ||
		neverCached.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
	);
}

function isFallbackFont(path: string): boolean {
	return /\.woff2?$/.test(path) && !path.includes('atkinson-hyperlegible-next');
}

/** The manifest lists paths relative to the site root, without the leading slash. */
function absolute(path: string): string {
	return `/${path}`;
}

// Only the woff2 files are used by current browsers; the woff copies are a fallback for old ones.
// The spelling checker's WebAssembly (about 20 MB, src/lib/essays/harper.ts) is for editors only and is not saved for offline.
const shell = immutable
	.map((file) => absolute(file.path))
	.filter((path) => !isFallbackFont(path) && !path.endsWith('.woff') && !path.endsWith('.wasm'));
const staticFiles = assets.map((file) => absolute(file.path));
const builtPaths = new Set(prerendered.map((page) => absolute(page.path)));
const corePageFiles = corePages.flatMap((page) => [
	page,
	page === '/' ? '/__data.json' : `${page}/__data.json`
]);
const precached = [
	...shell,
	...staticFiles,
	...[
		'/manifest.webmanifest',
		'/icon.svg',
		'/glossary/terms.json',
		'/nations/previews.json',
		'/search/index.json',
		'/search/records.json',
		...corePageFiles
	].filter((path) => builtPaths.has(path))
];
const precachedSet = new Set(precached);
const shellSet = new Set(shell);

/** Every page and page data file of this build, by collection, that may be saved. */
const collectionFiles = new Map<CollectionIdentifier, string[]>(
	collections.map((collection) => [collection.id, []])
);
for (const path of builtPaths) {
	if (isNeverCached(path) || path === '/manifest.webmanifest' || path === '/icon.svg') continue;
	collectionFiles.get(collectionOf(path))?.push(path);
}

function pagesIn(files: string[]): Set<string> {
	return new Set(files.filter((path) => !path.endsWith('__data.json')).map(pageOf));
}
const cacheFirst = new Set([...shell, ...staticFiles, '/manifest.webmanifest', '/icon.svg']);

self.addEventListener('install', (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(cacheName);
			await removeWithdrawnPages();
			await carryForward(cache, await thisBuildFingerprints(cache));
			const missing: string[] = [];
			for (const path of precached) {
				if (!(await cache.match(path))) missing.push(path);
			}
			await cache.addAll(missing);
			// No skipWaiting here: the new version waits for the reader (see above).
		})()
	);
});

/**
 * This build's fingerprints: from this build's cache, or else from the
 * server, if the server still has this build. Undefined when they cannot be
 * had; then nothing is carried forward and saved files are downloaded again.
 */
async function thisBuildFingerprints(cache: Cache): Promise<Fingerprints | undefined> {
	try {
		const saved = await cache.match(fingerprintsKey);
		if (saved) return (await saved.json()) as Fingerprints;
		const response = await fetch(fingerprintsAddress, { cache: 'no-store' });
		if (!response.ok) return undefined;
		const fingerprints = (await response.clone().json()) as Fingerprints;
		if (fingerprints.version !== version) return undefined;
		await cache.put(fingerprintsKey, response);
		return fingerprints;
	} catch {
		return undefined;
	}
}

/**
 * Copies every saved file from older builds' caches whose content is the
 * same in this build, so an update downloads only what changed. Script,
 * style and font files carry a hash of their content in their names, so one
 * with a name in this build is the same file. A page or data file is the same
 * when its fingerprint, taken with the build blanked out, matches this
 * build's; a page then gets this build's version written back in, which makes
 * it the very file the server holds. Saved pages that changed are listed, so
 * the next page load saves them again from this build (offline-resume).
 * Pages read after this runs are carried forward when the update is applied.
 */
async function carryForward(cache: Cache, fingerprints: Fingerprints | undefined): Promise<void> {
	const changed = new Set(await changedPages(cache));
	// One read of this cache's addresses, rather than a lookup for each of the thousands of saved files.
	const have = new Set((await cache.keys()).map((request) => new URL(request.url).pathname));
	try {
		for (const name of await caches.keys()) {
			if (name === cacheName || !name.startsWith(cachePrefix)) continue;
			const oldVersion = name.slice(cachePrefix.length);
			const oldCache = await caches.open(name);
			for (const request of await oldCache.keys()) {
				const path = new URL(request.url).pathname;
				if (internalKeys.has(path) || have.has(path)) continue;
				const response = await oldCache.match(request);
				if (!response) continue;
				if (shellSet.has(path)) {
					await cache.put(path, response);
					have.add(path);
					continue;
				}
				const expected = fingerprints?.files[path];
				if (!fingerprints || !expected) continue;
				if ((response.headers.get('content-type') ?? '').includes('text/html')) {
					const blanked = withoutBuild(await response.text(), oldVersion);
					if ((await fingerprintOf(blanked)) === expected) {
						const page = withBuild(blanked, fingerprints.version, fingerprints.startName);
						await cache.put(path, new Response(page, { headers: { 'content-type': 'text/html; charset=utf-8' } }));
						have.add(path);
						changed.delete(path);
					} else {
						changed.add(path);
					}
				} else if ((await fingerprintOf(await response.clone().arrayBuffer())) === expected) {
					await cache.put(path, response);
					have.add(path);
					changed.delete(path);
				} else {
					changed.add(path);
				}
			}
		}
	} catch {
		// Storage or a read failed: whatever was not carried forward is downloaded again.
	}
	await setChangedPages(cache, [...changed]);
}

async function changedPages(cache: Cache): Promise<string[]> {
	const saved = await cache.match(changedKey);
	if (!saved) return [];
	try {
		return (await saved.json()) as string[];
	} catch {
		return [];
	}
}

async function setChangedPages(cache: Cache, paths: string[]): Promise<void> {
	if (paths.length === 0) {
		await cache.delete(changedKey);
		return;
	}
	await cache.put(changedKey, new Response(JSON.stringify(paths), { headers: { 'content-type': 'application/json' } }));
}

/** Saves again, from this build, the saved pages that changed in it. */
async function saveChangedPages(): Promise<void> {
	const cache = await caches.open(cacheName);
	const left: string[] = [];
	for (const path of await changedPages(cache)) {
		if (!builtPaths.has(path) || (await cache.match(path))) continue;
		try {
			const response = await fetch(path);
			if (await isFromThisBuild(response)) await cache.put(path, response);
			else left.push(path);
		} catch {
			left.push(path);
		}
	}
	await setChangedPages(cache, left);
}

/**
 * A page that is not in this build has been withdrawn or moved. It is removed
 * from every saved copy as soon as this build installs, without waiting for
 * the reader to accept the update, so a nation's request to withdraw
 * material reaches saved copies on the reader's next visit online (charter,
 * commitment 6). Scripts, styles and fonts are left alone, because the old
 * version still uses them until the reader updates.
 */
async function removeWithdrawnPages(): Promise<void> {
	for (const name of await caches.keys()) {
		if (name === cacheName) continue;
		const oldCache = await caches.open(name);
		for (const request of await oldCache.keys()) {
			const path = new URL(request.url).pathname;
			const isPage = !path.startsWith('/_app/') && !/\.[a-z0-9]+$/.test(path.replace(/\/__data\.json$/, ''));
			if (isPage && !internalKeys.has(path) && !builtPaths.has(path)) await oldCache.delete(request);
		}
	}
}

/**
 * Taking over is kept quick, because the browser holds back every request
 * from the site's pages until it is done, including the reload that follows
 * "Update now". With Nation profiles saved, the tidying below took about 20
 * seconds, and the reader watched the old page all that time. So the worker
 * only takes control here, and tidies once it has taken over.
 */
self.addEventListener('activate', (event) => {
	event.waitUntil(self.clients.claim());
	void finishUpdate();
});

let finishing: Promise<void> | undefined;

/**
 * Finishes an update once this worker has taken over: carries forward, as at
 * install, the pages the reader opened while this version waited, keeps the
 * reader's list of kept collections and the font files that have not
 * changed, and deletes the old caches. Runs once per start of the worker.
 * Requests from the page wait for it, so they see the carried files; a page
 * load does not. An old worker never runs it while a newer one is installing
 * or waiting, since it would delete the newer build's cache.
 */
function finishUpdate(): Promise<void> {
	if (self.registration.installing || self.registration.waiting) return Promise.resolve();
	finishing ??= tidyOldCaches().catch(() => {
		// Storage failed: the old caches are tidied the next time the worker starts.
	});
	return finishing;
}

async function tidyOldCaches(): Promise<void> {
	const cache = await caches.open(cacheName);
	const oldNames = (await caches.keys()).filter((name) => name !== cacheName);
	if (oldNames.length === 0) return;
	await carryForward(cache, await thisBuildFingerprints(cache));
	const currentFiles = new Set(immutable.map((file) => absolute(file.path)));
	for (const name of oldNames) {
		const oldCache = await caches.open(name);
		// Keep the reader's list of kept collections; their pages are saved
		// again from this build when a page asks (offline-resume).
		const kept = await oldCache.match(keptCollectionsKey);
		if (kept && !(await cache.match(keptCollectionsKey))) {
			await cache.put(keptCollectionsKey, kept);
		}
		// Font file names carry a hash of their content, so a saved copy
		// with a name in this build is still the same file.
		for (const request of await oldCache.keys()) {
			const path = new URL(request.url).pathname;
			if (isFallbackFont(path) && currentFiles.has(path) && !(await cache.match(path))) {
				const response = await oldCache.match(request);
				if (response) await cache.put(path, response);
			}
		}
		await caches.delete(name);
	}
}

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
			if (await isFromThisBuild(response)) await cache.put(request, response.clone());
			return response;
		})
		.catch(() => undefined);

	if (saved) return saved;
	const response = await refreshed;
	if (response) return response;

	// Offline just after an update: the page may be among those still being carried forward.
	await finishUpdate();
	const carried = await cache.match(request, { ignoreSearch: true });
	if (carried) return carried;

	if (request.mode === 'navigate') {
		const fallback = await cache.match(offlinePage);
		if (fallback) return fallback;
	}
	return new Response('Offline and not saved on this device.', {
		status: 503,
		headers: { 'content-type': 'text/plain; charset=utf-8' }
	});
}

/**
 * Whether a page or page data response may be saved in this build's cache.
 * Each built page names its build version, so a page from a newer build is
 * recognized. Once one is seen, page data is not saved either, because it
 * may need the newer build's scripts.
 */
let newerBuildSeen = false;

async function isFromThisBuild(response: Response): Promise<boolean> {
	if (!response.ok || response.type !== 'basic') return false;
	if ((response.headers.get('content-type') ?? '').includes('text/html')) {
		const fromThisBuild = (await response.clone().text()).includes(version);
		if (!fromThisBuild) newerBuildSeen = true;
		return fromThisBuild;
	}
	return !newerBuildSeen;
}

async function keptCollections(cache: Cache): Promise<Set<CollectionIdentifier>> {
	const saved = await cache.match(keptCollectionsKey);
	if (!saved) return new Set();
	try {
		return new Set((await saved.json()) as CollectionIdentifier[]);
	} catch {
		return new Set();
	}
}

async function setKept(cache: Cache, id: CollectionIdentifier, kept: boolean): Promise<void> {
	const list = await keptCollections(cache);
	if (kept) list.add(id);
	else list.delete(id);
	await cache.put(
		keptCollectionsKey,
		new Response(JSON.stringify([...list]), { headers: { 'content-type': 'application/json' } })
	);
}

async function status(): Promise<OfflineStatus> {
	const cache = await caches.open(cacheName);
	const kept = await keptCollections(cache);
	const savedPages = new Map<CollectionIdentifier, Set<string>>();
	const bytes = new Map<CollectionIdentifier, number>();
	for (const request of await cache.keys()) {
		const path = new URL(request.url).pathname;
		if (!builtPaths.has(path) || isNeverCached(path)) continue;
		const id = collectionOf(path);
		if (!path.endsWith('__data.json')) {
			savedPages.set(id, (savedPages.get(id) ?? new Set()).add(pageOf(path)));
		}
		const response = await cache.match(request);
		if (response) bytes.set(id, (bytes.get(id) ?? 0) + (await response.blob()).size);
	}
	const list: CollectionStatus[] = collections.map(({ id }) => {
		const pages = pagesIn(collectionFiles.get(id) ?? []);
		return {
			id,
			total: pages.size,
			saved: [...(savedPages.get(id) ?? [])].filter((page) => pages.has(page)).length,
			bytes: bytes.get(id) ?? 0,
			kept: kept.has(id)
		};
	});
	return { version, collections: list };
}

/** One saving job per collection at a time; later requests share it. */
const running = new Map<CollectionIdentifier, Promise<void>>();
const listeners = new Map<CollectionIdentifier, Set<MessagePort>>();

function tell(port: MessagePort | undefined, reply: WorkerReply): void {
	port?.postMessage(reply);
}

async function saveCollection(id: CollectionIdentifier): Promise<void> {
	const cache = await caches.open(cacheName);
	const files = collectionFiles.get(id) ?? [];
	const missing: string[] = [];
	for (const path of files) {
		if (!(await cache.match(path))) missing.push(path);
	}
	let done = files.length - missing.length;
	const report = () => {
		for (const port of listeners.get(id) ?? []) {
			tell(port, { type: 'progress', collection: id, done, total: files.length });
		}
	};
	report();
	// A few at a time, so reading the site stays quick while this runs.
	const queue = [...missing];
	async function next(): Promise<void> {
		const path = queue.shift();
		if (!path) return;
		const response = await fetch(path);
		if (!(await isFromThisBuild(response))) {
			throw new Error(newerBuildSeen ? 'newer-build' : `Could not save ${path}`);
		}
		await cache.put(path, response);
		done += 1;
		if (done % 10 === 0 || queue.length === 0) report();
		return next();
	}
	await Promise.all(Array.from({ length: 6 }, next));
	report();
}

function runSave(id: CollectionIdentifier, port: MessagePort | undefined): Promise<void> {
	if (port) listeners.set(id, (listeners.get(id) ?? new Set()).add(port));
	let job = running.get(id);
	if (!job) {
		job = saveCollection(id).finally(() => {
			running.delete(id);
			listeners.delete(id);
		});
		running.set(id, job);
	}
	return job;
}

async function removeCollection(id: CollectionIdentifier): Promise<void> {
	const cache = await caches.open(cacheName);
	await setKept(cache, id, false);
	await setChangedPages(cache, (await changedPages(cache)).filter((path) => collectionOf(path) !== id));
	for (const request of await cache.keys()) {
		const path = new URL(request.url).pathname;
		if (builtPaths.has(path) && collectionOf(path) === id && !precachedSet.has(path)) {
			await cache.delete(request);
		}
	}
}

function failure(error: unknown): WorkerReply {
	const message = error instanceof Error ? error.message : String(error);
	return { type: 'failed', message };
}

async function answer(request: WorkerRequest, port: MessagePort | undefined): Promise<void> {
	try {
		if (request.type === 'skip-waiting') {
			await self.skipWaiting();
			return;
		}
		// The first request after an update waits until the old caches are tidied.
		await finishUpdate();
		switch (request.type) {
			case 'offline-status':
				break;
			case 'offline-save': {
				await setKept(await caches.open(cacheName), request.collection, true);
				await runSave(request.collection, port);
				break;
			}
			case 'offline-remove':
				await removeCollection(request.collection);
				break;
			case 'offline-resume': {
				await saveChangedPages();
				const kept = await keptCollections(await caches.open(cacheName));
				for (const id of kept) await runSave(id, port);
				break;
			}
		}
		tell(port, { type: 'status', status: await status() });
	} catch (error) {
		tell(port, failure(error));
	}
}

self.addEventListener('message', (event) => {
	const request = event.data as WorkerRequest;
	const port = event.ports[0];
	// waitUntil keeps the worker running until a long save finishes.
	event.waitUntil(answer(request, port));
});

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
