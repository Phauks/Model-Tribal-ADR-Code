import { error } from '@sveltejs/kit';
import { chartTable } from '#lib/bar-chart.ts';
import { dataChartList } from '#lib/data-chart-list.ts';
import { dataCharts } from '#lib/server/data-charts.ts';
import { rowsToCsv } from '#lib/tables/table-definition.ts';
import type { EntryGenerator, RequestHandler } from './$types';

// Each chart's table on the Data and charts page as its own CSV file, the same columns and rows as
// the table under the chart, for the Download menu (src/lib/page-downloads.ts). Trevor asked on
// Nov. 23, 2026 for every table there to be separately exportable.
export const prerender = true;

export const entries: EntryGenerator = () => dataChartList.map(({ identifier }) => ({ table: identifier }));

export const GET: RequestHandler = ({ params }) => {
	const chart = dataCharts().find((item) => item.identifier === params.table);
	if (!chart) error(404, 'There is no chart by that name');
	const { columns, rows } = chartTable(chart);
	return new Response(rowsToCsv(columns, rows), {
		headers: {
			'content-type': 'text/csv; charset=utf-8',
			'content-disposition': `attachment; filename="${params.table}.csv"`
		}
	});
};
