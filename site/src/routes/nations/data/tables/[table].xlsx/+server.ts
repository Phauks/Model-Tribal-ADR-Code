import { error } from '@sveltejs/kit';
import { chartTable } from '#lib/bar-chart.ts';
import { dataChartList } from '#lib/data-chart-list.ts';
import { dataCharts } from '#lib/server/data-charts.ts';
import { rowsToSpreadsheet, spreadsheetType } from '#lib/spreadsheet.ts';
import type { EntryGenerator, RequestHandler } from './$types';

// Each chart's table on the Data and charts page as an Excel workbook, the same columns and rows as
// its .csv file beside it. Trevor asked on Nov. 23, 2026 that downloads offer both .csv and Excel.
// The site's links are written from the page's own address, as the .csv's are.
export const prerender = true;

export const entries: EntryGenerator = () => dataChartList.map(({ identifier }) => ({ table: identifier }));

export const GET: RequestHandler = ({ params }) => {
	const chart = dataCharts().find((item) => item.identifier === params.table);
	if (!chart) error(404, 'There is no chart by that name');
	const { columns, rows } = chartTable(chart);
	return new Response(rowsToSpreadsheet(columns, rows, '', chart.title) as Uint8Array<ArrayBuffer>, {
		headers: {
			'content-type': spreadsheetType,
			'content-disposition': `attachment; filename="${params.table}.xlsx"`
		}
	});
};
