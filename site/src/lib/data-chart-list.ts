/**
 * The charts on the Data and charts page (/nations/data), by identifier and title, in page order.
 * The counts are worked out at build time (src/lib/server/data-charts.ts); this list is what the
 * browser needs to offer each chart's table on its own in the Download menu, as Trevor asked on
 * Nov. 23, 2026 ("every data and charts table should be separately exportable").
 */
export const dataChartList = [
	{ identifier: 'provisions-by-method', title: 'Provisions by method' },
	{ identifier: 'provisions-by-dispute', title: 'Provisions by kind of dispute' },
	{ identifier: 'provisions-by-state', title: 'Provisions by state' },
	{ identifier: 'forums-by-kind', title: 'Courts and forums by kind' },
	{ identifier: 'constitutions-by-status', title: 'Constitutions found' },
	{ identifier: 'compacts-by-arbitration', title: 'Gaming compacts: does a dispute with the state go to binding arbitration?' }
] as const;

export type DataChartIdentifier = (typeof dataChartList)[number]['identifier'];

/** A chart's identifier and title, for the chart's own definition. */
export function dataChartNamed(identifier: DataChartIdentifier): { identifier: string; title: string } {
	const found = dataChartList.find((chart) => chart.identifier === identifier);
	if (!found) throw new Error(`No chart ${identifier}`);
	return { identifier: found.identifier, title: found.title };
}

/** Where a chart's table is published. */
export function dataChartTableLink(identifier: string, extension: 'csv' | 'json'): string {
	return `/nations/data/tables/${identifier}.${extension}`;
}
