/**
 * Places an order for a printed copy (docs/book-orders.md): prices it again
 * with Lulu for the reader's address, records it, and opens a Stripe
 * Checkout page for the payment. Nothing is printed until Stripe reports the
 * payment (../payment-webhook).
 */
import { json } from '@sveltejs/kit';
import { readGiftChoice } from '#lib/checkout-gift.ts';
import { checkoutGift } from '#lib/server/checkout-gifts.ts';
import { addressForQuote, fileSetFor, readBookOrderForm } from '#lib/server/book-order-form.ts';
import { orderingState, quoteOrder, readFileSet, recordPaymentSession, saveOrder } from '#lib/server/book-orders.ts';
import { workerEnvironment } from '#lib/server/environment.ts';
import { newIdentifier, now } from '#lib/server/identifiers.ts';
import { createCheckout } from '#lib/server/stripe.ts';
import { bindingChoices, sizeOf } from '#lib/book-order.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

export const POST: RequestHandler = async ({ request, url, getClientAddress }) => {
	const environment = workerEnvironment();
	const state = orderingState(environment);
	if (!state.open) return json({ placed: false, reason: state.reason }, { status: 503 });

	const limiter = environment.requestFormLimit;
	if (limiter && !(await limiter.limit({ key: `book-order:${getClientAddress()}` })).success) {
		return json({ placed: false, reason: 'Too many orders from this connection. Wait a minute and try again.' }, { status: 429 });
	}

	const body = await request.json().catch(() => undefined);
	const read = readBookOrderForm(body, true);
	if (!read.ok) return json({ placed: false, reason: read.problem }, { status: 400 });
	const { choice, shippingLevel, address, email } = read.form;

	const fileSet = await readFileSet(environment.sourceDocuments, fileSetFor(choice));
	if (!fileSet) return json({ placed: false, reason: 'The book is not ready to print in this size and binding yet. Try a US Trade paperback.' }, { status: 409 });

	const settings = state.settings;
	let quote;
	try {
		quote = await quoteOrder(settings, fileSet, choice, shippingLevel, addressForQuote(address));
	} catch (problem) {
		console.error('Lulu price failed', problem);
		return json({ placed: false, reason: 'Lulu could not price this address. Check it and try again.' }, { status: 502 });
	}

	// The gift is worked out again from Lulu's price, so a round-up always lands on a whole $5.
	const gift = checkoutGift(environment, settings.mode, readGiftChoice((body as { gift?: unknown } | undefined)?.gift), quote.priceCents);
	if ('problem' in gift) return json({ placed: false, reason: gift.problem }, { status: 400 });

	const identifier = newIdentifier();
	const created = now();
	await saveOrder(
		environment.database,
		{
			identifier,
			mode: settings.mode,
			fileSet,
			choice,
			shippingLevel,
			shippingAddress: address,
			email: email!,
			printerCostCents: quote.printerCostCents,
			priceCents: quote.priceCents,
			giftCents: gift.cents
		},
		created
	);

	const binding = bindingChoices.find((option) => option.value === choice.binding)?.label ?? 'Book';
	try {
		const checkout = await createCheckout(settings.stripe, {
			reference: identifier,
			description: `${fileSet.title}, ${sizeOf(choice.size)?.name ?? choice.size} ${binding.toLowerCase()}, ${fileSet.pages} pages, printed and mailed by Lulu`,
			amountInCents: quote.priceCents,
			gift: gift.cents > 0 ? { amountInCents: gift.cents, description: 'Gift to Model Tribal ADR Code' } : undefined,
			email,
			successAddress: `${url.origin}/book/orders/${identifier}?paid=1`,
			cancelAddress: `${url.origin}/book`
		});
		await recordPaymentSession(environment.database, identifier, checkout.identifier, now());
		return json({ placed: true, payAt: checkout.address, priceCents: quote.priceCents, giftCents: gift.cents });
	} catch (problem) {
		console.error('Stripe checkout failed', problem);
		return json({ placed: false, reason: 'The payment page could not be opened. Try again in a minute.' }, { status: 502 });
	}
};
