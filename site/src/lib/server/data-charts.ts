/**
 * The counts behind the Data and charts page (/nations/data), the third of
 * the data views Trevor chose on Nov. 23, 2026. Each chart is a list of bars
 * with a caption and a source line.
 *
 * Every bar leads to the records it counts (Trevor, Nov. 23, 2026: "all
 * tables should be clickable into the data to explain itself"). A bar about
 * dispute resolution provisions links to Find recourse with the same filter;
 * every other bar links to its own page under /nations/data/<chart>/<bar>,
 * which lists the nations or compacts behind the number, each linked to its
 * page or document and cited to its source (chartRecords below).
 *
 * Runs at build time only, like content.ts.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseCsv } from '../csv.ts';
import type { BarChartData } from '../bar-chart.ts';
import type { CitationMark } from '../citation-marks.ts';
import { displayName, stateName } from '../nation-labels.ts';
import { categoryOf } from '../nation-services.ts';
import { copyPagePath } from '../public-copies.ts';
import { recourseLink } from '../recourse.ts';
import { dataChartNamed } from '../data-chart-list.ts';
import type { TableColumn, TableRow } from '../tables/table-definition.ts';
import { nations, publicCopyFor, repositoryRoot, type NationRecord } from './content.ts';
import { recourseRows } from './recourse.ts';
import { SourceUses, type SourceEntry } from './source-uses.ts';

function readCsv(relativePath: string): Record<string, string>[] {
	return parseCsv(readFileSync(path.join(repositoryRoot, relativePath), 'utf8').normalize('NFC'));
}

/** Counts each value once per item, largest first, ties in reading order. */
function tally<Item>(items: Item[], valuesOf: (item: Item) => string[]): [string, number][] {
	const counts = new Map<string, number>();
	for (const item of items) {
		for (const value of new Set(valuesOf(item))) counts.set(value, (counts.get(value) ?? 0) + 1);
	}
	return [...counts].sort(
		(first, second) => second[1] - first[1] || first[0].localeCompare(second[0], 'en', { sensitivity: 'base' })
	);
}

/** Groups items under each value they have, as tally() counts them; each group keeps the items' order. */
function groupBy<Item>(items: Item[], valuesOf: (item: Item) => string[]): Map<string, Item[]> {
	const groups = new Map<string, Item[]>();
	for (const item of items) {
		for (const value of new Set(valuesOf(item))) groups.set(value, [...(groups.get(value) ?? []), item]);
	}
	return groups;
}

const constitutionStatusWords: Record<string, string> = {
	'current-text-found': 'Current text found',
	'text-found-currency-unknown': 'Text found, not known to be current',
	'undated-text-only': 'Undated text only',
	'archival-copies-only': 'Only older library or archive copies',
	'listed-but-not-retrieved': 'Listed, but no copy found',
	'none-found': 'No constitution found in our search',
	'nation-says-no-written-constitution': 'The nation says it has no written constitution'
};

/** A gaming compact's dispute clause, as the chart sorts it, with the part of the address its bar's page uses. */
function arbitrationOf(row: Record<string, string>): { slug: string; label: string } {
	const binding = row['dispute_resolution.binding_arbitration'];
	if (binding === 'True') return { slug: 'binding-arbitration', label: 'Binding arbitration' };
	if (binding === 'False') return { slug: 'no-binding-arbitration', label: 'No binding arbitration' };
	return { slug: 'not-stated', label: 'Not stated in the clause read' };
}

const forumsOf = (record: NationRecord) => record.justice_institutions ?? [];

/** The address of the page that lists what one bar counts. */
export const chartRecordsPath = (chart: string, bar: string): string => `/nations/data/${chart}/${bar}`;

/** The data the charts and their record pages share, read once per build. */
interface ChartInputs {
	records: NationRecord[];
	byId: Map<string, NationRecord>;
	constitutionRows: Record<string, string>[];
	compacts: Record<string, string>[];
}

let inputCache: ChartInputs | undefined;

function inputs(): ChartInputs {
	if (!inputCache) {
		const records = nations();
		inputCache = {
			records,
			byId: new Map(records.map((record) => [record.id, record])),
			constitutionRows: readCsv('research/constitutions/coverage.csv'),
			compacts: readCsv('research/gaming/compact-clauses.csv').filter((row) => row.document_is === 'full-compact')
		};
	}
	return inputCache;
}

export function dataCharts(): BarChartData[] {
	const provisions = recourseRows();
	const provisionSource =
		'Dispute resolution provisions read from each nation’s published law codes, court rules and ordinances, Nov. 2026. Each provision is counted once.';

	const { records, constitutionRows, compacts } = inputs();
	const withForums = records.filter((record) => forumsOf(record).length > 0);
	const forums = tally(withForums, (record) => forumsOf(record).map((fact) => categoryOf(fact.kind).id));
	const forumHeadings = new Map(withForums.flatMap((record) => forumsOf(record).map((fact) => [categoryOf(fact.kind).id, categoryOf(fact.kind).heading] as const)));

	const constitutions = tally(constitutionRows, (row) => [row.status]);
	const arbitration = tally(compacts, (row) => [arbitrationOf(row).slug]);
	const arbitrationWords = new Map(compacts.map((row) => [arbitrationOf(row).slug, arbitrationOf(row).label]));

	return [
		{
			...dataChartNamed('provisions-by-method'),
			description: `${provisions.length.toLocaleString('en-US')} dispute resolution provisions in Native nations’ own laws. Pick a method to read its provisions.`,
			labelHeader: 'Method',
			valueHeader: 'Provisions',
			source: provisionSource,
			bars: tally(provisions, (row) => [row.method]).map(([label, value]) => ({
				label,
				value,
				href: recourseLink('method', label)
			}))
		},
		{
			...dataChartNamed('provisions-by-dispute'),
			description: 'The same provisions, by the kind of dispute they cover. Pick a kind to read its provisions.',
			labelHeader: 'Kind of dispute',
			valueHeader: 'Provisions',
			source: provisionSource,
			bars: tally(provisions, (row) => [row.subject]).map(([label, value]) => ({
				label,
				value,
				href: recourseLink('subject', label)
			}))
		},
		{
			...dataChartNamed('provisions-by-state'),
			description:
				'The same provisions, by the states of the nations that enacted them. A nation in several states counts in each. The counts show where published law was found, not where dispute resolution is missing.',
			labelHeader: 'State or territory',
			valueHeader: 'Provisions',
			source: provisionSource,
			shown: 15,
			bars: tally(provisions, (row) => row.states).map(([label, value]) => ({
				label,
				value,
				href: recourseLink('state', label)
			}))
		},
		{
			...dataChartNamed('forums-by-kind'),
			description: `How many of the ${withForums.length.toLocaleString('en-US')} nations with a court or forum listed on their page have each kind. Pick a kind to see the nations and their courts.`,
			labelHeader: 'Kind',
			valueHeader: 'Nations',
			source: 'Courts and forums listed on nation pages, each with its own source.',
			bars: forums.map(([id, value]) => ({
				label: forumHeadings.get(id) ?? id,
				value,
				href: chartRecordsPath('forums-by-kind', id)
			}))
		},
		{
			...dataChartNamed('constitutions-by-status'),
			description:
				'What the search for each federally recognized nation’s constitution found. “No constitution found” does not mean a nation has none: many are not online, and some nations keep theirs to citizens. Pick a line to see the nations.',
			labelHeader: 'What was found',
			valueHeader: 'Nations',
			source: 'Search of nations’ own websites, law libraries and Bureau of Indian Affairs files for the 581 federally recognized nations, Nov. 2026.',
			bars: constitutions.map(([status, value]) => ({
				label: constitutionStatusWords[status] ?? status,
				value,
				href: chartRecordsPath('constitutions-by-status', status)
			}))
		},
		{
			...dataChartNamed('compacts-by-arbitration'),
			description: `${compacts.length.toLocaleString('en-US')} full tribal-state gaming compacts approved by the Department of the Interior, by what their dispute clause says. Amendments and extensions are left out. Pick a line to see the compacts.`,
			labelHeader: 'Dispute clause',
			valueHeader: 'Compacts',
			source:
				'Compacts listed by the Office of Indian Gaming, read by machine for their dispute clauses, Nov. 2026; the readings await review.',
			bars: arbitration.map(([slug, value]) => ({
				label: arbitrationWords.get(slug) ?? slug,
				value,
				href: chartRecordsPath('compacts-by-arbitration', slug)
			}))
		}
	];
}

/** One item in a cell of a record page, such as one court, with its link and the markers of its sources. */
export interface RecordItem {
	text: string;
	href?: string;
	/** A short line under the item, such as where in a compact its dispute clause is. */
	detail?: string;
	citations: CitationMark[];
}

/** The page behind one bar: the records it counts, as a table, with their sources. */
export interface ChartRecords {
	chart: { identifier: string; title: string };
	bar: { slug: string; label: string; value: number };
	/** What the rows are and what the count means, under the heading. */
	description: string;
	/** What one row is, for the table's count. */
	rowName: [string, string];
	columns: TableColumn[];
	rows: TableRow[];
	/** The items custom columns draw, by row key and then column key. */
	items: Record<string, Record<string, RecordItem[]>>;
	sources: SourceEntry[];
}

const nationLink = (record: NationRecord, section: string) => `/nations/${record.id}#${section}`;
const statesOf = (record: NationRecord) => [...new Set((record.states ?? []).map((fact) => fact.state))].map(stateName);
const nationName = (record: NationRecord) => displayName(record.names.official);
const byName = (first: { name: string }, second: { name: string }) => first.name.localeCompare(second.name, 'en', { sensitivity: 'base' });

const nationColumn: TableColumn = { key: 'nation', header: 'Nation', isRowHeader: true, sortable: true };
const statesColumn: TableColumn = { key: 'states', header: 'States', sortable: true, filterable: true };

function nationCells(record: NationRecord, section: string): TableRow['cells'] {
	const states = statesOf(record);
	return {
		nation: { text: nationName(record), href: nationLink(record, section) },
		states: { text: states.join(', '), values: states }
	};
}

/** Every bar that has a record page, for prerendering: [chart, bar]. */
export function chartRecordEntries(): { chart: string; bar: string }[] {
	return dataCharts().flatMap((chart) =>
		chart.bars
			.filter((bar) => bar.href?.startsWith('/nations/data/'))
			.map((bar) => {
				const [, , , chartKey, barKey] = (bar.href ?? '').split('/');
				return { chart: chartKey, bar: barKey };
			})
	);
}

/** The records one bar counts, or nothing when the chart or bar is unknown. */
export function chartRecords(chartKey: string, barKey: string): ChartRecords | undefined {
	const chart = dataCharts().find((candidate) => candidate.identifier === chartKey);
	const bar = chart?.bars.find((candidate) => candidate.href === chartRecordsPath(chartKey, barKey));
	if (!chart || !bar) return undefined;
	const base = { chart: { identifier: chart.identifier, title: chart.title }, bar: { slug: barKey, label: bar.label, value: bar.value } };
	const { records, byId, constitutionRows, compacts } = inputs();
	const uses = new SourceUses();
	const items: ChartRecords['items'] = {};

	if (chartKey === 'forums-by-kind') {
		const members = groupBy(records, (record) => forumsOf(record).map((fact) => categoryOf(fact.kind).id)).get(barKey) ?? [];
		uses.part(bar.label);
		const rows = members
			.map((record) => ({ record, name: nationName(record) }))
			.sort(byName)
			.map(({ record, name }) => {
				const forums = forumsOf(record)
					.filter((fact) => categoryOf(fact.kind).id === barKey)
					.map((fact) => {
						const citations: CitationMark[] = [];
						uses.citeFact(fact, bar.label, `${name}: ${fact.name}`, citations);
						return { text: fact.name, href: fact.link, citations };
					});
				items[record.id] = { forums };
				return { key: record.id, cells: { ...nationCells(record, 'courts-heading'), forums: { text: forums.map((forum) => forum.text).join('; ') } } };
			});
		return {
			...base,
			description: `The ${members.length.toLocaleString('en-US')} ${members.length === 1 ? 'nation whose page lists' : 'nations whose pages list'} ${bar.label.toLocaleLowerCase('en-US')}, with the name of each and the source that names it. A nation’s name opens the courts and dispute resolution part of its page.`,
			rowName: ['nation', 'nations'],
			columns: [nationColumn, statesColumn, { key: 'forums', header: bar.label, custom: true, sortable: true }],
			rows,
			items,
			sources: uses.list
		};
	}

	if (chartKey === 'constitutions-by-status') {
		const members = constitutionRows.filter((row) => row.status === barKey);
		uses.part('Constitutions on record');
		const rows = members.flatMap((row) => {
			const record = byId.get(row.nation);
			if (!record) return [];
			const name = nationName(record);
			const documents = (record.governing_documents ?? [])
				.filter((fact) => fact.kind === 'constitution' || fact.kind === 'articles-of-association')
				.map((fact) => {
					const citations: CitationMark[] = [];
					const text = [fact.title ?? 'Constitution', fact.year ? `(${fact.year})` : ''].filter(Boolean).join(' ');
					uses.citeFact(fact, 'Constitutions on record', `${name}: ${text}`, citations);
					const copy = publicCopyFor(fact.link);
					return { text, href: copy ? copyPagePath(copy) : fact.link, citations };
				});
			items[record.id] = { documents };
			return [{
				key: record.id,
				name,
				cells: {
					...nationCells(record, 'law-heading'),
					newest: { text: row.newest_version_label },
					documents: { text: documents.map((document) => document.text).join('; ') },
					website: { text: row.website_searched === 'True' ? 'Yes' : row.website_searched === 'False' ? 'No' : '' }
				}
			}];
		});
		rows.sort(byName);
		return {
			...base,
			description: `The ${rows.length.toLocaleString('en-US')} ${rows.length === 1 ? 'nation' : 'nations'} for which the search found: ${bar.label.toLocaleLowerCase('en-US')}. Each row gives the newest version the search found and the constitutions the nation’s page lists, each with its source. A nation’s name opens the laws part of its page, which says where we searched.`,
			rowName: ['nation', 'nations'],
			columns: [
				nationColumn,
				statesColumn,
				{ key: 'newest', header: 'Newest version found', sortable: true },
				{ key: 'documents', header: 'Constitutions on the nation’s page', custom: true },
				{ key: 'website', header: 'Nation’s website searched', sortable: true, filterable: true }
			],
			rows: rows.map(({ key, cells }) => ({ key, cells })),
			items,
			sources: uses.list
		};
	}

	if (chartKey === 'compacts-by-arbitration') {
		const members = compacts.filter((row) => arbitrationOf(row).slug === barKey);
		const rows = members
			.map((row) => {
				const copy = publicCopyFor(row.document_link);
				const linked = row.nations
					.split(/[;,]\s*/)
					.map((id) => byId.get(id.trim()))
					.filter((record): record is NationRecord => record !== undefined)
					.map((record) => ({ text: nationName(record), href: nationLink(record, 'law-heading'), citations: [] }));
				const clause: RecordItem = {
					text: row['dispute_resolution.summary'] || 'The clause read says nothing on this.',
					detail: row['dispute_resolution.locator'] ? `In the compact: ${row['dispute_resolution.locator']}` : undefined,
					citations: []
				};
				items[row.id] = { nations: linked, clause: [clause] };
				return {
					key: row.id,
					cells: {
						compact: { text: row.title, href: copy ? copyPagePath(copy) : row.document_link || undefined },
						nations: { text: linked.map((nation) => nation.text).join('; ') },
						state: { text: stateName(row.state), values: [stateName(row.state)] },
						date: { text: row.listed_date, sortValue: row.listed_date },
						clause: { text: clause.text }
					}
				};
			})
			.sort((first, second) => first.cells.compact.text.localeCompare(second.cells.compact.text, 'en', { sensitivity: 'base' }));
		return {
			...base,
			description: `The ${rows.length.toLocaleString('en-US')} full gaming ${rows.length === 1 ? 'compact' : 'compacts'} whose dispute clause was read as: ${bar.label.toLocaleLowerCase('en-US')}. Each compact’s title opens the compact itself, the source of the reading; the clause is summed up in plain words, with where it sits in the compact. The readings were made by machine and await review, so read the compact before relying on one.`,
			rowName: ['compact', 'compacts'],
			columns: [
				{ key: 'compact', header: 'Compact', isRowHeader: true, sortable: true },
				{ key: 'nations', header: 'Nations', custom: true, sortable: true },
				{ key: 'state', header: 'State', sortable: true, filterable: true },
				{ key: 'date', header: 'Listed', type: 'date', sortable: true },
				{ key: 'clause', header: 'What the dispute clause says', custom: true }
			],
			rows,
			items,
			sources: uses.list
		};
	}

	return undefined;
}
