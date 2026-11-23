import { describe, expect, it } from 'vitest';
import { composeSectionContents, currentLinkIn, filterEntries, letterGroups, parseSectionChoices } from '../src/lib/sidebar-outline.ts';

const nations = [
	{ label: 'Directory', link: '/nations' },
	{ label: 'Map', link: '/nations/map' },
	{ label: 'Find recourse', link: '/nations/recourse' }
];
const headings = [
	{ label: 'Government', link: '#government-heading' },
	{ label: 'Sources', link: '#sources-heading' }
];

describe('what the second column lists for the section being read', () => {
	it('nests a page that is in no list under the entry that holds it', () => {
		const { pages } = composeSectionContents({ pages: nations }, { title: 'Navajo Nation', items: headings }, '/nations/navajo-nation');
		expect(pages.map((item) => item.link)).toEqual(['/nations', '/nations/map', '/nations/recourse']);
		expect(pages[0].children).toEqual([{ label: 'Navajo Nation', link: '/nations/navajo-nation', current: true, children: headings }]);
	});

	it('puts the page’s headings under its own entry, in the pages or in the long list', () => {
		const contents = {
			pages: nations,
			entries: { noun: 'nations', items: [{ label: 'Hopi Tribe', link: '/nations/hopi' }, { label: 'Navajo Nation', link: '/nations/navajo-nation' }] }
		};
		const composed = composeSectionContents(contents, { items: headings }, '/nations/navajo-nation');
		expect(composed.pages).toEqual(nations);
		expect(composed.entries?.items[1]).toEqual({ label: 'Navajo Nation', link: '/nations/navajo-nation', children: headings });
		const essays = [
			{ label: 'First essay', link: '/essays/first' },
			{ label: 'Second essay', link: '/essays/second' }
		];
		expect(composeSectionContents({ pages: essays }, { items: headings }, '/essays/second').pages[1].children).toBe(headings);
	});

	it('shows the section’s contents alone when the page has no outline, and the page’s outline alone without contents', () => {
		const contents = { pages: nations };
		expect(composeSectionContents(contents, undefined, '/nations/map')).toBe(contents);
		expect(composeSectionContents(undefined, { items: headings }, '/code')).toEqual({ pages: headings });
		expect(composeSectionContents(undefined, undefined, '/sponsor')).toEqual({ pages: [] });
	});

	it('adds a page held by no entry at the end of the pages, named by its outline or title', () => {
		const { pages } = composeSectionContents({ pages: [{ label: 'About the project', link: '/about' }] }, { items: headings }, '/charter', 'Charter');
		expect(pages.at(-1)).toEqual({ label: 'Charter', link: '/charter', current: true, children: headings });
	});
});

describe('the long list in the second column', () => {
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

	it('groups by first letter, ignoring leading marks', () => {
		expect(letterGroups(items).map((group) => [group.letter, group.items.length])).toEqual([
			['A', 2],
			['N', 1],
			['P', 1]
		]);
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
