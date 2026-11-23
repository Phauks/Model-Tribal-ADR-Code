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
