/**
 * The matches for words typed into the site search, in every group the
 * search page lists: nations, nations' laws and governing documents, federal
 * law, courts and cases, people, stories, glossary terms, reference material
 * and pages. The masthead's search panel and the search page both use
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
import { searchEntries, searchKindLabels, type SearchEntry, type SearchKind, type SearchResult } from './site-search.ts';
import { foldForSearch } from './tables/table-definition.ts';

/** The groups of results, in the order the panel and the search page list them. */
export type ResultGroup = 'document' | SearchKind;

export const resultGroups: ResultGroup[] = ['nation', 'document', 'law', 'case', 'person', 'story', 'term', 'reference', 'page'];

/** The groups listed straight from the search index, each entry of the index's kind of the same name. */
export type EntryGroup = Exclude<ResultGroup, 'nation' | 'document'>;

export const entryGroups = resultGroups.filter((group): group is EntryGroup => group !== 'nation' && group !== 'document');

/** A value for each group listed straight from the index. */
export function forEntryGroups<Value>(value: (group: EntryGroup) => Value): Record<EntryGroup, Value> {
	const values: Partial<Record<EntryGroup, Value>> = {};
	for (const group of entryGroups) values[group] = value(group);
	return values as Record<EntryGroup, Value>;
}

export const resultGroupLabels: Record<ResultGroup, string> = {
	...searchKindLabels,
	document: 'Laws and governing documents'
};

/** A nation that matched: its search result (name matched, badges, seal) and its record for the filters. */
export interface NationMatch {
	result: SearchResult;
	row: NationSearchRow;
}

export type SearchMatches = {
	nation: NationMatch[];
	document: DocumentSearchRow[];
} & Record<EntryGroup, SearchResult[]>;

function noMatches(): SearchMatches {
	return { nation: [], document: [], ...forEntryGroups<SearchResult[]>(() => []) };
}

/** Every match for the words, best first within each group; nothing when no words are typed. */
export function matchEverything(entries: SearchEntry[], records: SearchRecords, query: string): SearchMatches {
	const words = foldForSearch(query.trim()).split(/\s+/).filter(Boolean);
	if (words.length === 0) return noMatches();
	const results = searchEntries(entries, query);
	const nationsByLink = new Map(records.nations.map((row) => [row.link, row]));
	const nation = results
		.filter((result) => result.kind === 'nation')
		.map((result) => ({ result, row: nationsByLink.get(result.link) }))
		.filter((match): match is NationMatch => match.row !== undefined);
	const matches = noMatches();
	matches.nation = nation;
	matches.document = records.documents.filter((row) => documentMatches(row, words));
	for (const result of results) {
		if (result.kind !== 'nation') matches[result.kind].push(result);
	}
	return matches;
}

/** How many matches there are in all. */
export function countMatches(matches: SearchMatches): number {
	return resultGroups.reduce((total, group) => total + matches[group].length, 0);
}
