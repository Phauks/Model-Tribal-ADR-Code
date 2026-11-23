/**
 * Whether a purchase may carry a gift to the project, and who receives it
 * (docs/book-orders.md, "Adding a gift"). In test mode no real money moves,
 * so the choice is always offered for trying the whole path. In live mode it
 * is offered only once SPONSOR_GIFTS_RECEIVER names who receives gifts, the
 * same setting sponsor gifts need (docs/sponsorship.md): no one is asked for
 * a gift before that is decided.
 */
import { giftCents, type GiftChoice } from '#lib/checkout-gift.ts';

export function checkoutGiftReceiver(environment: WorkerEnvironment, mode: 'test' | 'live'): string | null {
	if (mode === 'test') return 'Model Tribal ADR Code (test mode: no real money moves)';
	return environment.SPONSOR_GIFTS_RECEIVER?.trim() || null;
}

/** The gift to charge for a choice, checked against the real price and whether gifts are offered. */
export function checkoutGift(
	environment: WorkerEnvironment,
	mode: 'test' | 'live',
	choice: GiftChoice,
	priceCents: number
): { cents: number } | { problem: string } {
	const result = giftCents(choice, priceCents);
	if ('problem' in result || result.cents === 0) return result;
	if (!checkoutGiftReceiver(environment, mode)) return { problem: 'Gifts cannot be added yet. Choose No thanks to order the book alone.' };
	return result;
}
