import { fail } from '@sveltejs/kit';
import { can } from '#lib/permissions.ts';
import { eventWhen, isEventTimeZone, recordingChoices, type RecordingChoice } from '#lib/event-calendar.ts';
import { roomIsOpen } from '#lib/video-rooms.ts';
import { workerEnvironment } from '#lib/server/environment.ts';
import { videoRoomSettings } from '#lib/server/realtime-kit.ts';
import { invitePath, standaloneRooms, startInstantRoom } from '#lib/server/video-rooms.ts';
import { formText, requireAccount, requirePermission, storage } from '#lib/server/workspace.ts';
import type { Actions, PageServerLoad } from './$types';

/**
 * Video rooms of their own: start one now, plan one, and the list of rooms.
 * The people who run events see every room; others see the rooms they made
 * (decision record 0048, "Rooms of their own").
 */
export const load: PageServerLoad = async (event) => {
	const person = requirePermission(event, 'host-video-rooms');
	const account = requireAccount(event);
	const { database } = storage(event);
	const time = new Date();
	const rooms = await standaloneRooms(database, can(person, 'manage-events') ? {} : { createdBy: account.subject });
	const shaped = rooms.map((room) => ({
		identifier: room.identifier,
		title: room.title,
		visibility: room.visibility === 'public' ? 'Public' : 'Private',
		when: eventWhen(room.startsAt, room.closesAt, room.timeZone),
		open: roomIsOpen(room, time),
		closed: new Date(room.closesAt).getTime() <= time.getTime(),
		visitors: room.visitors,
		recordings: room.recordings
	}));
	return {
		current: shaped.filter((room) => !room.closed).reverse(),
		past: shaped.filter((room) => room.closed),
		ready: videoRoomSettings(workerEnvironment()) !== null
	};
};

export const actions: Actions = {
	/** One click: a private room, open now for a few hours, with a guest link to send. */
	startNow: async (event) => {
		requirePermission(event, 'host-video-rooms');
		const account = requireAccount(event);
		const { database } = storage(event);
		const form = await event.request.formData();
		const recording = String(form.get('recording') ?? 'undecided');
		if (!(recordingChoices as readonly string[]).includes(recording)) return fail(400, { problem: 'Say whether the room may be recorded.' });
		const zone = String(form.get('time-zone') ?? '');
		const started = await startInstantRoom(database, {
			title: formText(form, 'title', 200) ?? undefined,
			recording: recording as RecordingChoice,
			timeZone: isEventTimeZone(zone) ? zone : 'America/Los_Angeles',
			createdBy: account.subject
		});
		return {
			started: {
				room: started.room,
				roomLink: `/rooms/${started.room}`,
				inviteLink: new URL(invitePath(started.room, started.secret), event.url.origin).toString()
			}
		};
	}
};
