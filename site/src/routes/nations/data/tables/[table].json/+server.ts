import { error, json } from '@sveltejs/kit';
import { dataChartList } from '#lib/data-chart-list.ts';
import { dataCharts } from '#lib/server/data-charts.ts';
import type { EntryGenerator, RequestHandler } from './$types';

// Each chart's table on the Data and charts page as its own JSON file, for programs: its title, what
// it counts, its source and every row, with the Find recourse address where a row has one.
export const prerender = true;

export const entries: EntryGenerator = () => dataChartList.map(({ identifier }) => ({ table: identifier }));

export const GET: RequestHandler = ({ params }) => {
	const chart = dataCharts().find((item) => item.identifier === params.table);
	if (!chart) error(404, 'There is no chart by that name');
	return json({
		title: chart.title,
		description: chart.description,
		source: chart.source,
		columns: { label: chart.labelHeader, value: chart.valueHeader },
		rows: chart.bars.map((bar) => ({ label: bar.label, value: bar.value, ...(bar.href ? { link: bar.href } : {}) }))
	});
};
