/**
 * Compares a secret someone sent with the one expected, taking the same time
 * however many characters match, so the time an answer takes cannot be used
 * to guess the secret one character at a time (OWASP, Authentication Cheat
 * Sheet; Node.js, crypto.timingSafeEqual). Only the length can show, and the
 * Worker's own tokens all have the same length.
 */
export function sameSecret(given: string | null | undefined, expected: string): boolean {
	if (typeof given !== 'string') return false;
	const encoder = new TextEncoder();
	const givenBytes = encoder.encode(given);
	const expectedBytes = encoder.encode(expected);
	let difference = givenBytes.length ^ expectedBytes.length;
	for (let index = 0; index < expectedBytes.length; index += 1) {
		difference |= (givenBytes[index] ?? 0) ^ expectedBytes[index];
	}
	return difference === 0;
}
