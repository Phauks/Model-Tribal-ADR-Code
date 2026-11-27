import { error, fail, redirect } from '@sveltejs/kit';
import { mailNations } from 'virtual:mail-nations';
import { composeDefaults, isComposeMode, parseAddressList, type AnsweredMessage, type ComposeMode } from '#lib/mail.ts';
import { can } from '#lib/permissions.ts';
import { afterResponse } from '#lib/server/environment.ts';
import { cancelScheduled, CompositionError, queueMessage, sendAgain, sendMessage, sendWhenPauseEnds } from '#lib/server/mail/outbound.ts';
import { mailCarriers, mailContext } from '#lib/server/mail/runtime.ts';
import { currentTime } from '#lib/server/mail/context.ts';
import {
	addNote,
	assign,
	clearStopRequest,
	getThread,
	isBuiltInFolder,
	markRead,
	moveToFolder,
	setReminder,
	setTag,
	type MessageDetail
} from '#lib/server/mail/store.ts';
import { releaseAttachment } from '#lib/server/mail/scans.ts';
import { blockSender, domainPattern, senderCard, SenderError, unblockSender, unsubscribe } from '#lib/server/mail/senders.ts';
import { suppress } from '#lib/server/mail/suppressions.ts';
import { deleteDraft, draftForThread, getUndoSeconds, undoSend } from '#lib/server/mail/writing.ts';
import { formText } from '#lib/server/workspace.ts';
import { readAttachments, whenFromForm } from '../compose.ts';
import { composerData } from '../composer-data.server.ts';
import type { Actions, PageServerLoad } from './$types';
import { requireThread } from '#lib/server/mail/inbox-access.ts';
import { replyAddresses, threadPeople } from '#lib/server/mail/inboxes.ts';

// One conversation: its messages, notes and history, and the reply box.
export const prerender = false;

/** A message as the composer's defaults need it. */
function answered(message: MessageDetail): AnsweredMessage {
	return {
		direction: message.direction,
		from: message.from,
		to: message.to,
		cc: message.cc,
		replyTo: message.replyTo,
		subject: message.subject,
		text: message.text,
		at: message.receivedAt ?? message.sentAt ?? message.createdAt
	};
}

export const load: PageServerLoad = async (event) => {
	const person = await requireThread(event, event.params.thread);
	const context = mailContext();
	const thread = await getThread(context, event.params.thread, person.identifier);
	if (!thread) error(404, 'This conversation is not in the inbox.');
	if (thread.unread) await markRead(context, person.identifier, thread.identifier, true);

	// The reply box answers one message: the one a Reply, Reply all or Forward button named (?compose=…&message=…), else the latest one received.
	// A draft the person saved here opens instead, unless a button asked for something else.
	const finished = thread.messages.filter((message) => message.status === 'received' || message.status === 'sent');
	const asked = event.url.searchParams.get('compose');
	const draft = await draftForThread(context, person.identifier, thread.identifier);
	const writing = await composerData(context, person.displayName, [thread.counterpartAddress]);
	const card = thread.counterpartAddress
		? await senderCard(context, thread.counterpartAddress, thread.identifier, {
				personIdentifier: person.identifier,
				seesAddressBook: can(person, 'manage-address-book')
			})
		: null;
	// From the inbox address the conversation is with (info@ for mail to info@), unless the writer picks another of theirs (src/lib/server/mail/inboxes.ts).
	const addresses = await replyAddresses(context, person.identifier, thread.inboxIdentifier, thread.projectAddress);
	const people = await threadPeople(context, thread.identifier);
	const nation = card?.contact?.nationIdentifier ? mailNations.find((item) => item.identifier === card.contact!.nationIdentifier) : undefined;
	const sender = card ? { ...card, nation: nation ? { name: nation.name, page: nation.page } : null } : null;
	if (draft && !isComposeMode(asked)) {
		const fields = draft.fields;
		const target = finished.find((message) => message.identifier === fields.message) ?? null;
		return {
			thread,
			people,
			addresses: addresses.sendable,
			compose: {
				mode: fields.mode ?? ('reply' as ComposeMode),
				message: target?.identifier ?? null,
				asked: event.url.searchParams.has('draft'),
				from: fields.from,
				to: fields.to,
				cc: fields.cc,
				bcc: fields.bcc,
				subject: fields.subject,
				text: fields.text,
				quote: '',
				attachments:
					fields.mode === 'forward' && target
						? target.attachments
								.filter((item) => !item.inline)
								.map((item) => ({ identifier: item.identifier, filename: item.filename, size: item.size, held: item.check?.held ?? false, label: item.check?.label ?? null }))
						: [],
				draft: draft.identifier,
				signed: true,
				otherDraft: false
			},
			writing,
			sender,
			canSeeAddressBook: can(person, 'manage-address-book'),
			undone: event.url.searchParams.get('undone'),
			canManage: can(person, 'manage-mail')
		};
	}
	const mode: ComposeMode = isComposeMode(asked) ? asked : 'reply';
	const named = finished.find((message) => message.identifier === event.url.searchParams.get('message'));
	const target = named ?? [...finished].reverse().find((message) => message.direction === 'in') ?? finished.at(-1) ?? null;
	const defaults = target
		? composeDefaults(mode, answered(target), addresses.projectAddresses)
		: { to: thread.counterpartAddress ?? '', cc: '', subject: thread.subject, quote: '' };
	return {
		thread,
		people,
		addresses: addresses.sendable,
		compose: {
			mode,
			message: target?.identifier ?? null,
			/** Whether a button asked for this, so the page can take the writer to the box. */
			asked: named !== undefined || isComposeMode(asked),
			from: addresses.from,
			...defaults,
			bcc: '',
			text: '',
			attachments:
				mode === 'forward' && target
					? target.attachments
							.filter((item) => !item.inline)
							.map((item) => ({ identifier: item.identifier, filename: item.filename, size: item.size, held: item.check?.held ?? false, label: item.check?.label ?? null }))
					: [],
			/** Writing here replaces the draft the person saved in this conversation. */
			draft: draft?.identifier ?? null,
			signed: false,
			otherDraft: draft !== null
		},
		writing,
		sender,
		canSeeAddressBook: can(person, 'manage-address-book'),
		undone: null,
		canManage: can(person, 'manage-mail')
	};
};

function threadOf(event: { params: { thread: string } }): string {
	return event.params.thread;
}

export const actions: Actions = {
	reply: async (event) => {
		const person = await requireThread(event, event.params.thread);
		const context = mailContext();
		const form = await event.request.formData();
		const to = parseAddressList(formText(form, 'to', 4000) ?? '');
		const cc = parseAddressList(formText(form, 'cc', 4000) ?? '');
		const bcc = parseAddressList(formText(form, 'bcc', 4000) ?? '');
		const invalid = [...to.invalid, ...cc.invalid, ...bcc.invalid];
		if (invalid.length) return fail(400, { problem: `These do not look like email addresses: ${invalid.join(', ')}.` });
		const text = formText(form, 'text', 200_000);
		const mode = formText(form, 'mode', 20);
		const message = formText(form, 'message', 100);
		const forward = mode === 'forward' && message ? { message, attachments: form.getAll('forwardAttachment').map(String).filter(Boolean) } : null;
		if (!text && !forward) return fail(400, { problem: 'Write a message first.' });
		const sendAt = whenFromForm(form, 'sendAt');
		try {
			const queued = await queueMessage(context, {
				personIdentifier: person.identifier,
				threadIdentifier: threadOf(event),
				from: formText(form, 'from', 200) ?? '',
				to: to.addresses,
				cc: cc.addresses,
				bcc: bcc.addresses,
				subject: formText(form, 'subject', 500) ?? '(no subject)',
				text: text ?? '',
				attachments: await readAttachments(form),
				links: form.getAll('links').map(String),
				answering: message,
				forward,
				sendAt,
				remindAt: whenFromForm(form, 'remindAt'),
				holdForUndo: sendAt ? 0 : await getUndoSeconds(context)
			});
			await deleteDraft(context, person.identifier, { threadIdentifier: threadOf(event) });
			if (queued.scheduled) return { done: 'Scheduled. It is listed below and in Scheduled until it goes.' };
			if (queued.pause) {
				// It goes when the pause ends, unless Undo pulls it back first (src/lib/server/mail/writing.ts).
				afterResponse(sendWhenPauseEnds(context, mailCarriers(context), queued.messageIdentifier, queued.pause));
				// The page shows the countdown with Undo at the top, so no other words are needed.
				return { paused: true };
			}
			const sent = await sendMessage(context, mailCarriers(context), queued.messageIdentifier);
			if (sent.held) return { done: sent.error };
			return sent.sent ? { done: 'Sent.' } : fail(502, { problem: `Not sent: ${sent.error} The message is kept below; use Send again.` });
		} catch (problem) {
			if (problem instanceof CompositionError) return fail(400, { problem: problem.message });
			throw problem;
		}
	},
	read: async (event) => {
		const person = await requireThread(event, event.params.thread);
		const form = await event.request.formData();
		await markRead(mailContext(), person.identifier, threadOf(event), form.get('read') === 'yes');
		if (form.get('read') !== 'yes') redirect(303, '/workspace/inbox');
		return { done: 'Marked read.' };
	},
	move: async (event) => {
		const person = await requireThread(event, event.params.thread);
		const form = await event.request.formData();
		const folder = formText(form, 'folder', 100);
		if (!folder || !(await moveToFolder(mailContext(), person.identifier, threadOf(event), folder))) return fail(400, { problem: 'Choose a folder.' });
		if (folder === 'archive' || folder === 'trash' || folder === 'spam') redirect(303, '/workspace/inbox');
		return { done: isBuiltInFolder(folder) ? 'Moved to the inbox.' : 'Moved.' };
	},
	assign: async (event) => {
		const person = await requireThread(event, event.params.thread);
		const context = mailContext();
		const form = await event.request.formData();
		const assignee = formText(form, 'assignee', 100);
		const people = await threadPeople(context, threadOf(event));
		const chosen = assignee ? people.find((item) => item.identifier === assignee) : null;
		if (assignee && !chosen) return fail(400, { problem: 'That person is not on this conversation’s inbox.' });
		await assign(context, person.identifier, threadOf(event), chosen?.identifier ?? null, chosen?.name ?? null);
		return { done: chosen ? `Assigned to ${chosen.name}.` : 'Unassigned.' };
	},
	tag: async (event) => {
		const person = await requireThread(event, event.params.thread);
		const form = await event.request.formData();
		const tag = formText(form, 'tag', 100);
		if (!tag) return fail(400, { problem: 'Choose a tag.' });
		await setTag(mailContext(), person.identifier, threadOf(event), tag, form.get('on') === 'yes');
		return { done: form.get('on') === 'yes' ? 'Tagged.' : 'Tag taken off.' };
	},
	remind: async (event) => {
		const person = await requireThread(event, event.params.thread);
		const context = mailContext();
		const form = await event.request.formData();
		const at = form.get('clear') === 'yes' ? null : whenFromForm(form, 'at');
		if (form.get('clear') !== 'yes' && !at) return fail(400, { problem: 'Choose when it should come back.' });
		if (at && new Date(at).getTime() <= currentTime(context).getTime()) return fail(400, { problem: 'Choose a time that has not passed yet.' });
		await setReminder(context, person.identifier, threadOf(event), at);
		return { done: at ? 'Reminder set. It leaves the inbox until then, and comes back sooner if they reply.' : 'Reminder ended.' };
	},
	note: async (event) => {
		const person = await requireThread(event, event.params.thread);
		const form = await event.request.formData();
		const body = formText(form, 'body', 8000);
		if (!body) return fail(400, { problem: 'Write the note first.' });
		await addNote(mailContext(), person.identifier, threadOf(event), body);
		return { done: 'Note added. Only the project team sees notes.' };
	},
	stop: async (event) => {
		const person = await requireThread(event, event.params.thread, 'manage-mail');
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
	release: async (event) => {
		const person = await requireThread(event, event.params.thread, 'manage-mail');
		const form = await event.request.formData();
		const attachment = formText(form, 'attachment', 100);
		const note = formText(form, 'note', 500) ?? '';
		if (!attachment || !(await releaseAttachment(mailContext(), person.identifier, attachment, note))) {
			return fail(400, { problem: 'That file cannot be released: only a file the virus check could not finish can be, never one where something was found.' });
		}
		return { done: 'Released. The file can now be downloaded and forwarded.' };
	},
	block: async (event) => {
		const person = await requireThread(event, event.params.thread, 'manage-mail');
		const context = mailContext();
		const form = await event.request.formData();
		const thread = await getThread(context, threadOf(event), person.identifier);
		if (!thread?.counterpartAddress) return fail(400, { problem: 'This conversation has no sender to block.' });
		const pattern = form.get('whole') === 'domain' ? domainPattern(thread.counterpartAddress) : thread.counterpartAddress;
		try {
			await blockSender(context, person.identifier, pattern, { threadIdentifier: thread.identifier, note: thread.subject });
		} catch (problem) {
			if (problem instanceof SenderError) return fail(400, { problem: problem.message });
			throw problem;
		}
		return { done: `Blocked ${pattern}. This conversation is in Spam, and new mail from ${pattern.startsWith('@') ? 'that domain' : 'this sender'} goes there too. Unblock in Inbox settings.` };
	},
	unblock: async (event) => {
		const person = await requireThread(event, event.params.thread, 'manage-mail');
		const form = await event.request.formData();
		const pattern = formText(form, 'pattern', 300);
		if (!pattern || !(await unblockSender(mailContext(), person.identifier, pattern))) return fail(400, { problem: 'That sender is not blocked.' });
		return { done: `Unblocked ${pattern}. Move this conversation back to the inbox if you want it there.` };
	},
	unsubscribe: async (event) => {
		const person = await requireThread(event, event.params.thread);
		const context = mailContext();
		const form = await event.request.formData();
		const message = formText(form, 'message', 100);
		if (!message) return fail(400, { problem: 'Choose a message.' });
		try {
			const result = await unsubscribe(context, mailCarriers(context), person.identifier, message);
			if (result.how === 'page') return { done: 'This list unsubscribes only on its own web page. Open it below; the conversation is archived.', page: result.page };
			return { done: result.how === 'one-click' ? 'Unsubscribed. The conversation is archived.' : 'Sent the list’s unsubscribe message. The conversation is archived.' };
		} catch (problem) {
			if (problem instanceof SenderError) return fail(400, { problem: problem.message });
			throw problem;
		}
	},
	undo: async (event) => {
		const person = await requireThread(event, event.params.thread);
		const form = await event.request.formData();
		const message = formText(form, 'message', 100);
		const undone = message ? await undoSend(mailContext(), person.identifier, message) : null;
		if (!undone) return fail(400, { problem: 'Too late to undo: the message has gone.' });
		const files = undone.hadAttachments ? 'files' : 'yes';
		if (!undone.threadIdentifier) redirect(303, `/workspace/inbox/new?draft=${undone.draftIdentifier}&undone=${files}`);
		redirect(303, `/workspace/inbox/${undone.threadIdentifier}?draft&undone=${files}#reply`);
	},
	cancel: async (event) => {
		const person = await requireThread(event, event.params.thread);
		const form = await event.request.formData();
		const message = formText(form, 'message', 100);
		if (!message || !(await cancelScheduled(mailContext(), person.identifier, message))) return fail(400, { problem: 'That message can no longer be cancelled.' });
		return { done: 'Cancelled. It will not be sent.' };
	},
	again: async (event) => {
		const person = await requireThread(event, event.params.thread);
		const context = mailContext();
		const form = await event.request.formData();
		const message = formText(form, 'message', 100);
		if (!message || !(await sendAgain(context, person.identifier, message))) return fail(400, { problem: 'That message can no longer be sent again.' });
		const sent = await sendMessage(context, mailCarriers(context), message);
		if (sent.held) return { done: sent.error };
		return sent.sent ? { done: 'Sent.' } : fail(502, { problem: `Not sent: ${sent.error}` });
	}
};
