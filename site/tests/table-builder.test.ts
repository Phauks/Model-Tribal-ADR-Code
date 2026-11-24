import { describe, expect, it } from 'vitest';
import {
	crossTable,
	filterOptions,
	groupedChart,
	notRecorded,
	recordTable,
	resultTitle,
	settingsFromAddress,
	settingsToAddress,
	startingSettings,
	type BuilderDataset
} from '../src/lib/table-builder.ts';

const dataset: BuilderDataset = {
	identifier: 'courts',
	title: 'Courts and forums',
	rowName: ['court', 'courts'],
	nameColumn: 'name',
	nationColumn: 'nation',
	sourceHref: '/nations',
	columns: [
		{ key: 'name', header: 'Name', type: 'text', starting: true },
		{ key: 'nation', header: 'Nation', type: 'text', starting: true },
		{ key: 'states', header: 'States', type: 'list' },
		{ key: 'kind', header: 'Kind', type: 'text', starting: true },
		{ key: 'judges', header: 'Judges', type: 'number' }
	],
	rows: [
		['Tribal Court', 'Alpha', ['Nevada'], 'Tribal court', 3],
		['Court of Appeals', 'Alpha', ['Nevada'], 'Court of appeals', 5],
		['Peacemaking', 'Beta', ['Arizona', 'Nevada'], 'Peacemaking', null],
		['Tribal Court', 'Gamma', null, 'Tribal court', 1]
	],
	links: ['/nations/alpha', '/nations/alpha', '/nations/beta', '']
};

describe('Build a table', () => {
	it('shows the starting columns, with the name linked to its page', () => {
		const { columns, rows } = recordTable(dataset, startingSettings(dataset));
		expect(columns.map((column) => column.key)).toEqual(['name', 'nation', 'kind']);
		expect(rows[0].cells.name).toMatchObject({ text: 'Tribal Court', href: '/nations/alpha' });
		expect(rows[3].cells.name.href).toBeUndefined();
	});

	it('filters a list column by any of its values', () => {
		const settings = { ...startingSettings(dataset), filters: { states: 'Nevada' } };
		expect(recordTable(dataset, settings).rows).toHaveLength(3);
		expect(filterOptions(dataset, {}, 'states')).toEqual([
			{ value: 'Nevada', count: 3 },
			{ value: 'Arizona', count: 1 }
		]);
	});

	it('groups and counts, with each count opening the rows it counts', () => {
		const chart = groupedChart(dataset, { ...startingSettings(dataset), groupBy: 'kind' });
		expect(chart?.bars.map((bar) => [bar.label, bar.value])).toEqual([
			['Tribal court', 2],
			['Court of appeals', 1],
			['Peacemaking', 1]
		]);
		expect(chart?.bars[0].href).toBe('/nations/data/build?data=courts&where.kind=Tribal+court');
		expect(chart?.partsOfWhole).toBe(true);
	});

	it('counts a row under each value of a list column, and rows with none as not recorded, so it is not a pie', () => {
		const chart = groupedChart(dataset, { ...startingSettings(dataset), groupBy: 'states' });
		expect(chart?.bars.map((bar) => [bar.label, bar.value])).toEqual([
			['Nevada', 3],
			['Arizona', 1],
			[notRecorded, 1]
		]);
		expect(chart?.partsOfWhole).toBe(false);
	});

	it('counts nations once each, and sums or averages a number column', () => {
		const base = { ...startingSettings(dataset), groupBy: 'states' };
		expect(groupedChart(dataset, { ...base, measure: { kind: 'nations' } })?.bars[0].value).toBe(2);
		expect(groupedChart(dataset, { ...base, measure: { kind: 'sum', column: 'judges' } })?.bars[0].value).toBe(8);
		expect(groupedChart(dataset, { ...base, measure: { kind: 'average', column: 'judges' } })?.bars[0].value).toBe(4);
	});

	it('builds a two-way table with a total column', () => {
		const table = crossTable(dataset, { ...startingSettings(dataset), groupBy: 'kind', across: 'states' });
		expect(table?.columns.map((column) => column.header)).toEqual(['Kind', 'Nevada', 'Arizona', notRecorded, 'Total']);
		const tribal = table?.rows.find((row) => row.key === 'Tribal court');
		expect(tribal?.cells['across-0'].text).toBe('1');
		expect(tribal?.cells['across-1'].text).toBe('');
		expect(tribal?.cells.total.text).toBe('2');
		expect(tribal?.cells['across-0'].href).toBe('/nations/data/build?data=courts&where.kind=Tribal+court&where.states=Nevada');
	});

	it('keeps its settings in the address and reads them back', () => {
		const settings = { ...startingSettings(dataset), columns: ['states'], filters: { states: 'Nevada' }, groupBy: 'kind', across: 'nation', measure: { kind: 'sum' as const, column: 'judges' } };
		const address = settingsToAddress(settings, dataset);
		expect(address.toString()).toBe('data=courts&columns=states&where.states=Nevada&group=kind&across=nation&value=sum.judges');
		expect(settingsFromAddress(address, dataset)).toEqual(settings);
		expect(resultTitle(dataset, settings)).toBe('Sum of judges by kind and nation: Nevada');
	});

	it('ignores settings the dataset has no column for', () => {
		const settings = settingsFromAddress(new URLSearchParams('data=courts&columns=nope,kind&where.nope=x&group=judges&value=sum.kind'), dataset);
		expect(settings).toEqual({ ...startingSettings(dataset), columns: ['kind'] });
	});
});

describe('Placing a built table elsewhere', () => {
	it('reads a Build a table address and gives the chart it shows', async () => {
		const { builderAddressParts, builtResult, essayChartOf, essayChartFrom } = await import('../src/lib/table-builder.ts');
		const parts = builderAddressParts('/nations/data/build?data=courts&group=kind');
		expect(parts?.dataset).toBe('courts');
		expect(builderAddressParts('/nations/data?data=courts')).toBeUndefined();
		const result = builtResult(dataset, parts?.parameters ?? new URLSearchParams());
		expect(result.kind).toBe('chart');
		expect(builtResult(dataset, new URLSearchParams('data=courts')).kind).toBe('table');
		expect(essayChartOf(dataset, parts?.parameters ?? new URLSearchParams(), 'Nov. 24, 2026')).toEqual({
			caption: 'Courts by kind',
			labelHeader: 'Kind',
			valueHeader: 'Courts',
			rows: [['Tribal court', 2], ['Court of appeals', 1], ['Peacemaking', 1]],
			credit: 'Courts and forums, as of Nov. 24, 2026: [Build a table](/nations/data/build?data=courts&group=kind)'
		});
		const fetched = await essayChartFrom('/nations/data/build?data=courts&group=kind', (async () => new Response(JSON.stringify(dataset))) as typeof fetch);
		expect(fetched?.rows[0]).toEqual(['Tribal court', 2]);
		expect(await essayChartFrom('/nations/data', (async () => new Response('{}')) as typeof fetch)).toBeNull();
	});
});
