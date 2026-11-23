import { fail, redirect } from '@sveltejs/kit';
import { parseAddressList } from '#lib/mail.ts';
import { CompositionError, queueMessage, sendMessage } from '#lib/server/mail/outbound.ts';
import { addressBookRecipients } from '#lib/server/mail/outreach.ts';
import { mailCarriers, mailContext } from '#lib/server/mail/runtime.ts';
import { formText, requirePermission } from '#lib/server/workspace.ts';
import { readAttachments, whenFromForm } from '../compose.ts';
import type { Actions, PageServerLoad } from './$types';

// A new message from the project inbox. It goes through Cloudflare Email
// Service, which may carry only mail people started or expect, so a first
// letter to a nation goes out as outreach instead (site/MAIL.md, "Outreach").
export const prerender = false;

export const load: PageServerLoad = async (event) => {
	requirePermission(event, 'read-mail');
	const context = mailContext();
	const contacts = await addressBookRecipients(context);
	return {
		addresses: context.settings.addresses,
		suggestions: contacts.map((contact) => ({ email: contact.email, label: contact.organizationName ? `${contact.name}, ${contact.organizationName}` : contact.name })),
		to: event.url.searchParams.get('to') ?? '',
		emailOn: context.settings.domain !== null
	};
};

export const actions: Actions = {
	default: async (event) => {
		const person = requirePermission(event, 'read-mail');
		const context = mailContext();
		const form = await event.request.formData();
		const to = parseAddressList(formText(form, 'to', 4000) ?? '');
		const cc = parseAddressList(formText(form, 'cc', 4000) ?? '');
		const bcc = parseAddressList(formText(form, 'bcc', 4000) ?? '');
		const values = { to: formText(form, 'to', 4000) ?? '', subject: formText(form, 'subject', 500) ?? '', text: formText(form, 'text', 200_000) ?? '' };
		const invalid = [...to.invalid, ...cc.invalid, ...bcc.invalid];
		if (invalid.length) return fail(400, { problem: `These do not look like email addresses: ${invalid.join(', ')}.`, values });
		if (!values.subject || !values.text) return fail(400, { problem: 'Give the message a subject and some words.', values });
		let thread: string;
		try {
			const queued = await queueMessage(context, {
				personIdentifier: person.identifier,
				threadIdentifier: null,
				from: formText(form, 'from', 200) ?? '',
				to: to.addresses,
				cc: cc.addresses,
				bcc: bcc.addresses,
				subject: values.subject,
				text: values.text,
				attachments: await readAttachments(form),
				sendAt: whenFromForm(form, 'sendAt'),
				followUpAt: whenFromForm(form, 'followUpAt')
			});
			thread = queued.threadIdentifier;
			if (!queued.scheduled) await sendMessage(context, mailCarriers(context), queued.messageIdentifier);
		} catch (problem) {
			if (problem instanceof CompositionError) return fail(400, { problem: problem.message, values });
			throw problem;
		}
		redirect(303, `/workspace/inbox/${thread}`);
	}
};
