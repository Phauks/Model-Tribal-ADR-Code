import { error } from '@sveltejs/kit';
import { dataTopicList } from '#lib/data-chart-list.ts';
import { dataCharts } from '#lib/server/data-charts.ts';
import type { EntryGenerator, PageServerLoad } from './$types';

// One page for each topic Data and charts is split into (Trevor, Nov. 24, 2026).
export const entries: EntryGenerator = () => dataTopicList.map(({ identifier }) => ({ topic: identifier }));

export const load: PageServerLoad = ({ params }) => {
	const topic = dataTopicList.find((candidate) => candidate.identifier === params.topic);
	if (!topic) error(404, 'Data and charts has no topic by that name.');
	const charts = dataCharts();
	return {
		topic: { identifier: topic.identifier, title: topic.title, description: topic.description },
		charts: topic.charts.flatMap((identifier) => charts.filter((chart) => chart.identifier === identifier))
	};
};
