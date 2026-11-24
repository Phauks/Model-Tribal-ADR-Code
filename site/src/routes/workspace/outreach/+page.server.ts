import { fail } from '@sveltejs/kit';
import { can } from '#lib/permissions.ts';
import { cleanAddress } from '#lib/mail.ts';
import { listBatches, listTemplates, outreachReadiness } from '#lib/server/mail/outreach.ts';
import { mailCarriers, mailContext } from '#lib/server/mail/runtime.ts';
import { liftSuppression, listSuppressions, suppress, suppressionLabels } from '#lib/server/mail/suppressions.ts';
import { formText, requirePermission } from '#lib/server/workspace.ts';
import type { Actions, PageServerLoad } from './$types';

// Outreach to nations (site/MAIL.md, "Outreach"): batches, templates and
// the do-not-email list.
export const prerender = false;

export const load: PageServerLoad = async (event) => {
	const person = requirePermission(event, 'send-outreach');
	const context = mailContext();
	return {
		batches: await listBatches(context),
		templates: await listTemplates(context, true),
		suppressions: await listSuppressions(context),
		suppressionLabels,
		problems: outreachReadiness(context, mailCarriers(context)),
		carrier: context.settings.outreach ? `${context.settings.outreach.from} through ${context.settings.outreach.host}` : null,
		canManage: can(person, 'manage-mail')
	};
};

export const actions: Actions = {
	suppress: async (event) => {
		const person = requirePermission(event, 'manage-mail');
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
