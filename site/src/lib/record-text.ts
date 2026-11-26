/**
 * The parts of a case's or law's box that can be edited in place on its page
 * (docs/site-text.md, "Record text"). Trevor Goldsmith found on Nov. 24, 2026
 * that the Indian Removal Act's Summary could not be edited in Edit mode:
 * the box's parts come from the law's research record, which the site text
 * editor did not cover. Each prose part is now one more piece of site text,
 * named after its record and part, edited, drafted, published and rebuilt
 * the same way.
 *
 * Quotations stay in the records only: they must match the official report
 * word for word, which is checked against the report, not on a page.
 *
 * Shared by the build, the Worker and the browser, so it imports nothing
 * that only one of them has.
 */
import { siteTextKey } from './site-text-key.ts';

export const recordTextParts = ['background', 'question', 'holding', 'summary', 'treatment'] as const;
export type RecordTextPart = (typeof recordTextParts)[number];

export const recordTextHeadings: Record<RecordTextPart, string> = {
	background: 'Background',
	question: 'Question',
	holding: 'Holding',
	summary: 'Summary',
	treatment: 'Treatment'
};

/** Where a part of a box is, for the catalog of editable text. */
export interface RecordTextPlace {
	/** The record's key, such as indian-removal-act-1830. */
	key: string;
	part: RecordTextPart;
	/** The page that shows it, such as /laws/indian-removal-act-1830. */
	page: string;
	/** The record's name, for lists. */
	name: string;
}

/** Published words for parts of boxes: record key, then part, then the Markdown. */
export type RecordTextWords = Record<string, Partial<Record<RecordTextPart, string>>>;

export function isRecordTextPart(part: string): part is RecordTextPart {
	return (recordTextParts as readonly string[]).includes(part);
}

/**
 * A part's name as a piece of site text. It is made from the record and the
 * part only, not the words, so an edit made on the website keeps showing
 * after the record's own words change in the repository; "Reset to built-in
 * text" goes back to the record's words.
 */
export function recordTextKey(record: string, part: RecordTextPart): string {
	return siteTextKey(`record:${record}`, part);
}

/** The longest a part of a box may be, as for any piece of site text. */
export const longestRecordWords = 2000;

/**
 * A part's Markdown as saved: line endings made plain, spaces at line ends
 * dropped, at most one empty line between paragraphs, and trimmed. Unlike
 * other site text, the line breaks stay, since they separate paragraphs.
 */
export function tidyRecordWords(words: string): string {
	return words
		.replace(/\r\n?/g, '\n')
		.replace(/[ \t]+$/gm, '')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}

/**
 * Marks each editable part in a box's rendered HTML (src/lib/server/case-pages.ts,
 * boxSections) with its name, so the editor on the page can find it.
 */
export function markRecordText(html: string, record: string): string {
	return html.replace(/<div class="essay-case-part essay-case-([a-z]+)">/g, (opening, part: string) =>
		isRecordTextPart(part) ? `<div class="essay-case-part essay-case-${part}" data-record-text="${recordTextKey(record, part)}">` : opening
	);
}

/** Puts published words into the records' boxes, in place. */
type BoxProse = Partial<Record<RecordTextPart, string>>;

export function applyRecordText(records: ReadonlyMap<string, { case_box?: BoxProse; law_box?: BoxProse }>, words: RecordTextWords): number {
	let applied = 0;
	for (const [key, parts] of Object.entries(words)) {
		const record = records.get(key);
		const box = record?.law_box ?? record?.case_box;
		if (!box) continue;
		for (const [part, text] of Object.entries(parts)) {
			if (!isRecordTextPart(part) || typeof text !== 'string' || typeof box[part] !== 'string') continue;
			box[part] = text;
			applied++;
		}
	}
	return applied;
}

/** The inside of a rendered part ("<div class=…>…</div>"), for showing a draft in place. */
export function partInnerHtml(html: string): string {
	const match = /<div class="essay-case-part[^"]*">\n?([\s\S]*?)<\/div>\s*$/.exec(html.trim());
	return match ? match[1] : html;
}
