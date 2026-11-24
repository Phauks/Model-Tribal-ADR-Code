import { fail, redirect } from '@sveltejs/kit';
import { mailNations } from 'virtual:mail-nations';
import { today } from '#lib/address-book.ts';
import { fillTemplate, outreachText } from '#lib/mail.ts';
import {
	addRecipients,
	addressBookRecipients,
	createBatch,
	fieldsFor,
	listTemplates,
	OutreachError,
	outreachAudience,
	outreachReadiness,
	sendOutreachTest,
	setBatchStatus,
	timeZoneForStates,
	type AudienceFilter
} from '#lib/server/mail/outreach.ts';
import { mailCarriers, mailContext } from '#lib/server/mail/runtime.ts';
import { formText, requirePermission } from '#lib/server/workspace.ts';
import type { Actions, PageServerLoad } from './$types';

// New outreach batch (site/MAIL.md, "Outreach"; design/email-inbox, mockup
// 3): 1 Who, 2 Message, 3 Pace and send, on one page. Who is read from the
// address book with the reasons anyone is left out; the message can be
// changed from its template; the preview steps through each recipient's
// letter; "Send a test to me" and "Start the batch" both go only once the
// outreach mailbox is set up.
export const prerender = false;

const nationsByIdentifier = new Map(mailNations.map((nation) => [nation.identifier, nation]));
const labels = ['general-office', 'leader', 'state-listed'] as const;

function filterOf(values: URLSearchParams | FormData): AudienceFilter {
	const read = (name: string) => {
		const value = values.get(name);
		return typeof value === 'string' ? value : null;
	};
	const label = read('label');
	return {
		tag: read('tag')?.trim().slice(0, 60) || null,
		label: label && (labels as readonly string[]).includes(label) ? label : null,
		// Contacts linked to a nation, unless "Every contact" is chosen.
		nationsOnly: read('nations') !== 'any'
	};
}

export const load: PageServerLoad = async (event) => {
	const person = requirePermission(event, 'send-outreach');
	const context = mailContext();
	const filter = filterOf(event.url.searchParams);
	const audience = await outreachAudience(context, filter, today());
	const everyone = await addressBookRecipients(context);
	const site = context.settings.siteAddress ?? 'https://example.org';
	return {
		filter,
		tags: [...new Set(everyone.flatMap((contact) => contact.tags))].sort(),
		templates: (await listTemplates(context)).map(({ identifier, name, version, subject, body }) => ({ identifier, name, version, subject, body })),
		recipients: audience.recipients.map((contact) => {
			const nation = contact.nationIdentifier ? (nationsByIdentifier.get(contact.nationIdentifier) ?? null) : null;
			return {
				name: contact.name,
				nationName: nation?.name ?? null,
				fields: fieldsFor(contact, nation, context.settings.siteAddress, person.displayName)
			};
		}),
		leftOut: audience.leftOut,
		problems: outreachReadiness(context, mailCarriers(context)),
		mailbox: context.settings.outreach?.from ?? null,
		testAddress: person.email,
		links: {
			unsubscribeLink: `${site}/mail/unsubscribe/…`,
			unsubscribeAddress: `unsubscribe+…@${context.settings.domain ?? 'example.org'}`,
			acknowledgeLink: `${site}/mail/got-it/…`
		}
	};
};

function whole(form: FormData, name: string, fallback: number, low: number, high: number): number {
	const value = Number(formText(form, name, 10) ?? fallback);
	return Number.isFinite(value) ? Math.min(high, Math.max(low, Math.round(value))) : fallback;
}

export const actions: Actions = {
	/** "Send a test to me": the letter one recipient would get, sent to the person preparing the batch. */
	test: async (event) => {
		const person = requirePermission(event, 'send-outreach');
		const context = mailContext();
		const form = await event.request.formData();
		const subject = formText(form, 'subject', 300) ?? '';
		const body = formText(form, 'body', 20_000) ?? '';
		if (!subject.trim() || !body.trim()) return fail(400, { problem: 'Write a subject and a message first.' });
		const filter = filterOf(form);
		const audience = await outreachAudience(context, filter, today());
		const showing = whole(form, 'showing', 0, 0, Math.max(0, audience.recipients.length - 1));
		const contact = audience.recipients[showing];
		const nation = contact?.nationIdentifier ? (nationsByIdentifier.get(contact.nationIdentifier) ?? null) : null;
		const fields = contact
			? fieldsFor(contact, nation, context.settings.siteAddress, person.displayName)
			: { 'sender.name': person.displayName };
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

	/** Makes the batch with everyone shown, then starts it, or keeps it as a draft with "Save without starting". */
	create: async (event) => {
		const person = requirePermission(event, 'send-outreach');
		const context = mailContext();
		const form = await event.request.formData();
		const start = form.get('start') === 'yes';
		const template = formText(form, 'template', 100);
		const subject = formText(form, 'subject', 300) ?? '';
		const body = formText(form, 'body', 20_000) ?? '';
		if (!template) return fail(400, { problem: 'Choose a template.' });
		if (start) {
			const problems = outreachReadiness(context, mailCarriers(context));
			if (problems.length) return fail(400, { problem: `Not ready to send: ${problems.join(' ')} Save it without starting for now.` });
		}
		const filter = filterOf(form);
		const audience = await outreachAudience(context, filter, today());
		if (start && audience.recipients.length === 0) return fail(400, { problem: 'No one in the address book matches.' });
		const followUp = form.get('followUp') === 'yes';
		let identifier: string;
		try {
			identifier = await createBatch(context, person.identifier, {
				name: formText(form, 'name', 120) || `Outreach, ${today()}`,
				templateIdentifier: template,
				subject,
				body,
				perDay: whole(form, 'perDay', 40, 1, 200),
				windowStartHour: whole(form, 'windowStart', 9, 0, 23),
				windowEndHour: whole(form, 'windowEnd', 15, 1, 24),
				weekdaysOnly: form.get('weekdaysOnly') === 'yes',
				followUpDays: followUp ? whole(form, 'followUpDays', 10, 1, 90) : null,
				askAcknowledgment: form.get('askAcknowledgment') === 'yes'
			});
			if (audience.recipients.length) {
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
			}
			if (start) await setBatchStatus(context, person.identifier, identifier, 'running');
		} catch (problem) {
			if (problem instanceof OutreachError) return fail(400, { problem: problem.message });
			throw problem;
		}
		redirect(303, `/workspace/outreach/${identifier}`);
	}
};
