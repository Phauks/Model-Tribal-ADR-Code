/**
 * The parts of a case or law box, kept on the source's record (Trevor,
 * Nov. 24, 2026: a case's summary, quotations and treatment are facts about
 * the case, so they live with it; schemas/source.schema.json, `case_box` and
 * `law_box`). An essay holds only the box's place, two lines with nothing
 * between them:
 *
 *   :::: case worcester-v-georgia
 *   ::::
 *
 * Before an essay is read, each such place is filled with the box's parts as
 * the essay syntax writes them (syntax.ts), so the essay pages, the case
 * pages and the index of cases by topic read a box the same way wherever its
 * parts are kept. A box written out in full in an essay, as every essay
 * version published before the move has it, is left as it is. Mirrors
 * pdf/pipeline/record-boxes.mjs, which does the same for the print book.
 */
import { casePartOrder, lawPartOrder, type BoxPart } from './syntax.ts';

export type BoxKind = 'case' | 'law';

/** One quotation: its words, the page or section they are on, and the separate opinion they come from. */
export interface BoxQuote {
	text: string;
	/** "p. 561", "pp. 536-538", "¶ 58". */
	pinpoint?: string;
	/** An Indigo Book parenthetical for a separate opinion, without its parentheses: "White, J., concurring". */
	parenthetical?: string;
}

/**
 * A box's parts, each in the essay syntax's Markdown. A case uses
 * background, question, holding, quotes, treatment and topics; a law uses
 * summary, quotes and treatment.
 */
export interface RecordBox {
	background?: string;
	question?: string;
	holding?: string;
	summary?: string;
	quotes?: BoxQuote[];
	treatment?: string;
	/** The later cases that treated the case negatively, listed under Treatment (laterCasesMarkdown). */
	later_cases?: LaterCases;
	topics?: string[];
	/**
	 * A short, neutral reading of the entry's place in the law, shown as an
	 * "Analysis" block right after the box wherever an essay places it
	 * (Trevor, Nov. 24, 2026: the history essay is built from the records,
	 * with little writing between them). The case's own page does not show it.
	 */
	reading?: BoxReading;
}

/**
 * The later cases that treated a case negatively, by kind of treatment
 * (Trevor, Nov. 27, 2026: name the cases rather than count them). Written by
 * scripts/caselaw/later_cases.py from a hand-pulled Westlaw print's Negative
 * Treatment list.
 */
export interface LaterCases {
	checked: string;
	source: string;
	list: LaterCase[];
}

export interface LaterCase {
	/** "Declined to extend", "Distinguished". */
	treatment: string;
	/** The case's name, shown in italics. */
	name: string;
	/** The rest of its Indigo Book citation: "474 B.R. 687 (B.A.P. 8th Cir. 2012)". */
	citation: string;
	/** This project's record of the case: its page. */
	case?: string;
	/** An opinion copy this site serves. */
	copy?: string;
	/** The case on case.law. */
	link?: string;
}

/** The kinds of treatment in the order a list shows them, most serious first (schemas/source.schema.json). */
export const laterCaseKinds = [
	'Overruling recognized',
	'Abrogation recognized',
	'Superseded by statute',
	'Called into doubt by statute',
	'Called into doubt',
	'Limitation of holding recognized',
	'Modification recognized',
	'Declined to follow',
	'Not followed as dicta',
	'Disagreement recognized',
	'Declined to extend',
	'Followed with reservations',
	'Distinguished'
];

function escapeMarkdown(text: string): string {
	return text.replace(/([\\`*_[\]])/g, '\\$1');
}

/** Where a later case can be read: its page here, the copy this site serves, or case.law. */
export function laterCaseLink(item: LaterCase): string | undefined {
	if (item.case) return `/cases/${item.case}`;
	if (item.copy) return `/copies/view/${item.copy.split('/').map(encodeURIComponent).join('/')}`;
	return item.link;
}

/**
 * The later cases as Markdown: each kind of treatment as a bold line with
 * its count, "**Distinguished** (6)", then its cases, one Indigo Book
 * citation to a line, each linked where it can be read. `links: false`
 * leaves the links out (the print book).
 */
export function laterCasesMarkdown(box: RecordBox | undefined, { links = true }: { links?: boolean } = {}): string {
	const list = box?.later_cases?.list ?? [];
	if (!list.length) return '';
	const kinds = [...new Set(list.map((item) => item.treatment))].sort((one, other) => laterCaseKinds.indexOf(one) - laterCaseKinds.indexOf(other));
	return kinds
		.map((kind) => {
			const items = list.filter((item) => item.treatment === kind);
			const lines = items.map((item) => {
				const cited = `*${escapeMarkdown(item.name)}*, ${escapeMarkdown(item.citation)}`;
				const link = links ? laterCaseLink(item) : undefined;
				return `- ${link ? `[${cited}](${link})` : cited}`;
			});
			return `**${kind}** (${items.length})\n\n${lines.join('\n')}`;
		})
		.join('\n\n');
}

/** A box's reading: the Analysis block's title and its text, in the essay syntax's Markdown. */
export interface BoxReading {
	title: string;
	text: string;
}

/** A quotation's attribution: a citation of the source at its pinpoint, and any parenthetical. */
export function quoteAttribution(key: string, quote: BoxQuote): string {
	const citation = `[@${key}${quote.pinpoint ? `, ${quote.pinpoint}` : ''}]`;
	return quote.parenthetical ? `${citation} (${quote.parenthetical})` : citation;
}

/**
 * One part of a box in the essay syntax ("::: holding" ... ":::"), or nothing
 * when the record has no such part. Treatment ends with the later cases
 * (laterCasesMarkdown) unless `laterCases` is false: the case's page shows
 * them outside the part's editable words.
 */
export function boxPartMarkdown(key: string, box: RecordBox, part: BoxPart, { laterCases = true }: { laterCases?: boolean } = {}): string {
	let inner: string | undefined;
	if (part === 'quotes') inner = box.quotes?.length ? box.quotes.map((quote) => `> ${quote.text}\n\n${quoteAttribution(key, quote)}`).join('\n\n') : undefined;
	else if (part === 'topics') inner = box.topics?.length ? box.topics.join('; ') : undefined;
	else if (part === 'treatment') inner = [box.treatment?.trim(), laterCases ? laterCasesMarkdown(box) : ''].filter(Boolean).join('\n\n') || undefined;
	else inner = box[part]?.trim() || undefined;
	return inner ? `::: ${part}\n${inner}\n:::` : '';
}

/** Everything inside a box, in the essay syntax, its parts in their order. */
export function boxMarkdown(kind: BoxKind, key: string, box: RecordBox | undefined): string {
	if (!box) return '';
	return (kind === 'law' ? lawPartOrder : casePartOrder)
		.map((part) => boxPartMarkdown(key, box, part))
		.filter(Boolean)
		.join('\n\n');
}

/** A box's reading as the Analysis block that follows the box ("::: analysis Title" ... ":::"), or nothing. */
export function readingMarkdown(box: RecordBox | undefined): string {
	const title = box?.reading?.title.trim();
	const text = box?.reading?.text.trim();
	return title && text ? `::: analysis ${title}\n${text}\n:::` : '';
}

const boxOpening = /^(:{4,})[ \t]*(case|law)[ \t]+([a-z0-9]+(?:-[a-z0-9]+)*)[ \t]*$/;

/**
 * An essay's text with each empty case or law box filled from its record,
 * and the record's reading, if any, placed right after the box.
 * `origin` gives, for each line of the filled text, the line of the original
 * it came from (a filled-in line counts as the box's opening line, and a
 * reading's line as the box's closing line), so marks made against the
 * original's lines, such as draft changes, still land.
 */
export function fillBoxes(
	text: string,
	boxText: (kind: BoxKind, key: string) => string | undefined,
	readingText: (kind: BoxKind, key: string) => string | undefined = () => undefined
): { text: string; origin: number[] } {
	const lines = text.split('\n');
	const filled: string[] = [];
	const origin: number[] = [];
	const after = new Map<number, string>();
	for (let index = 0; index < lines.length; index += 1) {
		filled.push(lines[index]);
		origin.push(index);
		const reading = after.get(index);
		if (reading) {
			for (const line of ['', ...reading.split('\n')]) {
				filled.push(line);
				origin.push(index);
			}
		}
		const opening = boxOpening.exec(lines[index]);
		if (!opening) continue;
		let next = index + 1;
		while (next < lines.length && !lines[next].trim()) next += 1;
		if (next >= lines.length || lines[next].trim() !== opening[1]) continue;
		const closing = readingText(opening[2] as BoxKind, opening[3]);
		if (closing) after.set(next, closing);
		const inside = boxText(opening[2] as BoxKind, opening[3]);
		if (!inside) continue;
		for (const line of inside.split('\n')) {
			filled.push(line);
			origin.push(index);
		}
	}
	return { text: filled.join('\n'), origin };
}
