import type { D1Database, R2Bucket } from '@cloudflare/workers-types/index.ts';
import { beforeEach, describe, expect, it } from 'vitest';
import { accountPages } from '#lib/account-menu.ts';
import { defaultPrintChoice } from '#lib/book-order.ts';
import { openProblemsPerOrder, problemKindHints, problemKinds } from '#lib/book-order-problems.ts';
import { can } from '#lib/permissions.ts';
import { workspacePagesFor } from '#lib/workspace-menu.ts';
import {
	allOrders,
	answerProblem,
	ordersOfAccount,
	problemsOfOrder,
	recordRefund,
	reportProblem,
	unsettledProblems
} from '#lib/server/book-order-problems.ts';
import { fileScan } from '#lib/server/file-scans.ts';
import { markPaid, recordPaymentSession, saveOrder } from '#lib/server/book-orders.ts';
import { testDatabase } from './database.ts';

let database: D1Database;
let stored: Map<string, Uint8Array>;
let bucket: R2Bucket;

const first = '11111111-2222-3333-4444-555555555555';
const second = '66666666-7777-8888-9999-000000000000';

async function placeOrder(identifier: string, account: string | null, paid: boolean) {
	await saveOrder(
		database,
		{
			identifier,
			mode: 'test',
			fileSet: { identifier: 'current/us-trade/paperback', title: 'Model Tribal ADR Code', pages: 300, size: 'us-trade', binding: 'paperback' },
			choice: defaultPrintChoice,
			shippingLevel: 'MAIL',
			shippingAddress: { name: 'A Reader', street1: '1 Main St', city: 'Las Vegas', state_code: 'NV', postcode: '89154', country_code: 'US', phone_number: '1' },
			email: 'reader@example.org',
			printerCostCents: 1689,
			priceCents: 2341,
			accountIdentifier: account
		},
		'2026-11-23T00:00:00Z'
	);
	if (paid) {
		await recordPaymentSession(database, identifier, `cs_test_${identifier}`, '2026-11-23T00:01:00Z');
		await markPaid(database, identifier, `cs_test_${identifier}`, '2026-11-23T00:02:00Z');
	}
}

beforeEach(async () => {
	database = testDatabase();
	stored = new Map();
	bucket = {
		put: async (key: string, value: Uint8Array) => void stored.set(key, value),
		delete: async (key: string) => void stored.delete(key)
	} as unknown as R2Bucket;
	await database
		.prepare(`INSERT INTO accounts (identifier, email, email_verified_at, created_at) VALUES (?, ?, ?, ?)`)
		.bind('account-reader', 'reader@example.org', '2026-11-22T00:00:00Z', '2026-11-22T00:00:00Z')
		.run();
});

describe('your orders', () => {
	it('lists the paid orders placed while signed in, and none placed signed out', async () => {
		await placeOrder(first, 'account-reader', true);
		await placeOrder(second, null, true);
		// Never paid for: nothing happened, so it is left out.
		await placeOrder('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', 'account-reader', false);
		const orders = await ordersOfAccount(database, 'account-reader');
		expect(orders.map((order) => order.identifier)).toEqual([first]);
		expect(orders[0]).toMatchObject({ status: 'paid', priceCents: 2341, refundedCents: 0, openProblems: 0 });
		expect((await allOrders(database)).length).toBe(3);
	});

	it('is an Account page, and the workspace page is for the lead author only', () => {
		expect(accountPages.map((page) => page.link)).toContain('/account/orders');
		expect(can({ role: 'lead-author' } as never, 'manage-book-orders')).toBe(true);
		expect(can({ role: 'editor' } as never, 'manage-book-orders')).toBe(false);
		expect(workspacePagesFor(['manage-book-orders']).map((page) => page.link)).toContain('/workspace/book-orders');
	});
});

describe('problems with an order', () => {
	it('saves a problem with its photo held for the virus check, and shows the answer', async () => {
		await placeOrder(first, 'account-reader', true);
		const photo = { name: 'corner.jpg', type: 'image/jpeg', bytes: new Uint8Array([0xff, 0xd8, 0xff, 0x00]) };
		const saved = await reportProblem(database, bucket, first, { kind: 'damaged', details: 'The corner is crushed.', photo }, '2026-11-26T00:00:00Z');
		if (!saved.saved) throw new Error(saved.reason);
		const key = `book-orders/${first}/${saved.identifier}`;
		expect(stored.has(key)).toBe(true);
		expect((await fileScan(database, key))?.status).toBe('waiting');

		const [problem] = await problemsOfOrder(database, first);
		expect(problem).toMatchObject({ kind: 'damaged', hasPhoto: true, status: 'open', answer: null });
		expect((await ordersOfAccount(database, 'account-reader'))[0].openProblems).toBe(1);

		expect(await answerProblem(database, saved.identifier, 'Lulu is sending a new copy.', 'answered', '2026-11-27T00:00:00Z')).toBe(true);
		expect((await problemsOfOrder(database, first))[0]).toMatchObject({ status: 'answered', answer: 'Lulu is sending a new copy.' });
		expect(await unsettledProblems(database)).toHaveLength(1);
		// Closing without new words keeps the answer.
		await answerProblem(database, saved.identifier, null, 'closed', '2026-11-28T00:00:00Z');
		expect((await problemsOfOrder(database, first))[0]).toMatchObject({ status: 'closed', answer: 'Lulu is sending a new copy.' });
		expect(await unsettledProblems(database)).toHaveLength(0);
	});

	it('refuses more open problems than the limit, so a leaked link cannot flood the project', async () => {
		await placeOrder(first, null, true);
		for (let count = 0; count < openProblemsPerOrder; count += 1) {
			expect((await reportProblem(database, bucket, first, { kind: 'other', details: `Note ${count}`, photo: null }, '2026-11-26T00:00:00Z')).saved).toBe(true);
		}
		const refused = await reportProblem(database, bucket, first, { kind: 'other', details: 'One more', photo: null }, '2026-11-26T00:00:00Z');
		expect(refused.saved).toBe(false);
	});

	it('gives a hint for every kind of problem', () => {
		for (const kind of problemKinds) expect(problemKindHints[kind].length).toBeGreaterThan(10);
	});
});

describe('refunds', () => {
	it('records the total refunded, up to what the buyer paid', async () => {
		await placeOrder(first, 'account-reader', true);
		expect(await recordRefund(database, first, 2342, '2026-11-26T00:00:00Z')).toBe(false);
		expect(await recordRefund(database, first, 2341, '2026-11-26T00:00:00Z')).toBe(true);
		expect((await ordersOfAccount(database, 'account-reader'))[0]).toMatchObject({ refundedCents: 2341, refundedAt: '2026-11-26T00:00:00Z' });
		// Setting it back to 0 clears the date.
		expect(await recordRefund(database, first, 0, '2026-11-27T00:00:00Z')).toBe(true);
		expect((await ordersOfAccount(database, 'account-reader'))[0]).toMatchObject({ refundedCents: 0, refundedAt: null });
	});

	it('unlinks orders from a deleted account', async () => {
		await placeOrder(first, 'account-reader', true);
		await database.prepare('DELETE FROM accounts WHERE identifier = ?').bind('account-reader').run();
		expect(await ordersOfAccount(database, 'account-reader')).toEqual([]);
		expect((await allOrders(database))[0].identifier).toBe(first);
	});
});
