/**
 * Identifiers for database rows and the reference numbers given to people
 * who send a request.
 */

/** A random identifier for a database row. */
export function newIdentifier(): string {
	return crypto.randomUUID();
}

// Crockford's base 32 alphabet: no I, L, O or U, so a reference read aloud
// over the phone or copied by hand is hard to get wrong.
const referenceAlphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/**
 * A request reference such as 20261121-K7QX3M: the date received, then six
 * random characters (about one billion possibilities a day).
 */
export function newRequestReference(now: Date = new Date()): string {
	const date = now.toISOString().slice(0, 10).replaceAll('-', '');
	const random = crypto.getRandomValues(new Uint8Array(6));
	const suffix = Array.from(random, (value) => referenceAlphabet[value % 32]).join('');
	return `${date}-${suffix}`;
}

/** Whether text has the shape of a request reference. */
export function isRequestReference(text: string): boolean {
	return /^\d{8}-[0-9A-HJKMNP-TV-Z]{6}$/.test(text);
}

/** The current time as stored in the database. */
export function now(): string {
	return new Date().toISOString();
}
