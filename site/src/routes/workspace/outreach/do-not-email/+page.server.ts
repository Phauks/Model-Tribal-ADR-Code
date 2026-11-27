import { fail } from '@sveltejs/kit';
import { can } from '#lib/permissions.ts';
import { cleanAddress } from '#lib/mail.ts';
import { mailContext } from '#lib/server/mail/runtime.ts';
import { liftSuppression, listSuppressions, suppress, suppressionLabels } from '#lib/server/mail/suppressions.ts';
import { formText, requirePermission } from '#lib/server/workspace.ts';
import type { Actions, PageServerLoad } from './$types';

// The do-not-email list (site/MAIL.md, "Outreach"), in Outreach's left column (design/outreach-redesign): addresses that get no outreach, why, and since when. Anyone who sends outreach may add an address; taking one off needs the right to manage mail.
export const prerender = false;

export const load: PageServerLoad = async (event) => {
	const person = requirePermission(event, 'send-outreach');
	return {
		suppressions: await listSuppressions(mailContext()),
		suppressionLabels,
		canLift: can(person, 'manage-mail')
	};
};

export const actions: Actions = {
	suppress: async (event) => {
		const person = requirePermission(event, 'send-outreach');
		const form = await event.request.formData();
		const email = cleanAddress(formText(form, 'email', 300) ?? '');
		if (!email) return fail(400, { problem: 'That does not look like an email address.' });
		await suppress(mailContext(), email, 'manual', { note: formText(form, 'note', 500), personIdentifier: person.identifier });
		return { done: `${email} is on the do-not-email list.` };
	},
	lift: async (event) => {
		const person = requirePermission(event, 'manage-mail');
		const form = await event.request.formData();
		const email = formText(form, 'email', 300);
		if (email) await liftSuppression(mailContext(), email, person.identifier);
		return { done: `${email} is off the do-not-email list.` };
	}
};
