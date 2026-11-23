import { error, fail } from '@sveltejs/kit';
import { can } from '#lib/permissions.ts';
import {
	attendanceLabels,
	eventKindLabels,
	eventMoment,
	eventWhen,
	paragraphsOf,
	recordingLabels,
	whereLine
} from '#lib/event-calendar.ts';
import { confirmedCredits } from '#lib/server/contributor-profiles.ts';
import { workerEnvironment } from '#lib/server/environment.ts';
import {
	acceptOffer,
	cancelRegistration,
	eventBySlug,
	expireOffers,
	register,
	registrationFor,
	registrationOpen,
	speakersOf,
	ticketTypesOf,
	type CalendarEvent
} from '#lib/server/event-calendar.ts';
import { formText, requireAccount, storage } from '#lib/server/workspace.ts';
import type { Actions, PageServerLoad, RequestEvent } from './$types';

/** The event at this address. A draft is shown only to the people who run events, as a preview. */
async function findEvent(event: RequestEvent | Parameters<PageServerLoad>[0]): Promise<CalendarEvent> {
	const database = workerEnvironment().database;
	const found = database ? await eventBySlug(database, event.params.slug) : undefined;
	const person = event.locals.person;
	if (!found || (found.status === 'draft' && !(person && can(person, 'manage-events')))) {
		error(404, 'There is no event at this address.');
	}
	return found;
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
	const showOnlineLink =
		found.status === 'published' &&
		!over &&
		found.onlineLink !== null &&
		(tickets.length === 0 || (own?.status === 'registered' && own.attendance === 'online'));
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
		onlineLink: showOnlineLink ? found.onlineLink : null
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
