import { fail } from '@sveltejs/kit';
import { eventMoment, eventWhen } from '#lib/event-calendar.ts';
import { agreementLabel, eventRoomWindow, recordingNotice, roomAccess, roomOpensAt, roomRefusalWords } from '#lib/video-rooms.ts';
import { workerEnvironment } from '#lib/server/environment.ts';
import { registrationFor, ticketTypesOf, type CalendarEvent } from '#lib/server/event-calendar.ts';
import { letIntoRoom, roomOfEvent } from '#lib/server/video-rooms.ts';
import { videoRoomSettings } from '#lib/server/realtime-kit.ts';
import { requireAccount, storage } from '#lib/server/workspace.ts';
import type { Actions, PageServerLoad, RequestEvent } from './$types';
import { findEvent, isHost } from '../find-event.ts';

async function accessFor(event: RequestEvent | Parameters<PageServerLoad>[0], found: CalendarEvent, time: Date) {
	const { database } = storage(event);
	const account = event.locals.account;
	const [tickets, own] = await Promise.all([
		ticketTypesOf(database, found.identifier),
		account ? registrationFor(database, found.identifier, account.subject) : Promise.resolve(undefined)
	]);
	const access = roomAccess(
		{
			event: found,
			host: isHost(event.locals.person),
			signedIn: Boolean(account),
			seatKinds: tickets.length,
			registration: own ? { status: own.status, attendance: own.attendance } : null
		},
		time
	);
	return { access, own };
}

/**
 * An event's video room. Before anyone joins, they are told whether it is
 * recorded, and who may watch the recording, and agree to it where it is or
 * may be recorded; what they were told is kept (decision record 0048, "The
 * video room").
 */
export const load: PageServerLoad = async (event) => {
	const found = await findEvent(event);
	const { database } = storage(event);
	event.setHeaders({ 'cache-control': 'private, no-store' });
	const time = new Date();
	const room = await roomOfEvent(database, found.identifier);
	const { access } = await accessFor(event, found, time);
	const ready = videoRoomSettings(workerEnvironment()) !== null;
	return {
		event: {
			slug: found.slug,
			title: found.title,
			when: eventWhen(found.startsAt, found.endsAt, found.timeZone),
			opens: eventMoment(roomOpensAt(eventRoomWindow(found)).toISOString(), found.timeZone),
			recording: found.recording,
			status: found.status
		},
		hasRoom: Boolean(room),
		ready,
		host: access.kind === 'host',
		refusal: access.kind === 'refused' ? { reason: access.reason, words: roomRefusalWords[access.reason] } : null,
		notice: recordingNotice(found.recording, room?.watchers ?? 'hosts'),
		agreeLabel: agreementLabel(found.recording)
	};
};

export const actions: Actions = {
	join: async (event) => {
		const account = requireAccount(event);
		const found = await findEvent(event);
		const { database } = storage(event);
		const time = new Date();
		const room = await roomOfEvent(database, found.identifier);
		if (!room) return fail(404, { problem: 'This event does not use the website’s video room.' });
		const { access, own } = await accessFor(event, found, time);
		if (access.kind === 'refused') return fail(403, { problem: roomRefusalWords[access.reason] });
		const notice = recordingNotice(found.recording, room.watchers);
		const form = await event.request.formData();
		if (notice.needsAgreement && form.get('agree') !== 'yes') {
			return fail(400, { problem: 'To join, confirm that you have read about the recording.', field: 'agree' });
		}
		const settings = videoRoomSettings(workerEnvironment());
		if (!settings) return fail(503, { problem: 'The video room is not switched on yet.' });
		const role = access.kind;
		const person = event.locals.person;
		const name = (role === 'host' ? person?.displayName : own?.name) ?? account.name ?? 'Guest';
		try {
			const token = await letIntoRoom(
				{ database, settings },
				{ room, window: eventRoomWindow(found), visitor: { kind: 'account', identifier: account.subject }, name, role, toldRecording: found.recording },
				time
			);
			return { token, role };
		} catch (problem) {
			console.error('Could not open the video room', room.identifier, problem);
			return fail(502, { problem: 'The video room could not be reached just now. Try again in a minute.' });
		}
	}
};
