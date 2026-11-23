import { describe, expect, it } from 'vitest';
import { sectionOf, siteSections } from '../src/lib/site-sections.ts';

describe('site sections for the sidebar', () => {
	it('follows the order of the working outline’s main menu', () => {
		expect(siteSections.map((section) => section.label)).toEqual([
			'Model code',
			'Peacemaking',
			'Foundations',
			'Essays',
			'Methods and stories',
			'Nations',
			'Library',
			'Glossary',
			'Events',
			'About',
			'Sponsorship'
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

	it('links only sections whose pages exist', () => {
		const built = siteSections.filter((section) => section.built).map((section) => section.link);
		expect(built).toEqual(['/foundations', '/essays', '/stories', '/nations', '/glossary', '/events', '/about', '/sponsor']);
	});
});
