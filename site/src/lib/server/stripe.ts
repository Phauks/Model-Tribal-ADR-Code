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
