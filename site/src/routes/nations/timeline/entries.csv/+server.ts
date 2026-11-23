import { siteTimeline } from '#lib/server/timeline.ts';
import { timelineCsv, timelineRows } from '#lib/timeline.ts';
import type { RequestHandler } from './$types';

// Every entry of the full timeline as one CSV file, for the Download menu and
// for readers without scripts.
export const prerender = true;

export const GET: RequestHandler = () => {
	const timeline = siteTimeline();
	const names = Object.fromEntries(Object.entries(timeline.nations).map(([id, nation]) => [id, nation.name]));
	return new Response(timelineCsv(timelineRows(timeline.entries, timeline.opinions, names)), {
		headers: {
			'content-type': 'text/csv; charset=utf-8',
			'content-disposition': 'attachment; filename="timeline.csv"'
		}
	});
};
