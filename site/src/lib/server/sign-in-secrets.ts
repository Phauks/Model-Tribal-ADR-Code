/**
 * Random tokens, codes and hashes for the site's own sign-in
 * (site/COLLABORATION.md, "How sign-in works"), using only the Web Crypto
 * built into Workers. The approach follows the lead author's Grimbinder
 * project (worker/account/crypto.ts there).
 */

function base64Url(bytes: Uint8Array): string {
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function hex(buffer: ArrayBuffer): string {
	return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** An unguessable token: 32 random bytes (256 bits), written in base64url. */
export function randomToken(bytes = 32): string {
	return base64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export const codeLength = 6;

/** A uniformly random six-digit code (rejection sampling, so no digit is more likely). */
export function randomCode(): string {
	const limit = 10 ** codeLength;
	const ceiling = Math.floor(0x1_0000_0000 / limit) * limit;
	const word = new Uint32Array(1);
	do crypto.getRandomValues(word);
	while (word[0] >= ceiling);
	return String(word[0] % limit).padStart(codeLength, '0');
}

/** SHA-256 as hex. Codes, links and session tokens are stored only this way. */
export async function sha256(text: string): Promise<string> {
	return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
}

/** Compares two hex hashes without stopping at the first difference. */
export function sameHash(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let difference = 0;
	for (let index = 0; index < a.length; index += 1) difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
	return difference === 0;
}

/**
 * PBKDF2-SHA256 rounds for passwords. OWASP's Password Storage Cheat Sheet
 * recommends 600,000 rounds of PBKDF2-HMAC-SHA256
 * (cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html,
 * "PBKDF2"). Workers refuse more than 100,000 rounds in one call, so the
 * rounds run in steps of at most 100,000, each step's result being the next
 * step's input: guessing a password still costs all 600,000 rounds. A hash
 * made with 100,000 rounds is one step, exactly as the site made them before
 * Nov. 23, 2026, so older passwords keep working and are upgraded the next
 * time their owner signs in. The count is stored with each hash.
 */
export const passwordIterations = 600_000;

/** The most rounds Workers allow in one PBKDF2 call. */
const roundsPerStep = 100_000;

const encoder = new TextEncoder();

async function pbkdf2(input: Uint8Array<ArrayBuffer>, salt: string, iterations: number): Promise<Uint8Array<ArrayBuffer>> {
	const key = await crypto.subtle.importKey('raw', input, 'PBKDF2', false, ['deriveBits']);
	const bits = await crypto.subtle.deriveBits(
		{ name: 'PBKDF2', hash: 'SHA-256', salt: encoder.encode(salt), iterations },
		key,
		256
	);
	return new Uint8Array(bits);
}

/**
 * A password's hash, as hex: PBKDF2-SHA256 with this salt and number of
 * rounds, then, when the Worker has a password key, HMAC-SHA256 with that key.
 * NIST SP 800-63B-4, section 3.1.1.2, asks for this "additional iteration of
 * a keyed hashing ... operation using a secret key known only to the
 * verifier", stored apart from the hashes: the key is a secret in Cloudflare
 * Secrets Store, read through the passwordKey binding, so a copy of the
 * database alone is not enough to start guessing passwords.
 */
export async function passwordHash(
	password: string,
	salt: string,
	iterations = passwordIterations,
	key?: string
): Promise<string> {
	let bits: Uint8Array<ArrayBuffer> = encoder.encode(password.normalize('NFC'));
	let left = iterations;
	do {
		const rounds = Math.min(left, roundsPerStep);
		bits = await pbkdf2(bits, salt, rounds);
		left -= rounds;
	} while (left > 0);
	if (!key) return hex(bits.buffer);
	const hmacKey = await crypto.subtle.importKey('raw', encoder.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, [
		'sign'
	]);
	return hex(await crypto.subtle.sign('HMAC', hmacKey, bits));
}

/**
 * Password rules, following NIST SP 800-63B-4, section 3.1.1.2: at least 15
 * characters when the password is the only thing needed to sign in, a
 * generous maximum, any characters including spaces, no rules about mixing
 * character types, and a check against passwords that are common, that have
 * leaked, or that come from this site or the person's address
 * (src/lib/server/password-checks.ts).
 */
export const passwordMinimumLength = 15;
export const passwordMaximumLength = 256;

/** How many characters a password has, counting each Unicode code point once (NIST SP 800-63B-4, 3.1.1.2). */
export function passwordLength(password: string): number {
	return [...password.normalize('NFC')].length;
}
