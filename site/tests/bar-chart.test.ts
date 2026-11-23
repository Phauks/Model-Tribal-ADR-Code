import { describe, expect, it } from 'vitest';
import { chartTable, scaleTop } from '../src/lib/bar-chart.ts';
import { dataCharts } from '../src/lib/server/data-charts.ts';

describe('scaleTop', () => {
	it('rounds the top up to a step of 1, 2 or 5 times a power of ten', () => {
		expect(scaleTop(507)).toEqual({ top: 600, step: 200 });
		expect(scaleTop(7)).toEqual({ top: 8, step: 2 });
		expect(scaleTop(1)).toEqual({ top: 1, step: 0.2 });
		expect(scaleTop(0)).toEqual({ top: 1, step: 1 });
	});
});

describe('chartTable', () => {
	it('gives the table a link column and numbers that sort as numbers', () => {
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
});
