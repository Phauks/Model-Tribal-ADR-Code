import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	datasetName,
	defaultPrintOptions,
	parsePrintOptions,
	partDescriptions,
	printAttributes,
	printOptionNames,
	printParts,
	printStorageKey,
	serializePrintOptions
} from '#lib/print-options.ts';

describe('print options', () => {
	it('falls back to the defaults for missing, broken or unknown values', () => {
		expect(parsePrintOptions(null)).toEqual(defaultPrintOptions);
		expect(parsePrintOptions('not json')).toEqual(defaultPrintOptions);
		expect(parsePrintOptions('"a string"')).toEqual(defaultPrintOptions);
		expect(parsePrintOptions('{"sources":"maybe","notes":"sideways","other":"x"}')).toEqual(
			defaultPrintOptions
		);
	});

	it('keeps known values', () => {
		expect(parsePrintOptions('{"maps":"off","notes":"inline"}')).toEqual({
			...defaultPrintOptions,
			maps: 'off',
			notes: 'inline'
		});
	});

	it('stores only what differs from the default, and nothing for the defaults', () => {
		expect(serializePrintOptions(defaultPrintOptions)).toBeNull();
		const changed = { ...defaultPrintOptions, sources: 'off' as const };
		expect(serializePrintOptions(changed)).toBe('{"sources":"off"}');
		expect(parsePrintOptions(serializePrintOptions(changed))).toEqual(changed);
	});

	it('names each attribute after its option, and gives defaults none', () => {
		expect(datasetName('documentHistory')).toBe('printDocumentHistory');
		const attributes = printAttributes({ ...defaultPrintOptions, termMarks: 'off' });
		expect(attributes.printTermMarks).toBe('off');
		expect(attributes.printSources).toBeUndefined();
	});

	it('describes every part once, so the dialog can offer it', () => {
		expect(partDescriptions.map((description) => description.part).sort()).toEqual([...printParts].sort());
	});
});

describe('the inline script in app.html', () => {
	const page = readFileSync(new URL('../src/app.html', import.meta.url), 'utf8');

	it('uses the same storage key and option names', () => {
		expect(page).toContain(`localStorage.getItem('${printStorageKey}')`);
		const compact = page.replace(/\s+/g, '');
		expect(compact).toContain(`[${printOptionNames.map((name) => `'${name}'`).join(',')}]`);
	});
});

describe('global.css and the pages', () => {
	const styles = readFileSync(new URL('../src/lib/styles/global.css', import.meta.url), 'utf8');
	const kebab = (name: string) => name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

	function svelteFiles(directory: string): string[] {
		return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
			const path = join(directory, entry.name);
			if (entry.isDirectory()) return svelteFiles(path);
			return entry.name.endsWith('.svelte') ? [path] : [];
		});
	}
	const markup = svelteFiles(new URL('../src', import.meta.url).pathname)
		.map((path) => readFileSync(path, 'utf8'))
		.join('\n');

	it('leaves out each part when it is turned off', () => {
		for (const part of printParts) {
			expect(styles).toContain(`:root[data-print-${kebab(part)}='off'] [data-print-part='${part}']`);
		}
	});

	it('has a page element marked for every part', () => {
		for (const part of printParts) {
			expect(markup).toContain(`data-print-part="${part}"`);
		}
	});
});
