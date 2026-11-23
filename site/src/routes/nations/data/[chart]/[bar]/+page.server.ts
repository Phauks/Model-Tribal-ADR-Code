import { error } from '@sveltejs/kit';
import { chartRecordEntries, chartRecords } from '#lib/server/data-charts.ts';
import type { EntryGenerator, PageServerLoad } from './$types';

// One page for each bar on Data and charts that does not already lead to Find recourse: the records the bar counts.
export const entries: EntryGenerator = () => chartRecordEntries();

export const load: PageServerLoad = ({ params }) => {
	const records = chartRecords(params.chart, params.bar);
	if (!records) error(404, 'No chart on Data and charts has that bar.');
	return records;
};
