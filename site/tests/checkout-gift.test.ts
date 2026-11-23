import { describe, expect, it } from 'vitest';
import { centsFromText, giftCents, readGiftChoice, roundUpCents } from '#lib/checkout-gift.ts';
import { defaultPrintChoice } from '#lib/book-order.ts';
import { addressForQuote, readBookOrderForm } from '#lib/server/book-order-form.ts';
import { priceParts } from '#lib/server/book-orders.ts';
import { checkoutGift, checkoutGiftReceiver } from '#lib/server/checkout-gifts.ts';
import { createCheckout } from '#lib/server/stripe.ts';

describe('a gift added to a purchase', () => {
	it('rounds up to the next whole $5, and offers nothing when the price is already one', () => {
		expect(roundUpCents(2341)).toBe(159);
		expect(roundUpCents(2500)).toBe(0);
		expect(roundUpCents(2501)).toBe(499);
	});

	it('works out each choice from the price, and refuses an amount out of range', () => {
		expect(giftCents({ kind: 'none' }, 2341)).toEqual({ cents: 0 });
		expect(giftCents({ kind: 'round-up' }, 2341)).toEqual({ cents: 159 });
		expect(giftCents({ kind: 'preset', dollars: 10 }, 2341)).toEqual({ cents: 1000 });
		expect(giftCents({ kind: 'other', cents: 1250 }, 2341)).toEqual({ cents: 1250 });
		expect(giftCents({ kind: 'other', cents: 50 }, 2341)).toHaveProperty('problem');
		expect(giftCents({ kind: 'other', cents: Number.NaN }, 2341)).toHaveProperty('problem');
		expect(giftCents({ kind: 'other', cents: 100001 }, 2341)).toHaveProperty('problem');
	});

	it('reads typed amounts and treats anything unknown as no gift', () => {
		expect(centsFromText('$12.50')).toBe(1250);
		expect(centsFromText('1,000')).toBe(100000);
		expect(centsFromText('12.345')).toBeNaN();
		expect(readGiftChoice({ kind: 'preset', dollars: 7 })).toEqual({ kind: 'none' });
		expect(readGiftChoice({ kind: 'round-up' })).toEqual({ kind: 'round-up' });
		expect(readGiftChoice('anything')).toEqual({ kind: 'none' });
	});

	it('is offered in test mode, and in live mode only once someone is named to receive it', () => {
		expect(checkoutGiftReceiver({} as WorkerEnvironment, 'test')).toContain('test mode');
		expect(checkoutGiftReceiver({} as WorkerEnvironment, 'live')).toBeNull();
		expect(checkoutGift({} as WorkerEnvironment, 'live', { kind: 'preset', dollars: 5 }, 2341)).toHaveProperty('problem');
		expect(checkoutGift({} as WorkerEnvironment, 'live', { kind: 'none' }, 2341)).toEqual({ cents: 0 });
		const named = { SPONSOR_GIFTS_RECEIVER: 'Example Fiscal Sponsor' } as WorkerEnvironment;
		expect(checkoutGift(named, 'live', { kind: 'round-up' }, 2341)).toEqual({ cents: 159 });
	});

	it('goes to Stripe as its own line, apart from the book', async () => {
		let sent = '';
		const fetcher = (async (_address: string, init?: RequestInit) => {
			sent = String(init?.body);
			return new Response(JSON.stringify({ id: 'cs_test_1', url: 'https://checkout.stripe.com/c/pay/cs_test_1' }), { status: 200 });
		}) as typeof fetch;
		await createCheckout(
			{ secretKey: 'sk_test_1', webhookSecret: 'whsec_1' },
			{
				reference: 'order-1',
				description: 'Book',
				amountInCents: 2341,
				gift: { amountInCents: 159, description: 'Gift to Model Tribal ADR Code' },
				successAddress: 'https://example.org/done',
				cancelAddress: 'https://example.org/book'
			},
			fetcher
		);
		const fields = new URLSearchParams(sent);
		expect(fields.get('line_items[0][price_data][unit_amount]')).toBe('2341');
		expect(fields.get('line_items[1][price_data][unit_amount]')).toBe('159');
		expect(fields.get('line_items[1][price_data][product_data][name]')).toBe('Gift to Model Tribal ADR Code');
		expect(fields.get('metadata[gift_cents]')).toBe('159');
	});
});

describe('prices by postal code, in parts', () => {
	it('prices with only the postal code, state and country', () => {
		const read = readBookOrderForm(
			{
				choice: { ...defaultPrintChoice },
				shippingLevel: 'MAIL',
				address: { postcode: '89154', stateCode: 'nv', countryCode: 'us' }
			},
			false
		);
		if (!read.ok) throw new Error(read.problem);
		const address = addressForQuote(read.form.address);
		expect(address).toMatchObject({ postcode: '89154', state_code: 'NV', country_code: 'US' });
		expect(address.city).toBeTruthy();
	});

	it('still needs the city to order', () => {
		const read = readBookOrderForm(
			{
				choice: { ...defaultPrintChoice },
				shippingLevel: 'MAIL',
				address: { name: 'A Reader', street1: '1 Main St', postcode: '89154', stateCode: 'NV', countryCode: 'US', phone: '7025550100' },
				email: 'reader@example.org'
			},
			true
		);
		expect(read).toEqual({ ok: false, problem: 'Enter the city.' });
	});

	it('lists printing, shipping, Lulu’s fee, tax and the card fee, adding up to the price', () => {
		const cost = {
			currency: 'USD',
			total_cost_excl_tax: '16.43',
			total_cost_incl_tax: '17.62',
			total_tax: '1.19',
			shipping_cost: { total_cost_excl_tax: '5.69', total_cost_incl_tax: '6.10' },
			fulfillment_cost: { total_cost_excl_tax: '0.75', total_cost_incl_tax: '0.80' }
		};
		const parts = priceParts(cost, 2341, 0);
		expect(parts.map((part) => part.label)).toEqual(['Printing', 'Shipping', 'Lulu’s order fee', 'Sales tax', 'Card processing fee']);
		expect(parts.reduce((sum, part) => sum + part.cents, 0)).toBe(2341);
		expect(parts[0].cents).toBe(1762 - 569 - 75 - 119);
	});
});
