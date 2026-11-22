/**
 * Print options (site/DESIGN.md, section 6, "Print"): which parts of a page
 * print, and how notes, links and defined terms look on paper. Modeled on the
 * delivery dialogs of legal research services, where a reader picks the
 * content to include and the layout before printing.
 *
 * Like the reading settings (src/lib/reading-settings.ts), the choices are
 * kept on the reader's device in local storage and become data attributes on
 * the root element, for example data-print-sources="off". global.css reacts
 * to them only inside @media print, so the screen never changes, and the
 * browser's own Print command follows the same choices as the Print button.
 * A choice at its default value has no attribute.
 *
 * A page marks each part a reader can leave out with data-print-part, for
 * example <section data-print-part="sources">. The Print dialog lists only
 * the parts the current page has.
 *
 * This module must work in the browser and in Node (for tests).
 */

export const printStorageKey = 'print-options';

/** Parts of a page a reader can leave out. Each is "on" or "off". */
export const printParts = [
	'pageDetails',
	'reviewStatus',
	'officialImages',
	'maps',
	'tables',
	'documentHistory',
	'sources'
] as const;

export type PrintPart = (typeof printParts)[number];

export const switchValues = ['on', 'off'] as const;
export const noteChoices = ['end', 'inline', 'none'] as const;

export type Switch = (typeof switchValues)[number];
export type NotePlacement = (typeof noteChoices)[number];

export type PrintOptions = { [Part in PrintPart]: Switch } & {
	notes: NotePlacement;
	linkAddresses: Switch;
	termMarks: Switch;
};

export const printOptionNames = [...printParts, 'notes', 'linkAddresses', 'termMarks'] as const;

export const defaultPrintOptions: PrintOptions = {
	pageDetails: 'on',
	reviewStatus: 'on',
	officialImages: 'on',
	maps: 'on',
	tables: 'on',
	documentHistory: 'on',
	sources: 'on',
	notes: 'end',
	linkAddresses: 'on',
	termMarks: 'on'
};

export interface PartDescription {
	part: PrintPart;
	label: string;
	hint?: string;
}

/** In the order the parts appear on a page. */
export const partDescriptions: PartDescription[] = [
	{
		part: 'pageDetails',
		label: 'Page details',
		hint: 'A line at the top with the page’s address and the date you printed it, so a reader can find the current version'
	},
	{ part: 'reviewStatus', label: 'Review status', hint: 'Whether the nation has reviewed its page' },
	{ part: 'officialImages', label: 'Seal or logo', hint: 'The nation’s image; its credit is in the Sources list' },
	{ part: 'maps', label: 'Maps' },
	{ part: 'tables', label: 'Tables', hint: 'The tables of nations, states and regions' },
	{
		part: 'documentHistory',
		label: 'Document history',
		hint: 'Every recorded version of a constitution, compact or code, and how it changed'
	},
	{ part: 'sources', label: 'Sources', hint: 'The list of sources at the end of the page' }
];

export interface Choice<Value extends string> {
	value: Value;
	label: string;
	hint?: string;
}

export const noteOptions: Choice<NotePlacement>[] = [
	{ value: 'end', label: 'Note numbers, with the notes in the Sources list at the end' },
	{
		value: 'inline',
		label: 'Each note under its paragraph',
		hint: 'The full citation prints right below the text that cites it'
	},
	{ value: 'none', label: 'No note numbers' }
];

export const linkAddressOptions: Choice<Switch>[] = [
	{ value: 'on', label: 'Print each web address after its link', hint: 'So a reader of the paper copy can find the page' },
	{ value: 'off', label: 'Link text only' }
];

export const termMarkOptions: Choice<Switch>[] = [
	{ value: 'on', label: 'Dotted underline, as on screen' },
	{ value: 'off', label: 'Plain text' }
];

const allowedValues: { [Name in keyof PrintOptions]: readonly PrintOptions[Name][] } = {
	pageDetails: switchValues,
	reviewStatus: switchValues,
	officialImages: switchValues,
	maps: switchValues,
	tables: switchValues,
	documentHistory: switchValues,
	sources: switchValues,
	notes: noteChoices,
	linkAddresses: switchValues,
	termMarks: switchValues
};

/** The root element's dataset name for an option: "sources" becomes "printSources" (data-print-sources). */
export function datasetName(name: keyof PrintOptions): string {
	return `print${name[0].toUpperCase()}${name.slice(1)}`;
}

function isAllowed<Name extends keyof PrintOptions>(name: Name, value: unknown): value is PrintOptions[Name] {
	return (allowedValues[name] as readonly unknown[]).includes(value);
}

/** Reads stored options. Anything missing, unknown or unreadable falls back to the default. */
export function parsePrintOptions(stored: string | null): PrintOptions {
	const options = { ...defaultPrintOptions };
	if (!stored) return options;
	let parsed: unknown;
	try {
		parsed = JSON.parse(stored);
	} catch {
		return options;
	}
	if (typeof parsed !== 'object' || parsed === null) return options;
	const record = parsed as Record<string, unknown>;
	for (const name of printOptionNames) {
		const value = record[name];
		if (isAllowed(name, value)) (options as Record<string, string>)[name] = value;
	}
	return options;
}

/** Only the options that differ from the default are stored. */
export function serializePrintOptions(options: PrintOptions): string | null {
	const changed: Partial<Record<keyof PrintOptions, string>> = {};
	for (const name of printOptionNames) {
		if (options[name] !== defaultPrintOptions[name]) changed[name] = options[name];
	}
	return Object.keys(changed).length > 0 ? JSON.stringify(changed) : null;
}

/** The root element's data attributes, by dataset name; a default value has none. */
export function printAttributes(options: PrintOptions): Record<string, string | undefined> {
	const attributes: Record<string, string | undefined> = {};
	for (const name of printOptionNames) {
		attributes[datasetName(name)] = options[name] === defaultPrintOptions[name] ? undefined : options[name];
	}
	return attributes;
}

/** Local storage can be blocked or full; then the options last for this page only. */
function storage(): Storage | undefined {
	try {
		return window.localStorage;
	} catch {
		return undefined;
	}
}

export function loadPrintOptions(): PrintOptions {
	try {
		return parsePrintOptions(storage()?.getItem(printStorageKey) ?? null);
	} catch {
		return { ...defaultPrintOptions };
	}
}

/** Applies the options to the page and saves them on this device. */
export function savePrintOptions(options: PrintOptions): void {
	const root = document.documentElement;
	for (const [name, value] of Object.entries(printAttributes(options))) {
		if (value === undefined) delete root.dataset[name];
		else root.dataset[name] = value;
	}
	try {
		const serialized = serializePrintOptions(options);
		if (serialized === null) storage()?.removeItem(printStorageKey);
		else storage()?.setItem(printStorageKey, serialized);
	} catch {
		// Storage blocked or full: the options still apply to this page.
	}
}
