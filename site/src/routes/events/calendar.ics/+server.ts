import { workerEnvironment } from '#lib/server/environment.ts';
import { feedEvents } from '#lib/server/event-calendar.ts';
import { calendarFile } from '#lib/server/event-calendar-file.ts';
import { siteAddress } from '#lib/server/following-email.ts';
import type { RequestHandler } from './$types';

/**
 * Every event from the last 90 days on, as one calendar file that calendar
 * programs can subscribe to. Cancelled events stay in it, marked cancelled,
 * so a subscribed calendar takes them off.
 */
export const GET: RequestHandler = async ({ url }) => {
	const environment = workerEnvironment();
	const events = environment.database ? await feedEvents(environment.database) : [];
	const site = siteAddress(environment) ?? url.origin;
	return new Response(calendarFile(events, site, 'Model Tribal ADR Code events'), {
		headers: { 'content-type': 'text/calendar; charset=utf-8' }
	});
};
