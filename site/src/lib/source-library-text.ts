/**
 * Helpers the source library's pages share with the server
 * (src/lib/server/source-library.ts): the marks around matched words in an
 * excerpt, and how a passage's place and a document's heading are written.
 */

/** Marks around matched words in an excerpt. The page splits on them, so no HTML is ever made from document text. */
export const matchStart = '\u0002';
export const matchEnd = '\u0003';

/** An excerpt cut into plain text and matched words. */
export function excerptPieces(excerpt: string): { text: string; matched: boolean }[] {
	const result: { text: string; matched: boolean }[] = [];
	for (const chunk of excerpt.split(matchStart)) {
		const end = chunk.indexOf(matchEnd);
		const matched = end === -1 ? '' : chunk.slice(0, end);
		const rest = end === -1 ? chunk : chunk.slice(end + 1);
		if (matched) result.push({ text: matched, matched: true });
		if (rest) result.push({ text: rest, matched: false });
	}
	return result;
}

/** Where a passage is: the PDF page, the printed or reporter star page, and the part of a long page. */
export function placeLabel(passage: { page: number | null; label: string | null; part: number }): string {
	const parts: string[] = [];
	if (passage.page !== null) parts.push(`PDF page ${passage.page}`);
	if (passage.label && passage.label !== String(passage.page)) {
		parts.push(passage.page === null ? `star page *${passage.label}` : `printed page ${passage.label}`);
	}
	if (parts.length === 0) parts.push('Text');
	if (passage.part > 1) parts.push(`part ${passage.part}`);
	return parts.join(', ');
}

/** A document's heading: its title, and for a court opinion its citation, court and year. */
export function documentHeading(document: { title: string; citation: string | null; court: string | null; decided: string | null }): string {
	if (!document.citation) return document.title;
	const court = [document.court, document.decided?.slice(0, 4)].filter(Boolean).join(' ');
	return `${document.title}, ${document.citation}${court ? ` (${court})` : ''}`;
}

/** The address of a copy the website serves. */
export function copyAddress(key: string): string {
	return `/copies/${key.split('/').map(encodeURIComponent).join('/')}`;
}
