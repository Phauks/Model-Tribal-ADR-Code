import { dataTopicList, dataTopicLink } from '#lib/data-chart-list.ts';
import { dataCharts } from '#lib/server/data-charts.ts';
import type { PageServerLoad } from './$types';

// The index of Data and charts: one entry for each topic page (Trevor, Nov. 24, 2026), with its charts.
export const load: PageServerLoad = () => {
	const titles = new Map(dataCharts().map((chart) => [chart.identifier, chart.title]));
	return {
		topics: dataTopicList.map((topic) => ({
			identifier: topic.identifier,
			title: topic.title,
			description: topic.description,
			href: dataTopicLink(topic.identifier),
			charts: topic.charts.map((identifier) => ({ title: titles.get(identifier) ?? identifier, href: `${dataTopicLink(topic.identifier)}#${identifier}` }))
		}))
	};
};
