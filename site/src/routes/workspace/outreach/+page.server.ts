import { fail, redirect } from '@sveltejs/kit';
import { can } from '#lib/permissions.ts';
import { cleanAddress } from '#lib/mail.ts';
import { createBatch, listBatches, listTemplates, outreachReadiness, OutreachError } from '#lib/server/mail/outreach.ts';
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

function whole(form: FormData, name: string, fallback: number): number {
	const value = Number(formText(form, name, 10) ?? fallback);
	return Number.isFinite(value) ? Math.round(value) : fallback;
}

export const actions: Actions = {
	newBatch: async (event) => {
		const person = requirePermission(event, 'send-outreach');
		const form = await event.request.formData();
		const name = formText(form, 'name', 120);
		const template = formText(form, 'template', 100);
		if (!name || !template) return fail(400, { problem: 'Give the batch a name and choose a template.' });
		const followUp = formText(form, 'followUpDays', 3);
		let identifier: string;
		try {
			identifier = await createBatch(mailContext(), person.identifier, {
				name,
				templateIdentifier: template,
				perDay: whole(form, 'perDay', 40),
				windowStartHour: Math.min(23, Math.max(0, whole(form, 'windowStart', 9))),
				windowEndHour: Math.min(24, Math.max(1, whole(form, 'windowEnd', 15))),
				weekdaysOnly: form.get('weekdaysOnly') === 'yes',
				followUpDays: followUp ? Math.min(90, Math.max(1, Number(followUp) || 14)) : null,
				askAcknowledgment: form.get('askAcknowledgment') === 'yes'
			});
		} catch (problem) {
			if (problem instanceof OutreachError) return fail(400, { problem: problem.message });
			throw problem;
		}
		redirect(303, `/workspace/outreach/${identifier}`);
	},
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
