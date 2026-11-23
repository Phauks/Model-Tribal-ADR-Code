import { beforeEach, describe, expect, it } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types/index.ts';
import { verifiedAccount } from '#lib/server/accounts.ts';
import { createSponsor } from '#lib/server/sponsors.ts';
import {
	givenToward,
	saveSponsorshipCosts,
	sponsorshipCosts,
	sponsorshipGoals,
	type GivenToward
} from '#lib/server/sponsorship-goals.ts';
import { testDatabase } from './database.ts';

let database: D1Database;

beforeEach(() => {
	database = testDatabase();
});

const counts = { nationPages: 947, federallyRecognized: 581, sources: 7165 };

function given(total: Partial<GivenToward['total']>, siteLastYear = 0): GivenToward {
	return { total: { 'needed-most': 0, 'books-for-nations': 0, 'large-format': 0, hosting: 0, ...total }, siteLastYear };
}

describe('the costs the lead author sets', () => {
	it('shows no cost until one is set', async () => {
		expect(await sponsorshipCosts(database)).toEqual({});
	});

	it('keeps the costs set and drops one set blank', async () => {
		await saveSponsorshipCosts(database, { paperback: 1600, hardcover: null, website: 7000 }, 'The project (Trevor)');
		expect(await sponsorshipCosts(database)).toEqual({ paperback: 1600, website: 7000 });
		await saveSponsorshipCosts(database, { paperback: null, hardcover: 2500, website: 7000 }, 'The project (Trevor)');
		expect(await sponsorshipCosts(database)).toEqual({ hardcover: 2500, website: 7000 });
	});
});

describe('what the Sponsorship page shows', () => {
	it('counts the nations but no copies while the cost of a copy is not set', () => {
		const goals = sponsorshipGoals(counts, {}, given({ 'books-for-nations': 50_000 }));
		expect(goals.nations).toBe(581);
		expect(goals.copies).toBeNull();
		expect(goals.cards.every((card) => card.costCents === null && card.share === null)).toBe(true);
	});

	it('counts whole copies paid for, never more than the nations', () => {
		expect(sponsorshipGoals(counts, { paperback: 1600 }, given({ 'books-for-nations': 102_500 })).copies).toEqual({
			costCents: 1600,
			paid: 64
		});
		expect(sponsorshipGoals(counts, { paperback: 1600 }, given({ 'books-for-nations': 5_000_000 })).copies?.paid).toBe(581);
	});

	it('measures the site against this year and hardcovers against every nation', () => {
		const goals = sponsorshipGoals(counts, { website: 7000, hardcover: 2500 }, given({ 'books-for-nations': 145_250, hosting: 99_999 }, 3500));
		expect(goals.cards.map((card) => card.key)).toEqual(['site', 'hardcovers', 'needed-most']);
		expect(goals.cards[0]).toMatchObject({ earmark: 'hosting', costCents: 7000, share: 0.5 });
		expect(goals.cards[1]).toMatchObject({ earmark: 'books-for-nations', costCents: 2500 * 581, share: 0.1 });
		expect(goals.cards[2]).toMatchObject({ earmark: 'needed-most', costCents: null, share: null });
	});
});

describe('totals of gifts', () => {
	it('adds gifts by purpose for one mode, and the site’s for the last year only', async () => {
		const account = await verifiedAccount(database, 'sponsor@example.org');
		const sponsor = await createSponsor(database, { subject: account.identifier, email: account.email }, 'Example Foundation');
		const gift = (object: string, mode: string, cents: number, earmark: string, at: string) =>
			database
				.prepare(
					`INSERT INTO sponsor_gifts (identifier, sponsor_identifier, mode, stripe_object, kind, amount_cents, currency, earmark, received_at)
					 VALUES (?, ?, ?, ?, 'one-time', ?, 'usd', ?, ?)`
				)
				.bind(object, sponsor.identifier, mode, object, cents, earmark, at)
				.run();
		await gift('a', 'test', 1600, 'books-for-nations', '2026-11-20T00:00:00.000Z');
		await gift('b', 'test', 3200, 'books-for-nations', '2026-11-21T00:00:00.000Z');
		await gift('c', 'live', 9900, 'books-for-nations', '2026-11-21T00:00:00.000Z');
		await gift('d', 'test', 7000, 'hosting', '2025-01-01T00:00:00.000Z');
		await gift('e', 'test', 2000, 'hosting', '2026-11-01T00:00:00.000Z');
		const totals = await givenToward(database, 'test', new Date('2026-11-23T00:00:00.000Z'));
		expect(totals.total['books-for-nations']).toBe(4800);
		expect(totals.total.hosting).toBe(9000);
		expect(totals.total['needed-most']).toBe(0);
		expect(totals.siteLastYear).toBe(2000);
	});
});
