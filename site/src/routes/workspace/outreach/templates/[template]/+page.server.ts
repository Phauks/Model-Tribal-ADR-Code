import { error, fail, redirect } from '@sveltejs/kit';
import { fillTemplate, mergeFields, type MergeValues } from '#lib/mail.ts';
import { archiveTemplate, listTemplates, OutreachError, outreachText, saveTemplate, templateVersions } from '#lib/server/mail/outreach.ts';
import { mailContext } from '#lib/server/mail/runtime.ts';
import { formText, requirePermission } from '#lib/server/workspace.ts';
import type { Actions, PageServerLoad } from './$types';

// One outreach template, or a new one at /workspace/outreach/templates/new.
// Every save keeps the earlier version.
export const prerender = false;

const sample: MergeValues = {
	'nation.name': 'Example Nation',
	'contact.greeting': 'Tribal Secretary’s Office',
	'contact.name': 'Tribal Secretary’s Office',
	'contact.role': 'Tribal Secretary',
	'organization.name': 'Example Nation Tribal Council',
	'nation.page': 'https://example.org/nations/example-nation',
	'sender.name': 'Your name'
};

export const load: PageServerLoad = async (event) => {
	requirePermission(event, 'send-outreach');
	const context = mailContext();
	const isNew = event.params.template === 'new';
	const template = isNew ? null : (await listTemplates(context, true)).find((item) => item.identifier === event.params.template);
	if (!isNew && !template) error(404, 'No such template.');
	const subject = template?.subject ?? '';
	const body = template?.body ?? '';
	return {
		template,
		mergeFields,
		versions: template ? await templateVersions(context, template.identifier) : [],
		preview: template
			? {
					subject: fillTemplate(subject, sample),
					text: outreachText(body, sample, {
						unsubscribeLink: 'https://example.org/mail/unsubscribe/…',
						unsubscribeAddress: 'unsubscribe+…@example.org',
						acknowledgeLink: null
					})
				}
			: null
	};
};

export const actions: Actions = {
	save: async (event) => {
		const person = requirePermission(event, 'send-outreach');
		const form = await event.request.formData();
		const values = { name: formText(form, 'name', 120) ?? '', subject: formText(form, 'subject', 500) ?? '', body: formText(form, 'body', 50_000) ?? '' };
		if (!values.name || !values.subject || !values.body) return fail(400, { problem: 'Give the template a name, a subject and a message.', values });
		let identifier: string;
		try {
			identifier = await saveTemplate(mailContext(), person.identifier, {
				identifier: event.params.template === 'new' ? null : event.params.template,
				...values
			});
		} catch (problem) {
			if (problem instanceof OutreachError) return fail(400, { problem: problem.message, values });
			throw problem;
		}
		redirect(303, `/workspace/outreach/templates/${identifier}`);
	},
	archive: async (event) => {
		const person = requirePermission(event, 'send-outreach');
		const form = await event.request.formData();
		await archiveTemplate(mailContext(), person.identifier, event.params.template, form.get('archived') === 'yes');
		return { done: form.get('archived') === 'yes' ? 'Archived. Batches already made from it keep their copy.' : 'Restored.' };
	}
};
