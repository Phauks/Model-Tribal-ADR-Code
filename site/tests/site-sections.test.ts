import { describe, expect, it } from 'vitest';
import { sectionOf, siteSections } from '../src/lib/site-sections.ts';

describe('site sections for the sidebar', () => {
	it('leads with the nations, the library and the glossary', () => {
		expect(siteSections.map((section) => section.label)).toEqual([
			'Nations',
			'Library',
			'Glossary',
			'Foundations',
			'Essays',
			'Methods and stories',
			'Model code',
			'Peacemaking',
			'Events',
			'About',
			'Sponsorship',
			'Contribute',
			'Store'
		]);
	});

	it('finds the section of a page from its address', () => {
		expect(sectionOf('/nations')?.label).toBe('Nations');
		expect(sectionOf('/nations/navajo-nation')?.label).toBe('Nations');
		expect(sectionOf('/glossary/adr')?.label).toBe('Glossary');
		expect(sectionOf('/stories/some-story')?.label).toBe('Methods and stories');
		expect(sectionOf('/')).toBeUndefined();
		expect(sectionOf('/nationsx')).toBeUndefined();
	});

	it('counts the special-order page as part of the Store', () => {
		expect(sectionOf('/store')?.label).toBe('Store');
		expect(sectionOf('/book')?.label).toBe('Store');
		expect(sectionOf('/bookx')).toBeUndefined();
	});

	it('counts the pages the Library gathers as part of it', () => {
		expect(sectionOf('/library')?.label).toBe('Library');
		expect(sectionOf('/copies')?.label).toBe('Library');
		expect(sectionOf('/copies/list/statutes')?.label).toBe('Library');
		expect(sectionOf('/downloads')?.label).toBe('Library');
		expect(sectionOf('/back-matter/cases-by-topic')?.label).toBe('Library');
		expect(sectionOf('/licenses/cc-by-4.0')?.label).toBe('Library');
		expect(sectionOf('/supreme-court/marshall-court')?.label).toBe('Library');
		expect(sectionOf('/copiesx')).toBeUndefined();
		const library = siteSections.find((section) => section.label === 'Library');
		expect(library?.gathers?.map((page) => page.link)).toEqual(['/copies', '/downloads', '/supreme-court', '/back-matter', '/licenses']);
	});

	it('links only sections whose pages exist', () => {
		const built = siteSections.filter((section) => section.built).map((section) => section.link);
		expect(built).toEqual(['/nations', '/library', '/glossary', '/foundations', '/essays', '/stories', '/events', '/about', '/sponsor', '/requests?kind=contribute', '/store']);
	});
});
