import { fail, redirect } from '@sveltejs/kit';
import { missingAnswers } from '#lib/contributors.ts';
import { confirmProfile, currentYear, profileBySubject } from '#lib/server/contributor-profiles.ts';
import { requireAccount, storage } from '#lib/server/workspace.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { profile } = await parent();
	if (!profile) redirect(303, '/profile/edit');
	return { missing: missingAnswers(profile.answers, currentYear()) };
};

export const actions: Actions = {
	/** The person checked their answers and confirms them (GOV.UK "Check answers" pattern). */
	default: async (event) => {
		const account = requireAccount(event);
		const { database } = storage(event);
		const profile = await profileBySubject(database, account.subject);
		if (!profile) redirect(303, '/profile/edit');
		if (Object.keys(missingAnswers(profile.answers, currentYear())).length > 0) {
			return fail(400, { problem: 'Some answers are still needed. They are listed at the top of the page.' });
		}
		const form = await event.request.formData();
		if (form.get('agree') !== 'yes') {
			return fail(400, { problem: 'Tick the box to confirm your answers and your credit.' });
		}
		// Confirming the same answers twice would only add an identical version.
		if (profile.hasUnconfirmedChanges) await confirmProfile(database, profile);
		redirect(303, '/profile?confirmed');
	}
};
