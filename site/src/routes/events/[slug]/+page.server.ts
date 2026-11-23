import { fail } from '@sveltejs/kit';
import {
	attendanceLabels,
	eventKindLabels,
	eventMoment,
	eventWhen,
	paragraphsOf,
	recordingLabels,
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
	register,
	registrationFor,
	registrationOpen,
	speakersOf,
	ticketTypesOf
} from '#lib/server/event-calendar.ts';
import { formText, requireAccount, storage } from '#lib/server/workspace.ts';
import type { Actions, PageServerLoad } from './$types';
import { findEvent, isHost } from './find-event.ts';

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
	const [tickets, speakers, credits] = await Promise.all([
		ticketTypesOf(database, found.identifier),
		speakersOf(database, found.identifier),
		confirmedCredits(database)
	]);
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
			name: speaker.name,
			about: speaker.about,
			page: speaker.contributorSlug && publicPages.has(speaker.contributorSlug) ? `/contributors/${speaker.contributorSlug}` : null
		})),
		tickets: tickets.map((ticket) => ({
			identifier: ticket.identifier,
			name: ticket.name,
			attendance: attendanceLabels[ticket.attendance],
			seatsLeft: ticket.capacity === null ? null : Math.max(0, ticket.capacity - ticket.taken),
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
	register: async (event) => {
		const account = requireAccount(event);
		const found = await findEvent(event);
		const { database } = storage(event);
		const form = await event.request.formData();
		const tickets = await ticketTypesOf(database, found.identifier);
		const ticket = tickets.find((item) => item.identifier === form.get('ticket'));
		const name = formText(form, 'name', 200);
		const values = { name: name ?? '', accessNeeds: formText(form, 'access-needs', 2000) ?? '' };
		if (!ticket) return fail(400, { problem: 'Choose how you will take part.', field: 'ticket', values });
		if (!name) return fail(400, { problem: 'Enter your name as it should appear on the list.', field: 'name', values });
		const result = await register(database, {
			eventIdentifier: found.identifier,
			ticketIdentifier: ticket.identifier,
			accountIdentifier: account.subject,
			name,
			accessNeeds: formText(form, 'access-needs', 2000),
			wantsReminders: form.get('reminders') === 'yes'
		});
		if (result.kind === 'closed') return fail(409, { problem: 'Registration for this event is closed.', values });
		if (result.kind === 'already') return { done: 'You are already signed up for this event.' };
		return {
			done:
				result.kind === 'registered'
					? 'You are registered. Your seat is listed below.'
					: 'The seats are taken, so you are on the waitlist. If a seat opens, it is held for you for up to 48 hours.'
		};
	},

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
