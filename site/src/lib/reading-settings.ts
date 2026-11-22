/**
 * Reading settings (site/DESIGN.md, section 6, "Settings"): text size, font,
 * text spacing, text alignment, theme, contrast, how notes and source links
 * show, and glossary cards. They are kept on the reader's device in
 * local storage, so they work offline and are never sent to the server.
 *
 * Each setting other than the theme becomes a data attribute on the root
 * element, for example data-text-size="larger", and global.css reacts to it.
 * A setting at its default value has no attribute. The theme keeps the
 * "theme" storage key and data-theme attribute that the theme button uses
 * (site/DESIGN.md, section 8).
 *
 * The inline script in src/app.html applies the stored settings before the
 * first paint. It repeats the storage keys and setting names below;
 * tests/reading-settings.test.ts checks that the two agree.
 *
 * This module must work in the browser and in Node (for tests).
 */

export const settingsStorageKey = 'reading-settings';
export const themeStorageKey = 'theme';

export const textSizes = ['standard', 'large', 'larger', 'largest'] as const;
export const fonts = ['atkinson-hyperlegible-next', 'serif', 'opendyslexic', 'device'] as const;
export const textSpacings = ['standard', 'wide'] as const;
export const textAlignments = ['left', 'justified'] as const;
export const contrasts = ['standard', 'more'] as const;
export const noteDisplays = ['end', 'inline'] as const;
export const sourceLinkChoices = ['both', 'original', 'archived'] as const;
export const glossaryCardChoices = ['on', 'off'] as const;
export const themes = ['device', 'light', 'dark'] as const;

export type TextSize = (typeof textSizes)[number];
export type Font = (typeof fonts)[number];
export type TextSpacing = (typeof textSpacings)[number];
export type TextAlignment = (typeof textAlignments)[number];
export type Contrast = (typeof contrasts)[number];
export type NoteDisplay = (typeof noteDisplays)[number];
export type SourceLinks = (typeof sourceLinkChoices)[number];
export type GlossaryCards = (typeof glossaryCardChoices)[number];
export type Theme = (typeof themes)[number];

/** The settings stored under settingsStorageKey. Each name is also the root element's dataset name. */
export interface ReadingSettings {
	textSize: TextSize;
	font: Font;
	textSpacing: TextSpacing;
	textAlignment: TextAlignment;
	contrast: Contrast;
	noteDisplay: NoteDisplay;
	sourceLinks: SourceLinks;
	glossaryCards: GlossaryCards;
}

export const settingNames = [
	'textSize',
	'font',
	'textSpacing',
	'textAlignment',
	'contrast',
	'noteDisplay',
	'sourceLinks',
	'glossaryCards'
] as const;

export const defaultSettings: ReadingSettings = {
	textSize: 'standard',
	font: 'atkinson-hyperlegible-next',
	textSpacing: 'standard',
	textAlignment: 'left',
	contrast: 'standard',
	noteDisplay: 'end',
	sourceLinks: 'both',
	glossaryCards: 'on'
};

const allowedValues: { [Name in keyof ReadingSettings]: readonly ReadingSettings[Name][] } = {
	textSize: textSizes,
	font: fonts,
	textSpacing: textSpacings,
	textAlignment: textAlignments,
	contrast: contrasts,
	noteDisplay: noteDisplays,
	sourceLinks: sourceLinkChoices,
	glossaryCards: glossaryCardChoices
};

export interface Choice<Value extends string> {
	value: Value;
	label: string;
	hint?: string;
}

export const textSizeChoices: Choice<TextSize>[] = [
	{ value: 'standard', label: 'Standard', hint: 'Reading text at 18 pixels' },
	{ value: 'large', label: 'Large', hint: 'One eighth larger' },
	{ value: 'larger', label: 'Larger', hint: 'One quarter larger' },
	{ value: 'largest', label: 'Largest', hint: 'One half larger' }
];

export const fontChoices: Choice<Font>[] = [
	{
		value: 'atkinson-hyperlegible-next',
		label: 'Atkinson Hyperlegible Next',
		hint: 'The site’s font, drawn so that similar letters are easy to tell apart'
	},
	{ value: 'serif', label: 'Noto Serif', hint: 'A serif font, like many printed books' },
	{ value: 'opendyslexic', label: 'OpenDyslexic', hint: 'A font designed for readers with dyslexia' },
	{ value: 'device', label: 'Your device’s font', hint: 'The font your device uses for menus' }
];

/** Each font's design token, so the font dropdown in Settings can show every choice in its own typeface. */
export const fontFamilyTokens: Record<Font, string> = {
	'atkinson-hyperlegible-next': '--font-family-atkinson-hyperlegible-next',
	serif: '--font-family-serif',
	opendyslexic: '--font-family-opendyslexic',
	device: '--font-family-device'
};

export const textSpacingChoices: Choice<TextSpacing>[] = [
	{ value: 'standard', label: 'Standard' },
	{ value: 'wide', label: 'Wide', hint: 'More space between lines, paragraphs, letters and words' }
];

export const textAlignmentChoices: Choice<TextAlignment>[] = [
	{ value: 'left', label: 'Left aligned', hint: 'Even space between words, with a ragged right edge' },
	{
		value: 'justified',
		label: 'Justified',
		hint: 'Straight edges on both sides, with long words hyphenated at line ends'
	}
];

export const themeChoices: Choice<Theme>[] = [
	{ value: 'device', label: 'Match this device' },
	{ value: 'light', label: 'Light' },
	{ value: 'dark', label: 'Dark' }
];

export const contrastChoices: Choice<Contrast>[] = [
	{ value: 'standard', label: 'Standard' },
	{ value: 'more', label: 'More contrast', hint: 'Gray text as dark as the main text, and darker dividing lines' }
];

export const noteDisplayChoices: Choice<NoteDisplay>[] = [
	{ value: 'end', label: 'Go to the notes at the end of the page' },
	{ value: 'inline', label: 'Show the note under the paragraph' }
];

export const sourceLinkOptions: Choice<SourceLinks>[] = [
	{ value: 'both', label: 'Original page and archived copy' },
	{ value: 'original', label: 'Original page only' },
	{
		value: 'archived',
		label: 'Archived copy, where there is one',
		hint: 'An archived copy still opens when the original page has moved or gone'
	}
];

export const glossaryCardOptions: Choice<GlossaryCards>[] = [
	{
		value: 'on',
		label: 'Show a short definition',
		hint: 'When you point at a defined term, or move to it with the keyboard'
	},
	{ value: 'off', label: 'Off', hint: 'Defined terms are still links to their glossary entries' }
];

function isAllowed<Name extends keyof ReadingSettings>(
	name: Name,
	value: unknown
): value is ReadingSettings[Name] {
	return (allowedValues[name] as readonly unknown[]).includes(value);
}

/** Reads stored settings. Anything missing, unknown or unreadable falls back to the default. */
export function parseSettings(stored: string | null): ReadingSettings {
	const settings = { ...defaultSettings };
	if (!stored) return settings;
	let parsed: unknown;
	try {
		parsed = JSON.parse(stored);
	} catch {
		return settings;
	}
	if (typeof parsed !== 'object' || parsed === null) return settings;
	const record = parsed as Record<string, unknown>;
	for (const name of settingNames) {
		const value = record[name];
		if (isAllowed(name, value)) (settings as Record<string, string>)[name] = value;
	}
	return settings;
}

/** Only the settings that differ from the default are stored. */
export function serializeSettings(settings: ReadingSettings): string | null {
	const changed: Partial<Record<keyof ReadingSettings, string>> = {};
	for (const name of settingNames) {
		if (settings[name] !== defaultSettings[name]) changed[name] = settings[name];
	}
	return Object.keys(changed).length > 0 ? JSON.stringify(changed) : null;
}

/** The root element's data attributes for these settings; a default value has none. */
export function settingsAttributes(settings: ReadingSettings): Record<string, string | undefined> {
	const attributes: Record<string, string | undefined> = {};
	for (const name of settingNames) {
		attributes[name] = settings[name] === defaultSettings[name] ? undefined : settings[name];
	}
	return attributes;
}

export function parseTheme(stored: string | null): Theme {
	return stored === 'light' || stored === 'dark' ? stored : 'device';
}

/** Local storage can be blocked or full; then settings last for this page only. */
function storage(): Storage | undefined {
	try {
		return window.localStorage;
	} catch {
		return undefined;
	}
}

export function loadSettings(): ReadingSettings {
	try {
		return parseSettings(storage()?.getItem(settingsStorageKey) ?? null);
	} catch {
		return { ...defaultSettings };
	}
}

export function loadTheme(): Theme {
	try {
		return parseTheme(storage()?.getItem(themeStorageKey) ?? null);
	} catch {
		return 'device';
	}
}

/** Applies the settings to the page and saves them on this device. */
export function saveSettings(settings: ReadingSettings): void {
	const root = document.documentElement;
	for (const [name, value] of Object.entries(settingsAttributes(settings))) {
		if (value === undefined) delete root.dataset[name];
		else root.dataset[name] = value;
	}
	try {
		const serialized = serializeSettings(settings);
		if (serialized === null) storage()?.removeItem(settingsStorageKey);
		else storage()?.setItem(settingsStorageKey, serialized);
	} catch {
		// Storage blocked or full: the settings still apply to this page.
	}
}

const fontFamilyNames: Partial<Record<Font, string>> = {
	serif: 'Noto Serif',
	opendyslexic: 'OpenDyslexic'
};

/**
 * Asks the browser for every weight and style of a picked font at once, so
 * the service worker saves all of them while the reader is online and the
 * font still works on pages read later offline. Atkinson Hyperlegible Next is
 * saved when the service worker installs, and the device's font needs no files.
 */
export function downloadFont(font: Font): void {
	const family = fontFamilyNames[font];
	if (!family || !('fonts' in document)) return;
	for (const face of ['400', 'italic 400', '600', '700', 'italic 700']) {
		document.fonts.load(`${face} 1em "${family}"`).catch(() => {
			// Offline or blocked: the next font in the token's list is used.
		});
	}
}

/** Applies the theme and saves it. "device" removes the choice, so the device decides again. */
export function saveTheme(theme: Theme): void {
	const root = document.documentElement;
	if (theme === 'device') delete root.dataset.theme;
	else root.dataset.theme = theme;
	try {
		if (theme === 'device') storage()?.removeItem(themeStorageKey);
		else storage()?.setItem(themeStorageKey, theme);
	} catch {
		// Storage blocked or full: the theme still applies to this page.
	}
}
