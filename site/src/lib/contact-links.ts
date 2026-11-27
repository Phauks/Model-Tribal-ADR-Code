/**
 * Turns the contact values in nation records into links a reader can follow:
 * an address opens Google Maps, a phone number opens the device's dialer, an
 * email address opens a new message. A value that cannot be read safely is
 * shown as plain text, never guessed at.
 */

/**
 * A Google Maps search for an address, using Google's documented "search"
 * URL form, https://www.google.com/maps/search/?api=1&query=… (Google Maps
 * Platform, "Get started with Maps URLs"). The form needs no key and opens
 * the Google Maps app on phones that have it.
 */
export function mapSearchLink(address: string): string | undefined {
	const query = address.trim().replace(/\s+/g, ' ');
	if (query.length === 0) return undefined;
	return `https://www.google.com/maps/search/?api=1&${new URLSearchParams({ query }).toString()}`;
}

/**
 * A tel: link (RFC 3966) for a North American phone number as the records
 * write it, such as "(505) 455-2273", "+1 (907) 221-2211" or
 * "(716) 264-6007 x110". When a record lists two numbers that share a prefix,
 * such as "(907) 640-2042/2043", the link dials the first. Anything that is
 * not ten digits, or eleven starting with 1, is left as text.
 */
export function phoneLink(value: string): string | undefined {
	const [beforeExtension, extension] = value.split(/\s*(?:x|ext\.?|extension)\s*/i);
	const firstNumber = beforeExtension.split('/')[0];
	let digits = firstNumber.replace(/\D/g, '');
	if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);
	if (digits.length !== 10) return undefined;
	const extensionDigits = extension?.replace(/\D/g, '');
	return `tel:+1-${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}${
		extensionDigits ? `;ext=${extensionDigits}` : ''
	}`;
}

/** A mailto: link for a single plain email address, or nothing. */
export function emailLink(value: string): string | undefined {
	const address = value.trim();
	return /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[a-z]{2,}$/i.test(address)
		? `mailto:${address}`
		: undefined;
}

/** A link for a web address, only when it is a complete http or https address. */
export function webLink(value: unknown): string | undefined {
	if (typeof value !== 'string') return undefined;
	try {
		const url = new URL(value);
		return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : undefined;
	} catch {
		// expected: a value that is not a web address gets no link.
		return undefined;
	}
}
