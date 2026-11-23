import { eventDay, eventKindLabels, eventWhen, whereLine } from '#lib/event-calendar.ts';
import { workerEnvironment } from '#lib/server/environment.ts';
import { attendanceByEvent, eventsForAccount, listedEvents } from '#lib/server/event-calendar.ts';
import type { PageServerLoad } from './$types';

export interface EventCard {
	slug: string;
	title: string;
	summary: string;
	kind: string;
	day: string;
	when: string;
	where: string;
	cancelled: boolean;
}

/**
 * The list of events: upcoming ones soonest first, or past ones newest
 * first, and, for someone signed in, the events they are registered for.
 */
export const load: PageServerLoad = async ({ url, locals, setHeaders }) => {
	const past = url.searchParams.get('when') === 'past';
	const database = workerEnvironment().database;
	setHeaders({ 'cache-control': 'private, no-store' });
	if (!database) return { past, events: [] as EventCard[], yours: [], signedIn: Boolean(locals.account) };
	const events = await listedEvents(database, past ? 'past' : 'upcoming');
	const attendance = await attendanceByEvent(
		database,
		events.map((event) => event.identifier)
	);
	const yours = locals.account && !past ? await eventsForAccount(database, locals.account.subject) : [];
	return {
		past,
		signedIn: Boolean(locals.account),
		events: events.map(
			(event): EventCard => ({
				slug: event.slug,
				title: event.title,
				summary: event.summary,
				kind: eventKindLabels[event.kind],
				day: eventDay(event.startsAt, event.timeZone),
				when: eventWhen(event.startsAt, event.endsAt, event.timeZone),
				where: whereLine(event, attendance.get(event.identifier) ?? []),
				cancelled: event.status === 'cancelled'
			})
		),
		yours: yours.map((item) => ({
			slug: item.slug,
			title: item.title,
			when: eventWhen(item.startsAt, item.endsAt, item.timeZone),
			status: item.status,
			ticketName: item.ticketName,
			cancelled: item.eventStatus === 'cancelled'
		}))
	};
};
