import { describe, expect, it } from 'vitest';
import { datedFileName, datedName, dayOf } from '../src/lib/download-names.ts';

const built = new Date('2026-11-23T17:13:44Z');

describe('dated download names', () => {
	it('puts the day before the extension', () => {
		expect(dayOf(built)).toBe('2026-11-23');
		expect(datedName('provisions.csv', built)).toBe('provisions-2026-11-23.csv');
		expect(datedName('README', built)).toBe('README-2026-11-23');
	});

	it('leaves a name alone without a date, or when it already carries that day', () => {
		expect(datedName('provisions.csv', undefined)).toBe('provisions.csv');
		expect(datedName('provisions-2026-11-23.csv', built)).toBe('provisions-2026-11-23.csv');
	});

	it('names a file from its address', () => {
		expect(datedFileName('/nations/recourse/provisions.csv', built)).toBe('provisions-2026-11-23.csv');
		expect(datedFileName('/nations/timeline/entries.json', built)).toBe('entries-2026-11-23.json');
		expect(datedFileName('/nations/map/land-areas.geojson', built)).toBe('land-areas-2026-11-23.geojson');
		expect(datedFileName('/zip/data.zip', built)).toBe('model-tribal-adr-code-data-2026-11-23.zip');
	});

	it('names a nation’s own file with the nation', () => {
		expect(datedFileName('/nations/navajo-nation/record.json', built)).toBe('navajo-nation-record-2026-11-23.json');
		expect(datedFileName('/nations/navajo-nation/sources.ris', built)).toBe('navajo-nation-sources-2026-11-23.ris');
	});
});
