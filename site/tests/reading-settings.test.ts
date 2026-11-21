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
		expect(parseSettings('{"textSize":"larger","font":"opendyslexic"}')).toEqual({
			...defaultSettings,
			textSize: 'larger',
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
			contrast: undefined
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
		expect(page).toContain(`[${settingNames.map((name) => `'${name}'`).join(', ')}]`);
	});
});

describe('global.css', () => {
	const styles = readFileSync(new URL('../src/lib/styles/global.css', import.meta.url), 'utf8');
	const tokens = JSON.parse(
		readFileSync(new URL('../design-tokens.json', import.meta.url), 'utf8')
	) as { font: { family: Record<string, unknown> } };

	it('has a rule and a font token for every font other than the default', () => {
		for (const font of fonts.filter((name) => name !== defaultSettings.font)) {
			expect(styles).toContain(`[data-font='${font}']`);
			expect(styles).toContain(`var(--font-family-${font})`);
			expect(tokens.font.family[font]).toBeDefined();
		}
	});
});
