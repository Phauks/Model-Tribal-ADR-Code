/**
 * The one list of the collections the site holds, counted when the site is
 * built for the Statistics page (/stats). Trevor asked on Nov. 24, 2026 for a
 * page counting our materials that grows as new data sets are added, so a
 * thread that adds a collection adds one entry here, and the page's card and the
 * collection's own list (/stats/<identifier>), with its downloads, pick it up.
 *
 * docs/data-roadmap.md is the living list of every collection we plan, by
 * tier, with its status; when a collection there lands, add its entry here.
 *
 * Counts are of what the site shows: each `items` calls the same loader the
 * collection's own pages use, so a restricted record, one held for a nation's
 * approval, or an opinion held back for a privacy review is never counted or
 * listed. The count is the number of items, so the card and its list agree.
 * Where items are held back, `heldBack` gives only how many, never which.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { documentHistories, glossary, nations, publicCopies, publicCopyFor, repositoryRoot, sources, type SourceRecord } from './content.ts';
import { parseCsv } from '../csv.ts';
import { biographies, biographyPath } from './biographies.ts';
import { peopleIndex } from './justice-pages.ts';
import { courtsWithPages } from './supreme-court-pages.ts';
import { courtPath } from './supreme-courts.ts';
import { courts as namedCourts } from './courts.ts';
import { heldBackOpinionCount, tribalCourtOpinions } from './tribal-court-opinions.ts';
import { storySummaries } from './stories.ts';
import { buildFormCatalog } from './form-catalog.ts';
import { copyPagePath } from '../public-copies.ts';
import { dataChartList, dataChartTrail } from '../data-chart-list.ts';

/** The headings the collections are grouped under, in page order. */
export const collectionGroups = ['Native nations', 'Federal law', 'Courts and cases', 'People', 'Reference'] as const;
export type CollectionGroup = (typeof collectionGroups)[number];

/** One item a collection counts, as a row of its list. */
export interface CollectionItem {
	title: string;
	/** Its page on this site, or where it is published. */
	href?: string;
	/** The year it was made, decided or issued, when known. */
	year?: number;
	/** One more fact for the list's third column, such as the court or nation. */
	detail?: string;
}

export interface Collection {
	/** Unique and stable: the address of its list, /stats/<identifier>. */
	identifier: string;
	/** Plural, as it reads on its card, such as "Executive Orders". */
	title: string;
	group: CollectionGroup;
	/** Every item the site shows, which is what the card counts. */
	items: () => CollectionItem[];
	/** The header of the list's third column, when items have a detail. */
	detailHeader?: string;
	/** An existing page that lists exactly these items; the card links there instead of /stats/<identifier>. */
	list?: string;
	/** Another page about the same items, linked from the list, such as Coverage for the nations. */
	related?: { label: string; href: string };
	/** The years covered, when the items' own years don't say it, such as each Court's whole tenure. */
	years?: () => string;
	/** The source record kinds it counts (schemas/source.schema.json), so a test can catch a new kind nobody counts. */
	sourceKinds?: string[];
	/** How many items exist but are held back, such as opinions awaiting a privacy review. Never which ones. */
	heldBack?: () => number;
	/** Why they are held back, read after the number: "held back for a privacy review". */
	heldBackReason?: string;
}

const kindOf = (record: SourceRecord) => (record as SourceRecord & { kind?: string }).kind ?? '';
const typeOf = (record: SourceRecord) => (record.citation as { type?: string }).type ?? '';

/** A source record as a list row: a case links to its page, anything else to our copy or else where it is published. */
function sourceItem(record: SourceRecord, detail?: string): CollectionItem {
	const link = record.original_link ?? record.citation.URL;
	const copy = publicCopyFor(link);
	const href = typeOf(record) === 'legal_case' ? `/cases/${record.key}` : copy ? copyPagePath(copy) : link;
	return { title: record.citation.title ?? record.key, href, year: record.citation.issued?.['date-parts']?.[0]?.[0], detail };
}

/** Source records of some kinds (schemas/source.schema.json), less treaties, which are their own collection. */
function sourcesOfKind(kinds: string[], detail?: (record: SourceRecord) => string | undefined): () => CollectionItem[] {
	return () =>
		[...sources().values()]
			.filter((record) => kinds.includes(kindOf(record)) && typeOf(record) !== 'treaty')
			.map((record) => sourceItem(record, detail?.(record)));
}

/** Treaties and the agreements ratified like them, cited as treaties whatever their kind. */
function treaties(): CollectionItem[] {
	return [...sources().values()].filter((record) => typeOf(record) === 'treaty').map((record) => sourceItem(record, tribesOf(record)));
}

/** Court cases with a name, by the citation's authority. */
function casesBy(test: (authority: string) => boolean): () => CollectionItem[] {
	return () =>
		[...sources().values()]
			.filter((record) => typeOf(record) === 'legal_case' && record.citation.title && test(record.citation.authority ?? ''))
			.map((record) => sourceItem(record, record.citation.authority));
}

const supremeCourt = (authority: string) => authority === 'Supreme Court of the United States';
/** Decisions of Interior's appeals board, their own collection (scripts/law/ibia_decisions.py). */
const indianAppealsBoard = (authority: string) => authority === 'Interior Board of Indian Appeals';

/** The Board's decisions held back for a privacy review (probate appeals and decisions about minors), by citation only. */
function heldBackBoardDecisions(): number {
	const file = path.join(repositoryRoot, 'research/ibia/held-back.csv');
	return existsSync(file) ? parseCsv(readFileSync(file, 'utf8')).length : 0;
}

function nationNameOf(): (id: string) => string {
	const names = new Map(nations().map((nation) => [nation.id, nation.names.official]));
	return (id) => names.get(id) ?? id;
}

const tribesOf = (record: SourceRecord) => {
	const name = nationNameOf();
	return record.tribes?.map(name).join('; ') || undefined;
};

export const collections: Collection[] = [
	// Native nations
	{
		identifier: 'native-nations',
		title: 'Native Nations',
		group: 'Native nations',
		detailHeader: 'States',
		related: { label: 'Coverage', href: '/nations/coverage' },
		items: () =>
			nations()
				.filter((nation) => nation.entity_type === 'native-nation')
				.map((nation) => ({ title: nation.names.official, href: `/nations/${nation.id}`, detail: [...new Set(nation.states?.map((place) => place.state))].join(', ') || undefined }))
	},
	{
		identifier: 'governing-documents',
		title: 'Governing Document Histories',
		group: 'Native nations',
		detailHeader: 'Nation',
		items: () => {
			const name = nationNameOf();
			return documentHistories().map((history) => ({
				title: history.title,
				href: history.nations?.[0] ? `/nations/${history.nations[0]}#document-${history.id}` : undefined,
				detail: history.nations?.map(name).join('; ')
			}));
		}
	},
	{ identifier: 'tribal-constitutions', title: 'Constitutions', group: 'Native nations', detailHeader: 'Nation', sourceKinds: ['tribal-constitution'], items: sourcesOfKind(['tribal-constitution'], tribesOf) },
	{ identifier: 'tribal-codes', title: 'Codes and Laws', group: 'Native nations', detailHeader: 'Nation', sourceKinds: ['tribal-code', 'tribal-court-rule'], items: sourcesOfKind(['tribal-code', 'tribal-court-rule'], tribesOf) },
	{ identifier: 'intergovernmental-agreements', title: 'Compacts and Agreements', group: 'Native nations', detailHeader: 'Nation', sourceKinds: ['intergovernmental-agreement'], items: sourcesOfKind(['intergovernmental-agreement'], tribesOf) },
	{
		identifier: 'stories',
		title: 'Stories',
		group: 'Native nations',
		detailHeader: 'Nation',
		items: () => storySummaries().map((story) => ({ title: story.title, href: `/stories/${story.id}`, detail: story.nations.map((nation) => nation.name).join('; ') || undefined }))
	},

	// Federal law
	{ identifier: 'treaties', title: 'Treaties and Agreements', group: 'Federal law', detailHeader: 'Nation', items: treaties },
	{ identifier: 'federal-statutes', title: 'Statutes', group: 'Federal law', sourceKinds: ['federal-statute'], items: sourcesOfKind(['federal-statute']) },
	{ identifier: 'federal-regulations', title: 'Regulations', group: 'Federal law', sourceKinds: ['federal-regulation'], items: sourcesOfKind(['federal-regulation']) },
	{ identifier: 'executive-orders', title: 'Executive Orders', group: 'Federal law', sourceKinds: ['executive-order'], items: sourcesOfKind(['executive-order']) },
	{ identifier: 'federal-register-notices', title: 'Federal Register Notices', group: 'Federal law', sourceKinds: ['federal-register-notice'], items: sourcesOfKind(['federal-register-notice']) },

	// Courts and cases
	{ identifier: 'supreme-court-cases', title: 'U.S. Supreme Court Cases', group: 'Courts and cases', items: casesBy(supremeCourt) },
	{ identifier: 'other-court-cases', title: 'Other Court Cases', group: 'Courts and cases', detailHeader: 'Court', items: casesBy((authority) => !supremeCourt(authority) && !indianAppealsBoard(authority)) },
	{
		identifier: 'interior-board-of-indian-appeals',
		title: 'Interior Board of Indian Appeals Decisions',
		group: 'Courts and cases',
		items: casesBy(indianAppealsBoard),
		heldBack: heldBackBoardDecisions,
		heldBackReason: 'held back for a privacy review'
	},
	{
		identifier: 'tribal-court-opinions',
		title: 'Tribal Court Opinions',
		group: 'Courts and cases',
		detailHeader: 'Court',
		items: () => tribalCourtOpinions().map((opinion) => ({ title: opinion.name, href: opinion.path, year: Number(opinion.year) || undefined, detail: opinion.court })),
		heldBack: heldBackOpinionCount,
		heldBackReason: 'held back for a privacy review'
	},
	{
		identifier: 'supreme-courts',
		title: 'U.S. Supreme Courts',
		group: 'Courts and cases',
		detailHeader: 'Years',
		items: () => courtsWithPages().map((court) => ({ title: court.name, href: courtPath(court.name) ?? undefined, year: Number(court.years.slice(0, 4)), detail: court.years.endsWith('–') ? `${court.years}today` : court.years })),
		years: () => {
			const courts = courtsWithPages();
			const last = courts.at(-1)?.years.split('–')[1];
			return courts.length ? `${courts[0].years.slice(0, 4)}–${last || 'today'}` : '';
		}
	},
	{ identifier: 'courts', title: 'Courts', group: 'Courts and cases', detailHeader: 'Kind', list: '/courts', items: () => namedCourts().map((court) => ({ title: court.name, href: `/courts/${court.key}`, detail: court.kind })) },

	// People
	{ identifier: 'biographies', title: 'Biographies', group: 'People', items: () => biographies().map((person) => ({ title: person.name, href: biographyPath(person.key) })) },
	{
		identifier: 'justices',
		title: 'U.S. Supreme Court Justices',
		group: 'People',
		detailHeader: 'Years',
		items: () => peopleIndex().justices.map((justice) => ({ title: justice.name, href: justice.link, year: Number(justice.start.slice(0, 4)), detail: justice.years.endsWith('–') ? `${justice.years}today` : justice.years })),
		years: () => {
			const years = peopleIndex().justices.map((justice) => Number(justice.start.slice(0, 4)));
			return years.length ? `${Math.min(...years)}–today` : '';
		}
	},
	{
		identifier: 'presidents',
		title: 'U.S. Presidents',
		group: 'People',
		detailHeader: 'Years',
		items: () => peopleIndex().presidents.map((president) => ({ title: president.name, href: president.link, year: president.start, detail: president.years.endsWith('–') ? `${president.years}today` : president.years })),
		years: () => {
			const years = peopleIndex().presidents.map((president) => president.start);
			return years.length ? `${Math.min(...years)}–today` : '';
		}
	},

	// Reference
	{ identifier: 'source-copies', title: 'Source Documents', group: 'Reference', list: '/copies', items: () => publicCopies().map((copy) => ({ title: copy.title ?? copy.key, href: copyPagePath(copy) })) },
	{ identifier: 'charts', title: 'Charts', group: 'Reference', items: () => dataChartList.map((chart) => ({ title: chart.title, href: dataChartTrail(chart).at(-1)?.href })) },
	{ identifier: 'glossary-terms', title: 'Glossary Terms', group: 'Reference', items: () => glossary().map((entry) => ({ title: entry.term, href: `/glossary/${entry.id}` })) },
	{ identifier: 'forms', title: 'Forms', group: 'Reference', items: () => buildFormCatalog().map((form) => ({ title: form.title, href: `/forms/${form.slug}` })) }
];

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
	/** Where its card leads: the list of exactly what it counts. */
	href: string;
	count: number;
	/** The years its items cover, such as "1823–2025". */
	years?: string;
	heldBack?: number;
	heldBackReason?: string;
}

/** The years a list of items covers, from the earliest to the latest. */
function yearSpan(items: CollectionItem[]): string | undefined {
	const years = items.map((item) => item.year).filter((year): year is number => Boolean(year));
	if (years.length === 0) return undefined;
	const first = Math.min(...years);
	const last = Math.max(...years);
	return first === last ? String(first) : `${first}–${last}`;
}

export const collectionPath = (identifier: string) => `/stats/${identifier}`;

/** Every collection with its count, in registry order, leaving out any that count nothing yet. */
export function collectionCounts(): CollectionCount[] {
	return collections
		.map((collection) => {
			const items = collection.items();
			const held = collection.heldBack?.() ?? 0;
			return {
				identifier: collection.identifier,
				title: collection.title,
				group: collection.group,
				href: collection.list ?? collectionPath(collection.identifier),
				count: items.length,
				...(collection.years ? { years: collection.years() } : yearSpan(items) ? { years: yearSpan(items) } : {}),
				...(held > 0 ? { heldBack: held, heldBackReason: collection.heldBackReason } : {})
			};
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

/** The collections that get their own list page: every one without an existing page that lists it. */
export const listedCollections = () => collections.filter((collection) => !collection.list && collection.items().length > 0);
