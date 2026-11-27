import { describe, expect, it } from 'vitest';
import { filterEntries, parseSectionChoices } from '../src/lib/sidebar-outline.ts';

describe('the Go to a nation box', () => {
	const items = [
		{ label: 'Absentee-Shawnee Tribe', link: '/nations/a' },
		{ label: 'Pueblo of Zuñi', link: '/nations/z' },
		{ label: '[Account of a peace]', link: '/stories/b' },
		{ label: 'Navajo Nation', link: '/nations/n' }
	];

	it('filters by every word typed, ignoring case and accents', () => {
		expect(filterEntries(items, 'zuni').map((item) => item.link)).toEqual(['/nations/z']);
		expect(filterEntries(items, 'NATION navajo').map((item) => item.link)).toEqual(['/nations/n']);
		expect(filterEntries(items, '  ')).toBe(items);
	});
});

describe('the sections the reader opened or shut', () => {
	it('reads what it stores, and the older list of open sections', () => {
		expect(parseSectionChoices('{"/nations":true,"/glossary":false}')).toEqual({ '/nations': true, '/glossary': false });
		expect(parseSectionChoices('["/essays","/nations"]')).toEqual({ '/essays': true, '/nations': true });
	});

	it('ignores anything else', () => {
		expect(parseSectionChoices(null)).toEqual({});
		expect(parseSectionChoices('not json')).toEqual({});
		expect(parseSectionChoices('{"/nations":"yes","/about":true}')).toEqual({ '/about': true });
		expect(parseSectionChoices('[1, "/about"]')).toEqual({ '/about': true });
	});
});
