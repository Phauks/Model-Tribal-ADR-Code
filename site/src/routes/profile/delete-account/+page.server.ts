import { fail, redirect } from '@sveltejs/kit';
import { creditOf } from '#lib/contributors.ts';
import { deleteAccount } from '#lib/server/account-deletion.ts';
import { clearSessionCookie } from '#lib/server/sign-in.ts';
import { clearSignedIn } from '#lib/server/signed-in-hint.ts';
import { requireAccount, storage } from '#lib/server/workspace.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { profile } = await parent();
	return { creditLine: profile ? (creditOf(profile.answers)?.line ?? null) : null };
};

export const actions: Actions = {
	default: async (event) => {
		const account = requireAccount(event);
		const { database } = storage(event);
		const form = await event.request.formData();
		const name = form.get('name');
		if (name !== 'keep' && name !== 'remove') {
			return fail(400, { problem: 'Choose whether to keep your name on work you helped with.', name: '' });
		}
		if (form.get('sure') !== 'yes') {
			return fail(400, { problem: 'Tick the box to confirm that you want to delete your account.', name });
		}
		const result = await deleteAccount(database, account, name === 'keep');
		if (result.outcome === 'last-lead-author') {
			return fail(400, {
				problem: 'You are the only lead author. Make someone else lead author on the People page first.',
				name
			});
		}
		clearSessionCookie(event.cookies);
		clearSignedIn(event.cookies);
		redirect(303, '/account-deleted');
	}
};
