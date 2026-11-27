/**
 * The Federal collections browsed with filters in the side column and a
 * grouped table (src/lib/collection-browser.ts; Trevor chose this for the
 * executive orders on Nov. 27, 2026, and asked for it to be built so the
 * other Federal collections can use it). Each collection is worked out when
 * the site is built, from the records in content/, and written as one static
 * file (src/routes/page-data), which its page and its items' pages read in
 * the Worker.
 *
 * A collection is added by writing its definition below and listing it in
 * `browseCollections`; its page is then /laws/<identifier>.
 */
import type { BrowseIdentifier } from '../browse-identifiers.ts';
import type { BrowseCollection, BrowseItem } from '../collection-browser.ts';
import { presidentTerms } from '../president-terms.ts';
import { sources, type SourceRecord } from './content.ts';
import { isoOf, orderNumber, orderPresident } from './law-facts.ts';

const federalLaw = { label: 'Federal law', href: '/laws' };

/** An order's kind, from its record's genre: proclamations and memoranda are kept with the executive orders (scripts/law/presidential_documents.py). */
function orderKind(record: SourceRecord): string {
	const genre = (record.citation as { genre?: string }).genre ?? '';
	return genre === 'Proclamation' ? 'proclamation' : genre === 'Memorandum' ? 'memorandum' : 'executive-order';
}

/** A proclamation's number, from "Proclamation No. 7840" or its title. */
function proclamationNumber(record: SourceRecord): string | undefined {
	return /Proclamation (?:No\. )?(\d+)\b/.exec(`${record.citation.number ?? ''} ${record.citation.title ?? ''}`)?.[1];
}

/**
 * An order's title without what the table's other columns say: its number
 * and date ("Executive Order No. 1598 of Sept. 2, 1912 (…)" reads "…").
 */
export function orderTitle(title: string): string {
	const stripped = title
		.replace(/^(?:Executive Order|Proclamation)(?: No\.)? ?\d[\w-]*(?: of [A-Z][a-z]+\.? \d+, \d{4})?,? ?/, '')
		.trim()
		.replace(/^\((.*)\)$/, '$1');
	return stripped || title;
}

const decadeOf = (date: string | undefined) => (date ? `${Math.floor(Number(date.slice(0, 4)) / 10) * 10}s` : undefined);

function executiveOrders(): BrowseCollection {
	const records = [...sources().values()].filter((record) => (record as SourceRecord & { kind?: string }).kind === 'executive-order');
	const presidents: Record<string, string> = {};
	const decades: Record<string, string> = {};
	const items: BrowseItem[] = records.map((record) => {
		const kind = orderKind(record);
		const date = isoOf(record.citation.issued?.['date-parts']?.[0]);
		const president = orderPresident(record);
		const decade = decadeOf(date);
		if (president) presidents[president.key] = president.name;
		if (decade) decades[decade] = decade;
		return {
			key: record.key,
			title: orderTitle(record.citation.title ?? record.key),
			number: kind === 'executive-order' ? orderNumber(record) : kind === 'proclamation' ? proclamationNumber(record) : undefined,
			date,
			values: { kind: [kind], ...(president ? { president: [president.key] } : {}), ...(decade ? { decade: [decade] } : {}) }
		};
	});
	// Presidents in the order they served, for any list that keeps it.
	const presidentOrder = Object.fromEntries(presidentTerms.filter((term) => term.key in presidents).map((term) => [term.key, term.name]));
	return {
		identifier: 'executive-orders',
		title: 'Executive Orders',
		path: '/laws/executive-orders',
		itemPath: '/laws',
		lead: 'Executive orders, proclamations and memoranda',
		itemName: 'order',
		findHint: 'Find an order: a number (6000) or words (Walker River)',
		section: federalLaw,
		facets: [
			{ key: 'kind', label: 'Kind', order: 'given', shown: 3, values: { 'executive-order': 'Executive orders', proclamation: 'Proclamations', memorandum: 'Memoranda' }, single: { 'executive-order': 'Order', proclamation: 'Proclamation', memorandum: 'Memorandum' } },
			{ key: 'president', label: 'President', order: 'count', shown: 6, values: presidentOrder, itemList: true },
			{ key: 'decade', label: 'Decade', order: 'newest', shown: 6, values: decades }
		],
		groupings: [
			{ key: 'president', label: 'President', facet: 'president' },
			{ key: 'decade', label: 'Decade', facet: 'decade', detail: 'president' },
			{ key: 'year', label: 'Year' }
		],
		defaultGroup: 'president',
		columns: [
			{ key: 'number', label: 'No.' },
			{ key: 'date', label: 'Date' },
			{ key: 'kind', label: 'Kind', wide: true },
			{ key: 'president', label: 'President', wide: true }
		],
		items,
		pageSize: 250
	};
}

/** The collections browsed this way, by their identifier (src/lib/browse-identifiers.ts lists the same, for the address matcher). */
const browseCollections: Record<BrowseIdentifier, () => BrowseCollection> = {
	'executive-orders': executiveOrders
};

export const browseKeys = (): string[] => Object.keys(browseCollections);

const isBrowseIdentifier = (identifier: string): identifier is BrowseIdentifier => identifier in browseCollections;

const built = new Map<string, BrowseCollection>();

export function browseCollection(identifier: string): BrowseCollection | undefined {
	if (!isBrowseIdentifier(identifier)) return undefined;
	const make = browseCollections[identifier];
	if (!built.has(identifier)) built.set(identifier, make());
	return built.get(identifier);
}
