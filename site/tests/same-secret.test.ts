import { describe, expect, it } from 'vitest';
import { sameSecret } from '#lib/server/same-secret.ts';

describe('comparing secrets', () => {
	const secret = 'a'.repeat(31) + 'b';

	it('accepts only the same secret', () => {
		expect(sameSecret(secret, secret)).toBe(true);
		expect(sameSecret('a'.repeat(32), secret)).toBe(false);
		expect(sameSecret(secret.slice(0, 31), secret)).toBe(false);
		expect(sameSecret(`${secret}c`, secret)).toBe(false);
		expect(sameSecret('', secret)).toBe(false);
		expect(sameSecret(null, secret)).toBe(false);
		expect(sameSecret(undefined, secret)).toBe(false);
	});
});
