/**
 * The site search (Trevor asked on Nov. 22, 2026 for one search box at the
 * top of every page, in place of a search box on each list). The index is a
 * JSON file built with the site, /search/index.json, so search works without
 * a server and offline once the file is saved. Matching follows the tables'
 * rules (src/lib/tables/table-definition.ts): case and accents are ignored,
 * and every word typed must appear.
 */
import type { RecognitionBadge } from './recognition-badges.ts';
import { foldForSearch } from './tables/table-definition.ts';

export type SearchKind = 'nation' | 'law' | 'case' | 'person' | 'story' | 'term' | 'reference' | 'page';

export interface SearchEntry {
	kind: SearchKind;
	/** What the result is called, such as a nation's official name. */
	title: string;
	/** Other names that should find it: self-designations, former names, aliases, acronyms. */
	also?: string[];
	/**
	 * The sets it belongs to, such as the Marshall Trilogy (content/search/names.yaml),
	 * each as its names: the name shown first, then other names for the set. Any of them finds every member.
	 */
	groups?: string[][];
	/** One line shown under the title, such as the states or a summary. */
	detail?: string;
	/** A nation's recognition badges (src/lib/recognition-badges.ts); none for no federal recognition. */
	badges?: RecognitionBadge[];
	/** A small picture for the result: a nation's seal or logo, where its page may show one. */
	image?: string;
	link: string;
}

export const searchKindLabels: Record<SearchKind, string> = {
	nation: 'Nations and communities',
	law: 'Federal law',
	case: 'Courts and cases',
	person: 'People',
	story: 'Stories',
	term: 'Glossary',
	reference: 'Reference',
	page: 'Pages'
};

export interface SearchResult extends SearchEntry {
	/** The other name that matched, when the title did not. */
	matchedName?: string;
	/** The set whose name matched, by the name shown, when neither the title nor another name did. */
	matchedGroup?: string;
	score: number;
}

/** Folds text for matching, and writes initialisms without their periods, so "USC" finds "U.S.C." and "U.S.C." finds "USC". */
function fold(text: string): string {
	return foldForSearch(text).replace(/(?<![\p{L}\p{N}])(?:\p{L}\.){2,}/gu, (letters) => letters.replaceAll('.', ''));
}

/** The words typed, folded as names are, in the order typed. */
export function wordsOf(query: string): string[] {
	return fold(query).split(/\s+/).filter(Boolean);
}

/** A name folded once, with its words, so typing does not fold it again. */
export interface FoldedName {
	name: string;
	folded: string;
	words: string[];
}

/** An entry with its names folded, made once per index (folding every name on every keystroke made typing lag). */
export interface PreparedEntry {
	entry: SearchEntry;
	title: FoldedName;
	also: FoldedName[];
	groups: { shown: string; names: FoldedName[] }[];
	/** The title, other names and detail line folded together; empty when there is no detail line. */
	everything: string;
}

function foldName(name: string): FoldedName {
	const folded = fold(name);
	return { name, folded, words: folded.split(/[^\p{L}\p{N}]+/u) };
}

/** An entry with its names folded: what the search on the device keeps, and what the server's search tables hold (src/lib/server/search-tables.ts). */
export function prepare(entry: SearchEntry): PreparedEntry {
	return {
		entry,
		title: foldName(entry.title),
		also: (entry.also ?? []).map(foldName),
		groups: (entry.groups ?? []).map((names) => ({ shown: names[0], names: names.map(foldName) })),
		everything: entry.detail ? fold(`${entry.title} ${(entry.also ?? []).join(' ')} ${entry.detail}`) : ''
	};
}

/** The prepared entries for each index, made the first time it is searched. */
const preparedIndexes = new WeakMap<SearchEntry[], PreparedEntry[]>();

function prepared(entries: SearchEntry[]): PreparedEntry[] {
	let list = preparedIndexes.get(entries);
	if (!list) {
		list = entries.map(prepare);
		preparedIndexes.set(entries, list);
	}
	return list;
}

/** Entries folded between pauses, so preparing a large index never holds the page still for long. */
const entriesPerStep = 1000;

/**
 * Folds an index's names ahead of its first search, a part at a time with a
 * pause between parts, so typing stays smooth while it runs. The masthead's
 * panel keeps showing the server's answers until it is done.
 */
export async function prepareSearchIndex(entries: SearchEntry[]): Promise<void> {
	if (preparedIndexes.has(entries)) return;
	const list: PreparedEntry[] = [];
	for (let start = 0; start < entries.length; start += entriesPerStep) {
		for (const entry of entries.slice(start, start + entriesPerStep)) list.push(prepare(entry));
		await new Promise((resolve) => setTimeout(resolve, 0));
	}
	preparedIndexes.set(entries, list);
}

/** How well one name matches: whole name, start of the name, start of a word, or anywhere. */
function nameScore(name: FoldedName, words: string[], phrase: string): number {
	const { folded } = name;
	if (!words.every((word) => folded.includes(word))) return 0;
	if (folded === phrase) return 100;
	if (folded.startsWith(phrase)) return 80;
	if (words.every((word) => name.words.some((nameWord) => nameWord.startsWith(word)))) return 60;
	return 40;
}

/**
 * The entries that match, best first. A title match ranks above a match on
 * another name, which ranks above a match on the name of a set the entry
 * belongs to, which ranks above a match on the detail line alone. Ties keep
 * the index's order, which is alphabetical within each kind. The names are
 * folded the first time an index is searched, so an index must not be
 * changed after it is first searched.
 */
export function searchEntries(entries: SearchEntry[], query: string): SearchResult[] {
	const words = wordsOf(query);
	if (words.length === 0) return [];
	const phrase = words.join(' ');
	const results: SearchResult[] = [];
	for (const item of prepared(entries)) {
		let score = nameScore(item.title, words, phrase);
		let matchedName: string | undefined;
		if (score === 0) {
			for (const name of item.also) {
				const alsoScore = nameScore(name, words, phrase) - 10;
				if (alsoScore > score) {
					score = alsoScore;
					matchedName = name.name;
				}
			}
		}
		let matchedGroup: string | undefined;
		if (score <= 0) {
			for (const group of item.groups) {
				for (const name of group.names) {
					const groupScore = nameScore(name, words, phrase) - 20;
					if (groupScore > score) {
						score = groupScore;
						matchedGroup = group.shown;
					}
				}
			}
		}
		if (score <= 0 && item.everything && words.every((word) => item.everything.includes(word))) score = 10;
		if (score > 0) results.push({ ...item.entry, matchedName, matchedGroup, score });
	}
	return results.sort((first, second) => second.score - first.score);
}

let indexRequest: Promise<SearchEntry[]> | undefined;

/**
 * The search index, fetched once per visit and shared by the masthead's
 * search panel and the search page. A failed fetch is forgotten so the next
 * try fetches again.
 */
export function loadSearchIndex(): Promise<SearchEntry[]> {
	indexRequest ??= fetch('/search/index.json')
		.then((response) => {
			if (!response.ok) throw new Error(`${response.status}`);
			return response.json() as Promise<SearchEntry[]>;
		})
		.catch((problem: unknown) => {
			indexRequest = undefined;
			throw problem;
		});
	return indexRequest;
}
