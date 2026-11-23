/**
 * Lulu's price for one printed copy to an address (docs/book-orders.md).
 * The book page asks here once the reader has chosen a book and entered
 * where it goes; until ordering opens it answers 503 and the page shows its
 * own estimate instead.
 */
import { json } from '@sveltejs/kit';
import { checkoutGiftReceiver } from '#lib/server/checkout-gifts.ts';
import { addressForQuote, fileSetFor, readBookOrderForm } from '#lib/server/book-order-form.ts';
import { orderingState, priceParts, quoteOrder, readFileSet } from '#lib/server/book-orders.ts';
import { shippingLevels } from '#lib/book-order.ts';
import { workerEnvironment } from '#lib/server/environment.ts';
import { LuluError } from '#lib/server/lulu.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	const environment = workerEnvironment();
	const state = orderingState(environment);
	if (!state.open) return json({ available: false, reason: state.reason }, { status: 503 });

	const limiter = environment.requestFormLimit;
	if (limiter && !(await limiter.limit({ key: `book-quote:${getClientAddress()}` })).success) {
		return json({ available: false, reason: 'Too many price requests. Wait a minute and try again.' }, { status: 429 });
	}

	const read = readBookOrderForm(await request.json().catch(() => undefined), false);
	if (!read.ok) return json({ available: false, reason: read.problem }, { status: 400 });
	const { choice, shippingLevel, address } = read.form;

	const fileSet = await readFileSet(environment.sourceDocuments, fileSetFor(choice));
	if (!fileSet) return json({ available: false, reason: 'The book is not ready to print in this size and binding yet. Try a US Trade paperback.' }, { status: 409 });

	// Every shipping speed is priced at once, so the reader can compare them. A
	// speed Lulu does not offer to this address is left out.
	const settings = state.settings;
	const priced = await Promise.allSettled(
		shippingLevels.map(async (level) => {
			const quote = await quoteOrder(settings, fileSet, choice, level, addressForQuote(address));
			return { level, priceCents: quote.priceCents, parts: priceParts(quote.cost, quote.priceCents, settings.marginCents) };
		})
	);
	const speeds = priced.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));
	if (speeds.length === 0) {
		const first = priced.find((result) => result.status === 'rejected');
		const reason = first?.status === 'rejected' ? first.reason : undefined;
		console.error('Lulu price failed', reason instanceof LuluError ? reason.details : reason);
		return json({ available: false, reason: 'Lulu could not price this address. Check the postal code and country and try again.' }, { status: 502 });
	}
	const chosen = speeds.find((speed) => speed.level === shippingLevel) ?? speeds[0];
	return json({
		available: true,
		mode: settings.mode,
		pages: fileSet.pages,
		speeds,
		// Kept for the chosen speed, so older pages still read a price.
		shippingLevel: chosen.level,
		priceCents: chosen.priceCents,
		// Who receives a gift added to the order, or null when gifts are not offered (docs/book-orders.md, "Adding a gift").
		giftReceiver: checkoutGiftReceiver(environment, settings.mode)
	});
};
