/**
 * The full citation of each source record, for drawing essays, case and law
 * boxes and the editor's source search. They are not in the Worker's code,
 * which they would take past Cloudflare's size limit
 * (src/lib/essay-citation-files.ts):
 *
 * - While the site is built (and in development), they are read once from
 *   .svelte-kit/essay-citations.json, which the build writes
 *   (vite.config.ts, "essay-library"), so pages built ahead of time, such as
 *   the case and law pages' data, draw their boxes as before.
 * - In the Worker, renderWithCitations() draws a text once to learn which
 *   sources it cites, reads only the files that hold those citations from
 *   the static files (the ASSETS binding), and draws it again with them.
 *   Files read are kept in memory for the next page.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { building, dev } from '$app/env';
import { citationFileNumber, citationFilePath, citationTextsPath, plainCitation } from '../essay-citation-files.ts';
import { renderEssay, type EssayLibrary, type RenderedEssay } from '../essays/render.ts';
import type { LineChange } from '../essays/merge.ts';
import { workerEnvironment } from './environment.ts';

/** Where the build leaves every citation for itself (vite.config.ts, "essay-library"). */
export const builtCitationsFile = path.join('.svelte-kit', 'essay-citations.json');

let builtCitations: Record<string, string> | undefined;

/** Every citation, while the site is built or in development; undefined in the Worker. */
export function citationsWhileBuilding(): Record<string, string> | undefined {
	if (!building && !dev) return undefined;
	builtCitations ??= JSON.parse(readFileSync(path.resolve(process.cwd(), builtCitationsFile), 'utf8')) as Record<string, string>;
	return builtCitations;
}

/** Citation files kept in memory in one copy of the Worker; each is about 50 KB. */
const keptAtMost = 300;
const kept = new Map<number, Promise<Record<string, string>>>();
/** How many files are read at once. */
const readsAtOnce = 16;

async function readStatic(address: string): Promise<Response | undefined> {
	const assets = workerEnvironment().ASSETS;
	if (!assets) return undefined;
	const response = await assets.fetch(new URL(address, 'https://assets.invalid').toString());
	if (!response.ok) throw new Error(`Reading ${address} failed: ${response.status}`);
	return response;
}

function citationFile(number: number): Promise<Record<string, string>> {
	let file = kept.get(number);
	if (file) {
		// Most recently used last, so the oldest is the one let go.
		kept.delete(number);
		kept.set(number, file);
		return file;
	}
	file = readStatic(citationFilePath(number))
		.then(async (response) => (response ? ((await response.json()) as Record<string, string>) : {}))
		.catch((problem: unknown) => {
			kept.delete(number);
			throw problem;
		});
	if (kept.size >= keptAtMost) kept.delete(kept.keys().next().value as number);
	kept.set(number, file);
	return file;
}

/** The citations of these keys; a key with no citation is left out. */
export async function citationsFor(keys: Iterable<string>): Promise<Map<string, string>> {
	const wanted = [...new Set(keys)];
	const found = new Map<string, string>();
	const all = citationsWhileBuilding();
	if (all) {
		for (const key of wanted) if (all[key] !== undefined) found.set(key, all[key]);
		return found;
	}
	const numbers = [...new Set(wanted.map(citationFileNumber))];
	const files = new Map<number, Record<string, string>>();
	for (let start = 0; start < numbers.length; start += readsAtOnce) {
		const group = numbers.slice(start, start + readsAtOnce);
		const read = await Promise.all(group.map(citationFile));
		group.forEach((number, index) => files.set(number, read[index]));
	}
	for (const key of wanted) {
		const citation = files.get(citationFileNumber(key))?.[key];
		if (citation !== undefined) found.set(key, citation);
	}
	return found;
}

/** One citation, or undefined when no source record has the key. */
export async function citationOf(key: string): Promise<string | undefined> {
	return (await citationsFor([key])).get(key);
}

let texts: Promise<[string, string][]> | undefined;

/** Every source's key and citation as plain text, for the editor's "Cite a source" search. */
export function citationTexts(): Promise<[string, string][]> {
	const all = citationsWhileBuilding();
	if (all) return Promise.resolve(Object.entries(all).map(([key, html]) => [key, plainCitation(html)]));
	texts ??= readStatic(citationTextsPath)
		.then(async (response) => (response ? ((await response.json()) as [string, string][]) : []))
		.catch((problem: unknown) => {
			texts = undefined;
			throw problem;
		});
	return texts;
}

/**
 * Draws a text with the citations of the sources it cites. While the site
 * is built every citation is at hand, so it is drawn once. In the Worker it
 * is drawn once to learn the keys it asks for, then again once their
 * citations are read; a key with no record is shown as it was before, as
 * the bare key with a note in the problems.
 */
export async function renderWithCitations(text: string, library: EssayLibrary, options: { lines?: LineChange[] } = {}): Promise<RenderedEssay> {
	const all = citationsWhileBuilding();
	if (all) return renderEssay(text, { ...library, citation: (key) => all[key] }, options);
	const known = new Map<string, string | undefined>();
	for (let round = 0; ; round++) {
		const asked = new Set<string>();
		const rendered = renderEssay(
			text,
			{
				...library,
				citation: (key) => {
					if (!known.has(key)) asked.add(key);
					return known.get(key);
				}
			},
			options
		);
		// A citation does not change which sources a text cites, so the second drawing asks for nothing new; the limit is only a guard.
		if (asked.size === 0 || round === 2) return rendered;
		const found = await citationsFor(asked);
		for (const key of asked) known.set(key, found.get(key));
	}
}
