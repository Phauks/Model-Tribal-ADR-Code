import { describe, expect, it } from 'vitest';
import { receiveMail } from '#lib/server/mail/inbound.ts';
import { conversationExport, exportName, messageCopy, toMbox } from '#lib/server/mail/export.ts';
import { blockSender, listBlocked, senderCard, SenderError, unblockSender, unsubscribe, unsubscribeWays } from '#lib/server/mail/senders.ts';
import { getThread } from '#lib/server/mail/store.ts';
import { addAddressBook, addContact, rawMessage, recordingCarrier, testContext } from './mail-fixtures.ts';

const clock = { now: new Date('2026-11-24T17:00:00Z') };
const encoder = new TextEncoder();

function arriving(headers: Record<string, string>, body = 'Hello') {
	return { from: headers.From.replace(/.*<|>.*/g, ''), to: 'contact@example.org', raw: encoder.encode(rawMessage({ To: 'contact@example.org', ...headers }, body)) };
}

async function filed(context: Awaited<ReturnType<typeof testContext>>, headers: Record<string, string>, body = 'Hello') {
	const result = await receiveMail(context, arriving(headers, body));
	if (result.outcome !== 'filed') throw new Error('not filed');
	return result;
}

describe('the sender card', () => {
	it('shows the address book entry, other ways to reach them, and earlier conversations', async () => {
		const context = await testContext(clock);
		await addAddressBook(context.database);
		await addContact(context.database, { identifier: 'office', name: 'Tribal Secretary’s Office', nation: 'hopi-tribe', email: 'office@nation.example' });
		await context.database
			.prepare(
				`INSERT INTO contact_methods (identifier, contact_identifier, method, value, label, source_kind, source_label, first_recorded_on, verified_on, preferred, updated_at)
				 VALUES ('office-phone', 'office', 'phone', '(928) 555-0100', 'general-office', 'federal-directory', 'Tribal Leaders Directory', '2026-11-23', '2026-11-23', 0, '2026-11-23T00:00:00Z')`
			)
			.run();
		const first = await filed(context, { From: 'Office <office@nation.example>', Subject: 'First question' });
		const second = await filed(context, { From: 'Office <office@nation.example>', Subject: 'Another matter' });
		const card = await senderCard(context, 'Office@Nation.example', second.threadIdentifier);
		expect(card).toMatchObject({
			address: 'office@nation.example',
			contact: { name: 'Tribal Secretary’s Office', nationIdentifier: 'hopi-tribe', otherWays: [{ method: 'phone', value: '(928) 555-0100' }], source: 'Tribal Leaders Directory' },
			conversations: [{ identifier: first.threadIdentifier, subject: 'First question' }],
			conversationCount: 1,
			blockedBy: null
		});
	});

	it('says when someone is not in the address book, even before the address book exists', async () => {
		const context = await testContext(clock);
		const arrived = await filed(context, { From: 'stranger@else.example', Subject: 'Hi' });
		expect(await senderCard(context, 'stranger@else.example', arrived.threadIdentifier)).toMatchObject({ contact: null, conversations: [] });
	});
});

describe('blocking', () => {
	it('sends a blocked address’s mail to Spam in a conversation of its own, with no notice', async () => {
		const context = await testContext(clock);
		const before = await filed(context, { From: 'pest@junk.example', Subject: 'Buy now', 'Message-ID': '<a@junk.example>' });
		await blockSender(context, 'lead', 'Pest@Junk.example', { threadIdentifier: before.threadIdentifier });
		expect((await getThread(context, before.threadIdentifier, 'lead'))!.folder).toBe('spam');
		const after = await receiveMail(context, arriving({ From: 'pest@junk.example', Subject: 'Re: Buy now', 'In-Reply-To': '<a@junk.example>' }));
		expect(after).toMatchObject({ outcome: 'filed', spam: true, notify: false, answerable: false });
		if (after.outcome !== 'filed') return;
		expect(after.threadIdentifier).not.toBe(before.threadIdentifier);
		expect((await getThread(context, after.threadIdentifier, 'lead'))!.messages[0].spamReason).toBe('You blocked this sender.');
		// Someone else at the same domain still gets through.
		expect(await receiveMail(context, arriving({ From: 'friend@junk.example', Subject: 'Hello' }))).toMatchObject({ spam: false });
	});

	it('blocks a whole domain, and unblocks', async () => {
		const context = await testContext(clock);
		await blockSender(context, 'lead', '@junk.example');
		expect(await receiveMail(context, arriving({ From: 'anyone@junk.example', Subject: 'Hi' }))).toMatchObject({ spam: true });
		expect((await listBlocked(context)).map((item) => item.pattern)).toEqual(['@junk.example']);
		expect(await unblockSender(context, 'lead', '@junk.example')).toBe(true);
		expect(await receiveMail(context, arriving({ From: 'anyone@junk.example', Subject: 'Hi again' }))).toMatchObject({ spam: false });
	});

	it('refuses the project’s own addresses and things that are not addresses', async () => {
		const context = await testContext(clock);
		await expect(blockSender(context, 'lead', 'contact@example.org')).rejects.toThrow(SenderError);
		await expect(blockSender(context, 'lead', '@example.org')).rejects.toThrow(SenderError);
		await expect(blockSender(context, 'lead', 'not an address')).rejects.toThrow(SenderError);
	});
});

describe('unsubscribing', () => {
	it('reads the ways a list offers (RFC 2369, RFC 8058)', () => {
		expect(unsubscribeWays('<mailto:leave@list.example?subject=remove>, <https://list.example/u/1>', 'List-Unsubscribe=One-Click')).toEqual({
			oneClick: 'https://list.example/u/1',
			mail: { to: 'leave@list.example', subject: 'remove', body: 'unsubscribe' },
			page: null
		});
		expect(unsubscribeWays('<http://list.example/u>, <https://list.example/page>', null)).toEqual({ oneClick: null, mail: null, page: 'https://list.example/page' });
		expect(unsubscribeWays(null, null)).toEqual({ oneClick: null, mail: null, page: null });
	});

	it('posts to the one-click address and archives the conversation', async () => {
		const context = await testContext(clock);
		const arrived = await filed(context, {
			From: 'news@list.example',
			Subject: 'Weekly news',
			'List-Unsubscribe': '<https://list.example/u/abc>, <mailto:leave@list.example>',
			'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
		});
		expect((await getThread(context, arrived.threadIdentifier, 'lead'))!.messages[0].fromList).toBe(true);
		const calls: { url: string; body: string }[] = [];
		const fetcher = (async (url: string, init: RequestInit) => {
			calls.push({ url, body: String(init.body) });
			return new Response('', { status: 200 });
		}) as unknown as typeof fetch;
		const carrier = recordingCarrier();
		expect(await unsubscribe(context, { replies: carrier, outreach: null }, 'lead', arrived.messageIdentifier, fetcher)).toEqual({ how: 'one-click' });
		expect(calls).toEqual([{ url: 'https://list.example/u/abc', body: 'List-Unsubscribe=One-Click' }]);
		expect(carrier.sent).toHaveLength(0);
		expect((await getThread(context, arrived.threadIdentifier, 'lead'))!.folder).toBe('archive');
	});

	it('writes to the list when it offers only an address, and hands back a page when that is all there is', async () => {
		const context = await testContext(clock);
		const carrier = recordingCarrier();
		const byMail = await filed(context, { From: 'news@one.example', Subject: 'News', 'List-Unsubscribe': '<mailto:leave@one.example?subject=unsubscribe%20me>' });
		expect(await unsubscribe(context, { replies: carrier, outreach: null }, 'lead', byMail.messageIdentifier)).toEqual({ how: 'mail' });
		expect(carrier.sent[0]).toMatchObject({ to: [{ email: 'leave@one.example' }], subject: 'unsubscribe me', from: { email: 'contact@example.org' } });
		const byPage = await filed(context, { From: 'news@two.example', Subject: 'News', 'List-Unsubscribe': '<https://two.example/settings>' });
		expect(await unsubscribe(context, { replies: carrier, outreach: null }, 'lead', byPage.messageIdentifier)).toEqual({ how: 'page', page: 'https://two.example/settings' });
		const none = await filed(context, { From: 'someone@three.example', Subject: 'Hi' });
		await expect(unsubscribe(context, { replies: carrier, outreach: null }, 'lead', none.messageIdentifier)).rejects.toThrow('does not say how to unsubscribe');
	});
});

describe('exporting', () => {
	it('hands out a message as it arrived once its attachments pass the virus check', async () => {
		const context = await testContext(clock);
		const raw = [
			'From: Office <office@nation.example>',
			'To: contact@example.org',
			'Subject: Our ordinance',
			'Date: Tue, 24 Nov 2026 10:00:00 -0700',
			'MIME-Version: 1.0',
			'Content-Type: multipart/mixed; boundary="b"',
			'',
			'--b',
			'Content-Type: text/plain',
			'',
			'Attached.',
			'--b',
			'Content-Type: text/plain; name="ordinance.txt"',
			'Content-Disposition: attachment; filename="ordinance.txt"',
			'',
			'Section 1.',
			'--b--',
			''
		].join('\r\n');
		const result = await receiveMail(context, { from: 'office@nation.example', to: 'contact@example.org', raw: encoder.encode(raw) });
		if (result.outcome !== 'filed') throw new Error('not filed');
		expect(await messageCopy(context, result.messageIdentifier)).toEqual({ state: 'held', files: ['ordinance.txt'] });
		expect(await conversationExport(context, result.threadIdentifier)).toEqual({ state: 'held', files: ['ordinance.txt'] });

		// The scanner passes the attachment.
		await context.database.prepare(`UPDATE file_scans SET status = 'clean'`).run();
		const copy = await messageCopy(context, result.messageIdentifier);
		expect(copy).toMatchObject({ state: 'ready', filename: '2026-11-24 Our ordinance.eml', from: 'office@nation.example' });
		if (copy.state !== 'ready') return;
		expect(new TextDecoder().decode(copy.bytes)).toContain('Section 1.');
		expect(await conversationExport(context, result.threadIdentifier)).toMatchObject({ state: 'ready', count: 1, filename: '2026-11-24 Our ordinance.mbox' });
	});

	it('exports a conversation as an mbox file, quoting lines that start with From', async () => {
		const context = await testContext(clock);
		const first = await filed(context, { From: 'office@nation.example', Subject: 'Plain', 'Message-ID': '<p@nation.example>' }, 'From the start.\nLine two');
		await filed(context, { From: 'office@nation.example', Subject: 'Re: Plain', 'In-Reply-To': '<p@nation.example>' }, 'Thanks');
		const exported = await conversationExport(context, first.threadIdentifier);
		expect(exported).toMatchObject({ state: 'ready', count: 2 });
		if (exported.state !== 'ready') return;
		const text = new TextDecoder().decode(exported.bytes);
		expect(text.match(/^From office@nation\.example /gm)).toHaveLength(2);
		expect(text).toContain('\n>From the start.\n');
		expect(text).not.toContain('\r');
	});

	it('keeps every byte of a message in another character set', () => {
		const bytes = Uint8Array.of(0x53, 0x3a, 0x20, 0xe9, 0x0d, 0x0a, 0x46, 0x72, 0x6f, 0x6d, 0x20, 0x9f, 0x0d, 0x0a);
		const mbox = toMbox([{ bytes, from: 'a@b.example', at: '2026-11-24T17:00:00Z' }]);
		const body = mbox.subarray(mbox.indexOf(0x0a) + 1);
		expect([...body]).toEqual([0x53, 0x3a, 0x20, 0xe9, 0x0a, 0x3e, 0x46, 0x72, 0x6f, 0x6d, 0x20, 0x9f, 0x0a, 0x0a]);
	});

	it('names files from the subject and date, without characters file systems refuse', () => {
		expect(exportName('Re: A/B "test"?', '2026-11-24T17:00:00Z', 'eml')).toBe('2026-11-24 Re A B test.eml');
	});
});
