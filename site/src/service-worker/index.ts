/**
 * Service worker: lets the site be read offline (site/DESIGN.md, section 10).
 *
 * - On install, saves the core pages with the scripts and styles they load,
 *   the reader tools they open on demand, the Atkinson Hyperlegible Next
 *   fonts and the static files (src/lib/offline-shell.ts). Other scripts and
 *   styles are saved the first time a page uses them, and those a saved
 *   collection's pages load are saved with the collection.
 * - Other pages are saved as they are read and refreshed in the background
 *   the next time they are opened online (stale while revalidate).
 * - Noto fallback fonts, and the fonts a reader can pick in Settings, are
 *   saved when a page first uses them. A new build keeps the ones already
 *   saved whose files have not changed, so a font picked earlier still
 *   works offline after an update.
 * - A reader can save a whole collection at once from Settings ("Saved for
 *   offline", src/lib/offline-collections.ts). The worker remembers which
 *   collections the reader keeps, so it saves them again after an update.
 *   After an update it downloads, on its own, only the kept pages that
 *   changed, a few pages new to a kept collection (automaticTopUp), and the
 *   rest of a save the reader started that was cut short. A collection that
 *   gained many pages waits until the reader saves it again.
 *   The list of every built page is a separate file, read only for saving
 *   and showing collections (builtPaths below), not part of this script.
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
import { assets, immutable } from '$app/manifest';
import { self } from '$app/service-worker';
import { builtPathsAddress, installFiles } from 'virtual:offline-files';
import { copyPagePrefix } from '#lib/public-copies.ts';
import { pageOf, type WorkerReply, type WorkerRequest } from '#lib/offline-collections.ts';
import {
	applyChoice,
	catalogAddress,
	catalogIndexAddress,
	catalogPageOf,
	catalogTree,
	chosenPages,
	filesOf,
	type Catalog,
	type CatalogIndexEntry,
	type CatalogNode,
	type CatalogPage,
	type ChoiceChange,
	type Choices,
	type ChoicesStatus,
	type NodeState,
	type PageChoice,
	type PageState
} from '#lib/offline-choices.ts';
import {
	documentsCacheName,
	isDocumentSet,
	listAddress,
	nationSet,
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
import { corePages, offlinePage, scriptsIn } from '#lib/offline-shell.ts';
import { sendProblem } from '#lib/problem-reports.ts';

const cacheName = cacheNameOf(version);
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
	'/quote-context',
	// The data the Worker draws case, law, biography and Supreme Court pages from (src/lib/server/page-data.ts); the pages themselves are saved as they are read.
	'/page-data',
	// The search on the server (src/routes/search/query): its answer depends on the words asked, which saved pages match without (ignoreSearch), and offline the files on the device answer instead.
	'/search/query',
	// For search engines, not readers (src/lib/sitemap.ts, src/lib/search-engines.ts).
	'/robots.txt',
	'/sitemap.xml',
	'/sitemaps'
];
/** Not a real address: the collections a device kept before the outline replaced them, read once and replaced by choicesKey. */
const keptCollectionsKey = '/__kept-collections';
/** Not a real address: the parts, groups and pages the reader chose to save (readChoices). */
const choicesKey = '/__chosen';
/** This build's fingerprints, stored in its cache so the page can compare builds. */
const fingerprintsKey = savedFingerprintsKey;
/** Not a real address: present while a save the reader asked for has not finished. */
const unfinishedKey = '/__unfinished';
/** Not a real address: present once this build has saved the pages new to what the reader chose (offline-resume). */
const toppedUpKey = '/__topped-up';
/** Not a real address: saved pages that changed in this build, to download again. */
const changedKey = '/__changed';
/** Not a real address: this build's list of prerendered files, once read (builtPaths). */
const builtPathsKey = '/__built-paths';
const internalKeys = new Set([keptCollectionsKey, choicesKey, unfinishedKey, toppedUpKey, '/__unfinished-collections', fingerprintsKey, changedKey, builtPathsKey]);
/**
 * The most files an update downloads on its own to fill in a kept
 * collection: a few new nations or glossary entries, not a new section of
 * the site. "Other pages" once grew from a few dozen pages to nearly 2,000
 * when cases and biographies were added, and every reader who had kept it
 * was sent all of them without asking (Nov. 24, 2026). Beyond this, Settings
 * shows the pages not yet saved and the reader decides.
 */
const automaticTopUp = 100;

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
// Each of these is saved the first time it is used, if not on install.
const shell = immutable
	.map((file) => absolute(file.path))
	.filter((path) => !isFallbackFont(path) && !path.endsWith('.woff') && !path.endsWith('.wasm'));
const staticFiles = assets.map((file) => absolute(file.path));
const staticFileSet = new Set(staticFiles);
// On install: the Atkinson Hyperlegible Next fonts (the only woff2 files in the shell), the static files,
// and the core pages and reader tools this build has (src/lib/offline-shell.ts). The scripts and styles
// the core pages load are added from the saved pages themselves (saveScriptsOf).
const precached = [...shell.filter((path) => path.endsWith('.woff2')), ...staticFiles, ...installFiles];
const precachedSet = new Set(precached);
const shellSet = new Set(shell);

let builtPathsRead: Promise<Set<string>> | undefined;

/**
 * Every prerendered file of this build. The list is a separate file (the offline-files plugin in vite.config.ts), read the first time it is needed and kept in this build's cache, so the worker's own script stays small and a reader who never saves a collection never downloads it.
 */
function builtPaths(): Promise<Set<string>> {
	builtPathsRead ??= readBuiltPaths().catch((error: unknown) => {
		builtPathsRead = undefined;
		throw error;
	});
	return builtPathsRead;
}

async function readBuiltPaths(): Promise<Set<string>> {
	if (!builtPathsAddress) return new Set();
	const cache = await caches.open(cacheName);
	const saved = await cache.match(builtPathsKey);
	if (saved) return new Set((await saved.json()) as string[]);
	const response = await fetch(builtPathsAddress).catch(() => /* expected: offline; collections show without the list of built pages until it can be read. */ undefined);
	if (response?.ok) {
		await cache.put(builtPathsKey, response.clone());
		return new Set((await response.json()) as string[]);
	}
	// Offline before the list was ever read: the fingerprints kept on install name the same files a reader may
	// save (tools/write-offline-sizes.mjs), which is all the collections need. They are not kept as the list.
	const fingerprints = await cache.match(fingerprintsKey);
	if (fingerprints) {
		const files = Object.keys(((await fingerprints.json()) as Fingerprints).files);
		builtPathsRead = undefined;
		return new Set(files.filter((path) => !staticFileSet.has(path) && !path.split('/').pop()?.startsWith('.')));
	}
	throw new Error('The list of this build’s pages could not be read.');
}

/** Saves those of these built scripts and styles that are not saved yet. */
async function saveMissing(cache: Cache, paths: Iterable<string>): Promise<void> {
	const missing: string[] = [];
	for (const path of paths) {
		if (shellSet.has(path) && !(await cache.match(path))) missing.push(path);
	}
	await cache.addAll(missing);
}

/** Saves the scripts and styles these saved pages load, as their HTML names them. */
async function saveScriptsOf(cache: Cache, pages: Iterable<string>): Promise<void> {
	const wanted = new Set<string>();
	for (const page of pages) {
		const saved = await cache.match(page);
		if (!saved || !(saved.headers.get('content-type') ?? '').includes('text/html')) continue;
		for (const path of scriptsIn(await saved.text())) wanted.add(path);
	}
	await saveMissing(cache, wanted);
}

/** Adds the scripts and styles a page about to be saved loads to `wanted`. */
async function noteScriptsOf(response: Response, wanted: Set<string>): Promise<void> {
	if (!(response.headers.get('content-type') ?? '').includes('text/html')) return;
	for (const path of scriptsIn(await response.clone().text())) wanted.add(path);
}

const cacheFirst = new Set([...shell, ...staticFiles, '/manifest.webmanifest', '/icon.svg']);

self.addEventListener('install', (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(cacheName);
			const fingerprints = await thisBuildFingerprints(cache);
			await removeWithdrawnPages(fingerprints);
			await removeWithdrawnDocuments();
			await carryForward(cache, fingerprints);
			const missing: string[] = [];
			for (const path of precached) {
				if (!(await cache.match(path))) missing.push(path);
			}
			await cache.addAll(missing);
			await saveScriptsOf(cache, corePages);
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
	} catch (problem) {
		// Without them every kept page counts as changed; offline is only noted (sendProblem).
		sendProblem(problem, { code: 'offline.fingerprints' });
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
				if (fingerprints && !expected && (await carryDrawnPage(cache, oldCache, oldVersion, path, response, fingerprints))) {
					have.add(path);
					changed.delete(path);
					continue;
				}
				if (fingerprints?.onRequest?.[pageOf(path)]) changed.add(path);
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
	} catch (problem) {
		// Whatever was not carried forward is downloaded again.
		sendProblem(problem, { code: 'offline.carry-forward' });
	}
	await setChangedPages(cache, [...changed]);
}

const oldFingerprints = new Map<string, Promise<Fingerprints | undefined>>();

/**
 * Carries a saved page the Worker drew on request (src/lib/server/page-data.ts), or its __data.json, into this build:
 * such a page has no built file to compare, so it is the same when the page data it was drawn from is the same in both
 * builds and every script and style its HTML loads is in this build. It is not carried otherwise, and a page that
 * changed is listed to be saved again (carryForward).
 */
async function carryDrawnPage(cache: Cache, oldCache: Cache, oldVersion: string, path: string, response: Response, fingerprints: Fingerprints): Promise<boolean> {
	const page = pageOf(path);
	const expected = fingerprints.onRequest?.[page];
	if (!expected) return false;
	let before = oldFingerprints.get(oldVersion);
	if (!before) {
		before = oldCache
			.match(fingerprintsKey)
			.then(async (saved) => (saved ? ((await saved.json()) as Fingerprints) : undefined))
			.catch(() => /* expected: an old cache that cannot be read means the page is fetched again. */ undefined);
		oldFingerprints.set(oldVersion, before);
	}
	if ((await before)?.onRequest?.[page] !== expected) return false;
	if (!(response.headers.get('content-type') ?? '').includes('text/html')) {
		await cache.put(path, response);
		return true;
	}
	const text = await response.text();
	if (!scriptsIn(text).every((script) => shellSet.has(script))) return false;
	const drawn = withBuild(withoutBuild(text, oldVersion), fingerprints.version, fingerprints.startName);
	await cache.put(path, new Response(drawn, { headers: { 'content-type': 'text/html; charset=utf-8' } }));
	return true;
}

async function changedPages(cache: Cache): Promise<string[]> {
	const saved = await cache.match(changedKey);
	if (!saved) return [];
	try {
		return (await saved.json()) as string[];
	} catch {
		// expected: a list that cannot be read means no page is waiting to change.
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

/**
 * Saves again, from this build, the saved pages that changed in it, with the scripts and styles they load. Every page listed has a fingerprint in this build (carryForward), so it is a page of this build.
 */
async function saveChangedPages(): Promise<void> {
	const cache = await caches.open(cacheName);
	const left: string[] = [];
	const scripts = new Set<string>();
	for (const path of await changedPages(cache)) {
		if (await cache.match(path)) continue;
		try {
			const response = await fetch(path);
			if (await isFromThisBuild(response)) {
				await noteScriptsOf(response, scripts);
				await cache.put(path, response);
			} else left.push(path);
		} catch {
			// expected: offline; the page is left for the next update to fetch.
			left.push(path);
		}
	}
	await setChangedPages(cache, left);
	// A script that cannot be saved now is saved the first time the page is read online.
	await saveMissing(cache, scripts).catch(() => /* expected: a script that cannot be saved now is saved the first time the page is read online. */ undefined);
}

/**
 * A page that is not in this build has been withdrawn or moved. It is removed
 * from every saved copy as soon as this build installs, without waiting for
 * the reader to accept the update, so a nation's request to withdraw
 * material reaches saved copies on the reader's next visit online (charter,
 * commitment 6). Scripts, styles and fonts are left alone, because the old
 * version still uses them until the reader updates.
 */
async function removeWithdrawnPages(fingerprints: Fingerprints | undefined): Promise<void> {
	let isBuilt: ((path: string) => boolean) | undefined;
	for (const name of await caches.keys()) {
		if (name === cacheName || name === documentsCacheName) continue;
		const oldCache = await caches.open(name);
		for (const request of await oldCache.keys()) {
			const path = new URL(request.url).pathname;
			const isPage = !path.startsWith('/_app/') && !/\.[a-z0-9]+$/.test(path.replace(/\/__data\.json$/, ''));
			if (!isPage || internalKeys.has(path)) continue;
			isBuilt ??= await builtPageCheck(fingerprints);
			if (!isBuilt(path)) await oldCache.delete(request);
		}
	}
}

/**
 * Whether a saved page is in this build. The fingerprints, which install reads anyway, name every page a reader may save, which is every page a cache can hold (tools/write-offline-sizes.mjs), so the list of built files is read only when they could not be had. When neither can be read, installing fails and the browser tries again later, so no withdrawn page is kept.
 */
async function builtPageCheck(fingerprints: Fingerprints | undefined): Promise<(path: string) => boolean> {
	if (fingerprints) return (path) => Object.hasOwn(fingerprints.files, path) || Object.hasOwn(fingerprints.onRequest ?? {}, pageOf(path));
	const built = await builtPaths();
	return (path) => built.has(path);
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
	finishing ??= tidyOldCaches().catch((problem) => {
		// The old caches are tidied the next time the worker starts.
		sendProblem(problem, { code: 'offline.tidy' });
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
		// Keep the reader's choices, and whether a save was cut short; the chosen
		// pages are saved again from this build when a page asks (offline-resume).
		for (const key of [choicesKey, keptCollectionsKey, unfinishedKey]) {
			const list = await oldCache.match(key);
			if (list && !(await cache.match(key))) await cache.put(key, list);
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
			// expected: offline: the saved copy below, as for any page.
		}
	}

	// Pages and page data: answer from the saved copy at once, refresh it in the background.
	const saved = await cache.match(request, { ignoreSearch: true });
	const refreshed = fetch(request)
		.then(async (response) => {
			if (await isFromThisBuild(response)) await cache.put(request, response.clone());
			return response;
		})
		.catch(() => /* expected: offline; the saved copy, or the offline page, answers below. */ undefined);

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

function tell(port: MessagePort | undefined, reply: WorkerReply): void {
	port?.postMessage(reply);
}

/** A list stored in a cache under a made-up address. */
async function readList<Item>(cache: Cache, key: string): Promise<Item[]> {
	const saved = await cache.match(key);
	if (!saved) return [];
	try {
		const list = (await saved.json()) as unknown;
		return Array.isArray(list) ? (list as Item[]) : [];
	} catch {
		// expected: a list that cannot be read counts as empty.
		return [];
	}
}

function json(value: unknown): Response {
	return new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });
}

/**
 * The parts, groups and pages the reader chose, kept in this build's cache and carried to the next build. A device
 * that kept whole collections before the outline (Nov. 26, 2026) starts from the parts they became.
 */
async function readChoices(cache: Cache): Promise<Choices> {
	const saved = await cache.match(choicesKey);
	if (saved) {
		try {
			const choices = (await saved.json()) as Choices;
			if (Array.isArray(choices.nodes) && Array.isArray(choices.pages)) return choices;
		} catch {
			// expected: unreadable: as if nothing were chosen.
		}
		return { nodes: [], pages: [] };
	}
	const kept = await readList<string>(cache, keptCollectionsKey);
	const parts: Record<string, string[]> = { nations: ['nations'], cases: ['cases', 'supreme-court', 'biographies'], stories: ['stories'], glossary: ['glossary'], other: ['other'] };
	return { nodes: kept.flatMap((id) => parts[id] ?? []), pages: [] };
}

async function writeChoices(cache: Cache, choices: Choices): Promise<void> {
	await cache.put(choicesKey, json({ nodes: [...new Set(choices.nodes)], pages: [...new Set(choices.pages)] }));
	await cache.delete(keptCollectionsKey);
}

let catalogRead: Promise<Catalog> | undefined;
const listsRead = new Map<string, Promise<CatalogPage[]>>();
let indexRead: Promise<Map<string, string>> | undefined;

/** A file of this build's catalog: the saved copy, else from the network, then saved in this build's cache. */
async function catalogFile<Kind>(address: string): Promise<Kind> {
	const cache = await caches.open(cacheName);
	const saved = await cache.match(address);
	if (saved) return (await saved.json()) as Kind;
	const response = await fetch(address);
	if (!response.ok) throw new Error(`Could not read ${address}`);
	await cache.put(address, response.clone());
	return (await response.json()) as Kind;
}

/** The outline of what can be saved in this build (tools/write-offline-catalog.mjs). */
function catalog(): Promise<Catalog> {
	catalogRead ??= catalogFile<Catalog>(catalogAddress)
		.then(async (read) => {
			if (read.version === version) return read;
			// The server has a newer build: its pages would need scripts this version lacks.
			await (await caches.open(cacheName)).delete(catalogAddress);
			newerBuildSeen = true;
			throw new Error('newer-build');
		})
		.catch((error: unknown) => {
			catalogRead = undefined;
			throw error;
		});
	return catalogRead;
}

function listOf(node: CatalogNode): Promise<CatalogPage[]> {
	if (!node.list) return Promise.resolve([]);
	const address = node.list;
	let read = listsRead.get(address);
	if (!read) {
		read = catalogFile<CatalogPage[]>(address).catch((error: unknown) => {
			listsRead.delete(address);
			throw error;
		});
		listsRead.set(address, read);
	}
	return read;
}

/** Every list of the catalog, by node key. */
async function allLists(read: Catalog): Promise<Record<string, CatalogPage[]>> {
	const lists: Record<string, CatalogPage[]> = {};
	const nodes = catalogTree(read, {}).listNodes();
	// A few at a time: the lists are small, but there are a few hundred.
	const queue = [...nodes];
	async function next(): Promise<void> {
		const node = queue.shift();
		if (!node) return;
		lists[node.key] = await listOf(node);
		return next();
	}
	await Promise.all(Array.from({ length: 8 }, next));
	return lists;
}

/** Each page's list, from the finder's index, for the save button at the top of a page. */
function pageLists(): Promise<Map<string, string>> {
	indexRead ??= catalogFile<CatalogIndexEntry[]>(catalogIndexAddress)
		.then((entries) => new Map(entries.map(([path, , list]) => [path, list])))
		.catch((error: unknown) => {
			indexRead = undefined;
			throw error;
		});
	return indexRead;
}

function isDocumentKey(key: string): boolean {
	return key === 'documents' || key.startsWith('documents-') || key.startsWith('/copies/') || key.endsWith('#documents');
}

/** The document set a nation's entry in the outline stands for: "/nations/x#documents" is "nation:x". */
function setOfEntry(path: string): DocumentSet | undefined {
	const match = /^\/nations\/([a-z0-9-]+)#documents$/.exec(path);
	return match ? nationSet(match[1]) : undefined;
}

/** The pages saved in this build's cache, by address. */
async function savedPaths(cache: Cache): Promise<Set<string>> {
	return new Set((await cache.keys()).map((request) => new URL(request.url).pathname));
}

/** The saved pages the waiting update changes (its carryForward lists them in its own cache), if one waits. */
async function waitingChanges(): Promise<Set<string> | undefined> {
	if (!self.registration.waiting) return undefined;
	for (const name of await caches.keys()) {
		if (name === cacheName || !name.startsWith(cachePrefix)) continue;
		return new Set(await changedPages(await caches.open(name)));
	}
	return new Set();
}

async function choicesStatus(): Promise<ChoicesStatus> {
	const cache = await caches.open(cacheName);
	const read = await catalog();
	const lists = await allLists(read);
	const tree = catalogTree(read, lists);
	const choices = await readChoices(cache);
	const chosen = chosenPages(choices, read, lists);
	const saved = await savedPaths(cache);
	const changes = await waitingChanges();
	const documents = await documentChoices();
	const nodes: Record<string, NodeState> = {};
	const pages: Record<string, PageState> = {};
	const readPages = { pages: 0, bytes: 0 };
	const waiting = { changedPages: 0, bytes: 0 };
	let missing = 0;
	const add = (key: string, count: number, bytes: number, changed: boolean) => {
		for (const at of [key, ...tree.above(key)]) {
			const state = (nodes[at] ??= { chosen: 0, bytes: 0 });
			state.chosen += count;
			state.bytes += bytes;
			if (changed) state.changed = (state.changed ?? 0) + 1;
		}
	};
	for (const node of tree.listNodes()) {
		for (const page of lists[node.key] ?? []) {
			if (isDocumentKey(node.key)) {
				const status = documents.statusOf(page);
				if (status.chosen) pages[page.path] = { chosen: true };
				if (status.saved > 0) add(node.key, status.saved, status.bytes, false);
				continue;
			}
			const whole = filesOf(page).length > 0 && filesOf(page).every((file) => saved.has(file));
			const some = filesOf(page).some((file) => saved.has(file));
			const isChosen = chosen.has(page.path);
			const changed = changes !== undefined && filesOf(page).some((file) => changes.has(file));
			if (changed) {
				waiting.changedPages += 1;
				waiting.bytes += page.bytes;
			}
			if (isChosen) {
				pages[page.path] = { chosen: true, ...(changed ? { changed: true } : {}) };
				if (whole) add(node.key, 1, page.bytes, changed);
				else missing += 1;
			} else if (some) {
				pages[page.path] = { read: true, ...(changed ? { changed: true } : {}) };
				readPages.pages += 1;
				readPages.bytes += page.bytes;
			}
		}
	}
	if (saving) {
		for (const key of saving.keys) {
			const state = (nodes[key] ??= { chosen: 0, bytes: 0 });
			state.saving = { done: saving.done, total: saving.total };
		}
	}
	return { version, nodes, pages, read: readPages, ...(changes ? { waiting } : {}), missing, choices };
}

/** The pages and files the choices hold that are not saved yet. */
async function missingChosen(cache: Cache): Promise<{ pages: CatalogPage[]; files: number }> {
	const read = await catalog();
	const lists = await allLists(read);
	const saved = await savedPaths(cache);
	const pages = [...chosenPages(await readChoices(cache), read, lists).values()].filter(
		(page) => !isDocumentKey(page.path) && filesOf(page).some((file) => !saved.has(file))
	);
	return { pages, files: pages.reduce((total, page) => total + filesOf(page).filter((file) => !saved.has(file)).length, 0) };
}

/** The save running now, if any: the outline's nodes it is for, and how far it has come in pages. */
let saving: { keys: string[]; done: number; total: number } | undefined;
let savingJob: Promise<void> | undefined;
/** Pages to save, by address, as the choices stood when the job last looked. Removing a page takes it out. */
let stillChosen = new Set<string>();
const savingListeners = new Set<MessagePort>();

function reportSaving(): void {
	if (!saving) return;
	for (const port of savingListeners) tell(port, { type: 'choices-progress', done: saving.done, total: saving.total });
}

/**
 * Saves every chosen page not saved yet, six files at a time, so reading stays quick while it runs. Another change
 * while it runs is taken in: pages chosen meanwhile are saved too, and pages removed meanwhile are skipped.
 */
function saveChosen(keys: string[], port: MessagePort | undefined): Promise<void> {
	if (port) savingListeners.add(port);
	if (saving) saving.keys = [...new Set([...saving.keys, ...keys])];
	savingJob ??= (async () => {
		const cache = await caches.open(cacheName);
		await writeFlag(cache, unfinishedKey, true);
		saving = { keys, done: 0, total: 0 };
		// Again until nothing chosen is missing, which takes in pages chosen while it ran; a round that saved nothing ends it.
		let lastRound = '';
		for (;;) {
			const { pages } = await missingChosen(cache);
			const round = pages.map((page) => page.path).join('\n');
			if (pages.length === 0 || round === lastRound) break;
			lastRound = round;
			stillChosen = new Set(pages.map((page) => page.path));
			saving.total = saving.done + pages.length;
			reportSaving();
			const queue = [...pages];
			const scripts = new Set<string>();
			const have = await savedPaths(cache);
			async function next(): Promise<void> {
				const page = queue.shift();
				if (!page) return;
				if (stillChosen.has(page.path)) {
					for (const file of filesOf(page)) {
						if (have.has(file)) continue;
						const response = await fetch(file);
						if (!(await isFromThisBuild(response))) throw new Error(newerBuildSeen ? 'newer-build' : `Could not save ${file}`);
						await noteScriptsOf(response, scripts);
						await cache.put(file, response);
					}
					// Removed while its files were on the way.
					if (!stillChosen.has(page.path)) for (const file of filesOf(page)) if (!precachedSet.has(file)) await cache.delete(file);
				}
				if (saving) saving.done += 1;
				if ((saving?.done ?? 0) % 10 === 0 || queue.length === 0) reportSaving();
				return next();
			}
			await Promise.all(Array.from({ length: 6 }, next));
			await saveMissing(cache, scripts);
		}
		await writeFlag(cache, unfinishedKey, false);
	})().finally(() => {
		savingJob = undefined;
		saving = undefined;
		savingListeners.clear();
	});
	return savingJob;
}

async function readFlag(cache: Cache, key: string): Promise<boolean> {
	return (await cache.match(key)) !== undefined;
}

async function writeFlag(cache: Cache, key: string, on: boolean): Promise<void> {
	if (on) await cache.put(key, json(true));
	else await cache.delete(key);
}

/** Deletes the saved files of pages the choices no longer hold, other than the core pages saved on install. */
async function removePages(cache: Cache, pages: Iterable<CatalogPage>): Promise<void> {
	const changed = new Set(await changedPages(cache));
	for (const page of pages) {
		stillChosen.delete(page.path);
		for (const file of filesOf(page)) {
			changed.delete(file);
			if (!precachedSet.has(file)) await cache.delete(file);
		}
	}
	await setChangedPages(cache, [...changed]);
}

/** Applies the reader's changes: the choices first, then removals, then saving, which may take a while. */
async function applyChoices(changes: ChoiceChange[], port: MessagePort | undefined): Promise<void> {
	const cache = await caches.open(cacheName);
	const read = await catalog();
	const lists = await allLists(read);
	const tree = catalogTree(read, lists);
	const before = chosenPages(await readChoices(cache), read, lists);
	let choices = await readChoices(cache);
	const documentChanges: ChoiceChange[] = [];
	for (const asked of changes) {
		let change = asked;
		// A page the catalog folds into another, such as a nation's opinions page into the nation's entry.
		if (change.kind === 'page' && !isDocumentKey(change.key) && tree.above(change.key).length === 0) {
			const known = await pageLists();
			const page = catalogPageOf(change.key, (at) => known.has(at) && !isDocumentKey(at));
			if (page) change = { ...change, key: page };
		}
		if (isDocumentKey(change.key)) documentChanges.push(change);
		else if (tree.nodeOf.has(change.key) || tree.above(change.key).length > 0) choices = applyChoice(choices, change, tree);
	}
	await writeChoices(cache, choices);
	const after = chosenPages(choices, read, lists);
	await removePages(cache, [...before.values()].filter((page) => !after.has(page.path)));
	if (documentChanges.length > 0) await applyDocumentChanges(documentChanges, tree, lists);
	const keys = changes.filter((change) => change.save && !isDocumentKey(change.key)).map((change) => change.key);
	tell(port, { type: 'choices', status: await choicesStatus() });
	// No changes at all: the reader asked to save what they chose that is not saved yet.
	if (keys.length > 0 || changes.length === 0) await saveChosen(keys, port);
	if (documentChanges.some((change) => change.save)) await saveKeptDocuments();
}

/** Deletes every page saved as the reader read, which the choices do not hold. */
async function clearReadPages(): Promise<void> {
	const cache = await caches.open(cacheName);
	const read = await catalog();
	const lists = await allLists(read);
	const chosen = chosenPages(await readChoices(cache), read, lists);
	const saved = await savedPaths(cache);
	const pages: CatalogPage[] = [];
	for (const list of Object.values(lists)) {
		for (const page of list) if (!isDocumentKey(page.path) && !chosen.has(page.path) && filesOf(page).some((file) => saved.has(file))) pages.push(page);
	}
	await removePages(cache, pages);
}

/** Forgets every choice and deletes every saved page and copy, for Settings > Your data. */
async function clearEverything(): Promise<void> {
	const cache = await caches.open(cacheName);
	await writeChoices(cache, { nodes: [], pages: [] });
	await writeFlag(cache, unfinishedKey, false);
	stillChosen.clear();
	// Whatever is left is still deleted below, cache by cache.
	const built = await builtPaths().catch((problem) => {
		sendProblem(problem, { code: 'offline.clear' });
		return new Set<string>();
	});
	const read = await catalog().catch((problem) => void sendProblem(problem, { code: 'offline.clear' }));
	const lists = read ? await allLists(read) : {};
	const files = new Set([...built, ...Object.values(lists).flatMap((list) => list.flatMap((page) => filesOf(page)))]);
	for (const request of await cache.keys()) {
		const path = new URL(request.url).pathname;
		if (files.has(path) && !precachedSet.has(path)) await cache.delete(request);
	}
	await setChangedPages(cache, []);
	const documents = await caches.open(documentsCacheName);
	for (const set of await readSets(documents, keptDocumentsKey)) await removeDocumentSet(set);
	await removeCopies(await readList<string>(documents, keptCopiesKey));
}

/**
 * Whether the page at an address is chosen and saved, for the save button at the top of each page. Asked on every page,
 * so a reader who has chosen nothing gets the answer without the catalog's index being read.
 */
async function pageChoice(path: string): Promise<PageChoice> {
	const cache = await caches.open(cacheName);
	const choices = await readChoices(cache);
	if (choices.nodes.length === 0 && choices.pages.length === 0) {
		return { path, known: !isNeverCached(path), chosen: false, saved: (await cache.match(path)) !== undefined };
	}
	const lists = await pageLists();
	const page = catalogPageOf(path, (at) => lists.has(at) && !isDocumentKey(at));
	if (!page) return { path, known: false, chosen: false, saved: false };
	const read = await catalog();
	const node = catalogTree(read, {}).nodeOf.get(lists.get(page) ?? '');
	const entry = node ? (await listOf(node)).find((item) => item.path === page) : undefined;
	if (!node || !entry) return { path, known: false, chosen: false, saved: false };
	const tree = catalogTree(read, { [node.key]: [entry] });
	const chosen = choices.pages.includes(page) || [node.key, ...tree.above(node.key)].some((key) => choices.nodes.includes(key));
	const saved = await savedPaths(cache);
	return { path: page, known: true, chosen, saved: filesOf(entry).every((file) => saved.has(file)) };
}

/** Not a real address: copies of United States documents the reader chose one by one, in the documents cache. */
const keptCopiesKey = '/__kept-copies';

/** What is chosen and saved of the documents, for the outline. */
async function documentChoices(): Promise<{ statusOf: (page: CatalogPage) => { chosen: boolean; saved: number; bytes: number } }> {
	const cache = await caches.open(documentsCacheName);
	const kept = new Set(await readSets(cache, keptDocumentsKey));
	const copies = new Set(await readList<string>(cache, keptCopiesKey));
	const saved = await savedCopies(cache);
	const nations = new Map<DocumentSet, { saved: number; bytes: number }>();
	for (const set of kept) {
		if (set === 'federal') continue;
		const files = (await documentList(cache, set, false))?.files ?? [];
		const savedFiles = files.filter(([path]) => saved.has(path));
		nations.set(set, { saved: savedFiles.length, bytes: savedFiles.reduce((total, [, bytes]) => total + bytes, 0) });
	}
	return {
		statusOf(page) {
			const set = setOfEntry(page.path);
			if (set) return { chosen: kept.has(set), ...(nations.get(set) ?? { saved: 0, bytes: 0 }) };
			const chosen = kept.has('federal') || copies.has(page.path);
			const isSaved = chosen && saved.has(page.path);
			return { chosen, saved: isSaved ? 1 : 0, bytes: isSaved ? page.bytes : 0 };
		}
	};
}

/** Deletes saved copies, except those a kept set still lists. */
async function removeCopies(paths: string[]): Promise<void> {
	const cache = await caches.open(documentsCacheName);
	const gone = new Set(paths);
	await cache.put(keptCopiesKey, json((await readList<string>(cache, keptCopiesKey)).filter((path) => !gone.has(path))));
	const stillWanted = new Set<string>();
	for (const set of await readSets(cache, keptDocumentsKey)) {
		for (const [path] of (await documentList(cache, set, false))?.files ?? []) stillWanted.add(path);
	}
	for (const path of gone) if (!stillWanted.has(path)) await cache.delete(path);
}

/**
 * The reader's changes to documents, made on the sets the copies are kept in (src/lib/offline-documents.ts): the
 * United States documents as one set or one by one, and each nation's documents as that nation's set, as its page
 * saves them.
 */
async function applyDocumentChanges(changes: ChoiceChange[], tree: ReturnType<typeof catalogTree>, lists: Record<string, CatalogPage[]>): Promise<void> {
	const cache = await caches.open(documentsCacheName);
	const allFederal = (lists['documents-federal'] ?? Object.entries(lists).filter(([key]) => key.startsWith('documents-federal-')).flatMap(([, list]) => list)).map((page) => page.path);
	for (const change of changes) {
		const entries = change.kind === 'page' ? [change.key] : [...tree.below(change.key)].filter((key) => key.startsWith('/'));
		const sets = entries.map(setOfEntry).filter((set): set is DocumentSet => set !== undefined);
		const copies = entries.filter((key) => key.startsWith('/copies/'));
		const kept = await readSets(cache, keptDocumentsKey);
		const keptCopies = new Set(await readList<string>(cache, keptCopiesKey));
		const wholeFederal = change.kind === 'node' && (change.key === 'documents' || change.key === 'documents-federal');
		if (change.save) {
			const keep = [...sets, ...(wholeFederal ? (['federal'] as DocumentSet[]) : [])];
			await writeSets(cache, keptDocumentsKey, [...kept, ...keep]);
			await writeSets(cache, pendingDocumentsKey, [...(await readSets(cache, pendingDocumentsKey)), ...keep]);
			if (wholeFederal) await cache.put(keptCopiesKey, json([]));
			else if (!kept.includes('federal')) await cache.put(keptCopiesKey, json([...new Set([...keptCopies, ...copies])]));
		} else {
			for (const set of sets) await removeDocumentSet(set);
			if (wholeFederal) {
				await removeDocumentSet('federal');
				await removeCopies([...keptCopies]);
			} else if (copies.length > 0) {
				if (kept.includes('federal')) {
					// The rest of the United States documents stay, one by one.
					await writeSets(cache, keptDocumentsKey, kept.filter((set) => set !== 'federal'));
					await writeSets(cache, pendingDocumentsKey, (await readSets(cache, pendingDocumentsKey)).filter((set) => set !== 'federal'));
					const gone = new Set(copies);
					await cache.put(keptCopiesKey, json(allFederal.filter((path) => !gone.has(path))));
				}
				await removeCopies(copies);
			}
		}
	}
}

/** Saves the kept sets left unfinished, and the copies chosen one by one that are not saved yet. */
async function saveKeptDocuments(): Promise<void> {
	for (const set of await pendingSets()) await runDocumentSave(set, undefined).catch((problem) => void sendProblem(problem, { code: 'offline.documents-resume', place: set }));
	const cache = await caches.open(documentsCacheName);
	const wanted = await readList<string>(cache, keptCopiesKey);
	if (wanted.length === 0) return;
	const saved = await savedCopies(cache);
	const missing = new Set(wanted.filter((path) => !saved.has(path)));
	if (missing.size === 0) return;
	const list = await documentList(cache, 'federal', true);
	const queue = (list?.files ?? []).filter(([path]) => missing.has(path));
	async function next(): Promise<void> {
		const file = queue.shift();
		if (!file) return;
		await saveCopy(cache, file).catch(() => /* expected: a copy that cannot be saved now is tried again the next time. */ undefined);
		return next();
	}
	await Promise.all(Array.from({ length: 4 }, next));
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
		// expected: a list that cannot be read counts as empty.
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
			// expected: offline: fall back on the list kept last time.
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

/** Saves one copy with its fingerprint, so a later build can tell whether it changed. False when it cannot be saved. */
async function saveCopy(cache: Cache, [path, , fingerprint]: DocumentFile): Promise<boolean> {
	// A copy the bucket lacks is a redirect to the original, which is not saved.
	const response = await fetch(path, { redirect: 'manual' });
	if (response.status !== 200 || response.type !== 'basic') return false;
	const headers = new Headers(response.headers);
	headers.set(fingerprintHeader, fingerprint);
	await cache.put(path, new Response(response.body, { status: 200, headers }));
	return true;
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
		if (await saveCopy(cache, file).catch(() => /* expected: counted as failed, which the page shows the reader. */ false)) done += 1;
		else failed += 1;
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
	const stillWanted = new Set<string>(await readList<string>(cache, keptCopiesKey));
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
		// Copies chosen one by one are United States documents, listed in its set.
		const read = (await readList<string>(cache, keptCopiesKey)).length > 0 && !kept.includes('federal') ? [...kept, 'federal' as const] : kept;
		for (const set of read) {
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
	} catch (problem) {
		// Tried again with the next build; offline or full storage is only noted (sendProblem).
		sendProblem(problem, { code: 'offline.documents-update' });
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

/**
 * A copy's page: from the network, or offline the copy's file when the reader
 * saved it, so a saved document still opens from a link on a saved page.
 */
async function copyPageResponse(request: Request): Promise<Response> {
	try {
		return await fetch(request);
	} catch {
		// expected: offline; the saved copy answers below, when there is one.
		const file = `/copies/${new URL(request.url).pathname.slice(copyPagePrefix.length)}`;
		if (await caches.has(documentsCacheName)) {
			const saved = await (await caches.open(documentsCacheName)).match(file);
			if (saved) return saved;
		}
		return networkOnly(request);
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
			case 'choices-status':
				break;
			case 'choices-apply':
				await applyChoices(request.changes, port);
				break;
			case 'choices-clear-read':
				await clearReadPages();
				break;
			case 'choices-clear':
				await clearEverything();
				tell(port, { type: 'cleared' });
				return;
			case 'page-choice':
				tell(port, { type: 'page-choice', choice: await pageChoice(request.path) });
				return;
			case 'offline-resume': {
				await saveChangedPages();
				const cache = await caches.open(cacheName);
				const choices = await readChoices(cache);
				const unfinished = await readFlag(cache, unfinishedKey);
				// Looked at once per build, and again only while a save is unfinished: reading every list of the
				// catalog on each visit would slow every page down.
				if ((choices.nodes.length > 0 || choices.pages.length > 0) && (unfinished || !(await readFlag(cache, toppedUpKey)))) {
					// Pages new to a chosen part wait for the reader when they are many (automaticTopUp), unless the
					// reader's own save was cut short.
					const { pages } = await missingChosen(cache);
					if (pages.length > 0 && (pages.length <= automaticTopUp || unfinished)) await saveChosen([], port);
					await writeFlag(cache, toppedUpKey, true);
				}
				// Copies of documents are large, so only sets left unfinished, and copies chosen one by one, are saved here.
				await saveKeptDocuments();
				// The page does not need the status here, which reads every list of the catalog.
				tell(port, { type: 'resumed' });
				return;
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
		tell(port, { type: 'choices', status: await choicesStatus() });
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
	// A copy's page (/copies/view/<key>) is made by the Worker on request; offline, the saved file itself answers.
	if (url.pathname.startsWith(copyPagePrefix)) {
		if (event.request.mode === 'navigate') event.respondWith(copyPageResponse(event.request));
		return;
	}
	// A saved copy of a document answers offline; any other copy comes from the network.
	if (
		url.pathname.startsWith('/copies/') &&
		!url.pathname.startsWith('/copies/list') &&
		!url.pathname.startsWith('/copies/offline') &&
		!url.pathname.startsWith('/copies/details/')
	) {
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
