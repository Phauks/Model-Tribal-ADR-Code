/**
 * What the advanced search filters on: the facts each nation's record holds,
 * reduced to short codes, and the laws and governing documents the records
 * list. Built with the site as /search/records.json
 * (src/lib/server/search-records.ts) and loaded only by the search page, so
 * the masthead's search stays small.
 *
 * "Found" in a facet means a source on record shows it. A nation with no
 * court on record may still have one that no source has listed yet, so the
 * filters only ever say what was found, never what a nation lacks.
 */
import { foldForSearch } from './tables/table-definition.ts';
import type { Facet, FacetOption } from './search-filters.ts';

/** A nation as the records file holds it: short codes for each facet. */
export interface NationFile {
	id: string;
	name: string;
	/** The states and territories in words, for the results table. */
	statesText: string;
	/** Recognition statuses in words, for the results table; no words for a nation without recognition. */
	recognitionText: string;
	recognition: string[];
	community: string;
	states: string[];
	region: string[];
	courts: string[];
	dispute: string[];
	laws: string[];
	gaming: string[];
}

/** A law or governing document as the records file holds it. */
export interface DocumentFile {
	title: string;
	kind: string;
	year?: string;
	nation: string;
	/** The heading on the nation's page that the result opens at. */
	anchor: string;
}

export interface SearchRecordsFile {
	nations: NationFile[];
	documents: DocumentFile[];
	/** The nations each story belongs to, by the story's address. */
	storyNations: Record<string, string[]>;
	/** Answers for the facets whose answers come from the data: states and regions. */
	stateOptions: FacetOption[];
	regionOptions: FacetOption[];
}

export interface NationSearchRow extends NationFile {
	link: string;
	/** What was found, in words, for the results table, such as "Court, constitution". */
	foundText: string;
}

export interface DocumentSearchRow extends DocumentFile {
	kindLabel: string;
	nationName: string;
	link: string;
}

export interface SearchRecords extends SearchRecordsFile {
	nations: NationSearchRow[];
	documents: DocumentSearchRow[];
}

export const recognitionOptions: FacetOption[] = [
	{ value: 'federal', label: 'Federally recognized' },
	{ value: 'state', label: 'State recognized' },
	{ value: 'petitioning', label: 'Petitioning for federal acknowledgment' },
	{ value: 'other', label: 'Recognized by Congress or territorial law' },
	{ value: 'none', label: 'Neither federal nor state recognition' }
];

export const communityOptions: FacetOption[] = [
	{ value: 'native-nation', label: 'Native nations' },
	{ value: 'native-hawaiian', label: 'Native Hawaiian community' },
	{ value: 'territorial-indigenous-people', label: 'Indigenous peoples of the territories' }
];

export const courtOptions: FacetOption[] = [
	{ value: 'tribal-court', label: 'Tribal court' },
	{ value: 'appeals', label: 'Court of appeals or supreme court' },
	{ value: 'wellness', label: 'Healing to wellness court' },
	{ value: 'intertribal', label: 'Intertribal court' },
	{ value: 'indian-offenses', label: 'Court of Indian Offenses' }
];

export const disputeOptions: FacetOption[] = [
	{ value: 'peacemaking', label: 'Peacemaking' },
	{ value: 'traditional', label: 'Traditional or customary forum' },
	{ value: 'restorative', label: 'Restorative justice' },
	{ value: 'mediation', label: 'Mediation' },
	{ value: 'arbitration', label: 'Arbitration' }
];

export const lawOptions: FacetOption[] = [
	{ value: 'constitution', label: 'Constitution or articles' },
	{ value: 'law-code', label: 'Law code or court rules' },
	{ value: 'corporate-charter', label: 'Corporate charter' }
];

export const gamingOptions: FacetOption[] = [
	{ value: 'compact', label: 'Tribal-state gaming compact' },
	{ value: 'ordinance', label: 'Gaming ordinance' },
	{ value: 'operates', label: 'Operates gaming' }
];

export const documentKindOptions: FacetOption[] = [
	{ value: 'constitution', label: 'Constitution' },
	{ value: 'articles-of-association', label: 'Articles of association' },
	{ value: 'law-code', label: 'Law code' },
	{ value: 'court-rules', label: 'Court rules' },
	{ value: 'corporate-charter', label: 'Corporate charter' },
	{ value: 'gaming-compact', label: 'Gaming compact' },
	{ value: 'secretarial-procedures', label: 'Secretarial procedures for gaming' },
	{ value: 'other', label: 'Other document' }
];

const foundHint = 'Found means a source on record shows it. A nation may have one no source lists yet.';

/** The nation facets, in the order the filter panel shows them. */
export function nationFacets(records: Pick<SearchRecords, 'stateOptions' | 'regionOptions'>): Facet<NationSearchRow>[] {
	return [
		{ key: 'recognition', label: 'Recognition', options: recognitionOptions, valuesOf: (row) => row.recognition },
		{ key: 'state', label: 'State or territory', options: records.stateOptions, valuesOf: (row) => row.states, long: true },
		{
			key: 'region',
			label: 'Bureau of Indian Affairs region',
			options: records.regionOptions,
			valuesOf: (row) => row.region
		},
		{ key: 'courts', label: 'Courts found', hint: foundHint, options: courtOptions, valuesOf: (row) => row.courts },
		{
			key: 'dispute',
			label: 'Other ways to resolve disputes found',
			hint: 'In a program, a forum or a law on record.',
			options: disputeOptions,
			valuesOf: (row) => row.dispute
		},
		{ key: 'laws', label: 'Laws found', options: lawOptions, valuesOf: (row) => row.laws },
		{ key: 'gaming', label: 'Gaming found', options: gamingOptions, valuesOf: (row) => row.gaming },
		{ key: 'community', label: 'Kind of community', options: communityOptions, valuesOf: (row) => [row.community] }
	];
}

export const documentFacets: Facet<DocumentSearchRow>[] = [
	{ key: 'document', label: 'Kind of document', options: documentKindOptions, valuesOf: (row) => [row.kind] }
];

/** Whether every word typed appears in the document's title, kind, year or nation. */
export function documentMatches(row: DocumentSearchRow, words: string[]): boolean {
	const haystack = foldForSearch(`${row.title} ${row.kindLabel} ${row.year ?? ''} ${row.nationName}`);
	return words.every((word) => haystack.includes(word));
}

function labelOf(options: FacetOption[], value: string): string {
	return options.find((option) => option.value === value)?.label ?? value;
}

/** What was found on a nation's record, in words, such as "Court, peacemaking, constitution". */
export function foundText(row: NationFile): string {
	const words = [
		row.courts.length > 0 ? 'Court' : '',
		...row.dispute.map((code) => labelOf(disputeOptions, code)),
		row.laws.includes('constitution') ? 'Constitution' : '',
		row.laws.includes('law-code') ? 'Law code' : '',
		row.gaming.includes('compact') ? 'Gaming compact' : ''
	].filter(Boolean);
	return words.map((word, position) => (position === 0 ? word : word.toLocaleLowerCase('en-US'))).join(', ');
}

/** Adds what the page shows but the file leaves out, so the file stays small. */
export function expandRecords(file: SearchRecordsFile): SearchRecords {
	const names = new Map(file.nations.map((row) => [row.id, row.name]));
	return {
		...file,
		nations: file.nations.map((row) => ({ ...row, link: `/nations/${row.id}`, foundText: foundText(row) })),
		documents: file.documents.map((row) => ({
			...row,
			kindLabel: labelOf(documentKindOptions, row.kind),
			nationName: names.get(row.nation) ?? row.nation,
			link: `/nations/${row.nation}#${row.anchor}`
		}))
	};
}

let recordsRequest: Promise<SearchRecords> | undefined;

/** The records file, fetched once per visit. A failed fetch is forgotten so the next try fetches again. */
export function loadSearchRecords(): Promise<SearchRecords> {
	recordsRequest ??= fetch('/search/records.json')
		.then((response) => {
			if (!response.ok) throw new Error(`${response.status}`);
			return response.json() as Promise<SearchRecordsFile>;
		})
		.then(expandRecords)
		.catch((problem: unknown) => {
			recordsRequest = undefined;
			throw problem;
		});
	return recordsRequest;
}
