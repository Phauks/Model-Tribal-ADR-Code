import { error } from '@sveltejs/kit';
import { chartSources, chartSourcesEntries } from '#lib/server/data-charts.ts';
import type { EntryGenerator, PageServerLoad } from './$types';

// Where a chart's numbers on Data and charts come from: the one word "Source" under the chart links
// here (Trevor, Nov. 23, 2026). The provision charts link to Find recourse instead, which lists each
// provision with its citation.
export const entries: EntryGenerator = () => chartSourcesEntries();

export const load: PageServerLoad = ({ params }) => {
	const sources = chartSources(params.chart);
	if (!sources) error(404, 'No chart on Data and charts has a sources page by that name.');
	return sources;
};
