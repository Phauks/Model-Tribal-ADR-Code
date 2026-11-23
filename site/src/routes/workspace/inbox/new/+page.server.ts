import { error, fail, redirect } from '@sveltejs/kit';
import { parseAddressList } from '#lib/mail.ts';
import { afterResponse } from '#lib/server/environment.ts';
import { CompositionError, queueMessage, sendMessage, sendWhenPauseEnds } from '#lib/server/mail/outbound.ts';
import { addressBookRecipients } from '#lib/server/mail/outreach.ts';
import { mailCarriers, mailContext } from '#lib/server/mail/runtime.ts';
import { deleteDraft, getDraft, getUndoSeconds } from '#lib/server/mail/writing.ts';
import { formText, requirePermission } from '#lib/server/workspace.ts';
import { readAttachments, whenFromForm } from '../compose.ts';
import { composerData } from '../composer-data.server.ts';
import type { Actions, PageServerLoad } from './$types';

// A new message from the project inbox. It goes through Cloudflare Email
// Service, which may carry only mail people started or expect, so a first
// letter to a nation goes out as outreach instead (site/MAIL.md, "Outreach").
// A draft saved earlier opens here with ?draft=.
export const prerender = false;

export const load: PageServerLoad = async (event) => {
	const person = requirePermission(event, 'read-mail');
	const context = mailContext();
	const draftIdentifier = event.url.searchParams.get('draft');
	const draft = draftIdentifier ? await getDraft(context, person.identifier, draftIdentifier) : null;
	if (draftIdentifier && (!draft || draft.threadIdentifier)) {
		if (draft?.threadIdentifier) redirect(303, `/workspace/inbox/${draft.threadIdentifier}#reply`);
		error(404, 'That draft is gone. It may have been sent or discarded.');
	}
	const contacts = await addressBookRecipients(context);
	return {
		addresses: context.settings.addresses,
		suggestions: contacts.map((contact) => ({ email: contact.email, label: contact.organizationName ? `${contact.name}, ${contact.organizationName}` : contact.name })),
		defaultAddress: context.settings.defaultAddress ?? '',
		to: event.url.searchParams.get('to') ?? '',
		draft,
		undone: event.url.searchParams.get('undone'),
		writing: await composerData(context, person.displayName)
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
		const draft = formText(form, 'draft', 100);
		const values = {
			to: formText(form, 'to', 4000) ?? '',
			cc: formText(form, 'cc', 4000) ?? '',
			bcc: formText(form, 'bcc', 4000) ?? '',
			from: formText(form, 'from', 200) ?? '',
			subject: formText(form, 'subject', 500) ?? '',
			text: formText(form, 'text', 200_000) ?? '',
			draft
		};
		const invalid = [...to.invalid, ...cc.invalid, ...bcc.invalid];
		if (invalid.length) return fail(400, { problem: `These do not look like email addresses: ${invalid.join(', ')}.`, values });
		if (!values.subject || !values.text) return fail(400, { problem: 'Give the message a subject and some words.', values });
		const sendAt = whenFromForm(form, 'sendAt');
		let thread: string;
		try {
			const queued = await queueMessage(context, {
				personIdentifier: person.identifier,
				threadIdentifier: null,
				from: values.from,
				to: to.addresses,
				cc: cc.addresses,
				bcc: bcc.addresses,
				subject: values.subject,
				text: values.text,
				attachments: await readAttachments(form),
				sendAt,
				remindAt: whenFromForm(form, 'remindAt'),
				holdForUndo: sendAt ? 0 : await getUndoSeconds(context)
			});
			thread = queued.threadIdentifier;
			if (draft) await deleteDraft(context, person.identifier, { identifier: draft });
			if (queued.pause) afterResponse(sendWhenPauseEnds(context, mailCarriers(context), queued.messageIdentifier, queued.pause));
			else if (!queued.scheduled) await sendMessage(context, mailCarriers(context), queued.messageIdentifier);
		} catch (problem) {
			if (problem instanceof CompositionError) return fail(400, { problem: problem.message, values });
			throw problem;
		}
		redirect(303, `/workspace/inbox/${thread}`);
	}
};
