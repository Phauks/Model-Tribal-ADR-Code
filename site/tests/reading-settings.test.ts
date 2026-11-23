import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
	defaultSettings,
	fonts,
	parseSettings,
	parseTheme,
	serializeSettings,
	settingNames,
	settingsAttributes,
	settingsStorageKey,
	textSizes,
	themeStorageKey
} from '#lib/reading-settings.ts';

describe('reading settings', () => {
	it('falls back to the defaults for missing, broken or unknown values', () => {
		expect(parseSettings(null)).toEqual(defaultSettings);
		expect(parseSettings('not json')).toEqual(defaultSettings);
		expect(parseSettings('"a string"')).toEqual(defaultSettings);
		expect(parseSettings('{"textSize":"huge","font":"comic-sans","other":"x"}')).toEqual(
			defaultSettings
		);
	});

	it('keeps known values', () => {
		expect(parseSettings('{"textSize":"125","font":"opendyslexic"}')).toEqual({
			...defaultSettings,
			textSize: '125',
			font: 'opendyslexic'
		});
	});

	it('stores only what differs from the default, and nothing for the defaults', () => {
		expect(serializeSettings(defaultSettings)).toBeNull();
		const changed = { ...defaultSettings, contrast: 'more' as const };
		expect(serializeSettings(changed)).toBe('{"contrast":"more"}');
		expect(parseSettings(serializeSettings(changed))).toEqual(changed);
	});

	it('gives default values no attribute', () => {
		expect(settingsAttributes(defaultSettings)).toEqual({
			textSize: undefined,
			font: undefined,
			textSpacing: undefined,
			textAlignment: undefined,
			contrast: undefined,
			noteDisplay: undefined,
			sourceLinks: undefined,
			glossaryCards: undefined,
			motion: undefined
		});
		expect(settingsAttributes({ ...defaultSettings, textSpacing: 'wide' }).textSpacing).toBe('wide');
	});

	it('reads a stored theme, and anything else means the device decides', () => {
		expect(parseTheme('dark')).toBe('dark');
		expect(parseTheme('light')).toBe('light');
		expect(parseTheme(null)).toBe('device');
		expect(parseTheme('automatic')).toBe('device');
	});
});

describe('the inline script in app.html', () => {
	const page = readFileSync(new URL('../src/app.html', import.meta.url), 'utf8');

	it('uses the same storage keys and setting names', () => {
		expect(page).toContain(`localStorage.getItem('${themeStorageKey}')`);
		expect(page).toContain(`localStorage.getItem('${settingsStorageKey}')`);
		const compact = page.replace(/\s+/g, '');
		expect(compact).toContain(`[${settingNames.map((name) => `'${name}'`).join(',')}]`);
	});
});

describe('global.css', () => {
	const styles = readFileSync(new URL('../src/lib/styles/global.css', import.meta.url), 'utf8');
	const tokens = JSON.parse(
		readFileSync(new URL('../design-tokens.json', import.meta.url), 'utf8')
	) as { font: { family: Record<string, unknown> } };

	it('hides the right source link for each setting', () => {
		expect(styles).toContain(`[data-source-links='original'] .source-archived`);
		expect(styles).toContain(`[data-source-links='archived'] .has-archive .source-original`);
	});

	it('hyphenates justified text and keeps links whole', () => {
		expect(styles).toMatch(/\[data-text-alignment='justified'\][^{]*\{[^}]*text-align: justify;[^}]*hyphens: auto;/);
		expect(styles).toMatch(/\[data-text-alignment='justified'\][^{]* a \{[^}]*hyphens: manual;/);
	});

	it('has a text scale for every text size other than the default', () => {
		for (const size of textSizes.filter((name) => name !== defaultSettings.textSize)) {
			expect(styles).toContain(`[data-text-size='${size}'] {\n\t--text-scale: ${Number(size) / 100};`);
		}
	});

	it('has a rule and a font token for every font other than the default', () => {
		for (const font of fonts.filter((name) => name !== defaultSettings.font)) {
			expect(styles).toContain(`[data-font='${font}']`);
			expect(styles).toContain(`var(--font-family-${font})`);
			expect(tokens.font.family[font]).toBeDefined();
		}
	});
});
