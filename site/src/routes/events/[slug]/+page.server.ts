import { fail } from '@sveltejs/kit';
import {
	attendanceLabels,
	eventKindLabels,
	eventMoment,
	eventWhen,
	paragraphsOf,
	recordingLabels,
	seatStatus,
	sessionTimes,
	whereLine
} from '#lib/event-calendar.ts';
import { durationWords } from '#lib/video-rooms.ts';
import { confirmedCredits } from '#lib/server/contributor-profiles.ts';
import { mayWatchRecordings, recordingsOf, roomOfEvent } from '#lib/server/video-rooms.ts';
import { fileScans, mayServe, stillScanning } from '#lib/server/file-scans.ts';
import {
	acceptOffer,
	cancelRegistration,
	expireOffers,
	materialsOf,
	registrationFor,
	registrationOpen,
	sessionsOf,
	speakersOf,
	ticketTypesOf
} from '#lib/server/event-calendar.ts';
import { requireAccount, storage } from '#lib/server/workspace.ts';
import type { Actions, PageServerLoad } from './$types';
import { findEvent, isHost } from './find-event.ts';

/** A speaker's initials for the round mark beside their name, such as "AS" for "A. Speaker". */
function initialsOf(name: string): string {
	const words = name.split(/\s+/).filter((word) => /\p{L}/u.test(word));
	const letters = words.length > 1 ? [words[0], words[words.length - 1]] : words;
	return letters.map((word) => (word.match(/\p{L}/u)?.[0] ?? '').toUpperCase()).join('');
}

/** "PDF, 2.4 MB": a file's kind from its name, and its size. */
function fileKind(name: string): string {
	const extension = name.includes('.') ? name.split('.').pop()?.toUpperCase() : undefined;
	return extension && extension.length <= 5 ? extension : 'File';
}

function fileSize(bytes: number): string {
	if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * An event's page: what it is, when and where, who is speaking, and the
 * reader's registration. The online link shows only to people registered
 * for an online seat, or to everyone when the event takes no registration.
 */
export const load: PageServerLoad = async (event) => {
	const found = await findEvent(event);
	const { database } = storage(event);
	event.setHeaders({ 'cache-control': 'private, no-store' });
	const time = new Date();
	await expireOffers(database, time);
	const [tickets, speakers, credits, sessions, materials] = await Promise.all([
		ticketTypesOf(database, found.identifier),
		speakersOf(database, found.identifier),
		confirmedCredits(database),
		sessionsOf(database, found.identifier),
		materialsOf(database, found.identifier)
	]);
	const materialScans = await fileScans(database, materials.map((material) => material.objectKey));
	const publicPages = new Set(credits.filter((credit) => credit.onWebsite && credit.slug).map((credit) => credit.slug));
	const account = event.locals.account;
	const own = account ? await registrationFor(database, found.identifier, account.subject) : undefined;
	const over = new Date(found.endsAt).getTime() <= time.getTime();
	const started = new Date(found.startsAt).getTime() <= time.getTime();
	const room = await roomOfEvent(database, found.identifier);
	const host = isHost(event.locals.person);
	// With the website's own room, the room's page is the online link: it lets in only the people allowed.
	const showOnlineLink =
		found.status === 'published' &&
		!over &&
		(found.onlineLink !== null || room !== undefined) &&
		(tickets.length === 0 || (own?.status === 'registered' && own.attendance === 'online'));
	const roomLink = room ? `/events/${found.slug}/room` : null;
	const mayWatch = room ? mayWatchRecordings(room, { signedIn: Boolean(account), host, registered: own?.status === 'registered' }) : false;
	const recordings = mayWatch && room ? (await recordingsOf(database, room.identifier)).filter((recording) => recording.objectKey && (host || !recording.hidden)) : [];
	const scans = await fileScans(database, recordings.map((recording) => recording.objectKey as string));
	return {
		sessions: sessions.map((session) => ({
			identifier: session.identifier,
			times: sessionTimes(session.startsAt, session.endsAt, found.timeZone),
			title: session.title,
			about: session.about
		})),
		// Materials show once the scanner has passed them; until then only the hosts see that one is being checked.
		materials: materials
			.map((material) => {
				const scan = materialScans.get(material.objectKey) ?? null;
				return {
					address: `/events/${found.slug}/materials/${material.identifier}`,
					title: material.title,
					size: fileSize(material.sizeBytes),
					kind: fileKind(material.fileName),
					sha256: material.sha256,
					ready: mayServe(scan),
					checking: stillScanning(scan)
				};
			})
			.filter((material) => material.ready || (host && material.checking)),
		seatStatus: seatStatus(tickets)?.words ?? null,
		event: {
			slug: found.slug,
			title: found.title,
			summary: found.summary,
			paragraphs: paragraphsOf(found.description),
			kind: eventKindLabels[found.kind],
			when: eventWhen(found.startsAt, found.endsAt, found.timeZone),
			where: whereLine(
				found,
				tickets.map((ticket) => ticket.attendance)
			),
			venueName: found.venueName,
			venueAddress: found.venueAddress,
			accessNotes: paragraphsOf(found.accessNotes),
			recording: recordingLabels[found.recording],
			recordingLink: over ? found.recordingLink : null,
			status: found.status,
			cancelNote: found.cancelNote,
			closes: found.registrationClosesAt ? eventMoment(found.registrationClosesAt, found.timeZone) : null
		},
		speakers: speakers.map((speaker) => ({
			initials: initialsOf(speaker.name),
			name: speaker.name,
			about: speaker.about,
			page: speaker.contributorSlug && publicPages.has(speaker.contributorSlug) ? `/contributors/${speaker.contributorSlug}` : null
		})),
		tickets: tickets.map((ticket) => ({
			identifier: ticket.identifier,
			name: ticket.name,
			attendance: attendanceLabels[ticket.attendance],
			seatsLeft: ticket.capacity === null ? null : Math.max(0, ticket.capacity - ticket.taken),
			capacity: ticket.capacity,
			taken: ticket.taken,
			full: ticket.capacity !== null && (ticket.taken >= ticket.capacity || ticket.waiting > 0)
		})),
		over,
		started,
		open: registrationOpen(found, tickets, time),
		signedIn: Boolean(account),
		mine: own
			? {
					identifier: own.identifier,
					status: own.status,
					ticketName: own.ticketName,
					attendance: own.attendance,
					waitlistPlace: own.waitlistPlace,
					offerEnds: own.offerExpiresAt ? eventMoment(own.offerExpiresAt, found.timeZone) : null
				}
			: null,
		onlineLink: showOnlineLink ? (roomLink ?? found.onlineLink) : null,
		usesRoom: room !== undefined,
		hostRoomLink: host && roomLink && found.status !== 'cancelled' && !over ? roomLink : null,
		recordings: recordings.map((recording) => {
			const scan = scans.get(recording.objectKey as string) ?? null;
			return {
				address: `/events/${found.slug}/recordings/${recording.identifier}`,
				when: recording.startedAt ? eventMoment(recording.startedAt, found.timeZone) : '',
				length: durationWords(recording.durationSeconds),
				ready: mayServe(scan),
				checking: stillScanning(scan),
				hidden: recording.hidden
			};
		})
	};
};

export const actions: Actions = {
	accept: async (event) => {
		const account = requireAccount(event);
		await findEvent(event);
		const { database } = storage(event);
		const form = await event.request.formData();
		const taken = await acceptOffer(database, String(form.get('registration') ?? ''), account.subject);
		if (!taken) return fail(409, { problem: 'That offer has ended, so the seat went to the next person waiting.' });
		return { done: 'The seat is yours. You are registered.' };
	},

	cancel: async (event) => {
		const account = requireAccount(event);
		await findEvent(event);
		const { database } = storage(event);
		const form = await event.request.formData();
		const cancelled = await cancelRegistration(database, String(form.get('registration') ?? ''), account.subject);
		if (!cancelled) return fail(409, { problem: 'There was nothing to cancel.' });
		return { done: 'Done. You are no longer signed up for this event.' };
	}
};
