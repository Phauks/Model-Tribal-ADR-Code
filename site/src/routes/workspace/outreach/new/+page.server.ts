import { fail, redirect } from '@sveltejs/kit';
import { mailNations } from 'virtual:mail-nations';
import { today } from '#lib/address-book.ts';
import { fillTemplate, outreachText } from '#lib/mail.ts';
import {
	addRecipients,
	addressBookRecipients,
	fieldsFor,
	getBatch,
	listTemplates,
	OutreachError,
	outreachAudience,
	outreachReadiness,
	saveBatchDraft,
	sendOutreachTest,
	startBatch,
	timeZoneForStates,
	type AudienceFilter
} from '#lib/server/mail/outreach.ts';
import { mailCarriers, mailContext } from '#lib/server/mail/runtime.ts';
import { listSavedReplies, listSignatures } from '#lib/server/mail/writing.ts';
import { requirePermission } from '#lib/server/workspace.ts';
import { draftOf, filterOf, hasFilter, replyChoicesOf } from './batch-form.ts';
import type { Actions, PageServerLoad } from './$types';

// New batch (site/MAIL.md, "Outreach"; design/outreach-redesign, approved by
// Trevor on Nov. 27, 2026): the inbox's box for writing mail, made for a
// batch. To is who in the address book it reaches, with who is left out and
// why; Replies to is the inbox its replies arrive in; the template's words
// can be changed for this batch; and the bar starts or schedules it, sets the
// pace and the follow-up, sends a test, and previews each letter. What is
// written saves itself as a draft (../drafts/save/+server.ts).
export const prerender = false;

const nationsByIdentifier = new Map(mailNations.map((nation) => [nation.identifier, nation]));

export const load: PageServerLoad = async (event) => {
	const person = requirePermission(event, 'send-outreach');
	const context = mailContext();
	const asked = event.url.searchParams.get('batch');
	const found = asked ? await getBatch(context, asked.slice(0, 100)) : null;
	const draft = found && found.batch.status === 'draft' ? found.batch : null;
	if (found && !draft) redirect(303, `/workspace/outreach/${found.batch.identifier}`);
	const filter: AudienceFilter = hasFilter(event.url.searchParams) || !draft?.audience ? filterOf(event.url.searchParams) : draft.audience;
	const audience = await outreachAudience(context, filter, today());
	const everyone = await addressBookRecipients(context);
	const site = context.settings.siteAddress ?? 'https://example.org';
	const replies = await replyChoicesOf(context);
	const [templates, signatures, savedReplies] = await Promise.all([listTemplates(context), listSignatures(context), listSavedReplies(context)]);
	return {
		filter,
		draft: draft
			? {
					identifier: draft.identifier,
					name: draft.name,
					templateIdentifier: draft.templateIdentifier,
					subject: draft.subject,
					body: draft.body,
					perDay: draft.perDay,
					windowStartHour: draft.windowStartHour,
					windowEndHour: draft.windowEndHour,
					weekdaysOnly: draft.weekdaysOnly,
					followUpDays: draft.followUpDays,
					askAcknowledgment: draft.askAcknowledgment,
					startsAt: draft.startsAt,
					replyAddress: draft.replyAddress,
					updatedAt: draft.updatedAt
				}
			: null,
		tags: [...new Set(everyone.flatMap((contact) => contact.tags))].sort(),
		templates: templates.map(({ identifier, name, version, subject, body }) => ({ identifier, name, version, subject, body })),
		recipients: audience.recipients.slice(0, 1000).map((contact) => {
			const nation = contact.nationIdentifier ? (nationsByIdentifier.get(contact.nationIdentifier) ?? null) : null;
			return {
				name: contact.name,
				nationName: nation?.name ?? null,
				fields: fieldsFor(contact, nation, context.settings.siteAddress, person.displayName)
			};
		}),
		recipientCount: audience.recipients.length,
		leftOut: audience.leftOut,
		problems: outreachReadiness(context, mailCarriers(context)),
		mailbox: context.settings.outreach?.from ?? null,
		replyChoices: replies.choices,
		replyTo: draft?.replyAddress ?? replies.fallback,
		signatures,
		savedReplies: savedReplies.map(({ identifier, name, body }) => ({ identifier, name, body })),
		senderName: person.displayName,
		links: {
			unsubscribeLink: `${site}/mail/unsubscribe/…`,
			unsubscribeAddress: `unsubscribe+…@${context.settings.domain ?? 'example.org'}`,
			acknowledgeLink: `${site}/mail/got-it/…`
		}
	};
};

export const actions: Actions = {
	/** "Send a test to me": the letter one recipient would get, sent to the person writing the batch. */
	test: async (event) => {
		const person = requirePermission(event, 'send-outreach');
		const context = mailContext();
		const form = await event.request.formData();
		const subject = typeof form.get('subject') === 'string' ? String(form.get('subject')).slice(0, 300) : '';
		const body = typeof form.get('body') === 'string' ? String(form.get('body')).slice(0, 20_000) : '';
		if (!subject.trim() || !body.trim()) return fail(400, { problem: 'Write a subject and a message first.' });
		const audience = await outreachAudience(context, filterOf(form), today());
		const showing = Math.min(Math.max(0, Number(form.get('showing')) || 0), Math.max(0, audience.recipients.length - 1));
		const contact = audience.recipients[showing];
		const nation = contact?.nationIdentifier ? (nationsByIdentifier.get(contact.nationIdentifier) ?? null) : null;
		const fields = contact ? fieldsFor(contact, nation, context.settings.siteAddress, person.displayName) : { 'sender.name': person.displayName };
		const site = context.settings.siteAddress ?? '';
		try {
			await sendOutreachTest(context, mailCarriers(context), {
				to: person.email,
				subject: fillTemplate(subject, fields).trim(),
				text: outreachText(body, fields, {
					unsubscribeLink: `${site}/mail/unsubscribe/test`,
					unsubscribeAddress: null,
					acknowledgeLink: form.get('askAcknowledgment') === 'yes' ? `${site}/mail/got-it/test` : null
				})
			});
		} catch (problem) {
			if (problem instanceof OutreachError) return fail(400, { problem: problem.message });
			throw problem;
		}
		return { done: `A test went to ${person.email}.` };
	},

	/**
	 * Starts the batch, or schedules it when a start time is set: saves it,
	 * adds everyone the address book shows, and sets it going. Nothing is sent
	 * until the outreach mailbox is set up (outreachReadiness), so a batch can
	 * be scheduled before then.
	 */
	start: async (event) => {
		const person = requirePermission(event, 'send-outreach');
		const context = mailContext();
		const form = await event.request.formData();
		const draft = draftOf(form, (await replyChoicesOf(context)).choices.map((choice) => choice.value));
		if (!draft.templateIdentifier) return fail(400, { problem: 'Choose a template.' });
		if (!draft.subject.trim() || !draft.body.trim()) return fail(400, { problem: 'Write a subject and a message first.' });
		const audience = await outreachAudience(context, draft.audience, today());
		if (audience.recipients.length === 0) return fail(400, { problem: 'No one in the address book matches.' });
		let identifier: string;
		try {
			identifier = (await saveBatchDraft(context, person.identifier, draft)).identifier;
			await addRecipients(
				context,
				identifier,
				audience.recipients.map((contact) => {
					const nation = contact.nationIdentifier ? (nationsByIdentifier.get(contact.nationIdentifier) ?? null) : null;
					return {
						contactIdentifier: contact.contactIdentifier,
						nationIdentifier: contact.nationIdentifier,
						email: contact.email,
						name: contact.name,
						fields: fieldsFor(contact, nation, context.settings.siteAddress, person.displayName),
						timeZone: timeZoneForStates(nation?.states ?? [])
					};
				})
			);
			await startBatch(context, person.identifier, identifier, draft.startsAt);
		} catch (problem) {
			if (problem instanceof OutreachError) return fail(400, { problem: problem.message });
			throw problem;
		}
		redirect(303, `/workspace/outreach/${identifier}`);
	}
};
