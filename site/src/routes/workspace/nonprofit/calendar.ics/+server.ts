import { calendarFile, nevadaToday, occurrencesFor } from '#lib/nonprofit.ts';
import { workerEnvironment } from '#lib/server/environment.ts';
import { readCompletions, readFacts, readTasks } from '#lib/server/nonprofit.ts';
import { requirePermission, storage } from '#lib/server/workspace.ts';
import type { RequestHandler } from './$types';

// The open due dates as a calendar file, to import into a phone or desktop
// calendar, with reminders 30 and 7 days before each.
export const GET: RequestHandler = async (event) => {
	requirePermission(event, 'manage-nonprofit');
	const { database } = storage(event);
	const [facts, completions, tasks] = await Promise.all([readFacts(database), readCompletions(database), readTasks(database)]);
	const occurrences = occurrencesFor(facts, completions, nevadaToday());
	const site = workerEnvironment().SITE_ADDRESS || event.url.origin;
	return new Response(calendarFile(occurrences, tasks, new Date(), site), {
		headers: {
			'content-type': 'text/calendar; charset=utf-8',
			'content-disposition': 'attachment; filename="nonprofit-due-dates.ics"',
			'cache-control': 'private, no-store'
		}
	});
};
