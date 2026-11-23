import { beforeEach, describe, expect, it } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types/index.ts';
import { deleteAccount } from '#lib/server/account-deletion.ts';
import { verifiedAccount } from '#lib/server/accounts.ts';
import type { SignedInAccount } from '#lib/server/contributor-profiles.ts';
import {
	acceptInvitation,
	allSponsors,
	checkedLink,
	createInvitation,
	createSponsor,
	giftSettingChecks,
	giftState,
	historyOf,
	invitationFor,
	isManager,
	logoType,
	managersOf,
	openInvitations,
	publicSponsor,
	publicSponsors,
	recordGift,
	removeManager,
	saveListing,
	saveStripeCustomer,
	setHiddenByProject,
	sponsorByIdentifier,
	withdrawInvitation,
	type Sponsor
} from '#lib/server/sponsors.ts';
import { createGiftCheckout } from '#lib/server/stripe.ts';
import { dollars, initials, slugFor } from '#lib/sponsorship.ts';
import { testDatabase } from './database.ts';

let database: D1Database;
let first: SignedInAccount;
let second: SignedInAccount;

async function account(email: string): Promise<SignedInAccount> {
	const created = await verifiedAccount(database, email);
	return { subject: created.identifier, email: created.email, name: null };
}

const actor = (who: SignedInAccount) => ({ account: who.subject, name: who.email });

beforeEach(async () => {
	database = testDatabase();
	first = await account('first@example.org');
	second = await account('second@example.org');
});

describe('whether sponsors can give', () => {
	it('stays closed until SPONSOR_GIFTS is set', () => {
		const state = giftState({ STRIPE_SECRET_KEY: 'sk_test_1', STRIPE_SPONSOR_WEBHOOK_SECRET: 'whsec_1' } as WorkerEnvironment);
		expect(state.open).toBe(false);
	});

	it('opens test mode only with a Stripe test key', () => {
		const settings = { SPONSOR_GIFTS: 'test', STRIPE_SPONSOR_WEBHOOK_SECRET: 'whsec_1' };
		expect(giftState({ ...settings, STRIPE_SECRET_KEY: 'sk_live_1' } as WorkerEnvironment).open).toBe(false);
		const state = giftState({ ...settings, STRIPE_SECRET_KEY: 'rk_test_1' } as WorkerEnvironment);
		expect(state.open && state.mode).toBe('test');
	});

	it('opens live mode only with a live key and someone named to receive the money', () => {
		const settings = { SPONSOR_GIFTS: 'live', STRIPE_SECRET_KEY: 'sk_live_1', STRIPE_SPONSOR_WEBHOOK_SECRET: 'whsec_1' };
		expect(giftState(settings as WorkerEnvironment).open).toBe(false);
		const state = giftState({ ...settings, SPONSOR_GIFTS_RECEIVER: 'Example Fiscal Sponsor' } as WorkerEnvironment);
		expect(state.open && state.receiver).toBe('Example Fiscal Sponsor');
		expect(giftState({ ...settings, STRIPE_SECRET_KEY: 'sk_test_1', SPONSOR_GIFTS_RECEIVER: 'Example' } as WorkerEnvironment).open).toBe(false);
	});

	it('tells the lead author which setting is wrong without showing a secret', () => {
		const checks = giftSettingChecks({ SPONSOR_GIFTS: 'test', STRIPE_SECRET_KEY: 'sk_live_secret' } as WorkerEnvironment);
		expect(checks.map((check) => [check.name, check.ok])).toEqual([
			['SPONSOR_GIFTS', true],
			['STRIPE_SECRET_KEY', false],
			['STRIPE_SPONSOR_WEBHOOK_SECRET', false],
			['SPONSOR_GIFTS_RECEIVER', true]
		]);
		expect(JSON.stringify(checks)).not.toContain('sk_live_secret');
	});
});

describe('names, links and logos', () => {
	it('makes an address from the name', () => {
		expect(slugFor('Example Community Foundation')).toBe('example-community-foundation');
		expect(slugFor('Bar & Bench Société')).toBe('bar-and-bench-societe');
		expect(slugFor('!!!')).toBe('sponsor');
		expect(initials('The Example Community Foundation')).toBe('EC');
		expect(dollars(125000)).toBe('$1,250');
		expect(dollars(1250)).toBe('$12.50');
	});

	it('takes only secure web links', () => {
		expect(checkedLink('example.org')).toEqual({ link: 'https://example.org/' });
		expect(checkedLink('http://example.org')).toHaveProperty('problem');
		expect(checkedLink('javascript:alert(1)')).toHaveProperty('problem');
		expect(checkedLink('https://user:secret@example.org')).toHaveProperty('problem');
		expect(checkedLink(null)).toEqual({ link: null });
	});

	it('knows a logo by its first bytes and refuses anything else', () => {
		expect(logoType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe('image/png');
		expect(logoType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
		expect(logoType(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]))).toBe('image/webp');
		expect(logoType(new TextEncoder().encode('<svg onload="alert(1)"></svg>'))).toBeNull();
	});
});

describe('a sponsorship and its managers', () => {
	it('starts with its founder as manager, and two sponsors never share an address', async () => {
		const one = await createSponsor(database, first, 'Example Foundation');
		const two = await createSponsor(database, second, 'Example Foundation');
		expect(one.slug).toBe('example-foundation');
		expect(two.slug).toBe('example-foundation-2');
		expect(await isManager(database, one.identifier, first.subject)).toBe(true);
		expect(await isManager(database, one.identifier, second.subject)).toBe(false);
	});

	it('records which parts of the listing changed', async () => {
		const sponsor = await createSponsor(database, first, 'Example Foundation');
		const saved = await saveListing(database, sponsor, actor(first), {
			name: 'Example Community Foundation',
			link: 'https://example.org/',
			oneLine: null,
			listing: 'name',
			earmark: 'books-for-nations'
		});
		expect(saved.slug).toBe('example-community-foundation');
		const [latest] = await historyOf(database, sponsor.identifier);
		expect(latest.action).toBe('Changed the listing');
		expect(latest.note).toBe('name, link, how they are listed, where the gift goes');
	});

	it('adds a manager by an invitation link that works once', async () => {
		const sponsor = await createSponsor(database, first, 'Example Foundation');
		const token = await createInvitation(database, sponsor, actor(first), 'second@example.org');
		expect(await openInvitations(database, sponsor.identifier)).toHaveLength(1);
		expect((await acceptInvitation(database, token, second))?.identifier).toBe(sponsor.identifier);
		expect(await isManager(database, sponsor.identifier, second.subject)).toBe(true);
		expect(await acceptInvitation(database, token, second)).toBeNull();
		expect(await openInvitations(database, sponsor.identifier)).toHaveLength(0);
	});

	it('stops a link that expired or was withdrawn', async () => {
		const sponsor = await createSponsor(database, first, 'Example Foundation');
		const old = await createInvitation(database, sponsor, actor(first), 'old', new Date('2026-01-01T00:00:00Z'));
		expect(await invitationFor(database, old)).toBeNull();
		const token = await createInvitation(database, sponsor, actor(first), 'withdrawn');
		const [open] = await openInvitations(database, sponsor.identifier);
		await withdrawInvitation(database, sponsor, actor(first), open.identifier);
		expect(await acceptInvitation(database, token, second)).toBeNull();
	});

	it('never removes the last manager', async () => {
		const sponsor = await createSponsor(database, first, 'Example Foundation');
		expect(await removeManager(database, sponsor, actor(first), first.subject)).toBe('last-manager');
		await acceptInvitation(database, await createInvitation(database, sponsor, actor(first), 'second'), second);
		expect(await removeManager(database, sponsor, actor(first), second.subject)).toBe('removed');
		expect((await managersOf(database, sponsor.identifier)).map((manager) => manager.email)).toEqual(['first@example.org']);
	});

	it('forgets a manager who deletes their account, and their address in the history', async () => {
		const sponsor = await createSponsor(database, first, 'Example Foundation');
		await acceptInvitation(database, await createInvitation(database, sponsor, actor(first), 'second'), second);
		await deleteAccount(database, second, false);
		expect(await managersOf(database, sponsor.identifier)).toHaveLength(1);
		const actors = (await historyOf(database, sponsor.identifier)).map((entry) => entry.actor);
		expect(actors).not.toContain('second@example.org');
		expect(actors).toContain('A former manager');
	});
});

describe('gifts and the public pages', () => {
	let sponsor: Sponsor;

	beforeEach(async () => {
		sponsor = await createSponsor(database, first, 'Example Foundation');
		await saveStripeCustomer(database, sponsor, 'test', 'cus_test_1', actor(first));
		sponsor = (await sponsorByIdentifier(database, sponsor.identifier)) as Sponsor;
	});

	it('records each gift once, for the sponsor whose Stripe customer paid it', async () => {
		const gift = { mode: 'test' as const, customer: 'cus_test_1', stripeObject: 'cs_1', kind: 'one-time' as const, amountCents: 5000, currency: 'usd' };
		expect(await recordGift(database, gift)).toBe(true);
		expect(await recordGift(database, gift)).toBe(false);
		expect(await recordGift(database, { ...gift, customer: 'cus_unknown', stripeObject: 'cs_2' })).toBe(false);
		// A live gift never matches a test customer.
		expect(await recordGift(database, { ...gift, mode: 'live', stripeObject: 'cs_3' })).toBe(false);
	});

	it('shows a sponsor only after a gift in the mode the site counts, as they chose, never with the amount', async () => {
		expect(await publicSponsors(database, 'test')).toHaveLength(0);
		await recordGift(database, { mode: 'test', customer: 'cus_test_1', stripeObject: 'in_1', kind: 'monthly', amountCents: 10000, currency: 'usd' });
		expect(await publicSponsors(database, 'live')).toHaveLength(0);
		const [shown] = await publicSponsors(database, 'test');
		expect(shown.name).toBe('Example Foundation');
		expect(JSON.stringify(shown)).not.toContain('10000');
		expect(await publicSponsor(database, sponsor.slug, 'test')).not.toBeNull();

		await saveListing(database, sponsor, actor(first), { name: sponsor.name, link: null, oneLine: null, listing: 'anonymous', earmark: 'hosting' });
		const [anonymous] = await publicSponsors(database, 'test');
		expect(anonymous).toMatchObject({ name: null, slug: null, link: null });
		expect(await publicSponsor(database, sponsor.slug, 'test')).toBeNull();

		const current = (await sponsorByIdentifier(database, sponsor.identifier)) as Sponsor;
		await setHiddenByProject(database, current, true, 'Asked to be removed by phone', { account: null, name: 'The project' });
		expect(await publicSponsors(database, 'test')).toHaveLength(0);
		const [overview] = await allSponsors(database, 'test');
		expect(overview.status.reason).toContain('taken this sponsor off');
		expect(overview.gifts.test).toMatchObject({ count: 1, totalCents: 10000 });
	});
});

describe('Stripe Checkout for a gift', () => {
	it('asks for a monthly subscription tied to the sponsor', async () => {
		let sent = '';
		const fetcher = (async (_address: string, init?: RequestInit) => {
			sent = String(init?.body);
			return new Response(JSON.stringify({ url: 'https://checkout.stripe.com/c/pay/cs_test_1' }), { status: 200 });
		}) as typeof fetch;
		const address = await createGiftCheckout(
			{ secretKey: 'sk_test_1' },
			{
				customer: 'cus_test_1',
				sponsor: 'sponsor-1',
				amountInCents: 10000,
				monthly: true,
				description: 'Gift',
				successAddress: 'https://example.org/thanks',
				cancelAddress: 'https://example.org/'
			},
			fetcher
		);
		expect(address).toBe('https://checkout.stripe.com/c/pay/cs_test_1');
		const fields = new URLSearchParams(sent);
		expect(fields.get('mode')).toBe('subscription');
		expect(fields.get('customer')).toBe('cus_test_1');
		expect(fields.get('line_items[0][price_data][recurring][interval]')).toBe('month');
		expect(fields.get('subscription_data[metadata][sponsor]')).toBe('sponsor-1');
		expect(fields.get('submit_type')).toBeNull();
	});
});
