import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { pageDataFamilies, pageDataFileCounts, pageDataFileNumber, pageDataFilePath, pageDataPath, pageDataPrefix } from '#lib/page-data.ts';
import { staticFiles } from './static-files.ts';

describe('page data for the pages the Worker draws', () => {
	it('lives under one folder, packed into a fixed number of files for each family', () => {
		const number = pageDataFileNumber('cases', 'worcester-v-georgia');
		expect(pageDataPath('cases', 'worcester-v-georgia')).toBe(`/page-data/cases/${number}.json`);
		expect(pageDataFilePath('cases', number)).toBe(`/page-data/cases/${number}.json`);
		for (const family of pageDataFamilies) {
			expect(pageDataPath(family, 'x').startsWith(`${pageDataPrefix}/${family}/`)).toBe(true);
			const count = pageDataFileCounts[family];
			const numbers = ['a', 'worcester-v-georgia', 'cherokee-nation-v-georgia', '25-usc-1301'].map((key) => pageDataFileNumber(family, key));
			for (const each of numbers) expect(Number.isInteger(each) && each >= 0 && each < count).toBe(true);
		}
		// The same key always goes to the same file, so the build and the Worker agree.
		expect(pageDataFileNumber('laws', 'indian-civil-rights-act')).toBe(pageDataFileNumber('laws', 'indian-civil-rights-act'));
	});

	it('keeps the site well under Cloudflare\'s limit of 100,000 static files', () => {
		const files = pageDataFamilies.reduce((sum, family) => sum + pageDataFileCounts[family], 0);
		expect(files).toBeLessThan(2_000);
	});

	it('reads a page from its file, and answers 404 for a key its file lacks', async () => {
		const { stringify } = await import('devalue');
		const path = pageDataPath('cases', 'worcester-v-georgia');
		const assets = staticFiles({ [path]: { 'worcester-v-georgia': stringify({ name: 'Worcester v. Georgia', when: new Date(Date.UTC(1832, 2, 3)) }) } });
		vi.doMock('#lib/server/environment.ts', () => ({ workerEnvironment: () => ({ ASSETS: assets }) }));
		vi.resetModules();
		const { builtPageData: reader } = await import('#lib/server/page-data.ts');
		const url = new URL('https://example.org/cases/worcester-v-georgia');
		const page = await reader<{ name: string; when: Date }>('cases', 'worcester-v-georgia', url);
		expect(page.name).toBe('Worcester v. Georgia');
		expect(page.when).toBeInstanceOf(Date);
		await expect(reader('cases', 'not-a-case', url)).rejects.toMatchObject({ status: 404 });
		vi.doUnmock('#lib/server/environment.ts');
	});

	it('is never saved for offline reading, by the service worker or in the offline sizes', () => {
		const worker = readFileSync('src/service-worker/index.ts', 'utf8');
		const sizes = readFileSync('tools/write-offline-sizes.mjs', 'utf8');
		expect(worker).toContain(`'${pageDataPrefix}'`);
		expect(sizes).toMatch(new RegExp(`const neverCached = \\[[^\\]]*'${pageDataPrefix}'`));
	});

	it('names a family for each page route drawn from it', () => {
		const routes: Record<string, string> = {
			cases: 'src/routes/cases/[id]/+page.server.ts',
			laws: 'src/routes/laws/[key]/+page.server.ts',
			collections: 'src/routes/laws/[collection=browse]/+page.server.ts',
			sections: 'src/routes/laws/usc-25/[section]/+page.server.ts',
			biographies: 'src/routes/biographies/[person]/+page.server.ts',
			justices: 'src/routes/supreme-court/justices/[justice]/+page.server.ts',
			presidents: 'src/routes/presidents/[president]/+page.server.ts',
			courts: 'src/routes/supreme-court/[court]/+page.server.ts'
		};
		expect(Object.keys(routes).sort()).toEqual([...pageDataFamilies].sort());
		for (const [family, file] of Object.entries(routes)) {
			const route = readFileSync(file, 'utf8');
			expect(route).toContain('export const prerender = false;');
			expect(route).toContain(`builtPageData<`);
			expect(route).toContain(`('${family}',`);
		}
	});
});
