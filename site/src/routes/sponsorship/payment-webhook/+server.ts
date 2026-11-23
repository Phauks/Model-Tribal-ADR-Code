/**
 * Stripe tells the site here when a sponsor's gift is paid
 * (docs/sponsorship.md): a one-time gift when its Checkout page is paid, and
 * a monthly gift each time its invoice is paid. The gift is matched to the
 * sponsor by the Stripe customer the site made for them.
 *
 * Set up in Stripe's dashboard as its own webhook endpoint for the events
 * checkout.session.completed, checkout.session.async_payment_succeeded and
 * invoice.paid; its signing secret is STRIPE_SPONSOR_WEBHOOK_SECRET. It is
 * kept apart from the endpoint for printed copies so each can be switched
 * on alone.
 */
import { workerEnvironment } from '#lib/server/environment.ts';
import { giftState, recordGift } from '#lib/server/sponsors.ts';
import { isStripeWebhook } from '#lib/server/stripe.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

interface StripeEvent {
	type: string;
	livemode?: boolean;
	data?: {
		object?: {
			id?: string;
			customer?: string | null;
			mode?: string;
			payment_status?: string;
			amount_total?: number | null;
			amount_paid?: number | null;
			currency?: string;
		};
	};
}

const plain = (text: string, status: number) =>
	new Response(text, {
		status,
		headers: { 'content-type': 'text/plain; charset=utf-8' }
	});

export const POST: RequestHandler = async ({ request }) => {
	const environment = workerEnvironment();
	const state = giftState(environment);
	if (!state.open || !environment.database) return plain('Gifts are closed.', 503);

	const rawBody = await request.text();
	if (!(await isStripeWebhook(state.stripe, rawBody, request.headers.get('stripe-signature')))) {
		return plain('Signature does not match.', 400);
	}
	const event = JSON.parse(rawBody) as StripeEvent;
	// A test event never counts while gifts are live, nor a live one in test mode.
	if (Boolean(event.livemode) !== (state.mode === 'live')) return plain('Ignored: other mode.', 200);
	const object = event.data?.object;
	if (!object?.id || !object.customer) return plain('Ignored.', 200);

	const isPaidCheckout =
		(event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') &&
		object.mode === 'payment' &&
		object.payment_status === 'paid';
	if (isPaidCheckout) {
		const recorded = await recordGift(environment.database, {
			mode: state.mode,
			customer: object.customer,
			stripeObject: object.id,
			kind: 'one-time',
			amountCents: object.amount_total ?? 0,
			currency: object.currency ?? 'usd'
		});
		return plain(recorded ? 'Gift recorded.' : 'Already recorded, or not a sponsor.', 200);
	}
	// A monthly gift's first payment and each one after it arrive as paid invoices.
	if (event.type === 'invoice.paid') {
		const recorded = await recordGift(environment.database, {
			mode: state.mode,
			customer: object.customer,
			stripeObject: object.id,
			kind: 'monthly',
			amountCents: object.amount_paid ?? 0,
			currency: object.currency ?? 'usd'
		});
		return plain(recorded ? 'Gift recorded.' : 'Already recorded, or not a sponsor.', 200);
	}
	return plain('Ignored.', 200);
};
