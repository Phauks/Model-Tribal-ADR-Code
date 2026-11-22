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
 * PBKDF2-SHA256 iterations for passwords. Workers allow at most 100,000
 * (Cloudflare, "Web Crypto", developers.cloudflare.com/workers/runtime-apis/web-crypto/),
 * so the site uses that. The count is stored with each hash, so it can be
 * raised later without locking anyone out.
 */
export const passwordIterations = 100_000;

/** A password's PBKDF2-SHA256 hash with this salt, as hex. */
export async function passwordHash(password: string, salt: string, iterations = passwordIterations): Promise<string> {
	const key = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(password.normalize('NFC')),
		'PBKDF2',
		false,
		['deriveBits']
	);
	const bits = await crypto.subtle.deriveBits(
		{ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations },
		key,
		256
	);
	return hex(bits);
}

/**
 * Password rules, following NIST SP 800-63B section 3.1.1.2: a minimum
 * length, a generous maximum, any characters including spaces, and no rules
 * about mixing character types.
 */
export const passwordMinimumLength = 12;
export const passwordMaximumLength = 256;

/** Why a new password cannot be used, or nothing if it can. */
export function passwordProblem(password: string, email: string): string | undefined {
	const length = [...password.normalize('NFC')].length;
	if (length < passwordMinimumLength) return `Use at least ${passwordMinimumLength} characters. A few unrelated words make a strong password that is easy to remember.`;
	if (length > passwordMaximumLength) return `Use at most ${passwordMaximumLength} characters.`;
	if (password.trim().toLocaleLowerCase('en-US') === email.trim().toLocaleLowerCase('en-US')) {
		return 'Do not use your email address as your password.';
	}
	return undefined;
}
