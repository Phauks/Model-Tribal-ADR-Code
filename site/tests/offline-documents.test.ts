import { describe, expect, it } from 'vitest';
import { isDocumentSet, listAddress, nationOfSet, nationSet } from '#lib/offline-documents.ts';

describe('offline document sets', () => {
	it('names a nation’s set and finds the nation again', () => {
		expect(nationSet('navajo-nation')).toBe('nation:navajo-nation');
		expect(nationOfSet('nation:navajo-nation')).toBe('navajo-nation');
		expect(nationOfSet('federal')).toBeUndefined();
	});

	it('finds where the build publishes each set’s list', () => {
		expect(listAddress('federal')).toBe('/copies/offline/federal.json');
		expect(listAddress('nation:navajo-nation')).toBe('/copies/offline/nations/navajo-nation.json');
	});

	it('accepts only set names it knows', () => {
		expect(isDocumentSet('federal')).toBe(true);
		expect(isDocumentSet('nation:blue-lake-rancheria')).toBe(true);
		expect(isDocumentSet('nation:../x')).toBe(false);
		expect(isDocumentSet('nations')).toBe(false);
		expect(isDocumentSet(3)).toBe(false);
	});
});
