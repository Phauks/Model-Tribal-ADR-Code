import { error, fail, redirect } from '@sveltejs/kit';
import {
	attendanceKinds,
	attendanceLabels,
	eventMoment,
	eventWhen,
	registrationStatusLabels,
	type Attendance
} from '#lib/event-calendar.ts';
import { confirmedCredits } from '#lib/server/contributor-profiles.ts';
import { workerEnvironment } from '#lib/server/environment.ts';
import {
	changeEventStatus,
	eventByIdentifier,
	registrationsOf,
	removeSpeaker,
	removeTicketType,
	saveSpeaker,
	saveTicketType,
	speakersOf,
	ticketTypesOf,
	updateEvent,
	type StatusChange
} from '#lib/server/event-calendar.ts';
import { eventEmailDelivery } from '#lib/server/event-calendar-email.ts';
import { formText, requirePermission, storage } from '#lib/server/workspace.ts';
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
	const [tickets, speakers, registrations, credits] = await Promise.all([
		ticketTypesOf(database, found.identifier),
		speakersOf(database, found.identifier),
		registrationsOf(database, found.identifier),
		confirmedCredits(database)
	]);
	return {
		event: {
			identifier: found.identifier,
			slug: found.slug,
			title: found.title,
			status: found.status,
			when: eventWhen(found.startsAt, found.endsAt, found.timeZone),
			cancelNote: found.cancelNote,
			sequence: found.sequence
		},
		values: formValuesOf(found),
		added: event.url.searchParams.has('added'),
		tickets: tickets.map((ticket) => ({ ...ticket, attendanceLabel: attendanceLabels[ticket.attendance] })),
		speakers,
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
		emailReady: eventEmailDelivery(workerEnvironment()).kind === 'email'
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

	removeSpeaker: async (event) => {
		const { database, found } = await findEvent(event);
		await removeSpeaker(database, found.identifier, formText(await event.request.formData(), 'speaker', 60) ?? '');
		return { done: 'Speaker removed.' };
	}
};
