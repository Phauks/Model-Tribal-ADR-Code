/**
 * The topic charts of Data and charts (src/lib/server/data-topic-charts.ts),
 * built from the real records. The counts change as records are added, so
 * these check what must hold whatever the counts are: every bar leads to a
 * page that lists exactly what the bar counts, in a stable order.
 */
import { describe, expect, it } from 'vitest';
import { nationName, topicChartRecords, topicCharts, webLink } from '#lib/server/data-topic-charts.ts';
import { nations } from '#lib/server/content.ts';
import { SourceUses } from '#lib/server/source-uses.ts';

const charts = topicCharts();
const chartNamed = (identifier: string) => charts.find((chart) => chart.identifier === identifier)!;

/** The bar's key in its address, /nations/data/<chart>/<bar>. */
const barKeyOf = (href: string | undefined) => href!.split('/').at(-1)!;

function recordsOf(identifier: string, barIndex: number) {
	const chart = chartNamed(identifier);
	const bar = chart.bars[barIndex];
	return topicChartRecords(chart, bar, barKeyOf(bar.href), new SourceUses())!;
}

/** Charts that keep their bars in a set order (ages, terms, decades) rather than largest first. */
const inOrder = new Set([
	'constitutions-by-voting-age',
	'constitutions-by-council-term',
	'treaties-by-decade',
	'tribal-opinions-by-decade',
	'opinions-on-dispute-resolution-by-decade',
	'supreme-court-cases-by-court',
	'supreme-court-cases-by-vote'
]);

describe('the topic charts', () => {
	it('has a chart for each topic, each named once', () => {
		const identifiers = charts.map((chart) => chart.identifier);
		expect(new Set(identifiers).size).toBe(identifiers.length);
		expect(identifiers).toEqual(expect.arrayContaining(['public-law-280-status', 'nations-by-recognition', 'treaties-by-decade', 'tribal-opinions-by-topic']));
		for (const chart of charts) {
			expect(chart.title, chart.identifier).not.toBe('');
			expect(chart.bars.length, chart.identifier).toBeGreaterThan(0);
		}
	});

	it('leaves out empty bars, and gives each bar its own page under the chart', () => {
		for (const chart of charts) {
			for (const bar of chart.bars) {
				expect(bar.value, `${chart.identifier}: ${bar.label}`).toBeGreaterThan(0);
				expect(bar.href).toMatch(new RegExp(`^/nations/data/${chart.identifier}/[a-z0-9-]+$`));
			}
			const hrefs = chart.bars.map((bar) => bar.href);
			expect(new Set(hrefs).size, chart.identifier).toBe(hrefs.length);
		}
	});

	it('puts the largest bars first, unless the bars follow a set order', () => {
		for (const chart of charts.filter((candidate) => !inOrder.has(candidate.identifier))) {
			const values = chart.bars.map((bar) => bar.value);
			expect(values, chart.identifier).toEqual([...values].sort((first, second) => second - first));
		}
	});

	it('keeps ages and terms in number order with other wording last, and decades in time order', () => {
		for (const identifier of ['constitutions-by-voting-age', 'constitutions-by-council-term']) {
			const labels = chartNamed(identifier).bars.map((bar) => bar.label);
			const numbers = labels.filter((label) => label !== 'Other wording').map((label) => Number.parseInt(label, 10));
			expect(numbers.every((value) => Number.isInteger(value)), identifier).toBe(true);
			expect(numbers, identifier).toEqual([...numbers].sort((first, second) => first - second));
			if (labels.includes('Other wording')) expect(labels.at(-1)).toBe('Other wording');
		}
		for (const identifier of ['treaties-by-decade', 'tribal-opinions-by-decade', 'opinions-on-dispute-resolution-by-decade']) {
			const labels = chartNamed(identifier).bars.map((bar) => bar.label);
			for (const label of labels) expect(label).toMatch(/^\d{3}0s$/);
			expect(labels, identifier).toEqual([...labels].sort());
		}
	});

	it('counts each nation once in a chart whose bars are parts of one whole', () => {
		const regions = chartNamed('nations-by-bureau-region');
		expect(regions.partsOfWhole).toBe(true);
		const total = regions.bars.reduce((sum, bar) => sum + bar.value, 0);
		expect(regions.description).toContain(`The ${total.toLocaleString('en-US')} federally recognized nations`);
		const withRegion = nations().filter((record) => record.federal_administration?.bureau_of_indian_affairs_region).length;
		expect(total).toBe(withRegion);
	});
});

describe('the page behind each bar', () => {
	it('lists exactly as many records as the bar counts, for every bar of every chart', () => {
		for (const chart of charts) {
			for (const bar of chart.bars) {
				const records = topicChartRecords(chart, bar, barKeyOf(bar.href), new SourceUses());
				expect(records, `${chart.identifier}: ${bar.label}`).toBeDefined();
				expect(records!.rows.length, `${chart.identifier}: ${bar.label}`).toBe(bar.value);
				expect(records!.chart).toEqual({ identifier: chart.identifier, title: chart.title });
				expect(records!.bar).toEqual({ slug: barKeyOf(bar.href), label: bar.label, value: bar.value });
				const keys = records!.rows.map((row) => row.key);
				expect(new Set(keys).size, `${chart.identifier}: ${bar.label}`).toBe(keys.length);
			}
		}
	});

	it('lists a nation chart’s nations A to Z, each with the facts that put it there and their sources', () => {
		const records = recordsOf('public-law-280-status', 0);
		const names = records.rows.map((row) => row.cells.nation.text);
		expect(names).toEqual([...names].sort((first, second) => first.localeCompare(second, 'en', { sensitivity: 'base' })));
		expect(records.columns.map((column) => column.key)).toEqual(['nation', 'states', 'facts']);
		expect(records.rowName).toEqual(['nation', 'nations']);
		for (const row of records.rows) {
			expect(row.cells.nation.href).toBe(`/nations/${row.key}#jurisdiction-heading`);
			expect(records.items[row.key].facts.length).toBeGreaterThan(0);
		}
		expect(records.sources.length).toBeGreaterThan(0);
		expect(records.sources[0].part).toBe('Jurisdiction');
	});

	it('names each nation as its page does', () => {
		const records = recordsOf('nations-by-recognition', 0);
		const byId = new Map(nations().map((record) => [record.id, record]));
		for (const row of records.rows.slice(0, 20)) expect(row.cells.nation.text).toBe(nationName(byId.get(row.key)!));
	});

	it('lists a decade’s treaties in the order they were signed, with the nations that name each', () => {
		const chart = chartNamed('treaties-by-decade');
		const busiest = chart.bars.reduce((most, bar) => (bar.value > most.value ? bar : most));
		const records = topicChartRecords(chart, busiest, barKeyOf(busiest.href), new SourceUses())!;
		const signed = records.rows.map((row) => row.cells.signed.text);
		expect(signed).toEqual([...signed].sort());
		for (const date of signed) expect(date.slice(0, 3)).toBe(busiest.label.slice(0, 3));
		for (const row of records.rows) expect(records.items[row.key].nations.length).toBeGreaterThan(0);
	});

	it('lists a topic’s opinions, each using the topic’s words', () => {
		const chart = chartNamed('tribal-opinions-by-topic');
		const bar = chart.bars[0];
		const records = topicChartRecords(chart, bar, barKeyOf(bar.href), new SourceUses())!;
		for (const row of records.rows) expect(row.cells.topics.values!.map((topic) => topic.toLowerCase())).toContain(bar.label.toLowerCase());
		expect(records.description).toContain('not what it decides');
	});

	it('has no page for a chart or a bar it does not know', () => {
		const chart = chartNamed('public-law-280-status');
		expect(topicChartRecords(chart, chart.bars[0], 'no-such-bar', new SourceUses())).toBeUndefined();
		expect(topicChartRecords({ identifier: 'no-such-chart', title: 'None' }, { label: 'None', value: 0 }, 'none', new SourceUses())).toBeUndefined();
	});
});

describe('webLink', () => {
	it('keeps only web addresses', () => {
		expect(webLink('https://example.org/court')).toBe('https://example.org/court');
		expect(webLink('http://example.org')).toBe('http://example.org');
		expect(webLink('javascript:alert(1)')).toBeUndefined();
		expect(webLink('https://example.org/has space')).toBeUndefined();
		expect(webLink(undefined)).toBeUndefined();
		expect(webLink(42)).toBeUndefined();
	});
});
