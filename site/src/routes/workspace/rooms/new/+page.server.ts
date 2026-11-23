import { fail, redirect } from '@sveltejs/kit';
import { createRoom } from '#lib/server/video-rooms.ts';
import { requireAccount, requirePermission, storage } from '#lib/server/workspace.ts';
import { emptyRoomForm, readRoomForm } from '../room-form.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = (event) => {
	requirePermission(event, 'host-video-rooms');
	return { values: emptyRoomForm };
};

export const actions: Actions = {
	default: async (event) => {
		requirePermission(event, 'host-video-rooms');
		const account = requireAccount(event);
		const { database } = storage(event);
		const read = readRoomForm(await event.request.formData());
		if ('problem' in read) return fail(400, { problem: read.problem, field: read.field, values: read.values });
		const room = await createRoom(database, read.input, account.subject);
		redirect(303, `/workspace/rooms/${room}?added=1`);
	}
};
