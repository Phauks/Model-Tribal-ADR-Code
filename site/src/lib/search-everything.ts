/**
 * The matches for words typed into the site search, in every group the
 * search page lists: nations, laws and governing documents, stories, glossary
 * terms and pages. The masthead's search panel and the search page both use
 * it, so the count the panel gives is the count the search page shows (Trevor
 * found the panel saying 3 results for "navajo" while the search page listed
 * 7, on Nov. 23, 2026: the panel had left out the laws, which only the search
 * page searched, and counted stories it did not show).
 */
import {
	documentMatches,
	type DocumentSearchRow,
	type NationSearchRow,
	type SearchRecords
} from './search-records.ts';
import { searchEntries, searchKindLabels, type SearchEntry, type SearchResult } from './site-search.ts';
import { foldForSearch } from './tables/table-definition.ts';

/** The groups of results, in the order the panel and the search page list them. */
export type ResultGroup = 'nation' | 'document' | 'story' | 'term' | 'page';

export const resultGroups: ResultGroup[] = ['nation', 'document', 'story', 'term', 'page'];

export const resultGroupLabels: Record<ResultGroup, string> = {
	nation: searchKindLabels.nation,
	document: 'Laws and governing documents',
	story: searchKindLabels.story,
	term: searchKindLabels.term,
	page: searchKindLabels.page
};

/** A nation that matched: its search result (name matched, badges, seal) and its record for the filters. */
export interface NationMatch {
	result: SearchResult;
	row: NationSearchRow;
}

export interface SearchMatches {
	nation: NationMatch[];
	document: DocumentSearchRow[];
	story: SearchResult[];
	term: SearchResult[];
	page: SearchResult[];
}

/** Every match for the words, best first within each group; nothing when no words are typed. */
export function matchEverything(entries: SearchEntry[], records: SearchRecords, query: string): SearchMatches {
	const words = foldForSearch(query.trim()).split(/\s+/).filter(Boolean);
	if (words.length === 0) return { nation: [], document: [], story: [], term: [], page: [] };
	const results = searchEntries(entries, query);
	const nationsByLink = new Map(records.nations.map((row) => [row.link, row]));
	const nation = results
		.filter((result) => result.kind === 'nation')
		.map((result) => ({ result, row: nationsByLink.get(result.link) }))
		.filter((match): match is NationMatch => match.row !== undefined);
	return {
		nation,
		document: records.documents.filter((row) => documentMatches(row, words)),
		story: results.filter((result) => result.kind === 'story'),
		term: results.filter((result) => result.kind === 'term'),
		page: results.filter((result) => result.kind === 'page')
	};
}

/** How many matches there are in all. */
export function countMatches(matches: SearchMatches): number {
	return resultGroups.reduce((total, group) => total + matches[group].length, 0);
}
