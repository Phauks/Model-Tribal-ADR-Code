import { describe, expect, it } from 'vitest';
import { safeReturnPath, signInSettings } from '#lib/server/sign-in.ts';

describe('return path after sign-in', () => {
	it('keeps paths inside the site', () => {
		expect(safeReturnPath('/workspace/requests?show=all')).toBe('/workspace/requests?show=all');
	});

	it('refuses addresses that would leave the site', () => {
		for (const candidate of ['https://example.com', '//example.com/x', '/\\example.com', 'workspace', '', null]) {
			expect(safeReturnPath(candidate)).toBe('/workspace');
		}
	});
});

describe('sign-in settings', () => {
	const environment = {
		AUTH0_DOMAIN: 'https://example.us.auth0.com/',
		AUTH0_CLIENT_ID: 'client',
		AUTH0_CLIENT_SECRET: 'secret',
		SESSION_SECRET: 'x'.repeat(32)
	} as unknown as WorkerEnvironment;

	it('names the missing secrets', () => {
		expect(signInSettings({} as WorkerEnvironment)).toEqual({
			missing: ['AUTH0_DOMAIN', 'AUTH0_CLIENT_ID', 'AUTH0_CLIENT_SECRET', 'SESSION_SECRET']
		});
	});

	it('asks for a long session secret', () => {
		expect(signInSettings({ ...environment, SESSION_SECRET: 'short' })).toEqual({
			missing: ['SESSION_SECRET (at least 32 characters)']
		});
	});

	it('accepts a pasted domain with https:// and a trailing slash', () => {
		const result = signInSettings(environment);
		expect('settings' in result && result.settings.domain).toBe('example.us.auth0.com');
	});
});
