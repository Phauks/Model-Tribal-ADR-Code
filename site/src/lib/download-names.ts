/**
 * Dated names for downloaded files. Trevor asked on Nov. 24, 2026 that downloads carry a date, since
 * a folder of files all named provisions.csv cannot say which came later. A file is saved as
 * provisions-2026-11-23.csv: the date the site was built, which is the date of the data in it, not
 * the day of the click, so the same data always gets the same name. A file put together when it is
 * asked for, such as a ZIP of a nation's documents, carries the day it was put together.
 *
 * Dates are in Coordinated Universal Time, as the workspace's own exports are, so a name is the same
 * wherever the reader is. The address of each file stays the same; only the name it is saved under
 * changes. Pages pass the build's time, buildTime(version) from src/lib/offline-collections.ts.
 * The .sha256 file beside a download names the dated file, so `sha256sum -c` finds it.
 */
import { fileName } from './checksums.ts';

/** "2026-11-23", the date part of a moment in Coordinated Universal Time. */
export function dayOf(date: Date): string {
	return date.toISOString().slice(0, 10);
}

/**
 * A file name with a date before its extension: "provisions.csv" -> "provisions-2026-11-23.csv".
 * A name already ending in that date is left alone. Without a date the name is unchanged.
 */
export function datedName(name: string, date: Date | undefined): string {
	if (!date) return name;
	const day = dayOf(date);
	const dot = name.lastIndexOf('.');
	const stem = dot > 0 ? name.slice(0, dot) : name;
	const extension = dot > 0 ? name.slice(dot) : '';
	if (stem.endsWith(`-${day}`)) return name;
	return `${stem}-${day}${extension}`;
}

/** Files whose own name says too little once saved, and the name each is saved under instead. */
const savedNames: Record<string, string> = {
	'/zip/data.zip': 'model-tribal-adr-code-data.zip'
};

/** Folders under /nations that hold the site's own lists rather than one nation's files. */
const sharedFolders = new Set(['map', 'recourse', 'law', 'timeline', 'removals']);

/**
 * The dated name a file on this site is saved under, from its address: "/nations/recourse/provisions.csv" ->
 * "provisions-2026-11-23.csv". A nation's own file also carries the nation, since every nation's record is
 * record.json: "/nations/navajo-nation/record.json" -> "navajo-nation-record-2026-11-23.json".
 */
export function datedFileName(path: string, date: Date | undefined): string {
	const nation = /^\/nations\/([a-z0-9-]+)\/[^/]+$/.exec(path)?.[1];
	const name = savedNames[path] ?? (nation && !sharedFolders.has(nation) ? `${nation}-${fileName(path)}` : fileName(path));
	return datedName(name, date);
}
