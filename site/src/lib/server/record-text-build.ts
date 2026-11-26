/**
 * The build's side of editable record text (docs/site-text.md, "Record
 * text"): the catalog entries for each editable part of a case's or law's
 * box, and the published words for them. Runs in Node during `vite build`
 * only (vite.config.ts).
 */
import { writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { applyRecordText, recordTextKey, recordTextParts, type RecordTextWords } from '../record-text.ts';
import type { SiteTextEntry } from '../site-text-markers.ts';
import { sourceFile, sources } from './content.ts';
import { recordName, recordPageLink } from './law-records.ts';

/** Each written part of each case's and law's box that has a page, as a piece of site text. */
export function recordTextCatalog(): SiteTextEntry[] {
	const entries: SiteTextEntry[] = [];
	for (const record of sources().values()) {
		const box = record.law_box ?? record.case_box;
		const page = box ? recordPageLink(record.key) : undefined;
		if (!box || !page) continue;
		for (const part of recordTextParts) {
			const words = box[part]?.trim();
			if (!words) continue;
			entries.push({
				key: recordTextKey(record.key, part),
				file: `../${sourceFile(record.key) ?? `content/sources/${record.key}.yaml`}`,
				line: 0,
				words,
				record: { key: record.key, part, page, name: recordName(record.key).name }
			});
		}
	}
	return entries;
}

/** The published words that belong to parts of boxes, by record and part. */
export function publishedRecordText(entries: readonly SiteTextEntry[], texts: Readonly<Record<string, string>>): RecordTextWords {
	const words: RecordTextWords = {};
	for (const entry of entries) {
		const published = texts[entry.key];
		if (!entry.record || published === undefined) continue;
		(words[entry.record.key] ??= {})[entry.record.part] = published;
	}
	return words;
}

/**
 * Puts the published words into the records this process has read, and
 * names a file of them in PUBLISHED_RECORD_TEXT_FILE for the processes the
 * build starts (SvelteKit prerenders pages in a process of its own, which
 * reads the records afresh). Returns how many parts changed.
 */
export function usePublishedRecordText(words: RecordTextWords): number {
	if (Object.keys(words).length === 0) return 0;
	const file = path.join(os.tmpdir(), `published-record-text-${process.pid}.json`);
	writeFileSync(file, JSON.stringify(words));
	process.env.PUBLISHED_RECORD_TEXT_FILE = file;
	return applyRecordText(sources(), words);
}
