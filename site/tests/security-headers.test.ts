import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { publicSecurityHeaders } from '#lib/server/security-headers.ts';

/** The headers site/_headers gives every page and file built ahead of time. */
function headersFileRules(): Record<string, string> {
	const text = readFileSync(new URL('../_headers', import.meta.url), 'utf8');
	const lines = text.split('\n').filter((line) => line.trim() && !line.startsWith('#'));
	expect(lines[0]).toBe('/*');
	const rules: Record<string, string> = {};
	for (const line of lines.slice(1)) {
		const at = line.indexOf(':');
		rules[line.slice(0, at).trim().toLowerCase()] = line.slice(at + 1).trim();
	}
	return rules;
}

describe('security headers', () => {
	it('gives pages built ahead of time the same headers as pages the Worker answers', () => {
		expect(headersFileRules()).toEqual(publicSecurityHeaders);
	});

	it('lets only the site itself frame a public page', () => {
		expect(publicSecurityHeaders['content-security-policy']).toContain("frame-ancestors 'self'");
		expect(publicSecurityHeaders['x-frame-options']).toBe('SAMEORIGIN');
	});
});
