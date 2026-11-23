import { describe, expect, it } from 'vitest';
import { chartTable, pieSlices, scaleTop, shareText, slicePath } from '../src/lib/bar-chart.ts';
import { chartRecordEntries, chartRecords, dataCharts } from '../src/lib/server/data-charts.ts';

describe('scaleTop', () => {
	it('rounds the top up to a step of 1, 2 or 5 times a power of ten', () => {
		expect(scaleTop(507)).toEqual({ top: 600, step: 200 });
		expect(scaleTop(7)).toEqual({ top: 8, step: 2 });
		expect(scaleTop(1)).toEqual({ top: 1, step: 0.2 });
		expect(scaleTop(0)).toEqual({ top: 1, step: 1 });
	});
});

describe('chartTable', () => {
	it('links the name to what the bar counts, draws the number on the page, and sorts numbers as numbers', () => {
		const table = chartTable({
			identifier: 'x',
			title: 'X',
			description: '',
			labelHeader: 'Method',
			valueHeader: 'Provisions',
			source: '',
			bars: [{ label: 'Mediation', value: 1200, href: '/nations/recourse?method=Mediation' }]
		});
		expect(table.columns.map((column) => column.header)).toEqual(['Method', 'Provisions']);
		expect(table.rows[0].cells.value).toEqual({ text: '1,200', sortValue: 1200 });
		expect(table.columns[1].custom).toBe(true);
		expect(table.rows[0].cells.label.href).toBe('/nations/recourse?method=Mediation');
	});
});

describe('dataCharts (repository data)', () => {
	const charts = dataCharts();

	it('builds every chart with bars, largest first', () => {
		expect(charts.length).toBeGreaterThanOrEqual(6);
		for (const chart of charts) {
			expect(chart.bars.length, chart.identifier).toBeGreaterThan(0);
			const values = chart.bars.map((bar) => bar.value);
			expect(values, chart.identifier).toEqual([...values].sort((first, second) => second - first));
		}
	});

	it('links provision bars to Find recourse with the same filter', () => {
		const byMethod = charts.find((chart) => chart.identifier === 'provisions-by-method')!;
		expect(byMethod.bars.find((bar) => bar.label === 'Mediation')?.href).toBe('/nations/recourse?method=Mediation');
	});

	it('links every bar to the records it counts', () => {
		for (const chart of charts) {
			for (const bar of chart.bars) expect(bar.href, `${chart.identifier}: ${bar.label}`).toBeTruthy();
		}
	});
});

describe('chartRecords (repository data)', () => {
	const entries = chartRecordEntries();

	it('has a records page for every bar that does not go to Find recourse', () => {
		const charts = entries.map((entry) => entry.chart);
		expect(new Set(charts)).toEqual(new Set(['forums-by-kind', 'constitutions-by-status', 'compacts-by-arbitration']));
	});

	it('lists as many records as each bar counts, each linked to its page or document', () => {
		for (const { chart, bar } of entries) {
			const records = chartRecords(chart, bar)!;
			expect(records, `${chart}/${bar}`).toBeDefined();
			expect(records.rows.length, `${chart}/${bar}`).toBe(records.bar.value);
			for (const row of records.rows) {
				const first = records.columns[0].key;
				if (chart !== 'compacts-by-arbitration') expect(row.cells[first].href, `${chart}/${bar}: ${row.key}`).toMatch(/^\/nations\//);
			}
		}
	});

	it('cites the source of each court it lists', () => {
		const courts = chartRecords('forums-by-kind', 'courts')!;
		expect(courts.sources.length).toBeGreaterThan(0);
		const cited = Object.values(courts.items).flatMap((cells) => cells.forums ?? []).filter((item) => item.citations.length > 0);
		expect(cited.length).toBeGreaterThan(0);
	});

	it('knows nothing of a bar that is not on the page', () => {
		expect(chartRecords('forums-by-kind', 'no-such-kind')).toBeUndefined();
		expect(chartRecords('no-such-chart', 'courts')).toBeUndefined();
	});
});

describe('pieSlices', () => {
	const bars = (values: number[]) => values.map((value, index) => ({ label: `Bar ${index + 1}`, value, href: `/x/${index + 1}` }));

	it('splits the whole by share, largest first, in the fixed color order', () => {
		const slices = pieSlices(bars([1, 3]));
		expect(slices.map((slice) => [slice.label, slice.share, slice.series])).toEqual([
			['Bar 2', 0.75, 1],
			['Bar 1', 0.25, 2]
		]);
		expect(slices[0].start).toBe(0);
		expect(slices[1].end).toBeCloseTo(1);
	});

	it('folds the smallest bars into one Other slice past seven, never reusing a color', () => {
		const slices = pieSlices(bars([9, 8, 7, 6, 5, 4, 3, 2, 1]));
		expect(slices).toHaveLength(7);
		expect(slices[6]).toMatchObject({ label: 'Other (3)', value: 6, folded: 3, series: 7 });
		expect(slices[6].href).toBeUndefined();
	});

	it('leaves out empty bars and draws nothing for an empty whole', () => {
		expect(pieSlices(bars([0, 0]))).toEqual([]);
		expect(pieSlices(bars([0, 4]))).toHaveLength(1);
	});

	it('draws a single slice as a whole circle', () => {
		expect(slicePath({ start: 0, end: 1 }, 100)).toContain('A 100 100 0 1 1 100.00 200.00');
	});

	it('writes shares as whole percents, with a sliver as under one', () => {
		expect(shareText(0.256)).toBe('26%');
		expect(shareText(0.001)).toBe('<1%');
	});
});

describe('dataCharts pies (repository data)', () => {
	it('offers a pie only where each item counts under one bar', () => {
		const pies = dataCharts().filter((chart) => chart.partsOfWhole).map((chart) => chart.identifier);
		expect(pies).toEqual(['provisions-by-method', 'provisions-by-dispute', 'constitutions-by-status', 'compacts-by-arbitration']);
	});
});
