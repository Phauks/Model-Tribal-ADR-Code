import { error, fail, redirect } from '@sveltejs/kit';
import { mailNations } from 'virtual:mail-nations';
import { cleanAddress } from '#lib/mail.ts';
import { inboxForArrival } from '#lib/server/mail/inboxes.ts';
import {
	addRecipients,
	addressBookRecipients,
	copyBatch,
	fieldsFor,
	getBatch,
	nextSendAt,
	OutreachError,
	removeRecipient,
	renameBatch,
	retryRecipient,
	setBatchStatus,
	startBatch,
	timeZoneForStates,
	type AddressBookRecipient,
	type NewRecipient
} from '#lib/server/mail/outreach.ts';
import { currentTime } from '#lib/server/mail/context.ts';
import { mailContext } from '#lib/server/mail/runtime.ts';
import { suppress } from '#lib/server/mail/suppressions.ts';
import { formText, requirePermission } from '#lib/server/workspace.ts';
import { inView, recipientViews } from './recipient-views.ts';
import type { Actions, PageServerLoad } from './$types';

// One outreach batch (site/MAIL.md, "Outreach"; design/outreach-redesign,
// approved by Trevor on Nov. 27, 2026): its name and where it stands, what it
// sends and how fast, and its recipients as the inbox lists conversations,
// with chips that show each kind, a toolbar for the ticked ones, and a line
// for adding more from the address book or by address.
export const prerender = false;

const nationsByIdentifier = new Map(mailNations.map((nation) => [nation.identifier, nation]));
const pageSize = 200;

export const load: PageServerLoad = async (event) => {
	requirePermission(event, 'send-outreach');
	const context = mailContext();
	const found = await getBatch(context, event.params.batch);
	if (!found) error(404, 'No such batch.');
	// A draft is still being written.
	if (found.batch.status === 'draft') redirect(303, `/workspace/outreach/new?batch=${found.batch.identifier}`);
	const asked = event.url.searchParams.get('show');
	const show = recipientViews.find((view) => view.key === asked)?.key ?? 'all';
	const shown = Math.min(5000, Math.max(pageSize, Number(event.url.searchParams.get('count')) || pageSize));
	const view = recipientViews.find((item) => item.key === show)!;
	const matching = found.recipients.filter((recipient) => inView(view, recipient.status));
	const contacts = await addressBookRecipients(context);
	const replyTo = found.batch.replyAddress ?? context.settings.outreach?.replyTo ?? null;
	const inbox = await inboxForArrival(context, replyTo);
	const firstWaiting = found.recipients.find((recipient) => recipient.status === 'queued');
	const nextAt = found.batch.stage === 'sending' && firstWaiting ? nextSendAt(found.batch, firstWaiting.timeZone, currentTime(context)) : null;
	return {
		batch: found.batch,
		show,
		shownCount: Math.min(shown, matching.length),
		matchingCount: matching.length,
		nextCount: shown + pageSize,
		viewCounts: Object.fromEntries(recipientViews.map((item) => [item.key, found.recipients.filter((recipient) => inView(item, recipient.status)).length])),
		recipients: matching.slice(0, shown).map((recipient) => ({
			identifier: recipient.identifier,
			name: recipient.name,
			email: recipient.email,
			nationName: recipient.nationIdentifier ? (nationsByIdentifier.get(recipient.nationIdentifier)?.name ?? null) : null,
			status: recipient.status,
			skipReason: recipient.skipReason,
			sentAt: recipient.sentAt,
			repliedAt: recipient.repliedAt,
			threadIdentifier: recipient.threadIdentifier,
			deliveryStatus: recipient.deliveryStatus,
			acknowledgedAt: recipient.acknowledgedAt,
			error: recipient.error,
			next: recipient.identifier === firstWaiting?.identifier && nextAt ? nextAt.toISOString() : null
		})),
		repliesTo: inbox?.name ?? replyTo,
		tags: [...new Set(contacts.flatMap((contact) => contact.tags))].sort()
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

function caught(problem: unknown) {
	if (problem instanceof OutreachError) return fail(400, { problem: problem.message });
	throw problem;
}

export const actions: Actions = {
	/** The add line: one address if one is typed, else the address book's contacts that match. */
	add: async (event) => {
		const person = requirePermission(event, 'send-outreach');
		const context = mailContext();
		const form = await event.request.formData();
		const typed = formText(form, 'email', 300)?.trim() ?? '';
		const contacts = await addressBookRecipients(context);
		let chosen: NewRecipient[];
		if (typed) {
			const email = cleanAddress(typed);
			if (!email) return fail(400, { problem: `“${typed}” is not an email address.`, adding: true });
			const known = contacts.find((contact) => contact.email.toLowerCase() === email.toLowerCase());
			chosen = [
				known
					? recipientOf(known, context.settings.siteAddress, person.displayName)
					: {
							contactIdentifier: null,
							nationIdentifier: null,
							email,
							name: email,
							fields: fieldsFor({ name: email, kind: 'organization', role: null, organizationName: null }, null, context.settings.siteAddress, person.displayName),
							timeZone: timeZoneForStates([])
						}
			];
		} else {
			const tag = formText(form, 'tag', 60);
			const nationsOnly = form.get('nations') !== 'any';
			chosen = contacts
				.filter((contact) => (!tag || contact.tags.includes(tag)) && (!nationsOnly || contact.nationIdentifier !== null))
				.map((contact) => recipientOf(contact, context.settings.siteAddress, person.displayName));
			if (chosen.length === 0) return fail(400, { problem: 'No contacts in the address book match.', adding: true });
		}
		try {
			const result = await addRecipients(context, event.params.batch, chosen);
			const already = chosen.length - result.added - result.leftOut;
			return {
				done: [`Added ${result.added}.`, result.leftOut ? `${result.leftOut} left out, with the reason in the list.` : null, already > 0 ? `${already} were in the batch already.` : null].filter(Boolean).join(' '),
				adding: true
			};
		} catch (problem) {
			return caught(problem);
		}
	},

	/** The toolbar over the recipients: remove, try again, or put on the do-not-email list. */
	recipients: async (event) => {
		const person = requirePermission(event, 'send-outreach');
		const context = mailContext();
		const form = await event.request.formData();
		const ticked = new Set(form.getAll('recipient').filter((value): value is string => typeof value === 'string').slice(0, 500));
		if (ticked.size === 0) return fail(400, { problem: 'Tick a recipient first.' });
		const found = await getBatch(context, event.params.batch);
		if (!found) error(404, 'No such batch.');
		const chosen = found.recipients.filter((recipient) => ticked.has(recipient.identifier));
		const action = form.get('do');
		let changed = 0;
		for (const recipient of chosen) {
			if (action === 'remove' && (recipient.status === 'queued' || recipient.status === 'skipped')) {
				await removeRecipient(context, event.params.batch, recipient.identifier);
				changed += 1;
			} else if (action === 'retry' && recipient.status === 'failed') {
				await retryRecipient(context, event.params.batch, recipient.identifier);
				changed += 1;
			} else if (action === 'suppress') {
				await suppress(context, recipient.email, 'manual', { source: 'outreach batch', personIdentifier: person.identifier });
				changed += 1;
			}
		}
		const words = { remove: 'Removed', retry: 'Back in the queue', suppress: 'On the do-not-email list' }[action as string] ?? 'Changed';
		const skipped = chosen.length - changed;
		return { done: `${words}: ${changed}.${skipped ? ` ${skipped} could not be changed that way.` : ''}` };
	},

	/** Start (or start again), pause, or cancel. A batch can start before the outreach mailbox is set up; nothing goes until it is. */
	status: async (event) => {
		const person = requirePermission(event, 'send-outreach');
		const context = mailContext();
		const form = await event.request.formData();
		const status = formText(form, 'status', 20);
		try {
			if (status === 'running') await startBatch(context, person.identifier, event.params.batch, null);
			else if (status === 'paused' || status === 'cancelled') await setBatchStatus(context, person.identifier, event.params.batch, status);
			else return fail(400, { problem: 'Choose start, pause or cancel.' });
		} catch (problem) {
			return caught(problem);
		}
		return {
			done: {
				running: 'Started. Letters go out every few minutes inside the sending hours.',
				paused: 'Paused. Nothing more goes out until you start it again.',
				cancelled: 'Cancelled. The letters not yet sent will not go.'
			}[status]
		};
	},

	copy: async (event) => {
		const person = requirePermission(event, 'send-outreach');
		try {
			const identifier = await copyBatch(mailContext(), person.identifier, event.params.batch);
			redirect(303, `/workspace/outreach/new?batch=${identifier}`);
		} catch (problem) {
			return caught(problem);
		}
	},

	rename: async (event) => {
		const person = requirePermission(event, 'send-outreach');
		const context = mailContext();
		const form = await event.request.formData();
		const name = formText(form, 'name', 120)?.trim();
		if (!name) return fail(400, { problem: 'Give the batch a name.' });
		await renameBatch(context, person.identifier, event.params.batch, name);
		return { done: 'Renamed.' };
	}
};
