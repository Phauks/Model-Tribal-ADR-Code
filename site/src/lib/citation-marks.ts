/**
 * Citation markers: the small numbers in square brackets after a fact or a
 * sentence, as Wikipedia shows them (site/DESIGN.md, section 6, "Citations").
 * Each marker links to its source's entry in the page's Sources list, and
 * each entry links back to every marker that cites it. With scripts, pointing
 * at a marker also previews the source beside it
 * (src/lib/components/CitationPopup.svelte).
 *
 * Markdown citations (src/lib/server/markdown.ts) and the CitationMarks
 * component write the same HTML, so the preview, the print options and the
 * "show the note under the paragraph" setting treat every marker alike.
 *
 * This module must work in the browser and in Node (for tests).
 */
import { escapeHtml } from './escape-html.ts';

/** One marker on a page. */
export interface CitationMark {
	/** The source's number in the Sources list. */
	number: number;
	/** The marker's id, unique on the page, which the Sources list links back to. */
	anchor: string;
	/** Where in the source and as of when, such as "p. 3, as of 2026-11-20". */
	where?: string;
}

/** The id of a marker: the source's number and the marker's place among that source's markers, from 1. */
export function markAnchor(number: number, occurrence: number): string {
	return `cite-${number}-${occurrence}`;
}

/** The id of a source's entry in the Sources list. */
export function sourceAnchor(number: number): string {
	return `source-${number}`;
}

/** a, b, … z, aa, ab, …: the letters Wikipedia uses for a source's backlinks. */
export function backlinkLetter(index: number): string {
	let letters = '';
	let rest = index;
	do {
		letters = String.fromCharCode(97 + (rest % 26)) + letters;
		rest = Math.floor(rest / 26) - 1;
	} while (rest >= 0);
	return letters;
}

/** One marker as HTML. */
export function markHtml(mark: CitationMark): string {
	const where = mark.where ? ` data-where="${escapeHtml(mark.where)}"` : '';
	return (
		`<a id="${mark.anchor}" class="note-marker" href="#${sourceAnchor(mark.number)}"` +
		` aria-label="Source ${mark.number}"${where}>${mark.number}</a>`
	);
}

/** Markers that sit together, as HTML: one superscript holding each marker. */
export function marksHtml(marks: CitationMark[]): string {
	return marks.length > 0 ? `<sup class="citation">${marks.map(markHtml).join('')}</sup>` : '';
}

