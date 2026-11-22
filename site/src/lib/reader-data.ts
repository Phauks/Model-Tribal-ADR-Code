/**
 * Export and import of a reader's data (site/DESIGN.md, section 6,
 * "Settings", Data): the reading settings, the theme, the print choices and
 * which parts of the site are saved for offline reading, as one JSON file the
 * reader can carry to another browser or device. Trevor asked for this on
 * Nov. 22, 2026. Saved pages themselves are not in the file; the importing
 * device saves them again from the site.
 *
 * This module must work in the browser and in Node (for tests).
 */
import { collections, type CollectionIdentifier } from './offline-collections.ts';
import { parsePrintOptions, type PrintOptions } from './print-options.ts';
import { parseSettings, parseTheme, type ReadingSettings, type Theme } from './reading-settings.ts';

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
	/** The collections kept for offline reading on the device that made the file. */
	savedParts: CollectionIdentifier[];
}

export function buildReaderData(
	settings: ReadingSettings,
	theme: Theme,
	printOptions: PrintOptions,
	savedParts: CollectionIdentifier[],
	now = new Date()
): ReaderData {
	return {
		kind: readerDataKind,
		version: readerDataVersion,
		exported: now.toISOString(),
		settings,
		theme,
		printOptions,
		savedParts
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
	const knownParts = new Set<string>(collections.map((collection) => collection.id));
	const savedParts = Array.isArray(record.savedParts)
		? [...new Set(record.savedParts.filter((part): part is CollectionIdentifier => typeof part === 'string' && knownParts.has(part)))]
		: [];
	return {
		kind: readerDataKind,
		version: readerDataVersion,
		exported,
		settings: parseSettings(JSON.stringify(record.settings ?? {})),
		theme: parseTheme(typeof record.theme === 'string' ? record.theme : null),
		printOptions: parsePrintOptions(JSON.stringify(record.printOptions ?? {})),
		savedParts
	};
}
