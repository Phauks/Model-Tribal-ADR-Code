import { siteTimeline } from '#lib/server/timeline.ts';
import { timelineCsv, timelineRows } from '#lib/timeline.ts';
import type { RequestHandler } from './$types';
import { csvResponse } from '#lib/csv.ts';

// Every entry of the full timeline as one CSV file, for the Download menu and
// for readers without scripts.
export const prerender = true;

export const GET: RequestHandler = () => {
	const timeline = siteTimeline();
	const names = Object.fromEntries(Object.entries(timeline.nations).map(([id, nation]) => [id, nation.name]));
	return csvResponse(timelineCsv(timelineRows(timeline.entries, timeline.opinions, names)), { fileName: 'timeline.csv' });
};
