import { error, fail, redirect } from '@sveltejs/kit';
import { eventMoment, eventWhen } from '#lib/event-calendar.ts';
import { roomIsOpen, type RoomRole } from '#lib/video-rooms.ts';
import { workerEnvironment } from '#lib/server/environment.ts';
import { endActiveSession, videoRoomSettings } from '#lib/server/realtime-kit.ts';
import {
	closeRoom,
	createInvite,
	invitePath,
	invitesOf,
	keepRoomOpen,
	removeRoom,
	revokeInvite,
	roomRecordsForHosts,
	setRecordingHidden,
	updateRoom
} from '#lib/server/video-rooms.ts';
import { formText, requireAccount, requirePermission, storage } from '#lib/server/workspace.ts';
import { findRoom, hostsRoom } from '../../../rooms/find-room.ts';
import { readRoomForm, roomFormValuesOf } from '../room-form.ts';
import type { Actions, PageServerLoad, RequestEvent } from './$types';

/** The room, for one of its hosts; anyone else is told there is no such room. */
async function hostedRoom(event: RequestEvent | Parameters<PageServerLoad>[0]) {
	const person = requirePermission(event, 'host-video-rooms');
	const account = requireAccount(event);
	const { database } = storage(event);
	const room = await findRoom(database, event.params.room);
	if (!hostsRoom(room, person, account)) error(404, 'There is no room at this address.');
	return { database, room, account };
}

export const load: PageServerLoad = async (event) => {
	const { database, room } = await hostedRoom(event);
	const time = new Date();
	const [invites, records] = await Promise.all([
		invitesOf(database, room.identifier),
		roomRecordsForHosts(database, room, (recording) => `/rooms/${room.identifier}/recordings/${recording}`)
	]);
	return {
		room: {
			identifier: room.identifier,
			title: room.title,
			visibility: room.visibility,
			when: eventWhen(room.startsAt, room.closesAt, room.timeZone),
			open: roomIsOpen(room, time),
			closed: new Date(room.closesAt).getTime() <= time.getTime()
		},
		values: roomFormValuesOf(room),
		added: event.url.searchParams.has('added'),
		ready: videoRoomSettings(workerEnvironment()) !== null,
		invites: invites.map((invite) => ({
			identifier: invite.identifier,
			name: invite.name,
			role: invite.role === 'host' ? 'Host' : 'Guest',
			made: eventMoment(invite.createdAt, room.timeZone),
			used: invite.lastUsedAt ? eventMoment(invite.lastUsedAt, room.timeZone) : null,
			revoked: invite.revokedAt !== null
		})),
		...records
	};
};

async function recordingShown(event: RequestEvent, shown: boolean) {
	const { database, room } = await hostedRoom(event);
	const form = await event.request.formData();
	const changed = await setRecordingHidden(database, room.identifier, String(form.get('recording') ?? ''), !shown);
	if (!changed) return fail(404, { problem: 'There is no such recording.' });
	return { done: shown ? 'The recording is shown again to the people allowed to watch it.' : 'The recording is hidden from everyone but the hosts.' };
}

export const actions: Actions = {
	save: async (event) => {
		const { database, room } = await hostedRoom(event);
		const read = readRoomForm(await event.request.formData());
		if ('problem' in read) return fail(400, { problem: read.problem, field: read.field, values: read.values });
		await updateRoom(database, room.identifier, read.input);
		return { done: 'Saved the room. People who join from now on are told the new recording choice.' };
	},

	invite: async (event) => {
		const { database, room, account } = await hostedRoom(event);
		const form = await event.request.formData();
		const name = formText(form, 'name', 120);
		const role = form.get('role') === 'host' ? 'host' : 'guest';
		if (!name) return fail(400, { problem: 'Say who the link is for, such as their name.', field: 'invite-name' });
		const made = await createInvite(database, { room: room.identifier, name, role: role as RoomRole, createdBy: account.subject });
		return { invite: { name, link: new URL(invitePath(room.identifier, made.secret), event.url.origin).toString() } };
	},

	revoke: async (event) => {
		const { database, room } = await hostedRoom(event);
		const form = await event.request.formData();
		const revoked = await revokeInvite(database, room.identifier, String(form.get('invite') ?? ''));
		if (!revoked) return fail(404, { problem: 'That link is already off.' });
		return { done: 'The link is off. Nobody can join with it any more; anyone already in the room stays until they leave or it closes.' };
	},

	close: async (event) => {
		const { database, room } = await hostedRoom(event);
		const closed = await closeRoom(database, room.identifier);
		// Closing also ends the live call: an expired token alone would leave people in it.
		const settings = videoRoomSettings(workerEnvironment());
		let ended = false;
		if (settings && room.meeting) {
			try {
				ended = await endActiveSession(settings, room.meeting);
			} catch (problem) {
				console.error('Could not end the live session of a room', room.identifier, problem);
				return { done: 'The room is closed, so nobody can join it now, but the call could not be ended just now. Ask people to leave, or press Close the room again.' };
			}
		}
		if (!closed && !ended) return fail(409, { problem: 'The room is already closed, and nobody is in it.' });
		return { done: 'The room is closed. The call has ended for everyone in it, and nobody can join it now.' };
	},

	keepOpen: async (event) => {
		const { database, room } = await hostedRoom(event);
		await keepRoomOpen(database, room.identifier, 1);
		return {
			done: 'The room stays open an hour longer. People already in it stay connected. Anyone whose connection drops after the old closing time rejoins from the same page or link.'
		};
	},

	hideRecording: (event) => recordingShown(event, false),
	showRecording: (event) => recordingShown(event, true),

	remove: async (event) => {
		const { database, room } = await hostedRoom(event);
		const removed = await removeRoom(database, room.identifier);
		if (!removed) return fail(409, { problem: 'This room has recordings, so it stays. Hide a recording instead.' });
		redirect(303, '/workspace/rooms');
	}
};
