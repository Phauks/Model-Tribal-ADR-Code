/**
 * A quotation in its paragraph (Trevor, Nov. 23, 2026: "expand the quote to
 * the entire paragraph it is in, and maybe a paragraph above and below it").
 *
 * The source library (decision record 0051, src/lib/server/source-library.ts)
 * holds each document's text in passages, page by page. This module turns a
 * document's passages back into paragraphs, finds a quotation among them,
 * and says how closely the quotation matches: word for word, with a few
 * words different (a misquotation, or a misreading in the copy), or not at
 * all. A quotation that leaves words out ("...", or a bracketed change such
 * as "[W]e") is matched piece by piece.
 *
 * Matching compares words only: case, punctuation, curly or straight
 * quotation marks and accents are ignored, since copies differ in them
 * without differing in what the court said.
 *
 * Runs in the Worker (src/lib/server/quote-context.ts) and in tests; it reads
 * nothing itself.
 */

/** One passage of a document, as the library stores it. */
export interface LibraryPassageText {
	page: number | null;
	label: string | null;
	method: string | null;
	text: string;
}

/** A paragraph of a document, with the page it starts on. */
export interface SourceParagraph {
	text: string;
	page: number | null;
	label: string | null;
	/** A short line on its own, such as a section letter ("B") or numeral. */
	heading: boolean;
}

/** Words that differ between the copy and the quotation. */
export interface QuoteDifference {
	/** The copy's words ("" when the quotation adds words). */
	source: string;
	/** The quotation's words ("" when the quotation leaves words out without an ellipsis). */
	quoted: string;
}

export type QuoteMatch = 'exact' | 'close' | 'not-found';

/** Where a quotation sits in a document's paragraphs. */
export interface QuoteLocation {
	match: Exclude<QuoteMatch, 'not-found'>;
	/** The first and last paragraph (indexes) the quoted words are in. */
	first: number;
	last: number;
	/** Character ranges to highlight, by paragraph index. */
	highlights: Record<number, [number, number][]>;
	differences: QuoteDifference[];
	/** Share of the quotation's words found in order, from 0 to 1. */
	score: number;
}

/** The lowest share of a quotation's words that still counts as found. */
const closeEnough = 0.8;

interface Word {
	word: string;
	start: number;
	end: number;
}

/** A word as compared: lower case, no accents, the same apostrophes. */
function comparable(word: string): string {
	return word
		.normalize('NFKD')
		.replace(/\p{M}/gu, '')
		.toLowerCase();
}

/** The words in a text with where each sits. */
export function wordsOf(text: string): Word[] {
	const words: Word[] = [];
	for (const match of text.matchAll(/[\p{L}\p{N}]+/gu)) {
		words.push({ word: comparable(match[0]), start: match.index, end: match.index + match[0].length });
	}
	return words;
}

/**
 * The pieces of a quotation to look for: the words between ellipses and
 * bracketed changes, without Markdown emphasis. Pieces of one or two words
 * are left out unless the quotation has nothing longer, since they would
 * match anywhere.
 */
export function quotationPieces(quotation: string): string[][] {
	const pieces = quotation
		.replace(/[*_`]/g, '')
		// A bracketed letter changes a word's case ("[W]e"); the word is still the court's.
		.replace(/\[(\p{L})\](?=\p{L})/gu, '$1')
		.split(/\.\s?\.\s?\.|…|\[[^\]]*\]/)
		.map((piece) => wordsOf(piece).map((word) => word.word))
		.filter((piece) => piece.length > 0);
	const long = pieces.filter((piece) => piece.length >= 3);
	return long.length > 0 ? long : pieces;
}

/** A line on its own that marks a part of an opinion: "B", "II", "III-A", "1.", "*". */
function headingLike(text: string): boolean {
	const trimmed = text.trim();
	return trimmed.length <= 12 && /^(?:[IVXLC]+|[A-Z]|\d{1,2})(?:[-–.][A-Z0-9]+)*\.?$/.test(trimmed);
}

/**
 * Footnote numbers a web copy prints glued to the word they follow
 * ("apply.20 Tribal", "amended11 in"). A number after a space, as in "§ 1302"
 * or "424 U.S. 382", is left alone.
 */
function withoutFootnoteNumbers(text: string): string {
	return text.replace(/\[\d{1,3}\](?=[\s,.;:]|$)/g, '').replace(/(?<=\p{Ll}|[\p{Ll}"'’”)\]][.,;:]|["'’”)\]])\d{1,3}(?=[\s,.;:)]|$)/gu, '');
}

/**
 * A page of a PDF read by text layer or OCR repeats a running head at its
 * top: the case name, "Opinion of the Court.", the page number and the term.
 * Short lines at the very top that look like that are dropped.
 */
function withoutRunningHead(lines: string[]): string[] {
	// "Opinion of the Court" is matched loosely: scans of the United States Reports read it as "Opinron" or "Opimon".
	let index = 0;
	while (index < Math.min(lines.length, 4)) {
		const line = lines[index].trim();
		const runningHead =
			line === '' ||
			(line.length <= 60 &&
				(/^[^a-z]*$/.test(line.replace(/\bv\./g, '')) ||
					/\bop[a-z]{3,6}\s+of\s+the\s+court|october term|syllabus|dissenting|concurring|for educational use only|westlaw/i.test(line) ||
					/^\d+\s/.test(line) ||
					/\s\d+$/.test(line)));
		if (!runningHead) break;
		index += 1;
	}
	return lines.slice(index);
}

/** The end of a line that introduces a quotation set apart: "the court said (p. 383)", "as follows:". */
const quotationIntroduced = /(?:\bsaid|\bsays|\bfollows|\bstated|\bdeclared|:|\(pp?\.\s*\d+(?:[-–]\d+)?\))[.,:]?$/;

/**
 * A document's passages as paragraphs. Web pages and plain text mark
 * paragraphs with blank lines. A PDF's text does not reliably, so a
 * paragraph there ends at a line that stops short of the others and ends a
 * sentence, and words broken at a line's end are joined again.
 */
export function paragraphsOf(passages: LibraryPassageText[]): SourceParagraph[] {
	const paragraphs: SourceParagraph[] = [];
	const add = (text: string, page: number | null, label: string | null) => {
		const cleaned = text.replace(/\s+/g, ' ').trim();
		if (!cleaned || /^\d+$/.test(cleaned)) return;
		paragraphs.push({ text: cleaned, page, label, heading: headingLike(cleaned) });
	};

	let lines: string[] = [];
	let linesPage: { page: number | null; label: string | null } = { page: null, label: null };
	const endLines = () => {
		if (lines.length > 0) add(lines.join(' '), linesPage.page, linesPage.label);
		lines = [];
	};

	let carried = '';
	let carriedPage: { page: number | null; label: string | null } = { page: null, label: null };
	const endCarried = () => {
		if (carried) add(carried, carriedPage.page, carriedPage.label);
		carried = '';
	};

	// A court quoting another opinion sets the quotation apart as its own
	// paragraph, often with a full last line, so line length cannot find its
	// ends: it starts with an opening quotation mark after "the court said
	// (p. 382)" and ends at a closing mark after a full stop.
	let inQuotation = false;
	let quotationClosed = false;

	let previousPage: number | null | undefined;
	for (const passage of passages) {
		const fromPdf = passage.method === 'text-layer' || passage.method === 'ocr';
		if (fromPdf) {
			endCarried();
			let pageLines = passage.text.split('\n');
			// Only the first passage of a page carries its running head.
			if (passage.page !== previousPage) pageLines = withoutRunningHead(pageLines);
			const lengths = pageLines.map((line) => line.trim().length).filter((length) => length > 0).sort((a, b) => a - b);
			const typical = lengths[Math.floor(lengths.length / 2)] ?? 60;
			for (const raw of pageLines) {
				const line = raw.trim();
				// The library adds blank lines when it splits a long page, so they mark nothing here.
				if (!line) continue;
				const opensQuotation = /^["“]/.test(line);
				if (lines.length > 0 && opensQuotation && quotationIntroduced.test(lines[lines.length - 1])) {
					endLines();
					inQuotation = true;
				} else if (quotationClosed) {
					if (lines.length > 0 && /^[\p{Lu}"“]/u.test(line)) endLines();
					inQuotation = opensQuotation;
				}
				quotationClosed = false;
				if (lines.length === 0) linesPage = { page: passage.page, label: passage.label };
				const last = lines.length - 1;
				if (last >= 0 && /[\p{L}]-$/u.test(lines[last])) lines[last] = lines[last].slice(0, -1) + line;
				else lines.push(line);
				if (inQuotation && /[.?!;]['’]?["”]$/.test(line)) quotationClosed = true;
				if (/[.?!:;"'’”)]$/.test(line) && line.length < typical * 0.8) endLines();
			}
		} else {
			endLines();
			// A paragraph number on a line of its own before the text ("23"), as some court sites print.
			const blocks = withoutFootnoteNumbers(passage.text).split(/\n\s*\n/).map((block) => block.replace(/^\s*\d{1,3}\s*\n/, ''));
			for (const block of blocks) {
				const text = block.replace(/\s+/g, ' ').trim();
				if (!text) continue;
				if (/^\d+$/.test(text)) {
					endCarried();
					continue;
				}
				// Some pages break lines, and even leave blank lines, inside a sentence;
				// and a paragraph longer than a passage continues in the next one. Text
				// that follows words not ending a sentence belongs to their paragraph.
				if (carried && !/[.?!:;"'’”)\]]$/.test(carried) && !headingLike(carried) && !headingLike(text)) {
					carried = `${carried} ${text}`;
				} else {
					endCarried();
					carried = text;
					carriedPage = { page: passage.page, label: passage.label };
				}
			}
		}
		previousPage = passage.page;
	}
	endLines();
	endCarried();
	return paragraphs;
}

interface Alignment {
	/** Index of the first and last document word matched. */
	from: number;
	to: number;
	/** Edits needed: words changed, added or left out. */
	cost: number;
	differences: QuoteDifference[];
	/** The document words that match a quoted word. */
	matched: number[];
}

/**
 * The quotation's words against a stretch of the document, letting the
 * stretch start and end anywhere (a semi-global alignment): the fewest
 * changed, added and left-out words, and which they are.
 */
function align(piece: string[], document: Word[], windowStart: number, windowEnd: number): Alignment | undefined {
	const columns = windowEnd - windowStart;
	const rows = piece.length;
	if (columns <= 0 || rows === 0) return undefined;
	const width = columns + 1;
	const cost = new Int32Array((rows + 1) * width);
	for (let row = 1; row <= rows; row += 1) cost[row * width] = row;
	for (let row = 1; row <= rows; row += 1) {
		for (let column = 1; column <= columns; column += 1) {
			const same = piece[row - 1] === document[windowStart + column - 1].word ? 0 : 1;
			cost[row * width + column] = Math.min(
				cost[(row - 1) * width + column - 1] + same,
				cost[(row - 1) * width + column] + 1,
				cost[row * width + column - 1] + 1
			);
		}
	}
	let bestColumn = 1;
	for (let column = 1; column <= columns; column += 1) {
		if (cost[rows * width + column] < cost[rows * width + bestColumn]) bestColumn = column;
	}
	// Walk back to read off the differences.
	const steps: { kind: 'same' | 'changed' | 'added' | 'left-out'; quoted?: string; source?: number }[] = [];
	let row = rows;
	let column = bestColumn;
	while (row > 0) {
		const here = cost[row * width + column];
		if (column > 0 && here === cost[(row - 1) * width + column - 1] + (piece[row - 1] === document[windowStart + column - 1].word ? 0 : 1)) {
			const same = piece[row - 1] === document[windowStart + column - 1].word;
			steps.push({ kind: same ? 'same' : 'changed', quoted: piece[row - 1], source: windowStart + column - 1 });
			row -= 1;
			column -= 1;
		} else if (here === cost[(row - 1) * width + column] + 1) {
			steps.push({ kind: 'added', quoted: piece[row - 1] });
			row -= 1;
		} else {
			steps.push({ kind: 'left-out', source: windowStart + column - 1 });
			column -= 1;
		}
	}
	steps.reverse();
	const matched: number[] = [];
	const differences: QuoteDifference[] = [];
	let open: { source: string[]; quoted: string[] } | undefined;
	const close = () => {
		if (open) differences.push({ source: open.source.join(' '), quoted: open.quoted.join(' ') });
		open = undefined;
	};
	for (const step of steps) {
		if (step.kind === 'same') {
			close();
			matched.push(step.source!);
			continue;
		}
		open ??= { source: [], quoted: [] };
		if (step.source !== undefined) open.source.push(document[step.source].word);
		if (step.quoted !== undefined) open.quoted.push(step.quoted);
	}
	close();
	const sourceIndexes = steps.filter((step) => step.source !== undefined).map((step) => step.source!);
	if (sourceIndexes.length === 0) return undefined;
	return {
		from: sourceIndexes[0],
		to: sourceIndexes[sourceIndexes.length - 1],
		cost: cost[rows * width + bestColumn],
		differences,
		matched
	};
}

/**
 * Where a piece of a quotation best fits the document: stretches that share
 * runs of three words with it are tried, best first.
 */
function placePiece(piece: string[], document: Word[], index: Map<string, number[]>, after: number): Alignment | undefined {
	const votes = new Map<number, number>();
	const gram = Math.min(3, piece.length);
	for (let offset = 0; offset + gram <= piece.length; offset += 1) {
		for (const position of index.get(piece.slice(offset, offset + gram).join(' ')) ?? []) {
			const start = position - offset;
			if (start < after - 2) continue;
			votes.set(start, (votes.get(start) ?? 0) + 1);
		}
	}
	const candidates = [...votes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
	let best: Alignment | undefined;
	for (const [start] of candidates) {
		const slack = Math.max(4, Math.ceil(piece.length * 0.25));
		const alignment = align(piece, document, Math.max(0, start - slack), Math.min(document.length, start + piece.length + slack));
		if (alignment && (!best || alignment.cost < best.cost)) best = alignment;
	}
	return best;
}

function gramIndex(words: Word[], size: number): Map<string, number[]> {
	const index = new Map<string, number[]>();
	for (let position = 0; position + size <= words.length; position += 1) {
		const key = words
			.slice(position, position + size)
			.map((word) => word.word)
			.join(' ');
		const list = index.get(key);
		if (list) list.push(position);
		else index.set(key, [position]);
	}
	return index;
}

/** Finds a quotation among a document's paragraphs. */
export function locateQuotation(paragraphs: SourceParagraph[], quotation: string): QuoteLocation | undefined {
	const pieces = quotationPieces(quotation);
	if (pieces.length === 0) return undefined;
	const words: Word[] = [];
	const paragraphOf: number[] = [];
	for (const [number, paragraph] of paragraphs.entries()) {
		for (const word of wordsOf(paragraph.text)) {
			words.push(word);
			paragraphOf.push(number);
		}
	}
	const indexes = new Map<number, Map<string, number[]>>();
	const indexFor = (size: number) => {
		let index = indexes.get(size);
		if (!index) indexes.set(size, (index = gramIndex(words, size)));
		return index;
	};

	const placed: Alignment[] = [];
	let after = 0;
	let totalWords = 0;
	let totalCost = 0;
	for (const piece of pieces) {
		const alignment = placePiece(piece, words, indexFor(Math.min(3, piece.length)), after);
		totalWords += piece.length;
		if (!alignment) {
			totalCost += piece.length;
			continue;
		}
		placed.push(alignment);
		totalCost += alignment.cost;
		after = alignment.to + 1;
	}
	const score = totalWords === 0 ? 0 : Math.max(0, 1 - totalCost / totalWords);
	if (placed.length === 0 || score < closeEnough) return undefined;

	const highlights: Record<number, [number, number][]> = {};
	for (const alignment of placed) {
		// One highlight per run of matched words in the same paragraph.
		let runStart: number | undefined;
		let previous: number | undefined;
		const flush = () => {
			if (runStart === undefined || previous === undefined) return;
			const paragraph = paragraphOf[runStart];
			(highlights[paragraph] ??= []).push([words[runStart].start, words[previous].end]);
		};
		for (const position of alignment.matched) {
			if (previous !== undefined && (position > previous + 3 || paragraphOf[position] !== paragraphOf[previous])) {
				flush();
				runStart = position;
			}
			runStart ??= position;
			previous = position;
		}
		flush();
	}
	const differences = placed.flatMap((alignment) => alignment.differences);
	return {
		match: totalCost === 0 ? 'exact' : 'close',
		first: paragraphOf[Math.min(...placed.map((alignment) => alignment.from))],
		last: paragraphOf[Math.max(...placed.map((alignment) => alignment.to))],
		highlights,
		differences,
		score
	};
}

/** A paragraph to show, with the quoted words marked. */
export interface ContextParagraph {
	text: string;
	highlights: [number, number][];
	heading: boolean;
}

/** The paragraphs around a quotation that a reader can open, and where they come from. */
export interface QuoteContext {
	match: Exclude<QuoteMatch, 'not-found'>;
	/** The paragraphs holding the quoted words. */
	paragraphs: ContextParagraph[];
	/** The paragraph before and after, each with a section heading that sits between, if any. */
	before: ContextParagraph[];
	after: ContextParagraph[];
	/** The PDF page the quoted words start on, and its printed page or star page when known. */
	page: number | null;
	label: string | null;
	differences: QuoteDifference[];
}

/** Paragraphs are capped, so a quotation matched across far-apart text cannot open the whole document. */
const mostParagraphs = 3;

export function quoteContext(paragraphs: SourceParagraph[], location: QuoteLocation): QuoteContext {
	const shown = (index: number): ContextParagraph => ({
		text: paragraphs[index].text,
		highlights: location.highlights[index] ?? [],
		heading: paragraphs[index].heading
	});
	const last = Math.min(location.last, location.first + mostParagraphs - 1);
	const neighbor = (start: number, step: 1 | -1): ContextParagraph[] => {
		const found: ContextParagraph[] = [];
		for (let index = start; index >= 0 && index < paragraphs.length && found.length < 3; index += step) {
			found.push(shown(index));
			if (!paragraphs[index].heading) break;
		}
		return step === -1 ? found.reverse() : found;
	};
	return {
		match: location.match,
		paragraphs: Array.from({ length: last - location.first + 1 }, (_, offset) => shown(location.first + offset)),
		before: neighbor(location.first - 1, -1),
		after: neighbor(last + 1, 1),
		page: paragraphs[location.first].page,
		label: paragraphs[location.first].label,
		differences: location.differences
	};
}

/**
 * The quotations in an essay's Markdown that name their source: a ">"
 * passage or the text of a "::: quote" box, followed by an attribution that
 * cites one source, "[@key, p. 12]". The source is what the quotation is
 * looked for in.
 */
export interface EssayQuotation {
	text: string;
	source: string;
	pinpoint: string | null;
	/** The line the quotation starts on, from 1. */
	line: number;
}

const attributionPattern = /^\[@([a-z0-9]+(?:-[a-z0-9]+)*)(?:,\s*([^\];@]+))?\](?:\s*\([^()]*\))?\.?$/;

/** The one source an attribution such as "[@key, p. 12]" cites, if it cites exactly one. */
export function attributionSource(text: string): { source: string; pinpoint: string | null } | undefined {
	const match = attributionPattern.exec(text.trim());
	return match ? { source: match[1], pinpoint: match[2]?.trim() ?? null } : undefined;
}

export function quotationsIn(markdown: string): EssayQuotation[] {
	const lines = markdown.split('\n');
	const found: EssayQuotation[] = [];
	let index = 0;
	while (index < lines.length) {
		const line = lines[index];
		const quoteBox = /^:{3}\s*quote\s*$/.test(line.trim());
		if (!line.startsWith('>') && !quoteBox) {
			index += 1;
			continue;
		}
		const startLine = index + 1;
		const text: string[] = [];
		let attribution: RegExpExecArray | null = null;
		if (quoteBox) {
			index += 1;
			while (index < lines.length && !/^:{3}\s*$/.test(lines[index].trim())) {
				const match = attributionPattern.exec(lines[index].trim());
				if (match) attribution = match;
				else if (lines[index].trim() && !/^(—|--)\s/.test(lines[index].trim())) text.push(lines[index].replace(/^>\s?/, ''));
				index += 1;
			}
			index += 1;
		} else {
			while (index < lines.length && lines[index].startsWith('>')) {
				text.push(lines[index].replace(/^>\s?/, ''));
				index += 1;
			}
			let next = index;
			while (next < lines.length && lines[next].trim() === '') next += 1;
			attribution = attributionPattern.exec(lines[next]?.trim() ?? '');
		}
		const joined = text.join(' ').replace(/\s+/g, ' ').trim();
		if (attribution && joined) {
			found.push({ text: joined, source: attribution[1], pinpoint: attribution[2]?.trim() ?? null, line: startLine });
		}
	}
	return found;
}
