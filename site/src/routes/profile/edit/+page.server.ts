import { fail, redirect } from '@sveltejs/kit';
import { reviewSubjects } from 'virtual:review-subjects';
import { nationSlots, readProfileForm } from '#lib/server/contributor-form.ts';
import { saveAnswers } from '#lib/server/contributor-profiles.ts';
import { requireAccount, storage } from '#lib/server/workspace.ts';
import type { Actions, PageServerLoad } from './$types';

/** Every nation in the project's list, offered as suggestions; any other name may be typed. */
const nations = reviewSubjects
	.filter((subject) => subject.kind === 'nation')
	.map((subject) => ({ identifier: subject.identifier, title: subject.title }))
	.sort((first, second) => first.title.localeCompare(second.title, 'en-US'));

export const load: PageServerLoad = () => ({
	nationTitles: nations.map((nation) => nation.title),
	nationChoices: nations.map((nation) => ({ value: nation.identifier, label: nation.title })),
	nationSlots
});

export const actions: Actions = {
	default: async (event) => {
		const account = requireAccount(event);
		const { database } = storage(event);
		const form = await event.request.formData();
		const result = readProfileForm(form, nations);
		if (!result.ok) return fail(400, { errors: result.errors, values: result.values });
		await saveAnswers(database, account, result.answers);
		redirect(303, form.get('next') === 'later' ? '/profile' : '/profile/review');
	}
};
