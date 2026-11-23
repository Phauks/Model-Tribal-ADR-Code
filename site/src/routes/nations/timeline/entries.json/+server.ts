import { json } from '@sveltejs/kit';
import { siteTimeline } from '#lib/server/timeline.ts';
import { timelineRows } from '#lib/timeline.ts';
import type { RequestHandler } from './$types';

// Every entry of the full timeline as JSON, for programs.
export const prerender = true;

export const GET: RequestHandler = () => {
	const timeline = siteTimeline();
	const names = Object.fromEntries(Object.entries(timeline.nations).map(([id, nation]) => [id, nation.name]));
	return json(timelineRows(timeline.entries, timeline.opinions, names), {
		headers: { 'content-disposition': 'attachment; filename="timeline.json"' }
	});
};
