import { afterEach, describe, expect, it, vi } from 'vitest';

describe('loadSearchIndex', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.resetModules();
	});

	it('fetches the index once and shares it', async () => {
		const fetchIndex = vi.fn(async () => new Response(JSON.stringify([{ kind: 'page', title: 'Glossary', link: '/glossary' }])));
		vi.stubGlobal('fetch', fetchIndex);
		const { loadSearchIndex } = await import('../src/lib/site-search.ts');
		const [first, second] = await Promise.all([loadSearchIndex(), loadSearchIndex()]);
		expect(first).toEqual(second);
		expect(first[0].title).toBe('Glossary');
		expect(fetchIndex).toHaveBeenCalledTimes(1);
	});

	it('tries again after a failed fetch', async () => {
		const fetchIndex = vi
			.fn()
			.mockResolvedValueOnce(new Response('missing', { status: 404 }))
			.mockResolvedValueOnce(new Response('[]'));
		vi.stubGlobal('fetch', fetchIndex);
		const { loadSearchIndex } = await import('../src/lib/site-search.ts');
		await expect(loadSearchIndex()).rejects.toThrow('404');
		await expect(loadSearchIndex()).resolves.toEqual([]);
		expect(fetchIndex).toHaveBeenCalledTimes(2);
	});
});
