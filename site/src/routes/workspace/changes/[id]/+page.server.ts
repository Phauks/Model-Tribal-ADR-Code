import { error, fail } from '@sveltejs/kit';
import { isHideReason, parseChangeIdentifier } from '#lib/page-history.ts';
import { changeForHiding, hideChange, requestsToAnswer, showChange } from '#lib/server/page-history.ts';
import { builtPages } from '#lib/server/page-history-run.ts';
import { formText, requirePermission, storage } from '#lib/server/workspace.ts';
import type { Actions, PageServerLoad } from './$types';

// Hiding parts of one change, or showing it again. The lead author only.
export const load: PageServerLoad = async (event) => {
	requirePermission(event, 'hide-changes');
	const { database } = storage(event);
	const found = await changeForHiding(database, event.params.id, await builtPages());
	if (!found) error(404, 'No change has this address.');
	return { ...found, requests: await requestsToAnswer(database) };
};

/** The private line for the activity log: the request a hiding answers, then any note. */
function logNote(form: FormData): string | null {
	const reference = formText(form, 'request', 40);
	const answers = reference && /^[A-Za-z0-9-]{1,40}$/.test(reference) ? `Answers request ${reference}` : null;
	const note = formText(form, 'note', 500);
	return [answers, note].filter(Boolean).join('. ') || null;
}

export const actions: Actions = {
	hide: async (event) => {
		const person = requirePermission(event, 'hide-changes');
		const { database } = storage(event);
		if (!parseChangeIdentifier(event.params.id)) error(404, 'No change has this address.');
		const form = await event.request.formData();
		const choice = {
			text: form.get('text') === 'on',
			summary: form.get('summary') === 'on',
			person: form.get('person') === 'on',
			reason: form.get('reason')
		};
		if (!choice.text && !choice.summary && !choice.person) return fail(400, { problem: 'Choose at least one part to hide.' });
		if (!isHideReason(typeof choice.reason === 'string' ? choice.reason : null)) {
			return fail(400, { problem: 'Choose the reason readers see.' });
		}
		const done = await hideChange(
			database,
			person.identifier,
			event.params.id,
			{ ...choice, reason: choice.reason as never },
			logNote(form)
		);
		if (!done) error(404, 'No change has this address.');
		return { done: 'Hidden. Recent changes and the page’s history now show it with a line through what is hidden.' };
	},
	show: async (event) => {
		const person = requirePermission(event, 'hide-changes');
		const { database } = storage(event);
		if (!parseChangeIdentifier(event.params.id)) error(404, 'No change has this address.');
		const form = await event.request.formData();
		await showChange(database, person.identifier, event.params.id, formText(form, 'note', 500));
		return { done: 'Shown again.' };
	}
};
