import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { pageDataFamilies, pageDataPath, pageDataPrefix } from '#lib/page-data.ts';

describe('page data for the pages the Worker draws', () => {
	it('lives under one folder, one file for each page', () => {
		expect(pageDataPath('cases', 'worcester-v-georgia')).toBe('/page-data/cases/worcester-v-georgia.json');
		for (const family of pageDataFamilies) expect(pageDataPath(family, 'x').startsWith(`${pageDataPrefix}/${family}/`)).toBe(true);
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
