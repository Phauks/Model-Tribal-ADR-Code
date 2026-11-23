import { fail, redirect } from '@sveltejs/kit';
import { createEvent } from '#lib/server/event-calendar.ts';
import { requirePermission, storage } from '#lib/server/workspace.ts';
import { emptyEventForm, readEventForm } from '../event-form.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = (event) => {
	requirePermission(event, 'manage-events');
	return { values: emptyEventForm };
};

export const actions: Actions = {
	default: async (event) => {
		const person = requirePermission(event, 'manage-events');
		const { database } = storage(event);
		const read = readEventForm(await event.request.formData());
		if (!read.ok) return fail(400, { problem: read.problem, field: read.field, values: read.values });
		const saved = await createEvent(database, read.input, person.identifier);
		if (!saved.saved) return fail(409, { problem: saved.problem, field: 'slug', values: read.values });
		redirect(303, `/workspace/events/${saved.identifier}?added=1`);
	}
};
