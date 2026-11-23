import { describe, expect, it } from 'vitest';
import { receiveMail } from '#lib/server/mail/inbound.ts';
import {
	addInboxMember,
	createInbox,
	deleteInbox,
	InboxError,
	inboxForArrival,
	inboxesForManaging,
	makeCatchAll,
	removeInboxMember,
	replyAddresses,
	sendingAddresses
} from '#lib/server/mail/inboxes.ts';
import { CompositionError, queueMessage } from '#lib/server/mail/outbound.ts';
import { saveRule } from '#lib/server/mail/rules.ts';
import { senderCard } from '#lib/server/mail/senders.ts';
import { getThread, listThreads, purgeDeleted, viewCounts } from '#lib/server/mail/store.ts';
import { rawMessage, testContext } from './mail-fixtures.ts';

const clock = { now: new Date('2026-11-24T17:00:00Z') };
const encoder = new TextEncoder();
type Context = Awaited<ReturnType<typeof testContext>>;

/** Adds an active co-author, Rosa, who is on no inbox yet. */
async function withRosa(context: Context): Promise<void> {
	await context.database
		.prepare(`INSERT INTO people (identifier, email, display_name, role, status, added_at) VALUES ('rosa', 'rosa@example.net', 'Rosa', 'co-author', 'active', '2026-11-20T00:00:00Z')`)
		.run();
}

async function arrive(context: Context, to: string, subject: string, from = 'office@nation.example', headers: Record<string, string> = {}) {
	const result = await receiveMail(context, { from, to, raw: encoder.encode(rawMessage({ From: from, To: to, Subject: subject, ...headers }, 'Hello')) });
	if (result.outcome !== 'filed') throw new Error(`not filed: ${JSON.stringify(result)}`);
	return result;
}

async function inboxOf(context: Context, threadIdentifier: string): Promise<string | null> {
	const row = await context.database.prepare('SELECT inbox_identifier FROM mail_threads WHERE identifier = ?').bind(threadIdentifier).first<{ inbox_identifier: string | null }>();
	return row?.inbox_identifier ?? null;
}

describe('where mail arrives', () => {
	it('files mail in its address’s inbox, plus-tags included, and the rest in the catch-all', async () => {
		const context = await testContext(clock);
		expect(await inboxOf(context, (await arrive(context, 'requests@example.org', 'A request')).threadIdentifier)).toBe('requests');
		expect(await inboxOf(context, (await arrive(context, 'Requests+forms@Example.org', 'Tagged')).threadIdentifier)).toBe('requests');
		expect(await inboxOf(context, (await arrive(context, 'nobody-here@example.org', 'Stray')).threadIdentifier)).toBe('contact');
		// An address at another domain is not the project's.
		expect((await inboxForArrival(context, 'requests@elsewhere.example'))!.identifier).toBe('contact');
	});

	it('keeps one conversation per inbox, so the same message to two addresses lands in each', async () => {
		const context = await testContext(clock);
		const headers = { 'Message-ID': '<same@nation.example>' };
		const toContact = await arrive(context, 'contact@example.org', 'Both of you', 'office@nation.example', headers);
		const toRequests = await arrive(context, 'requests@example.org', 'Both of you', 'office@nation.example', headers);
		expect(toContact.threadIdentifier).not.toBe(toRequests.threadIdentifier);
		const reply = await arrive(context, 'requests@example.org', 'Re: Both of you', 'office@nation.example', { 'In-Reply-To': '<same@nation.example>' });
		expect(reply.threadIdentifier).toBe(toRequests.threadIdentifier);
	});

	it('refuses mail when there is no catch-all and no inbox for the address', async () => {
		const context = await testContext(clock);
		await context.database.prepare('UPDATE mail_inboxes SET catch_all = 0').run();
		const result = await receiveMail(context, { from: 'a@b.example', to: 'stray@example.org', raw: encoder.encode(rawMessage({ From: 'a@b.example', To: 'stray@example.org', Subject: 'Hi' }, 'Hi')) });
		expect(result).toEqual({ outcome: 'rejected', reason: 'No inbox takes this mail.' });
	});
});

describe('personal inboxes', () => {
	it('are seen only by their owner, not by the lead author who manages mail', async () => {
		const context = await testContext(clock);
		await withRosa(context);
		await createInbox(context, 'lead', { localPart: 'Rosa', name: 'Rosa', kind: 'personal', ownerIdentifier: 'rosa' });
		const arrived = await arrive(context, 'rosa@example.org', 'Just for Rosa');
		expect(arrived).toMatchObject({ notify: false, answerable: false });
		expect(await getThread(context, arrived.threadIdentifier, 'rosa')).not.toBeNull();
		expect(await getThread(context, arrived.threadIdentifier, 'lead')).toBeNull();
		expect((await listThreads(context, { view: 'inbox', personIdentifier: 'lead' })).threads).toHaveLength(0);
		expect((await listThreads(context, { view: 'inbox', personIdentifier: 'rosa' })).threads).toHaveLength(1);
		expect(await viewCounts(context, 'lead')).not.toMatchObject({ inbox: 1 });
		// The sender card shows the lead author none of Rosa's conversations with this sender.
		const card = await senderCard(context, 'office@nation.example', 'no-such-thread', { personIdentifier: 'lead', seesAddressBook: true });
		expect(card.conversationCount).toBe(0);
		// The managing view says the inbox exists, and nothing of what is in it is shown on the page.
		const managed = (await inboxesForManaging(context)).find((inbox) => inbox.localPart === 'rosa')!;
		expect(managed).toMatchObject({ kind: 'personal', ownerName: 'Rosa', members: [{ identifier: 'rosa' }] });
	});

	it('skip the shared inbox’s rules', async () => {
		const context = await testContext(clock);
		await withRosa(context);
		await createInbox(context, 'lead', { localPart: 'rosa', name: 'Rosa', kind: 'personal', ownerIdentifier: 'rosa' });
		await saveRule(
			context,
			'lead',
			{ name: 'Archive everything', enabled: true, matchAll: true, conditions: [{ field: 'from', operator: 'contains', value: '@' }], actions: [{ action: 'move', value: 'archive' }], stopAfter: false },
			null
		);
		const shared = await arrive(context, 'contact@example.org', 'Shared');
		const personal = await arrive(context, 'rosa@example.org', 'Personal');
		expect(shared.sortedBy).toEqual(['Archive everything']);
		expect(personal.sortedBy).toEqual([]);
		expect((await getThread(context, personal.threadIdentifier, 'rosa'))!.folder).toBe('inbox');
	});

	it('take no other members, and go with their owner’s account', async () => {
		const context = await testContext(clock);
		await withRosa(context);
		const identifier = await createInbox(context, 'lead', { localPart: 'rosa', name: 'Rosa', kind: 'personal', ownerIdentifier: 'rosa' });
		await expect(addInboxMember(context, 'lead', identifier, 'lead')).rejects.toThrow(InboxError);
		await expect(makeCatchAll(context, 'lead', identifier)).rejects.toThrow(InboxError);
		const arrived = await arrive(context, 'rosa@example.org', 'Before she left');
		await context.database.prepare(`DELETE FROM people WHERE identifier = 'rosa'`).run();
		expect(await inboxOf(context, arrived.threadIdentifier)).toBeNull();
		expect(await purgeDeleted(context)).toBe(1);
		expect(await context.database.prepare('SELECT COUNT(*) AS count FROM mail_threads').first<{ count: number }>()).toEqual({ count: 0 });
	});
});

describe('shared inboxes', () => {
	it('show their conversations to each member, and only to members', async () => {
		const context = await testContext(clock);
		await withRosa(context);
		const identifier = await createInbox(context, 'lead', { localPart: 'nations', name: 'Nations', kind: 'shared' });
		const arrived = await arrive(context, 'nations@example.org', 'For the team');
		const other = await arrive(context, 'contact@example.org', 'Not for Rosa');
		expect(await getThread(context, arrived.threadIdentifier, 'rosa')).toBeNull();
		await addInboxMember(context, 'lead', identifier, 'rosa');
		expect(await getThread(context, arrived.threadIdentifier, 'rosa')).not.toBeNull();
		expect(await getThread(context, other.threadIdentifier, 'rosa')).toBeNull();
		expect((await listThreads(context, { view: 'inbox', personIdentifier: 'lead', inbox: identifier })).threads.map((thread) => thread.subject)).toEqual(['For the team']);
		await removeInboxMember(context, 'lead', identifier, 'rosa');
		expect(await getThread(context, arrived.threadIdentifier, 'rosa')).toBeNull();
		await expect(removeInboxMember(context, 'lead', identifier, 'lead')).rejects.toThrow('at least one person');
	});

	it('let only members send from their address', async () => {
		const context = await testContext(clock);
		await withRosa(context);
		const identifier = await createInbox(context, 'lead', { localPart: 'nations', name: 'Nations', kind: 'shared' });
		await addInboxMember(context, 'lead', identifier, 'rosa');
		expect(await sendingAddresses(context, 'rosa')).toEqual(['nations@example.org']);
		const send = (from: string, threadIdentifier: string | null = null) =>
			queueMessage(context, { personIdentifier: 'rosa', threadIdentifier, from, to: [{ email: 'office@nation.example' }], subject: 'Hello', text: 'Hi.' });
		await expect(send('contact@example.org')).rejects.toThrow(CompositionError);
		const sent = await send('nations@example.org');
		expect(await inboxOf(context, sent.threadIdentifier)).toBe(identifier);
		// Nor reply in a conversation of an inbox they are not on.
		const elsewhere = await arrive(context, 'contact@example.org', 'Not hers');
		await expect(send('nations@example.org', elsewhere.threadIdentifier)).rejects.toThrow('an inbox you are not on');
		// Replying in a conversation starts from its inbox's address.
		const here = await arrive(context, 'nations@example.org', 'Hers');
		expect((await replyAddresses(context, 'rosa', identifier)).from).toBe('nations@example.org');
		expect(here.threadIdentifier).toBeTruthy();
	});

	it('move the catch-all, and are deleted only when empty', async () => {
		const context = await testContext(clock);
		await makeCatchAll(context, 'lead', 'requests');
		expect(await inboxOf(context, (await arrive(context, 'stray@example.org', 'Stray')).threadIdentifier)).toBe('requests');
		await expect(deleteInbox(context, 'lead', 'requests')).rejects.toThrow('Choose another inbox');
		await makeCatchAll(context, 'lead', 'contact');
		await expect(deleteInbox(context, 'lead', 'requests')).rejects.toThrow('It still has 1 conversation.');
		await context.database.prepare(`DELETE FROM mail_threads WHERE inbox_identifier = 'requests'`).run();
		await deleteInbox(context, 'lead', 'requests');
		expect(await inboxOf(context, (await arrive(context, 'requests@example.org', 'Afterwards')).threadIdentifier)).toBe('contact');
	});

	it('refuse addresses that clash, are reserved, or are not addresses', async () => {
		const context = await testContext(clock);
		await expect(createInbox(context, 'lead', { localPart: 'Contact', name: 'Again', kind: 'shared' })).rejects.toThrow('already an inbox');
		await expect(createInbox(context, 'lead', { localPart: 'unsubscribe', name: 'No', kind: 'shared' })).rejects.toThrow('kept for the inbox');
		await expect(createInbox(context, 'lead', { localPart: 'two words', name: 'No', kind: 'shared' })).rejects.toThrow('Use letters');
		await expect(createInbox(context, 'lead', { localPart: 'someone', name: 'No', kind: 'personal', ownerIdentifier: 'nobody' })).rejects.toThrow('Choose someone');
	});
});
