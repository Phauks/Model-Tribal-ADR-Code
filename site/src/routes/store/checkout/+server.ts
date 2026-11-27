/**
 * Buys a standard format of the book in one step from the Store (docs/store.md,
 * "Buying in one step"). The buyer gives only the country, state and postal
 * code; Lulu prices the copy for them, the order is recorded, and Stripe's
 * page asks for the name, street address, telephone and email. The payment
 * webhook (../../book/payment-webhook) then sends the copy to Lulu.
 */
import { json } from '@sveltejs/kit';
import { readGiftChoice } from '#lib/checkout-gift.ts';
import { sizeOf } from '#lib/book-order.ts';
import { addressForQuote, fileSetFor, readBookOrderForm } from '#lib/server/book-order-form.ts';
import { orderingState, quoteOrder, readFileSet, recordPaymentSession, saveOrder } from '#lib/server/book-orders.ts';
import { checkoutGift } from '#lib/server/checkout-gifts.ts';
import { workerEnvironment } from '#lib/server/environment.ts';
import { newIdentifier, now } from '#lib/server/identifiers.ts';
import { createCheckout } from '#lib/server/stripe.ts';
import { standardFormats } from '#lib/store.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

export const POST: RequestHandler = async ({ request, url, getClientAddress, locals }) => {
	const environment = workerEnvironment();
	const state = orderingState(environment);
	if (!state.open) return json({ placed: false, reason: state.reason }, { status: 503 });

	const limiter = environment.requestFormLimit;
	if (limiter && !(await limiter.limit({ key: `book-order:${getClientAddress()}` })).success) {
		return json({ placed: false, reason: 'Too many orders from this connection. Wait a minute and try again.' }, { status: 429 });
	}

	const body = (await request.json().catch(() => /* expected: a body that is not JSON is refused just below with 400 */ undefined)) as { format?: unknown; shippingLevel?: unknown; address?: unknown; gift?: unknown } | undefined;
	const format = standardFormats.find((candidate) => candidate.identifier === body?.format);
	if (!format) return json({ placed: false, reason: 'Choose a book.' }, { status: 400 });
	// Only the postal code, state and country: Stripe's page asks for the rest.
	const read = readBookOrderForm({ choice: format.choice, shippingLevel: body?.shippingLevel, address: body?.address }, false);
	if (!read.ok) return json({ placed: false, reason: read.problem }, { status: 400 });
	const { choice, shippingLevel, address } = read.form;
	const priced = { name: '', street1: '', city: '', phone_number: '', state_code: address.state_code, postcode: address.postcode, country_code: address.country_code };

	const fileSet = await readFileSet(environment.sourceDocuments, fileSetFor(choice));
	if (!fileSet) return json({ placed: false, reason: 'The book is not ready to print in this format yet.' }, { status: 409 });

	const settings = state.settings;
	let quote;
	try {
		quote = await quoteOrder(settings, fileSet, choice, shippingLevel, addressForQuote(priced));
	} catch (problem) {
		console.error('Lulu price failed', problem);
		return json({ placed: false, reason: 'Lulu could not price this postal code. Check it and try again.' }, { status: 502 });
	}

	const gift = checkoutGift(environment, settings.mode, readGiftChoice(body?.gift), quote.priceCents);
	if ('problem' in gift) return json({ placed: false, reason: gift.problem }, { status: 400 });

	const identifier = newIdentifier();
	await saveOrder(
		environment.database,
		{
			identifier,
			mode: settings.mode,
			fileSet,
			choice,
			shippingLevel,
			shippingAddress: priced,
			email: null,
			printerCostCents: quote.printerCostCents,
			priceCents: quote.priceCents,
			giftCents: gift.cents,
			accountIdentifier: locals.account?.subject ?? null
		},
		now()
	);

	try {
		const checkout = await createCheckout(settings.stripe, {
			reference: identifier,
			description: `${fileSet.title}, ${format.label.toLowerCase()} (${sizeOf(choice.size)?.name ?? choice.size}), ${fileSet.pages} pages, printed and mailed by Lulu`,
			amountInCents: quote.priceCents,
			gift: gift.cents > 0 ? { amountInCents: gift.cents, description: 'Gift to Tribal Law Project' } : undefined,
			shippingCountry: address.country_code,
			successAddress: `${url.origin}/orders/${identifier}?paid=1`,
			cancelAddress: `${url.origin}/store`
		});
		await recordPaymentSession(environment.database, identifier, checkout.identifier, now());
		return json({ placed: true, payAt: checkout.address });
	} catch (problem) {
		console.error('Stripe checkout failed', problem);
		return json({ placed: false, reason: 'The payment page could not be opened. Try again in a minute.' }, { status: 502 });
	}
};
