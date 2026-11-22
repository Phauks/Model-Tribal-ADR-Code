import { describe, expect, it } from 'vitest';
import { defaultPrintOptions } from '#lib/print-options.ts';
import { buildReaderData, parseReaderData, readerDataFileName } from '#lib/reader-data.ts';
import { defaultSettings } from '#lib/reading-settings.ts';

describe('reader data export and import', () => {
	const when = new Date('2026-11-22T08:00:00Z');

	it('reads back what it writes', () => {
		const data = buildReaderData({ ...defaultSettings, font: 'serif', textSize: '150' }, 'dark', { ...defaultPrintOptions, maps: 'off' }, ['glossary'], when);
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
			JSON.stringify({ kind: 'model-tribal-adr-code-reader-data', version: 1, exported: 'yesterday', settings: { font: 'comic-sans', contrast: 'more' }, theme: 'purple', printOptions: { maps: 'sometimes' }, savedParts: ['nations', 'nations', 'secret'] })
		);
		expect(data?.settings).toEqual({ ...defaultSettings, contrast: 'more' });
		expect(data?.theme).toBe('device');
		expect(data?.printOptions).toEqual(defaultPrintOptions);
		expect(data?.savedParts).toEqual(['nations']);
		expect(data?.exported).toBe('');
	});

	it('names the file with the day it was made', () => {
		expect(readerDataFileName(when)).toBe('model-tribal-adr-code-data-2026-11-22.json');
	});
});
