/**
 * Orders for printed copies (docs/book-orders.md): when ordering is open,
 * the files Lulu prints from, the price a reader pays, and the order records
 * in the database.
 *
 * Ordering is off unless BOOK_ORDERS is set in the Cloudflare dashboard:
 * "test" allows only Stripe test keys and Lulu's sandbox, so nothing is
 * charged or printed; "live" takes real payments and is set only after the
 * lead author has decided who receives the money.
 */
import type { D1Database, R2Bucket } from '@cloudflare/workers-types/index.ts';
import { choiceProblem, podPackageIdentifier, type PrintChoice, type ShippingLevel } from '#lib/book-order.ts';
import {
	calculateCost,
	hmacSha256Hex,
	luluSettings,
	sameText,
	type CostCalculation,
	type LuluSettings,
	type ShippingAddress
} from './lulu.ts';
import { isTestKey, stripeSettings, type StripeSettings } from './stripe.ts';

export type OrderMode = 'test' | 'live';

export interface OrderingOpen {
	mode: OrderMode;
	lulu: LuluSettings;
	stripe: StripeSettings;
	fileLinkSecret: string;
	contactEmail: string;
	/** Added to each copy's price, in cents, toward copies sent to nations (BOOK_MARGIN_CENTS). */
	marginCents: number;
}

/** Why ordering is closed, or the settings to take orders with. */
export function orderingState(environment: WorkerEnvironment): { open: true; settings: OrderingOpen } | { open: false; reason: string } {
	const mode = environment.BOOK_ORDERS;
	if (mode !== 'test' && mode !== 'live') return { open: false, reason: 'Ordering printed copies has not opened yet.' };
	const lulu = luluSettings(environment);
	const stripe = stripeSettings(environment);
	const fileLinkSecret = environment.BOOK_FILE_LINK_SECRET;
	const contactEmail = environment.BOOK_ORDERS_CONTACT_EMAIL;
	if (!lulu || !stripe || !fileLinkSecret || !contactEmail) {
		return { open: false, reason: 'Ordering is not set up yet.' };
	}
	// Test mode must never reach real money or a real printer.
	if (mode === 'test' && (lulu.environment !== 'sandbox' || !isTestKey(stripe))) {
		return { open: false, reason: 'Test ordering needs Lulu’s sandbox and a Stripe test key.' };
	}
	if (mode === 'live' && (lulu.environment !== 'production' || isTestKey(stripe))) {
		return { open: false, reason: 'Live ordering needs Lulu production and a live Stripe key.' };
	}
	const margin = Number(environment.BOOK_MARGIN_CENTS ?? 0);
	return {
		open: true,
		settings: {
			mode,
			lulu,
			stripe,
			fileLinkSecret,
			contactEmail,
			marginCents: Number.isInteger(margin) && margin >= 0 ? margin : 0
		}
	};
}

/**
 * A prepared book: an interior and a cover laid out for one size and binding,
 * kept in the bucket under books/<identifier>/ with this description beside
 * them as details.json. The print build writes them (pdf/, docs/book-orders.md).
 */
export interface FileSet {
	identifier: string;
	title: string;
	pages: number;
	size: string;
	/** Linen wrap books print from the hardcover set (fileSetFor). */
	binding: 'paperback' | 'hardcover';
}

const fileSetPattern = /^[a-z0-9][a-z0-9-]{0,80}(\/[a-z0-9][a-z0-9-]{0,80}){0,4}$/;

export function isFileSetIdentifier(text: string): boolean {
	return fileSetPattern.test(text);
}

export async function readFileSet(bucket: R2Bucket, identifier: string): Promise<FileSet | undefined> {
	if (!isFileSetIdentifier(identifier)) return undefined;
	const object = await bucket.get(`books/${identifier}/details.json`);
	if (!object) return undefined;
	const details = (await object.json()) as Partial<FileSet>;
	if (typeof details.title !== 'string' || typeof details.pages !== 'number' || typeof details.size !== 'string') return undefined;
	if (details.binding !== 'paperback' && details.binding !== 'hardcover') return undefined;
	return { identifier, title: details.title, pages: details.pages, size: details.size, binding: details.binding };
}

export type BookFile = 'interior.pdf' | 'cover.pdf';

/** A key that lets Lulu download one file of one set, and nothing else. */
export function fileLinkKey(secret: string, fileSet: string, file: BookFile): Promise<string> {
	return hmacSha256Hex(secret, `books/${fileSet}/${file}`);
}

export async function fileLink(origin: string, secret: string, fileSet: string, file: BookFile): Promise<string> {
	return `${origin}/book/files/${fileSet}/${file}?key=${await fileLinkKey(secret, fileSet, file)}`;
}

export async function isFileLinkKey(secret: string, fileSet: string, file: BookFile, key: string | null): Promise<boolean> {
	if (!key) return false;
	return sameText(await fileLinkKey(secret, fileSet, file), key);
}

/**
 * What the reader pays, in cents: Lulu's quote with tax, the margin, and
 * Stripe's card fee on the whole amount (2.9% + 30 cents for US cards,
 * https://stripe.com/pricing, read Nov. 23, 2026), so the project neither
 * loses money nor adds more than it says.
 */
export function readerPriceCents(printerCostCents: number, marginCents: number): number {
	return Math.ceil((printerCostCents + marginCents + 30) / (1 - 0.029));
}

export function dollarsToCents(amount: string): number {
	const value = Number(amount);
	if (!Number.isFinite(value) || value <= 0) throw new Error(`Not an amount: ${amount}`);
	return Math.round(value * 100);
}

export interface NewOrder {
	identifier: string;
	mode: OrderMode;
	fileSet: FileSet;
	choice: PrintChoice;
	shippingLevel: ShippingLevel;
	shippingAddress: ShippingAddress;
	email: string;
	printerCostCents: number;
	priceCents: number;
	/** The account that placed it while signed in, so it shows under Account, Orders; null for an order placed signed out. */
	accountIdentifier?: string | null;
}

export async function saveOrder(database: D1Database, order: NewOrder, now: string): Promise<void> {
	const problem = choiceProblem(order.choice, order.fileSet.pages);
	if (problem) throw new Error(problem);
	await database
		.prepare(
			`INSERT INTO book_orders (identifier, mode, status, file_set, title, pod_package_identifier, page_count, choice,
				shipping_level, printer_cost_cents, price_cents, recipient_name, shipping_address, email, account_identifier, created_at, updated_at)
			VALUES (?, ?, 'awaiting-payment', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		)
		.bind(
			order.identifier,
			order.mode,
			order.fileSet.identifier,
			order.fileSet.title,
			podPackageIdentifier(order.choice),
			order.fileSet.pages,
			JSON.stringify(order.choice),
			order.shippingLevel,
			order.printerCostCents,
			order.priceCents,
			order.shippingAddress.name,
			JSON.stringify(order.shippingAddress),
			order.email,
			order.accountIdentifier ?? null,
			now,
			now
		)
		.run();
}

export interface OrderRow {
	identifier: string;
	mode: OrderMode;
	status: string;
	file_set: string;
	title: string;
	pod_package_identifier: string;
	page_count: number;
	choice: string;
	shipping_level: ShippingLevel;
	printer_cost_cents: number;
	price_cents: number;
	recipient_name: string | null;
	shipping_address: string | null;
	email: string | null;
	payment_session: string | null;
	print_job: number | null;
	printer_status: string | null;
	printer_message: string | null;
	tracking_link: string | null;
	account_identifier: string | null;
	refunded_cents: number;
	refunded_at: string | null;
	created_at: string;
	updated_at: string;
}

export function orderByIdentifier(database: D1Database, identifier: string): Promise<OrderRow | null> {
	return database.prepare('SELECT * FROM book_orders WHERE identifier = ?').bind(identifier).first<OrderRow>();
}

export function orderByPrintJob(database: D1Database, printJob: number): Promise<OrderRow | null> {
	return database.prepare('SELECT * FROM book_orders WHERE print_job = ?').bind(printJob).first<OrderRow>();
}

export async function recordPaymentSession(database: D1Database, identifier: string, session: string, now: string): Promise<void> {
	await database
		.prepare('UPDATE book_orders SET payment_session = ?, updated_at = ? WHERE identifier = ?')
		.bind(session, now, identifier)
		.run();
}

/** Marks an order paid once, and says whether this call did it (Stripe may send an event more than once). */
export async function markPaid(database: D1Database, identifier: string, session: string, now: string): Promise<boolean> {
	const result = await database
		.prepare(
			`UPDATE book_orders SET status = 'paid', updated_at = ?
			WHERE identifier = ? AND payment_session = ? AND status = 'awaiting-payment'`
		)
		.bind(now, identifier, session)
		.run();
	return (result.meta?.changes ?? 0) > 0;
}

export async function recordPrintJob(database: D1Database, identifier: string, printJob: number, status: string, now: string): Promise<void> {
	await database
		.prepare(`UPDATE book_orders SET status = 'sent-to-printer', print_job = ?, printer_status = ?, updated_at = ? WHERE identifier = ?`)
		.bind(printJob, status, now, identifier)
		.run();
}

export async function recordPrinterRefusal(database: D1Database, identifier: string, message: string, now: string): Promise<void> {
	await database
		.prepare(`UPDATE book_orders SET status = 'printer-refused', printer_message = ?, updated_at = ? WHERE identifier = ?`)
		.bind(message.slice(0, 1000), now, identifier)
		.run();
}

/** The order status that follows from a Lulu print job status. */
export function statusFromPrinter(printerStatus: string): string | undefined {
	if (printerStatus === 'SHIPPED') return 'shipped';
	if (printerStatus === 'REJECTED' || printerStatus === 'ERROR') return 'printer-refused';
	if (printerStatus === 'CANCELED') return 'canceled';
	return undefined;
}

export async function recordPrinterStatus(
	database: D1Database,
	printJob: number,
	printerStatus: string,
	message: string | undefined,
	trackingLink: string | undefined,
	now: string
): Promise<void> {
	const status = statusFromPrinter(printerStatus);
	await database
		.prepare(
			`UPDATE book_orders SET printer_status = ?, printer_message = coalesce(?, printer_message),
				tracking_link = coalesce(?, tracking_link), status = coalesce(?, status), updated_at = ?
			WHERE print_job = ?`
		)
		.bind(printerStatus, message?.slice(0, 1000) ?? null, trackingLink ?? null, status ?? null, now, printJob)
		.run();
}

/**
 * Clears the name, address, telephone and email from orders that shipped,
 * were canceled or expired more than `days` ago. Lulu keeps its own copy of
 * the address for the print job.
 */
export async function removeOldPersonalDetails(database: D1Database, now: Date, days = 90): Promise<number> {
	const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
	const result = await database
		.prepare(
			`UPDATE book_orders SET recipient_name = NULL, shipping_address = NULL, email = NULL, personal_details_removed_at = ?
			WHERE personal_details_removed_at IS NULL AND status IN ('shipped', 'canceled', 'expired') AND updated_at < ?`
		)
		.bind(now.toISOString(), cutoff)
		.run();
	return result.meta?.changes ?? 0;
}

/** Lulu's price for one copy to this address, and what the reader pays. */
export async function quoteOrder(
	settings: OrderingOpen,
	fileSet: FileSet,
	choice: PrintChoice,
	shippingLevel: ShippingLevel,
	address: Omit<ShippingAddress, 'name'>,
	fetcher: typeof fetch = fetch
): Promise<{ printerCostCents: number; priceCents: number; cost: CostCalculation }> {
	const cost = await calculateCost(
		settings.lulu,
		{
			line_items: [{ pod_package_id: podPackageIdentifier(choice), page_count: fileSet.pages, quantity: 1 }],
			shipping_address: address,
			shipping_option: shippingLevel
		},
		fetcher
	);
	const printerCostCents = dollarsToCents(cost.total_cost_incl_tax);
	return { printerCostCents, priceCents: readerPriceCents(printerCostCents, settings.marginCents), cost };
}
