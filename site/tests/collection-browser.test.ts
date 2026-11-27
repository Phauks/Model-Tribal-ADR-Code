// The shared way to browse a Federal collection with filters and a grouped
// table (src/lib/collection-browser.ts; Trevor, Nov. 27, 2026, mockups C2).
import { describe, expect, it } from 'vitest';
import { browseIdentifiers } from '#lib/browse-identifiers.ts';
import { addressOf, browseView, choicesOf, findLabelOf, itemPlace, type BrowseCollection, type BrowseItem } from '#lib/collection-browser.ts';
import { params } from '../src/params.ts';

const item = (key: string, date: string, president: string, kind = 'executive-order', number?: string): BrowseItem => ({
	key,
	title: `Order ${key}`,
	number,
	date,
	values: { kind: [kind], president: [president], decade: [`${date.slice(0, 3)}0s`] }
});

// Grant, then Cleveland, then Harrison, then Cleveland again: a President who served twice.
const items = [
	item('a', '1871-05-01', 'grant', 'executive-order', '1'),
	item('b', '1873-02-01', 'grant', 'proclamation', '2'),
	item('c', '1886-01-01', 'cleveland', 'executive-order', '3'),
	item('d', '1890-03-01', 'harrison', 'executive-order', '4'),
	item('e', '1894-07-01', 'cleveland', 'executive-order', '5'),
	item('f', '1895-07-01', 'cleveland', 'memorandum')
];

const collection: BrowseCollection = {
	identifier: 'test-orders',
	title: 'Test Orders',
	path: '/laws/test-orders',
	itemPath: '/laws',
	lead: 'Orders',
	itemName: 'order',
	findHint: 'Find an order',
	section: { label: 'Federal law', href: '/laws' },
	facets: [
		{ key: 'kind', label: 'Kind', order: 'given', shown: 3, values: { 'executive-order': 'Executive orders', proclamation: 'Proclamations', memorandum: 'Memoranda' }, single: { 'executive-order': 'Order', proclamation: 'Proclamation', memorandum: 'Memorandum' } },
		{ key: 'president', label: 'President', order: 'count', shown: 2, values: { grant: 'Ulysses Grant', cleveland: 'Grover Cleveland', harrison: 'Benjamin Harrison' }, itemList: true },
		{ key: 'decade', label: 'Decade', order: 'newest', shown: 6, values: { '1870s': '1870s', '1880s': '1880s', '1890s': '1890s' } }
	],
	groupings: [
		{ key: 'president', label: 'President', facet: 'president' },
		{ key: 'decade', label: 'Decade', facet: 'decade', detail: 'president' },
		{ key: 'year', label: 'Year' }
	],
	defaultGroup: 'president',
	columns: [
		{ key: 'number', label: 'No.' },
		{ key: 'date', label: 'Date' },
		{ key: 'kind', label: 'Kind', wide: true },
		{ key: 'president', label: 'President', wide: true }
	],
	items,
	pageSize: 4
};

const view = (query = '') => browseView(collection, new URLSearchParams(query));

describe('collection browser', () => {
	it('reads only known choices from the address, and writes back only what differs from the default', () => {
		const choices = choicesOf(collection, new URLSearchParams('president=grant&president=nobody&group=decade&sort=oldest&show=3&more=kind&more=x'));
		expect(choices.filters).toEqual({ president: ['grant'] });
		expect(choices.group).toBe('decade');
		expect(choices.sort).toBe('oldest');
		expect(choices.show).toBe(4);
		expect(choices.more).toEqual(['kind']);
		expect(addressOf(collection, choices)).toBe('/laws/test-orders?president=grant&group=decade&sort=oldest&more=kind');
		expect(addressOf(collection, choicesOf(collection, new URLSearchParams()))).toBe('/laws/test-orders');
	});

	it('groups by President as runs in date order, so a second term is its own group', () => {
		const groups = view('show=8').groups;
		expect(groups.map((group) => [group.label, group.count])).toEqual([
			['Grover Cleveland', 2],
			['Benjamin Harrison', 1],
			['Grover Cleveland', 1],
			['Ulysses Grant', 2]
		]);
		expect(groups[0].detail).toBe('1894–1895');
	});

	it('lists a decade’s Presidents after its count', () => {
		const decades = view('group=decade&show=8').groups;
		expect(decades.map((group) => [group.label, group.detail])).toEqual([
			['1890s', 'Grover Cleveland, Benjamin Harrison'],
			['1880s', 'Grover Cleveland'],
			['1870s', 'Ulysses Grant']
		]);
	});

	it('counts each filter’s values with the other filters applied, ORs values within a filter and ANDs across them', () => {
		const chosen = view('kind=executive-order&president=grant&president=cleveland');
		expect(chosen.shown).toBe(3);
		const president = chosen.facets.find((facet) => facet.key === 'president')!;
		// The President counts ignore the President filter itself, but not Kind.
		expect(Object.fromEntries(president.options.map((option) => [option.value, option.count]))).toEqual({ cleveland: 2, grant: 1, harrison: 1 });
		const kind = chosen.facets.find((facet) => facet.key === 'kind')!;
		expect(Object.fromEntries(kind.options.map((option) => [option.value, option.count]))).toEqual({ 'executive-order': 3, proclamation: 1, memorandum: 1 });
		expect(chosen.chips.map((chip) => chip.label)).toEqual(['Executive orders', 'Ulysses Grant', 'Grover Cleveland']);
	});

	it('shows the first few values of a long filter, with the rest behind "N more", but always the chosen ones', () => {
		const president = view('president=harrison').facets.find((facet) => facet.key === 'president')!;
		expect(president.options.map((option) => option.value)).toEqual(['cleveland', 'grant', 'harrison']);
		expect(view().facets.find((facet) => facet.key === 'president')!.more?.label).toBe('1 more');
	});

	it('leaves out the column the groups or a single chosen value already give, and names a row by its single kind', () => {
		expect(view().columns.map((column) => column.key)).toEqual(['number', 'date', 'kind']);
		expect(view('group=year&president=grant').columns.map((column) => column.key)).toEqual(['number', 'date', 'kind']);
		expect(view('group=none').groups[0].rows[0].cells).toEqual({ number: '', date: '1895-07-01', kind: 'Memorandum', president: 'Grover Cleveland' });
		expect(view('president=grant').focus).toBe('Ulysses Grant');
	});

	it('draws one page of rows, with a link to draw more', () => {
		const first = view();
		expect(first.groups.flatMap((group) => group.rows)).toHaveLength(4);
		expect(first.more).toEqual({ label: 'Show 2 more of 2', href: '/laws/test-orders?show=8' });
	});

	it('finds by number or by every word of the title', () => {
		expect(view('q=order+f').shown).toBe(1);
		expect(view('q=3').groups[0].rows[0].key).toBe('c');
	});

	it('places an item in the list the reader came from, or else among its President’s items, oldest first', () => {
		const fromList = itemPlace(collection, 'd', new URLSearchParams('kind=executive-order'))!;
		expect([fromList.position, fromList.total, fromList.label]).toEqual([2, 4, 'Executive orders']);
		expect(fromList.previous?.href).toBe('/laws/e?kind=executive-order');
		const alone = itemPlace(collection, 'e', new URLSearchParams())!;
		expect([alone.position, alone.total, alone.label]).toEqual([2, 3, 'Grover Cleveland']);
		expect(alone.previous).toEqual({ label: 'No. 3', href: '/laws/c?president=cleveland&sort=oldest' });
		expect(alone.next?.label).toBe('1895-07-01');
		expect(alone.nearby.find((other) => other.link === '/laws/e')).toBeDefined();
		expect(itemPlace(collection, 'missing', new URLSearchParams())).toBeUndefined();
		// A long list shows a few before the item and the rest after it.
		const window = itemPlace(collection, 'e', new URLSearchParams('sort=oldest&kind=executive-order&kind=proclamation&kind=memorandum'), 4)!;
		expect(window.nearby.map((other) => other.label)).toEqual(['Order b', 'Order c', 'Order d', 'Order e']);
		expect(window.notShown).toBe(2);
	});

	it('names the find box for the item', () => {
		expect(findLabelOf('order')).toBe('Find an order');
		expect(findLabelOf('notice')).toBe('Find a notice');
	});

	it('matches only the collections with a page in the address matcher', () => {
		expect(browseIdentifiers).toContain('executive-orders');
		const matcher = params.browse;
		expect(matcher['~standard'].validate('executive-orders')).toEqual({ value: 'executive-orders' });
		expect('issues' in (matcher['~standard'].validate('worcester-v-georgia') as object)).toBe(true);
	});
});
