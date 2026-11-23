import { error, json } from '@sveltejs/kit';
import { workerEnvironment } from '#lib/server/environment.ts';
import { eventCalendarRun } from '#lib/server/event-calendar-email.ts';
import { isScheduledRun } from '#lib/server/scheduled-run.ts';
import type { RequestHandler } from './$types';

// The events run every 15 minutes (wrangler.jsonc, "triggers"), passed here
// inside the Worker by tools/add-scheduled-run.mjs, with a token that exists
// only in that copy of the Worker's memory. Requests from outside cannot
// carry the token and are refused.
export const POST: RequestHandler = async ({ request }) => {
	if (!isScheduledRun(request)) error(404, 'Not found.');
	const result = await eventCalendarRun(workerEnvironment());
	return json(result, { headers: { 'cache-control': 'no-store' } });
};
