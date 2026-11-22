import { describe, expect, it } from 'vitest';
import {
	addStarred,
	cleanLine,
	mergeStarred,
	noteLengthLimit,
	parseStarredItems,
	removeStarred,
	serializeStarredItems,
	setStarredNote,
	starredKindOf,
	starredLimit,
	type StarredItem
} from '#lib/starred-items.ts';
import {
	decodeSharedCollection,
	encodeSharedCollection,
	sharedCollectionLink,
	sharedItemsLimit,
	sharedTitleLimit
} from '#lib/shared-collection.ts';

const when = new Date('2026-11-22T08:00:00Z');

describe('which pages can be starred', () => {
	it('takes pages with lasting addresses', () => {
		expect(starredKindOf('/nations/navajo-nation')).toBe('nation');
		expect(starredKindOf('/glossary/peacemaking')).toBe('term');
		expect(starredKindOf('/stories/the-two-brothers')).toBe('story');
		expect(starredKindOf('/code/02-104')).toBe('section');
	});

	it('refuses lists, other sites, the workspace and odd addresses', () => {
		for (const address of [
			'/nations',
			'/nations/map',
			'/nations/letter/a',
			'/workspace',
			'/profile',
			'//example.com/nations/x',
			'https://example.com/nations/x',
			'/nations/x?y=1',
			'/nations/x#top',
			'/nations/../workspace',
			'javascript:alert(1)',
			42,
			undefined
		]) {
			expect(starredKindOf(address), String(address)).toBeUndefined();
		}
	});
});

describe('starred items', () => {
	it('stars newest first, once each, and removes', () => {
		let items: StarredItem[] = [];
		items = addStarred(items, '/glossary/peacemaking', 'peacemaking', when);
		items = addStarred(items, '/nations/navajo-nation', 'Navajo Nation', when);
		items = addStarred(items, '/glossary/peacemaking', 'again', when);
		expect(items.map((item) => item.address)).toEqual(['/nations/navajo-nation', '/glossary/peacemaking']);
		expect(removeStarred(items, '/nations/navajo-nation').map((item) => item.address)).toEqual(['/glossary/peacemaking']);
		expect(addStarred([], '/workspace', 'Workspace', when)).toEqual([]);
	});

	it('keeps notes as plain text, capped', () => {
		let items = addStarred([], '/glossary/peacemaking', 'peacemaking', when);
		items = setStarredNote(items, '/glossary/peacemaking', `line one\r\nline two\u0000${'x'.repeat(noteLengthLimit)}`);
		expect(items[0].note.startsWith('line one\nline two')).toBe(true);
		expect(items[0].note).not.toContain('\u0000');
		expect(items[0].note.length).toBe(noteLengthLimit);
	});

	it('reads back what it stores and drops what it cannot read', () => {
		const items = addStarred([], '/nations/navajo-nation', 'Navajo  Nation\n', when);
		expect(items[0].title).toBe('Navajo Nation');
		expect(parseStarredItems(serializeStarredItems(items))).toEqual(items);
		expect(serializeStarredItems([])).toBeNull();
		expect(parseStarredItems('not json')).toEqual([]);
		expect(parseStarredItems('{"address":"/nations/x"}')).toEqual([]);
		expect(parseStarredItems(JSON.stringify([{ address: '/nations/x', title: 7, note: null, starredAt: 'soon' }]))).toEqual([
			{ address: '/nations/x', title: '/nations/x', starredAt: '', note: '' }
		]);
	});

	it('keeps at most the limit', () => {
		const many = Array.from({ length: starredLimit + 5 }, (_, index) => ({ address: `/nations/n${index}`, title: `N${index}` }));
		expect(parseStarredItems(JSON.stringify(many))).toHaveLength(starredLimit);
	});

	it('merges without losing the reader’s own notes', () => {
		const own = setStarredNote(addStarred([], '/nations/a', 'A', when), '/nations/a', 'mine');
		const other: StarredItem[] = [
			{ address: '/nations/a', title: 'A', starredAt: '', note: 'theirs' },
			{ address: '/nations/b', title: 'B', starredAt: '', note: 'from file' }
		];
		const merged = mergeStarred(own, other);
		expect(merged.map((item) => [item.address, item.note])).toEqual([
			['/nations/a', 'mine'],
			['/nations/b', 'from file']
		]);
	});

	it('makes titles one plain line', () => {
		expect(cleanLine('A\u202Eb\tc\n\nd', 100)).toBe('A b c d');
	});
});

describe('shared collection links', () => {
	it('reads back what it writes', () => {
		const collection = { title: 'Peacemaking courts', description: 'For class.\nSecond line.', addresses: ['/nations/navajo-nation', '/glossary/peacemaking'] };
		const link = sharedCollectionLink('https://example.org', collection);
		expect(link.startsWith('https://example.org/starred/shared#c=')).toBe(true);
		expect(decodeSharedCollection(new URL(link).hash)).toEqual(collection);
	});

	it('carries titles in any script', () => {
		const collection = { title: 'Diné bizaad · ᏣᎳᎩ', description: '', addresses: ['/nations/navajo-nation'] };
		expect(decodeSharedCollection(`#c=${encodeSharedCollection(collection)}`)).toEqual(collection);
	});

	it('caps the title and the number of pages, and drops pages that cannot be starred', () => {
		const addresses = ['/workspace', 'https://example.com/', ...Array.from({ length: sharedItemsLimit + 10 }, (_, index) => `/nations/n${index}`)];
		const decoded = decodeSharedCollection(`#c=${encodeSharedCollection({ title: 'x'.repeat(500), description: '', addresses })}`);
		expect(decoded?.title).toHaveLength(sharedTitleLimit);
		expect(decoded?.addresses).toHaveLength(sharedItemsLimit);
		expect(decoded?.addresses[0]).toBe('/nations/n0');
	});

	it('refuses links it cannot read', () => {
		expect(decodeSharedCollection('')).toBeUndefined();
		expect(decodeSharedCollection('#c=not*base64')).toBeUndefined();
		expect(decodeSharedCollection(`#c=${btoa('{"v":2,"a":["/nations/x"]}')}`)).toBeUndefined();
		expect(decodeSharedCollection(`#c=${encodeSharedCollection({ title: 'Only bad', description: '', addresses: ['/workspace'] })}`)).toBeUndefined();
	});
});
