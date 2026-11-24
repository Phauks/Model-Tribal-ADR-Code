/**
 * Quotations in their paragraphs, read from the website's copy of the
 * source library (binding sourceLibrary, decision record 0051; the matching
 * itself is src/lib/quote-context.ts).
 *
 * Readers see context only from documents the website already serves in
 * full at /copies/ (U.S. government works, nations' own laws and
 * constitutions, tribal court opinions the site shows): showing a paragraph
 * of a document anyone can open gives nothing away. A quotation whose only
 * copy is private (a Westlaw print, a journal article) gets no context on
 * the public page. The writers' quotation check looks in private copies too,
 * but reports only the few words that differ.
 */
import type { D1Database } from '@cloudflare/workers-types/index.ts';
import {
	locateQuotation,
	paragraphsOf,
	quoteContext,
	type LibraryPassageText,
	type QuoteContext,
	type QuoteDifference,
	type QuoteLocation,
	type SourceParagraph
} from '../quote-context.ts';
import { copyPath } from '../public-copies.ts';
import { inGroupsOf, placeholdersFor } from '#lib/server/database-groups.ts';

/** The longest quotation looked for, in characters, and the largest document read whole. */
export const longestQuotation = 3000;
const largestDocument = 3_000_000;
/** A copy this short of text is probably a summary page, such as a syllabus, not the whole opinion. */
const shortCopy = 12_000;

interface DocumentRow {
	document_id: number;
	key: string;
	served: number;
	format: string | null;
	captured: string | null;
	record_kinds: string | null;
	characters: number | null;
	title: string | null;
}

export interface QuoteSourceDocument {
	key: string;
	title: string | null;
	/** Where the website serves it, with the PDF page when known; null for a private copy. */
	path: string | null;
	captured: string | null;
	format: string | null;
	/** Whether the document is a court opinion, to say "In the opinion". */
	opinion: boolean;
	/** Characters of text in the copy, to tell a summary page from a whole opinion. */
	characters: number | null;
}

export interface FoundQuote {
	document: QuoteSourceDocument;
	context: QuoteContext;
}

export function isSourceKey(key: string): boolean {
	return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(key) && key.length <= 200;
}

/** Which of these source records have the text of at least one document the website serves. */
export async function sourcesWithPublicText(database: D1Database, keys: string[]): Promise<string[]> {
	const wanted = [...new Set(keys.filter(isSourceKey))].slice(0, 300);
	if (wanted.length === 0) return [];
	const found = new Set<string>();
	// D1 allows 100 bound values in a statement.
	for (const group of inGroupsOf(wanted, 90)) {
		const { results } = await database
			.prepare(
				`SELECT DISTINCT r.record FROM citing_records r JOIN documents d ON d.document_id = r.document_id
				 WHERE d.served = 1 AND d.text_status != 'none' AND r.record IN (${placeholdersFor(group)})`
			)
			.bind(...group)
			.all<{ record: string }>();
		for (const row of results) found.add(row.record);
	}
	return wanted.filter((key) => found.has(key));
}

async function documentsFor(database: D1Database, source: string, publicOnly: boolean): Promise<DocumentRow[]> {
	const { results } = await database
		.prepare(
			`SELECT d.document_id, d.key, d.served, d.format, d.captured, d.record_kinds, d.characters, d.title
			 FROM citing_records r JOIN documents d ON d.document_id = r.document_id
			 WHERE r.record = ?1 AND d.text_status != 'none' AND COALESCE(d.characters, 0) <= ?2 ${publicOnly ? 'AND d.served = 1' : ''}
			 ORDER BY d.served DESC, d.characters DESC LIMIT 6`
		)
		.bind(source, largestDocument)
		.all<DocumentRow>();
	return results;
}

/** Paragraphs already read in this request, by document, for a check of many quotations. */
export type ParagraphCache = Map<number, SourceParagraph[]>;

async function paragraphsFor(database: D1Database, documentId: number, cache?: ParagraphCache): Promise<SourceParagraph[]> {
	const kept = cache?.get(documentId);
	if (kept) return kept;
	const { results } = await database
		.prepare('SELECT page, label, method, text FROM pages WHERE document_id = ?1 ORDER BY sequence')
		.bind(documentId)
		.all<LibraryPassageText>();
	const paragraphs = paragraphsOf(results);
	cache?.set(documentId, paragraphs);
	return paragraphs;
}

function describe(row: DocumentRow, page: number | null): QuoteSourceDocument {
	let path: string | null = null;
	if (row.served === 1) {
		path = copyPath({ key: row.key });
		if (row.format === 'pdf' && page) path += `#page=${page}`;
	}
	return {
		key: row.key,
		title: row.title,
		path,
		captured: row.captured,
		format: row.format,
		// The page also knows a case from its source record (cases/previews.json); this covers tribal court opinions.
		opinion: /case|opinion/.test(row.record_kinds ?? '') || row.key.startsWith('caselaw-access-project/'),
		characters: row.characters
	};
}

/** A text-layer or HTML copy is preferred to OCR at the same score, and a served copy to a private one. */
function better(candidate: { location: QuoteLocation; row: DocumentRow }, best: { location: QuoteLocation; row: DocumentRow } | undefined): boolean {
	if (!best) return true;
	if (candidate.location.score > best.location.score + 1e-9) return candidate.row.served === 1 || best.row.served !== 1;
	if (candidate.location.score >= best.location.score - 0.02 && candidate.row.served === 1 && best.row.served !== 1) return true;
	return false;
}

/**
 * The quotation in its paragraph, from the best-matching document a source
 * record cites. With publicOnly, only documents the website serves are read.
 */
export async function findQuotation(
	database: D1Database,
	source: string,
	quotation: string,
	{ publicOnly, cache }: { publicOnly: boolean; cache?: ParagraphCache }
): Promise<{ found: FoundQuote | null; documents: QuoteSourceDocument[] }> {
	const rows = await documentsFor(database, source, publicOnly);
	let best: { location: QuoteLocation; row: DocumentRow; paragraphs: SourceParagraph[] } | undefined;
	for (const row of rows) {
		const paragraphs = await paragraphsFor(database, row.document_id, cache);
		const location = locateQuotation(paragraphs, quotation);
		if (location && better({ location, row }, best)) best = { location, row, paragraphs };
		if (best?.location.match === 'exact' && best.row.served === 1) break;
	}
	const documents = rows.map((row) => describe(row, null));
	if (!best) return { found: null, documents };
	const context = quoteContext(best.paragraphs, best.location);
	return { found: { document: describe(best.row, context.page), context }, documents };
}

/** What the writers' quotation check says about one quotation. */
export interface QuotationCheck {
	line: number;
	source: string;
	pinpoint: string | null;
	excerpt: string;
	result: 'exact' | 'close' | 'not-found' | 'no-copy';
	/** Whether readers can open the quotation in its paragraph. */
	readersCanOpen: boolean;
	/** The copy it was matched in, or the copies looked in. */
	copy: string | null;
	differences: QuoteDifference[];
	/** The copy looked in may be a summary page rather than the whole document. */
	shortCopy: boolean;
}

export async function checkQuotation(
	database: D1Database,
	quotation: { text: string; source: string; pinpoint: string | null; line: number },
	cache?: ParagraphCache
): Promise<QuotationCheck> {
	const excerpt = quotation.text.length > 80 ? `${quotation.text.slice(0, 80)}…` : quotation.text;
	const base = { line: quotation.line, source: quotation.source, pinpoint: quotation.pinpoint, excerpt };
	const { found, documents } = await findQuotation(database, quotation.source, quotation.text, { publicOnly: false, cache });
	if (documents.length === 0) {
		return { ...base, result: 'no-copy', readersCanOpen: false, copy: null, differences: [], shortCopy: false };
	}
	if (!found) {
		const looked = documents[0];
		return {
			...base,
			result: 'not-found',
			readersCanOpen: false,
			copy: looked.title ?? looked.key,
			differences: [],
			shortCopy: documents.every((document) => (document.characters ?? 0) < shortCopy)
		};
	}
	return {
		...base,
		result: found.context.match,
		readersCanOpen: found.document.path !== null,
		copy: found.document.title ?? found.document.key,
		differences: found.context.differences.slice(0, 6),
		shortCopy: false
	};
}
