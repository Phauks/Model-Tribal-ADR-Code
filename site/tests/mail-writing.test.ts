import { describe, expect, it } from 'vitest';
import { fillTemplate, signatureBlock } from '#lib/mail.ts';
import { receiveMail } from '#lib/server/mail/inbound.ts';
import { queueMessage, sendAgain, sendDueMessages, sendMessage, sendWhenPauseEnds } from '#lib/server/mail/outbound.ts';
import { getThread } from '#lib/server/mail/store.ts';
import { suppress } from '#lib/server/mail/suppressions.ts';
import {
	countDrafts,
	defaultUndoSeconds,
	deleteDraft,
	deleteSavedReply,
	draftFieldsFrom,
	draftForThread,
	getAway,
	getDraft,
	getUndoSeconds,
	listDrafts,
	listSavedReplies,
	listSignatures,
	saveAway,
	saveDraft,
	saveSavedReply,
	saveSignature,
	sendAwayReply,
	setUndoSeconds,
	undoSend,
	WritingError
} from '#lib/server/mail/writing.ts';
import { rawMessage, recordingCarrier, testContext } from './mail-fixtures.ts';

const clock = { now: new Date('2026-11-24T17:00:00Z') };
const encoder = new TextEncoder();

function arriving(headers: Record<string, string>, body = 'Hello') {
	return { from: headers.From.replace(/.*<|>.*/g, ''), to: 'contact@example.org', raw: encoder.encode(rawMessage({ To: 'contact@example.org', ...headers }, body)) };
}

const fields = (text: string) => draftFieldsFrom({ from: 'contact@example.org', to: 'office@nation.example', subject: 'Hello', text });

describe('signatures', () => {
	it('keeps one signature for each of the inbox’s addresses, and an empty one takes it away', async () => {
		const context = await testContext(clock);
		await saveSignature(context, 'lead', 'Contact@example.org', 'Lead Author\r\nModel Tribal ADR Code  \n');
		expect(await listSignatures(context)).toEqual({ 'contact@example.org': 'Lead Author\nModel Tribal ADR Code' });
		await saveSignature(context, 'lead', 'contact@example.org', '  ');
		expect(await listSignatures(context)).toEqual({});
		await expect(saveSignature(context, 'lead', 'someone@else.example', 'Hi')).rejects.toThrow(WritingError);
	});

	it('makes a block that starts with the signature mark', () => {
		expect(signatureBlock('Lead Author')).toBe('\n\n-- \nLead Author');
		expect(signatureBlock('')).toBe('');
	});
});

describe('saved replies', () => {
	it('are made, renamed and deleted, with names unique whatever the case', async () => {
		const context = await testContext(clock);
		const identifier = await saveSavedReply(context, 'lead', { name: 'Thanks', body: 'Dear {{ contact.name }},\nThank you.' });
		await expect(saveSavedReply(context, 'lead', { name: 'THANKS', body: 'Other' })).rejects.toThrow('already a saved reply');
		await saveSavedReply(context, 'lead', { identifier, name: 'Thank you', body: 'Dear {{ contact.name }},\nThank you!' });
		expect(await listSavedReplies(context)).toMatchObject([{ identifier, name: 'Thank you', body: 'Dear {{ contact.name }},\nThank you!' }]);
		await deleteSavedReply(context, 'lead', identifier);
		expect(await listSavedReplies(context)).toEqual([]);
	});

	it('refuses fields the site does not know', async () => {
		const context = await testContext(clock);
		await expect(saveSavedReply(context, 'lead', { name: 'Odd', body: 'Hi {{ contact.nickname }}' })).rejects.toThrow('{{ contact.nickname }}');
	});

	it('leaves a field with no value in place when put into a message, so it can be filled by hand', () => {
		const body = 'Dear {{ contact.greeting }}, from {{ sender.name }}';
		expect(fillTemplate(body, { 'sender.name': 'Lead Author' }, { keepMissing: true })).toBe('Dear {{ contact.greeting }}, from Lead Author');
		expect(fillTemplate(body, { 'sender.name': 'Lead Author' })).toBe('Dear , from Lead Author');
	});
});

describe('drafts', () => {
	it('keeps one draft for each person and conversation, and finds a new message’s draft by its identifier', async () => {
		const context = await testContext(clock);
		const arrived = await receiveMail(context, arriving({ From: 'Office <office@nation.example>', Subject: 'A question' }));
		if (arrived.outcome !== 'filed') throw new Error('not filed');
		const first = await saveDraft(context, 'lead', { threadIdentifier: arrived.threadIdentifier, fields: fields('First try') });
		const second = await saveDraft(context, 'lead', { threadIdentifier: arrived.threadIdentifier, fields: fields('Second try') });
		expect(second.identifier).toBe(first.identifier);
		expect((await draftForThread(context, 'lead', arrived.threadIdentifier))?.fields.text).toBe('Second try');

		const fresh = await saveDraft(context, 'lead', { threadIdentifier: null, fields: fields('A new message') });
		const again = await saveDraft(context, 'lead', { identifier: fresh.identifier, threadIdentifier: null, fields: fields('A new message, longer') });
		expect(again.identifier).toBe(fresh.identifier);
		expect((await getDraft(context, 'lead', fresh.identifier))?.fields.text).toBe('A new message, longer');
		expect(await countDrafts(context, 'lead')).toBe(2);
		expect((await listDrafts(context, 'lead')).map((draft) => draft.threadSubject)).toContain('A question');

		await deleteDraft(context, 'lead', { threadIdentifier: arrived.threadIdentifier });
		await deleteDraft(context, 'lead', { identifier: fresh.identifier });
		expect(await countDrafts(context, 'lead')).toBe(0);
	});

	it('keeps drafts to their writer', async () => {
		const context = await testContext(clock);
		await context.database
			.prepare(`INSERT INTO people (identifier, email, display_name, role, status, added_at) VALUES ('other', 'other@example.org', 'Other', 'lead-author', 'active', '2026-11-20T00:00:00Z')`)
			.run();
		const mine = await saveDraft(context, 'lead', { threadIdentifier: null, fields: fields('Mine') });
		expect(await getDraft(context, 'other', mine.identifier)).toBeNull();
		// Saving with someone else's draft's identifier makes a new draft rather than changing theirs.
		const theirs = await saveDraft(context, 'other', { identifier: mine.identifier, threadIdentifier: null, fields: fields('Not yours') });
		expect(theirs.identifier).not.toBe(mine.identifier);
		expect((await getDraft(context, 'lead', mine.identifier))?.fields.text).toBe('Mine');
	});

	it('takes only the known fields, cut to size', () => {
		expect(draftFieldsFrom({ to: 'a@b.example', text: 'x'.repeat(300_000), mode: 'sideways', message: 'not an id!', extra: 1 })).toEqual({
			from: '',
			to: 'a@b.example',
			cc: '',
			bcc: '',
			subject: '',
			text: 'x'.repeat(200_000),
			mode: null,
			message: null
		});
	});
});

describe('undo send', () => {
	it('waits out the pause, then sends once even when the pause ending, Send now and the tick all try', async () => {
		const context = await testContext(clock);
		const carrier = recordingCarrier();
		const carriers = { replies: carrier, outreach: null };
		expect(await getUndoSeconds(context)).toBe(defaultUndoSeconds);
		const queued = await queueMessage(context, {
			personIdentifier: 'lead',
			threadIdentifier: null,
			from: 'contact@example.org',
			to: [{ email: 'office@nation.example' }],
			subject: 'Hello',
			text: 'Words',
			holdForUndo: 10
		});
		expect(queued).toMatchObject({ scheduled: false, pause: 10 });
		const thread = await getThread(context, queued.threadIdentifier, 'lead');
		expect(thread!.messages[0]).toMatchObject({ status: 'scheduled', undoUntil: '2026-11-24T17:00:10.000Z' });
		// Not in Scheduled: it is about to go.
		expect(thread!.scheduledFor).toBeNull();

		expect(await sendDueMessages(context, carriers)).toBe(0);
		await sendAgain(context, 'lead', queued.messageIdentifier);
		expect((await sendMessage(context, carriers, queued.messageIdentifier)).sent).toBe(true);
		expect((await sendMessage(context, carriers, queued.messageIdentifier)).sent).toBe(false);
		await sendWhenPauseEnds(context, carriers, queued.messageIdentifier, 0);
		expect(carrier.sent).toHaveLength(1);
	});

	it('leaves a message another run is sending alone, unless that run stopped ten minutes ago', async () => {
		const at = { now: new Date('2026-11-24T17:00:00Z') };
		const context = await testContext(at);
		const carriers = { replies: recordingCarrier(), outreach: null };
		const queued = await queueMessage(context, { personIdentifier: 'lead', threadIdentifier: null, from: 'contact@example.org', to: [{ email: 'a@b.example' }], subject: 'S', text: 'T' });
		await context.database.prepare(`UPDATE mail_messages SET claimed_at = ? WHERE identifier = ?`).bind(at.now.toISOString(), queued.messageIdentifier).run();
		expect((await sendMessage(context, carriers, queued.messageIdentifier)).sent).toBe(false);
		at.now = new Date('2026-11-24T17:11:00Z');
		expect((await sendMessage(context, carriers, queued.messageIdentifier)).sent).toBe(true);
	});

	it('pulls a reply back into the conversation’s draft, and a new message back into a draft of its own', async () => {
		const context = await testContext(clock);
		const arrived = await receiveMail(context, arriving({ From: 'Office <office@nation.example>', Subject: 'A question', 'Message-ID': '<q@nation.example>' }));
		if (arrived.outcome !== 'filed') throw new Error('not filed');
		const reply = await queueMessage(context, {
			personIdentifier: 'lead',
			threadIdentifier: arrived.threadIdentifier,
			from: 'contact@example.org',
			to: [{ email: 'office@nation.example' }],
			cc: [{ email: 'clerk@nation.example' }],
			subject: 'Re: A question',
			text: 'Our answer',
			holdForUndo: 5
		});
		const undone = await undoSend(context, 'lead', reply.messageIdentifier);
		expect(undone).toMatchObject({ threadIdentifier: arrived.threadIdentifier, hadAttachments: false });
		expect((await draftForThread(context, 'lead', arrived.threadIdentifier))?.fields).toMatchObject({
			to: 'office@nation.example',
			cc: 'clerk@nation.example',
			text: 'Our answer',
			mode: 'reply',
			message: arrived.messageIdentifier
		});
		// Too late twice: it is already pulled back.
		expect(await undoSend(context, 'lead', reply.messageIdentifier)).toBeNull();
		expect((await getThread(context, arrived.threadIdentifier, 'lead'))!.messages).toHaveLength(1);

		const fresh = await queueMessage(context, {
			personIdentifier: 'lead',
			threadIdentifier: null,
			from: 'contact@example.org',
			to: [{ email: 'office@nation.example' }],
			subject: 'New',
			text: 'Words',
			attachments: [{ filename: 'a.txt', mediaType: 'text/plain', content: encoder.encode('file') }],
			holdForUndo: 5
		});
		const back = await undoSend(context, 'lead', fresh.messageIdentifier);
		expect(back).toMatchObject({ threadIdentifier: null, hadAttachments: true });
		expect(await getThread(context, fresh.threadIdentifier, 'lead')).toBeNull();
		expect([...context.bucket.files.keys()].some((key) => key.includes(fresh.messageIdentifier))).toBe(false);
		expect((await getDraft(context, 'lead', back!.draftIdentifier))?.fields).toMatchObject({ subject: 'New', text: 'Words', mode: null });
	});

	it('cannot pull back a message that has gone', async () => {
		const context = await testContext(clock);
		const queued = await queueMessage(context, { personIdentifier: 'lead', threadIdentifier: null, from: 'contact@example.org', to: [{ email: 'a@b.example' }], subject: 'S', text: 'T', holdForUndo: 5 });
		await sendWhenPauseEnds(context, { replies: recordingCarrier(), outreach: null }, queued.messageIdentifier, 0);
		expect(await undoSend(context, 'lead', queued.messageIdentifier)).toBeNull();
	});

	it('offers only the listed pauses', async () => {
		const context = await testContext(clock);
		await setUndoSeconds(context, 'lead', 0);
		expect(await getUndoSeconds(context)).toBe(0);
		await expect(setUndoSeconds(context, 'lead', 45)).rejects.toThrow(WritingError);
	});
});

describe('the away message', () => {
	async function awayContext() {
		const context = await testContext(clock);
		await saveSignature(context, 'lead', 'contact@example.org', 'The project team');
		await saveAway(context, 'lead', { on: true, from: null, until: '2026-12-01T15:00:00Z', subject: '', text: 'We are away until December 1.' });
		return context;
	}

	it('answers each person once, with the headers that stop a loop, and records it in the conversation', async () => {
		const context = await awayContext();
		const carrier = recordingCarrier();
		const carriers = { replies: carrier, outreach: null };
		const first = await receiveMail(context, arriving({ From: 'Office <office@nation.example>', Subject: 'A question', 'Message-ID': '<q@nation.example>' }));
		if (first.outcome !== 'filed') throw new Error('not filed');
		expect(first.answerable).toBe(true);
		expect(await sendAwayReply(context, carriers, first)).toBe(true);
		expect(carrier.sent[0]).toMatchObject({
			to: [{ email: 'office@nation.example' }],
			subject: 'Re: A question',
			text: 'We are away until December 1.\n\n-- \nThe project team',
			headers: { 'Auto-Submitted': 'auto-replied', 'X-Auto-Response-Suppress': 'All', 'In-Reply-To': '<q@nation.example>' }
		});
		const thread = await getThread(context, first.threadIdentifier, 'lead');
		expect(thread!.messages.at(-1)).toMatchObject({ direction: 'out', status: 'sent', automatic: true, sentByName: null });

		const second = await receiveMail(context, arriving({ From: 'office@nation.example', Subject: 'One more thing' }));
		if (second.outcome !== 'filed') throw new Error('not filed');
		expect(await sendAwayReply(context, carriers, second)).toBe(false);
		expect(carrier.sent).toHaveLength(1);
	});

	it('never answers automatic replies, mailing lists, machines, or the do-not-email list', async () => {
		const context = await awayContext();
		const carriers = { replies: recordingCarrier(), outreach: null };
		const automatic = await receiveMail(context, arriving({ From: 'a@one.example', Subject: 'Out of office', 'Auto-Submitted': 'auto-replied' }));
		const list = await receiveMail(context, arriving({ From: 'news@two.example', Subject: 'Newsletter', 'List-Id': '<news.two.example>' }));
		expect(automatic).toMatchObject({ answerable: false });
		expect(list).toMatchObject({ answerable: false });
		const machine = await receiveMail(context, arriving({ From: 'no-reply@three.example', Subject: 'Your receipt' }));
		if (machine.outcome !== 'filed') throw new Error('not filed');
		expect(await sendAwayReply(context, carriers, machine)).toBe(false);
		await suppress(context, 'stop@four.example', 'asked', { source: 'test' });
		const stopped = await receiveMail(context, arriving({ From: 'stop@four.example', Subject: 'Hello again' }));
		if (stopped.outcome !== 'filed') throw new Error('not filed');
		expect(await sendAwayReply(context, carriers, stopped)).toBe(false);
		expect(carriers.replies.sent).toHaveLength(0);
	});

	it('stays quiet outside its dates and when off, and starts a new round when switched on again', async () => {
		const context = await awayContext();
		const carriers = { replies: recordingCarrier(), outreach: null };
		const first = await receiveMail(context, arriving({ From: 'office@nation.example', Subject: 'Hi' }));
		if (first.outcome !== 'filed') throw new Error('not filed');
		expect(await sendAwayReply(context, carriers, first)).toBe(true);
		await saveAway(context, 'lead', { on: false, from: null, until: null, subject: '', text: 'We are away until December 1.' });
		expect(await sendAwayReply(context, carriers, first)).toBe(false);
		await saveAway(context, 'lead', { on: true, from: '2026-11-25T00:00:00Z', until: null, subject: 'Away', text: 'We are away.' });
		expect(await sendAwayReply(context, carriers, first)).toBe(false);
		clock.now = new Date('2026-11-25T01:00:00Z');
		try {
			expect(await sendAwayReply(context, carriers, first)).toBe(true);
			expect(carriers.replies.sent.at(-1)).toMatchObject({ subject: 'Away' });
		} finally {
			clock.now = new Date('2026-11-24T17:00:00Z');
		}
		expect((await getAway(context)).since).toBe('2026-11-24T17:00:00.000Z');
		await expect(saveAway(context, 'lead', { on: true, from: null, until: null, subject: '', text: ' ' })).rejects.toThrow(WritingError);
	});
});
