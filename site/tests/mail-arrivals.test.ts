import { describe, expect, it } from 'vitest';
import { fileArrival, fileWaitingArrivals, keepArrival, stuckArrivals, tryStuckArrivalsAgain } from '#lib/server/mail/arrivals.ts';
import { receiveMail } from '#lib/server/mail/inbound.ts';
import { listThreads } from '#lib/server/mail/store.ts';
import { rawMessage, recordingCarrier, testContext } from './mail-fixtures.ts';

const clock = { now: new Date('2026-11-24T17:00:00Z') };
const encoder = new TextEncoder();
const carriers = { replies: recordingCarrier(), outreach: null };
const letter = (id: string) => encoder.encode(rawMessage({ From: 'office@nation.example', To: 'contact@example.org', Subject: 'A question', 'Message-ID': `<${id}@nation.example>` }, 'Hello'));

describe('arriving mail kept until it is filed', () => {
	it('files a kept message and lets the copy go', async () => {
		const context = await testContext(clock);
		const key = await keepArrival(context, { from: 'office@nation.example', to: 'contact@example.org', raw: letter('one') });
		expect(key).toMatch(/^mail\/incoming\/.+\.eml$/);
		expect(await fileArrival(context, key)).toMatchObject({ outcome: 'filed' });
		expect(context.bucket.files.has(key)).toBe(false);
		expect((await listThreads(context, { view: 'inbox', personIdentifier: 'lead' })).threads).toHaveLength(1);
		// Filing the same message again does not file it twice.
		expect(await receiveMail(context, { from: 'office@nation.example', to: 'contact@example.org', raw: letter('one') })).toMatchObject({ outcome: 'filed', notify: false });
		expect((await listThreads(context, { view: 'inbox', personIdentifier: 'lead' })).threads[0].messageCount).toBe(1);
	});

	it('tries again with longer waits, then waits for a person', async () => {
		const context = await testContext(clock);
		const key = await keepArrival(context, { from: 'office@nation.example', to: 'contact@example.org', raw: letter('two') });
		// Left to the email handler for two minutes.
		context.bucket.backdate(key, clock.now);
		expect(await fileWaitingArrivals(context, carriers)).toEqual({ filed: 0, failed: 0 });
		context.bucket.backdate(key, new Date('2026-11-24T16:00:00Z'));
		// The database refuses every try.
		const working = context.database.prepare.bind(context.database);
		let broken = true;
		context.database.prepare = ((sql: string) => {
			if (broken && sql.includes('INSERT INTO mail_messages')) throw new Error('D1 is busy');
			return working(sql);
		}) as typeof context.database.prepare;
		expect(await fileWaitingArrivals(context, carriers)).toEqual({ filed: 0, failed: 1 });
		expect(await context.database.prepare('SELECT attempts, next_try_at FROM mail_arrival_problems').first()).toEqual({ attempts: 1, next_try_at: '2026-11-24T17:05:00.000Z' });
		// Not before its time.
		expect(await fileWaitingArrivals(context, carriers)).toEqual({ filed: 0, failed: 0 });
		for (const at of ['2026-11-24T17:05:00Z', '2026-11-24T17:20:00Z', '2026-11-24T18:20:00Z', '2026-11-24T22:20:00Z', '2026-11-25T10:20:00Z']) {
			clock.now = new Date(at);
			expect(await fileWaitingArrivals(context, carriers)).toEqual({ filed: 0, failed: 1 });
		}
		const stuck = await stuckArrivals(context);
		expect(stuck).toMatchObject([{ key, attempts: 6, lastError: 'D1 is busy', envelopeTo: 'contact@example.org' }]);
		expect(context.bucket.files.has(key)).toBe(true);

		// Once a person asks and the database works again, it is filed.
		broken = false;
		expect(await tryStuckArrivalsAgain(context, 'lead')).toBe(1);
		expect(await fileWaitingArrivals(context, carriers)).toEqual({ filed: 1, failed: 0 });
		expect(await stuckArrivals(context)).toEqual([]);
		expect(context.bucket.files.has(key)).toBe(false);
		expect((await listThreads(context, { view: 'inbox', personIdentifier: 'lead' })).threads).toHaveLength(1);
		clock.now = new Date('2026-11-24T17:00:00Z');
	});

	it('keeps mail no inbox takes for a person, rather than losing it', async () => {
		const context = await testContext(clock);
		await context.database.prepare('UPDATE mail_inboxes SET catch_all = 0').run();
		const key = await keepArrival(context, { from: 'a@b.example', to: 'nobody@example.org', raw: letter('three') });
		context.bucket.backdate(key, new Date('2026-11-24T16:00:00Z'));
		expect(await fileWaitingArrivals(context, carriers)).toEqual({ filed: 0, failed: 1 });
		expect(context.bucket.files.has(key)).toBe(true);
	});
});
