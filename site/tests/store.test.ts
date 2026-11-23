import { describe, expect, it } from 'vitest';
import { defaultPrintChoice } from '#lib/book-order.ts';
import { bookLine, kindsOf, statusOfBookOrder, type OrderSummary } from '#lib/orders.ts';
import { addressFromPayment, needsAddressFromPayment } from '#lib/server/book-orders.ts';
import { createCheckout } from '#lib/server/stripe.ts';
import { merchandiseOnSale, standardFormats } from '#lib/store.ts';

describe('the Store', () => {
	it('sells the standard formats, each a choice Lulu can print', () => {
		expect(standardFormats.map((format) => format.identifier)).toEqual(['paperback', 'hardcover', 'large-paperback']);
		expect(new Set(standardFormats.map((format) => format.identifier)).size).toBe(standardFormats.length);
	});

	it('lists merchandise only once it can be bought', () => {
		expect(merchandiseOnSale()).toEqual([]);
		expect(
			merchandiseOnSale([
				{ identifier: 'mug', label: 'Mug', status: 'planned' },
				{ identifier: 'shirt', label: 'T-shirt', status: 'available', priceCents: 2400 }
			]).map((item) => item.identifier)
		).toEqual(['shirt']);
	});
});

describe('orders for any kind of item', () => {
	it('names a standard format by its Store name and anything else a special order', () => {
		expect(bookLine({ ...defaultPrintChoice }, 312, 104882, 'IN_PRODUCTION')).toEqual({
			kind: 'book',
			label: 'Paperback',
			detail: '6 × 9 in, 312 pages',
			quantity: 1,
			maker: 'Lulu',
			makerJob: '104882',
			makerStatus: 'IN_PRODUCTION'
		});
		expect(bookLine({ ...defaultPrintChoice, binding: 'caseWrap' }, 312).label).toBe('Hardcover');
		const special = bookLine({ ...defaultPrintChoice, size: 'us-letter', binding: 'coilBound' }, 312);
		expect(special.label).toBe('Special order');
		expect(special.detail).toBe('US Letter coil bound, 312 pages');
		expect(bookLine({ ...defaultPrintChoice, paper: 'creamUncoated' }, 312).label).toBe('Special order');
	});

	it('turns printing statuses into general ones', () => {
		expect(statusOfBookOrder('sent-to-printer')).toBe('in-production');
		expect(statusOfBookOrder('printer-refused')).toBe('maker-refused');
		expect(statusOfBookOrder('shipped')).toBe('shipped');
	});

	it('filters an order by the kinds of item in it', () => {
		const order = { lines: [bookLine({ ...defaultPrintChoice }, 312), { kind: 'merchandise', label: 'Mug', detail: '', quantity: 1, maker: 'Maker' }] } as OrderSummary;
		expect(kindsOf(order)).toEqual(['book', 'merchandise']);
	});
});

describe('buying in one step', () => {
	const priced = { country_code: 'US', state_code: 'NV', postcode: '89154' };
	const paid = {
		customer_details: { email: 'reader@example.org', phone: '+17025550100', name: 'A Reader' },
		collected_information: {
			shipping_details: { name: 'A Reader', address: { line1: '4505 S Maryland Pkwy', line2: null, city: 'Las Vegas', state: 'NV', postal_code: '89154-1003', country: 'US' } }
		}
	};

	it('knows an order that still needs its street address', () => {
		expect(needsAddressFromPayment({ shipping_address: JSON.stringify({ ...priced, name: '', street1: '' }) })).toBe(true);
		expect(needsAddressFromPayment({ shipping_address: JSON.stringify({ ...priced, name: 'A', street1: '1 Main St' }) })).toBe(false);
	});

	it('takes the address from Stripe’s page when it matches the priced postal code', () => {
		const read = addressFromPayment(paid, priced);
		expect(read).toMatchObject({ ok: true, email: 'reader@example.org' });
		if (read.ok) expect(read.address).toMatchObject({ name: 'A Reader', street1: '4505 S Maryland Pkwy', city: 'Las Vegas', postcode: '89154-1003', phone_number: '+17025550100' });
		// Older Stripe API versions put it under shipping_details.
		expect(addressFromPayment({ customer_details: paid.customer_details, shipping_details: paid.collected_information.shipping_details }, priced).ok).toBe(true);
	});

	it('refuses an address in another postal code, since the price was for this one', () => {
		const moved = { ...paid, collected_information: { shipping_details: { name: 'A Reader', address: { ...paid.collected_information.shipping_details.address, postal_code: '10001' } } } };
		expect(addressFromPayment(moved, priced)).toMatchObject({ ok: false });
		expect(addressFromPayment({ customer_details: paid.customer_details }, priced)).toMatchObject({ ok: false });
	});

	it('asks Stripe for the address and telephone, in the priced country only', async () => {
		let sent = '';
		const fetcher = (async (_address: string, init: RequestInit) => {
			sent = String(init.body);
			return new Response(JSON.stringify({ id: 'cs_test_1', url: 'https://checkout.stripe.com/c/pay/cs_test_1' }), { status: 200 });
		}) as typeof fetch;
		await createCheckout(
			{ secretKey: 'sk_test_x', webhookSecret: 'whsec_x' },
			{ reference: 'order', description: 'Book', amountInCents: 1812, shippingCountry: 'US', successAddress: 'https://site/orders/order', cancelAddress: 'https://site/store' },
			fetcher
		);
		const fields = new URLSearchParams(sent);
		expect(fields.get('shipping_address_collection[allowed_countries][0]')).toBe('US');
		expect(fields.get('phone_number_collection[enabled]')).toBe('true');
		expect(fields.has('customer_email')).toBe(false);
	});
});
