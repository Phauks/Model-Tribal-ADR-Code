import { describe, expect, it } from 'vitest';
import { composeSectionOutline, currentLinkIn, parseSectionChoices } from '../src/lib/sidebar-outline.ts';

const nations = [
	{ label: 'Directory', link: '/nations' },
	{ label: 'Map', link: '/nations/map' },
	{ label: 'Find recourse', link: '/nations/recourse' }
];
const headings = [
	{ label: 'Government', link: '#government-heading' },
	{ label: 'Sources', link: '#sources-heading' }
];

describe('what the sidebar lists inside the section being read', () => {
	it('keeps the section’s pages and nests a page that is not listed under the entry that holds it', () => {
		const items = composeSectionOutline(nations, { title: 'Navajo Nation', items: headings }, '/nations/navajo-nation');
		expect(items.map((item) => item.link)).toEqual(['/nations', '/nations/map', '/nations/recourse']);
		expect(items[0].children).toEqual([{ label: 'Navajo Nation', link: '/nations/navajo-nation', current: true, children: headings }]);
	});

	it('puts a listed page’s headings under its own entry', () => {
		const essays = [
			{ label: 'First essay', link: '/essays/first' },
			{ label: 'Second essay', link: '/essays/second' }
		];
		const items = composeSectionOutline(essays, { items: headings }, '/essays/second');
		expect(items[0].children).toBeUndefined();
		expect(items[1]).toEqual({ label: 'Second essay', link: '/essays/second', children: headings });
	});

	it('shows the section’s pages alone when the page has no outline, and the page’s outline alone outside a list', () => {
		expect(composeSectionOutline(nations, undefined, '/nations/map')).toBe(nations);
		expect(composeSectionOutline(undefined, { items: headings }, '/sponsor')).toBe(headings);
		expect(composeSectionOutline(undefined, undefined, '/sponsor')).toEqual([]);
	});

	it('adds a page held by no entry at the end, named by its outline or title', () => {
		const items = composeSectionOutline([{ label: 'About the project', link: '/about' }], { items: headings }, '/charter', 'Charter');
		expect(items.at(-1)).toEqual({ label: 'Charter', link: '/charter', current: true, children: headings });
	});
});

describe('the address that marks the page being read', () => {
	const events = [
		{ label: 'Upcoming events', link: '/events' },
		{ label: 'Past events', link: '/events?when=past' }
	];

	it('uses the query when the list has an entry for it', () => {
		expect(currentLinkIn(events, '/events', '?when=past')).toBe('/events?when=past');
		expect(currentLinkIn(events, '/events', '')).toBe('/events');
	});

	it('ignores a query the list does not know', () => {
		expect(currentLinkIn(nations, '/nations', '?nations-c-native-nation.states=Alaska')).toBe('/nations');
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
