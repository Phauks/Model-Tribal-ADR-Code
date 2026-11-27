/**
 * Fingerprints of the built files, so an update downloads only what changed
 * (site/DESIGN.md, section 10, "Updates"). Shared by
 * src/service-worker/index.ts and src/lib/site-updates.svelte.ts, so it must
 * not use the page or the worker's own globals.
 *
 * Every build writes /offline-fingerprints.json (tools/write-offline-sizes.mjs,
 * run after `vite build`). Each built page carries the build version and a
 * name SvelteKit derives from it, so every page differs from the last build's
 * copy even when nothing on it changed. A page's fingerprint is therefore
 * taken with those two blanked out. When a new build installs, the service
 * worker blanks them in each saved copy from the old build the same way; if
 * the fingerprints match, it writes the new build's version and name back in,
 * which gives exactly the file the server now holds, without downloading it.
 *
 * tools/write-offline-sizes.mjs repeats these steps in plain JavaScript for
 * Node; tests/offline-fingerprints.test.ts checks that the two agree.
 */

/** Where each build serves its fingerprints. The service worker never saves it from there. */
export const fingerprintsAddress = '/offline-fingerprints.json';

/** Not a real address: where the service worker keeps its own build's fingerprints in its cache. */
export const savedFingerprintsKey = '/__fingerprints';

export const cachePrefix = 'site-';

/** The cache the service worker of a build saves files in. */
export function cacheNameOf(version: string): string {
	return `${cachePrefix}${version}`;
}

export interface Fingerprints {
	/** The build these fingerprints belong to, for example "0.0.1+1795229308081". */
	version: string;
	/** The name SvelteKit gives the page's start-up object in this build, for example "__sveltekit_jlb1tw". */
	startName: string;
	/** Every file a reader may save, by address: the page or file as served, with the build blanked out. */
	files: Record<string, string>;
	/**
	 * Every page, by address: what the page shows, which also leaves out the
	 * names of the script and style files it loads. Used to tell a reader
	 * whether an update changes the page they are reading.
	 */
	pages: Record<string, string>;
	/**
	 * Every page the Worker draws on request (src/lib/server/page-data.ts), by address: the fingerprint of the page
	 * data it is drawn from. Such a page has no built file, so a saved copy is carried to a new build when its page data
	 * is the same in both builds and every script and style it loads is still built (src/service-worker/index.ts).
	 */
	onRequest?: Record<string, string>;
}

const versionMark = '\u0000build-version\u0000';
const startNameMark = '\u0000build-start-name\u0000';
const scriptFileMark = '\u0000build-file\u0000';
const startNamePattern = /\b(__sveltekit_[a-z0-9]+)\s*=\s*\{/;
const scriptFilePattern = /\/_app\/immutable\/[A-Za-z0-9._/-]+/g;

/** The start-up object's name in a built page, if it has one. */
export function startNameOf(page: string): string | undefined {
	return startNamePattern.exec(page)?.[1];
}

/** A built page with its build version and start-up object's name blanked out. */
export function withoutBuild(page: string, version: string): string {
	const startName = startNameOf(page);
	const blanked = page.replaceAll(version, versionMark);
	return startName ? blanked.replaceAll(startName, startNameMark) : blanked;
}

/** A page from withoutBuild, with a build's version and start-up name written back in. */
export function withBuild(blanked: string, version: string, startName: string): string {
	return blanked.replaceAll(versionMark, version).replaceAll(startNameMark, startName);
}

/** A page from withoutBuild, without the names of the script and style files it loads. */
export function shownText(blanked: string): string {
	return blanked.replace(scriptFilePattern, scriptFileMark);
}

/** The first 16 hexadecimal digits of the SHA-256 digest of some text or bytes. */
export async function fingerprintOf(content: string | ArrayBuffer): Promise<string> {
	const bytes = typeof content === 'string' ? new TextEncoder().encode(content) : content;
	const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
	return Array.from(digest.slice(0, 8), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export type PageChange = 'changed' | 'unchanged' | 'removed';

/**
 * Whether an update changes a page, from the fingerprints of the build being
 * read and of the waiting one. Undefined when the build being read does not
 * list the page, such as a page that only the server answers.
 */
export function pageChange(address: string, reading: Fingerprints, waiting: Fingerprints): PageChange | undefined {
	const before = reading.pages[address];
	if (!before) return undefined;
	const after = waiting.pages[address];
	if (!after) return 'removed';
	return before === after ? 'unchanged' : 'changed';
}
