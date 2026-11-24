/**
 * The datasets a reader can build tables from at /nations/data/build
 * (src/lib/table-builder.ts). Each is drawn from the same files the rest of
 * the site reads, at build time, and written once as JSON beside the page.
 *
 * Citizen counts are left out: they are each nation's own data, which the
 * site does not tally across nations (CARE principles; the map leaves them
 * out for the same reason).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseCsv } from '../csv.ts';
import { displayName, stateName } from '../nation-labels.ts';
import { categoryOf } from '../nation-services.ts';
import { copyPagePath } from '../public-copies.ts';
import { shadedViewDefinitions, type ShadedMapView } from '../shaded-map-views.ts';
import type { BuilderColumn, BuilderDataset, BuilderDatasetSummary, BuilderValue } from '../table-builder.ts';
import { nations, publicCopyFor, repositoryRoot, type NationRecord } from './content.ts';
import { nationCategoryKeys } from './nations-map.ts';
import { recourseRows } from './recourse.ts';
import { tribalCourtOpinions } from './tribal-court-opinions.ts';

function readCsv(relativePath: string): Record<string, string>[] {
	return parseCsv(readFileSync(path.join(repositoryRoot, relativePath), 'utf8').normalize('NFC'));
}

const words = (key: string): string => {
	const text = key.replaceAll('-', ' ');
	return text.charAt(0).toLocaleUpperCase('en-US') + text.slice(1);
};
const unique = (values: string[]): string[] => [...new Set(values.filter(Boolean))];
const yearOf = (date: string | undefined): string => (/^\d{4}/.exec(date ?? '') ?? [''])[0];
const numberFrom = (text: string | undefined, pattern: RegExp): number | null => {
	const match = pattern.exec(text ?? '');
	return match ? Number(match[1]) : null;
};
const nationPath = (id: string): string => `/nations/${id}`;

/** A copy the site keeps of a document, or the document's own address. */
function documentLink(link: string | undefined): string {
	const copy = publicCopyFor(link);
	return copy ? copyPagePath(copy) : (link ?? '');
}

/** Builds a dataset from columns, each with the function that reads its value from one item. */
function datasetOf<Item>(
	description: Omit<BuilderDataset, 'columns' | 'rows' | 'links'>,
	items: Item[],
	columns: (BuilderColumn & { value: (item: Item) => BuilderValue })[],
	linkOf: (item: Item) => string
): BuilderDataset {
	return {
		...description,
		columns: columns.map(({ value: _value, ...column }) => column),
		rows: items.map((item) => columns.map((column) => {
			const value = column.value(item);
			return Array.isArray(value) && value.length === 0 ? null : value;
		})),
		links: items.map(linkOf)
	};
}

/** A nation's categories in one of the map's shaded views, in the words its table uses. */
function viewWords(view: ShadedMapView, record: NationRecord): string[] {
	const definition = shadedViewDefinitions[view];
	return nationCategoryKeys(view, record).map(
		(key) => definition.kindHeaders?.[key] ?? definition.categories?.find((category) => category.key === key)?.label ?? key
	);
}

const governanceValues = (record: NationRecord, aspect: string): string[] =>
	unique((record.governance ?? []).filter((fact) => fact.aspect === aspect).map((fact) => fact.value));

const charterWords: Record<string, string> = {
	'indian-reorganization-act': 'Indian Reorganization Act',
	'alaska-indian-reorganization-act': 'Alaska Indian Reorganization Act',
	'oklahoma-indian-welfare-act': 'Oklahoma Indian Welfare Act',
	other: 'Other'
};

function nationDataset(): BuilderDataset {
	const records = nations().filter((record) => record.entity_type === 'native-nation');
	const provisionCounts = new Map<string, number>();
	for (const row of recourseRows()) provisionCounts.set(row.nation.id, (provisionCounts.get(row.nation.id) ?? 0) + 1);
	const opinionCounts = new Map<string, number>();
	for (const opinion of tribalCourtOpinions()) for (const nation of opinion.nations) opinionCounts.set(nation, (opinionCounts.get(nation) ?? 0) + 1);
	const count = (value: number | undefined): number | null => (value ? value : null);

	return datasetOf(
		{ identifier: 'nations', title: 'Native nations', rowName: ['nation', 'nations'], nameColumn: 'name', sourceHref: '/nations' },
		records,
		[
			{ key: 'name', header: 'Name', type: 'text', starting: true, value: (record) => displayName(record.names.official) },
			{ key: 'recognition', header: 'Recognition', type: 'list', starting: true, value: (record) => viewWords('recognition', record) },
			{ key: 'states', header: 'States', type: 'list', starting: true, value: (record) => unique((record.states ?? []).map((fact) => stateName(fact.state))) },
			{ key: 'region', header: 'Region', type: 'text', starting: true, value: (record) => record.federal_administration?.bureau_of_indian_affairs_region ?? null },
			{ key: 'agency', header: 'Agency', type: 'text', value: (record) => record.federal_administration?.bureau_of_indian_affairs_agency ?? null },
			{ key: 'health-area', header: 'Indian Health Service Area', type: 'text', value: (record) => record.indian_health_service?.find((fact) => fact.area)?.area ?? null },
			{ key: 'organized-under', header: 'Organized under', type: 'list', value: (record) => unique((record.government_structure ?? []).map((fact) => charterWords[fact.kind] ?? words(fact.kind))) },
			{ key: 'head-of-government', header: 'Head of government', type: 'list', value: (record) => governanceValues(record, 'head-of-government') },
			{ key: 'governing-body', header: 'Governing body', type: 'list', value: (record) => governanceValues(record, 'governing-body') },
			{ key: 'governing-body-size', header: 'Governing body members', type: 'number', value: (record) => numberFrom(governanceValues(record, 'governing-body-size')[0], /^(\d+) members$/) },
			{ key: 'governing-body-term', header: 'Governing body term (years)', type: 'number', value: (record) => numberFrom(governanceValues(record, 'governing-body-term')[0], /^(\d+) years?\b/) },
			{ key: 'voting-age', header: 'Voting age', type: 'number', value: (record) => numberFrom(governanceValues(record, 'voting-age')[0], /^(\d+)$/) },
			{ key: 'governing-documents', header: 'Governing documents', type: 'list', starting: true, value: (record) => viewWords('governing-documents', record) },
			{ key: 'courts', header: 'Courts and forums', type: 'list', starting: true, value: (record) => viewWords('courts-and-peacemaking', record) },
			{ key: 'court-count', header: 'Courts', type: 'number', value: (record) => count(record.justice_institutions?.length) },
			{ key: 'provision-count', header: 'Dispute resolution provisions', type: 'number', value: (record) => count(provisionCounts.get(record.id)) },
			{ key: 'opinion-count', header: 'Tribal court opinions', type: 'number', value: (record) => count(opinionCounts.get(record.id)) },
			{ key: 'public-law-280', header: 'Public Law 280', type: 'list', value: (record) => viewWords('public-law-280', record) },
			{ key: 'violence-against-women-act', header: 'Violence Against Women Act jurisdiction', type: 'list', value: (record) => viewWords('violence-against-women-act', record) },
			{ key: 'other-jurisdiction-laws', header: 'Other jurisdiction laws', type: 'list', value: (record) => viewWords('other-jurisdiction-laws', record) },
			{ key: 'agreements', header: 'Agreements with states', type: 'list', value: (record) => viewWords('agreements-with-states', record) },
			{ key: 'gaming', header: 'Gaming', type: 'list', value: (record) => viewWords('gaming', record) },
			{ key: 'treaty-count', header: 'Treaties', type: 'number', value: (record) => count(new Set((record.treaties ?? []).map((treaty) => `${treaty.title}|${treaty.signed}`)).size) },
			{ key: 'land-set-aside', header: 'Land set aside by', type: 'list', value: (record) => viewWords('land-set-aside', record) },
			{ key: 'languages', header: 'Heritage languages', type: 'list', value: (record) => viewWords('heritage-languages', record) },
			{ key: 'memberships', header: 'Memberships', type: 'list', value: (record) => unique((record.memberships ?? []).map((fact) => fact.organization)) }
		],
		(record) => nationPath(record.id)
	);
}

/** Each nation's name by identifier, for datasets that name nations by identifier. */
function nationNames(): Map<string, string> {
	return new Map(nations().map((record) => [record.id, displayName(record.names.official)]));
}

function namesOf(ids: string, names: Map<string, string>): string[] {
	return unique(ids.split(/[;,]/).map((id) => id.trim()).map((id) => names.get(id) ?? ''));
}

function provisionDataset(): BuilderDataset {
	return datasetOf(
		{ identifier: 'provisions', title: 'Dispute resolution provisions', rowName: ['provision', 'provisions'], nameColumn: 'citation', nationColumn: 'nation', sourceHref: '/nations/recourse' },
		recourseRows(),
		[
			{ key: 'citation', header: 'Citation', type: 'text', starting: true, value: (row) => row.citation },
			{ key: 'nation', header: 'Nation', type: 'text', starting: true, value: (row) => row.nation.name },
			{ key: 'states', header: 'States', type: 'list', value: (row) => row.states },
			{ key: 'recognition', header: 'Recognition', type: 'list', value: (row) => row.recognition },
			{ key: 'method', header: 'Method', type: 'text', starting: true, value: (row) => row.method },
			{ key: 'subject', header: 'Kind of dispute', type: 'text', starting: true, value: (row) => row.subject },
			{ key: 'setting', header: 'Where it happens', type: 'text', value: (row) => words(row.setting) },
			{ key: 'entry', header: 'How it starts', type: 'text', value: (row) => words(row.entry) },
			{ key: 'outcome', header: 'Result', type: 'text', starting: true, value: (row) => words(row.outcome) },
			{ key: 'summary', header: 'Summary', type: 'text', value: (row) => row.summary }
		],
		(row) => row.link ?? ''
	);
}

function courtDataset(): BuilderDataset {
	const records = nations().filter((record) => record.entity_type === 'native-nation');
	const courts = records.flatMap((record) => (record.justice_institutions ?? []).map((court) => ({ record, court })));
	return datasetOf(
		{ identifier: 'courts', title: 'Courts and forums', rowName: ['court or forum', 'courts and forums'], nameColumn: 'name', nationColumn: 'nation', sourceHref: '/nations/map?view=courts-and-peacemaking' },
		courts,
		[
			{ key: 'name', header: 'Name', type: 'text', starting: true, value: ({ court }) => court.name },
			{ key: 'nation', header: 'Nation', type: 'text', starting: true, value: ({ record }) => displayName(record.names.official) },
			{ key: 'kind', header: 'Kind', type: 'text', starting: true, value: ({ court }) => words(court.kind) },
			{ key: 'category', header: 'Group', type: 'text', value: ({ court }) => categoryOf(court.kind).heading },
			{ key: 'appeals-to', header: 'Appeals go to', type: 'text', starting: true, value: ({ court }) => court.appeals_to?.court ?? null },
			{ key: 'states', header: 'States', type: 'list', starting: true, value: ({ record }) => unique((record.states ?? []).map((fact) => stateName(fact.state))) },
			{ key: 'region', header: 'Region', type: 'text', value: ({ record }) => record.federal_administration?.bureau_of_indian_affairs_region ?? null }
		],
		({ record }) => `${nationPath(record.id)}#courts-heading`
	);
}

const decisionWords: Record<string, string> = {
	approved: 'Approved',
	'deemed-approved': 'Deemed approved',
	extension: 'Extended',
	disapproved: 'Disapproved',
	'secretarial-procedures': 'Secretarial Procedures'
};

function compactDataset(): BuilderDataset {
	const names = nationNames();
	const clauses = new Map(readCsv('research/gaming/compact-clauses.csv').map((row) => [row.id, row]));
	const documents = readCsv('research/gaming/compact-documents.csv');
	const binding = (row: Record<string, string> | undefined): string | null => {
		const value = row?.['dispute_resolution.binding_arbitration'];
		return value === 'True' ? 'Yes' : value === 'False' ? 'No' : null;
	};
	return datasetOf(
		{ identifier: 'compacts', title: 'Gaming compacts', rowName: ['document', 'documents'], nameColumn: 'title', nationColumn: 'nations', sourceHref: '/nations/map?view=gaming' },
		documents,
		[
			{ key: 'title', header: 'Title', type: 'text', starting: true, value: (row) => row.title },
			{ key: 'nations', header: 'Nations', type: 'list', starting: true, value: (row) => namesOf(row.nations, names) },
			{ key: 'state', header: 'State', type: 'text', starting: true, value: (row) => stateName(row.state) },
			{ key: 'kind', header: 'Kind', type: 'text', starting: true, value: (row) => words(row.document_kind) },
			{ key: 'decision', header: 'Decision', type: 'text', starting: true, value: (row) => decisionWords[row.decision] ?? (row.decision ? words(row.decision) : null) },
			{ key: 'listed', header: 'Date', type: 'date', value: (row) => row.listed_date || null },
			{ key: 'year', header: 'Year', type: 'date', starting: true, value: (row) => yearOf(row.listed_date) || null },
			{ key: 'binding-arbitration', header: 'Binding arbitration', type: 'text', value: (row) => binding(clauses.get(row.id)) },
			{ key: 'term-years', header: 'Term (years)', type: 'number', value: (row) => numberFrom(clauses.get(row.id)?.['term.years'], /^(\d+)/) },
			{ key: 'federal-register', header: 'Federal Register', type: 'text', value: (row) => row['federal_register.citation'] || null }
		],
		(row) => documentLink(row.document_link)
	);
}

function constitutionDataset(): BuilderDataset {
	const names = nationNames();
	const rows = readCsv('research/constitutions/documents.csv').filter((row) => names.has(row.nation));
	return datasetOf(
		{ identifier: 'constitutions', title: 'Constitutions and charters', rowName: ['document', 'documents'], nameColumn: 'title', nationColumn: 'nation', sourceHref: '/nations/map?view=governing-documents' },
		rows,
		[
			{ key: 'title', header: 'Title', type: 'text', starting: true, value: (row) => [words(row.document_type), yearOf(row.adopted || row.approved)].filter(Boolean).join(', ') },
			{ key: 'nation', header: 'Nation', type: 'text', starting: true, value: (row) => names.get(row.nation) ?? null },
			{ key: 'kind', header: 'Kind', type: 'text', starting: true, value: (row) => words(row.document_type) },
			{ key: 'adopted', header: 'Adopted', type: 'date', starting: true, value: (row) => yearOf(row.adopted) || null },
			{ key: 'approved', header: 'Approved', type: 'date', value: (row) => yearOf(row.approved) || null },
			{ key: 'latest-amendment', header: 'Latest amendment', type: 'date', value: (row) => yearOf(row.latest_amendment) || null },
			{ key: 'secretarial-approval', header: 'Secretarial approval', type: 'text', starting: true, value: (row) => (row.secretarial_approval ? words(row.secretarial_approval) : null) },
			{ key: 'pages', header: 'Pages', type: 'number', value: (row) => numberFrom(row.pages, /^(\d+)$/) }
		],
		(row) => documentLink(row.link)
	);
}

function opinionDataset(): BuilderDataset {
	const names = nationNames();
	return datasetOf(
		{ identifier: 'opinions', title: 'Tribal court opinions', rowName: ['opinion', 'opinions'], nameColumn: 'name', nationColumn: 'nations', sourceHref: '/library' },
		tribalCourtOpinions(),
		[
			{ key: 'name', header: 'Name', type: 'text', starting: true, value: (opinion) => opinion.name },
			{ key: 'citation', header: 'Citation', type: 'text', starting: true, value: (opinion) => opinion.citation },
			{ key: 'court', header: 'Court', type: 'text', starting: true, value: (opinion) => opinion.court },
			{ key: 'nations', header: 'Nations', type: 'list', value: (opinion) => unique(opinion.nations.map((id) => names.get(id) ?? '')) },
			{ key: 'decided', header: 'Decided', type: 'date', value: (opinion) => opinion.decided || null },
			{ key: 'year', header: 'Year', type: 'date', starting: true, value: (opinion) => opinion.year || null },
			{ key: 'topics', header: 'Words that appear', type: 'list', starting: true, value: (opinion) => opinion.topics }
		],
		(opinion) => opinion.path
	);
}

function treatyDataset(): BuilderDataset {
	const treaties = new Map<string, { title: string; signed: string; statutes?: string; nations: string[]; nationIds: string[] }>();
	for (const record of nations()) {
		for (const treaty of record.treaties ?? []) {
			const key = `${treaty.title}|${treaty.signed}`;
			const entry = treaties.get(key) ?? { title: treaty.title, signed: treaty.signed, statutes: treaty.statutes_at_large, nations: [], nationIds: [] };
			entry.nations.push(displayName(record.names.official));
			entry.nationIds.push(record.id);
			treaties.set(key, entry);
		}
	}
	const items = [...treaties.values()].sort((first, second) => first.signed.localeCompare(second.signed));
	return datasetOf(
		{ identifier: 'treaties', title: 'Treaties', rowName: ['treaty', 'treaties'], nameColumn: 'title', nationColumn: 'nations', sourceHref: '/nations/map?view=treaties' },
		items,
		[
			{ key: 'title', header: 'Title', type: 'text', starting: true, value: (treaty) => treaty.title },
			{ key: 'signed', header: 'Signed', type: 'date', value: (treaty) => treaty.signed || null },
			{ key: 'year', header: 'Year', type: 'date', starting: true, value: (treaty) => yearOf(treaty.signed) || null },
			{ key: 'decade', header: 'Decade', type: 'date', value: (treaty) => (yearOf(treaty.signed) ? `${yearOf(treaty.signed).slice(0, 3)}0s` : null) },
			{ key: 'statutes-at-large', header: 'Statutes at Large', type: 'text', starting: true, value: (treaty) => treaty.statutes ?? null },
			{ key: 'nations', header: 'Nations', type: 'list', starting: true, value: (treaty) => unique(treaty.nations) }
		],
		(treaty) => `${nationPath(treaty.nationIds[0])}#treaties-heading`
	);
}

function agreementDataset(): BuilderDataset {
	const records = nations().filter((record) => record.entity_type === 'native-nation');
	const agreements = records.flatMap((record) => (record.jurisdiction_agreements ?? []).map((agreement) => ({ record, agreement })));
	return datasetOf(
		{ identifier: 'agreements', title: 'Agreements with states', rowName: ['agreement', 'agreements'], nameColumn: 'agreement', nationColumn: 'nation', sourceHref: '/nations/map?view=agreements-with-states' },
		agreements,
		[
			{ key: 'agreement', header: 'Agreement', type: 'text', starting: true, value: ({ agreement }) => agreement.agreement ?? words(agreement.kind) },
			{ key: 'nation', header: 'Nation', type: 'text', starting: true, value: ({ record }) => displayName(record.names.official) },
			{ key: 'kind', header: 'Kind', type: 'text', starting: true, value: ({ agreement }) => words(agreement.kind) },
			{ key: 'other-party', header: 'With', type: 'text', starting: true, value: ({ agreement }) => agreement.other_party },
			{ key: 'state', header: 'State', type: 'text', starting: true, value: ({ agreement }) => (agreement.state ? stateName(agreement.state) : null) },
			{ key: 'year', header: 'Year', type: 'date', value: ({ agreement }) => yearOf(agreement.date) || null },
			{ key: 'status', header: 'Status', type: 'text', value: ({ agreement }) => (agreement.status ? words(agreement.status) : null) }
		],
		({ record }) => `${nationPath(record.id)}#jurisdiction-heading`
	);
}

const builders: Record<string, () => BuilderDataset> = {
	nations: nationDataset,
	provisions: provisionDataset,
	courts: courtDataset,
	compacts: compactDataset,
	constitutions: constitutionDataset,
	opinions: opinionDataset,
	treaties: treatyDataset,
	agreements: agreementDataset
};

const datasetCache = new Map<string, BuilderDataset>();

export function builderDataset(identifier: string): BuilderDataset | undefined {
	const build = builders[identifier];
	if (!build) return undefined;
	if (!datasetCache.has(identifier)) datasetCache.set(identifier, build());
	return datasetCache.get(identifier);
}

export const builderDatasetIdentifiers = Object.keys(builders);

/** The dataset menu: each dataset's name and size, in menu order. */
export function builderDatasetSummaries(): BuilderDatasetSummary[] {
	return builderDatasetIdentifiers.map((identifier) => {
		const dataset = builderDataset(identifier) as BuilderDataset;
		return { identifier, title: dataset.title, rowCount: dataset.rows.length };
	});
}
