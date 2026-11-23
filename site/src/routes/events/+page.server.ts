import {
	dateTile,
	eventClock,
	eventDay,
	eventKindLabels,
	eventModes,
	eventMoment,
	eventWhen,
	seatStatus,
	whereLine
} from '#lib/event-calendar.ts';
import { roomIsOpen, roomOpensAt } from '#lib/video-rooms.ts';
import { workerEnvironment } from '#lib/server/environment.ts';
import { eventsForAccount, listedEvents, registrationOpen, seatCountsByEvent } from '#lib/server/event-calendar.ts';
import { roomsOfEvents, standaloneRooms } from '#lib/server/video-rooms.ts';
import type { PageServerLoad } from './$types';

/** What the button on an event's row does, as in the approved mockup (design/events-and-cle, "1-events-list"). */
export type EventAction = { kind: 'register' | 'waitlist' | 'join'; address: string } | null;

export interface EventCard {
	/** The event's page, or a public video room's. */
	address: string;
	/** A public video room of its own, which opens in a new tab. */
	room: boolean;
	slug: string;
	title: string;
	summary: string;
	kind: string;
	tile: { month: string; day: string; weekday: string };
	day: string;
	/** The times without the day, which the tile shows. */
	clock: string;
	when: string;
	where: string;
	cancelled: boolean;
	recorded: string | null;
	action: EventAction;
	/** "Open seats", "38 of 120 seats left", "You are registered", and so on. */
	status: string | null;
	online: boolean;
	inPerson: boolean;
}

const modes = ['online', 'in-person'] as const;
export type Mode = (typeof modes)[number];

const yourStatusWords: Record<string, string> = {
	registered: 'You are registered',
	waitlisted: 'You are on the waitlist',
	offered: 'A seat is held for you'
};

/**
 * The list of events: those happening now ("Current events", with the public
 * video rooms open now) and the upcoming ones, on one page (Trevor, Nov. 23,
 * 2026), soonest first; or past ones newest first; and, for someone signed
 * in, the events they are registered for. Public rooms planned for later are
 * listed among the upcoming events. Each row has a date tile, a Register or
 * waitlist button and the seat status, and the list can show only online or
 * only in-person events (design/events-and-cle, "1-events-list").
 */
export const load: PageServerLoad = async ({ url, locals, setHeaders }) => {
	const past = url.searchParams.get('when') === 'past';
	const modeAsked = url.searchParams.get('mode');
	const mode = (modes as readonly string[]).includes(modeAsked ?? '') ? (modeAsked as Mode) : null;
	const database = workerEnvironment().database;
	setHeaders({ 'cache-control': 'private, no-store' });
	if (!database) return { past, mode, current: [] as EventCard[], events: [] as EventCard[], yours: [], signedIn: Boolean(locals.account) };
	const time = new Date();
	const events = await listedEvents(database, past ? 'past' : 'upcoming', time);
	const identifiers = events.map((event) => event.identifier);
	const [seats, eventRooms, rooms, yours] = await Promise.all([
		seatCountsByEvent(database, identifiers),
		roomsOfEvents(database, identifiers),
		past ? Promise.resolve([]) : standaloneRooms(database, { visibility: 'public', openAt: time }),
		locals.account && !past ? eventsForAccount(database, locals.account.subject, time) : Promise.resolve([])
	]);
	const yourStatus = new Map(yours.map((item) => [item.slug, item.status]));
	const cards = [
		...events.map((event) => {
			const counts = seats.get(event.identifier) ?? [];
			const attendances = counts.map((seat) => seat.attendance);
			const modesOf = eventModes(event, attendances);
			const cancelled = event.status === 'cancelled';
			const seatWords = seatStatus(counts);
			const mine = yourStatus.get(event.slug);
			const open = !past && !cancelled && registrationOpen(event, counts, time);
			let action: EventAction = null;
			let status: string | null = null;
			if (cancelled) status = null;
			else if (mine) status = yourStatusWords[mine] ?? null;
			else if (past) status = null;
			else if (counts.length === 0) status = 'No registration needed';
			else if (!open) status = 'Registration closed';
			else {
				action = { kind: seatWords?.full ? 'waitlist' : 'register', address: `/events/${event.slug}#register` };
				status = seatWords?.words ?? null;
			}
			return {
				now: !past && !cancelled && new Date(event.startsAt).getTime() <= time.getTime(),
				startsAt: event.startsAt,
				card: {
					address: `/events/${event.slug}`,
					room: false,
					slug: event.slug,
					title: event.title,
					summary: event.summary,
					kind: eventKindLabels[event.kind],
					tile: dateTile(event.startsAt, event.timeZone),
					day: eventDay(event.startsAt, event.timeZone),
					clock: eventClock(event.startsAt, event.endsAt, event.timeZone),
					when: eventWhen(event.startsAt, event.endsAt, event.timeZone),
					where: whereLine(event, attendances),
					cancelled,
					recorded: event.recording === 'recorded' ? 'Recorded' : event.recording === 'not-recorded' ? 'Not recorded' : null,
					action,
					status,
					online: modesOf.online || eventRooms.has(event.identifier),
					inPerson: modesOf.inPerson
				} satisfies EventCard
			};
		}),
		...rooms.map((room) => {
			const isOpen = roomIsOpen(room, time);
			return {
				now: isOpen,
				startsAt: room.startsAt,
				card: {
					address: `/rooms/${room.identifier}`,
					room: true,
					slug: `room-${room.identifier}`,
					title: room.title,
					summary: '',
					kind: 'Video room',
					tile: dateTile(room.startsAt, room.timeZone),
					day: eventDay(room.startsAt, room.timeZone),
					clock: eventClock(room.startsAt, room.closesAt, room.timeZone),
					when: eventWhen(room.startsAt, room.closesAt, room.timeZone),
					where: 'Online, on this website',
					cancelled: false,
					recorded: null,
					action: isOpen ? { kind: 'join', address: `/rooms/${room.identifier}` } : null,
					status: isOpen ? 'Open now' : `Opens ${eventMoment(roomOpensAt(room).toISOString(), room.timeZone)}`,
					online: true,
					inPerson: false
				} satisfies EventCard
			};
		})
	].filter((item) => mode === null || (mode === 'online' ? item.card.online : item.card.inPerson));
	if (!past) cards.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
	return {
		past,
		mode,
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
