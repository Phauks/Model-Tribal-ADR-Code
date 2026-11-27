/**
 * The data a stacked column chart draws (ColumnChart.svelte): one column for
 * each step along a time line, such as a decade, split into the parts of a
 * few series, such as who made a law. It is the upright, stacked kin of the
 * bar chart (bar-chart.ts) and offers the same views: the columns, or the
 * same numbers as a table, with .csv and .xlsx downloads and full screen.
 */
import type { TableColumn, TableRow } from './tables/table-definition.ts';

export interface ColumnSeries {
	key: string;
	label: string;
}

export interface ChartColumn {
	/** Its name in the table and to screen readers, such as "1930s". */
	label: string;
	/** Written under the column, when it is one of the few the axis names, such as every fiftieth year. */
	axisLabel?: string;
	/** Each series' number in this column, by the series' key. */
	values: Record<string, number>;
	/** Where a series' part of the column leads, such as the list of that decade's orders, by the series' key. */
	links?: Record<string, string>;
}

export interface ColumnChartData {
	/** Unique on the page; used for element ids and the download's file name. */
	identifier: string;
	title: string;
	/** A sentence under the title saying what is counted. */
	description?: string;
	/** Header of the table's first column, such as "Decade". */
	labelHeader: string;
	/** The series, in the order they stack from the bottom, each drawn in the next chart color (chart-series-1 to 7). */
	series: ColumnSeries[];
	/** The columns, in the order drawn, left to right. */
	columns: ChartColumn[];
	/** Where the numbers come from. */
	source: string;
	/** The page that shows the source: the one word "Source" under the chart links there (Trevor, Nov. 23, 2026). */
	sourceHref?: string;
}

/** A column's whole height: the sum of its series. */
export function columnTotal(column: ChartColumn): number {
	return Object.values(column.values).reduce((sum, value) => sum + value, 0);
}

/** The chart's numbers as a table: a row for each column, a number column for each series and their total, with a Sum row. */
export function columnTable(chart: ColumnChartData): { columns: TableColumn[]; rows: TableRow[] } {
	return {
		columns: [
			{ key: 'label', header: chart.labelHeader, isRowHeader: true, sortable: true },
			...chart.series.map((series): TableColumn => ({ key: series.key, header: series.label, type: 'number', sortable: true, sum: true })),
			{ key: 'total', header: 'Total', type: 'number', sortable: true, sum: true }
		],
		rows: chart.columns.map((column) => ({
			key: column.label,
			cells: {
				label: { text: column.label },
				...Object.fromEntries(chart.series.map((series) => [series.key, { text: (column.values[series.key] ?? 0).toLocaleString('en-US'), sortValue: column.values[series.key] ?? 0, href: column.values[series.key] ? column.links?.[series.key] : undefined }])),
				total: { text: columnTotal(column).toLocaleString('en-US'), sortValue: columnTotal(column) }
			}
		}))
	};
}

/** What a screen reader hears for a column: its name, its total and each series' part, such as "1930s: 778 (Congress 400, President 110, Agencies 268)". */
export function columnSpoken(chart: ColumnChartData, column: ChartColumn): string {
	const parts = chart.series.filter((series) => (column.values[series.key] ?? 0) > 0).map((series) => `${series.label} ${(column.values[series.key] ?? 0).toLocaleString('en-US')}`);
	return `${column.label}: ${columnTotal(column).toLocaleString('en-US')}${parts.length > 0 ? ` (${parts.join(', ')})` : ''}`;
}
