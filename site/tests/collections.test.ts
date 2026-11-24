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

	it('counts only what the site shows, and held-back items only as a number', () => {
		const opinions = collectionCounts().find((collection) => collection.identifier === 'tribal-court-opinions');
		expect(opinions?.count).toBeGreaterThan(0);
		for (const collection of collectionCounts()) {
			expect(Number.isInteger(collection.count)).toBe(true);
			if (collection.heldBack) expect(collection.heldBackReason).toBeTruthy();
		}
	});
});
