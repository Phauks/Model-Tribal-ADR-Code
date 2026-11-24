import { error, fail, redirect } from '@sveltejs/kit';
import {
	attendanceKinds,
	attendanceLabels,
	eventDay,
	eventMoment,
	eventWhen,
	registrationStatusLabels,
	sessionTimes,
	wallClock,
	zonedToUtc,
	type Attendance
} from '#lib/event-calendar.ts';
import { confirmedCredits } from '#lib/server/contributor-profiles.ts';
import { workerEnvironment } from '#lib/server/environment.ts';
import {
	addMaterial,
	changeEventStatus,
	eventByIdentifier,
	largestMaterialBytes,
	materialObjectKey,
	materialsOf,
	registrationsOf,
	removeMaterial,
	removeSession,
	removeSpeaker,
	removeTicketType,
	saveSession,
	saveSpeaker,
	sessionsOf,
	saveTicketType,
	speakersOf,
	ticketTypesOf,
	updateEvent,
	type StatusChange
} from '#lib/server/event-calendar.ts';
import { eventEmailDelivery } from '#lib/server/event-calendar-email.ts';
import { defaultRoomStyle, eventRecordingWatchers, roomStyles, type RecordingWatchers, type RoomStyle } from '#lib/video-rooms.ts';
import { removeRoom, roomOfEvent, roomRecordsForHosts, saveEventRoom, setRecordingHidden } from '#lib/server/video-rooms.ts';
import { videoRoomSettings } from '#lib/server/realtime-kit.ts';
import { fileScans, forgetScan, scanStatusWords, storeSentFile } from '#lib/server/file-scans.ts';
import { newIdentifier } from '#lib/server/identifiers.ts';
import { safeFileName } from '#lib/server/uploads.ts';
import { formText, requireAccount, requirePermission, storage } from '#lib/server/workspace.ts';
import { formValuesOf, readCapacity, readEventForm } from '../event-form.ts';
import type { Actions, PageServerLoad, RequestEvent } from './$types';

async function findEvent(event: RequestEvent | Parameters<PageServerLoad>[0]) {
	requirePermission(event, 'manage-events');
	const { database } = storage(event);
	const found = await eventByIdentifier(database, event.params.identifier);
	if (!found) error(404, 'There is no such event.');
	return { database, found };
}

export const load: PageServerLoad = async (event) => {
	const { database, found } = await findEvent(event);
	const [tickets, speakers, registrations, credits, room, sessions, materials] = await Promise.all([
		ticketTypesOf(database, found.identifier),
		speakersOf(database, found.identifier),
		registrationsOf(database, found.identifier),
		confirmedCredits(database),
		roomOfEvent(database, found.identifier),
		sessionsOf(database, found.identifier),
		materialsOf(database, found.identifier)
	]);
	const scans = await fileScans(database, materials.map((material) => material.objectKey));
	const records = room
		? await roomRecordsForHosts(database, room, (recording) => `/events/${found.slug}/recordings/${recording}`)
		: { recordings: [], visitors: [] };
	return {
		event: {
			identifier: found.identifier,
			slug: found.slug,
			title: found.title,
			status: found.status,
			when: eventWhen(found.startsAt, found.endsAt, found.timeZone),
			day: eventDay(found.startsAt, found.timeZone),
			cancelNote: found.cancelNote,
			sequence: found.sequence
		},
		values: formValuesOf(found),
		added: event.url.searchParams.has('added'),
		tickets: tickets.map((ticket) => ({ ...ticket, attendanceLabel: attendanceLabels[ticket.attendance] })),
		speakers,
		sessions: sessions.map((session) => ({ ...session, times: sessionTimes(session.startsAt, session.endsAt, found.timeZone) })),
		materials: materials.map((material) => ({
			identifier: material.identifier,
			title: material.title,
			fileName: material.fileName,
			size: `${Math.max(1, Math.round(material.sizeBytes / 1024))} KB`,
			check: scanStatusWords(scans.get(material.objectKey) ?? null).label
		})),
		largestMaterial: `${largestMaterialBytes / (1024 * 1024)} MB`,
		contributors: credits
			.filter((credit) => credit.onWebsite && credit.slug)
			.map((credit) => ({ slug: credit.slug as string, line: credit.line })),
		registrations: registrations.map((registration) => ({
			identifier: registration.identifier,
			name: registration.name,
			email: registration.email,
			ticketName: registration.ticketName,
			status: registrationStatusLabels[registration.status],
			code: registration.status,
			live: ['registered', 'offered', 'waitlisted'].includes(registration.status),
			accessNeeds: registration.accessNeeds,
			registeredAt: eventMoment(registration.registeredAt, found.timeZone),
			offerEnds:
				registration.status === 'offered' && registration.offerExpiresAt ? eventMoment(registration.offerExpiresAt, found.timeZone) : null
		})),
		emailReady: eventEmailDelivery(workerEnvironment()).kind === 'email',
		roomReady: videoRoomSettings(workerEnvironment()) !== null,
		room: room
			? { style: room.style, watchers: room.watchers, opened: room.meeting !== null }
			: null,
		suggestedStyle: defaultRoomStyle(found.kind),
		...records
	};
};

function ticketInput(form: FormData) {
	const name = formText(form, 'name', 100);
	const attendance = form.get('attendance');
	const capacity = readCapacity(form);
	const sortOrder = Number(formText(form, 'sort-order', 4) ?? '0');
	if (!name) return { problem: 'Name the kind of seat, such as "In person" or "Online".' };
	if (!attendanceKinds.includes(attendance as Attendance)) return { problem: 'Say whether the seat is in person or online.' };
	if (capacity === 'bad') return { problem: 'Enter the number of seats as a whole number, or leave it empty for no limit.' };
	return { input: { name, attendance: attendance as Attendance, capacity, sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0 } };
}

async function recordingShown(event: RequestEvent, shown: boolean) {
	const { database, found } = await findEvent(event);
	const form = await event.request.formData();
	const room = await roomOfEvent(database, found.identifier);
	const changed = room ? await setRecordingHidden(database, room.identifier, String(form.get('recording') ?? ''), !shown) : false;
	if (!changed) return fail(404, { problem: 'There is no such recording.' });
	return { done: shown ? 'The recording is shown again to the people allowed to watch it.' : 'The recording is hidden from everyone but the hosts.' };
}

async function status(event: RequestEvent, change: StatusChange) {
	const { database, found } = await findEvent(event);
	const note = change === 'cancel' ? formText(await event.request.formData(), 'cancel-note', 1000) : null;
	const result = await changeEventStatus(database, found, change, note);
	if (!result.done) return fail(409, { problem: result.problem });
	if (change === 'delete') redirect(303, '/workspace/events');
	const words: Record<StatusChange, string> = {
		publish: 'Published. The event is listed at Events.',
		unpublish: 'Back to a draft. Readers no longer see it.',
		cancel: 'Cancelled. Everyone signed up is emailed once the site can send email, and the event page says it is cancelled.',
		delete: ''
	};
	return { done: words[change] };
}

export const actions: Actions = {
	saveRoom: async (event) => {
		const { database, found } = await findEvent(event);
		const form = await event.request.formData();
		const style = form.get('style');
		const watchers = form.get('watchers');
		if (!roomStyles.includes(style as RoomStyle) || !(eventRecordingWatchers as readonly string[]).includes(String(watchers))) {
			return fail(400, { problem: 'Choose how the room works and who may watch its recordings.' });
		}
		const before = await roomOfEvent(database, found.identifier);
		await saveEventRoom(database, found, { style: style as RoomStyle, watchers: watchers as RecordingWatchers });
		return { done: before ? 'Saved the room.' : 'The event now uses the website’s video room. People registered online join it from the event’s page.' };
	},

	removeRoom: async (event) => {
		const { database, found } = await findEvent(event);
		const room = await roomOfEvent(database, found.identifier);
		const removed = room ? await removeRoom(database, room.identifier) : true;
		if (!removed) return fail(409, { problem: 'This room has recordings, so it stays. Hide a recording instead.' });
		return { done: 'The event no longer uses the website’s video room.' };
	},

	hideRecording: (event) => recordingShown(event, false),
	showRecording: (event) => recordingShown(event, true),

	save: async (event) => {
		const { database, found } = await findEvent(event);
		const read = readEventForm(await event.request.formData());
		if (!read.ok) return fail(400, { problem: read.problem, field: read.field, values: read.values });
		const saved = await updateEvent(database, found, read.input);
		if (!saved.saved) return fail(409, { problem: saved.problem, field: 'slug', values: read.values });
		return { done: 'Saved.' };
	},

	publish: (event) => status(event, 'publish'),
	unpublish: (event) => status(event, 'unpublish'),
	cancel: (event) => status(event, 'cancel'),
	delete: (event) => status(event, 'delete'),

	saveTicket: async (event) => {
		const { database, found } = await findEvent(event);
		const form = await event.request.formData();
		const read = ticketInput(form);
		if (!read.input) return fail(400, { problem: read.problem });
		const identifier = formText(form, 'ticket', 60);
		const tickets = await ticketTypesOf(database, found.identifier);
		if (identifier && !tickets.some((ticket) => ticket.identifier === identifier)) return fail(404, { problem: 'That kind of seat is not on this event.' });
		await saveTicketType(database, found.identifier, identifier, read.input);
		return { done: identifier ? 'Seat saved. Any new seats were offered to the waitlist.' : 'Seat added.' };
	},

	removeTicket: async (event) => {
		const { database, found } = await findEvent(event);
		const removed = await removeTicketType(database, found.identifier, formText(await event.request.formData(), 'ticket', 60) ?? '');
		if (!removed) return fail(409, { problem: 'People have registered for that kind of seat, so it stays. Set its limit instead.' });
		return { done: 'Seat removed.' };
	},

	saveSpeaker: async (event) => {
		const { database, found } = await findEvent(event);
		const form = await event.request.formData();
		const name = formText(form, 'name', 200);
		if (!name) return fail(400, { problem: 'Enter the speaker’s name.' });
		const slug = formText(form, 'contributor', 120);
		await saveSpeaker(database, found.identifier, formText(form, 'speaker', 60), {
			name,
			about: formText(form, 'about', 300) ?? '',
			contributorSlug: slug,
			sortOrder: Number(formText(form, 'sort-order', 4) ?? '0') || 0
		});
		return { done: 'Speaker saved.' };
	},

	saveSession: async (event) => {
		const { database, found } = await findEvent(event);
		const form = await event.request.formData();
		const title = formText(form, 'title', 200);
		if (!title) return fail(400, { problem: 'Give the session a title.' });
		// Sessions are on the event's first day, in its own zone.
		const day = wallClock(new Date(found.startsAt), found.timeZone).slice(0, 10);
		const starts = zonedToUtc(`${day}T${formText(form, 'starts', 5) ?? ''}`, found.timeZone);
		const endsText = formText(form, 'ends', 5);
		const ends = endsText ? zonedToUtc(`${day}T${endsText}`, found.timeZone) : null;
		if (!starts) return fail(400, { problem: 'Enter the time the session starts.' });
		if (endsText && (!ends || ends.getTime() <= starts.getTime())) return fail(400, { problem: 'A session has to end after it starts.' });
		await saveSession(database, found.identifier, null, { startsAt: starts, endsAt: ends ?? null, title, about: formText(form, 'about', 500) ?? '' });
		return { done: 'Session added.' };
	},

	removeSession: async (event) => {
		const { database, found } = await findEvent(event);
		await removeSession(database, found.identifier, formText(await event.request.formData(), 'session', 60) ?? '');
		return { done: 'Session removed.' };
	},

	addMaterial: async (event) => {
		const { database, found } = await findEvent(event);
		const account = requireAccount(event);
		const bucket = workerEnvironment().sourceDocuments;
		if (!bucket) return fail(503, { problem: 'File storage is not connected.' });
		const form = await event.request.formData();
		const title = formText(form, 'title', 200);
		const file = form.get('file');
		if (!title) return fail(400, { problem: 'Name the file, such as "Slides".' });
		if (!(file instanceof File) || file.size === 0) return fail(400, { problem: 'Choose a file to add.' });
		if (file.size > largestMaterialBytes) return fail(400, { problem: `The file is larger than ${largestMaterialBytes / (1024 * 1024)} MB.` });
		const bytes = await file.arrayBuffer();
		const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map((byte) => byte.toString(16).padStart(2, '0')).join('');
		const identifier = newIdentifier();
		const fileName = safeFileName(file.name || 'file');
		const contentType = file.type || 'application/octet-stream';
		const objectKey = materialObjectKey(found.identifier, identifier);
		// Stored and put in line for the scanner in one step; nobody can download it until the scan passes (site/SCANNING.md).
		await storeSentFile(database, bucket, {
			objectKey,
			purpose: 'event-material',
			subject: found.identifier,
			bytes,
			httpMetadata: { contentType },
			customMetadata: { sha256: hash }
		});
		await addMaterial(database, { identifier, eventIdentifier: found.identifier, title, fileName, contentType, sizeBytes: file.size, sha256: hash, createdBy: account.subject });
		return { done: 'File added. It appears on the event page once the virus check passes, usually within a few minutes.' };
	},

	removeMaterial: async (event) => {
		const { database, found } = await findEvent(event);
		const removed = await removeMaterial(database, found.identifier, formText(await event.request.formData(), 'material', 60) ?? '');
		if (removed) {
			await workerEnvironment().sourceDocuments?.delete(removed.objectKey);
			await forgetScan(database, removed.objectKey);
		}
		return { done: 'File removed.' };
	},

	removeSpeaker: async (event) => {
		const { database, found } = await findEvent(event);
		await removeSpeaker(database, found.identifier, formText(await event.request.formData(), 'speaker', 60) ?? '');
		return { done: 'Speaker removed.' };
	}
};
