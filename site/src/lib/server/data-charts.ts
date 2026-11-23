/**
 * The counts behind the Data and charts page (/nations/data), the third of
 * the data views Trevor chose on Nov. 23, 2026. Each chart is a list of bars
 * with a caption and a source line; a bar about dispute resolution
 * provisions links to Find recourse with the same filter, so a reader can
 * go from a count to the provisions behind it.
 *
 * Runs at build time only, like content.ts.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseCsv } from '../csv.ts';
import type { BarChartData } from '../bar-chart.ts';
import { categoryOf } from '../nation-services.ts';
import { recourseQueryToParameters } from '../recourse.ts';
import { nations, repositoryRoot } from './content.ts';
import { recourseRows } from './recourse.ts';

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

function recourseLink(key: string, value: string): string {
	return `/nations/recourse?${recourseQueryToParameters({ text: '', picked: { [key]: [value] } }).toString()}`;
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

export function dataCharts(): BarChartData[] {
	const provisions = recourseRows();
	const provisionSource =
		'Dispute resolution provisions read from each nation’s published law codes, court rules and ordinances, Nov. 2026. Each provision is counted once.';

	const records = nations();
	const forums = tally(
		records.filter((record) => (record.justice_institutions ?? []).length > 0),
		(record) => (record.justice_institutions ?? []).map((fact) => categoryOf(fact.kind).heading)
	);

	const constitutions = tally(readCsv('research/constitutions/coverage.csv'), (row) => [
		constitutionStatusWords[row.status] ?? row.status
	]);

	const compacts = readCsv('research/gaming/compact-clauses.csv').filter((row) => row.document_is === 'full-compact');
	const arbitration = tally(compacts, (row) => [
		row['dispute_resolution.binding_arbitration'] === 'True'
			? 'Binding arbitration'
			: row['dispute_resolution.binding_arbitration'] === 'False'
				? 'No binding arbitration'
				: 'Not stated in the clause read'
	]);

	return [
		{
			identifier: 'provisions-by-method',
			title: 'Provisions by method',
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
			identifier: 'provisions-by-dispute',
			title: 'Provisions by kind of dispute',
			description: 'The same provisions, by the kind of dispute they cover.',
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
			identifier: 'provisions-by-state',
			title: 'Provisions by state',
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
			identifier: 'forums-by-kind',
			title: 'Courts and forums by kind',
			description: `How many of the ${records.filter((record) => (record.justice_institutions ?? []).length > 0).length.toLocaleString('en-US')} nations with a court or forum listed on their page have each kind.`,
			labelHeader: 'Kind',
			valueHeader: 'Nations',
			source: 'Courts and forums listed on nation pages, each with its own source.',
			bars: forums.map(([label, value]) => ({ label, value }))
		},
		{
			identifier: 'constitutions-by-status',
			title: 'Constitutions found',
			description:
				'What the search for each federally recognized nation’s constitution found. “No constitution found” does not mean a nation has none: many are not online, and some nations keep theirs to citizens.',
			labelHeader: 'What was found',
			valueHeader: 'Nations',
			source: 'Search of nations’ own websites, law libraries and Bureau of Indian Affairs files for the 581 federally recognized nations, Nov. 2026.',
			bars: constitutions.map(([label, value]) => ({ label, value }))
		},
		{
			identifier: 'compacts-by-arbitration',
			title: 'Gaming compacts: does a dispute with the state go to binding arbitration?',
			description: `${compacts.length.toLocaleString('en-US')} full tribal-state gaming compacts approved by the Department of the Interior, by what their dispute clause says. Amendments and extensions are left out.`,
			labelHeader: 'Dispute clause',
			valueHeader: 'Compacts',
			source:
				'Compacts listed by the Office of Indian Gaming, read by machine for their dispute clauses, Nov. 2026; the readings await review.',
			bars: arbitration.map(([label, value]) => ({ label, value }))
		}
	];
}
