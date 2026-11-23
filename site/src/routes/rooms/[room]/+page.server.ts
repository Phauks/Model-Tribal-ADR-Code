import { fail } from '@sveltejs/kit';
import { eventMoment, eventWhen } from '#lib/event-calendar.ts';
import { agreementLabel, durationWords, recordingNotice, roomOpensAt, roomRefusalWords, standaloneRoomAccess } from '#lib/video-rooms.ts';
import { workerEnvironment } from '#lib/server/environment.ts';
import { fileScans, mayServe, stillScanning } from '#lib/server/file-scans.ts';
import { videoRoomSettings } from '#lib/server/realtime-kit.ts';
import { joinedRoom, letIntoRoom, mayWatchRecordings, recordingsOf } from '#lib/server/video-rooms.ts';
import { requireAccount, storage } from '#lib/server/workspace.ts';
import type { Actions, PageServerLoad } from './$types';
import { findRoom, hostsRoom } from '../find-room.ts';

/**
 * A room of its own, for people signed in: anyone, when it is public, and
 * only its hosts, when it is private (others come in with an invite link, at
 * /rooms/<room>/invite/<secret>). Before anyone joins, they are told whether
 * it is recorded and who may watch, and agree where it is or may be
 * recorded; what they were told is kept (decision record 0048, "Rooms of
 * their own").
 */
export const load: PageServerLoad = async (event) => {
	const { database } = storage(event);
	const room = await findRoom(database, event.params.room);
	event.setHeaders({ 'cache-control': 'private, no-store' });
	const time = new Date();
	const account = event.locals.account;
	const host = hostsRoom(room, event.locals.person, account);
	// A private room says nothing about itself to anyone but its hosts.
	if (room.visibility === 'private' && !host) {
		return { room: null, refusal: { reason: account ? 'private' : 'sign-in', words: roomRefusalWords[account ? 'private' : 'sign-in'] } } as const;
	}
	const access = standaloneRoomAccess({ room, host, signedIn: Boolean(account) }, time);
	const joined = account ? await joinedRoom(database, room.identifier, account.subject) : false;
	const mayWatch = mayWatchRecordings(room, { signedIn: Boolean(account), host, joined });
	const recordings = mayWatch ? (await recordingsOf(database, room.identifier)).filter((recording) => recording.objectKey && (host || !recording.hidden)) : [];
	const scans = await fileScans(database, recordings.map((recording) => recording.objectKey as string));
	return {
		room: {
			identifier: room.identifier,
			title: room.title,
			visibility: room.visibility,
			when: eventWhen(room.startsAt, room.closesAt, room.timeZone),
			opens: eventMoment(roomOpensAt(room).toISOString(), room.timeZone),
			recording: room.recording
		},
		ready: videoRoomSettings(workerEnvironment()) !== null,
		host,
		refusal: access.kind === 'refused' ? { reason: access.reason, words: roomRefusalWords[access.reason] } : null,
		notice: recordingNotice(room.recording, room.watchers, 'room'),
		agreeLabel: agreementLabel(room.recording),
		recordings: recordings.map((recording) => {
			const scan = scans.get(recording.objectKey as string) ?? null;
			return {
				address: `/rooms/${room.identifier}/recordings/${recording.identifier}`,
				when: recording.startedAt ? eventMoment(recording.startedAt, room.timeZone) : '',
				length: durationWords(recording.durationSeconds),
				ready: mayServe(scan),
				checking: stillScanning(scan),
				hidden: recording.hidden
			};
		})
	};
};

export const actions: Actions = {
	join: async (event) => {
		const account = requireAccount(event);
		const { database } = storage(event);
		const room = await findRoom(database, event.params.room);
		const time = new Date();
		const host = hostsRoom(room, event.locals.person, account);
		const access = standaloneRoomAccess({ room, host, signedIn: true }, time);
		if (access.kind === 'refused') return fail(403, { problem: roomRefusalWords[access.reason] });
		const notice = recordingNotice(room.recording, room.watchers, 'room');
		const form = await event.request.formData();
		if (notice.needsAgreement && form.get('agree') !== 'yes') {
			return fail(400, { problem: 'To join, confirm that you have read about the recording.', field: 'agree' });
		}
		const settings = videoRoomSettings(workerEnvironment());
		if (!settings) return fail(503, { problem: 'The video room is not switched on yet.' });
		const name = event.locals.person?.displayName ?? account.name ?? 'Guest';
		try {
			const token = await letIntoRoom(
				{ database, settings },
				{ room, window: room, visitor: { kind: 'account', identifier: account.subject }, name, role: access.kind, toldRecording: room.recording },
				time
			);
			return { token, role: access.kind };
		} catch (problem) {
			console.error('Could not open the video room', room.identifier, problem);
			return fail(502, { problem: 'The video room could not be reached just now. Try again in a minute.' });
		}
	}
};
