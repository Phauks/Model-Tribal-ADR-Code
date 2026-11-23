import { error } from '@sveltejs/kit';
import { can } from '#lib/permissions.ts';
import type { SignedInPerson } from '#lib/server/people.ts';
import { workerEnvironment } from '#lib/server/environment.ts';
import { eventBySlug, type CalendarEvent } from '#lib/server/event-calendar.ts';

/**
 * The event at this address, for its page, its room and its recordings. A
 * draft is shown only to the people who run events, as a preview.
 */
export async function findEvent(event: { params: { slug: string }; locals: { person: SignedInPerson | undefined } }): Promise<CalendarEvent> {
	const database = workerEnvironment().database;
	const found = database ? await eventBySlug(database, event.params.slug) : undefined;
	const person = event.locals.person;
	if (!found || (found.status === 'draft' && !(person && can(person, 'manage-events')))) {
		error(404, 'There is no event at this address.');
	}
	return found;
}

/** Whether the signed-in person runs events, and so hosts every room. */
export function isHost(person: SignedInPerson | undefined): boolean {
	return Boolean(person && can(person, 'manage-events'));
}
