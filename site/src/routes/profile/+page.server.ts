import { fail, redirect } from '@sveltejs/kit';
import { deleteProfile, profileBySubject } from '#lib/server/contributor-profiles.ts';
import { requireAccount, storage } from '#lib/server/workspace.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => ({
	confirmed: url.searchParams.has('confirmed'),
	deleted: url.searchParams.has('deleted')
});

export const actions: Actions = {
	/** Deletes the profile at the person's request (docs/contributor-profiles.md, "Leaving"). */
	delete: async (event) => {
		const account = requireAccount(event);
		const { database } = storage(event);
		const form = await event.request.formData();
		if (form.get('sure') !== 'yes') {
			return fail(400, { problem: 'Tick the box to confirm that you want to delete your profile.' });
		}
		const profile = await profileBySubject(database, account.subject);
		if (profile) await deleteProfile(database, profile);
		redirect(303, '/profile?deleted');
	}
};
