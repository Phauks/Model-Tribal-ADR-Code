/**
 * Signed tokens for the links and addresses in outreach messages: the
 * unsubscribe link and address, and the visible "let us know you got this"
 * link. A token names one row (an outreach recipient or a message) and is
 * signed with MAIL_SIGNING_KEY (HMAC with SHA-256, Web Crypto), so nobody can
 * make one for another row.
 *
 * Tokens use lower-case base 32, because some mail systems change the case
 * of an address, and an unsubscribe address such as
 * unsubscribe+<token>@example.org must stay within the 64 characters an
 * address's local part may have (RFC 5321, section 4.5.3.1.1).
 */

export type TokenKind = 'unsubscribe' | 'acknowledge' | 'file';

const kindBytes: Record<TokenKind, number> = { unsubscribe: 0x75, acknowledge: 0x61, file: 0x66 };
const alphabet = 'abcdefghijklmnopqrstuvwxyz234567';
const signatureLength = 10;
const encoder = new TextEncoder();

function base32(bytes: Uint8Array): string {
	let bits = 0;
	let value = 0;
	let output = '';
	for (const byte of bytes) {
		value = (value << 8) | byte;
		bits += 8;
		while (bits >= 5) {
			output += alphabet[(value >>> (bits - 5)) & 31];
			bits -= 5;
		}
	}
	if (bits > 0) output += alphabet[(value << (5 - bits)) & 31];
	return output;
}

function fromBase32(text: string): Uint8Array<ArrayBuffer> | null {
	let bits = 0;
	let value = 0;
	const output: number[] = [];
	for (const character of text) {
		const index = alphabet.indexOf(character);
		if (index === -1) return null;
		value = (value << 5) | index;
		bits += 5;
		if (bits >= 8) {
			output.push((value >>> (bits - 8)) & 255);
			bits -= 8;
		}
	}
	return new Uint8Array(output);
}

function uuidBytes(identifier: string): Uint8Array<ArrayBuffer> | null {
	const hex = identifier.replaceAll('-', '');
	if (!/^[0-9a-f]{32}$/i.test(hex)) return null;
	return new Uint8Array(hex.match(/../g)!.map((pair) => parseInt(pair, 16)));
}

function uuidText(bytes: Uint8Array): string {
	const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function signingKey(secret: string): Promise<CryptoKey> {
	return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}

async function signature(secret: string, body: Uint8Array<ArrayBuffer>): Promise<Uint8Array> {
	const full = await crypto.subtle.sign('HMAC', await signingKey(secret), body);
	return new Uint8Array(full).slice(0, signatureLength);
}

/** A token for one row, named by its identifier (a UUID). */
export async function makeToken(secret: string, kind: TokenKind, identifier: string): Promise<string> {
	const id = uuidBytes(identifier);
	if (!id) throw new Error('Tokens name rows by their UUID identifier.');
	const body = new Uint8Array([kindBytes[kind], ...id]);
	return base32(new Uint8Array([...body, ...(await signature(secret, body))]));
}

/** The identifier a token names, or null when it is not a valid token of this kind. */
export async function readToken(secret: string, kind: TokenKind, token: string): Promise<string | null> {
	const bytes = fromBase32(token.trim().toLowerCase());
	if (!bytes || bytes.length !== 17 + signatureLength) return null;
	const body = bytes.slice(0, 17);
	if (body[0] !== kindBytes[kind]) return null;
	const expected = await signature(secret, body);
	const given = bytes.slice(17);
	let difference = 0;
	for (let index = 0; index < signatureLength; index += 1) difference |= expected[index] ^ given[index];
	return difference === 0 ? uuidText(body.slice(1)) : null;
}

/** The token in an unsubscribe+<token>@domain address, or null for any other address. */
export function unsubscribeAddressToken(address: string): string | null {
	const match = /^unsubscribe\+([a-z2-7]+)@/i.exec(address.trim());
	return match ? match[1].toLowerCase() : null;
}
