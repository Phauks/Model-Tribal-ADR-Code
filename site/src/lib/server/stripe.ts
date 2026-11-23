/**
 * Stripe Checkout, which takes payment for printed copies (docs/book-orders.md).
 * The reader pays on Stripe's own page, so card details never reach this
 * site. Calls use Stripe's REST API directly ("Create a Checkout Session",
 * https://docs.stripe.com/api/checkout/sessions/create), so the Worker needs
 * no Stripe library.
 *
 * STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET are Worker secrets set in the
 * Cloudflare dashboard, never in the repository (decision record 0006).
 */
import { hmacSha256Hex, sameText } from './lulu.ts';

type Fetch = typeof fetch;

export interface StripeSettings {
	secretKey: string;
	webhookSecret: string;
}

export function stripeSettings(environment: WorkerEnvironment): StripeSettings | undefined {
	if (!environment.STRIPE_SECRET_KEY || !environment.STRIPE_WEBHOOK_SECRET) return undefined;
	return { secretKey: environment.STRIPE_SECRET_KEY, webhookSecret: environment.STRIPE_WEBHOOK_SECRET };
}

/** Whether the key is one of Stripe's test keys, which never move real money. */
export function isTestKey(settings: StripeSettings): boolean {
	return settings.secretKey.startsWith('sk_test_') || settings.secretKey.startsWith('rk_test_');
}

export interface CheckoutRequest {
	/** The order's reference on this site. */
	reference: string;
	/** What the reader sees on Stripe's page, such as "Model Tribal ADR Code, US Trade paperback". */
	description: string;
	/** In cents: print, shipping, Lulu's fee and Lulu's tax, plus any margin. */
	amountInCents: number;
	/** An optional gift to the project, shown as its own line (docs/book-orders.md, "Adding a gift"). */
	gift?: { amountInCents: number; description: string };
	email?: string;
	successAddress: string;
	cancelAddress: string;
}

/** Stripe's form encoding of nested fields, such as line_items[0][price_data][currency]. */
export function formEncode(fields: Record<string, string | number | undefined>): string {
	return Object.entries(fields)
		.filter((entry): entry is [string, string | number] => entry[1] !== undefined)
		.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
		.join('&');
}

/** Opens a Stripe Checkout page for one order and returns its address. */
export async function createCheckout(
	settings: StripeSettings,
	order: CheckoutRequest,
	fetcher: Fetch = fetch
): Promise<{ identifier: string; address: string }> {
	const body = formEncode({
		mode: 'payment',
		client_reference_id: order.reference,
		'metadata[order]': order.reference,
		customer_email: order.email,
		success_url: order.successAddress,
		cancel_url: order.cancelAddress,
		'line_items[0][quantity]': 1,
		'line_items[0][price_data][currency]': 'usd',
		'line_items[0][price_data][unit_amount]': order.amountInCents,
		'line_items[0][price_data][product_data][name]': order.description,
		...(order.gift && order.gift.amountInCents > 0
			? {
					'metadata[gift_cents]': order.gift.amountInCents,
					'line_items[1][quantity]': 1,
					'line_items[1][price_data][currency]': 'usd',
					'line_items[1][price_data][unit_amount]': order.gift.amountInCents,
					'line_items[1][price_data][product_data][name]': order.gift.description
				}
			: {}),
		// The page expires if left open, so an old price cannot be paid much later.
		expires_at: Math.floor(Date.now() / 1000) + 60 * 60
	});
	const response = await fetcher('https://api.stripe.com/v1/checkout/sessions', {
		method: 'POST',
		headers: {
			authorization: `Bearer ${settings.secretKey}`,
			'content-type': 'application/x-www-form-urlencoded',
			'idempotency-key': `checkout-${order.reference}`
		},
		body
	});
	const result = (await response.json()) as { id?: string; url?: string; error?: { message?: string } };
	if (!response.ok || !result.id || !result.url) {
		throw new Error(`Stripe refused the checkout (${response.status}): ${result.error?.message ?? 'no message'}`);
	}
	return { identifier: result.id, address: result.url };
}

/**
 * Whether a webhook really came from Stripe. Stripe signs "<timestamp>.<raw body>"
 * with the endpoint's signing secret (HMAC SHA-256) and sends
 * "t=<timestamp>,v1=<signature>" in the Stripe-Signature header
 * (https://docs.stripe.com/webhooks#verify-manually). Old events are refused
 * so a captured one cannot be replayed.
 */
export async function isStripeWebhook(
	settings: StripeSettings,
	rawBody: string,
	header: string | null,
	nowInSeconds = Math.floor(Date.now() / 1000),
	toleranceInSeconds = 300
): Promise<boolean> {
	if (!header) return false;
	const parts = header.split(',').map((part) => part.trim().split('='));
	const timestamp = Number(parts.find(([name]) => name === 't')?.[1]);
	const signatures = parts.filter(([name]) => name === 'v1').map(([, value]) => value ?? '');
	if (!Number.isFinite(timestamp) || signatures.length === 0) return false;
	if (Math.abs(nowInSeconds - timestamp) > toleranceInSeconds) return false;
	const expected = await hmacSha256Hex(settings.webhookSecret, `${timestamp}.${rawBody}`);
	return signatures.some((signature) => sameText(expected, signature));
}

/** A Stripe call that answers with JSON; throws with Stripe's own message when refused. */
async function stripeRequest<Result>(
	settings: Pick<StripeSettings, 'secretKey'>,
	method: 'GET' | 'POST',
	path: string,
	fields: Record<string, string | number | undefined> = {},
	fetcher: Fetch = fetch,
	idempotencyKey?: string
): Promise<Result> {
	const encoded = formEncode(fields);
	const address = `https://api.stripe.com/v1/${path}${method === 'GET' && encoded ? `?${encoded}` : ''}`;
	const headers: Record<string, string> = {
		authorization: `Bearer ${settings.secretKey}`
	};
	if (method === 'POST') headers['content-type'] = 'application/x-www-form-urlencoded';
	if (idempotencyKey) headers['idempotency-key'] = idempotencyKey;
	const response = await fetcher(address, {
		method,
		headers,
		body: method === 'POST' ? encoded : undefined
	});
	const result = (await response.json()) as Result & {
		error?: { message?: string };
	};
	if (!response.ok) throw new Error(`Stripe refused ${method} ${path} (${response.status}): ${result.error?.message ?? 'no message'}`);
	return result;
}

/**
 * Makes the Stripe customer that a sponsor's gifts and billing settings
 * belong to (https://docs.stripe.com/api/customers/create). The sponsor's
 * identifier goes in its metadata so the customer can be traced back.
 */
export async function createCustomer(
	settings: Pick<StripeSettings, 'secretKey'>,
	customer: { name: string; email: string; sponsor: string },
	fetcher: Fetch = fetch
): Promise<string> {
	const result = await stripeRequest<{ id: string }>(
		settings,
		'POST',
		'customers',
		{
			name: customer.name,
			email: customer.email,
			'metadata[sponsor]': customer.sponsor
		},
		fetcher,
		`sponsor-customer-${customer.sponsor}`
	);
	return result.id;
}

export interface GiftCheckoutRequest {
	customer: string;
	sponsor: string;
	amountInCents: number;
	monthly: boolean;
	/** What the giver sees on Stripe's page. */
	description: string;
	successAddress: string;
	cancelAddress: string;
}

/**
 * Opens a Stripe Checkout page for a gift: a subscription for a monthly gift,
 * a single payment otherwise. The amount is the sponsor's own, so the price
 * is made on the spot rather than set up in Stripe's dashboard.
 */
export async function createGiftCheckout(settings: Pick<StripeSettings, 'secretKey'>, gift: GiftCheckoutRequest, fetcher: Fetch = fetch): Promise<string> {
	const fields: Record<string, string | number | undefined> = {
		mode: gift.monthly ? 'subscription' : 'payment',
		customer: gift.customer,
		client_reference_id: gift.sponsor,
		'metadata[sponsor]': gift.sponsor,
		success_url: gift.successAddress,
		cancel_url: gift.cancelAddress,
		'line_items[0][quantity]': 1,
		'line_items[0][price_data][currency]': 'usd',
		'line_items[0][price_data][unit_amount]': gift.amountInCents,
		'line_items[0][price_data][product_data][name]': gift.description
	};
	if (gift.monthly) {
		fields['line_items[0][price_data][recurring][interval]'] = 'month';
		fields['subscription_data[metadata][sponsor]'] = gift.sponsor;
	} else {
		fields.submit_type = 'donate';
		fields['payment_intent_data[metadata][sponsor]'] = gift.sponsor;
	}
	const result = await stripeRequest<{ url?: string }>(settings, 'POST', 'checkout/sessions', fields, fetcher);
	if (!result.url) throw new Error('Stripe gave no address for the checkout page.');
	return result.url;
}

/**
 * Opens Stripe's own billing page for a customer, where a sponsor changes
 * the amount, card or billing address, cancels, and downloads receipts
 * (https://docs.stripe.com/api/customer_portal/sessions/create). Stripe's
 * dashboard must have a saved portal setup for the mode in use.
 */
export async function createBillingPortal(
	settings: Pick<StripeSettings, 'secretKey'>,
	customer: string,
	returnAddress: string,
	fetcher: Fetch = fetch
): Promise<string> {
	const result = await stripeRequest<{ url?: string }>(settings, 'POST', 'billing_portal/sessions', { customer, return_url: returnAddress }, fetcher);
	if (!result.url) throw new Error('Stripe gave no address for the billing page.');
	return result.url;
}

export interface MonthlyGift {
	identifier: string;
	status: string;
	amountInCents: number;
	interval: string;
	/** When the next payment is due, as an ISO time, if Stripe says. */
	nextPayment: string | null;
	cardEnding: string | null;
	cancelAtPeriodEnd: boolean;
}

interface StripeSubscription {
	id: string;
	status: string;
	cancel_at_period_end?: boolean;
	current_period_end?: number;
	default_payment_method?: { card?: { last4?: string } } | string | null;
	items?: {
		data?: {
			current_period_end?: number;
			price?: { unit_amount?: number; recurring?: { interval?: string } };
		}[];
	};
}

/** A customer's subscriptions that have not ended, as the Account page and the lead author's diagnostics show them. */
export async function monthlyGifts(settings: Pick<StripeSettings, 'secretKey'>, customer: string, fetcher: Fetch = fetch): Promise<MonthlyGift[]> {
	const result = await stripeRequest<{ data?: StripeSubscription[] }>(
		settings,
		'GET',
		'subscriptions',
		{
			customer,
			status: 'all',
			limit: 10,
			'expand[0]': 'data.default_payment_method'
		},
		fetcher
	);
	return (result.data ?? [])
		.filter((subscription) => !['canceled', 'incomplete_expired'].includes(subscription.status))
		.map((subscription) => {
			const item = subscription.items?.data?.[0];
			// Newer Stripe versions keep the period on each item; older ones on the subscription.
			const periodEnd = item?.current_period_end ?? subscription.current_period_end;
			const method = subscription.default_payment_method;
			return {
				identifier: subscription.id,
				status: subscription.status,
				amountInCents: item?.price?.unit_amount ?? 0,
				interval: item?.price?.recurring?.interval ?? 'month',
				nextPayment: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
				cardEnding: typeof method === 'object' && method?.card?.last4 ? method.card.last4 : null,
				cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end)
			};
		});
}

/** Whether Stripe knows the customer, for the lead author's diagnostics. */
export async function customerExists(
	settings: Pick<StripeSettings, 'secretKey'>,
	customer: string,
	fetcher: Fetch = fetch
): Promise<{ exists: boolean; deleted: boolean; email: string | null }> {
	const result = await stripeRequest<{
		id?: string;
		deleted?: boolean;
		email?: string | null;
	}>(settings, 'GET', `customers/${encodeURIComponent(customer)}`, {}, fetcher);
	return {
		exists: Boolean(result.id),
		deleted: Boolean(result.deleted),
		email: result.email ?? null
	};
}
