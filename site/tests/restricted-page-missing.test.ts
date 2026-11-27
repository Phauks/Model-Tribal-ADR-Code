import { describe, expect, it, vi } from 'vitest';

// No database, so no restrictions: the page is served as built, or not at all.
const bindings: Record<string, unknown> = {};
vi.mock('$app/env', () => ({ version: 'test-build', building: false, dev: false }));
vi.mock('cloudflare:workers', () => ({ env: bindings, waitUntil: () => undefined }));

const { restrictedPageAnswer, restrictedPagePrefix } = await import('../src/lib/server/restricted-pages.ts');

function eventFor(path: string) {
	return { url: new URL(`https://triballawproject.org${restrictedPagePrefix}${path}`), isDataRequest: false, request: new Request('https://triballawproject.org/') } as never as Parameters<typeof restrictedPageAnswer>[0];
}

describe('a page sent to be checked for restrictions', () => {
	it('is served as built when it was built', async () => {
		bindings.ASSETS = { fetch: async () => new Response('<html>Karuk Tribe</html>', { status: 200 }) };
		const answer = await restrictedPageAnswer(eventFor('/nations/karuk-tribe'));
		expect(await answer?.text()).toBe('<html>Karuk Tribe</html>');
	});

	it('goes on to the Page not found page, not a blank page, when no page was built at the address', async () => {
		// The built files answer a miss with an empty body (Nov. 27, 2026: /nations/karuk-trib showed a blank page).
		bindings.ASSETS = { fetch: async () => new Response(null, { status: 404 }) };
		const event = eventFor('/nations/karuk-trib');
		expect(await restrictedPageAnswer(event)).toBeUndefined();
		expect((event as unknown as { url: URL }).url.pathname).toBe('/nations/karuk-trib');
	});
});
