import { can } from '#lib/permissions.ts';
import { eventWhen } from '#lib/event-calendar.ts';
import { roomIsOpen } from '#lib/video-rooms.ts';
import { standaloneRooms } from '#lib/server/video-rooms.ts';
import { storage } from '#lib/server/workspace.ts';
import type { PageServerLoad } from './$types';

/**
 * The public video rooms that are open or about to open. Anyone may see the
 * list; joining needs an account. Private rooms, such as interviews, are
 * never listed.
 */
export const load: PageServerLoad = async (event) => {
	const { database } = storage(event);
	event.setHeaders({ 'cache-control': 'private, no-store' });
	const time = new Date();
	const rooms = await standaloneRooms(database, { visibility: 'public', openAt: time });
	const person = event.locals.person;
	return {
		rooms: rooms
			.sort((a, b) => a.startsAt.localeCompare(b.startsAt))
			.map((room) => ({
				identifier: room.identifier,
				title: room.title,
				when: eventWhen(room.startsAt, room.closesAt, room.timeZone),
				open: roomIsOpen(room, time)
			})),
		mayStart: Boolean(person && can(person, 'host-video-rooms'))
	};
};
