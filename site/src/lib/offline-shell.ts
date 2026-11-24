/**
 * What the service worker saves when it installs (site/DESIGN.md, section 10). Shared by src/service-worker/index.ts and the offline-files plugin in vite.config.ts, so it must not use the page or the worker's own globals.
 *
 * On install the worker saves the core pages, the scripts and styles those pages load (read from the saved pages themselves), and the reader tools they open on demand, such as downloading a page or a table. Every other script and style is saved the first time a page uses it, as fonts are, and those a collection's pages load are saved with the collection. So a first visit does not download the video call kit, the editor or the map library, which cannot be used offline anyway.
 */

/** The page shown when a page is neither saved nor reachable. */
export const offlinePage = '/offline';

/**
 * Pages saved on install. The search page and its index are kept too, so the masthead's search box works offline, and so is the Starred page, since stars and notes live on the device.
 */
export const corePages = ['/', '/glossary', '/changelog', '/search', '/starred', '/starred/shared', offlinePage];

/** Each core page and its page data. */
export const corePageFiles = corePages.flatMap((page) => [page, page === '/' ? '/__data.json' : `${page}/__data.json`]);

/** Built files saved on install when the build has them: the core pages, the data the masthead and search read, and OpenDyslexic's small style sheet, so a reader who picked that font keeps it offline after an update (src/lib/reading-settings.ts). */
export const installCandidates = [
	'/manifest.webmanifest',
	'/icon.svg',
	'/opendyslexic.css',
	'/glossary/terms.json',
	'/nations/previews.json',
	'/search/index.json',
	'/search/records.json',
	...corePageFiles
];

const builtScriptPattern = /\/_app\/immutable\/[A-Za-z0-9._/-]+/g;

/** The addresses of the built scripts, styles and fonts a page names in its HTML: what it loads before anything else. */
export function scriptsIn(html: string): string[] {
	return [...new Set(html.match(builtScriptPattern) ?? [])];
}

/**
 * Modules loaded on demand that are not saved on install, because they need a connection or are for people editing: the video call kit, the map library and its basemaps (map tiles are never saved), the spelling checker and the essay editor. Each is saved the first time it is used.
 */
const savedOnFirstUse = [/@cloudflare\/realtimekit/, /\/maplibre-gl\//, /@protomaps\/basemaps/, /\/harper\.js\//, /\/EssayEditor\.svelte$/];

/** One entry of the client build's Vite manifest (.vite/manifest.json). */
export interface ManifestChunk {
	file: string;
	css?: string[];
	imports?: string[];
	dynamicImports?: string[];
	isEntry?: boolean;
	isDynamicEntry?: boolean;
}

/**
 * The reader tools saved on install: every module the site loads on demand except those above, with the scripts and styles each one imports, as addresses. Read from the client build's Vite manifest when the service worker is built.
 */
export function readerToolFiles(manifest: Record<string, ManifestChunk>): string[] {
	const files = new Set<string>();
	const seen = new Set<string>();
	const visit = (key: string) => {
		const chunk = manifest[key];
		if (!chunk || seen.has(key)) return;
		seen.add(key);
		files.add(`/${chunk.file}`);
		for (const style of chunk.css ?? []) files.add(`/${style}`);
		for (const imported of chunk.imports ?? []) visit(imported);
	};
	for (const [key, chunk] of Object.entries(manifest)) {
		if (chunk.isDynamicEntry && !savedOnFirstUse.some((pattern) => pattern.test(key))) visit(key);
	}
	return [...files].sort();
}
