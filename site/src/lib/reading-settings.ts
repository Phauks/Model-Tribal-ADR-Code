/**
 * Reading settings (site/DESIGN.md, section 6, "Settings"): text size, font,
 * text spacing, text alignment, theme, contrast, how notes and source links
 * show, glossary cards and motion. They are kept on the reader's device in
 * local storage, so they work offline and are never sent to the server.
 *
 * Each setting other than the theme becomes a data attribute on the root
 * element, for example data-text-size="larger", and global.css reacts to it.
 * A setting at its default value has no attribute. The theme keeps the
 * "theme" storage key and data-theme attribute it had when the masthead
 * had a theme button (site/DESIGN.md, section 8).
 *
 * The inline script in src/app.html applies the stored settings before the
 * first paint. It repeats the storage keys and setting names below;
 * tests/reading-settings.test.ts checks that the two agree.
 *
 * This module must work in the browser and in Node (for tests).
 */

export const settingsStorageKey = 'reading-settings';
/**
 * Sent on window after Settings or the Page settings panel saves a change, so the
 * copy kept with a signed-in person's account can follow
 * (src/lib/settings-everywhere.ts).
 */
export const settingsSavedEvent = 'reading-settings-saved';
export const themeStorageKey = 'theme';

/** Text size as a percentage of the standard size; the slider in Settings steps through these. */
export const textSizes = ['50', '62.5', '75', '87.5', '100', '112.5', '125', '137.5', '150', '175', '200'] as const;
export const fonts = ['atkinson-hyperlegible-next', 'serif', 'opendyslexic'] as const;
export const textSpacings = ['standard', 'wide'] as const;
export const textAlignments = ['left', 'justified'] as const;
/**
 * Text width as a percentage of the page's column; the slider in Settings
 * steps through these. 100 fills the column (Trevor, Nov. 23, 2026).
 */
export const lineWidths = ['40', '50', '60', '70', '80', '90', '100'] as const;
export const contrasts = ['standard', 'more'] as const;
export const noteDisplays = ['popup', 'end', 'inline'] as const;
export const sourceLinkChoices = ['both', 'original', 'archived'] as const;
export const glossaryCardChoices = ['on', 'off'] as const;
export const motions = ['device', 'reduce'] as const;
export const sourceGroupChoices = ['folded', 'open'] as const;
export const otherCursorChoices = ['names', 'lines', 'off'] as const;
export const themes = ['device', 'light', 'dark'] as const;

export type TextSize = (typeof textSizes)[number];
export type Font = (typeof fonts)[number];
export type TextSpacing = (typeof textSpacings)[number];
export type TextAlignment = (typeof textAlignments)[number];
export type LineWidth = (typeof lineWidths)[number];
export type Contrast = (typeof contrasts)[number];
export type NoteDisplay = (typeof noteDisplays)[number];
export type SourceLinks = (typeof sourceLinkChoices)[number];
export type GlossaryCards = (typeof glossaryCardChoices)[number];
export type Motion = (typeof motions)[number];
export type SourceGroups = (typeof sourceGroupChoices)[number];
export type OtherCursors = (typeof otherCursorChoices)[number];
export type Theme = (typeof themes)[number];

/** The settings stored under settingsStorageKey. Each name is also the root element's dataset name. */
export interface ReadingSettings {
	textSize: TextSize;
	font: Font;
	textSpacing: TextSpacing;
	textAlignment: TextAlignment;
	lineWidth: LineWidth;
	contrast: Contrast;
	noteDisplay: NoteDisplay;
	sourceLinks: SourceLinks;
	glossaryCards: GlossaryCards;
	motion: Motion;
	sourceGroups: SourceGroups;
	otherCursors: OtherCursors;
}

export const settingNames = [
	'textSize',
	'font',
	'textSpacing',
	'textAlignment',
	'lineWidth',
	'contrast',
	'noteDisplay',
	'sourceLinks',
	'glossaryCards',
	'motion',
	'sourceGroups',
	'otherCursors'
] as const;

export const defaultSettings: ReadingSettings = {
	textSize: '100',
	font: 'atkinson-hyperlegible-next',
	textSpacing: 'standard',
	textAlignment: 'left',
	lineWidth: '100',
	contrast: 'standard',
	noteDisplay: 'popup',
	sourceLinks: 'both',
	glossaryCards: 'on',
	motion: 'device',
	sourceGroups: 'folded',
	otherCursors: 'names'
};

const allowedValues: { [Name in keyof ReadingSettings]: readonly ReadingSettings[Name][] } = {
	textSize: textSizes,
	font: fonts,
	textSpacing: textSpacings,
	textAlignment: textAlignments,
	lineWidth: lineWidths,
	contrast: contrasts,
	noteDisplay: noteDisplays,
	sourceLinks: sourceLinkChoices,
	glossaryCards: glossaryCardChoices,
	motion: motions,
	sourceGroups: sourceGroupChoices,
	otherCursors: otherCursorChoices
};

export interface Choice<Value extends string> {
	value: Value;
	label: string;
	hint?: string;
}

export const textSizeChoices: Choice<TextSize>[] = textSizes.map((value) => ({ value, label: `${value}%` }));

export const fontChoices: Choice<Font>[] = [
	{ value: 'atkinson-hyperlegible-next', label: 'Atkinson Hyperlegible Next' },
	{ value: 'serif', label: 'Noto Serif' },
	{ value: 'opendyslexic', label: 'OpenDyslexic' }
];

/** Each font's design token, so the font dropdown in Settings can show every choice in its own typeface. */
export const fontFamilyTokens: Record<Font, string> = {
	'atkinson-hyperlegible-next': '--font-family-atkinson-hyperlegible-next',
	serif: '--font-family-serif',
	opendyslexic: '--font-family-opendyslexic'
};

export const textSpacingChoices: Choice<TextSpacing>[] = [
	{ value: 'standard', label: 'Standard' },
	{ value: 'wide', label: 'Wide' }
];

export const textAlignmentChoices: Choice<TextAlignment>[] = [
	{ value: 'left', label: 'Left aligned', hint: 'Even space between words, with a ragged right edge' },
	{
		value: 'justified',
		label: 'Justified',
		hint: 'Straight edges on both sides, with long words hyphenated at line ends'
	}
];

/**
 * How wide running text may be, as a percentage of the page's column (Trevor,
 * Nov. 23, 2026: "it should be percentage, on how wide or narrow you want
 * text to be"). Every paragraph, list, notice and panel held to the reading
 * width follows this one setting; global.css turns it into --layout-measure.
 */
export const lineWidthChoices: Choice<LineWidth>[] = lineWidths.map((value) => ({ value, label: `${value}%` }));

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
	{
		value: 'popup',
		label: 'Go to the References list, and preview the source when you point at the number',
		hint: 'The preview has a button to copy the citation. Phones go straight to the list'
	},
	{ value: 'end', label: 'Go to the References list, with no preview' },
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

/** Previews of defined terms and of nation pages (LinkPreviews.svelte). The stored name predates nation previews. */
export const glossaryCardOptions: Choice<GlossaryCards>[] = [
	{
		value: 'on',
		label: 'Show a short preview',
		hint: 'When you point at a defined term or a link to a nation’s page, or move to it with the keyboard'
	},
	{ value: 'off', label: 'Off', hint: 'Links still go to the glossary entry or the nation’s page' }
];

/**
 * Motion (site/DESIGN.md, section 6, "Motion"; src/lib/motion.ts). Reduce
 * stops every slide, fade and glide on this device, whatever the device's
 * own setting says.
 */
export const motionChoices: Choice<Motion>[] = [
	{
		value: 'device',
		label: 'Match this device',
		hint: 'Small movements, such as a window easing in or the map gliding to a new zoom, unless your device asks for less motion'
	},
	{ value: 'reduce', label: 'Reduce motion', hint: 'Nothing slides, fades or glides; every change happens at once' }
];

/**
 * Long Sources lists are folded into groups by the part of the page that
 * cites them (SourceList.svelte). Open shows every group open when the page
 * loads; the reader can still fold each one.
 */
export const sourceGroupOptions: Choice<SourceGroups>[] = [
	{ value: 'folded', label: 'Folded', hint: 'Each group shows its name and how many sources it holds; select it to open it' },
	{ value: 'open', label: 'Open', hint: 'Every group starts open, so the whole list shows at once' }
];

/**
 * Other people's cursors while editing an essay together (EssayEditor.svelte).
 * Only what this reader sees changes; others still see this reader's cursor.
 * The color others see is chosen in Account, because other people see it.
 */
export const otherCursorOptions: Choice<OtherCursors>[] = [
	{ value: 'names', label: 'Show cursors with names' },
	{ value: 'lines', label: 'Show cursors without names', hint: 'A colored line and highlight, with no name tag' },
	{ value: 'off', label: 'Hide other people’s cursors', hint: 'A quieter page while you write. Their changes still appear' }
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

/**
 * Where OpenDyslexic's font faces are (src/routes/opendyslexic.css). Every other font's faces come with the style sheet every page loads; these are read only by a reader who picks the font, or opens Settings, where each font choice is shown in its own typeface. src/app.html adds them before the first paint for a reader who picked the font, with the same element identifier.
 */
export const openDyslexicStylesheet = '/opendyslexic.css';
const openDyslexicElementIdentifier = 'opendyslexic-faces';

/** Adds OpenDyslexic's font faces to the page, once. Resolves when the style sheet has been read, or could not be. */
export function addOpenDyslexicFaces(): Promise<void> {
	if (typeof document === 'undefined') return Promise.resolve();
	let link = document.getElementById(openDyslexicElementIdentifier) as HTMLLinkElement | null;
	if (link?.sheet) return Promise.resolve();
	if (!link) {
		link = document.createElement('link');
		link.id = openDyslexicElementIdentifier;
		link.rel = 'stylesheet';
		link.href = openDyslexicStylesheet;
		document.head.append(link);
	}
	const added = link;
	return new Promise((resolve) => {
		added.addEventListener('load', () => resolve(), { once: true });
		added.addEventListener('error', () => resolve(), { once: true });
	});
}

/** Applies the settings to the page and saves them on this device. */
export function saveSettings(settings: ReadingSettings): void {
	const root = document.documentElement;
	if (settings.font === 'opendyslexic') void addOpenDyslexicFaces();
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
	announceSaved();
}

function announceSaved(): void {
	if (typeof window !== 'undefined') window.dispatchEvent(new Event(settingsSavedEvent));
}

const fontFamilyNames: Partial<Record<Font, string>> = {
	serif: 'Noto Serif',
	opendyslexic: 'OpenDyslexic'
};

/**
 * Asks the browser for every weight and style of a picked font at once, so
 * the service worker saves all of them while the reader is online and the
 * font still works on pages read later offline. Atkinson Hyperlegible Next is
 * saved when the service worker installs.
 */
export function downloadFont(font: Font): void {
	const family = fontFamilyNames[font];
	if (!family || !('fonts' in document)) return;
	// The browser knows OpenDyslexic's faces only once their style sheet is read.
	const facesKnown = font === 'opendyslexic' ? addOpenDyslexicFaces() : Promise.resolve();
	void facesKnown.then(() => {
		for (const face of ['400', 'italic 400', '600', '700', 'italic 700']) {
			document.fonts.load(`${face} 1em "${family}"`).catch(() => {
				// Offline or blocked: the next font in the token's list is used.
			});
		}
	});
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
	announceSaved();
}
