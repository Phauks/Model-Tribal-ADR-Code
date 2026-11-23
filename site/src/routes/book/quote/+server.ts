/**
 * Lulu's price for one printed copy to an address (docs/book-orders.md).
 * The book page asks here once the reader has chosen a book and entered
 * where it goes; until ordering opens it answers 503 and the page shows its
 * own estimate instead.
 */
import { json } from '@sveltejs/kit';
import { addressForQuote, fileSetFor, readBookOrderForm } from '#lib/server/book-order-form.ts';
import { orderingState, quoteOrder, readFileSet } from '#lib/server/book-orders.ts';
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

	try {
		const quote = await quoteOrder(state.settings, fileSet, choice, shippingLevel, addressForQuote(address));
		return json({
			available: true,
			mode: state.settings.mode,
			pages: fileSet.pages,
			printerCostCents: quote.printerCostCents,
			priceCents: quote.priceCents,
			currency: quote.cost.currency
		});
	} catch (problem) {
		console.error('Lulu price failed', problem instanceof LuluError ? problem.details : problem);
		return json({ available: false, reason: 'Lulu could not price this address. Check it and try again.' }, { status: 502 });
	}
};
