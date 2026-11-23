import { error, fail, type Cookies } from '@sveltejs/kit';
import { eventMoment, eventWhen } from '#lib/event-calendar.ts';
import { agreementLabel, isInviteSecret, recordingNotice, roomOpensAt, roomRefusalWords, standaloneRoomAccess } from '#lib/video-rooms.ts';
import { workerEnvironment } from '#lib/server/environment.ts';
import { videoRoomSettings } from '#lib/server/realtime-kit.ts';
import { randomToken } from '#lib/server/sign-in-secrets.ts';
import { inviteBySecret, letIntoRoom } from '#lib/server/video-rooms.ts';
import { formText, storage } from '#lib/server/workspace.ts';
import type { Actions, PageServerLoad, RequestEvent } from './$types';
import { findRoom } from '../../../find-room.ts';

/**
 * Joining a room with an invite link, such as for an interview. No account
 * is needed: the person gives the name shown in the room, is told whether it
 * is recorded and who may watch, and agrees where it is or may be recorded.
 * Opening the link does nothing by itself, so a link preview cannot join.
 */

/** A random key for this browser, so two people sharing one link are two people in the room. */
const browserCookie = '__Host-room-guest';

function browserKey(cookies: Cookies): string {
	const kept = cookies.get(browserCookie);
	if (kept && /^[A-Za-z0-9_-]{16}$/.test(kept)) return kept;
	const made = randomToken(12);
	cookies.set(browserCookie, made, { path: '/', httpOnly: true, secure: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 30 });
	return made;
}

async function findInvite(event: RequestEvent | Parameters<PageServerLoad>[0]) {
	const { database } = storage(event);
	const room = await findRoom(database, event.params.room);
	const invite = isInviteSecret(event.params.secret) ? await inviteBySecret(database, room.identifier, event.params.secret) : undefined;
	if (!invite) error(404, 'This invite link does not work. Check that it was copied whole, or ask for a new one.');
	return { database, room, invite };
}

export const load: PageServerLoad = async (event) => {
	const { room, invite } = await findInvite(event);
	event.setHeaders({ 'cache-control': 'private, no-store', 'referrer-policy': 'no-referrer' });
	const access = standaloneRoomAccess({ room, host: false, signedIn: Boolean(event.locals.account), invite: { role: invite.role, revoked: invite.revokedAt !== null } }, new Date());
	return {
		room: {
			title: room.title,
			when: eventWhen(room.startsAt, room.closesAt, room.timeZone),
			opens: eventMoment(roomOpensAt(room).toISOString(), room.timeZone),
			recording: room.recording
		},
		role: invite.role,
		name: invite.name === 'Guest' ? (event.locals.person?.displayName ?? event.locals.account?.name ?? '') : invite.name,
		ready: videoRoomSettings(workerEnvironment()) !== null,
		refusal: access.kind === 'refused' ? { reason: access.reason, words: roomRefusalWords[access.reason] } : null,
		notice: recordingNotice(room.recording, room.watchers, 'room'),
		agreeLabel: agreementLabel(room.recording)
	};
};

export const actions: Actions = {
	join: async (event) => {
		const { database, room, invite } = await findInvite(event);
		const time = new Date();
		const access = standaloneRoomAccess({ room, host: false, signedIn: Boolean(event.locals.account), invite: { role: invite.role, revoked: invite.revokedAt !== null } }, time);
		if (access.kind === 'refused') return fail(403, { problem: roomRefusalWords[access.reason] });
		const form = await event.request.formData();
		const name = formText(form, 'name', 120);
		if (!name) return fail(400, { problem: 'Give the name others in the room will see.', field: 'name' });
		const notice = recordingNotice(room.recording, room.watchers, 'room');
		if (notice.needsAgreement && form.get('agree') !== 'yes') {
			return fail(400, { problem: 'To join, confirm that you have read about the recording.', field: 'agree', name });
		}
		const settings = videoRoomSettings(workerEnvironment());
		if (!settings) return fail(503, { problem: 'The video room is not switched on yet.' });
		try {
			const token = await letIntoRoom(
				{ database, settings },
				{
					room,
					window: room,
					visitor: { kind: 'invite', identifier: invite.identifier, browser: browserKey(event.cookies) },
					name,
					role: access.kind,
					toldRecording: room.recording
				},
				time
			);
			return { token, role: access.kind };
		} catch (problem) {
			console.error('Could not open the video room', room.identifier, problem instanceof Error ? problem.message : String(problem));
			return fail(502, { problem: 'The video room could not be reached just now. Try again in a minute.' });
		}
	}
};
