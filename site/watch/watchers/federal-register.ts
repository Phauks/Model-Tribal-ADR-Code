/**
 * The Federal Register (docs/source-watch.md, "Sources and how each is
 * watched"). Three questions to the API each weekday hour, each for
 * documents published since the cursor:
 *
 * - documents from the agencies that work with Native nations;
 * - documents that affect Title 25 of the Code of Federal Regulations;
 * - presidential documents that mention tribes.
 *
 * The term search across every agency (about 4,900 documents in 2025, most
 * of them consultation notices) is its own watcher, federal-register-search,
 * which starts off until model triage runs.
 *
 * No key; the API's robots.txt bars only search pages, not the API.
 */
import { readPagedJson } from '../../src/lib/server/watch/drivers/api.ts';
import { defineWatcher, type CheckContext, type Feed, type FoundItem } from '../../src/lib/server/watch/watcher.ts';

const api = 'https://www.federalregister.gov/api/v1/documents.json';
/** On a first run, look back this far rather than at the whole history. */
export const firstLookBackDays = 14;

export const nativeAgencies = [
	'indian-affairs-bureau',
	'national-indian-gaming-commission',
	'indian-health-service',
	'hearings-and-appeals-office-interior-department',
	'special-trustee-for-american-indians-office',
	'navajo-and-hopi-indian-relocation-office',
	'indian-arts-and-crafts-board'
];

const fields = ['document_number', 'title', 'type', 'subtype', 'publication_date', 'agencies', 'html_url', 'pdf_url', 'abstract', 'cfr_references', 'executive_order_number', 'docket_ids'];

interface Document {
	document_number: string;
	title: string;
	type: string;
	subtype?: string | null;
	publication_date: string;
	agencies?: { slug?: string; name?: string }[];
	html_url?: string;
	pdf_url?: string;
	abstract?: string | null;
	cfr_references?: { title?: number; part?: string }[];
	executive_order_number?: string | null;
	docket_ids?: string[];
}

interface Page {
	results?: Document[];
	next_page_url?: string | null;
}

export function since(cursor: string | null, now: Date): string {
	if (cursor && /^\d{4}-\d{2}-\d{2}$/.test(cursor)) return cursor;
	return new Date(now.getTime() - firstLookBackDays * 86_400_000).toISOString().slice(0, 10);
}

export function queryAddress(conditions: [string, string][], from: string): string {
	const query = new URLSearchParams([['per_page', '100'], ['order', 'oldest'], ['conditions[publication_date][gte]', from], ...conditions, ...fields.map((field): [string, string] => ['fields[]', field])]);
	return `${api}?${query}`;
}

/** Which collections a document might join, by its type. */
export function feedsFor(document: Document): Feed[] {
	if (document.type === 'Presidential Document') return document.subtype === 'Executive Order' ? ['executive-orders'] : ['executive-orders', 'federal-register-notices'];
	if (document.type === 'Rule' || document.type === 'Proposed Rule') return ['federal-regulations', 'federal-register-notices'];
	return ['federal-register-notices'];
}

export function itemFor(document: Document): FoundItem {
	const cfrParts = (document.cfr_references ?? []).filter((reference) => reference.title && reference.part).map((reference) => `${reference.title} C.F.R. part ${reference.part}`);
	return {
		sourceIdentifier: document.document_number,
		kind: (document.subtype ?? document.type).toLowerCase().replace(/\s+/g, '-'),
		title: document.title,
		date: document.publication_date,
		link: document.html_url,
		fileAddress: document.pdf_url,
		feeds: feedsFor(document),
		summary: document.abstract ?? undefined,
		facts: {
			documentNumber: document.document_number,
			type: document.type,
			subtype: document.subtype ?? null,
			agencies: (document.agencies ?? []).map((agency) => agency.slug ?? agency.name ?? '').filter(Boolean),
			cfrParts,
			executiveOrderNumber: document.executive_order_number ?? null,
			dockets: document.docket_ids ?? []
		}
	};
}

/** Asks one question, and answers the items and the newest publication date seen. */
export async function ask(context: CheckContext, conditions: [string, string][], mostPages = 5): Promise<{ items: FoundItem[]; newest: string; more: boolean }> {
	const from = since(context.cursor, context.now);
	const { items, more } = await readPagedJson<Page, Document>(context, { firstAddress: queryAddress(conditions, from), items: (page) => page.results ?? [], next: (page) => page.next_page_url ?? null, mostPages });
	const newest = items.reduce((latest, document) => (document.publication_date > latest ? document.publication_date : latest), from);
	return { items: items.map(itemFor), newest, more };
}

export default defineWatcher({
	identifier: 'federal-register',
	title: 'Federal Register',
	tier: 1,
	feeds: ['federal-register-notices', 'federal-regulations', 'executive-orders', 'intergovernmental-agreements', 'governing-documents', 'tribal-codes', 'native-nations', 'nation:recognition', 'nation:gaming', 'nation:land_establishment', 'nation:jurisdiction', 'nation:jurisdiction_agreements'],
	driver: 'api',
	schedule: '7 * * * 1-5',
	hosts: ['www.federalregister.gov', 'www.govinfo.gov'],
	hosting: 'serve',
	documentation: ['https://www.federalregister.gov/developers/documentation/api/v1', 'https://www.federalregister.gov/reader-aids/policy/privacy-and-terms'],
	async check(context) {
		const questions: [string, string][][] = [
			nativeAgencies.map((agency): [string, string] => ['conditions[agencies][]', agency]),
			[['conditions[cfr][title]', '25']],
			[
				['conditions[type][]', 'PRESDOCU'],
				['conditions[term]', 'tribe | tribal | "Indian country" | "Alaska Native"']
			]
		];
		const byNumber = new Map<string, FoundItem>();
		let newest = since(context.cursor, context.now);
		let more = false;
		for (const conditions of questions) {
			const answer = await ask(context, conditions);
			for (const item of answer.items) byNumber.set(item.sourceIdentifier, item);
			// With more pages waiting, keep the cursor where it was, so the next run reads them.
			if (answer.more) more = true;
			else if (answer.newest > newest) newest = answer.newest;
		}
		return { items: [...byNumber.values()], cursor: more ? since(context.cursor, context.now) : newest, more };
	},
	rules: [
		{
			name: 'proposed-rule',
			decide: (item) => (item.facts?.type === 'Proposed Rule' ? { action: 'review', reason: 'A proposed rule: noted, not a record until it is final.', proposed: 'note', relevance: 0.6 } : null)
		},
		{
			name: 'title-25-rule',
			decide: (item) =>
				item.facts?.type === 'Rule' && Array.isArray(item.facts.cfrParts) && item.facts.cfrParts.some((part) => part.startsWith('25 C.F.R.')) && !/Inflation Adjustments?/i.test(item.title)
					? { action: 'review', reason: 'A final rule that changes Title 25 of the C.F.R.', feeds: ['federal-regulations'], proposed: 'add', relevance: 0.9 }
					: null
		}
	]
});
