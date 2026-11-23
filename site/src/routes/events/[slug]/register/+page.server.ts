import { fail, redirect } from '@sveltejs/kit';
import { accessNeedChoices, eventWhen, readAccessNeeds, seatStatus } from '#lib/event-calendar.ts';
import { expireOffers, register, registrationFor, registrationOpen, ticketTypesOf } from '#lib/server/event-calendar.ts';
import { formText, requireAccount, storage } from '#lib/server/workspace.ts';
import type { Actions, PageServerLoad } from './$types';
import { findEvent } from '../find-event.ts';

/**
 * Registering for an event, after choosing a seat in the event page's
 * Register card: the name for the list, what the person needs to take part,
 * and reminders (design/events-and-cle, "3-registration", without its CLE and
 * payment steps, which wait for later phases).
 */
export const load: PageServerLoad = async (event) => {
	const found = await findEvent(event);
	const eventPage = `/events/${found.slug}`;
	if (!event.locals.account) redirect(303, `/sign-in?returnTo=${encodeURIComponent(event.url.pathname + event.url.search)}`);
	const { database } = storage(event);
	event.setHeaders({ 'cache-control': 'private, no-store' });
	await expireOffers(database);
	const [tickets, own] = await Promise.all([ticketTypesOf(database, found.identifier), registrationFor(database, found.identifier, event.locals.account.subject)]);
	if (own || !registrationOpen(found, tickets)) redirect(303, eventPage);
	const asked = event.url.searchParams.get('ticket');
	const chosen = tickets.find((ticket) => ticket.identifier === asked) ?? tickets[0];
	return {
		event: { slug: found.slug, title: found.title, when: eventWhen(found.startsAt, found.endsAt, found.timeZone) },
		tickets: tickets.map((ticket) => ({
			identifier: ticket.identifier,
			name: ticket.name,
			status: seatStatus([ticket])?.words ?? '',
			full: seatStatus([ticket])?.full ?? false
		})),
		chosen: chosen.identifier,
		name: event.locals.person?.displayName ?? event.locals.account.name ?? '',
		needs: accessNeedChoices
	};
};

export const actions: Actions = {
	default: async (event) => {
		const account = requireAccount(event);
		const found = await findEvent(event);
		const { database } = storage(event);
		const form = await event.request.formData();
		const tickets = await ticketTypesOf(database, found.identifier);
		const ticket = tickets.find((item) => item.identifier === form.get('ticket'));
		const name = formText(form, 'name', 200);
		const needs = readAccessNeeds(form);
		const values = { name: name ?? '', needs: needs.chosen, other: needs.other };
		if (!ticket) return fail(400, { problem: 'Choose how you will take part.', field: 'ticket', values });
		if (!name) return fail(400, { problem: 'Enter your name as it should appear on the list.', field: 'name', values });
		const result = await register(database, {
			eventIdentifier: found.identifier,
			ticketIdentifier: ticket.identifier,
			accountIdentifier: account.subject,
			name,
			accessNeeds: needs.text,
			wantsReminders: form.get('reminders') === 'yes'
		});
		if (result.kind === 'closed') return fail(409, { problem: 'Registration for this event is closed.', values });
		// The Register card on the event page then says where they stand.
		redirect(303, `/events/${found.slug}#register`);
	}
};
