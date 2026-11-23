import { describe, expect, it } from 'vitest';
import { passwordKeyOf } from '#lib/server/accounts.ts';
import { storedSecret } from '#lib/server/stored-secrets.ts';

describe('Secrets Store bindings', () => {
	it('reads a secret once and keeps it', async () => {
		let reads = 0;
		const binding = {
			get: async () => {
				reads += 1;
				return ' a-key ';
			}
		};
		expect(await storedSecret(binding)).toBe('a-key');
		expect(await storedSecret(binding)).toBe('a-key');
		expect(reads).toBe(1);
	});

	it('counts a missing binding or an unreadable secret as not set, and tries again later', async () => {
		expect(await storedSecret(undefined)).toBeUndefined();
		let fail = true;
		const binding = {
			get: async () => {
				if (fail) throw new Error('Secret not found');
				return 'now-there';
			}
		};
		expect(await storedSecret(binding)).toBeUndefined();
		fail = false;
		expect(await storedSecret(binding)).toBe('now-there');
	});

	it('uses the password key only when it is long enough', async () => {
		const long = 'k'.repeat(48);
		expect(await passwordKeyOf({ passwordKey: { get: async () => long } } as unknown as WorkerEnvironment)).toBe(long);
		expect(await passwordKeyOf({ passwordKey: { get: async () => 'short' } } as unknown as WorkerEnvironment)).toBeUndefined();
		expect(await passwordKeyOf({} as WorkerEnvironment)).toBeUndefined();
	});
});
