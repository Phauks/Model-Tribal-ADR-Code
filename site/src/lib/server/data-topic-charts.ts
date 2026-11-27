/**
 * The charts the topic pages of Data and charts added on Nov. 24, 2026 (Trevor: "create sub-pages for
 * data and charts, so we can have specialities into the charts and graphs, for our different topics"),
 * other than the gaming charts, which sit with the first gaming chart in data-charts.ts.
 *
 * Most count nations by a fact on their pages: a "nation chart" names, for each bar, which facts put a
 * nation under it, and the bar's page lists those nations with the facts and their sources. The rest
 * count treaties, Supreme Court cases and tribal court opinions, and their bars' pages list those.
 *
 * Every bar leads to the records it counts (Trevor, Nov. 23, 2026: "all tables should be clickable
 * into the data to explain itself"). Runs at build time only.
 */
import type { BarChartData } from '../bar-chart.ts';
import type { CitationMark } from '../citation-marks.ts';
import { dataChartNamed, type DataChartIdentifier } from '../data-chart-list.ts';
import { displayName, stateName } from '../nation-labels.ts';
import { copyPagePath } from '../public-copies.ts';
import type { TableColumn, TableRow } from '../tables/table-definition.ts';
import { nations, publicCopyFor, type CitedFact, type NationRecord } from './content.ts';
import type { ChartRecords, RecordItem } from './data-charts.ts';
import { SourceUses } from './source-uses.ts';
import { federalBasis, federalBases, basisNotTraced, isNativeNation, listSection, listSections, recognitionStatus, recognitionStatuses, statusFacts, withoutFederalRecord, withoutFederalRecords } from './recognition-status.ts';
import { courtPage, courtsWithPages } from './supreme-court-pages.ts';
import { opinionsSourceKey, tribalCourtOpinions, type TribalCourtOpinion } from './tribal-court-opinions.ts';

/** The address of the page that lists what one bar counts. */
export const chartRecordsPath = (chart: string, bar: string): string => `/nations/data/${chart}/${bar}`;

export const nationLink = (record: NationRecord, section: string) => `/nations/${record.id}#${section}`;
export const statesOf = (record: NationRecord) => [...new Set((record.states ?? []).map((fact) => fact.state))].map(stateName);
export const nationName = (record: NationRecord) => displayName(record.names.official);
export const byName = (first: { name: string }, second: { name: string }) => first.name.localeCompare(second.name, 'en', { sensitivity: 'base' });

export const nationColumn: TableColumn = { key: 'nation', header: 'Nation', isRowHeader: true, sortable: true };
export const statesColumn: TableColumn = { key: 'states', header: 'States', sortable: true, filterable: true };

export function nationCells(record: NationRecord, section: string): TableRow['cells'] {
	const states = statesOf(record);
	return {
		nation: { text: nationName(record), href: nationLink(record, section) },
		states: { text: states.join(', '), values: states }
	};
}

/** A part of the address made from a label, such as "new-mexico" from "New Mexico". */
const slugOf = (label: string) =>
	label
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');

/** A web address, or nothing when a record's link column holds something else. */
export const webLink = (link: unknown): string | undefined => (typeof link === 'string' && /^https?:\/\/\S+$/.test(link) ? link : undefined);

/** One fact that puts a nation under a bar, as its bar's page shows it. */
interface CountedFact {
	fact: CitedFact;
	text: string;
	href?: string;
}

/** A bar of a nation chart: its name and the facts that put a nation under it. */
interface NationBar {
	slug: string;
	label: string;
	facts: (record: NationRecord) => CountedFact[];
}

/** A chart that counts nations by facts on their pages. */
interface NationChart {
	identifier: DataChartIdentifier;
	/** What the chart counts, given the number of nations it counts. */
	description: (nations: number) => string;
	labelHeader: string;
	source: string;
	/** The part of a nation's page the facts are in, which a nation's name opens. */
	section: string;
	/** The part of the page the sources are listed under. */
	part: string;
	/** True when each nation counts under one bar only. */
	partsOfWhole?: boolean;
	shown?: number;
	/** Keeps the bars in the order given, as for ages or years, instead of largest first. */
	inOrder?: boolean;
	bars: (records: NationRecord[]) => NationBar[];
}

/** Bars for each value a list of facts takes, labelled from `words` (values without words are labelled as written). */
function barsByValue<Fact extends CitedFact>(
	factsOf: (record: NationRecord) => Fact[],
	valueOf: (fact: Fact) => string | undefined,
	words: Record<string, string>,
	textOf: (fact: Fact) => string,
	hrefOf: (fact: Fact) => string | undefined = () => undefined
): (records: NationRecord[]) => NationBar[] {
	return (records) => {
		const values = new Set(records.flatMap((record) => factsOf(record).map(valueOf).filter((value): value is string => Boolean(value))));
		const order = Object.keys(words);
		return [...values]
			.sort((first, second) => (order.includes(first) ? order.indexOf(first) : order.length) - (order.includes(second) ? order.indexOf(second) : order.length) || first.localeCompare(second))
			.map((value) => ({
				slug: slugOf(value),
				label: words[value] ?? value,
				facts: (record) => factsOf(record).filter((fact) => valueOf(fact) === value).map((fact) => ({ fact, text: textOf(fact), href: hrefOf(fact) }))
			}));
	};
}

/** Bars for each state a nation is in, each nation counted under each of its states, with the facts `factsOf` gives. */
function barsByState(factsOf: (record: NationRecord) => CountedFact[], statesFor: (record: NationRecord) => string[] = (record) => (record.states ?? []).map((fact) => fact.state)) {
	return (records: NationRecord[]): NationBar[] => {
		const states = new Set(records.filter((record) => factsOf(record).length > 0).flatMap(statesFor));
		return [...states].map((state) => ({
			slug: state.toLowerCase(),
			label: stateName(state),
			facts: (record) => (statesFor(record).includes(state) ? factsOf(record) : [])
		}));
	};
}

const governance = (aspect: string) => (record: NationRecord) => (record.governance ?? []).filter((fact) => fact.aspect === aspect);
const jurisdictionOn = (topic: string) => (record: NationRecord) => (record.jurisdiction ?? []).filter((fact) => fact.topic === topic);
const yearsOf = (value: string) => value.match(/^(\d+) years?\b/i)?.[1];

const recognitionWords: Record<string, string> = {
	federal: 'Federally recognized',
	state: 'State recognized',
	petitioning: 'Petitioning for federal recognition',
	'territorial-law': 'Recognized by territorial law',
	'congressional-special-relationship': 'Special relationship set by Congress'
};

const nationCharts: NationChart[] = [
	{
		identifier: 'constitutions-by-federal-act',
		description: (count) => `The ${count.toLocaleString('en-US')} nations whose pages say which federal act their constitution was adopted under. Pick an act to see the nations.`,
		labelHeader: 'Act',
		source: 'Each nation’s constitution or the federal list it was approved under, cited on the nation’s page.',
		section: 'government-heading',
		part: 'Government',
		bars: barsByValue(
			(record) => record.government_structure ?? [],
			(fact) => fact.kind,
			{
				'indian-reorganization-act': 'Indian Reorganization Act (1934)',
				'alaska-indian-reorganization-act': 'Alaska Indian Reorganization Act (1936)',
				'oklahoma-indian-welfare-act': 'Oklahoma Indian Welfare Act (1936)',
				other: 'Another act'
			},
			(fact) => fact.detail ?? 'Constitution adopted under the act'
		)
	},
	{
		identifier: 'governing-documents-by-kind',
		description: (count) => `How many of the ${count.toLocaleString('en-US')} nations with a governing document on their page have each kind. Pick a kind to see the nations and their documents.`,
		labelHeader: 'Document',
		source: 'Governing documents listed on nation pages, each with its own source.',
		section: 'law-heading',
		part: 'Laws and agreements',
		bars: barsByValue(
			(record) => record.governing_documents ?? [],
			(fact) => fact.kind,
			{ constitution: 'Constitution', 'law-code': 'Law code', 'corporate-charter': 'Corporate charter', 'articles-of-association': 'Articles of association', 'court-rules': 'Court rules', other: 'Other' },
			(fact) => [fact.title ?? 'Untitled', fact.year ? `(${fact.year})` : ''].filter(Boolean).join(' '),
			(fact) => {
				const copy = publicCopyFor(fact.link);
				return copy ? copyPagePath(copy) : webLink(fact.link);
			}
		)
	},
	{
		identifier: 'constitutions-by-voting-age',
		description: (count) => `The voting age in the constitutions of the ${count.toLocaleString('en-US')} nations whose pages give it. A nation whose constitutions have changed it counts under each age. Pick an age to see the nations.`,
		labelHeader: 'Voting age',
		source: 'Nations’ constitutions, read for their voting age; each reading is cited to the constitution on the nation’s page.',
		section: 'government-heading',
		part: 'Government',
		inOrder: true,
		bars: (records) => {
			const ageOf = (value: string) => (/^\d+$/.test(value.trim()) ? value.trim() : 'other');
			const ages = [...new Set(records.flatMap((record) => governance('voting-age')(record).map((fact) => ageOf(fact.value))))].sort((first, second) => (first === 'other' ? 1 : second === 'other' ? -1 : Number(first) - Number(second)));
			return ages.map((age) => ({
				slug: age,
				label: age === 'other' ? 'Other wording' : age,
				facts: (record) => governance('voting-age')(record).filter((fact) => ageOf(fact.value) === age).map((fact) => ({ fact, text: fact.value }))
			}));
		}
	},
	{
		identifier: 'constitutions-by-council-term',
		description: (count) => `How long council members serve under the constitutions of the ${count.toLocaleString('en-US')} nations whose pages give it, staggered or not. Pick a term to see the nations.`,
		labelHeader: 'Term',
		source: 'Nations’ constitutions, read for their council terms; each reading is cited to the constitution on the nation’s page.',
		section: 'government-heading',
		part: 'Government',
		inOrder: true,
		bars: (records) => {
			const termOf = (value: string) => yearsOf(value) ?? 'other';
			const terms = [...new Set(records.flatMap((record) => governance('governing-body-term')(record).map((fact) => termOf(fact.value))))].sort((first, second) => (first === 'other' ? 1 : second === 'other' ? -1 : Number(first) - Number(second)));
			return terms.map((term) => ({
				slug: term === 'other' ? 'other' : `${term}-years`,
				label: term === 'other' ? 'Other wording' : `${term} ${term === '1' ? 'year' : 'years'}`,
				facts: (record) => governance('governing-body-term')(record).filter((fact) => termOf(fact.value) === term).map((fact) => ({ fact, text: fact.value }))
			}));
		}
	},
	{
		identifier: 'court-practice-by-kind',
		description: (count) => `What the courts of ${count.toLocaleString('en-US')} nations publish for people using them. Pick a kind to see the nations and their pages.`,
		labelHeader: 'Published',
		source: 'Nations’ court websites, each page cited on the nation’s page.',
		section: 'courts-heading',
		part: 'Courts and dispute resolution',
		bars: barsByValue(
			(record) => record.court_practice ?? [],
			(fact) => fact.kind,
			{ forms: 'Court forms', 'court-rules': 'Court rules', 'bar-admission': 'Bar admission rules', 'filing-fees': 'Filing fees', 'public-defender': 'Public defender', 'legal-aid': 'Legal aid' },
			(fact) => fact.title,
			(fact) => webLink(fact.link)
		)
	},
	{
		identifier: 'courts-by-state',
		description: (count) => `The ${count.toLocaleString('en-US')} nations with a court or forum on their page, by state. A nation in several states counts in each. Pick a state to see the nations and their courts.`,
		labelHeader: 'State or territory',
		source: 'Courts and forums listed on nation pages, each with its own source.',
		section: 'courts-heading',
		part: 'Courts and dispute resolution',
		shown: 15,
		bars: barsByState((record) => (record.justice_institutions ?? []).map((fact) => ({ fact, text: fact.name, href: webLink(fact.link) })))
	},
	{
		identifier: 'public-law-280-status',
		description: (count) => `Where Public Law 280 (18 U.S.C. § 1162; 28 U.S.C. § 1360) stands for the land of ${count.toLocaleString('en-US')} nations. A nation in several states can count under several. Pick a line to see the nations.`,
		labelHeader: 'Status',
		source: 'Bureau of Indian Affairs lists of Public Law 280 states, state statutes and retrocession notices in the Federal Register, each cited on the nation’s page.',
		section: 'jurisdiction-heading',
		part: 'Jurisdiction',
		bars: barsByValue(
			jurisdictionOn('public-law-280'),
			(fact) => fact.value,
			{
				'mandatory-state': 'Mandatory state: the state has jurisdiction',
				'optional-state': 'Optional state that took jurisdiction',
				'not-a-public-law-280-state': 'Not a Public Law 280 state',
				'not-assumed': 'Optional state that did not take jurisdiction',
				retroceded: 'Jurisdiction returned to the United States',
				repealed: 'State repealed its assumption',
				'optional-state-consent-not-given': 'Nation did not consent',
				'assumption-held-invalid': 'Assumption held invalid by a court',
				excepted: 'Excepted by the statute',
				'concurrent-federal-jurisdiction-accepted': 'Concurrent federal jurisdiction accepted'
			},
			(fact) => fact.detail ?? ''
		)
	},
	{
		identifier: 'expanded-jurisdiction',
		description: (count) => `The ${count.toLocaleString('en-US')} nations sources record as using a federal law that widens what their own courts can hear or the sentences they can give. A grant to prepare is counted on its own, never as exercising. Pick a line to see the nations.`,
		labelHeader: 'Jurisdiction',
		source: 'Department of Justice lists of nations exercising special Tribal criminal jurisdiction, grant awards and nations’ own notices, each cited on the nation’s page.',
		section: 'jurisdiction-heading',
		part: 'Jurisdiction',
		bars: () =>
			(
				[
					['violence-against-women-act-special-tribal-criminal-jurisdiction', 'exercising', 'Special Tribal criminal jurisdiction (Violence Against Women Act)'],
					['violence-against-women-act-special-tribal-criminal-jurisdiction', 'implementation-grant', 'Federal grant to prepare for that jurisdiction'],
					['tribal-law-and-order-act-enhanced-sentencing', 'implementing', 'Enhanced sentencing (Tribal Law and Order Act)'],
					['indian-child-welfare-act', 'reassumed-jurisdiction', 'Reassumed jurisdiction (Indian Child Welfare Act)']
				] as const
			).map(([topic, value, label]) => ({
				slug: value === 'implementation-grant' ? 'implementation-grant' : topic.split('-')[0] === 'violence' ? 'violence-against-women-act' : topic.split('-')[0] === 'tribal' ? 'enhanced-sentencing' : 'child-welfare',
				label,
				facts: (record) => jurisdictionOn(topic)(record).filter((fact) => fact.value === value).map((fact) => ({ fact, text: fact.detail ?? label }))
			}))
	},
	{
		identifier: 'agreements-by-kind',
		description: (count) => `The ${count.toLocaleString('en-US')} nations with an agreement with a state, county, city or federal agency on their page, by kind. Most sources do not say whether an agreement is still in force. Pick a kind to see the agreements.`,
		labelHeader: 'Agreement',
		source: 'State and federal lists of agreements with Native nations, each cited on the nation’s page.',
		section: 'jurisdiction-heading',
		part: 'Jurisdiction',
		bars: barsByValue(
			(record) => record.jurisdiction_agreements ?? [],
			(fact) => fact.kind,
			{ 'child-welfare-agreement': 'Child welfare agreement', 'tax-agreement': 'Tax agreement', 'cross-deputization': 'Cross-deputization or law enforcement agreement', other: 'Other agreement' },
			(fact) => [fact.agreement ?? fact.other_party, fact.agreement ? `with ${fact.other_party}` : '', fact.status === 'expired' ? '(expired)' : ''].filter(Boolean).join(' ')
		)
	},
	{
		identifier: 'nations-by-recognition-status',
		description: (count) => `The ${count.toLocaleString('en-US')} Native nations on this site, each counted once: federally recognized, recognized by a state but not by the United States, or recognized by neither. A nation recognized by both counts as federally recognized. Pick a line to see the nations.`,
		labelHeader: 'Recognition',
		source: 'The Bureau of Indian Affairs list of recognized entities (91 Fed. Reg. 4102, Jan. 30, 2026), state laws and the Office of Federal Acknowledgment’s lists of petitioners, each cited on the nation’s page.',
		section: 'glance-heading',
		part: 'At a glance',
		partsOfWhole: true,
		inOrder: true,
		bars: () =>
			recognitionStatuses.map((status) => ({
				slug: slugOf(status),
				label: status,
				facts: (record) => (recognitionStatus(record) === status ? statusFacts(record).map((fact) => ({ fact, text: fact.legal_basis ?? status })) : [])
			}))
	},
	{
		identifier: 'federal-recognition-by-basis',
		description: (count) => `How the ${count.toLocaleString('en-US')} federally recognized nations came to be recognized, as far as their pages cite it. Being on the federal list is not itself a basis. Each nation counts once. Pick a line to see the nations and the law.`,
		labelHeader: 'Basis',
		source: 'Acts of Congress read in the Statutes at Large and final determinations of the Office of Federal Acknowledgment, each cited on the nation’s page.',
		section: 'glance-heading',
		part: 'At a glance',
		partsOfWhole: true,
		bars: () =>
			[...federalBases, basisNotTraced].map((basis) => ({
				slug: basis.slug,
				label: basis.label,
				facts: (record) => {
					const found = federalBasis(record);
					return found?.slug === basis.slug ? found.facts.map((fact) => ({ fact, text: fact.legal_basis ?? basis.label })) : [];
				}
			}))
	},
	{
		identifier: 'federal-list-sections',
		description: (count) => `The ${count.toLocaleString('en-US')} federally recognized nations, by the part of the federal list that names them. The list names the Native entities within the State of Alaska apart from the rest. Pick a line to see the nations.`,
		labelHeader: 'Listed',
		source: 'The Bureau of Indian Affairs list of recognized entities (91 Fed. Reg. 4102, Jan. 30, 2026).',
		section: 'glance-heading',
		part: 'At a glance',
		partsOfWhole: true,
		bars: () =>
			listSections.map((section) => ({
				slug: section.slug,
				label: section.label,
				facts: (record) =>
					listSection(record)?.slug === section.slug
						? (record.recognition ?? []).filter((fact) => fact.type === 'federal').slice(0, 1).map((fact) => ({ fact, text: fact.legal_basis ?? section.label }))
						: []
			}))
	},
	{
		identifier: 'without-federal-recognition',
		description: (count) => `What the federal record shows for the ${count.toLocaleString('en-US')} Native nations without federal recognition, whether or not a state recognizes them. Each nation counts once, under the first line that applies. Pick a line to see the nations and the records.`,
		labelHeader: 'Federal record',
		source: 'The Office of Federal Acknowledgment’s lists of petitioners and petitions resolved, Acts of Congress, and Census Bureau and other federal lists, each cited on the nation’s page.',
		section: 'glance-heading',
		part: 'At a glance',
		partsOfWhole: true,
		bars: () =>
			withoutFederalRecords.map((entry) => ({
				slug: entry.slug,
				label: entry.label,
				facts: (record) => {
					const found = withoutFederalRecord(record);
					return found?.slug === entry.slug ? found.facts.map((fact) => ({ fact, text: fact.legal_basis || (fact.petition_stage ? `Petition stage: ${String(fact.petition_stage)}` : '') || entry.label })) : [];
				}
			}))
	},
	{
		identifier: 'nations-by-recognition',
		description: (count) => `How the ${count.toLocaleString('en-US')} recognized or petitioning nations on this site are recognized. A nation recognized by both the United States and a state counts under each. Pick a line to see the nations.`,
		labelHeader: 'Recognition',
		source: 'The Bureau of Indian Affairs list of recognized entities (91 Fed. Reg. 4102, Jan. 30, 2026), state laws and the Office of Federal Acknowledgment’s list of petitioners, each cited on the nation’s page.',
		section: 'glance-heading',
		part: 'At a glance',
		bars: barsByValue(
			(record) => (record.recognition ?? []).filter((fact) => fact.type in recognitionWords),
			(fact) => fact.type,
			recognitionWords,
			(fact) => fact.legal_basis ?? recognitionWords[fact.type]
		)
	},
	{
		identifier: 'federally-recognized-by-state',
		description: (count) => `The ${count.toLocaleString('en-US')} federally recognized nations, by the states they are in. A nation in several states counts in each. Pick a state to see the nations.`,
		labelHeader: 'State',
		source: 'The Bureau of Indian Affairs list of recognized entities (91 Fed. Reg. 4102, Jan. 30, 2026) and the states listed on each nation’s page.',
		section: 'glance-heading',
		part: 'At a glance',
		shown: 15,
		bars: barsByState((record) => (record.recognition ?? []).filter((fact) => fact.type === 'federal').map((fact) => ({ fact, text: fact.legal_basis ?? 'Federally recognized' })))
	},
	{
		identifier: 'state-recognized-by-state',
		description: (count) => `The ${count.toLocaleString('en-US')} nations a state recognizes, by that state. Pick a state to see the nations and the law that recognizes them.`,
		labelHeader: 'State',
		source: 'State laws, resolutions and commissions that recognize Native nations, each cited on the nation’s page.',
		section: 'glance-heading',
		part: 'At a glance',
		bars: barsByState(
			// Native nations only: the Native Hawaiian community is not a tribe (counted on its own tile on Statistics).
			(record) => (isNativeNation(record) ? (record.recognition ?? []).filter((fact) => fact.type === 'state').map((fact) => ({ fact, text: fact.legal_basis ?? 'State recognized' })) : []),
			(record) => (isNativeNation(record) ? (record.recognition ?? []).filter((fact) => fact.type === 'state' && fact.state).map((fact) => fact.state as string) : [])
		)
	},
	{
		identifier: 'nations-by-bureau-region',
		description: (count) => `The ${count.toLocaleString('en-US')} federally recognized nations, by the Bureau of Indian Affairs region that serves them. Pick a region to see the nations and their agencies.`,
		labelHeader: 'Region',
		source: 'Bureau of Indian Affairs Tribal Leaders Directory, Nov. 2026.',
		section: 'glance-heading',
		part: 'At a glance',
		partsOfWhole: true,
		bars: barsByValue(
			(record) => (record.federal_administration ? [record.federal_administration] : []),
			(fact) => fact.bureau_of_indian_affairs_region,
			{},
			(fact) => fact.bureau_of_indian_affairs_agency ?? `${fact.bureau_of_indian_affairs_region} Region`
		)
	},
	{
		identifier: 'nations-by-health-service-area',
		description: (count) => `The ${count.toLocaleString('en-US')} nations served by an Indian Health Service Area, by Area. Pick an Area to see the nations and their service units.`,
		labelHeader: 'Area',
		source: 'Indian Health Service Area lists of Tribal health programs and service units, each cited on the nation’s page.',
		section: 'ties-heading',
		part: 'Treaties and federal ties',
		bars: barsByValue(
			(record) => record.indian_health_service ?? [],
			(fact) => fact.area,
			{},
			(fact) => [fact.service_unit, fact.operator].filter(Boolean).join(', ') || `${fact.area} Area`
		)
	},
	{
		identifier: 'land-by-method',
		description: (count) => `How the land of ${count.toLocaleString('en-US')} nations was first set aside, as far as their pages record it. A nation with several land areas can count under several. Pick a way to see the land areas.`,
		labelHeader: 'Set aside by',
		source: 'Treaties, executive orders and acts of Congress that set aside each land area, cited on the nation’s page.',
		section: 'ties-heading',
		part: 'Treaties and federal ties',
		bars: barsByValue(
			(record) => record.land_establishment ?? [],
			(fact) => fact.method,
			{ 'executive-order': 'Executive order', treaty: 'Treaty', statute: 'Act of Congress', agreement: 'Agreement', other: 'Other' },
			(fact) => [fact.land_area, fact.instrument].filter(Boolean).join(': ')
		)
	}
];

/** One nation chart's bars with the nations under each, worked out once per build. */
const nationChartCache = new Map<string, { chart: NationChart; nations: number; bars: { bar: NationBar; members: NationRecord[] }[] }>();

function nationChartData(chart: NationChart) {
	let found = nationChartCache.get(chart.identifier);
	if (!found) {
		const records = nations();
		const bars = chart.bars(records).map((bar) => ({ bar, members: records.filter((record) => bar.facts(record).length > 0) }));
		const counted = new Set(bars.flatMap(({ members }) => members.map((record) => record.id)));
		if (!chart.inOrder) bars.sort((first, second) => second.members.length - first.members.length || first.bar.label.localeCompare(second.bar.label));
		found = { chart, nations: counted.size, bars: bars.filter(({ members }) => members.length > 0) };
		nationChartCache.set(chart.identifier, found);
	}
	return found;
}

/* Treaties, cases and opinions -------------------------------------------- */

interface TreatyRow {
	title: string;
	signed: string;
	statutes?: string;
	link?: string;
	nations: NationRecord[];
	facts: CitedFact[];
}

let treatyCache: TreatyRow[] | undefined;

/** Each treaty named on a nation's page, once, with every nation that names it. */
function treaties(): TreatyRow[] {
	if (!treatyCache) {
		const byTitle = new Map<string, TreatyRow>();
		for (const record of nations()) {
			for (const fact of record.treaties ?? []) {
				const row = byTitle.get(fact.title) ?? { title: fact.title, signed: fact.signed, statutes: fact.statutes_at_large, link: webLink(fact.kappler?.link), nations: [], facts: [] };
				if (!row.nations.includes(record)) row.nations.push(record);
				row.facts.push(fact);
				byTitle.set(fact.title, row);
			}
		}
		treatyCache = [...byTitle.values()].filter((row) => /^\d{4}/.test(row.signed));
	}
	return treatyCache;
}

const decadeOf = (date: string) => `${date.slice(0, 3)}0s`;

/** Counts each value once per item, in the order `order` gives, or largest first. */
function countBy<Item>(items: Item[], valuesOf: (item: Item) => string[], order?: (first: string, second: string) => number): [string, number][] {
	const counts = new Map<string, number>();
	for (const item of items) for (const value of new Set(valuesOf(item))) counts.set(value, (counts.get(value) ?? 0) + 1);
	return [...counts].sort(order ? ([first], [second]) => order(first, second) : (first, second) => second[1] - first[1] || first[0].localeCompare(second[0]));
}

interface SupremeCourtCase {
	name: string;
	citation: string;
	link?: string;
	decided?: string;
	court: string;
	vote?: string;
}

let caseCache: SupremeCourtCase[] | undefined;

function supremeCourtCases(): SupremeCourtCase[] {
	caseCache ??= courtsWithPages()
		.filter((court) => court.cases > 0)
		.flatMap((court) => (courtPage(court.key)?.cases ?? []).map((item) => ({ name: item.name, citation: item.citation, link: item.link, decided: item.decided, court: court.name, vote: item.vote })));
	return caseCache;
}

const opinionTopicsShown = (opinion: TribalCourtOpinion) => opinion.topics;
/** The topic words that name a way of resolving a dispute outside a trial, for the Dispute resolution topic's chart of opinions. */
const resolutionTopics = new Set(['peacemaking', 'mediation', 'arbitration', 'alternative dispute resolution', 'talking things out', 'restorative justice']);
const resolutionWords = (opinion: TribalCourtOpinion) => opinion.topics.some((topic) => resolutionTopics.has(topic));

/* The charts --------------------------------------------------------------- */

export function topicCharts(): BarChartData[] {
	const charts: BarChartData[] = nationCharts.map((chart) => {
		const { nations: count, bars } = nationChartData(chart);
		return {
			...dataChartNamed(chart.identifier),
			partsOfWhole: chart.partsOfWhole,
			description: chart.description(count),
			labelHeader: chart.labelHeader,
			valueHeader: 'Nations',
			source: chart.source,
			shown: chart.shown,
			bars: bars.map(({ bar, members }) => ({ label: bar.label, value: members.length, href: chartRecordsPath(chart.identifier, bar.slug) }))
		};
	});

	const treatyRows = treaties();
	const cases = supremeCourtCases();
	const opinions = tribalCourtOpinions();
	const opinionsSource = 'Tribal court opinions published in American Tribal Law and the Navajo Reporter, from the Caselaw Access Project, Harvard Law School Library.';
	const chronological = (first: string, second: string) => first.localeCompare(second);
	const resolutionOpinions = opinions.filter(resolutionWords);

	charts.push(
		{
			...dataChartNamed('treaties-by-decade'),
			description: `${treatyRows.length.toLocaleString('en-US')} treaties with the United States named on nations’ pages, by the decade they were signed. Pick a decade to see the treaties.`,
			labelHeader: 'Decade',
			valueHeader: 'Treaties',
			partsOfWhole: true,
			source: 'Charles J. Kappler, Indian Affairs: Laws and Treaties, vol. 2 (1904), linked to each nation that succeeds a party to the treaty.',
			bars: countBy(treatyRows, (row) => [decadeOf(row.signed)], chronological).map(([decade, value]) => ({ label: decade, value, href: chartRecordsPath('treaties-by-decade', decade) }))
		},
		{
			...dataChartNamed('supreme-court-cases-by-court'),
			description: `The ${cases.length.toLocaleString('en-US')} Supreme Court of the United States cases on this site, by the Court that decided them, named for its Chief Justice. Pick a Court to see its cases.`,
			labelHeader: 'Court',
			valueHeader: 'Cases',
			partsOfWhole: true,
			source: 'The cases cited in the essays on this site, with each Court’s years from the Supreme Court’s own list of Justices.',
			bars: courtsWithPages()
				.filter((court) => court.cases > 0)
				.map((court) => ({ label: court.name, value: court.cases, href: chartRecordsPath('supreme-court-cases-by-court', court.key) }))
		},
		{
			...dataChartNamed('supreme-court-cases-by-vote'),
			description: 'The same cases, by the vote. Pick a vote to see its cases.',
			labelHeader: 'Vote',
			valueHeader: 'Cases',
			partsOfWhole: true,
			source: 'The official reports of each case, as recorded on its page.',
			bars: countBy(cases, (item) => [item.vote ?? 'Not recorded'], (first, second) => (first === 'Not recorded' ? 1 : second === 'Not recorded' ? -1 : Number(second.split('–')[0]) - Number(first.split('–')[0]))).map(([vote, value]) => ({
				label: vote,
				value,
				href: chartRecordsPath('supreme-court-cases-by-vote', vote === 'Not recorded' ? 'not-recorded' : vote.replace('–', '-'))
			}))
		},
		{
			...dataChartNamed('tribal-opinions-by-decade'),
			description: `${opinions.length.toLocaleString('en-US')} published tribal court opinions on this site, by the decade they were decided. Pick a decade to see the opinions.`,
			labelHeader: 'Decade',
			valueHeader: 'Opinions',
			partsOfWhole: true,
			source: opinionsSource,
			bars: countBy(opinions, (opinion) => [decadeOf(opinion.decided)], chronological).map(([decade, value]) => ({ label: decade, value, href: chartRecordsPath('tribal-opinions-by-decade', decade) }))
		},
		{
			...dataChartNamed('tribal-opinions-by-topic'),
			description: 'The same opinions, by the words they use: a tag means the words appear in the opinion, not what it decides. An opinion can have several. Pick a topic to see the opinions.',
			labelHeader: 'Topic',
			valueHeader: 'Opinions',
			source: opinionsSource,
			bars: countBy(opinions, opinionTopicsShown).map(([topic, value]) => ({ label: topic.charAt(0).toUpperCase() + topic.slice(1), value, href: chartRecordsPath('tribal-opinions-by-topic', slugOf(topic)) }))
		},
		{
			...dataChartNamed('tribal-opinions-by-nation'),
			description: 'The same opinions, by the nation whose court decided them. Pick a nation to see its opinions.',
			labelHeader: 'Nation',
			valueHeader: 'Opinions',
			source: opinionsSource,
			shown: 15,
			bars: (() => {
				const byIdentifier = new Map(nations().map((record) => [record.id, record]));
				return countBy(opinions, (opinion) => opinion.nations).flatMap(([id, value]) => {
					const record = byIdentifier.get(id);
					return record ? [{ label: nationName(record), value, href: chartRecordsPath('tribal-opinions-by-nation', id) }] : [];
				});
			})()
		},
		{
			...dataChartNamed('opinions-on-dispute-resolution-by-decade'),
			description: `The ${resolutionOpinions.length.toLocaleString('en-US')} published tribal court opinions that use the words peacemaking, mediation, arbitration, restorative justice or talking things out, by decade. Pick a decade to see the opinions.`,
			labelHeader: 'Decade',
			valueHeader: 'Opinions',
			partsOfWhole: true,
			source: opinionsSource,
			bars: countBy(resolutionOpinions, (opinion) => [decadeOf(opinion.decided)], chronological).map(([decade, value]) => ({ label: decade, value, href: chartRecordsPath('opinions-on-dispute-resolution-by-decade', decade) }))
		}
	);
	return charts;
}

/* The pages behind the bars ------------------------------------------------ */

const opinionColumns: TableColumn[] = [
	{ key: 'opinion', header: 'Opinion', isRowHeader: true, sortable: true },
	{ key: 'citation', header: 'Citation', sortable: true },
	{ key: 'court', header: 'Court', sortable: true, filterable: true },
	{ key: 'decided', header: 'Decided', type: 'date', sortable: true },
	{ key: 'topics', header: 'Words used', sortable: true, filterable: true }
];

function opinionRows(list: TribalCourtOpinion[]): TableRow[] {
	return list.map((opinion) => ({
		key: opinion.key,
		cells: {
			opinion: { text: opinion.name, href: opinion.path },
			citation: { text: opinion.citation },
			court: { text: opinion.court, values: [opinion.court] },
			decided: { text: opinion.decided, sortValue: opinion.decided },
			topics: { text: opinion.topics.join(', '), values: opinion.topics }
		}
	}));
}

/** The records one bar of a topic chart counts, or nothing when this module has no such chart or bar. */
export function topicChartRecords(
	chart: { identifier: string; title: string },
	bar: { label: string; value: number },
	barKey: string,
	uses: SourceUses
): ChartRecords | undefined {
	const base = { chart: { identifier: chart.identifier, title: chart.title }, bar: { slug: barKey, label: bar.label, value: bar.value } };
	const items: ChartRecords['items'] = {};
	const nationChart = nationCharts.find((candidate) => candidate.identifier === chart.identifier);

	if (nationChart) {
		const found = nationChartData(nationChart).bars.find(({ bar: candidate }) => candidate.slug === barKey);
		if (!found) return undefined;
		uses.part(nationChart.part, bar.label);
		const rows = found.members
			.map((record) => ({ record, name: nationName(record) }))
			.sort(byName)
			.map(({ record, name }) => {
				const listed: RecordItem[] = found.bar.facts(record).map(({ fact, text, href }) => {
					const citations: CitationMark[] = [];
					uses.citeFact(fact, nationChart.part, `${name}: ${text || bar.label}`, citations);
					return { text: text || bar.label, href, citations };
				});
				items[record.id] = { facts: listed };
				return { key: record.id, cells: { ...nationCells(record, nationChart.section), facts: { text: listed.map((item) => item.text).join('; ') } } };
			});
		return {
			...base,
			description: `The ${rows.length.toLocaleString('en-US')} ${rows.length === 1 ? 'nation' : 'nations'} counted under “${bar.label}”, each with the facts that put it there and their sources. A nation’s name opens the part of its page the facts are in.`,
			rowName: ['nation', 'nations'],
			columns: [nationColumn, statesColumn, { key: 'facts', header: nationChart.labelHeader, custom: true, sortable: true }],
			rows,
			items,
			sources: uses.list
		};
	}

	if (chart.identifier === 'treaties-by-decade') {
		const members = treaties().filter((row) => decadeOf(row.signed) === barKey).sort((first, second) => first.signed.localeCompare(second.signed));
		uses.part('Treaties');
		const rows = members.map((row) => {
			const citations: CitationMark[] = [];
			uses.citeFact(row.facts[0], 'Treaties', row.title, citations);
			items[row.title] = {
				treaty: [{ text: row.title, href: row.link, citations }],
				nations: row.nations.map((record) => ({ text: nationName(record), href: nationLink(record, 'treaties-heading'), citations: [] }))
			};
			return {
				key: row.title,
				cells: {
					treaty: { text: row.title, href: row.link },
					signed: { text: row.signed, sortValue: row.signed },
					statutes: { text: row.statutes ?? '' },
					nations: { text: row.nations.map(nationName).join('; ') }
				}
			};
		});
		return {
			...base,
			description: `The ${rows.length.toLocaleString('en-US')} ${rows.length === 1 ? 'treaty' : 'treaties'} signed in the ${barKey}, with the nations whose pages name each as a successor of a party. A treaty’s title opens its text in Kappler.`,
			rowName: ['treaty', 'treaties'],
			columns: [
				{ key: 'treaty', header: 'Treaty', isRowHeader: true, sortable: true, custom: true },
				{ key: 'signed', header: 'Signed', type: 'date', sortable: true },
				{ key: 'statutes', header: 'Statutes at Large', sortable: true },
				{ key: 'nations', header: 'Nations', custom: true, sortable: true }
			],
			rows,
			items,
			sources: uses.list
		};
	}

	if (chart.identifier === 'supreme-court-cases-by-court' || chart.identifier === 'supreme-court-cases-by-vote') {
		const court = courtsWithPages().find((candidate) => candidate.key === barKey);
		const members = supremeCourtCases().filter((item) =>
			chart.identifier === 'supreme-court-cases-by-court' ? item.court === court?.name : (item.vote?.replace('–', '-') ?? 'not-recorded') === barKey
		);
		const rows = members.map((item) => ({
			key: `${item.citation}-${item.name}`,
			cells: {
				case: { text: item.name, href: item.link },
				citation: { text: item.citation },
				decided: { text: item.decided ?? '', sortValue: item.decided ?? '' },
				court: { text: item.court, values: [item.court] },
				vote: { text: item.vote ?? '' }
			}
		}));
		return {
			...base,
			description: `The ${rows.length.toLocaleString('en-US')} ${rows.length === 1 ? 'case' : 'cases'} counted under “${bar.label}”. A case’s name opens it on this site.`,
			rowName: ['case', 'cases'],
			columns: [
				{ key: 'case', header: 'Case', isRowHeader: true, sortable: true },
				{ key: 'citation', header: 'Citation', sortable: true },
				{ key: 'decided', header: 'Decided', type: 'date', sortable: true },
				{ key: 'court', header: 'Court', sortable: true, filterable: true },
				{ key: 'vote', header: 'Vote', sortable: true, filterable: true }
			],
			rows,
			items,
			sources: uses.list
		};
	}

	const opinions = tribalCourtOpinions();
	const opinionFilters: Record<string, (opinion: TribalCourtOpinion) => boolean> = {
		'tribal-opinions-by-decade': (opinion) => decadeOf(opinion.decided) === barKey,
		'tribal-opinions-by-topic': (opinion) => opinion.topics.some((topic) => slugOf(topic) === barKey),
		'tribal-opinions-by-nation': (opinion) => opinion.nations.includes(barKey),
		'opinions-on-dispute-resolution-by-decade': (opinion) => resolutionWords(opinion) && decadeOf(opinion.decided) === barKey
	};
	const keep = opinionFilters[chart.identifier];
	if (keep) {
		const members = opinions.filter(keep);
		uses.part('Tribal court opinions');
		uses.add(opinionsSourceKey, { section: 'Tribal court opinions', text: `${members.length.toLocaleString('en-US')} opinions counted under “${bar.label}”` });
		return {
			...base,
			description: `The ${members.length.toLocaleString('en-US')} published tribal court ${members.length === 1 ? 'opinion' : 'opinions'} counted under “${bar.label}”, newest first. An opinion’s name opens it on this site.${chart.identifier.includes('topic') || chart.identifier.startsWith('opinions-on') ? ' The words show that a topic comes up in the opinion, not what it decides.' : ''}`,
			rowName: ['opinion', 'opinions'],
			columns: opinionColumns,
			rows: opinionRows(members),
			items,
			sources: uses.list
		};
	}
	return undefined;
}

