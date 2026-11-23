import { describe, expect, it } from 'vitest';
import { chartTable, scaleTop } from '../src/lib/bar-chart.ts';
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
	it('links both the name and the number to what the bar counts, and sorts numbers as numbers', () => {
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
		expect(table.rows[0].cells.value).toEqual({ text: '1,200', sortValue: 1200, href: '/nations/recourse?method=Mediation' });
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
