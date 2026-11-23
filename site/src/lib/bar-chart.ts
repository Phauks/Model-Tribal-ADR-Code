/**
 * The data a bar chart draws, shared by the build and the browser
 * (BarChart.svelte). The essay editor's planned Chart block is meant to use
 * the same shape, so a chart reads the same on a data page and in an essay.
 */
import type { TableColumn, TableRow } from './tables/table-definition.ts';

export interface ChartBar {
	label: string;
	value: number;
	/** Where the bar leads, such as the filtered list of the rows it counts. */
	href?: string;
}

export interface BarChartData {
	/** Unique on the page; used for element ids and the CSV file name. */
	identifier: string;
	title: string;
	/** A sentence under the title saying what is counted. */
	description: string;
	/** Header of the label column in the table view, such as "Method". */
	labelHeader: string;
	/** Header of the number column, such as "Provisions". */
	valueHeader: string;
	/** Where the numbers come from, shown under the chart. */
	source: string;
	/** The bars, in the order drawn. */
	bars: ChartBar[];
	/** Draws only this many bars, largest first, with the rest in the table view. */
	shown?: number;
}

/**
 * The scale's top: the largest value rounded up to a step of 1, 2 or 5 times
 * a power of ten, so the gridlines fall on round numbers.
 */
export function scaleTop(largest: number): { top: number; step: number } {
	if (largest <= 0) return { top: 1, step: 1 };
	const roughStep = largest / 5;
	const power = 10 ** Math.floor(Math.log10(roughStep));
	const step = [1, 2, 5, 10].map((factor) => factor * power).find((candidate) => candidate >= roughStep) ?? 10 * power;
	return { top: Math.ceil(largest / step) * step, step };
}

/**
 * The chart as a table definition, for the table view and its CSV download. A bar's address
 * links its name; on the page the number links to it too (the column is drawn by BarChart.svelte),
 * while the CSV keeps one link column.
 */
export function chartTable(chart: BarChartData): { columns: TableColumn[]; rows: TableRow[] } {
	return {
		columns: [
			{ key: 'label', header: chart.labelHeader, isRowHeader: true, sortable: true },
			{ key: 'value', header: chart.valueHeader, type: 'number', sortable: true, custom: true }
		],
		rows: chart.bars.map((bar) => ({
			key: bar.label,
			cells: {
				label: { text: bar.label, href: bar.href },
				value: { text: bar.value.toLocaleString('en-US'), sortValue: bar.value }
			}
		}))
	};
}
