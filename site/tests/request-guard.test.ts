import { describe, expect, it } from 'vitest';
import { changesSomething, isCrossSite, isGuardedPath } from '#lib/server/request-guard.ts';

const site = 'https://model-tribal-adr-code.example';

function post(headers: Record<string, string>): Request {
	return new Request(`${site}/workspace/access`, { method: 'POST', headers });
}

describe('guarding changes', () => {
	it('treats only reads as safe', () => {
		expect(changesSomething('GET')).toBe(false);
		expect(changesSomething('post')).toBe(true);
		expect(changesSomething('DELETE')).toBe(true);
	});

	it('refuses a change sent from another site', () => {
		expect(isCrossSite(post({ 'sec-fetch-site': 'cross-site' }), site)).toBe(true);
		expect(isCrossSite(post({ 'sec-fetch-site': 'same-site' }), site)).toBe(true);
		expect(isCrossSite(post({ origin: 'https://evil.example' }), site)).toBe(true);
	});

	it('allows a change from the site’s own pages', () => {
		expect(isCrossSite(post({ 'sec-fetch-site': 'same-origin', origin: site }), site)).toBe(false);
		expect(isCrossSite(post({ origin: site }), site)).toBe(false);
		// Fetch Metadata wins over Origin when both are sent.
		expect(isCrossSite(post({ 'sec-fetch-site': 'cross-site', origin: site }), site)).toBe(true);
	});

	it('guards the workspace and sign-out only', () => {
		expect(isGuardedPath('/workspace')).toBe(true);
		expect(isGuardedPath('/workspace/access')).toBe(true);
		expect(isGuardedPath('/sign-out')).toBe(true);
		expect(isGuardedPath('/events/peacemaking-in-practice')).toBe(true);
		expect(isGuardedPath('/eventsx')).toBe(false);
		expect(isGuardedPath('/workspaces')).toBe(false);
		expect(isGuardedPath('/requests')).toBe(false);
	});
});
