import { describe, expect, it } from 'vitest';
import { GET } from '../src/routes/verify/+server.ts';

describe('the old Verify a file address', () => {
	it('sends readers to Checking a file on the Downloads page, keeping the hash', () => {
		const url = new URL('https://example.org/verify?sha256=abc&name=data.zip');
		let thrown: unknown;
		try {
			// @ts-expect-error the handler reads only the address
			GET({ url });
		} catch (error) {
			thrown = error;
		}
		expect(thrown).toMatchObject({ status: 308, location: '/downloads?sha256=abc&name=data.zip#checking' });
	});
});
