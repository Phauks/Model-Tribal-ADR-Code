/**
 * The site search (Trevor asked on Nov. 22, 2026 for one search box at the
 * top of every page, in place of a search box on each list). The index is a
 * JSON file built with the site, /search/index.json, so search works without
 * a server and offline once the file is saved. Matching follows the tables'
 * rules (src/lib/tables/table-definition.ts): case and accents are ignored,
 * and every word typed must appear.
 */
import { foldForSearch } from './tables/table-definition.ts';

export type SearchKind = 'nation' | 'story' | 'term' | 'page';

export interface SearchEntry {
	kind: SearchKind;
	/** What the result is called, such as a nation's official name. */
	title: string;
	/** Other names that should find it: self-designations, former names, aliases. */
	also?: string[];
	/** One line shown under the title, such as the states or a summary. */
	detail?: string;
	link: string;
}

export const searchKindLabels: Record<SearchKind, string> = {
	nation: 'Nations and communities',
	story: 'Stories',
	term: 'Glossary',
	page: 'Pages'
};

export interface SearchResult extends SearchEntry {
	/** The other name that matched, when the title did not. */
	matchedName?: string;
	score: number;
}

function wordsOf(query: string): string[] {
	return foldForSearch(query).split(/\s+/).filter(Boolean);
}

/** How well one name matches: whole name, start of the name, start of a word, or anywhere. */
function nameScore(name: string, words: string[], phrase: string): number {
	const folded = foldForSearch(name);
	if (!words.every((word) => folded.includes(word))) return 0;
	if (folded === phrase) return 100;
	if (folded.startsWith(phrase)) return 80;
	const nameWords = folded.split(/[^\p{L}\p{N}]+/u);
	if (words.every((word) => nameWords.some((nameWord) => nameWord.startsWith(word)))) return 60;
	return 40;
}

/**
 * The entries that match, best first. A title match ranks above a match on
 * another name, which ranks above a match on the detail line alone. Ties keep
 * the index's order, which is alphabetical within each kind.
 */
export function searchEntries(entries: SearchEntry[], query: string): SearchResult[] {
	const words = wordsOf(query);
	if (words.length === 0) return [];
	const phrase = words.join(' ');
	const results: SearchResult[] = [];
	for (const entry of entries) {
		let score = nameScore(entry.title, words, phrase);
		let matchedName: string | undefined;
		if (score === 0) {
			for (const name of entry.also ?? []) {
				const alsoScore = nameScore(name, words, phrase) - 10;
				if (alsoScore > score) {
					score = alsoScore;
					matchedName = name;
				}
			}
		}
		if (score <= 0 && entry.detail) {
			const haystack = foldForSearch(`${entry.title} ${(entry.also ?? []).join(' ')} ${entry.detail}`);
			if (words.every((word) => haystack.includes(word))) score = 10;
		}
		if (score > 0) results.push({ ...entry, matchedName, score });
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
