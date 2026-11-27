import type { BarChartData } from '#lib/bar-chart.ts';
import { collectionsByGroup } from '#lib/server/collections.ts';
import { nations } from '#lib/server/content.ts';
import { chartRecordsPath, dataCharts } from '#lib/server/data-charts.ts';
import { isComponentBand, isFederallyRecognized, isNativeNation, listSection, recognitionStatus, withoutFederalRecord } from '#lib/server/recognition-status.ts';
import type { PageServerLoad } from './$types';

/** The one chart shown under Recognition; the finer breakdowns stay on Data and charts (Trevor, Nov. 27, 2026: "Tiles and status chart only"). */
const recognitionChart = 'nations-by-recognition-status';

const slugOf = (label: string) => label.toLowerCase().replace(/[^a-z0-9]+/g, '-');

export interface RecognitionTile {
	identifier: string;
	title: string;
	href: string;
	count: number;
	/** A short muted line under the number. */
	note?: string;
}

function recognitionTiles(): RecognitionTile[] {
	const records = nations();
	const native = records.filter(isNativeNation);
	const federal = native.filter(isFederallyRecognized);
	const withStatus = (status: string) => native.filter((record) => recognitionStatus(record) === status);
	const statusHref = (status: string) => chartRecordsPath('nations-by-recognition-status', slugOf(status));
	const alsoState = federal.filter((record) => (record.recognition ?? []).some((fact) => fact.type === 'state')).length;
	const notRecognized = withStatus('Not recognized');
	const petitioning = notRecognized.filter((record) => withoutFederalRecord(record)?.slug === 'petition-in-process').length;
	const entities = federal.filter((record) => !isComponentBand(record)).length;
	const others = (entityType: string) => records.filter((record) => record.entity_type === entityType).length;
	const tiles: RecognitionTile[] = [
		{
			identifier: 'federally-recognized',
			title: 'Federally Recognized',
			href: statusHref('Federally recognized'),
			count: federal.length,
			note: [entities !== federal.length ? `${entities.toLocaleString('en-US')} entities on the federal list` : '', alsoState ? `${alsoState} also state recognized` : ''].filter(Boolean).join(' · ')
		},
		{ identifier: 'state-recognized-only', title: 'State Recognized Only', href: statusHref('State recognized only'), count: withStatus('State recognized only').length },
		{
			identifier: 'not-recognized',
			title: 'Not Recognized',
			href: statusHref('Not recognized'),
			count: notRecognized.length,
			note: petitioning ? `${petitioning} with a petition in process` : undefined
		},
		{ identifier: 'alaska-native-entities', title: 'Alaska Native Entities', href: chartRecordsPath('federal-list-sections', 'alaska'), count: federal.filter((record) => listSection(record)?.slug === 'alaska').length, note: 'Federally recognized' },
		{ identifier: 'native-hawaiian-community', title: 'Native Hawaiian Community', href: '/nations#group-native-hawaiian', count: others('native-hawaiian'), note: 'Not a tribe' },
		{ identifier: 'territorial-peoples', title: 'Indigenous Peoples of the Territories', href: '/nations#group-territorial-indigenous-people', count: others('territorial-indigenous-people'), note: 'Status under territorial law' }
	];
	return tiles.filter((tile) => tile.count > 0);
}

export const load: PageServerLoad = () => {
	return {
		groups: collectionsByGroup(),
		built: new Date().toISOString().slice(0, 10),
		recognition: {
			tiles: recognitionTiles(),
			chart: dataCharts().find((chart): chart is BarChartData => chart.identifier === recognitionChart)
		}
	};
};
