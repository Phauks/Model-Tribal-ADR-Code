import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import {
	bookAuthor,
	bookSizes,
	choiceProblem,
	defaultPrintChoice,
	estimatedPrintCost,
	foilStampText,
	podPackageIdentifier,
	soldInBookstores,
	type PrintChoice
} from '#lib/book-order.ts';
import { fileSetFor, readBookOrderForm } from '#lib/server/book-order-form.ts';
import {
	fileLink,
	isFileLinkKey,
	markPaid,
	orderByIdentifier,
	orderingState,
	readerPriceCents,
	recordPaymentSession,
	recordPrinterStatus,
	recordPrintJob,
	removeOldPersonalDetails,
	saveOrder
} from '#lib/server/book-orders.ts';
import { calculateCost, forgetLuluToken, hmacSha256Hex, isLuluWebhook } from '#lib/server/lulu.ts';
import { formEncode, isStripeWebhook } from '#lib/server/stripe.ts';
import { testDatabase } from './database.ts';

const repository = path.resolve(import.meta.dirname, '../..');

describe('Lulu product codes', () => {
	it('matches the examples in Lulu’s documentation', () => {
		expect(podPackageIdentifier(defaultPrintChoice)).toBe('0600X0900.BW.STD.PB.060UW444.MXX');
		expect(
			podPackageIdentifier({ ...defaultPrintChoice, size: 'us-letter', binding: 'linenWrap', linenColor: 'navy', foilColor: 'gold' })
		).toBe('0850X1100.BW.STD.LW.060UW444.MNG');
		expect(podPackageIdentifier({ ...defaultPrintChoice, size: 'pocket-book', finish: 'gloss' })).toBe(
			'0425X0688.BW.STD.PB.060UW444.GXX'
		);
	});

	it('offers exactly the sizes the print build lays out', () => {
		const sizes = parse(readFileSync(path.join(repository, 'pdf/book-sizes.yaml'), 'utf8')) as {
			trims: Record<string, { name: string; width: number; height: number }>;
		};
		expect(bookSizes.map((size) => size.identifier).sort()).toEqual(Object.keys(sizes.trims).sort());
		for (const size of bookSizes) {
			expect(size.width).toBe(sizes.trims[size.identifier].width);
			expect(size.height).toBe(sizes.trims[size.identifier].height);
		}
	});

	it('names the same author as the print build', () => {
		const book = parse(readFileSync(path.join(repository, 'pdf/book.yaml'), 'utf8')) as { metadata: { author: string } };
		expect(bookAuthor).toBe(book.metadata.author);
	});

	it('keeps foil stamping within Lulu’s 42 characters', () => {
		const text = foilStampText('A very long title for a book that will not fit on a spine');
		expect(text.foil_stamp_title_text.length + text.foil_stamp_author_text.length).toBeLessThanOrEqual(42);
	});

	it('refuses page counts Lulu cannot bind', () => {
		expect(choiceProblem(defaultPrintChoice, 31)).toMatch(/32 to 800/);
		expect(choiceProblem(defaultPrintChoice, 300)).toBeUndefined();
		expect(choiceProblem({ ...defaultPrintChoice, size: 'tabloid' })).toMatch(/size/);
	});

	it('says which copies bookstores can order', () => {
		expect(soldInBookstores(defaultPrintChoice)).toBe(true);
		expect(soldInBookstores({ ...defaultPrintChoice, binding: 'coilBound' })).toBe(false);
		expect(soldInBookstores({ ...defaultPrintChoice, ink: 'premiumBlackAndWhite' })).toBe(false);
	});
});

describe('estimates', () => {
	// Prices read in Lulu's pricing calculator on Nov. 23, 2026.
	it.each([
		['us-trade', 'paperback', 300, 9.49],
		['us-trade', 'paperback', 500, 14.49],
		['us-trade', 'paperback', 100, 4.49],
		['us-trade', 'caseWrap', 300, 18.18],
		['us-trade', 'caseWrap', 500, 23.18],
		['us-trade', 'linenWrap', 300, 22.49],
		['us-letter', 'paperback', 300, 13.71],
		['us-letter', 'paperback', 500, 21.41],
		['us-letter', 'caseWrap', 300, 22.53],
		['us-letter', 'coilBound', 300, 18.5],
		['executive', 'paperback', 300, 13.71],
		['a4', 'paperback', 300, 13.71]
	] as const)('%s %s at %i pages is within 5 cents of $%f', (size, binding, pages, price) => {
		const choice: PrintChoice = { ...defaultPrintChoice, size, binding };
		expect(Math.abs(estimatedPrintCost(choice, pages) - price)).toBeLessThanOrEqual(0.05);
	});
});

describe('reading an order', () => {
	const body = {
		choice: { size: 'us-trade', binding: 'paperback', ink: 'standardBlackAndWhite', paper: 'whiteUncoated', finish: 'matte' },
		shippingLevel: 'MAIL',
		address: { name: 'A Reader', street1: '1 Main St', city: 'Las Vegas', stateCode: 'nv', postcode: '89154', countryCode: 'us', phone: '7025550100' },
		email: 'reader@example.org'
	};

	it('reads a complete order', () => {
		const read = readBookOrderForm(body, true);
		expect(read.ok).toBe(true);
		if (read.ok) {
			expect(read.form.address.state_code).toBe('NV');
			expect(read.form.address.country_code).toBe('US');
			expect(fileSetFor(read.form.choice)).toBe('current/us-trade/paperback');
		}
	});

	it('needs only a place for a price, but a full address and email for an order', () => {
		const placeOnly = { ...body, address: { city: 'Las Vegas', stateCode: 'NV', postcode: '89154', countryCode: 'US' }, email: '' };
		expect(readBookOrderForm(placeOnly, false).ok).toBe(true);
		expect(readBookOrderForm(placeOnly, true)).toEqual({ ok: false, problem: 'Enter the name and street address.' });
	});

	it('refuses unknown choices', () => {
		expect(readBookOrderForm({ ...body, choice: { ...body.choice, binding: 'spiral' } }, false)).toEqual({ ok: false, problem: 'Choose a binding.' });
		expect(readBookOrderForm({ ...body, shippingLevel: 'TELEPORT' }, false)).toEqual({ ok: false, problem: 'Choose how the book is shipped.' });
	});
});

describe('when ordering is open', () => {
	const complete = {
		BOOK_ORDERS: 'test',
		BOOK_ORDERS_CONTACT_EMAIL: 'project@example.org',
		BOOK_FILE_LINK_SECRET: 'links',
		LULU_ENVIRONMENT: 'sandbox',
		LULU_CLIENT_KEY: 'key',
		LULU_CLIENT_SECRET: 'secret',
		STRIPE_SECRET_KEY: 'sk_test_123',
		STRIPE_WEBHOOK_SECRET: 'whsec_123'
	} as unknown as WorkerEnvironment;

	it('is closed by default', () => {
		expect(orderingState({} as WorkerEnvironment).open).toBe(false);
		expect(orderingState({ ...complete, BOOK_ORDERS: 'off' }).open).toBe(false);
	});

	it('opens in test mode only with Lulu’s sandbox and a Stripe test key', () => {
		expect(orderingState(complete).open).toBe(true);
		expect(orderingState({ ...complete, LULU_ENVIRONMENT: 'production' }).open).toBe(false);
		expect(orderingState({ ...complete, STRIPE_SECRET_KEY: 'sk_live_123' }).open).toBe(false);
	});

	it('opens live only with Lulu production and a live Stripe key', () => {
		expect(orderingState({ ...complete, BOOK_ORDERS: 'live' }).open).toBe(false);
		expect(orderingState({ ...complete, BOOK_ORDERS: 'live', LULU_ENVIRONMENT: 'production', STRIPE_SECRET_KEY: 'sk_live_123' }).open).toBe(true);
	});

	it('closes when any setting is missing', () => {
		expect(orderingState({ ...complete, BOOK_FILE_LINK_SECRET: undefined }).open).toBe(false);
	});
});

describe('prices', () => {
	it('covers Lulu’s quote, the margin and Stripe’s card fee', () => {
		const price = readerPriceCents(1593, 0);
		const stripeFee = Math.round(price * 0.029) + 30;
		expect(price - stripeFee).toBeGreaterThanOrEqual(1593);
		expect(price - stripeFee - 1593).toBeLessThanOrEqual(1);
		expect(readerPriceCents(1593, 200)).toBeGreaterThan(price + 200);
	});
});

describe('signatures', () => {
	it('accepts Lulu webhooks signed with the API secret and nothing else', async () => {
		const settings = { environment: 'sandbox' as const, clientKey: 'key', clientSecret: 'secret' };
		const body = '{"topic":"PRINT_JOB_STATUS_CHANGED","data":{"id":1}}';
		const signature = await hmacSha256Hex('secret', body);
		expect(await isLuluWebhook(settings, body, signature)).toBe(true);
		expect(await isLuluWebhook(settings, `${body} `, signature)).toBe(false);
		expect(await isLuluWebhook(settings, body, null)).toBe(false);
	});

	it('accepts recent Stripe webhooks and refuses old or altered ones', async () => {
		const settings = { secretKey: 'sk_test_1', webhookSecret: 'whsec_1' };
		const body = '{"type":"checkout.session.completed"}';
		const time = 1_800_000_000;
		const header = `t=${time},v1=${await hmacSha256Hex('whsec_1', `${time}.${body}`)}`;
		expect(await isStripeWebhook(settings, body, header, time + 10)).toBe(true);
		expect(await isStripeWebhook(settings, body, header, time + 1000)).toBe(false);
		expect(await isStripeWebhook(settings, body.replace('completed', 'expired'), header, time + 10)).toBe(false);
	});

	it('signs each file link for one file only', async () => {
		const link = await fileLink('https://example.org', 'links', 'current/us-trade/paperback', 'interior.pdf');
		const key = new URL(link).searchParams.get('key');
		expect(link).toMatch(/^https:\/\/example\.org\/book\/files\/current\/us-trade\/paperback\/interior\.pdf\?key=/);
		expect(await isFileLinkKey('links', 'current/us-trade/paperback', 'interior.pdf', key)).toBe(true);
		expect(await isFileLinkKey('links', 'current/us-trade/paperback', 'cover.pdf', key)).toBe(false);
		expect(await isFileLinkKey('other', 'current/us-trade/paperback', 'interior.pdf', key)).toBe(false);
	});

	it('encodes Stripe’s nested form fields', () => {
		expect(formEncode({ 'line_items[0][quantity]': 1, skipped: undefined })).toBe('line_items%5B0%5D%5Bquantity%5D=1');
	});
});

describe('Lulu client', () => {
	afterEach(() => forgetLuluToken());

	it('signs in once and asks for a price at the sandbox', async () => {
		const calls: { address: string; init?: RequestInit }[] = [];
		const fakeFetch = (async (address: string, init?: RequestInit) => {
			calls.push({ address, init });
			if (address.endsWith('/token')) return new Response(JSON.stringify({ access_token: 'token-1', expires_in: 3600 }));
			return new Response(JSON.stringify({ currency: 'USD', total_cost_excl_tax: '15.93', total_cost_incl_tax: '16.89', total_tax: '0.96' }), {
				status: 201
			});
		}) as typeof fetch;
		const settings = { environment: 'sandbox' as const, clientKey: 'key', clientSecret: 'secret' };
		const order = {
			line_items: [{ pod_package_id: '0600X0900.BW.STD.PB.060UW444.MXX', page_count: 300, quantity: 1 }],
			shipping_address: { street1: '1 Main St', city: 'Las Vegas', state_code: 'NV', postcode: '89154', country_code: 'US', phone_number: '7025550100' },
			shipping_option: 'MAIL' as const
		};
		await calculateCost(settings, order, fakeFetch);
		const cost = await calculateCost(settings, order, fakeFetch);
		expect(cost.total_cost_incl_tax).toBe('16.89');
		expect(calls.filter((call) => call.address.endsWith('/token'))).toHaveLength(1);
		expect(calls[0].address).toBe('https://api.sandbox.lulu.com/auth/realms/glasstree/protocol/openid-connect/token');
		expect((calls[0].init?.headers as Record<string, string>).authorization).toBe(`Basic ${btoa('key:secret')}`);
		expect(calls[1].address).toBe('https://api.sandbox.lulu.com/print-job-cost-calculations/');
	});
});

describe('order records', () => {
	it('follows an order from payment to shipping, then forgets the address', async () => {
		const database = testDatabase();
		await saveOrder(
			database,
			{
				identifier: '11111111-2222-3333-4444-555555555555',
				mode: 'test',
				fileSet: { identifier: 'current/us-trade/paperback', title: 'Model Tribal ADR Code', pages: 300, size: 'us-trade', binding: 'paperback' },
				choice: defaultPrintChoice,
				shippingLevel: 'MAIL',
				shippingAddress: { name: 'A Reader', street1: '1 Main St', city: 'Las Vegas', state_code: 'NV', postcode: '89154', country_code: 'US', phone_number: '1' },
				email: 'reader@example.org',
				printerCostCents: 1689,
				priceCents: 1771
			},
			'2026-11-23T00:00:00Z'
		);
		const identifier = '11111111-2222-3333-4444-555555555555';
		await recordPaymentSession(database, identifier, 'cs_test_1', '2026-11-23T00:01:00Z');
		expect(await markPaid(database, identifier, 'cs_test_1', '2026-11-23T00:02:00Z')).toBe(true);
		// A repeated payment event does not send the order twice.
		expect(await markPaid(database, identifier, 'cs_test_1', '2026-11-23T00:02:01Z')).toBe(false);
		await recordPrintJob(database, identifier, 42, 'CREATED', '2026-11-23T00:03:00Z');
		await recordPrinterStatus(database, 42, 'SHIPPED', 'All line-items were shipped', 'https://tracking.example/1', '2026-11-25T00:00:00Z');
		const shipped = await orderByIdentifier(database, identifier);
		expect(shipped?.status).toBe('shipped');
		expect(shipped?.tracking_link).toBe('https://tracking.example/1');

		expect(await removeOldPersonalDetails(database, new Date('2026-12-01T00:00:00Z'))).toBe(0);
		expect(await removeOldPersonalDetails(database, new Date('2027-03-01T00:00:00Z'))).toBe(1);
		const forgotten = await orderByIdentifier(database, identifier);
		expect([forgotten?.recipient_name, forgotten?.shipping_address, forgotten?.email]).toEqual([null, null, null]);
	});
});
