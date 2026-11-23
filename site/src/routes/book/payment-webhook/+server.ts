/**
 * Stripe tells the site here when a reader has paid, or let the payment page
 * expire (docs/book-orders.md). A paid order is sent to Lulu at once, with a
 * two-hour delay before printing so a mistake can still be canceled.
 *
 * Set up in Stripe's dashboard as a webhook endpoint for the events
 * checkout.session.completed and checkout.session.expired; its signing
 * secret is STRIPE_WEBHOOK_SECRET.
 */
import { orderingState, fileLink, markPaid, orderByIdentifier, recordPrinterRefusal, recordPrintJob } from '#lib/server/book-orders.ts';
import { workerEnvironment } from '#lib/server/environment.ts';
import { now } from '#lib/server/identifiers.ts';
import { storedSecret } from '#lib/server/stored-secrets.ts';
import { createPrintJob, LuluError, type ShippingAddress } from '#lib/server/lulu.ts';
import { isStripeWebhook } from '#lib/server/stripe.ts';
import { foilStampText, type PrintChoice } from '#lib/book-order.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

interface CheckoutEvent {
	type: string;
	data: { object: { id: string; client_reference_id?: string; payment_status?: string } };
}

const plain = (text: string, status: number) => new Response(text, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } });

export const POST: RequestHandler = async ({ request, url }) => {
	const environment = workerEnvironment();
	const state = orderingState(environment);
	if (!state.open) return plain('Ordering is closed.', 503);
	const settings = state.settings;

	const rawBody = await request.text();
	if (!(await isStripeWebhook(settings.stripe, rawBody, request.headers.get('stripe-signature')))) {
		return plain('Signature does not match.', 400);
	}
	const event = JSON.parse(rawBody) as CheckoutEvent;
	const session = event.data?.object;
	const identifier = session?.client_reference_id;
	if (!identifier) return plain('Not an order.', 200);

	if (event.type === 'checkout.session.expired') {
		await environment.database
			.prepare(`UPDATE book_orders SET status = 'expired', updated_at = ? WHERE identifier = ? AND status = 'awaiting-payment'`)
			.bind(now(), identifier)
			.run();
		return plain('Noted.', 200);
	}
	if (event.type !== 'checkout.session.completed' || session.payment_status !== 'paid') return plain('Ignored.', 200);

	// Read before the order is marked paid, so that Stripe's retry finds it still waiting.
	const signingKey = await storedSecret(settings.fileLinkSecret);
	if (!signingKey) return plain('The file link key cannot be read.', 500);

	// Stripe may send the same event twice; only the first one sends the order to Lulu.
	if (!(await markPaid(environment.database, identifier, session.id, now()))) return plain('Already handled.', 200);
	const order = await orderByIdentifier(environment.database, identifier);
	if (!order || !order.shipping_address || !order.email) return plain('Order details are missing.', 200);

	const choice = JSON.parse(order.choice) as PrintChoice;
	try {
		const job = await createPrintJob(settings.lulu, {
			contact_email: settings.contactEmail,
			external_id: order.identifier,
			production_delay: 120,
			shipping_level: order.shipping_level,
			shipping_address: { ...(JSON.parse(order.shipping_address) as ShippingAddress), email: order.email },
			line_items: [
				{
					external_id: order.identifier,
					title: order.title,
					quantity: 1,
					printable_normalization: {
						pod_package_id: order.pod_package_identifier,
						interior: { source_url: await fileLink(url.origin, signingKey, order.file_set, 'interior.pdf') },
						cover: { source_url: await fileLink(url.origin, signingKey, order.file_set, 'cover.pdf') }
					},
					...(choice.binding === 'linenWrap'
						? foilStampText(order.title)
						: {})
				}
			]
		});
		await recordPrintJob(environment.database, identifier, job.id, job.status?.name ?? 'CREATED', now());
	} catch (problem) {
		// The reader has paid but Lulu refused the job: the order is marked so
		// the lead author can fix it or refund it from Stripe's dashboard.
		const message = problem instanceof LuluError ? JSON.stringify(problem.details ?? problem.message) : String(problem);
		console.error('Lulu print job failed', message);
		await recordPrinterRefusal(environment.database, identifier, message, now());
	}
	return plain('Sent to the printer.', 200);
};
