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
	documentsCacheName,
	isDocumentSet,
	listAddress,
	type DocumentFile,
	type DocumentSet,
	type DocumentSetList,
	type DocumentSetStatus,
	type DocumentsStatus
} from '#lib/offline-documents.ts';
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
// Copies of public documents (/copies/) can be large and are read in parts, so the browser fetches them itself,
// unless the reader saved them (see copyResponse below).
// Map tiles (/map-tiles/) are many and never change under their address, so the browser's own cache keeps them;
// all of them come to over 2 GB, and offline the drawn map takes their place.
const neverCached = [
	'/workspace',
	'/sign-in',
	'/sign-out',
	'/requests',
	'/following',
	'/account',
	'/edition.json',
	fingerprintsAddress,
	'/_app/version.json',
	'/copies',
	'/map-tiles',
	// ZIP downloads (/zip/) are files to keep, not pages to read offline.
	'/zip',
	// A quotation's paragraph depends on the words asked about, which saved pages match without (ignoreSearch).
	'/quote-context'
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
/** Pictures a nation's team added to its page: never saved, for the same reason (decision record 0041). */
const nationPicture = /^\/nations\/[^/]+\/pictures\//;
/**
 * A nation's page, and what its team published on it (changes.json): from the
 * network whenever there is one, so a part the nation hid, or a change the
 * project undid, is gone the next time the page is opened. The saved copy
 * answers only offline.
 */
const nationLive = /^\/nations\/[^/.]+\/?(?:changes\.json)?$/;

/** Mirrored in tools/write-offline-sizes.mjs. */
const downloadOnly = /\.(ris|bib|vcf|geojson)$/;

function isNeverCached(path: string): boolean {
	return (
		// The spelling checker's WebAssembly is large and for editors only; the browser's own cache keeps it.
		path.endsWith('.wasm') ||
		// Files made to be downloaded into other programs, not read on the site: citation files, contact cards, map layers.
		downloadOnly.test(path) ||
		nationImage.test(path) ||
		nationPicture.test(path) ||
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
			await removeWithdrawnDocuments();
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
		if (name === cacheName || name === documentsCacheName) continue;
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
	// Saved copies of documents keep their own cache across builds (src/lib/offline-documents.ts).
	const oldNames = (await caches.keys()).filter((name) => name !== cacheName && name !== documentsCacheName);
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

	if (nationLive.test(url.pathname)) {
		try {
			const response = await fetch(request);
			if (await isFromThisBuild(response)) await cache.put(request, response.clone());
			return response;
		} catch {
			// Offline: the saved copy below, as for any page.
		}
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
	// Video and sound play only online (site/DESIGN.md, section 10): they are large, and a part
	// of a file (206) cannot be saved anyway.
	const type = response.headers.get('content-type') ?? '';
	if (response.status === 206 || type.startsWith('video/') || type.startsWith('audio/')) return false;
	if (type.includes('text/html')) {
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

// Copies of documents saved for offline reading (src/lib/offline-documents.ts). They live in their
// own cache, so an update does not download them again. Not real addresses: the sets the reader
// keeps, the sets whose saving is unfinished, and each set's list as last read.
const keptDocumentsKey = '/__kept-documents';
const pendingDocumentsKey = '/__pending-documents';
const fingerprintHeader = 'x-copy-fingerprint';

function documentListKey(set: DocumentSet): string {
	return `/__document-list/${set}`;
}

async function readSets(cache: Cache, key: string): Promise<DocumentSet[]> {
	const saved = await cache.match(key);
	if (!saved) return [];
	try {
		return ((await saved.json()) as unknown[]).filter(isDocumentSet);
	} catch {
		return [];
	}
}

async function writeSets(cache: Cache, key: string, sets: DocumentSet[]): Promise<void> {
	await cache.put(key, new Response(JSON.stringify([...new Set(sets)]), { headers: { 'content-type': 'application/json' } }));
}

async function pendingSets(): Promise<DocumentSet[]> {
	return readSets(await caches.open(documentsCacheName), pendingDocumentsKey);
}

/**
 * A set's list of copies: from the network when fresh is asked for (and kept for offline use), else
 * the one kept last time. A set the build no longer lists has no copies left.
 */
async function documentList(cache: Cache, set: DocumentSet, fresh: boolean): Promise<DocumentSetList | undefined> {
	if (fresh) {
		try {
			const response = await fetch(listAddress(set), { cache: 'no-store' });
			if (response.ok) {
				await cache.put(documentListKey(set), response.clone());
				return (await response.json()) as DocumentSetList;
			}
			if (response.status === 404) {
				await cache.delete(documentListKey(set));
				return { title: '', files: [] };
			}
		} catch {
			// Offline: fall back on the list kept last time.
		}
	}
	const saved = await cache.match(documentListKey(set));
	return saved ? ((await saved.json()) as DocumentSetList) : undefined;
}

/** The addresses of the copies saved on this device. */
async function savedCopies(cache: Cache): Promise<Set<string>> {
	return new Set(
		(await cache.keys()).map((request) => new URL(request.url).pathname).filter((path) => !path.startsWith('/__'))
	);
}

async function documentsStatus(asked: DocumentSet[]): Promise<DocumentsStatus> {
	const cache = await caches.open(documentsCacheName);
	const kept = await readSets(cache, keptDocumentsKey);
	const saved = await savedCopies(cache);
	const sets: DocumentSetStatus[] = [];
	for (const set of new Set([...kept, ...asked])) {
		const list = (await documentList(cache, set, false)) ?? (await documentList(cache, set, true));
		const files = list?.files ?? [];
		const savedFiles = files.filter(([path]) => saved.has(path));
		sets.push({
			set,
			title: list?.title ?? '',
			total: files.length,
			saved: savedFiles.length,
			bytes: savedFiles.reduce((total, [, bytes]) => total + bytes, 0),
			totalBytes: files.reduce((total, [, bytes]) => total + bytes, 0),
			kept: kept.includes(set)
		});
	}
	return { sets };
}

const documentJobs = new Map<DocumentSet, Promise<void>>();
const documentListeners = new Map<DocumentSet, Set<MessagePort>>();

/** Saves a set's copies not yet on this device, four at a time, since some are large. */
async function saveDocumentSet(set: DocumentSet): Promise<void> {
	const cache = await caches.open(documentsCacheName);
	await writeSets(cache, keptDocumentsKey, [...(await readSets(cache, keptDocumentsKey)), set]);
	await writeSets(cache, pendingDocumentsKey, [...(await readSets(cache, pendingDocumentsKey)), set]);
	const list = await documentList(cache, set, true);
	if (!list) throw new Error('Could not read the list of documents');
	const saved = await savedCopies(cache);
	const queue: DocumentFile[] = list.files.filter(([path]) => !saved.has(path));
	let done = list.files.length - queue.length;
	let failed = 0;
	const report = () => {
		for (const port of documentListeners.get(set) ?? []) {
			tell(port, { type: 'documents-progress', set, done, total: list.files.length });
		}
	};
	report();
	async function next(): Promise<void> {
		const file = queue.shift();
		if (!file) return;
		const [path, , fingerprint] = file;
		try {
			// A copy the bucket lacks is a redirect to the original, which is not saved.
			const response = await fetch(path, { redirect: 'manual' });
			if (response.status === 200 && response.type === 'basic') {
				const headers = new Headers(response.headers);
				headers.set(fingerprintHeader, fingerprint);
				await cache.put(path, new Response(response.body, { status: 200, headers }));
				done += 1;
			} else {
				failed += 1;
			}
		} catch {
			failed += 1;
		}
		if (done % 5 === 0 || queue.length === 0) report();
		return next();
	}
	await Promise.all(Array.from({ length: 4 }, next));
	report();
	if (failed === 0) {
		await writeSets(cache, pendingDocumentsKey, (await readSets(cache, pendingDocumentsKey)).filter((item) => item !== set));
	}
}

function runDocumentSave(set: DocumentSet, port: MessagePort | undefined): Promise<void> {
	if (port) documentListeners.set(set, (documentListeners.get(set) ?? new Set()).add(port));
	let job = documentJobs.get(set);
	if (!job) {
		job = saveDocumentSet(set).finally(() => {
			documentJobs.delete(set);
			documentListeners.delete(set);
		});
		documentJobs.set(set, job);
	}
	return job;
}

/** Removes a set's copies, except those another kept set also holds. */
async function removeDocumentSet(set: DocumentSet): Promise<void> {
	const cache = await caches.open(documentsCacheName);
	const kept = (await readSets(cache, keptDocumentsKey)).filter((item) => item !== set);
	await writeSets(cache, keptDocumentsKey, kept);
	await writeSets(cache, pendingDocumentsKey, (await readSets(cache, pendingDocumentsKey)).filter((item) => item !== set));
	const stillWanted = new Set<string>();
	for (const other of kept) {
		for (const [path] of (await documentList(cache, other, false))?.files ?? []) stillWanted.add(path);
	}
	const list = await documentList(cache, set, false);
	for (const [path] of list?.files ?? []) {
		if (!stillWanted.has(path)) await cache.delete(path);
	}
	await cache.delete(documentListKey(set));
}

/**
 * Deletes every saved copy that the new build no longer lists, or lists with other content, as the
 * new build installs: a nation's request to remove a document reaches saved copies on the reader's
 * next visit online (charter, commitment 6). Nothing is deleted unless every kept set's new list
 * could be read. The kept sets are marked unfinished, so the next page load saves their new copies.
 */
async function removeWithdrawnDocuments(): Promise<void> {
	try {
		if (!(await caches.has(documentsCacheName))) return;
		const cache = await caches.open(documentsCacheName);
		const kept = await readSets(cache, keptDocumentsKey);
		const listed = new Map<string, string>();
		for (const set of kept) {
			const response = await fetch(listAddress(set), { cache: 'no-store' });
			if (response.status === 404) continue;
			if (!response.ok) return;
			// The new build's list is not kept yet: the old version, still in charge, reads the old one.
			for (const [path, , fingerprint] of ((await response.json()) as DocumentSetList).files) listed.set(path, fingerprint);
		}
		for (const request of await cache.keys()) {
			const path = new URL(request.url).pathname;
			if (path.startsWith('/__')) continue;
			const saved = await cache.match(request);
			if (listed.get(path) !== saved?.headers.get(fingerprintHeader)) await cache.delete(request);
		}
		await writeSets(cache, pendingDocumentsKey, kept);
	} catch {
		// Offline or storage refused: tried again with the next build.
	}
}

/** A copy of a document: the saved one if the reader saved it, else from the network. */
async function copyResponse(request: Request): Promise<Response> {
	const path = new URL(request.url).pathname;
	if (await caches.has(documentsCacheName)) {
		const saved = await (await caches.open(documentsCacheName)).match(path);
		if (saved) return saved;
	}
	return request.mode === 'navigate' ? networkOnly(request) : fetch(request);
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
				// Copies of documents are large, so only sets left unfinished are saved again here.
				for (const set of await pendingSets()) await runDocumentSave(set, undefined).catch(() => undefined);
				break;
			}
			case 'documents-status':
			case 'documents-save':
			case 'documents-remove': {
				const sets = request.type === 'documents-status' ? request.sets.filter(isDocumentSet) : [request.set];
				if (request.type === 'documents-save' && isDocumentSet(request.set)) {
					await runDocumentSave(request.set, port);
				}
				if (request.type === 'documents-remove' && isDocumentSet(request.set)) {
					await removeDocumentSet(request.set);
				}
				tell(port, { type: 'documents', status: await documentsStatus(sets) });
				return;
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
	// A saved copy of a document answers offline; any other copy comes from the network.
	if (url.pathname.startsWith('/copies/') && !url.pathname.startsWith('/copies/list') && !url.pathname.startsWith('/copies/offline')) {
		event.respondWith(copyResponse(event.request));
		return;
	}
	if (isNeverCached(url.pathname)) {
		// Never saved, but a page opened offline still gets the site's own
		// offline page rather than the browser's error page.
		if (event.request.mode === 'navigate') event.respondWith(networkOnly(event.request));
		return;
	}
	event.respondWith(respond(event.request));
});
