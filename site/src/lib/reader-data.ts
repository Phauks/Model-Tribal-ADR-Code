/**
 * Export and import of a reader's data (site/DESIGN.md, section 6,
 * "Settings", Data): the reading settings, the theme, the print choices,
 * the starred pages with the reader's notes (src/lib/starred-items.ts) and
 * which parts and pages of the site are chosen for offline reading, as one JSON file the
 * reader can carry to another browser or device. Trevor asked for this on
 * Nov. 22, 2026. Saved pages themselves are not in the file; the importing
 * device saves them again from the site. A file made before stars existed
 * has no "starred" list and reads as having none.
 *
 * This module must work in the browser and in Node (for tests).
 */
import { parsePrintOptions, type PrintOptions } from './print-options.ts';
import { parseSettings, parseTheme, type ReadingSettings, type Theme } from './reading-settings.ts';
import { readStarredItems, type StarredItem } from './starred-items.ts';

export const readerDataKind = 'model-tribal-adr-code-reader-data';
export const readerDataVersion = 1;

export interface ReaderData {
	kind: typeof readerDataKind;
	version: typeof readerDataVersion;
	/** When the file was made, as an ISO 8601 date and time. */
	exported: string;
	settings: ReadingSettings;
	theme: Theme;
	printOptions: PrintOptions;
	/**
	 * The parts and groups chosen for offline reading on the device that made the file (src/lib/offline-choices.ts). A
	 * file made before Nov. 26, 2026 lists the collections kept then, whose names are parts of the outline too.
	 */
	savedParts: string[];
	/** The single pages chosen for offline reading, by address. */
	savedPages: string[];
	/** The starred pages and the reader's notes on them. */
	starred: StarredItem[];
}

/** The largest file Import reads: 500 starred pages with full notes fit well under it. */
export const readerDataSizeLimit = 2_000_000;

export function buildReaderData(
	settings: ReadingSettings,
	theme: Theme,
	printOptions: PrintOptions,
	saved: { parts: string[]; pages: string[] },
	starred: StarredItem[],
	now = new Date()
): ReaderData {
	return {
		kind: readerDataKind,
		version: readerDataVersion,
		exported: now.toISOString(),
		settings,
		theme,
		printOptions,
		savedParts: saved.parts,
		savedPages: saved.pages,
		starred
	};
}

/** The file name for an export, with the day it was made: model-tribal-adr-code-data-2026-11-22.json. */
export function readerDataFileName(now = new Date()): string {
	return `model-tribal-adr-code-data-${now.toISOString().slice(0, 10)}.json`;
}

/**
 * Reads an imported file. Anything that is not this site's export is
 * refused; inside a valid file, unknown or missing values fall back to the
 * defaults, the same way stored settings are read.
 */
export function parseReaderData(text: string): ReaderData | undefined {
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		return undefined;
	}
	if (typeof parsed !== 'object' || parsed === null) return undefined;
	const record = parsed as Record<string, unknown>;
	if (record.kind !== readerDataKind || record.version !== readerDataVersion) return undefined;
	const exported = typeof record.exported === 'string' && !Number.isNaN(Date.parse(record.exported)) ? record.exported : '';
	const savedParts = Array.isArray(record.savedParts)
		? [...new Set(record.savedParts.filter((part): part is string => typeof part === 'string' && /^[a-z0-9-]{1,80}$/.test(part)))]
		: [];
	const savedPages = Array.isArray(record.savedPages)
		? [...new Set(record.savedPages.filter((path): path is string => typeof path === 'string' && /^\/[^\s]{0,300}$/.test(path)))]
		: [];
	return {
		kind: readerDataKind,
		version: readerDataVersion,
		exported,
		settings: parseSettings(JSON.stringify(record.settings ?? {})),
		theme: parseTheme(typeof record.theme === 'string' ? record.theme : null),
		printOptions: parsePrintOptions(JSON.stringify(record.printOptions ?? {})),
		savedParts,
		savedPages,
		starred: readStarredItems(record.starred)
	};
}
