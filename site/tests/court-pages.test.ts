import { describe, expect, it } from 'vitest';
import { courtKey, courtName, courtPagePath } from '#lib/court-pages.ts';
import { filterCourtPage, restrictedPageView } from '#lib/restricted-pages.ts';
import { stubRequestLink } from '#lib/stubs.ts';

describe('court pages', () => {
	it('puts the names of one court in one form', () => {
		const ninth = 'United States Court of Appeals for the Ninth Circuit';
		expect(courtName('9th Cir.')).toBe(ninth);
		expect(courtName('U.S. Court of Appeals for the Ninth Circuit')).toBe(ninth);
		expect(courtName('United States Court of Appeals for the Ninth Circuit')).toBe(ninth);
		expect(courtName('U.S. Court of Appeals for the D.C. Circuit')).toBe('United States Court of Appeals for the District of Columbia Circuit');
		expect(courtName('United States Court of Appeals for the District of Columbia Circuit')).toBe('United States Court of Appeals for the District of Columbia Circuit');
		expect(courtName('U.S. District Court, W.D. Oklahoma')).toBe('United States District Court for the Western District of Oklahoma');
		expect(courtName('W.D. Okla.')).toBe('United States District Court for the Western District of Oklahoma');
		expect(courtName('Oklahoma Supreme Court')).toBe('Supreme Court of Oklahoma');
		// A Tribal court's name is left as it is.
		expect(courtName('Navajo Nation Supreme Court')).toBe('Navajo Nation Supreme Court');
	});

	it('gives each court one address, and the Supreme Court its own pages', () => {
		expect(courtKey('Fort Peck Court of Appeals')).toBe('fort-peck-court-of-appeals');
		expect(courtKey('Suprema Corte de Justicia de la Nación')).toBe('suprema-corte-de-justicia-de-la-nacion');
		expect(courtPagePath('9th Cir.')).toBe(courtPagePath('U.S. Court of Appeals for the Ninth Circuit'));
		expect(courtPagePath('U.S. Supreme Court')).toBe('/supreme-court');
		expect(courtPagePath('')).toBeUndefined();
	});

	it('leaves out of a court page the opinions a nation hid, and links cited ones to their originals', () => {
		expect(restrictedPageView('/courts/fort-peck-court-of-appeals')?.view).toBe('court');
		const restrictions = {
			stamp: 'stamp',
			levels: new Map<string, 'cite' | 'hide'>([
				['copy:a/1.html', 'hide'],
				['copy:a/2.html', 'cite']
			]),
			items: new Map(),
			hiddenDocuments: new Set<string>()
		} as unknown as Parameters<typeof filterCourtPage>[1];
		const data = {
			opinionKeys: ['a/1.html', 'a/2.html', 'a/3.html'],
			opinions: [
				{ key: 'a/1.html', path: '/copies/view/a/1.html', original: 'https://example.org/1', topics: ['gaming'] },
				{ key: 'a/2.html', path: '/copies/view/a/2.html', original: 'https://example.org/2', topics: ['gaming'] },
				{ key: 'a/3.html', path: '/copies/view/a/3.html', original: 'https://example.org/3', topics: [] }
			]
		};
		const filtered = filterCourtPage(data, restrictions) as typeof data;
		expect(filtered.opinionKeys).toEqual(['a/2.html', 'a/3.html']);
		expect(filtered.opinions.map((opinion) => opinion.path)).toEqual(['https://example.org/2', '/copies/view/a/3.html']);
		expect(filtered.opinions[0].topics).toEqual([]);
	});
});

describe('stubs', () => {
	it('links to the request form with the page filled in', () => {
		expect(stubRequestLink({ kind: 'court', record: 'courts/fort-peck-court-of-appeals' }, 'write-up')).toBe('#request=contribute&record=courts/fort-peck-court-of-appeals&field=write-up');
	});
});
