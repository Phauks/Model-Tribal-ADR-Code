import { beforeEach, describe, expect, it } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types/index.ts';
import { verifiedAccount } from '#lib/server/accounts.ts';
import type { SignedInAccount } from '#lib/server/contributor-profiles.ts';
import { currentLevel, homeRow } from '#lib/server/sponsor-row.ts';
import {
	createSponsor,
	recordGift,
	saveListing,
	saveStripeCustomer,
	setHiddenByProject,
	setHomeRowPlacement,
	sponsorByIdentifier,
	type Sponsor
} from '#lib/server/sponsors.ts';
import { defaultMonthlyCents } from '#lib/sponsorship-levels.ts';
import { testDatabase } from './database.ts';

const at = new Date('2026-12-15T12:00:00Z');
const daysBefore = (days: number) => new Date(at.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

describe('the level a sponsor gives at now', () => {
	const amounts = defaultMonthlyCents;

	it('counts the latest monthly gift within 35 days and the latest yearly gift within a year', () => {
		expect(currentLevel([{ kind: 'monthly', amountCents: 10000, receivedAt: daysBefore(10) }], amounts, at)).toBe('patron');
		expect(currentLevel([{ kind: 'monthly', amountCents: 10000, receivedAt: daysBefore(40) }], amounts, at)).toBeNull();
		// A year costs ten months: $5,000 a year is a Benefactor's $500 a month.
		expect(currentLevel([{ kind: 'yearly', amountCents: 500000, receivedAt: daysBefore(300) }], amounts, at)).toBe('benefactor');
		expect(currentLevel([{ kind: 'yearly', amountCents: 500000, receivedAt: daysBefore(420) }], amounts, at)).toBeNull();
	});

	it('takes the latest monthly gift, so a smaller gift lowers the level', () => {
		const gifts = [
			{ kind: 'monthly' as const, amountCents: 50000, receivedAt: daysBefore(31) },
			{ kind: 'monthly' as const, amountCents: 2500, receivedAt: daysBefore(1) }
		];
		expect(currentLevel(gifts, amounts, at)).toBe('supporter');
	});

	it('gives no level for a one-time gift, however large', () => {
		expect(currentLevel([{ kind: 'one-time', amountCents: 1000000, receivedAt: daysBefore(1) }], amounts, at)).toBeNull();
	});
});

describe('the home page row', () => {
	let database: D1Database;
	let manager: SignedInAccount;
	let sponsor: Sponsor;
	const actor = () => ({ account: manager.subject, name: manager.email });
	const project = { account: null, name: 'The project' };

	async function give(kind: 'one-time' | 'monthly' | 'yearly', amountCents: number, days = 1) {
		await recordGift(database, { mode: 'test', customer: 'cus_test_1', stripeObject: `in_${kind}_${amountCents}_${days}`, kind, amountCents, currency: 'usd' }, daysBefore(days));
	}

	async function choose(changes: Partial<Parameters<typeof saveListing>[3]>) {
		sponsor = (await sponsorByIdentifier(database, sponsor.identifier)) as Sponsor;
		await saveListing(database, sponsor, actor(), { name: sponsor.name, link: null, oneLine: null, listing: sponsor.listing, earmark: sponsor.earmark, ...changes });
		sponsor = (await sponsorByIdentifier(database, sponsor.identifier)) as Sponsor;
	}

	beforeEach(async () => {
		database = testDatabase();
		const created = await verifiedAccount(database, 'manager@example.org');
		manager = { subject: created.identifier, email: created.email, name: null };
		sponsor = await createSponsor(database, manager, 'Example Foundation');
		await saveStripeCustomer(database, sponsor, 'test', 'cus_test_1', actor());
		await choose({ listing: 'name' });
	});

	it('shows a Patron by name only once they choose it', async () => {
		await give('monthly', 10000);
		expect(await homeRow(database, 'test', at)).toEqual([]);
		await choose({ homeRowChosen: true });
		expect(await homeRow(database, 'test', at)).toEqual([{ name: 'Example Foundation', slug: sponsor.slug, logo: false }]);
	});

	it('leaves out sponsors below Patron, and every one in another mode', async () => {
		await choose({ homeRowChosen: true });
		await give('monthly', 2500);
		expect(await homeRow(database, 'test', at)).toEqual([]);
		await give('monthly', 50000, 0);
		expect(await homeRow(database, 'live', at)).toEqual([]);
	});

	it('never shows an anonymous or unlisted sponsor, or one the project took off', async () => {
		await give('monthly', 50000);
		await choose({ homeRowChosen: true, listing: 'anonymous' });
		expect(await homeRow(database, 'test', at)).toEqual([]);
		await choose({ listing: 'hidden' });
		expect(await homeRow(database, 'test', at)).toEqual([]);
		await choose({ listing: 'name' });
		expect(await homeRow(database, 'test', at)).toHaveLength(1);
		await setHiddenByProject(database, sponsor, true, 'Asked by phone', project);
		expect(await homeRow(database, 'test', at)).toEqual([]);
	});

	it('lets the lead author place a sponsor in the row whatever they give, or keep one off it', async () => {
		await give('one-time', 2000);
		expect(await homeRow(database, 'test', at)).toEqual([]);
		await setHomeRowPlacement(database, sponsor, 'always', project);
		expect(await homeRow(database, 'test', at)).toHaveLength(1);

		sponsor = (await sponsorByIdentifier(database, sponsor.identifier)) as Sponsor;
		await give('monthly', 50000);
		await choose({ homeRowChosen: true });
		await setHomeRowPlacement(database, sponsor, 'never', project);
		expect(await homeRow(database, 'test', at)).toEqual([]);
	});

	it('never sends an amount or a level', async () => {
		await choose({ homeRowChosen: true });
		await give('monthly', 12345);
		const row = await homeRow(database, 'test', at);
		expect(row).toHaveLength(1);
		expect(JSON.stringify(row)).not.toMatch(/12345|patron|benefactor/i);
	});
});
