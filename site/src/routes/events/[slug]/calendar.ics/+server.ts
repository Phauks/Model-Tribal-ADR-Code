import { error } from '@sveltejs/kit';
import { workerEnvironment } from '#lib/server/environment.ts';
import { eventBySlug } from '#lib/server/event-calendar.ts';
import { calendarFile } from '#lib/server/event-calendar-file.ts';
import { siteAddress } from '#lib/server/following-email.ts';
import type { RequestHandler } from './$types';

/** One event as a calendar file, without its online link (src/lib/server/event-calendar-file.ts). */
export const GET: RequestHandler = async ({ params, url }) => {
	const environment = workerEnvironment();
	const event = environment.database ? await eventBySlug(environment.database, params.slug) : undefined;
	if (!event || event.status === 'draft') error(404, 'There is no event at this address.');
	const site = siteAddress(environment) ?? url.origin;
	return new Response(calendarFile([event], site, event.title), {
		headers: {
			'content-type': 'text/calendar; charset=utf-8',
			'content-disposition': `attachment; filename="${event.slug}.ics"`
		}
	});
};
