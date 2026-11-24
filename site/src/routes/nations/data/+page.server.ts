import { dataTopicList, dataTopicLink, proposedChartTitles } from '#lib/data-chart-list.ts';
import { dataCharts } from '#lib/server/data-charts.ts';
import type { PageServerLoad } from './$types';

// The index of Data and charts: one entry for each topic page (Trevor, Nov. 24, 2026), with its charts.
export const load: PageServerLoad = () => {
	const charts = dataCharts();
	return {
		topics: dataTopicList.map((topic) => ({
			identifier: topic.identifier,
			title: topic.title,
			description: topic.description,
			href: dataTopicLink(topic.identifier),
			charts: topic.charts.map((identifier) => {
				const drawn = charts.find((chart) => chart.identifier === identifier);
				return {
					title: drawn?.title ?? proposedChartTitles[identifier] ?? identifier,
					href: drawn ? `${dataTopicLink(topic.identifier)}#${identifier}` : dataTopicLink(topic.identifier)
				};
			})
		}))
	};
};
