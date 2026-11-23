/**
 * Lulu's Print API, which prints and mails each copy ordered on the website
 * (docs/book-orders.md). Calls and fields follow Lulu's published OpenAPI
 * description, "Universal Publishing Platform API v1"
 * (https://api.lulu.com/api-docs/openapi-specs/openapi_public.yml, read
 * Nov. 23, 2026).
 *
 * The client key and secret are Worker secrets set in the Cloudflare
 * dashboard, never in the repository (decision record 0006). LULU_ENVIRONMENT
 * chooses Lulu's sandbox, where print jobs are "not forwarded to a Lulu
 * production facility and will not be charged" (Lulu API Guide to Getting
 * Started), or production.
 */
import type { ShippingLevel } from '#lib/book-order.ts';

export type LuluEnvironment = 'sandbox' | 'production';

export interface LuluSettings {
	environment: LuluEnvironment;
	clientKey: string;
	clientSecret: string;
}

const baseAddresses: Record<LuluEnvironment, string> = {
	sandbox: 'https://api.sandbox.lulu.com',
	production: 'https://api.lulu.com'
};

/** The Lulu settings from the Worker's environment, or undefined until they are all set. */
export function luluSettings(environment: WorkerEnvironment): LuluSettings | undefined {
	const chosen = environment.LULU_ENVIRONMENT;
	if (chosen !== 'sandbox' && chosen !== 'production') return undefined;
	if (!environment.LULU_CLIENT_KEY || !environment.LULU_CLIENT_SECRET) return undefined;
	return { environment: chosen, clientKey: environment.LULU_CLIENT_KEY, clientSecret: environment.LULU_CLIENT_SECRET };
}

export interface ShippingAddress {
	name: string;
	street1: string;
	street2?: string;
	city: string;
	/** Two letters for the United States and Canada, such as NV. */
	state_code?: string;
	postcode: string;
	/** ISO 3166-1 alpha-2, such as US. */
	country_code: string;
	phone_number: string;
	email?: string;
}

export interface CostLineItem {
	pod_package_id: string;
	page_count: number;
	quantity: number;
}

/** Amounts are strings of US dollars, as Lulu sends them. */
export interface CostCalculation {
	currency: string;
	total_cost_excl_tax: string;
	total_cost_incl_tax: string;
	total_tax: string;
	shipping_cost?: { total_cost_excl_tax: string; total_cost_incl_tax: string };
	fulfillment_cost?: { total_cost_excl_tax: string; total_cost_incl_tax: string };
	line_item_costs?: { total_cost_excl_tax: string; total_cost_incl_tax: string }[];
}

export interface PrintJobLineItem {
	external_id?: string;
	title: string;
	quantity: number;
	printable_normalization: {
		pod_package_id: string;
		interior: { source_url: string };
		cover: { source_url: string };
	};
	/** Linen wrap only; together at most 42 characters. */
	foil_stamp_title_text?: string;
	foil_stamp_author_text?: string;
}

export interface PrintJobRequest {
	contact_email: string;
	external_id: string;
	line_items: PrintJobLineItem[];
	/** Minutes before printing starts, 60 to 2,880; a job can be canceled until then. */
	production_delay: number;
	shipping_address: ShippingAddress;
	shipping_level: ShippingLevel;
}

export interface PrintJob {
	id: number;
	external_id?: string;
	status: { name: string; message?: string };
	line_items?: { tracking_urls?: string[]; tracking_id?: string }[];
	costs?: CostCalculation;
}

type Fetch = typeof fetch;

/** Kept for the life of the Worker instance, so each request does not sign in again. */
let cachedToken: { key: string; token: string; expiresAt: number } | undefined;

/** Forget the cached access token (for tests). */
export function forgetLuluToken(): void {
	cachedToken = undefined;
}

/**
 * An access token from Lulu's sign-in server (OAuth 2 client credentials, the
 * client key and secret sent as HTTP Basic authentication).
 */
export async function luluAccessToken(settings: LuluSettings, fetcher: Fetch = fetch, now = Date.now()): Promise<string> {
	const key = `${settings.environment}:${settings.clientKey}`;
	if (cachedToken && cachedToken.key === key && cachedToken.expiresAt > now + 30_000) return cachedToken.token;
	const response = await fetcher(
		`${baseAddresses[settings.environment]}/auth/realms/glasstree/protocol/openid-connect/token`,
		{
			method: 'POST',
			headers: {
				authorization: `Basic ${btoa(`${settings.clientKey}:${settings.clientSecret}`)}`,
				'content-type': 'application/x-www-form-urlencoded'
			},
			body: 'grant_type=client_credentials'
		}
	);
	if (!response.ok) throw new LuluError(`Lulu sign-in failed (${response.status})`, response.status);
	const body = (await response.json()) as { access_token: string; expires_in?: number };
	cachedToken = { key, token: body.access_token, expiresAt: now + (body.expires_in ?? 300) * 1000 };
	return body.access_token;
}

export class LuluError extends Error {
	constructor(
		message: string,
		readonly status: number,
		readonly details?: unknown
	) {
		super(message);
	}
}

async function call<Result>(
	settings: LuluSettings,
	method: 'GET' | 'POST' | 'PUT',
	path: string,
	body: unknown,
	fetcher: Fetch
): Promise<Result> {
	const token = await luluAccessToken(settings, fetcher);
	const response = await fetcher(`${baseAddresses[settings.environment]}${path}`, {
		method,
		headers: {
			authorization: `Bearer ${token}`,
			'content-type': 'application/json',
			'cache-control': 'no-cache'
		},
		body: body === undefined ? undefined : JSON.stringify(body)
	});
	const text = await response.text();
	const parsed = text ? (JSON.parse(text) as unknown) : undefined;
	if (!response.ok) throw new LuluError(`Lulu refused ${method} ${path} (${response.status})`, response.status, parsed);
	return parsed as Result;
}

/** Print, shipping, fees and tax for an order, without placing it. The address is needed for shipping and tax. */
export function calculateCost(
	settings: LuluSettings,
	order: { line_items: CostLineItem[]; shipping_address: Omit<ShippingAddress, 'name'> & { name?: string }; shipping_option: ShippingLevel },
	fetcher: Fetch = fetch
): Promise<CostCalculation> {
	return call(settings, 'POST', '/print-job-cost-calculations/', order, fetcher);
}

/** The size of the cover spread, in points, for a product and page count. */
export function coverDimensions(
	settings: LuluSettings,
	podPackageIdentifier: string,
	pages: number,
	fetcher: Fetch = fetch
): Promise<{ width: string; height: string; unit: string }> {
	return call(settings, 'POST', '/cover-dimensions/', { pod_package_id: podPackageIdentifier, interior_page_count: pages }, fetcher);
}

/** Places a print job. Lulu downloads the interior and cover from the given links. */
export function createPrintJob(settings: LuluSettings, job: PrintJobRequest, fetcher: Fetch = fetch): Promise<PrintJob> {
	return call(settings, 'POST', '/print-jobs/', job, fetcher);
}

export function printJob(settings: LuluSettings, identifier: number, fetcher: Fetch = fetch): Promise<PrintJob> {
	return call(settings, 'GET', `/print-jobs/${identifier}/`, undefined, fetcher);
}

/** Cancels a print job; Lulu allows this only before it is paid and sent to production. */
export function cancelPrintJob(settings: LuluSettings, identifier: number, fetcher: Fetch = fetch): Promise<unknown> {
	return call(settings, 'PUT', `/print-jobs/${identifier}/status/`, { name: 'CANCELED' }, fetcher);
}

function hex(bytes: ArrayBuffer): string {
	return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Compares two strings in time that does not depend on where they differ. */
export function sameText(first: string, second: string): boolean {
	if (first.length !== second.length) return false;
	let difference = 0;
	for (let index = 0; index < first.length; index += 1) difference |= first.charCodeAt(index) ^ second.charCodeAt(index);
	return difference === 0;
}

export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
	return hex(await crypto.subtle.sign('HMAC', key, encoder.encode(message)));
}

/**
 * Whether a webhook really came from Lulu. Lulu signs the raw body with the
 * API secret (HMAC SHA-256) and sends it in the Lulu-HMAC-SHA256 header;
 * the body must be checked as received, before it is parsed (Print API,
 * "Webhooks").
 */
export async function isLuluWebhook(settings: LuluSettings, rawBody: string, signature: string | null): Promise<boolean> {
	if (!signature) return false;
	const expected = await hmacSha256Hex(settings.clientSecret, rawBody);
	return sameText(expected, signature.trim().toLowerCase());
}
