import { error, fail } from '@sveltejs/kit';
import { mailNations } from 'virtual:mail-nations';
import { cleanAddress, fillTemplate } from '#lib/mail.ts';
import {
	addRecipients,
	addressBookRecipients,
	fieldsFor,
	getBatch,
	OutreachError,
	outreachReadiness,
	outreachText,
	removeRecipient,
	retryRecipient,
	setBatchStatus,
	timeZoneForStates,
	type AddressBookRecipient,
	type NewRecipient
} from '#lib/server/mail/outreach.ts';
import { mailCarriers, mailContext } from '#lib/server/mail/runtime.ts';
import { formText, requirePermission } from '#lib/server/workspace.ts';
import type { Actions, PageServerLoad } from './$types';

// One outreach batch: who it goes to, how fast, and how far it has got.
export const prerender = false;

const nationsByIdentifier = new Map(mailNations.map((nation) => [nation.identifier, nation]));

export const load: PageServerLoad = async (event) => {
	requirePermission(event, 'send-outreach');
	const context = mailContext();
	const found = await getBatch(context, event.params.batch);
	if (!found) error(404, 'No such batch.');
	const contacts = await addressBookRecipients(context);
	const first = found.recipients.find((recipient) => recipient.status === 'queued') ?? found.recipients[0];
	return {
		...found,
		nationNames: Object.fromEntries(found.recipients.filter((item) => item.nationIdentifier).map((item) => [item.nationIdentifier!, nationsByIdentifier.get(item.nationIdentifier!)?.name ?? item.nationIdentifier!])),
		tags: [...new Set(contacts.flatMap((contact) => contact.tags))].sort(),
		addressBookSize: contacts.length,
		problems: outreachReadiness(context, mailCarriers(context)),
		preview: first
			? {
					to: `${first.name} <${first.email}>`,
					subject: fillTemplate(found.batch.subject, first.fields),
					text: outreachText(found.batch.body, first.fields, {
						unsubscribeLink: `${context.settings.siteAddress ?? 'https://example.org'}/mail/unsubscribe/…`,
						unsubscribeAddress: `unsubscribe+…@${context.settings.domain ?? 'example.org'}`,
						acknowledgeLink: found.batch.askAcknowledgment ? `${context.settings.siteAddress ?? 'https://example.org'}/mail/got-it/…` : null
					})
				}
			: null
	};
};

function recipientOf(contact: AddressBookRecipient, siteAddress: string | null, senderName: string): NewRecipient {
	const nation = contact.nationIdentifier ? (nationsByIdentifier.get(contact.nationIdentifier) ?? null) : null;
	return {
		contactIdentifier: contact.contactIdentifier,
		nationIdentifier: contact.nationIdentifier,
		email: contact.email,
		name: contact.name,
		fields: fieldsFor(contact, nation, siteAddress, senderName),
		timeZone: timeZoneForStates(nation?.states ?? [])
	};
}

export const actions: Actions = {
	addFromAddressBook: async (event) => {
		const person = requirePermission(event, 'send-outreach');
		const context = mailContext();
		const form = await event.request.formData();
		const tag = formText(form, 'tag', 60);
		const label = formText(form, 'label', 30);
		const nationsOnly = form.get('nationsOnly') === 'yes';
		const contacts = (await addressBookRecipients(context)).filter(
			(contact) => (!tag || contact.tags.includes(tag)) && (!label || contact.label === label) && (!nationsOnly || contact.nationIdentifier !== null)
		);
		if (contacts.length === 0) return fail(400, { problem: 'No contacts in the address book match.' });
		try {
			const result = await addRecipients(
				context,
				event.params.batch,
				contacts.map((contact) => recipientOf(contact, context.settings.siteAddress, person.displayName))
			);
			return { done: `Added ${result.added}. ${result.leftOut} left out, with the reason shown in the list.` };
		} catch (problem) {
			if (problem instanceof OutreachError) return fail(400, { problem: problem.message });
			throw problem;
		}
	},
	addOne: async (event) => {
		const person = requirePermission(event, 'send-outreach');
		const context = mailContext();
		const form = await event.request.formData();
		const email = cleanAddress(formText(form, 'email', 300) ?? '');
		const name = formText(form, 'name', 200);
		const nationIdentifier = formText(form, 'nation', 200);
		if (!email || !name) return fail(400, { problem: 'Give an email address and a name.' });
		const nation = nationIdentifier ? (nationsByIdentifier.get(nationIdentifier) ?? null) : null;
		if (nationIdentifier && !nation) return fail(400, { problem: 'That nation is not on the site.' });
		const contact = { name, kind: 'organization' as const, role: formText(form, 'role', 200), organizationName: null };
		try {
			const result = await addRecipients(context, event.params.batch, [
				{
					contactIdentifier: null,
					nationIdentifier: nation?.identifier ?? null,
					email,
					name,
					fields: fieldsFor(contact, nation, context.settings.siteAddress, person.displayName),
					timeZone: timeZoneForStates(nation?.states ?? [])
				}
			]);
			return { done: result.added ? `Added ${email}.` : `${email} was left out; the reason is in the list.` };
		} catch (problem) {
			if (problem instanceof OutreachError) return fail(400, { problem: problem.message });
			throw problem;
		}
	},
	remove: async (event) => {
		requirePermission(event, 'send-outreach');
		const form = await event.request.formData();
		const recipient = formText(form, 'recipient', 100);
		if (recipient) await removeRecipient(mailContext(), event.params.batch, recipient);
		return { done: 'Removed.' };
	},
	retry: async (event) => {
		requirePermission(event, 'send-outreach');
		const form = await event.request.formData();
		const recipient = formText(form, 'recipient', 100);
		if (recipient) await retryRecipient(mailContext(), event.params.batch, recipient);
		return { done: 'Back in the queue.' };
	},
	status: async (event) => {
		const person = requirePermission(event, 'send-outreach');
		const context = mailContext();
		const form = await event.request.formData();
		const status = formText(form, 'status', 20);
		if (status !== 'running' && status !== 'paused' && status !== 'cancelled') return fail(400, { problem: 'Choose start, pause or cancel.' });
		if (status === 'running') {
			const problems = outreachReadiness(context, mailCarriers(context));
			if (problems.length) return fail(400, { problem: `Not ready to send: ${problems.join(' ')}` });
		}
		await setBatchStatus(context, person.identifier, event.params.batch, status);
		return {
			done: {
				running: 'Started. Messages go out every few minutes inside the sending hours.',
				paused: 'Paused. Nothing more goes out until you start it again.',
				cancelled: 'Cancelled. The messages not yet sent will not go.'
			}[status]
		};
	}
};
