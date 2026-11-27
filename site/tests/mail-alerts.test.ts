import { describe, expect, it } from 'vitest';
import { sendArrivalAlerts, sendDailySummaries } from '#lib/server/mail/alerts.ts';
import { afterArrival } from '#lib/server/mail/arrivals.ts';
import { receiveMail } from '#lib/server/mail/inbound.ts';
import {
	addInboxAddress,
	addInboxMember,
	createInbox,
	deleteInbox,
	inboxesForManaging,
	inboxForArrival,
	removeInboxAddress,
	removeInboxMember,
	replyAddresses,
	sendingAddresses,
	setInboxAlerts,
	threadInboxAddress
} from '#lib/server/mail/inboxes.ts';
import { queueMessage } from '#lib/server/mail/outbound.ts';
import { getThread } from '#lib/server/mail/store.ts';
import { rawMessage, recordingCarrier, testContext } from './mail-fixtures.ts';

const encoder = new TextEncoder();
type Context = Awaited<ReturnType<typeof testContext>>;

async function arrive(context: Context, to: string, subject: string, from = 'office@nation.example') {
	const result = await receiveMail(context, { from, to, raw: encoder.encode(rawMessage({ From: from, To: to, Subject: subject }, 'A private matter')) });
	if (result.outcome !== 'filed') throw new Error(`not filed: ${JSON.stringify(result)}`);
	return result;
}

/** The lead author signs in with an address outside the project, and Rosa, a co-author, is on contact@ too. */
async function withPeople(context: Context): Promise<void> {
	await context.database.batch([
		context.database.prepare(`UPDATE people SET email = 'lead@personal.example' WHERE identifier = 'lead'`),
		context.database.prepare(`INSERT INTO people (identifier, email, display_name, role, status, added_at) VALUES ('rosa', 'rosa@home.example', 'Rosa Diaz', 'co-author', 'active', '2026-11-20T00:00:00Z')`)
	]);
	await addInboxMember(context, 'lead', 'contact', 'rosa');
}

describe('extra addresses', () => {
	it('file mail to an extra address into its inbox and answer it from that address', async () => {
		const clock = { now: new Date('2026-11-27T04:00:00Z') };
		const context = await testContext(clock);
		await addInboxAddress(context, 'lead', 'contact', 'Info');
		expect((await inboxForArrival(context, 'info@example.org'))!.identifier).toBe('contact');
		expect((await inboxForArrival(context, 'Info+forms@Example.org'))!.identifier).toBe('contact');

		const arrived = await arrive(context, 'info@example.org', 'Asking info@');
		expect((await threadInboxAddress(context, arrived.threadIdentifier))!.address).toBe('info@example.org');
		const thread = await getThread(context, arrived.threadIdentifier, 'lead');
		expect((await replyAddresses(context, 'lead', 'contact', thread!.projectAddress)).from).toBe('info@example.org');
		// Mail to the main address still answers from it.
		const main = await arrive(context, 'contact@example.org', 'Asking contact@');
		expect((await threadInboxAddress(context, main.threadIdentifier))!.address).toBe('contact@example.org');

		expect(await sendingAddresses(context, 'lead')).toEqual(expect.arrayContaining(['contact@example.org', 'info@example.org', 'requests@example.org']));
		const queued = await queueMessage(context, {
			personIdentifier: 'lead',
			threadIdentifier: arrived.threadIdentifier,
			from: 'info@example.org',
			to: [{ email: 'office@nation.example' }],
			subject: 'Re: Asking info@',
			text: 'Thanks.'
		});
		expect(queued.threadIdentifier).toBe(arrived.threadIdentifier);
	});

	it('belong to one inbox only, and the main address stays until the inbox is deleted', async () => {
		const context = await testContext({ now: new Date('2026-11-27T04:00:00Z') });
		await addInboxAddress(context, 'lead', 'contact', 'hello');
		await expect(addInboxAddress(context, 'lead', 'requests', 'hello')).rejects.toThrow('already an address of the Contact inbox');
		await expect(addInboxAddress(context, 'lead', 'contact', 'requests')).rejects.toThrow('already an address of the Requests inbox');
		await expect(createInbox(context, 'lead', { localPart: 'hello', name: 'Hello', kind: 'shared' })).rejects.toThrow('already an address of the Contact inbox');
		await expect(addInboxAddress(context, 'lead', 'contact', 'unsubscribe')).rejects.toThrow('kept for the inbox');
		await expect(removeInboxAddress(context, 'lead', 'contact', 'contact')).rejects.toThrow('main address');

		const managed = await inboxesForManaging(context);
		expect(managed.find((inbox) => inbox.identifier === 'contact')!.aliases).toEqual(['hello']);

		// Taken off, it goes back to the catch-all; on an inbox that is deleted, it goes with it.
		await addInboxAddress(context, 'lead', 'requests', 'forms');
		expect((await inboxForArrival(context, 'forms@example.org'))!.identifier).toBe('requests');
		await removeInboxAddress(context, 'lead', 'requests', 'forms@');
		expect((await inboxForArrival(context, 'forms@example.org'))!.identifier).toBe('contact');
		await addInboxAddress(context, 'lead', 'requests', 'forms');
		await deleteInbox(context, 'lead', 'requests');
		expect((await inboxForArrival(context, 'forms@example.org'))!.identifier).toBe('contact');
		await addInboxAddress(context, 'lead', 'contact', 'forms');
	});
});

describe('at-once alerts', () => {
	it('tell each person on the inbox at the email they sign in with, without quoting the mail, at most every 30 minutes', async () => {
		const clock = { now: new Date('2026-11-27T04:00:00Z') };
		const context = await testContext(clock);
		await withPeople(context);
		const carrier = recordingCarrier();
		const carriers = { replies: carrier, outreach: null };

		await afterArrival(context, carriers, await arrive(context, 'contact@example.org', 'Secret subject'));
		expect(carrier.sent.map((mail) => mail.to[0].email).sort()).toEqual(['lead@personal.example', 'rosa@home.example']);
		const alert = carrier.sent[0];
		expect(alert.from.email).toBe('contact@example.org');
		expect(alert.subject).toBe('New mail in Contact');
		expect(alert.text).toContain('https://example.org/workspace/inbox?inbox=contact');
		expect(alert.text).not.toContain('Secret subject');
		expect(alert.text).not.toContain('private matter');
		expect(alert.text).not.toContain('office@nation.example');
		expect(alert.headers?.['X-Project-Inbox-Notice']).toBe('yes');

		// A second message soon after sends nothing; one after 30 minutes sends again.
		clock.now = new Date('2026-11-27T04:20:00Z');
		await afterArrival(context, carriers, await arrive(context, 'contact@example.org', 'Second'));
		expect(carrier.sent).toHaveLength(2);
		clock.now = new Date('2026-11-27T04:31:00Z');
		await afterArrival(context, carriers, await arrive(context, 'contact@example.org', 'Third'));
		expect(carrier.sent).toHaveLength(4);
	});

	it('follow each person’s own choice, never go to a project address, and skip Spam', async () => {
		const clock = { now: new Date('2026-11-27T04:00:00Z') };
		const context = await testContext(clock);
		await withPeople(context);
		const carrier = recordingCarrier();
		const carriers = { replies: carrier, outreach: null };
		await setInboxAlerts(context, 'rosa', 'contact', 'none');
		await afterArrival(context, carriers, await arrive(context, 'contact@example.org', 'Hello'));
		expect(carrier.sent.map((mail) => mail.to[0].email)).toEqual(['lead@personal.example']);

		// Someone who signs in with one of the project's own addresses is not sent alerts there.
		await context.database.prepare(`UPDATE people SET email = 'lead@example.org' WHERE identifier = 'lead'`).run();
		clock.now = new Date('2026-11-27T05:00:00Z');
		expect(await sendArrivalAlerts(context, carriers, 'contact')).toBe(0);

		await context.database.prepare(`UPDATE people SET email = 'lead@personal.example' WHERE identifier = 'lead'`).run();
		const spam = await receiveMail(context, {
			from: 'x@spam.example',
			to: 'contact@example.org',
			raw: encoder.encode(rawMessage({ From: 'x@spam.example', To: 'contact@example.org', Subject: 'Win', 'Authentication-Results': 'mx.example; dmarc=fail' }, 'Win'))
		});
		expect(spam).toMatchObject({ outcome: 'filed', spam: true, notify: false });
	});

	it('reach a personal inbox’s owner too', async () => {
		const context = await testContext({ now: new Date('2026-11-27T04:00:00Z') });
		await withPeople(context);
		await createInbox(context, 'lead', { localPart: 'rosa', name: 'Rosa', kind: 'personal', ownerIdentifier: 'rosa' });
		const carrier = recordingCarrier();
		await afterArrival(context, { replies: carrier, outreach: null }, await arrive(context, 'rosa@example.org', 'Just for Rosa'));
		expect(carrier.sent.map((mail) => [mail.to[0].email, mail.from.email])).toEqual([['rosa@home.example', 'rosa@example.org']]);
	});
});

describe('choosing alerts', () => {
	it('is for the person on the inbox only, and leaving takes them off', async () => {
		const context = await testContext({ now: new Date('2026-11-27T04:00:00Z') });
		await withPeople(context);
		await expect(setInboxAlerts(context, 'rosa', 'requests', 'daily')).rejects.toThrow('not on that inbox');
		await expect(setInboxAlerts(context, 'rosa', 'contact', 'hourly')).rejects.toThrow('Choose at once');
		expect(await setInboxAlerts(context, 'rosa', 'contact', 'daily')).toBe('daily');
		const contact = (await inboxesForManaging(context)).find((inbox) => inbox.identifier === 'contact')!;
		expect(contact.members.map((member) => [member.identifier, member.alerts])).toEqual([
			['lead', 'now'],
			['rosa', 'daily']
		]);
		await removeInboxMember(context, 'rosa', 'contact', 'rosa');
		expect((await inboxesForManaging(context)).find((inbox) => inbox.identifier === 'contact')!.members.map((member) => member.identifier)).toEqual(['lead']);
		await expect(removeInboxMember(context, 'lead', 'contact', 'lead')).rejects.toThrow('at least one person');
	});
});

describe('daily summaries', () => {
	it('count the day’s mail about a day after the choice, and send nothing for a quiet day', async () => {
		const clock = { now: new Date('2026-11-27T04:00:00Z') };
		const context = await testContext(clock);
		await withPeople(context);
		await setInboxAlerts(context, 'rosa', 'contact', 'daily');
		await setInboxAlerts(context, 'lead', 'contact', 'none');
		const carrier = recordingCarrier();
		const carriers = { replies: carrier, outreach: null };

		clock.now = new Date('2026-11-27T10:00:00Z');
		await afterArrival(context, carriers, await arrive(context, 'contact@example.org', 'One'));
		await afterArrival(context, carriers, await arrive(context, 'contact@example.org', 'Two', 'someone@else.example'));
		expect(carrier.sent).toHaveLength(0);
		expect(await sendDailySummaries(context, carriers)).toEqual({ sent: 0, failed: 0 });

		clock.now = new Date('2026-11-28T04:17:00Z');
		expect(await sendDailySummaries(context, carriers)).toEqual({ sent: 1, failed: 0 });
		expect(carrier.sent[0]).toMatchObject({ to: [{ email: 'rosa@home.example' }], subject: 'Daily summary: Contact' });
		expect(carrier.sent[0].text).toContain('2 messages arrived in the Contact inbox');
		expect(carrier.sent[0].text).toContain('2 conversations there are unread.');
		expect(carrier.sent[0].text).not.toContain('One');

		// The next hour is not due; the next day, with no new mail, sends nothing.
		clock.now = new Date('2026-11-28T05:17:00Z');
		expect(await sendDailySummaries(context, carriers)).toEqual({ sent: 0, failed: 0 });
		clock.now = new Date('2026-11-29T04:17:00Z');
		expect(await sendDailySummaries(context, carriers)).toEqual({ sent: 0, failed: 0 });
		expect(carrier.sent).toHaveLength(1);
	});
});
