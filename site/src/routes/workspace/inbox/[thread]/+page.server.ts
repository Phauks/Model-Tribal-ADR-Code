import { error, fail, redirect } from '@sveltejs/kit';
import { folders, parseAddressList, quoteForReply, replySubject, type Folder } from '#lib/mail.ts';
import { can } from '#lib/permissions.ts';
import { cancelScheduled, CompositionError, queueMessage, sendAgain, sendMessage } from '#lib/server/mail/outbound.ts';
import { mailCarriers, mailContext } from '#lib/server/mail/runtime.ts';
import {
	addNote,
	assign,
	assignablePeople,
	clearStopRequest,
	getThread,
	listLabels,
	markRead,
	moveToFolder,
	setFollowUp,
	setLabel,
	snooze
} from '#lib/server/mail/store.ts';
import { suppress } from '#lib/server/mail/suppressions.ts';
import { formText, requirePermission } from '#lib/server/workspace.ts';
import { readAttachments, whenFromForm } from '../compose.ts';
import type { Actions, PageServerLoad } from './$types';

// One conversation: its messages, notes and history, and the reply box.
export const prerender = false;

/** Roles that can read the inbox, and so can be assigned a conversation (src/lib/permissions.ts). */
const assignableRoles = ['lead-author'];

export const load: PageServerLoad = async (event) => {
	const person = requirePermission(event, 'read-mail');
	const context = mailContext();
	const thread = await getThread(context, event.params.thread, person.identifier);
	if (!thread) error(404, 'This conversation is not in the inbox.');
	if (thread.unread) await markRead(context, person.identifier, thread.identifier, true);
	const lastInbound = [...thread.messages].reverse().find((message) => message.direction === 'in');
	const replyTo = lastInbound ? (lastInbound.replyTo ?? lastInbound.from.email) : (thread.counterpartAddress ?? '');
	return {
		thread,
		labels: await listLabels(context),
		people: await assignablePeople(context, assignableRoles),
		addresses: context.settings.addresses,
		reply: {
			from: thread.projectAddress && context.settings.addresses.includes(thread.projectAddress) ? thread.projectAddress : (context.settings.defaultAddress ?? ''),
			to: replyTo,
			subject: replySubject(thread.subject),
			quote: lastInbound ? quoteForReply(lastInbound.text, lastInbound.from.name ?? lastInbound.from.email, lastInbound.receivedAt ?? lastInbound.createdAt) : ''
		},
		emailOn: context.settings.domain !== null,
		canManage: can(person, 'manage-mail')
	};
};

function threadOf(event: { params: { thread: string } }): string {
	return event.params.thread;
}

export const actions: Actions = {
	reply: async (event) => {
		const person = requirePermission(event, 'read-mail');
		const context = mailContext();
		const form = await event.request.formData();
		const to = parseAddressList(formText(form, 'to', 4000) ?? '');
		const cc = parseAddressList(formText(form, 'cc', 4000) ?? '');
		const bcc = parseAddressList(formText(form, 'bcc', 4000) ?? '');
		const invalid = [...to.invalid, ...cc.invalid, ...bcc.invalid];
		if (invalid.length) return fail(400, { problem: `These do not look like email addresses: ${invalid.join(', ')}.` });
		const text = formText(form, 'text', 200_000);
		if (!text) return fail(400, { problem: 'Write a message first.' });
		try {
			const queued = await queueMessage(context, {
				personIdentifier: person.identifier,
				threadIdentifier: threadOf(event),
				from: formText(form, 'from', 200) ?? '',
				to: to.addresses,
				cc: cc.addresses,
				bcc: bcc.addresses,
				subject: formText(form, 'subject', 500) ?? '(no subject)',
				text,
				attachments: await readAttachments(form),
				sendAt: whenFromForm(form, 'sendAt'),
				followUpAt: whenFromForm(form, 'followUpAt')
			});
			if (queued.scheduled) return { done: 'Scheduled. It is listed below and in Scheduled until it goes.' };
			const sent = await sendMessage(context, mailCarriers(context), queued.messageIdentifier);
			return sent.sent ? { done: 'Sent.' } : fail(502, { problem: `Not sent: ${sent.error} The message is kept below; use Send again.` });
		} catch (problem) {
			if (problem instanceof CompositionError) return fail(400, { problem: problem.message });
			throw problem;
		}
	},
	read: async (event) => {
		const person = requirePermission(event, 'read-mail');
		const form = await event.request.formData();
		await markRead(mailContext(), person.identifier, threadOf(event), form.get('read') === 'yes');
		if (form.get('read') !== 'yes') redirect(303, '/workspace/inbox');
		return { done: 'Marked read.' };
	},
	move: async (event) => {
		const person = requirePermission(event, 'read-mail');
		const form = await event.request.formData();
		const folder = formText(form, 'folder', 20) as Folder | null;
		if (!folder || !folders.includes(folder)) return fail(400, { problem: 'Choose a folder.' });
		await moveToFolder(mailContext(), person.identifier, threadOf(event), folder);
		if (folder !== 'inbox') redirect(303, '/workspace/inbox');
		return { done: 'Moved to the inbox.' };
	},
	assign: async (event) => {
		const person = requirePermission(event, 'read-mail');
		const context = mailContext();
		const form = await event.request.formData();
		const assignee = formText(form, 'assignee', 100);
		const people = await assignablePeople(context, assignableRoles);
		const chosen = assignee ? people.find((item) => item.identifier === assignee) : null;
		if (assignee && !chosen) return fail(400, { problem: 'That person cannot read the inbox.' });
		await assign(context, person.identifier, threadOf(event), chosen?.identifier ?? null, chosen?.name ?? null);
		return { done: chosen ? `Assigned to ${chosen.name}.` : 'Unassigned.' };
	},
	label: async (event) => {
		const person = requirePermission(event, 'read-mail');
		const form = await event.request.formData();
		const label = formText(form, 'label', 100);
		if (!label) return fail(400, { problem: 'Choose a label.' });
		await setLabel(mailContext(), person.identifier, threadOf(event), label, form.get('on') === 'yes');
		return { done: 'Labels changed.' };
	},
	snooze: async (event) => {
		const person = requirePermission(event, 'read-mail');
		const form = await event.request.formData();
		const until = whenFromForm(form, 'until');
		if (form.get('clear') !== 'yes' && !until) return fail(400, { problem: 'Choose when it should come back.' });
		await snooze(mailContext(), person.identifier, threadOf(event), form.get('clear') === 'yes' ? null : until);
		if (until && form.get('clear') !== 'yes') redirect(303, '/workspace/inbox');
		return { done: 'Snooze ended.' };
	},
	followUp: async (event) => {
		const person = requirePermission(event, 'read-mail');
		const form = await event.request.formData();
		const at = form.get('clear') === 'yes' ? null : whenFromForm(form, 'at');
		if (form.get('clear') !== 'yes' && !at) return fail(400, { problem: 'Choose when to be reminded.' });
		await setFollowUp(mailContext(), person.identifier, threadOf(event), at);
		return { done: at ? 'Reminder set. A reply before then clears it.' : 'Reminder cleared.' };
	},
	note: async (event) => {
		const person = requirePermission(event, 'read-mail');
		const form = await event.request.formData();
		const body = formText(form, 'body', 8000);
		if (!body) return fail(400, { problem: 'Write the note first.' });
		await addNote(mailContext(), person.identifier, threadOf(event), body);
		return { done: 'Note added. Only the project team sees notes.' };
	},
	stop: async (event) => {
		const person = requirePermission(event, 'manage-mail');
		const context = mailContext();
		const form = await event.request.formData();
		const confirmed = form.get('confirm') === 'yes';
		const thread = await getThread(context, threadOf(event), person.identifier);
		if (!thread) error(404, 'This conversation is not in the inbox.');
		if (confirmed && thread.counterpartAddress) {
			await suppress(context, thread.counterpartAddress, 'asked', { source: 'reply in the inbox', personIdentifier: person.identifier });
		}
		await clearStopRequest(context, person.identifier, thread.identifier, confirmed);
		return { done: confirmed ? `${thread.counterpartAddress} is on the do-not-email list.` : 'Dismissed.' };
	},
	cancel: async (event) => {
		const person = requirePermission(event, 'read-mail');
		const form = await event.request.formData();
		const message = formText(form, 'message', 100);
		if (!message || !(await cancelScheduled(mailContext(), person.identifier, message))) return fail(400, { problem: 'That message can no longer be cancelled.' });
		return { done: 'Cancelled. It will not be sent.' };
	},
	again: async (event) => {
		const person = requirePermission(event, 'read-mail');
		const context = mailContext();
		const form = await event.request.formData();
		const message = formText(form, 'message', 100);
		if (!message || !(await sendAgain(context, person.identifier, message))) return fail(400, { problem: 'That message can no longer be sent again.' });
		const sent = await sendMessage(context, mailCarriers(context), message);
		return sent.sent ? { done: 'Sent.' } : fail(502, { problem: `Not sent: ${sent.error}` });
	}
};
