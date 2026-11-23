// What the Store page sells (docs/store.md). Trevor asked on Nov. 23, 2026 for
// one page where readers buy the book and merchandise, with the standard book
// formats bought in one step and the full set of print choices kept as a
// special order (/book).
import { defaultPrintChoice, estimatedPrintCost, type PrintChoice } from './book-order.ts';

/** A book format sold from the Store in one step. */
export interface StandardFormat {
	identifier: string;
	label: string;
	/** Size and binding in a few words, such as "6 × 9 in". */
	detail: string;
	choice: PrintChoice;
}

export const standardFormats: StandardFormat[] = [
	{ identifier: 'paperback', label: 'Paperback', detail: '6 × 9 in', choice: { ...defaultPrintChoice } },
	{ identifier: 'hardcover', label: 'Hardcover', detail: '6 × 9 in', choice: { ...defaultPrintChoice, binding: 'caseWrap' } },
	{ identifier: 'large-paperback', label: 'Large paperback', detail: '8.5 × 11 in', choice: { ...defaultPrintChoice, size: 'us-letter' } }
];

/** Until the first edition exists, prices on the Store use this page count, as /book does. */
export const estimatePages = 300;

/** About what Lulu charges to print a standard format, before shipping, tax and the card fee. */
export function formatEstimate(format: StandardFormat): number {
	return estimatedPrintCost(format.choice, estimatePages);
}

/**
 * Merchandise. Only books are sold for now (Trevor, Nov. 23, 2026), so the
 * Store shows no Merchandise section until an item here is `available`. The
 * print-on-demand provider and who receives the money are still to be chosen
 * (docs/store.md). Art comes from Native artists the project commissions,
 * never from made-up motifs (site/DESIGN.md).
 */
export interface MerchandiseItem {
	identifier: string;
	label: string;
	status: 'planned' | 'available';
	/** Set once the item is sold: what the buyer pays, in cents. */
	priceCents?: number;
}

export const merchandise: MerchandiseItem[] = [];

/** The merchandise the Store lists: only items that can be bought. */
export function merchandiseOnSale(items: MerchandiseItem[] = merchandise): MerchandiseItem[] {
	return items.filter((item) => item.status === 'available' && item.priceCents !== undefined);
}
