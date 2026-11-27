/**
 * What essays, case and law boxes and the editor's source search are drawn
 * from that is too big for the Worker's code, which it would take past
 * Cloudflare's size limit (src/lib/essay-citation-files.ts,
 * src/lib/built-files.ts): the full citation of each source record, the
 * facts and parts of each case and law box, each case's page and opinions,
 * and the name of every case.
 *
 * - While the site is built (and in development), they are read once from
 *   the files the build writes in .svelte-kit/ (vite.config.ts,
 *   "essay-library"), so pages built ahead of time, such as the case and
 *   law pages' data, draw their boxes as before.
 * - In the Worker, withEssayData() draws a text once to learn which sources
 *   and records it asks for, reads only the files that hold them from the
 *   static files (the ASSETS binding), and draws it again with them. Files
 *   read are kept in memory for the next page.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { building, dev } from '$app/env';
import { essayCaseNamesFile, essayRecordFiles } from '../built-files.ts';
import { citationFileCount, citationFilePath, citationTextsPath, plainCitation } from '../essay-citation-files.ts';
import { boxMarkdown, readingMarkdown } from '../essays/record-boxes.ts';
import { renderEssay, type EssayLibrary, type RenderedEssay } from '../essays/render.ts';
import type { LineChange } from '../essays/merge.ts';
import { privateFile, privateSpreadReader, readStaticJson, spreadReader } from './built-files.ts';
import type { EssayRecord } from './essay-library.ts';

export type { EssayRecord } from './essay-library.ts';

/** Every court case's name and date, by its source's key. */
export type CaseNames = Record<string, { title: string; date: number[] }>;

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
const citations = spreadReader<string>({ count: citationFileCount, path: citationFilePath, whileBuilding: citationsWhileBuilding, keptAtMost: 300 });

/** Record files kept in memory in one copy of the Worker; each is about 10 KB. */
const records = privateSpreadReader<EssayRecord>(essayRecordFiles, 300);

/** The citations of these keys; a key with no citation is left out. */
export function citationsFor(keys: Iterable<string>): Promise<Map<string, string>> {
	return citations.recordsFor(keys);
}

/** One citation, or undefined when no source record has the key. */
export function citationOf(key: string): Promise<string | undefined> {
	return citations.recordOf(key);
}

/** The box facts, case page, opinions and box parts of these keys; a key with none is left out. */
export function essayRecordsFor(keys: Iterable<string>): Promise<Map<string, EssayRecord>> {
	return records.recordsFor(keys);
}

/** Every court case's name and date, read once in each copy of the Worker (about 1 MB). */
export const essayCaseNames: () => Promise<CaseNames> = privateFile<CaseNames>(essayCaseNamesFile, {});

let texts: Promise<[string, string][]> | undefined;

/** Every source's key and citation as plain text, for the editor's "Cite a source" search. */
export function citationTexts(): Promise<[string, string][]> {
	const all = citationsWhileBuilding();
	if (all) return Promise.resolve(Object.entries(all).map(([key, html]) => [key, plainCitation(html)]));
	texts ??= readStaticJson<[string, string][]>(citationTextsPath)
		.then((list) => list ?? [])
		.catch((problem: unknown) => {
			texts = undefined;
			throw problem;
		});
	return texts;
}

/** Case names as an essay links them: source key to case name. Worked out once for each list of names. */
const titlesOf = new WeakMap<CaseNames, Record<string, string>>();
function caseTitles(names: CaseNames): Record<string, string> {
	let titles = titlesOf.get(names);
	if (!titles) {
		titles = Object.fromEntries(Object.entries(names).map(([key, name]) => [key, name.title]));
		titlesOf.set(names, titles);
	}
	return titles;
}

/** The parts of a library that look a record up by key, drawn from one record. */
export function recordLibrary(record: (key: string) => EssayRecord | undefined): Pick<EssayLibrary, 'facts' | 'caseLink' | 'opinions' | 'box' | 'boxReading'> {
	const recordBox = (kind: 'case' | 'law', key: string) => {
		const found = record(key);
		return kind === 'law' ? found?.lawBox : found?.caseBox;
	};
	return {
		facts: (box, key) => (box === 'law' ? record(key)?.lawFacts : record(key)?.caseFacts) ?? [],
		caseLink: (key) => record(key)?.link,
		opinions: (key) => record(key)?.opinions,
		box: (kind, key) => boxMarkdown(kind, key, recordBox(kind, key)) || undefined,
		boxReading: (kind, key) => readingMarkdown(recordBox(kind, key)) || undefined
	};
}

/** Case names as an essay links them, from a list of every case's name and date. */
export function caseNamesLibrary(names: CaseNames | undefined): Pick<EssayLibrary, 'caseNames'> {
	return { caseNames: () => (names ? caseTitles(names) : {}) };
}

/** How many times a text is drawn at most: each drawing can only ask for what the one before found, such as the citations in a box its record fills. */
const roundsAtMost = 4;

/**
 * Does something that draws from the essay library, such as drawing a
 * text, with the citations and records it needs. While the site is built
 * every one is at hand, so it is done once. In the Worker it is done once to
 * learn the keys it asks for, then again once they are read; a key with no
 * record is shown as it was before, such as a citation as the bare key with
 * a note in the problems.
 */
export async function withEssayData<Result>(library: EssayLibrary, draw: (library: EssayLibrary) => Result): Promise<Result> {
	if (citationsWhileBuilding()) return draw(library);
	const knownCitations = new Map<string, string | undefined>();
	const knownRecords = new Map<string, EssayRecord | undefined>();
	let askedCitations = new Set<string>();
	let askedRecords = new Set<string>();
	const record = (key: string) => {
		if (!knownRecords.has(key)) askedRecords.add(key);
		return knownRecords.get(key);
	};
	// One library for every drawing, so what is worked out from the case names is kept between them.
	const withData: EssayLibrary = {
		...library,
		...recordLibrary(record),
		...caseNamesLibrary(await essayCaseNames()),
		citation: (key) => {
			if (!knownCitations.has(key)) askedCitations.add(key);
			return knownCitations.get(key);
		}
	};
	for (let round = 1; ; round++) {
		askedCitations = new Set();
		askedRecords = new Set();
		const result = draw(withData);
		if ((askedCitations.size === 0 && askedRecords.size === 0) || round === roundsAtMost) return result;
		const [foundCitations, foundRecords] = await Promise.all([citationsFor(askedCitations), essayRecordsFor(askedRecords)]);
		for (const key of askedCitations) knownCitations.set(key, foundCitations.get(key));
		for (const key of askedRecords) knownRecords.set(key, foundRecords.get(key));
	}
}

/** Draws a text with the citations of the sources it cites and the records of its boxes (withEssayData). */
export function renderWithCitations(text: string, library: EssayLibrary, options: { lines?: LineChange[] } = {}): Promise<RenderedEssay> {
	return withEssayData(library, (withData) => renderEssay(text, withData, options));
}
