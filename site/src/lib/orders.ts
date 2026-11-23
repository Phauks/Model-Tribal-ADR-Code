// Orders for anything sold on the Store (docs/store.md): books printed by Lulu
// today, merchandise from a print-on-demand provider later. Trevor asked on
// Nov. 23, 2026 for one orders screen for every kind of purchase, for buyers
// (Account, Your orders) and in the workspace.

import { bindingChoices, sizeOf, type PrintChoice } from './book-order.ts';
import { standardFormats } from './store.ts';

export const itemKinds = ['book', 'merchandise'] as const;
export type ItemKind = (typeof itemKinds)[number];

export const itemKindLabels: Record<ItemKind, string> = { book: 'Books', merchandise: 'Merchandise' };

/** One line of an order: what was bought, and the outside service that makes and mails it. */
export interface OrderLine {
	kind: ItemKind;
	/** Such as "Paperback" or "T-shirt". */
	label: string;
	/** Such as "6 × 9 in, 312 pages" or "Medium, black". */
	detail: string;
	quantity: number;
	/** The service that makes it, such as Lulu. */
	maker: string;
	/** The maker's own number for the job, and its last status, for the workspace. */
	makerJob?: string | null;
	makerStatus?: string | null;
}

/** An order as the buyer's Your orders page lists it. */
export interface OrderSummary {
	identifier: string;
	mode: 'test' | 'live';
	status: OrderStatus;
	lines: OrderLine[];
	priceCents: number;
	/** The gift added at checkout, apart from the price (docs/book-orders.md, "Adding a gift"). */
	giftCents: number;
	refundedCents: number;
	refundedAt: string | null;
	trackingLink: string | null;
	placedAt: string;
	openProblems: number;
}

/** An order as the workspace's Orders page shows it, with who it goes to and its Stripe payment. */
export interface WorkspaceOrder extends OrderSummary {
	recipientName: string | null;
	email: string | null;
	paymentSession: string | null;
	makerMessage: string | null;
}

export const orderStatuses = ['awaiting-payment', 'paid', 'in-production', 'maker-refused', 'shipped', 'canceled', 'expired'] as const;
export type OrderStatus = (typeof orderStatuses)[number];

/** A short status for lists. */
export const orderStatusLabels: Record<OrderStatus, string> = {
	'awaiting-payment': 'Not paid',
	paid: 'Paid',
	'in-production': 'Being made',
	'maker-refused': 'Could not be made',
	shipped: 'Shipped',
	canceled: 'Canceled',
	expired: 'Expired'
};

/** The kinds of item in an order, for filtering. */
export function kindsOf(order: OrderSummary): ItemKind[] {
	return [...new Set(order.lines.map((line) => line.kind))];
}

/** The general status of a printed-copy order, from the book_orders table's own status. */
export function statusOfBookOrder(status: string): OrderStatus {
	const statuses: Record<string, OrderStatus> = {
		'awaiting-payment': 'awaiting-payment',
		paid: 'paid',
		'sent-to-printer': 'in-production',
		'printer-refused': 'maker-refused',
		shipped: 'shipped',
		canceled: 'canceled',
		expired: 'expired'
	};
	return statuses[status] ?? 'paid';
}

/**
 * The line for a printed copy: a standard format by its Store name, or a
 * special order by its size and binding.
 */
export function bookLine(
	choice: PrintChoice,
	pages: number,
	printJob: number | null = null,
	printerStatus: string | null = null
): OrderLine {
	const size = sizeOf(choice.size);
	const binding = bindingChoices.find((option) => option.value === choice.binding)?.label ?? 'Book';
	const standard = standardFormats.find(
		(format) =>
			format.choice.size === choice.size &&
			format.choice.binding === choice.binding &&
			format.choice.ink === choice.ink &&
			format.choice.paper === choice.paper &&
			format.choice.finish === choice.finish
	);
	const sizeText = size ? `${size.width} × ${size.height} in` : choice.size;
	return {
		kind: 'book',
		label: standard?.label ?? 'Special order',
		detail: standard ? `${sizeText}, ${pages} pages` : `${size?.name ?? choice.size} ${binding.toLowerCase()}, ${pages} pages`,
		quantity: 1,
		maker: 'Lulu',
		makerJob: printJob === null ? null : String(printJob),
		makerStatus: printerStatus
	};
}
