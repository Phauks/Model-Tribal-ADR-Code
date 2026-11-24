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
	topics?: string[];
}

/** A quotation's attribution: a citation of the source at its pinpoint, and any parenthetical. */
export function quoteAttribution(key: string, quote: BoxQuote): string {
	const citation = `[@${key}${quote.pinpoint ? `, ${quote.pinpoint}` : ''}]`;
	return quote.parenthetical ? `${citation} (${quote.parenthetical})` : citation;
}

/** One part of a box in the essay syntax ("::: holding" ... ":::"), or nothing when the record has no such part. */
export function boxPartMarkdown(key: string, box: RecordBox, part: BoxPart): string {
	let inner: string | undefined;
	if (part === 'quotes') inner = box.quotes?.length ? box.quotes.map((quote) => `> ${quote.text}\n\n${quoteAttribution(key, quote)}`).join('\n\n') : undefined;
	else if (part === 'topics') inner = box.topics?.length ? box.topics.join('; ') : undefined;
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

const boxOpening = /^(:{4,})[ \t]*(case|law)[ \t]+([a-z0-9]+(?:-[a-z0-9]+)*)[ \t]*$/;

/**
 * An essay's text with each empty case or law box filled from its record.
 * `origin` gives, for each line of the filled text, the line of the original
 * it came from (a filled-in line counts as the box's opening line), so marks
 * made against the original's lines, such as draft changes, still land.
 */
export function fillBoxes(text: string, boxText: (kind: BoxKind, key: string) => string | undefined): { text: string; origin: number[] } {
	const lines = text.split('\n');
	const filled: string[] = [];
	const origin: number[] = [];
	for (let index = 0; index < lines.length; index += 1) {
		filled.push(lines[index]);
		origin.push(index);
		const opening = boxOpening.exec(lines[index]);
		if (!opening) continue;
		let next = index + 1;
		while (next < lines.length && !lines[next].trim()) next += 1;
		if (next >= lines.length || lines[next].trim() !== opening[1]) continue;
		const inside = boxText(opening[2] as BoxKind, opening[3]);
		if (!inside) continue;
		for (const line of inside.split('\n')) {
			filled.push(line);
			origin.push(index);
		}
	}
	return { text: filled.join('\n'), origin };
}
