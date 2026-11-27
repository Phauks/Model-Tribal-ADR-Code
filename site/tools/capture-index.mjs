// Adds rows to the capture index (research/capture-index.csv) the way scripts/captures/capture_index.py writes it: every
// row in order of its key, so a pull request's new rows sit beside their neighbors instead of all landing at the end of
// the file, where every open filing would conflict with every other (Nov. 27, 2026). The file is read and written
// whole, as Python's csv module writes it: a field is quoted only when it holds a comma, a quote or a line break, and
// each line ends with a line feed.

import { readFileSync, writeFileSync } from 'node:fs';
import { csvLine, parseCsv } from '../src/lib/csv.ts';

export const captureIndexPath = new URL('../../research/capture-index.csv', import.meta.url);

export const captureIndexColumns = ['key', 'bytes', 'sha256', 'media_type', 'topic', 'title', 'nations', 'obtained', 'link', 'captured', 'records', 'record_kinds', 'listed_in', 'catalog', 'derived_from', 'rights', 'redistribution', 'keep_local', 'orphan'];

/** Keys compared character by character, as Python compares strings. */
const byKey = (first, second) => (first.key < second.key ? -1 : first.key > second.key ? 1 : 0);

/** Adds these rows to the capture index, each replacing any row with the same key, and writes the index in key order. */
export function addToCaptureIndex(rows, path = captureIndexPath) {
	const text = readFileSync(path, 'utf8');
	const header = text.slice(0, text.indexOf('\n')).split(',');
	const columns = header.length > 1 ? header : captureIndexColumns;
	const replaced = new Set(rows.map((row) => row.key));
	const kept = parseCsv(text).filter((row) => !replaced.has(row.key));
	const ordered = [...kept, ...rows].sort(byKey);
	const lines = [columns.join(','), ...ordered.map((row) => csvLine(columns.map((column) => String(row[column] ?? ''))))];
	writeFileSync(path, `${lines.join('\n')}\n`);
	return ordered.length;
}
