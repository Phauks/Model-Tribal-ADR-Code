/**
 * The one list of the collections the site holds, counted when the site is
 * built for the Statistics page (/stats). Trevor asked on Nov. 24, 2026 for a
 * page counting our materials that grows as new data sets are added, so a
 * thread that adds a collection adds one entry here and the page, its chart,
 * its table and its downloads pick it up.
 *
 * docs/data-roadmap.md is the living list of every collection we plan, by
 * tier, with its status; when a collection there lands, add its entry here.
 *
 * Counts are of what the site shows: each `count` calls the same loader the
 * collection's own pages use, so a restricted record, one held for a nation's
 * approval, or an opinion held back for a privacy review is never counted.
 * Where items are held back, `heldBack` gives only how many, never which.
 */
import { documentHistories, glossary, methods, nations, sources, type SourceRecord } from './content.ts';
import { biographies } from './biographies.ts';
import { justiceKeys, presidentKeys } from './justice-pages.ts';
import { courtsWithPages } from './supreme-court-pages.ts';
import { heldBackOpinionCount, tribalCourtOpinions } from './tribal-court-opinions.ts';
import { publishedStories } from './stories.ts';
import { buildFormCatalog } from './form-catalog.ts';
import { copyGroups } from './copy-lists.ts';
import { dataChartList, dataTopicLink } from '../data-chart-list.ts';

/** The headings the collections are grouped under, in page order. */
export const collectionGroups = ['Native nations', 'Federal law', 'Courts and cases', 'People', 'Reference'] as const;
export type CollectionGroup = (typeof collectionGroups)[number];

export interface Collection {
	/** Unique and stable: used for the row's anchor and the download's key column. */
	identifier: string;
	/** Plural, as it reads beside its number, such as "Executive orders". */
	title: string;
	group: CollectionGroup;
	/** The page that lists the collection. */
	href: string;
	/** How many items the site shows. */
	count: () => number;
	/** The source record kinds it counts (schemas/source.schema.json), so a test can catch a new kind nobody counts. */
	sourceKinds?: string[];
	/** How many items exist but are held back, such as opinions awaiting a privacy review. Never which ones. */
	heldBack?: () => number;
	/** Why they are held back, read after the number: "held back for a privacy review". */
	heldBackReason?: string;
}

/** Source records of one kind (schemas/source.schema.json, kind). */
function sourcesOfKind(...kinds: string[]): () => number {
	return () => [...sources().values()].filter((record) => kinds.includes((record as SourceRecord & { kind?: string }).kind ?? '')).length;
}

/** Court cases decided by one court, by the citation's authority. */
function casesBy(test: (authority: string) => boolean): () => number {
	return () =>
		[...sources().values()].filter((record) => {
			const citation = record.citation as { type?: string; authority?: string; title?: string };
			return citation.type === 'legal_case' && citation.title && test(citation.authority ?? '');
		}).length;
}

const supremeCourt = (authority: string) => authority === 'Supreme Court of the United States';

export const collections: Collection[] = [
	// Native nations
	{ identifier: 'native-nations', title: 'Native nations', group: 'Native nations', href: '/nations', count: () => nations().filter((nation) => nation.entity_type === 'native-nation').length },
	{ identifier: 'governing-documents', title: 'Governing document histories', group: 'Native nations', href: dataTopicLink('constitutions-and-governance'), count: () => documentHistories().length },
	{ identifier: 'tribal-constitutions', title: 'Constitutions', group: 'Native nations', href: '/copies', sourceKinds: ['tribal-constitution'], count: sourcesOfKind('tribal-constitution') },
	{ identifier: 'tribal-codes', title: 'Codes and laws', group: 'Native nations', href: '/copies', sourceKinds: ['tribal-code', 'tribal-court-rule'], count: sourcesOfKind('tribal-code', 'tribal-court-rule') },
	{ identifier: 'intergovernmental-agreements', title: 'Compacts and agreements', group: 'Native nations', href: dataTopicLink('gaming'), sourceKinds: ['intergovernmental-agreement'], count: sourcesOfKind('intergovernmental-agreement') },
	{ identifier: 'stories', title: 'Stories', group: 'Native nations', href: '/stories', count: () => publishedStories().length },

	// Federal law
	{ identifier: 'treaties', title: 'Treaties', group: 'Federal law', href: dataTopicLink('treaties-and-land'), sourceKinds: ['treaty'], count: sourcesOfKindOrType('treaty') },
	{ identifier: 'federal-statutes', title: 'Statutes', group: 'Federal law', href: '/copies', sourceKinds: ['federal-statute'], count: sourcesOfKind('federal-statute') },
	{ identifier: 'federal-regulations', title: 'Regulations', group: 'Federal law', href: '/copies', sourceKinds: ['federal-regulation'], count: sourcesOfKind('federal-regulation') },
	{ identifier: 'executive-orders', title: 'Executive orders', group: 'Federal law', href: '/copies', sourceKinds: ['executive-order'], count: sourcesOfKind('executive-order') },
	{ identifier: 'federal-register-notices', title: 'Federal Register notices', group: 'Federal law', href: '/copies', sourceKinds: ['federal-register-notice'], count: sourcesOfKind('federal-register-notice') },

	// Courts and cases
	{ identifier: 'supreme-court-cases', title: 'Supreme Court cases', group: 'Courts and cases', href: '/supreme-court', count: casesBy(supremeCourt) },
	{ identifier: 'other-court-cases', title: 'Other court cases', group: 'Courts and cases', href: '/copies', count: casesBy((authority) => !supremeCourt(authority)) },
	{
		identifier: 'tribal-court-opinions',
		title: 'Tribal court opinions',
		group: 'Courts and cases',
		href: dataTopicLink('cases'),
		count: () => tribalCourtOpinions().length,
		heldBack: heldBackOpinionCount,
		heldBackReason: 'held back for a privacy review'
	},
	{ identifier: 'supreme-courts', title: 'Supreme Courts', group: 'Courts and cases', href: '/supreme-court', count: () => courtsWithPages().length },

	// People
	{ identifier: 'biographies', title: 'Biographies', group: 'People', href: '/biographies', count: () => biographies().length },
	{ identifier: 'justices', title: 'Justices', group: 'People', href: '/supreme-court', count: () => justiceKeys().length },
	{ identifier: 'presidents', title: 'Presidents', group: 'People', href: '/supreme-court', count: () => presidentKeys().length },

	// Reference
	{ identifier: 'source-copies', title: 'Source documents', group: 'Reference', href: '/copies', count: () => copyGroups().reduce((sum, group) => sum + group.count, 0) },
	{ identifier: 'charts', title: 'Charts', group: 'Reference', href: '/nations/data', count: () => dataChartList.length },
	{ identifier: 'glossary-terms', title: 'Glossary terms', group: 'Reference', href: '/glossary', count: () => glossary().length },
	{ identifier: 'methods', title: 'Methods', group: 'Reference', href: '/stories', count: () => methods().size },
	{ identifier: 'forms', title: 'Forms', group: 'Reference', href: '/forms', count: () => buildFormCatalog().length }
];

/** Source records of a kind, or cited as that type where no kind is set yet, as treaties are. */
function sourcesOfKindOrType(kind: string): () => number {
	return () =>
		[...sources().values()].filter((record) => {
			const recordKind = (record as SourceRecord & { kind?: string }).kind;
			return recordKind === kind || (record.citation as { type?: string }).type === kind;
		}).length;
}

/**
 * Source record kinds that are counted only within Source documents, not as a
 * collection of their own. A kind in neither this list nor any collection's
 * sourceKinds fails tests/collections.test.ts, so a new data set is not missed.
 */
export const kindsCountedOnlyAsSources = ['web-page', 'other', 'journal-article', 'report', 'book', 'book-chapter', 'journal', 'dataset', 'state-statute', 'territorial-statute', 'uniform-act', 'model-law', 'court-rule', 'federal-case', 'state-case', 'territorial-case', 'tribal-case'];

export interface CollectionCount {
	identifier: string;
	title: string;
	group: CollectionGroup;
	href: string;
	count: number;
	heldBack?: number;
	heldBackReason?: string;
}

/** Every collection with its count, in registry order, leaving out any that count nothing yet. */
export function collectionCounts(): CollectionCount[] {
	return collections
		.map(({ count, heldBack, sourceKinds: _kinds, ...collection }) => {
			const held = heldBack?.() ?? 0;
			return { ...collection, count: count(), ...(held > 0 ? { heldBack: held } : { heldBackReason: undefined }) };
		})
		.filter((collection) => collection.count > 0);
}

/** The collections under each heading, for the page, leaving out empty headings. */
export function collectionsByGroup(): { group: CollectionGroup; collections: CollectionCount[] }[] {
	const counts = collectionCounts();
	return collectionGroups
		.map((group) => ({ group, collections: counts.filter((collection) => collection.group === group) }))
		.filter(({ collections }) => collections.length > 0);
}
