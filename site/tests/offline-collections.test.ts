import { describe, expect, it } from 'vitest';
import { buildTime, collectionOf, formatBytes, pageOf } from '#lib/offline-collections.ts';

describe('offline collections', () => {
	it('puts each page and its data file in one collection', () => {
		expect(collectionOf('/nations')).toBe('nations');
		expect(collectionOf('/nations/map')).toBe('nations');
		expect(collectionOf('/nations/navajo-nation/__data.json')).toBe('nations');
		expect(collectionOf('/stories')).toBe('stories');
		expect(collectionOf('/stories/lummi-salmon-woman/__data.json')).toBe('stories');
		expect(collectionOf('/glossary')).toBe('glossary');
		expect(collectionOf('/glossary/adr')).toBe('glossary');
		expect(collectionOf('/glossary/terms.json')).toBe('glossary');
		expect(collectionOf('/')).toBe('other');
		expect(collectionOf('/__data.json')).toBe('other');
		expect(collectionOf('/nationsx')).toBe('other');
	});

	it('finds the page a data file belongs to', () => {
		expect(pageOf('/__data.json')).toBe('/');
		expect(pageOf('/glossary/__data.json')).toBe('/glossary');
		expect(pageOf('/glossary')).toBe('/glossary');
	});

	it('reads the build time from the build version', () => {
		expect(buildTime('0.0.1+1795229308081')?.toISOString()).toBe('2026-11-21T02:48:28.081Z');
		expect(buildTime('0.0.1')).toBeUndefined();
	});

	it('writes sizes in kilobytes and megabytes', () => {
		expect(formatBytes(1)).toBe('1 KB');
		expect(formatBytes(45_300)).toBe('45 KB');
		expect(formatBytes(3_140_000)).toBe('3.1 MB');
		expect(formatBytes(3_186_082_179)).toBe('3.2 GB');
	});
});
