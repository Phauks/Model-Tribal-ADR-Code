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

export const earmarks = ['needed-most', 'books-for-nations', 'large-format', 'hosting'] as const;
export type Earmark = (typeof earmarks)[number];

/** What the sponsor picks on their Account page. */
export const earmarkLabels: Record<Earmark, string> = {
	'needed-most': 'Wherever it is needed most',
	'books-for-nations': 'A printed copy for every federally recognized nation',
	'large-format': 'The large-format edition',
	hosting: 'Website and hosting'
};

/** How the public pages finish "Helping fund: …". */
export const earmarkShortLabels: Record<Earmark, string> = {
	'needed-most': 'wherever it is needed most',
	'books-for-nations': 'a printed copy for every nation',
	'large-format': 'the large-format edition',
	hosting: 'website and hosting'
};

/**
 * The things a gift can fund that have a cost the Sponsorship page shows,
 * and what one cost buys: a printed copy for one nation, or a year of the
 * site. The lead author sets each cost on the workspace Sponsors page; none
 * is fixed here, because prices are not settled (docs/sponsorship.md).
 */
export const costedEarmarks = ['books-for-nations', 'large-format', 'hosting'] as const;
export type CostedEarmark = (typeof costedEarmarks)[number];

export const earmarkCostUnits: Record<CostedEarmark, 'copy' | 'year'> = {
	'books-for-nations': 'copy',
	'large-format': 'copy',
	hosting: 'year'
};

/** How the workspace asks for each cost. */
export const earmarkCostQuestions: Record<CostedEarmark, string> = {
	'books-for-nations': 'One paperback, printed and mailed to a nation',
	'large-format': 'One large-format copy, printed and mailed to a nation',
	hosting: 'The website for a year, with its web address'
};

export function isCostedEarmark(value: unknown): value is CostedEarmark {
	return typeof value === 'string' && (costedEarmarks as readonly string[]).includes(value);
}

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
