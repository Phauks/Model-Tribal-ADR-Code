import { describe, expect, it } from 'vitest';
import { collectionOf } from '#lib/offline-collections.ts';
import { addressOf, collectionOf as toolCollectionOf } from '../tools/write-offline-sizes.mjs';

describe('offline sizes written after the build', () => {
	it('sorts files into the same collections as the service worker', () => {
		for (const address of ['/', '/__data.json', '/nations', '/nations/__data.json', '/nations/x', '/nations/x/__data.json', '/nations/map/drawings.json', '/stories', '/stories/x', '/stories/x/__data.json', '/glossary', '/glossary/terms.json', '/glossary/mediation/__data.json', '/changelog', '/downloads', '/search/index.json']) {
			expect(toolCollectionOf(address)).toBe(collectionOf(address));
		}
	});

	it('reads built file names as the addresses they are served at', () => {
		expect(addressOf('index.html')).toBe('/');
		expect(addressOf('nations/x.html')).toBe('/nations/x');
		expect(addressOf('nations/x/__data.json')).toBe('/nations/x/__data.json');
	});
});
