// Labels for sponsor accounts (docs/sponsorship.md), shared by the Account
// page, the public sponsor pages and the lead author's Sponsors page.

export const listings = ['name-logo-link', 'name', 'anonymous', 'hidden'] as const;
export type Listing = (typeof listings)[number];

export const listingLabels: Record<Listing, string> = {
	'name-logo-link': 'Name, logo and link',
	name: 'Name only',
	anonymous: 'As “a sponsor”, without our name',
	hidden: 'Don’t list us'
};

/**
 * The project's named effort to send a printed copy of the book to every
 * federally recognized Native nation (Trevor, Nov. 24, 2026: a named
 * initiative makes the cause easy to identify). Gifts toward it are the
 * earmark "books-for-nations".
 */
export const initiativeName = 'Every Nation Initiative';

export const earmarks = ['needed-most', 'books-for-nations', 'large-format', 'research', 'hosting'] as const;
export type Earmark = (typeof earmarks)[number];

/** What the sponsor picks on their Account page and the Sponsorship page. */
export const earmarkLabels: Record<Earmark, string> = {
	'needed-most': 'Discretionary',
	'books-for-nations': initiativeName,
	'large-format': 'Accessibility Formats',
	research: 'Research',
	hosting: 'Digital Infrastructure'
};

/** How the public pages finish "Helping fund: …" and "Their gift goes toward …". */
export const earmarkShortLabels: Record<Earmark, string> = {
	'needed-most': 'the Discretionary fund',
	'books-for-nations': `the ${initiativeName}`,
	'large-format': 'Accessibility Formats',
	research: 'Research',
	hosting: 'Digital Infrastructure'
};

/**
 * The costs the Sponsorship page shows, and what one cost buys: a paperback
 * printed and mailed to one nation, a hardcover the same way, or a year of
 * the website. The lead author sets each on the workspace Sponsors page;
 * none is fixed here, because prices are not settled (docs/sponsorship.md).
 */
export const costItems = ['paperback', 'hardcover', 'website'] as const;
export type CostItem = (typeof costItems)[number];

export const costItemUnits: Record<CostItem, 'copy' | 'year'> = {
	paperback: 'copy',
	hardcover: 'copy',
	website: 'year'
};

/** How the workspace asks for each cost. */
export const costItemQuestions: Record<CostItem, string> = {
	paperback: 'One paperback, printed and mailed to a nation',
	hardcover: 'One hardcover, printed and mailed to a nation',
	website: 'The website for a year, with its web address'
};

export function isListing(value: unknown): value is Listing {
	return typeof value === 'string' && (listings as readonly string[]).includes(value);
}

export function isEarmark(value: unknown): value is Earmark {
	return typeof value === 'string' && (earmarks as readonly string[]).includes(value);
}

export const giftFrequencies = ['monthly', 'one-time'] as const;
export type GiftFrequency = (typeof giftFrequencies)[number];

export const giftFrequencyLabels: Record<GiftFrequency, string> = {
	monthly: 'Every month',
	'one-time': 'Once'
};

/** The smallest and largest gift the form takes, in whole dollars. Larger gifts are arranged by writing to the project. */
export const smallestGift = 5;
export const largestGift = 10000;

/**
 * An amount of US dollars as a person writes it ("25", "$1,250", "12.50"),
 * in cents, or null when it is not an amount of money: digits, commas only
 * between groups of three, and at most two digits of cents. Number() alone
 * would also take "1e3", "0x10" or "12.345".
 */
export function centsFromDollars(text: string): number | null {
	const plain = text.trim().replace(/^\$\s*/, '');
	if (!/^(0|[1-9]\d{0,2}(,\d{3})+|[1-9]\d*)(\.\d{1,2})?$/.test(plain)) return null;
	const [whole, fraction = ''] = plain.replaceAll(',', '').split('.');
	if (whole.length > 9) return null;
	return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

/** A gift in cents, when the text is an amount from the smallest to the largest gift; otherwise null. */
export function giftCents(text: string): number | null {
	const cents = centsFromDollars(text);
	return cents !== null && cents >= smallestGift * 100 && cents <= largestGift * 100 ? cents : null;
}

/**
 * What an amount box keeps while someone types: digits, commas and one
 * point with at most two digits after it. Anything else is dropped as it
 * is typed, so the box only ever holds something that can be money.
 */
export function dollarsWhileTyping(text: string): string {
	const kept = text.replace(/[^\d.,]/g, '');
	const point = kept.indexOf('.');
	if (point === -1) return kept;
	return kept.slice(0, point + 1) + kept.slice(point + 1).replace(/[.,]/g, '').slice(0, 2);
}

/** An amount box's text once someone leaves it: "1,250" or "12.50", or the text unchanged when it is not money. */
export function dollarsAfterTyping(text: string): string {
	const cents = centsFromDollars(text);
	if (cents === null) return text;
	return new Intl.NumberFormat('en-US', { minimumFractionDigits: cents % 100 === 0 ? 0 : 2, maximumFractionDigits: 2 }).format(cents / 100);
}

/** "$1,250" or "$12.50", for an amount in cents. */
export function dollars(cents: number): string {
	const whole = cents % 100 === 0;
	return new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency: 'USD',
		minimumFractionDigits: whole ? 0 : 2,
		maximumFractionDigits: 2
	}).format(cents / 100);
}

/** Two letters for a sponsor without a logo, such as "EC" for Example Community Foundation. */
export function initials(name: string): string {
	const words = name
		.split(/\s+/)
		.map((word) => word.replace(/[^\p{L}\p{N}]/gu, ''))
		.filter((word) => word && !['of', 'the', 'and', 'for', 'a', 'an'].includes(word.toLowerCase()));
	return (words.length >= 2 ? words[0][0] + words[1][0] : (words[0] ?? '?').slice(0, 2)).toUpperCase();
}

/** A sponsor's address on this site, made from their name: lowercase letters, digits and hyphens. */
export function slugFor(name: string): string {
	const slug = name
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/&/g, ' and ')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 70)
		.replace(/-+$/g, '');
	return slug || 'sponsor';
}
