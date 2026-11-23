import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { receiveMail } from '#lib/server/mail/inbound.ts';
import { mailRunHeader, mailRunTokenKey } from '#lib/server/mail/internal-run.ts';
import { CompositionError, queueMessage, recordDeliveryEvent, sendDueMessages, sendMessage } from '#lib/server/mail/outbound.ts';
import {
	addRecipients,
	addressBookRecipients,
	createBatch,
	fieldsFor,
	insideWindow,
	runOutreach,
	saveTemplate,
	setBatchStatus,
	templateVersions,
	timeZoneForStates,
	unsubscribeWithToken
} from '#lib/server/mail/outreach.ts';
import { bringBackReminders, getThread, listThreads, moveToFolder, purgeDeleted, setReminder } from '#lib/server/mail/store.ts';
import { composeDefaults, heldForVirusCheck, replyAllReach, type AnsweredMessage } from '#lib/mail.ts';
import { releaseAttachment } from '#lib/server/mail/scans.ts';
import { isSuppressed, suppress } from '#lib/server/mail/suppressions.ts';
import { makeToken } from '#lib/server/mail/tokens.ts';
import { addAddressBook, addContact, rawMessage, recordingCarrier, testContext, testSettings } from './mail-fixtures.ts';
import { entrySource, mailCron, mailRunHeader as toolHeader, mailRunTokenKey as toolKey } from '../tools/add-mail-handlers.mjs';

const clock = { now: new Date('2026-11-24T17:00:00Z') };
const encoder = new TextEncoder();

function arriving(raw: string, to = 'contact@example.org', from = 'office@nation.example') {
	return { from, to, raw: encoder.encode(raw) };
}

const firstLetter = rawMessage(
	{
		From: 'Tribal Office <office@nation.example>',
		To: 'contact@example.org',
		Subject: 'A question about the model code',
		'Message-ID': '<first@nation.example>',
		Date: 'Tue, 24 Nov 2026 10:00:00 -0700'
	},
	'Hello,\nCould you tell us more about the peacemaking provisions?'
);

describe('mail arriving', () => {
	it('files a new message in a new conversation, keeping it whole in the bucket', async () => {
		const context = await testContext(clock);
		const result = await receiveMail(context, arriving(firstLetter));
		expect(result).toMatchObject({ outcome: 'filed', spam: false, automatic: false, notify: true });
		if (result.outcome !== 'filed') return;
		const thread = await getThread(context, result.threadIdentifier, 'lead');
		expect(thread).toMatchObject({ subject: 'A question about the model code', counterpartAddress: 'office@nation.example', counterpartName: 'Tribal Office', folder: 'inbox', unread: true });
		expect(thread!.messages[0].text).toContain('peacemaking provisions');
		expect([...context.bucket.files.keys()].some((key) => key.startsWith('mail/raw/2026/11/'))).toBe(true);
		// A second message within 30 minutes sends no second notice.
		const again = await receiveMail(context, arriving(rawMessage({ From: 'other@else.example', To: 'contact@example.org', Subject: 'Other' }, 'Hi')));
		expect(again).toMatchObject({ notify: false });
	});

	it('threads a reply by its headers, and by subject and sender when the headers are gone', async () => {
		const context = await testContext(clock);
		const first = await receiveMail(context, arriving(firstLetter));
		const reply = await receiveMail(
			context,
			arriving(rawMessage({ From: 'office@nation.example', To: 'contact@example.org', Subject: 'Re: something else', 'In-Reply-To': '<first@nation.example>' }, 'More'))
		);
		const bySubject = await receiveMail(context, arriving(rawMessage({ From: 'office@nation.example', To: 'contact@example.org', Subject: 'RE: A question about the model code' }, 'Again')));
		expect(first.outcome === 'filed' && reply.outcome === 'filed' && bySubject.outcome === 'filed').toBe(true);
		if (first.outcome !== 'filed' || reply.outcome !== 'filed' || bySubject.outcome !== 'filed') return;
		expect(reply.threadIdentifier).toBe(first.threadIdentifier);
		expect(bySubject.threadIdentifier).toBe(first.threadIdentifier);
		expect((await getThread(context, first.threadIdentifier, 'lead'))!.messageCount).toBe(3);
	});

	it('puts mail that fails the sender’s DMARC check in Spam', async () => {
		const context = await testContext(clock);
		const result = await receiveMail(
			context,
			arriving(rawMessage({ From: 'ceo@bank.example', To: 'contact@example.org', Subject: 'Urgent', 'Authentication-Results': 'mx.cloudflare.net; dmarc=fail header.from=bank.example' }, 'Pay now'))
		);
		expect(result).toMatchObject({ outcome: 'filed', spam: true, notify: false });
		const spam = await listThreads(context, { view: 'spam', personIdentifier: 'lead' });
		expect(spam.threads).toHaveLength(1);
	});

	it('flags a reply that asks to stop, for a person to confirm', async () => {
		const context = await testContext(clock);
		const result = await receiveMail(context, arriving(rawMessage({ From: 'office@nation.example', To: 'contact@example.org', Subject: 'Re: Hello' }, 'Stop.\n\n> earlier')));
		if (result.outcome !== 'filed') throw new Error('not filed');
		expect((await getThread(context, result.threadIdentifier, 'lead'))!.stopRequested).toBe(true);
		expect(await isSuppressed(context, 'office@nation.example')).toBe(false);
	});

	it('keeps attachments, and refuses all mail while email is off', async () => {
		const context = await testContext(clock);
		const raw = [
			'From: office@nation.example',
			'To: contact@example.org',
			'Subject: Our ordinance',
			'MIME-Version: 1.0',
			'Content-Type: multipart/mixed; boundary="b"',
			'',
			'--b',
			'Content-Type: text/plain',
			'',
			'Attached.',
			'--b',
			'Content-Type: application/pdf; name="ordinance.pdf"',
			'Content-Disposition: attachment; filename="ordinance.pdf"',
			'Content-Transfer-Encoding: base64',
			'',
			btoa('%PDF-1.7 pretend'),
			'--b--',
			''
		].join('\r\n');
		const result = await receiveMail(context, arriving(raw));
		if (result.outcome !== 'filed') throw new Error('not filed');
		const thread = await getThread(context, result.threadIdentifier, 'lead');
		expect(thread!.messages[0].attachments).toEqual([expect.objectContaining({ filename: 'ordinance.pdf', mediaType: 'application/pdf', inline: false })]);
		const off = await receiveMail({ ...context, settings: testSettings({ domain: null }) }, arriving(firstLetter));
		expect(off).toEqual({ outcome: 'rejected', reason: 'This address is not taking mail yet.' });
	});
});

describe('mail going out', () => {
	it('sends a reply in the conversation with threading headers, and keeps a copy', async () => {
		const context = await testContext(clock);
		const carrier = recordingCarrier();
		const first = await receiveMail(context, arriving(firstLetter));
		if (first.outcome !== 'filed') throw new Error('not filed');
		const queued = await queueMessage(context, {
			personIdentifier: 'lead',
			threadIdentifier: first.threadIdentifier,
			from: 'contact@example.org',
			to: [{ email: 'office@nation.example' }],
			subject: 'Re: A question about the model code',
			text: 'Thank you for asking.',
			remindAt: '2026-12-01T17:00:00Z'
		});
		const sent = await sendMessage(context, { replies: carrier, outreach: null }, queued.messageIdentifier);
		expect(sent).toEqual({ sent: true });
		expect(carrier.sent[0].headers).toMatchObject({ 'In-Reply-To': '<first@nation.example>', References: '<first@nation.example>' });
		expect(carrier.sent[0].html).toContain('<p>Thank you for asking.</p>');
		const thread = await getThread(context, first.threadIdentifier, 'lead');
		expect(thread!.messages[1]).toMatchObject({ status: 'sent', carrier: 'cloudflare', messageId: 'provider-1@cloudflare.example' });
		expect(thread!.remindAt).toBe('2026-12-01T17:00:00.000Z');
		// Waiting on the reminder, it is out of the Inbox list and in Reminders.
		expect((await listThreads(context, { view: 'inbox', personIdentifier: 'lead' })).threads).toHaveLength(0);
		expect((await listThreads(context, { view: 'reminders', personIdentifier: 'lead' })).threads).toHaveLength(1);
		// Sending the same message again does nothing.
		expect((await sendMessage(context, { replies: carrier, outreach: null }, queued.messageIdentifier)).sent).toBe(false);
		// Their answer ends the reminder and brings the conversation back; an automatic reply does neither.
		clock.now = new Date('2026-11-25T17:00:00Z');
		await receiveMail(context, arriving(rawMessage({ From: 'office@nation.example', To: 'contact@example.org', Subject: 'Automatic reply: Re: A question', 'Auto-Submitted': 'auto-replied', 'In-Reply-To': '<provider-1@cloudflare.example>' }, 'Away')));
		expect((await getThread(context, first.threadIdentifier, 'lead'))!.remindAt).not.toBeNull();
		expect((await listThreads(context, { view: 'inbox', personIdentifier: 'lead' })).threads).toHaveLength(0);
		await receiveMail(context, arriving(rawMessage({ From: 'office@nation.example', To: 'contact@example.org', Subject: 'Re: A question', 'In-Reply-To': '<provider-1@cloudflare.example>' }, 'Thanks!')));
		expect((await getThread(context, first.threadIdentifier, 'lead'))!.remindAt).toBeNull();
		expect((await listThreads(context, { view: 'inbox', personIdentifier: 'lead' })).threads).toHaveLength(1);
		clock.now = new Date('2026-11-24T17:00:00Z');
	});

	it('holds a scheduled message until its time, then sends it', async () => {
		const context = await testContext(clock);
		const carrier = recordingCarrier();
		const queued = await queueMessage(context, {
			personIdentifier: 'lead',
			threadIdentifier: null,
			from: 'contact@example.org',
			to: [{ email: 'advisor@school.example' }],
			subject: 'Draft for review',
			text: 'Here it is.',
			sendAt: '2026-11-25T15:00:00Z'
		});
		expect(queued.scheduled).toBe(true);
		expect(await sendDueMessages(context, { replies: carrier, outreach: null })).toBe(0);
		expect((await listThreads(context, { view: 'scheduled', personIdentifier: 'lead' })).threads).toHaveLength(1);
		const later = { ...context, now: () => new Date('2026-11-25T15:01:00Z') };
		expect(await sendDueMessages(later, { replies: carrier, outreach: null })).toBe(1);
		expect(carrier.sent[0].subject).toBe('Draft for review');
	});

	it('refuses a new message to an address on the do-not-email list, and records sending failures', async () => {
		const context = await testContext(clock);
		await suppress(context, 'gone@nation.example', 'unsubscribed');
		await expect(
			queueMessage(context, { personIdentifier: 'lead', threadIdentifier: null, from: 'contact@example.org', to: [{ email: 'gone@nation.example' }], subject: 'Hi', text: 'Hi' })
		).rejects.toBeInstanceOf(CompositionError);
		await expect(
			queueMessage(context, { personIdentifier: 'lead', threadIdentifier: null, from: 'someone@else.example', to: [{ email: 'a@b.example' }], subject: 'Hi', text: 'Hi' })
		).rejects.toBeInstanceOf(CompositionError);
		const carrier = recordingCarrier();
		carrier.failWith = new Error('Sending domain not verified');
		const queued = await queueMessage(context, { personIdentifier: 'lead', threadIdentifier: null, from: 'contact@example.org', to: [{ email: 'a@b.example' }], subject: 'Hi', text: 'Hi' });
		expect(await sendMessage(context, { replies: carrier, outreach: null }, queued.messageIdentifier)).toEqual({ sent: false, error: 'Sending domain not verified' });
		const thread = await getThread(context, queued.threadIdentifier, 'lead');
		expect(thread!.messages[0]).toMatchObject({ status: 'failed', error: 'Sending domain not verified' });
	});

	it('records Cloudflare’s delivery events, and stops mail to a hard bounce', async () => {
		const context = await testContext(clock);
		const carrier = recordingCarrier();
		const queued = await queueMessage(context, { personIdentifier: 'lead', threadIdentifier: null, from: 'contact@example.org', to: [{ email: 'old@nation.example' }], subject: 'Hi', text: 'Hi' });
		await sendMessage(context, { replies: carrier, outreach: null }, queued.messageIdentifier);
		const event = (status: string, extra: object = {}) => ({
			type: `cf.email.sending.message.${status}`,
			source: { type: 'email.sending', domain: 'example.org' },
			payload: { messageId: 'provider-1@cloudflare.example', recipient: 'old@nation.example', delivery: { status, smtpResponse: '550 5.1.1 User unknown' }, ...extra },
			metadata: { eventTimestamp: '2026-11-24T17:01:00Z' }
		});
		expect(await recordDeliveryEvent(context, event('bounced', { bounce: { type: 'hard' } }))).toBe(true);
		expect(await recordDeliveryEvent(context, event('deferred'))).toBe(true);
		expect(await recordDeliveryEvent(context, { type: 'something.else' })).toBe(false);
		const thread = await getThread(context, queued.threadIdentifier, 'lead');
		expect(thread!.messages[0]).toMatchObject({ deliveryStatus: 'bounced', deliveryDetail: '550 5.1.1 User unknown' });
		expect(await isSuppressed(context, 'old@nation.example')).toBe(true);
	});

	it('reads a bounce report that comes back as mail', async () => {
		const context = await testContext(clock);
		const carrier = recordingCarrier('smtp');
		await addAddressBook(context.database);
		await addContact(context.database, { identifier: 'c1', name: 'Example Office', nation: 'example-nation', email: 'office@nation.example' });
		const queued = await queueMessage(context, { personIdentifier: 'lead', threadIdentifier: null, from: 'contact@example.org', to: [{ email: 'office@nation.example' }], subject: 'Hi', text: 'Hi' });
		await sendMessage(context, { replies: carrier, outreach: null }, queued.messageIdentifier);
		const messageId = carrier.sent[0].messageId;
		const report = [
			'From: Mail Delivery System <MAILER-DAEMON@mx.example.net>',
			'To: contact@example.org',
			'Subject: Undelivered Mail Returned to Sender',
			'MIME-Version: 1.0',
			'Content-Type: multipart/report; report-type=delivery-status; boundary="r"',
			'',
			'--r',
			'Content-Type: text/plain',
			'',
			'Your message could not be delivered.',
			'--r',
			'Content-Type: message/delivery-status',
			'',
			'Reporting-MTA: dns; mx.example.net',
			'',
			'Final-Recipient: rfc822; office@nation.example',
			'Action: failed',
			'Status: 5.1.1',
			'Diagnostic-Code: smtp; 550 5.1.1 No such user',
			'--r',
			'Content-Type: text/rfc822-headers',
			'',
			`Message-ID: <${messageId}>`,
			'Subject: Hi',
			'--r--',
			''
		].join('\r\n');
		const result = await receiveMail(context, arriving(report, 'contact@example.org', ''));
		expect(result).toMatchObject({ outcome: 'filed', automatic: true, notify: false });
		const thread = await getThread(context, queued.threadIdentifier, 'lead');
		expect(thread!.messages[0]).toMatchObject({ deliveryStatus: 'bounced', deliveryDetail: 'smtp; 550 5.1.1 No such user' });
		expect(await isSuppressed(context, 'office@nation.example')).toBe(true);
		const method = await context.database.prepare(`SELECT status, preferred FROM contact_methods WHERE identifier = 'c1-email'`).first();
		expect(method).toEqual({ status: 'bounced', preferred: 0 });
		const change = await context.database.prepare(`SELECT change FROM contact_changes WHERE method_identifier = 'c1-email'`).first();
		expect(change).toEqual({ change: 'Marked bounced' });
	});
});

describe('reply, reply all and forward', () => {
	const letter: AnsweredMessage = {
		direction: 'in',
		from: { email: 'office@nation.example', name: 'Tribal Office' },
		to: [{ email: 'contact@example.org' }, { email: 'judge@nation.example', name: 'Judge' }],
		cc: [{ email: 'clerk@nation.example' }, { email: 'office@nation.example' }],
		replyTo: null,
		subject: 'Re: Our ordinance',
		text: 'See the ordinance.',
		at: '2026-11-24T17:00:00Z'
	};
	const own = ['contact@example.org', 'requests@example.org'];

	it('answers the sender, or everyone but the project, or forwards with the message below', () => {
		expect(composeDefaults('reply', letter, own)).toMatchObject({ to: 'Tribal Office <office@nation.example>', cc: '', subject: 'Re: Our ordinance' });
		expect(composeDefaults('reply', letter, own).quote).toContain('> See the ordinance.');
		expect(composeDefaults('all', letter, own)).toMatchObject({ to: 'Tribal Office <office@nation.example>', cc: 'Judge <judge@nation.example>, clerk@nation.example' });
		expect(replyAllReach(letter, own)).toBe(3);
		expect(composeDefaults('reply', { ...letter, replyTo: 'Desk <desk@nation.example>' }, own).to).toBe('Desk <desk@nation.example>');
		const forward = composeDefaults('forward', letter, own);
		expect(forward).toMatchObject({ to: '', cc: '', subject: 'Fwd: Re: Our ordinance' });
		expect(forward.quote).toContain('---------- Forwarded message ----------\nFrom: Tribal Office <office@nation.example>');
		expect(forward.quote).toContain('Cc: clerk@nation.example, office@nation.example\n\nSee the ordinance.');
		expect(composeDefaults('forward', { ...letter, subject: 'Fwd: x' }, own).subject).toBe('Fwd: x');
		// A message the project sent is answered to the same people again.
		const sent: AnsweredMessage = { ...letter, direction: 'out', from: { email: 'contact@example.org' }, to: [{ email: 'office@nation.example' }], cc: [{ email: 'clerk@nation.example' }] };
		expect(composeDefaults('reply', sent, own)).toMatchObject({ to: 'office@nation.example', cc: '' });
		expect(composeDefaults('all', sent, own)).toMatchObject({ to: 'office@nation.example', cc: 'clerk@nation.example' });
		expect(replyAllReach({ ...letter, to: [{ email: 'contact@example.org' }], cc: [] }, own)).toBe(1);
	});

	it('answers the chosen message, and forwards with its attachments without threading or past the do-not-email list', async () => {
		const context = await testContext(clock);
		const carrier = recordingCarrier();
		const first = await receiveMail(context, arriving(firstLetter));
		if (first.outcome !== 'filed') throw new Error('not filed');
		const withFile = [
			'From: office@nation.example',
			'To: contact@example.org',
			'Subject: Re: A question about the model code',
			'Message-ID: <second@nation.example>',
			'In-Reply-To: <first@nation.example>',
			'MIME-Version: 1.0',
			'Content-Type: multipart/mixed; boundary="b"',
			'',
			'--b',
			'Content-Type: text/plain',
			'',
			'Attached.',
			'--b',
			'Content-Type: application/pdf; name="ordinance.pdf"',
			'Content-Disposition: attachment; filename="ordinance.pdf"',
			'Content-Transfer-Encoding: base64',
			'',
			btoa('%PDF-1.7 pretend'),
			'--b--',
			''
		].join('\r\n');
		await receiveMail(context, arriving(withFile));
		const thread = await getThread(context, first.threadIdentifier, 'lead');
		const [older, newer] = thread!.messages;
		// A received attachment is held until the virus check passes.
		expect(newer.attachments[0].check).toMatchObject({ held: true, label: 'Waiting for the virus check', releasable: false });
		const held = {
			personIdentifier: 'lead',
			threadIdentifier: first.threadIdentifier,
			from: 'contact@example.org',
			to: [{ email: 'advisor@law.example' }],
			subject: 'Fwd: x',
			text: '',
			forward: { message: newer.identifier, attachments: newer.attachments.map((item) => item.identifier) }
		};
		await expect(queueMessage(context, held)).rejects.toThrow('held until the virus check passes');
		// One that could not be checked can be released by hand; one where something was found never can.
		await context.database.prepare(`UPDATE file_scans SET status = 'flagged', reason = 'Eicar-Test-Signature'`).run();
		expect(await releaseAttachment(context, 'lead', newer.attachments[0].identifier, 'from the court')).toBe(false);
		await context.database.prepare(`UPDATE file_scans SET status = 'cannot-scan', reason = 'encrypted'`).run();
		expect((await getThread(context, first.threadIdentifier, 'lead'))!.messages[1].attachments[0].check).toMatchObject({ held: true, releasable: true });
		expect(await releaseAttachment(context, 'lead', newer.attachments[0].identifier, 'the court sent the password by phone')).toBe(true);
		expect((await getThread(context, first.threadIdentifier, 'lead'))!.messages[1].attachments[0].check).toMatchObject({ held: false });

		const reply = await queueMessage(context, {
			personIdentifier: 'lead',
			threadIdentifier: first.threadIdentifier,
			from: 'contact@example.org',
			to: [{ email: 'office@nation.example' }],
			subject: 'Re: A question about the model code',
			text: 'On your first message: yes.',
			answering: older.identifier
		});
		await sendMessage(context, { replies: carrier, outreach: null }, reply.messageIdentifier);
		expect(carrier.sent[0].headers).toMatchObject({ 'In-Reply-To': '<first@nation.example>' });

		const forward = await queueMessage(context, {
			personIdentifier: 'lead',
			threadIdentifier: first.threadIdentifier,
			from: 'contact@example.org',
			to: [{ email: 'advisor@law.example' }],
			subject: 'Fwd: Re: A question about the model code',
			text: 'For your review.',
			forward: { message: newer.identifier, attachments: newer.attachments.map((item) => item.identifier) }
		});
		expect(forward.threadIdentifier).toBe(first.threadIdentifier);
		// The forwarded copy is a file going out: the message waits until it passes the virus check.
		expect(await sendMessage(context, { replies: carrier, outreach: null }, forward.messageIdentifier)).toMatchObject({ sent: false, held: true });
		expect(carrier.sent).toHaveLength(1);
		const waiting = (await getThread(context, first.threadIdentifier, 'lead'))!.messages.find((item) => item.identifier === forward.messageIdentifier)!;
		expect(waiting).toMatchObject({ status: 'scheduled', error: heldForVirusCheck });
		await context.database.prepare(`UPDATE file_scans SET status = 'clean' WHERE purpose = 'mail-outgoing'`).run();
		await sendMessage(context, { replies: carrier, outreach: null }, forward.messageIdentifier);
		expect(carrier.sent[1].headers?.['In-Reply-To']).toBeUndefined();
		expect(carrier.sent[1].attachments?.map((item) => [item.filename, new TextDecoder().decode(item.content)])).toEqual([['ordinance.pdf', '%PDF-1.7 pretend']]);
		expect((await getThread(context, first.threadIdentifier, 'lead'))!.actions.map((item) => item.action)).toContain('Forwarded');

		// A file the team attaches where the check finds something is never sent.
		const attached = await queueMessage(context, {
			personIdentifier: 'lead',
			threadIdentifier: first.threadIdentifier,
			from: 'contact@example.org',
			to: [{ email: 'office@nation.example' }],
			subject: 'Re: A question about the model code',
			text: 'The draft is attached.',
			attachments: [{ filename: 'draft.docx', mediaType: 'application/octet-stream', content: new TextEncoder().encode('pretend') }]
		});
		await context.database
			.prepare(`UPDATE file_scans SET status = 'flagged', reason = 'Eicar-Test-Signature' WHERE subject = ?`)
			.bind(attached.messageIdentifier)
			.run();
		expect(await sendMessage(context, { replies: carrier, outreach: null }, attached.messageIdentifier)).toMatchObject({
			sent: false,
			error: expect.stringContaining('Eicar-Test-Signature')
		});
		expect(carrier.sent).toHaveLength(2);

		await suppress(context, 'gone@law.example', 'asked');
		await expect(
			queueMessage(context, {
				personIdentifier: 'lead',
				threadIdentifier: first.threadIdentifier,
				from: 'contact@example.org',
				to: [{ email: 'gone@law.example' }],
				subject: 'Fwd: x',
				text: '',
				forward: { message: newer.identifier, attachments: [] }
			})
		).rejects.toThrow(CompositionError);
	});
});

describe('the inbox’s views', () => {
	it('finds conversations by words, keeps reminded ones out of the inbox until their time, and empties Deleted after 30 days', async () => {
		const context = await testContext(clock);
		const first = await receiveMail(context, arriving(firstLetter));
		await receiveMail(context, arriving(rawMessage({ From: 'b@else.example', To: 'contact@example.org', Subject: 'Gaming compact' }, 'About the compact')));
		if (first.outcome !== 'filed') throw new Error('not filed');
		expect((await listThreads(context, { view: 'inbox', personIdentifier: 'lead', search: 'peacemak' })).threads.map((item) => item.identifier)).toEqual([first.threadIdentifier]);
		expect((await listThreads(context, { view: 'inbox', personIdentifier: 'lead', search: 'office@nation.example "' })).threads).toHaveLength(1);

		await setReminder(context, 'lead', first.threadIdentifier, '2026-11-25T00:00:00Z');
		expect((await listThreads(context, { view: 'inbox', personIdentifier: 'lead' })).threads).toHaveLength(1);
		expect((await listThreads(context, { view: 'reminders', personIdentifier: 'lead' })).threads).toHaveLength(1);
		const later = { ...context, now: () => new Date('2026-11-25T00:05:00Z') };
		expect(await bringBackReminders(later)).toBe(1);
		expect((await listThreads(later, { view: 'inbox', personIdentifier: 'lead' })).threads).toHaveLength(2);
		expect((await getThread(later, first.threadIdentifier, 'lead'))!.actions.map((item) => item.action)).toContain('Back in the inbox: the reminder came due');

		// An archived conversation with a reminder comes back to the inbox too; moving it to Deleted ends the reminder.
		await setReminder(context, 'lead', first.threadIdentifier, '2026-11-26T00:00:00Z');
		await moveToFolder(context, 'lead', first.threadIdentifier, 'archive');
		const after = { ...context, now: () => new Date('2026-11-26T00:05:00Z') };
		expect(await bringBackReminders(after)).toBe(1);
		expect((await getThread(after, first.threadIdentifier, 'lead'))!.folder).toBe('inbox');
		await setReminder(context, 'lead', first.threadIdentifier, '2026-11-27T00:00:00Z');

		await moveToFolder(context, 'lead', first.threadIdentifier, 'trash');
		expect((await getThread(context, first.threadIdentifier, 'lead'))!.remindAt).toBeNull();
		const keys = context.bucket.files.size;
		await context.database.prepare(`INSERT INTO file_scans (object_key, purpose, status, requested_at) VALUES ('mail/attachments/gone', 'mail-attachment', 'clean', '2026-11-24T00:00:00Z')`).run();
		await context.database.prepare(`INSERT INTO mail_attachments (identifier, message_identifier, filename, media_type, size, inline, bucket_key) SELECT 'gone', identifier, 'a.txt', 'text/plain', 1, 0, 'mail/attachments/gone' FROM mail_messages WHERE thread_identifier = ? LIMIT 1`).bind(first.threadIdentifier).run();
		expect(await purgeDeleted({ ...context, now: () => new Date('2026-12-30T00:00:00Z') })).toBe(1);
		expect(await context.database.prepare(`SELECT COUNT(*) AS count FROM file_scans WHERE object_key = 'mail/attachments/gone'`).first<{ count: number }>()).toEqual({ count: 0 });
		expect(context.bucket.files.size).toBeLessThan(keys);
		expect(await getThread(context, first.threadIdentifier, 'lead')).toBeNull();
	});
});

describe('outreach', () => {
	async function setUp() {
		const context = await testContext(clock);
		await addAddressBook(context.database);
		await addContact(context.database, { identifier: 'c-office', name: 'Tribal Secretary’s Office', nation: 'example-nation', email: 'secretary@nation.example', tags: ['nation-government'] });
		await addContact(context.database, { identifier: 'c-chair', kind: 'person', name: 'Ada Begay', role: 'Chairman', nation: 'example-nation', email: 'chair@nation.example', label: 'leader', tags: ['nation-government'] });
		await addContact(context.database, { identifier: 'c-unsub', name: 'Other Office', nation: 'other-nation', email: 'gone@other.example' });
		await suppress(context, 'gone@other.example', 'unsubscribed');
		const templateIdentifier = await saveTemplate(context, 'lead', {
			name: 'First letter',
			subject: 'The Model Tribal ADR Code and {{nation.name}}',
			body: 'Dear {{contact.greeting}},\n\nWe are writing about {{nation.name}}. Its page: {{nation.page}}\n\n{{sender.name}}'
		});
		return { context, templateIdentifier };
	}

	const nation = { identifier: 'example-nation', name: 'Example Nation', states: ['AZ'], page: '/nations/example-nation' };

	it('keeps every version of a template and refuses fields the site does not know', async () => {
		const { context, templateIdentifier } = await setUp();
		await saveTemplate(context, 'lead', { identifier: templateIdentifier, name: 'First letter', subject: 'Changed', body: 'Body {{nation.name}}' });
		expect((await templateVersions(context, templateIdentifier)).map((item) => item.version)).toEqual([2, 1]);
		await expect(saveTemplate(context, 'lead', { name: 'Bad', subject: '{{nation.motto}}', body: 'x' })).rejects.toThrow(/nation\.motto/);
	});

	it('takes recipients from the address book, leaving out the do-not-email list and missing fields', async () => {
		const { context, templateIdentifier } = await setUp();
		const contacts = await addressBookRecipients(context);
		expect(contacts.map((item) => item.email).sort()).toEqual(['chair@nation.example', 'gone@other.example', 'secretary@nation.example']);
		expect(fieldsFor(contacts.find((item) => item.kind === 'person')!, nation, 'https://example.org', 'Lead Author')).toMatchObject({
			'contact.greeting': 'Chairman Begay',
			'nation.page': 'https://example.org/nations/example-nation'
		});
		const batch = await createBatch(context, 'lead', { name: 'Arizona', templateIdentifier, perDay: 40, windowStartHour: 9, windowEndHour: 15, weekdaysOnly: true, followUpDays: 14, askAcknowledgment: true });
		const result = await addRecipients(
			context,
			batch,
			contacts.map((contact) => ({
				contactIdentifier: contact.contactIdentifier,
				nationIdentifier: contact.nationIdentifier,
				email: contact.email,
				name: contact.name,
				fields: fieldsFor(contact, contact.nationIdentifier === 'example-nation' ? nation : null, 'https://example.org', 'Lead Author'),
				timeZone: timeZoneForStates(contact.nationIdentifier === 'example-nation' ? nation.states : [])
			}))
		);
		expect(result).toEqual({ added: 2, leftOut: 1 });
		const skipped = await context.database.prepare(`SELECT skip_reason AS reason FROM outreach_recipients WHERE email = 'gone@other.example'`).first();
		expect(skipped).toEqual({ reason: 'On the do-not-email list' });
		return { context, batch };
	});

	it('sends slowly, in working hours in the nation’s time zone, with unsubscribe links, and notes replies', async () => {
		const { context, templateIdentifier } = await setUp();
		const contacts = (await addressBookRecipients(context)).filter((item) => item.nationIdentifier === 'example-nation');
		const batch = await createBatch(context, 'lead', { name: 'Arizona', templateIdentifier, perDay: 1, windowStartHour: 9, windowEndHour: 15, weekdaysOnly: true, followUpDays: 14, askAcknowledgment: true });
		await addRecipients(context, batch, contacts.map((contact) => ({ contactIdentifier: contact.contactIdentifier, nationIdentifier: 'example-nation', email: contact.email, name: contact.name, fields: fieldsFor(contact, nation, 'https://example.org', 'Lead Author'), timeZone: 'America/Phoenix' })));
		const outreach = recordingCarrier('smtp');
		const carriers = { replies: recordingCarrier(), outreach };

		// Not started yet: nothing goes.
		expect(await runOutreach(context, carriers)).toEqual({ sent: 0, failed: 0 });
		await setBatchStatus(context, 'lead', batch, 'running');
		// 5:00 a.m. in Arizona (12:00 UTC): outside the sending hours.
		const early = { ...context, now: () => new Date('2026-11-24T12:00:00Z') };
		expect(insideWindow(early.now(), 'America/Phoenix', { window_start_hour: 9, window_end_hour: 15, weekdays_only: 1 })).toBe(false);
		expect(await runOutreach(early, carriers)).toEqual({ sent: 0, failed: 0 });
		// 10:00 a.m. in Arizona: one message, because the batch allows one a day.
		expect(await runOutreach(context, carriers)).toEqual({ sent: 1, failed: 0 });
		expect(await runOutreach(context, carriers)).toEqual({ sent: 0, failed: 0 });

		const mail = outreach.sent[0];
		expect(mail.from).toEqual({ email: 'outreach@outreach.example.org', name: 'Model Tribal ADR Code' });
		expect(mail.replyTo).toEqual({ email: 'replies@example.org' });
		expect(mail.subject).toBe('The Model Tribal ADR Code and Example Nation');
		expect(mail.headers?.['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
		expect(mail.headers?.['List-Unsubscribe']).toMatch(/^<https:\/\/example\.org\/mail\/unsubscribe\/[a-z2-7]+\/one-click>, <mailto:unsubscribe\+[a-z2-7]+@example\.org\?subject=unsubscribe>$/);
		expect(mail.text).toContain('https://example.org/mail/got-it/');
		expect(mail.text).toContain('reply "stop"');

		// The reply arrives in the project inbox and marks the recipient as replied.
		const row = await context.database.prepare(`SELECT identifier, thread_identifier AS thread FROM outreach_recipients WHERE status = 'sent'`).first<{ identifier: string; thread: string }>();
		const reply = await receiveMail(context, arriving(rawMessage({ From: mail.to[0].email, To: 'replies@example.org', Subject: `Re: ${mail.subject}`, 'In-Reply-To': `<${mail.messageId}>` }, 'Glad to hear from you.'), 'replies@example.org', mail.to[0].email));
		expect(reply).toMatchObject({ outcome: 'filed', threadIdentifier: row!.thread });
		const thread = await getThread(context, row!.thread, 'lead');
		expect(thread!.folder).toBe('inbox');
		expect(thread!.tags.map((tag) => tag.name)).toContain('Outreach reply');
		expect(thread!.outreach).toMatchObject({ status: 'replied' });
		expect(thread!.remindAt).toBeNull();

		// The other recipient unsubscribes by address before their turn comes.
		const waiting = await context.database.prepare(`SELECT identifier, email FROM outreach_recipients WHERE status = 'queued'`).first<{ identifier: string; email: string }>();
		const token = await makeToken(context.settings.signingKey!, 'unsubscribe', waiting!.identifier);
		expect(await receiveMail(context, arriving(rawMessage({ From: 'x@else.example', To: `unsubscribe+${token}@example.org`, Subject: 'unsubscribe' }, ''), `unsubscribe+${token}@example.org`, 'x@else.example'))).toEqual({ outcome: 'unsubscribed', email: waiting!.email });
		expect(await isSuppressed(context, waiting!.email)).toBe(true);
		const status = await context.database.prepare('SELECT status FROM outreach_recipients WHERE identifier = ?').bind(waiting!.identifier).first();
		expect(status).toEqual({ status: 'unsubscribed' });
	});

	it('unsubscribes by link only with a valid token', async () => {
		const { context, templateIdentifier } = await setUp();
		const batch = await createBatch(context, 'lead', { name: 'One', templateIdentifier, perDay: 5, windowStartHour: 0, windowEndHour: 24, weekdaysOnly: false, followUpDays: null, askAcknowledgment: false });
		await addRecipients(context, batch, [{ contactIdentifier: null, nationIdentifier: 'example-nation', email: 'secretary@nation.example', name: 'Office', fields: fieldsFor({ name: 'Office', kind: 'organization', role: null, organizationName: null }, nation, 'https://example.org', 'Lead'), timeZone: 'America/Phoenix' }]);
		const row = await context.database.prepare('SELECT identifier FROM outreach_recipients').first<{ identifier: string }>();
		expect(await unsubscribeWithToken(context, 'notatoken', 'test')).toBeNull();
		expect(await unsubscribeWithToken(context, await makeToken(context.settings.signingKey!, 'unsubscribe', row!.identifier), 'test')).toBe('secretary@nation.example');
		expect(await isSuppressed(context, 'secretary@nation.example')).toBe(true);
	});

	it('sends nothing while outreach is not set up', async () => {
		const { context } = await setUp();
		expect(await runOutreach({ ...context, settings: testSettings({ outreach: null }) }, { replies: null, outreach: null })).toEqual({ sent: 0, failed: 0 });
	});
});

describe('the Worker’s mail handlers', () => {
	it('use the same run token key and header as the routes, and keep the inner handlers', () => {
		expect(toolKey).toBe(mailRunTokenKey);
		expect(toolHeader).toBe(mailRunHeader);
		const source = entrySource('scheduled-entry.js') as string;
		expect(source).toContain("import worker from \"./scheduled-entry.js\"");
		expect(source).toContain('async email(message, env, context)');
		expect(source).toContain('async queue(batch, env, context)');
		expect(source).toContain('if (worker.scheduled) return worker.scheduled(controller, env, context);');
		const wrangler = readFileSync(path.resolve(import.meta.dirname, '../wrangler.jsonc'), 'utf8');
		expect(wrangler).toContain(`"${mailCron}"`);
		expect(wrangler).toContain('{ "name": "projectEmail" }');
	});
});
