import { describe, expect, it, vi } from 'vitest';

// Story credits format citations through a module the site build makes; the counts don't need it.
vi.mock('virtual:source-citations', () => ({ sourceCitations: {} }));
import { sources } from '#lib/server/content.ts';
import { collectionCounts, collectionGroups, collections, kindsCountedOnlyAsSources } from '#lib/server/collections.ts';

describe('the collections the Statistics page counts', () => {
	it('gives every collection a unique identifier and a known group', () => {
		const identifiers = collections.map((collection) => collection.identifier);
		expect(new Set(identifiers).size).toBe(identifiers.length);
		for (const collection of collections) expect(collectionGroups).toContain(collection.group);
	});

	it('counts every kind of source record, or says it is counted only as a source document', () => {
		const counted = new Set([...collections.flatMap((collection) => collection.sourceKinds ?? []), ...kindsCountedOnlyAsSources]);
		const kinds = new Set([...sources().values()].map((record) => (record as { kind?: string }).kind).filter((kind): kind is string => Boolean(kind)));
		expect([...kinds].filter((kind) => !counted.has(kind))).toEqual([]);
	});

	it('never links a filing to the State address that has no file', () => {
		const items = (identifier: string) => collections.find((collection) => collection.identifier === identifier)?.items() ?? [];
		const oklahoma = items('oklahoma-state-tribal-agreements');
		const youthServices = oklahoma.find((item) => item.key === 'oklahoma-filing-21664');
		expect(youthServices?.title).toBe('Muskogee Youth Council: youth services agreement');
		expect(youthServices?.href).toBeUndefined();
		for (const item of oklahoma) expect(item.href === undefined || item.href.startsWith('/copies/view/oklahoma-secretary-of-state/')).toBe(true);
	});

	it('opens the saved copy of every constitution it counts as saved (Nov. 27, 2026)', () => {
		const constitutions = collections.find((collection) => collection.identifier === 'tribal-constitutions')?.items() ?? [];
		const byKey = new Map(constitutions.map((item) => [item.key, item]));
		// Scans filed under constitutions/_unmatched/ name their nation in the index, and are served.
		expect(byKey.get('constitution-suquamish-indian-tribe-of-the-port-madison-reservation-1965-text')?.href).toBe('/copies/view/constitutions/_unmatched/89ce6b5923b139d9.pdf');
		// An address with spaces in it still finds the copy filed under it.
		expect(byKey.get('constitution-red-cliff-band-of-lake-superior-chippewa-indians-of-wisconsin-1991-text')?.href).toMatch(/^\/copies\/view\//);
		for (const item of constitutions) if (item.copies?.length) expect(item.href ?? '').toMatch(/^\/copies\/view\//);
		// Copies taken from the National Indian Law Library stay link-only until the nation consents (decision record 0043).
		expect(byKey.get('hopi-constitution-nill')?.copies).toBeUndefined();
	});

	it('counts only what the site shows, and held-back items only as a number', () => {
		const opinions = collectionCounts().find((collection) => collection.identifier === 'tribal-court-opinions');
		expect(opinions?.count).toBeGreaterThan(0);
		for (const collection of collectionCounts()) {
			expect(Number.isInteger(collection.count)).toBe(true);
			if (collection.heldBack) expect(collection.heldBackReason).toBeTruthy();
		}
	});
});

describe('the list behind a Statistics card, as a reader may see it', () => {
	it('leaves out an item linked to a copy a nation hid, and links a cited one to its original', async () => {
		const { filterCollectionPage } = await import('#lib/restricted-pages.ts');
		const restrictions = {
			stamp: 'stamp',
			levels: new Map<string, 'cite' | 'hide'>([
				['copy:constitutions/example/1975.pdf', 'hide'],
				['copy:constitutions/example/1999.pdf', 'cite']
			]),
			items: new Map([['copy:constitutions/example/1999.pdf', { id: 'copy:constitutions/example/1999.pdf', kind: 'laws', title: '1999', original: 'https://example.org/1999.pdf' }]]),
			hiddenDocuments: new Set<string>()
		} as unknown as Parameters<typeof filterCollectionPage>[1];
		const data = {
			items: [
				{ title: 'Hidden', href: '/copies/view/constitutions/example/1975.pdf' },
				{ title: 'Cited', href: '/copies/view/constitutions/example/1999.pdf' },
				{ title: 'Elsewhere', href: 'https://example.org/law' }
			]
		};
		const filtered = filterCollectionPage(data, restrictions) as typeof data;
		expect(filtered.items.map((item) => item.title)).toEqual(['Cited', 'Elsewhere']);
		expect(filtered.items[0].href).toBe('https://example.org/1999.pdf');
	});
});
