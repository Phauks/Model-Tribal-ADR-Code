import { eventDay, eventKindLabels, eventWhen, whereLine } from '#lib/event-calendar.ts';
import { workerEnvironment } from '#lib/server/environment.ts';
import { attendanceByEvent, eventsForAccount, listedEvents } from '#lib/server/event-calendar.ts';
import { roomIsOpen } from '#lib/video-rooms.ts';
import { standaloneRooms } from '#lib/server/video-rooms.ts';
import type { PageServerLoad } from './$types';

export interface EventCard {
	/** The event's page, or a public video room's. */
	address: string;
	/** A public video room of its own, which opens in a new tab. */
	room: boolean;
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
 * The list of events: those happening now ("Current events", with the public
 * video rooms open now) and the upcoming ones, on one page (Trevor, Nov. 23,
 * 2026), soonest first; or past ones newest first; and, for someone signed
 * in, the events they are registered for. Public rooms planned for later are
 * listed among the upcoming events.
 */
export const load: PageServerLoad = async ({ url, locals, setHeaders }) => {
	const past = url.searchParams.get('when') === 'past';
	const database = workerEnvironment().database;
	setHeaders({ 'cache-control': 'private, no-store' });
	if (!database) return { past, current: [] as EventCard[], events: [] as EventCard[], yours: [], signedIn: Boolean(locals.account) };
	const time = new Date();
	const events = await listedEvents(database, past ? 'past' : 'upcoming', time);
	const rooms = past ? [] : await standaloneRooms(database, { visibility: 'public', openAt: time });
	const attendance = await attendanceByEvent(
		database,
		events.map((event) => event.identifier)
	);
	const yours = locals.account && !past ? await eventsForAccount(database, locals.account.subject) : [];
	const cards = [
		...events.map((event) => ({
			now: !past && event.status !== 'cancelled' && new Date(event.startsAt).getTime() <= time.getTime(),
			startsAt: event.startsAt,
			card: {
				address: `/events/${event.slug}`,
				room: false,
				slug: event.slug,
				title: event.title,
				summary: event.summary,
				kind: eventKindLabels[event.kind],
				day: eventDay(event.startsAt, event.timeZone),
				when: eventWhen(event.startsAt, event.endsAt, event.timeZone),
				where: whereLine(event, attendance.get(event.identifier) ?? []),
				cancelled: event.status === 'cancelled'
			} satisfies EventCard
		})),
		...rooms.map((room) => ({
			now: roomIsOpen(room, time),
			startsAt: room.startsAt,
			card: {
				address: `/rooms/${room.identifier}`,
				room: true,
				slug: `room-${room.identifier}`,
				title: room.title,
				summary: '',
				kind: 'Video room',
				day: eventDay(room.startsAt, room.timeZone),
				when: eventWhen(room.startsAt, room.closesAt, room.timeZone),
				where: 'Online, on this website',
				cancelled: false
			} satisfies EventCard
		}))
	];
	if (!past) cards.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
	return {
		past,
		signedIn: Boolean(locals.account),
		current: cards.filter((item) => item.now).map((item) => item.card),
		events: cards.filter((item) => !item.now).map((item) => item.card),
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
