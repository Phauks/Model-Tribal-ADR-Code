/**
 * The build's side of editable site text (docs/site-text.md): the words
 * published from the website, read once when the build starts, and the
 * catalog of every piece of fixed text in the site's components. Runs in
 * Node during `vite build` only (vite.config.ts).
 */
import { globSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { markSiteText, type SiteTextEntry } from '../site-text-markers.ts';

export interface PublishedSiteText {
	/** The newest publication the words come from; 0 when nothing has been published. */
	publication: number;
	/** Each edited piece of text's name and its published words. */
	texts: Record<string, string>;
}

export const nothingPublished: PublishedSiteText = { publication: 0, texts: {} };

/** The site's public address, from wrangler.jsonc, so it changes with the domain. */
export function siteAddress(siteFolder: string): string {
	const configuration = readFileSync(path.join(siteFolder, 'wrangler.jsonc'), 'utf8');
	const match = /"SITE_ADDRESS"\s*:\s*"([^"]+)"/.exec(configuration);
	if (!match) throw new Error('SITE_ADDRESS is missing from wrangler.jsonc.');
	return match[1].replace(/\/$/, '');
}

/** Checks the shape of /site-text/published.json. */
export function readPublished(value: unknown): PublishedSiteText {
	const candidate = value as PublishedSiteText | null;
	if (!candidate || typeof candidate.publication !== 'number' || !candidate.texts || typeof candidate.texts !== 'object') {
		throw new Error('The published site text has an unexpected shape.');
	}
	for (const [key, words] of Object.entries(candidate.texts)) {
		if (!/^[0-9a-z]{10}$/.test(key) || typeof words !== 'string') throw new Error(`The published site text has a bad entry, ${key}.`);
	}
	return { publication: candidate.publication, texts: candidate.texts };
}

/**
 * The published words to build with.
 *
 * - On Cloudflare's build (WORKERS_CI is 1) they come from the live site. If
 *   the site cannot be reached the build stops, so a deploy never takes the
 *   published words away. A 404 means the live site predates this feature,
 *   so nothing has been published yet.
 * - SITE_TEXT_FILE names a JSON file of the same shape, for trying edits on a
 *   computer.
 * - Otherwise (checks on GitHub, a build on a computer) the built-in words.
 */
export async function loadPublishedSiteText(
	siteFolder: string,
	environment: Record<string, string | undefined> = process.env,
	fetcher: typeof fetch = fetch
): Promise<PublishedSiteText> {
	if (environment.SITE_TEXT_FILE) {
		return readPublished(JSON.parse(readFileSync(path.resolve(siteFolder, environment.SITE_TEXT_FILE), 'utf8')));
	}
	if (environment.WORKERS_CI !== '1') return nothingPublished;
	const address = `${siteAddress(siteFolder)}/site-text/published.json`;
	let problem: unknown;
	for (let attempt = 1; attempt <= 4; attempt++) {
		try {
			const response = await fetcher(address, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(30_000) });
			if (response.status === 404) {
				console.warn(`Site text: ${address} answered 404; building with the built-in words.`);
				return nothingPublished;
			}
			if (!response.ok) throw new Error(`${address} answered ${response.status}.`);
			const published = readPublished(await response.json());
			console.log(`Site text: building with publication ${published.publication} (${Object.keys(published.texts).length} edited pieces).`);
			return published;
		} catch (caught) {
			problem = caught;
			await new Promise((done) => setTimeout(done, attempt * 2000));
		}
	}
	throw new Error(`Site text: the published words could not be read, so the build stops rather than undo them. ${String(problem)}`);
}

/** Every piece of fixed text in the site's components, in file order. */
export function siteTextCatalog(siteFolder: string): SiteTextEntry[] {
	const entries: SiteTextEntry[] = [];
	for (const file of globSync('src/**/*.svelte', { cwd: siteFolder }).sort()) {
		const relative = file.split(path.sep).join('/');
		entries.push(...markSiteText(readFileSync(path.join(siteFolder, file), 'utf8'), relative).entries);
	}
	return entries;
}
