import { describe, expect, it } from 'vitest';
import { defaultPrintOptions } from '#lib/print-options.ts';
import { buildReaderData, parseReaderData, readerDataFileName } from '#lib/reader-data.ts';
import { defaultSettings } from '#lib/reading-settings.ts';

describe('reader data export and import', () => {
	const when = new Date('2026-11-22T08:00:00Z');

	it('reads back what it writes', () => {
		const data = buildReaderData({ ...defaultSettings, font: 'serif', textSize: '150' }, 'dark', { ...defaultPrintOptions, maps: 'off' }, { parts: ['glossary', 'laws-treaties'], pages: ['/cases/williams-v-lee'] }, [{ address: '/glossary/peacemaking', title: 'peacemaking', starredAt: when.toISOString(), note: 'Compare with the Navajo courts.' }], when);
		expect(parseReaderData(JSON.stringify(data))).toEqual(data);
	});

	it('refuses files that are not this site’s export', () => {
		expect(parseReaderData('not json')).toBeUndefined();
		expect(parseReaderData('[]')).toBeUndefined();
		expect(parseReaderData('{"kind":"something-else","version":1}')).toBeUndefined();
		expect(parseReaderData('{"kind":"model-tribal-adr-code-reader-data","version":2}')).toBeUndefined();
	});

	it('drops unknown values inside a valid file', () => {
		const data = parseReaderData(
			JSON.stringify({ kind: 'model-tribal-adr-code-reader-data', version: 1, exported: 'yesterday', settings: { font: 'comic-sans', contrast: 'more' }, theme: 'purple', printOptions: { maps: 'sometimes' }, savedParts: ['nations', 'nations', 'Not A Key', 7], savedPages: ['/laws/x', 'https://example.com/', 3] })
		);
		expect(data?.settings).toEqual({ ...defaultSettings, contrast: 'more' });
		expect(data?.theme).toBe('device');
		expect(data?.printOptions).toEqual(defaultPrintOptions);
		expect(data?.savedParts).toEqual(['nations']);
		expect(data?.savedPages).toEqual(['/laws/x']);
		expect(data?.exported).toBe('');
		expect(data?.starred).toEqual([]);
	});

	it('keeps only starred pages it can read', () => {
		const data = parseReaderData(
			JSON.stringify({
				kind: 'model-tribal-adr-code-reader-data',
				version: 1,
				starred: [
					{ address: '/nations/navajo-nation', title: 'Navajo Nation', starredAt: '2026-11-22T08:00:00Z', note: 'Peacemaker Court' },
					{ address: 'https://example.com/', title: 'Elsewhere' },
					{ address: '/workspace', title: 'Workspace' },
					{ address: '/nations/navajo-nation', title: 'Again' }
				]
			})
		);
		expect(data?.starred).toEqual([{ address: '/nations/navajo-nation', title: 'Navajo Nation', starredAt: '2026-11-22T08:00:00Z', note: 'Peacemaker Court' }]);
	});

	it('names the file with the day it was made', () => {
		expect(readerDataFileName(when)).toBe('model-tribal-adr-code-data-2026-11-22.json');
	});
});
