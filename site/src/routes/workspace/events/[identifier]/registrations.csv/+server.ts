/**
 * Everyone signed up for an event as CSV, for the list at the door and for
 * planning access. It holds people's emails and access needs, so it is never
 * cached and only the lead author and editors can download it.
 */
import { error } from '@sveltejs/kit';
import { csvDocument, csvResponse } from '#lib/csv.ts';
import { registrationStatusLabels } from '#lib/event-calendar.ts';
import { eventByIdentifier, registrationsOf } from '#lib/server/event-calendar.ts';
import { requirePermission, storage } from '#lib/server/workspace.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	requirePermission(event, 'manage-events');
	const { database } = storage(event);
	const found = await eventByIdentifier(database, event.params.identifier);
	if (!found) error(404, 'There is no such event.');
	const header = ['name', 'email', 'seat', 'status', 'access_needs', 'reminders', 'registered_at'];
	const lines = (await registrationsOf(database, found.identifier)).map((registration) =>
		[
			registration.name,
			registration.email,
			registration.ticketName,
			registrationStatusLabels[registration.status],
			registration.accessNeeds,
			registration.wantsReminders ? 'yes' : 'no',
			registration.registeredAt
		]
	);
	const body = csvDocument([header, ...lines], { guardFormulas: true });
	return csvResponse(body, { fileName: `${found.slug}-registrations.csv`, private: true });
};
