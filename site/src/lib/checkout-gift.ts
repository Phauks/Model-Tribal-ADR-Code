// An optional gift to the project added to a purchase, such as a printed
// copy (docs/book-orders.md, "Adding a gift"). The buyer picks it on the
// order page; nothing is added unless they do, because an extra charge
// chosen in advance reads as a trick and is barred in the EU (Directive
// 2011/83/EU, art. 22). The gift is its own line on Stripe's page and is
// recorded apart from the sale. Paid event tickets reuse it when they come.

/** The set amounts offered, in whole dollars. */
export const giftPresets = [5, 10, 25] as const;
export type GiftPreset = (typeof giftPresets)[number];

/** The largest gift taken with a purchase, in cents. A larger gift is arranged by writing to the project. */
export const largestCheckoutGift = 100000;

/** The smallest "other" amount, in cents. */
export const smallestOtherGift = 100;

export type GiftChoice = { kind: 'none' } | { kind: 'round-up' } | { kind: 'preset'; dollars: GiftPreset } | { kind: 'other'; cents: number };

/** What rounding the price up to the next $5 adds, in cents; 0 when the price is already a whole $5. */
export function roundUpCents(priceCents: number): number {
	const step = 500;
	return priceCents % step === 0 ? 0 : step - (priceCents % step);
}

/** The gift in cents for a choice and a price, or a problem to show. */
export function giftCents(choice: GiftChoice, priceCents: number): { cents: number } | { problem: string } {
	switch (choice.kind) {
		case 'none':
			return { cents: 0 };
		case 'round-up':
			return { cents: roundUpCents(priceCents) };
		case 'preset':
			return giftPresets.includes(choice.dollars) ? { cents: choice.dollars * 100 } : { problem: 'Choose one of the gift amounts.' };
		case 'other':
			if (!Number.isInteger(choice.cents) || choice.cents < smallestOtherGift || choice.cents > largestCheckoutGift) {
				return {
					problem: `Give an amount from $${smallestOtherGift / 100} to $${(largestCheckoutGift / 100).toLocaleString('en-US')}, or choose No thanks.`
				};
			}
			return { cents: choice.cents };
	}
}

/** "12.50" typed by the buyer, in cents, or NaN. */
export function centsFromText(text: string): number {
	const cleaned = text.replace(/[$,\s]/g, '');
	if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return Number.NaN;
	return Math.round(Number(cleaned) * 100);
}

/** Reads a gift choice sent by a page; anything not recognized is no gift. */
export function readGiftChoice(value: unknown): GiftChoice {
	if (!value || typeof value !== 'object') return { kind: 'none' };
	const fields = value as Record<string, unknown>;
	if (fields.kind === 'round-up') return { kind: 'round-up' };
	if (fields.kind === 'preset' && giftPresets.includes(fields.dollars as GiftPreset)) return { kind: 'preset', dollars: fields.dollars as GiftPreset };
	if (fields.kind === 'other' && typeof fields.cents === 'number') return { kind: 'other', cents: fields.cents };
	return { kind: 'none' };
}
