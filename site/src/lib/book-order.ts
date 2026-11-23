/**
 * Printed copies ordered from the website and printed by Lulu (docs/book-orders.md).
 *
 * A reader picks a size, binding, ink, paper and cover finish. Together they
 * make Lulu's product code, the pod_package_id: "[Trim].[Ink].[Quality].[Binding].[Paper].[Finish]",
 * for example 0600X0900.BW.STD.PB.060UW444.MXX for a 6 x 9 in standard
 * black-and-white paperback on 60# white paper with a matte cover (Lulu Print
 * API documentation, "Select a Product", read Nov. 23, 2026).
 *
 * This module works in the browser and in Node (for tests): the book page
 * uses it to show choices and an estimate before Lulu is asked for a price.
 */

/** A size Lulu prints. The identifiers match pdf/book-sizes.yaml, which lays the book out for each size. */
export interface BookSize {
	identifier: string;
	name: string;
	/** Inches. */
	width: number;
	height: number;
	/** Lulu's trim code: width and height in hundredths of an inch, such as 0600X0900. */
	luluCode: string;
	/** Large sizes (7 x 10 in and up) cost more per page. */
	large: boolean;
}

function size(identifier: string, name: string, width: number, height: number): BookSize {
	const hundredths = (inches: number) => String(Math.round(inches * 100)).padStart(4, '0');
	return {
		identifier,
		name,
		width,
		height,
		luluCode: `${hundredths(width)}X${hundredths(height)}`,
		large: width * height >= 70
	};
}

/**
 * The sizes the print build supports: every size Lulu lists as eligible for
 * retail distribution as a perfect-bound, standard black-and-white paperback.
 */
export const bookSizes: BookSize[] = [
	size('pocket-book', 'Pocket Book', 4.25, 6.875),
	size('novella', 'Novella', 5, 8),
	size('digest', 'Digest', 5.5, 8.5),
	size('a5', 'A5', 5.83, 8.27),
	size('us-trade', 'US Trade', 6, 9),
	size('royal', 'Royal', 6.14, 9.21),
	size('executive', 'Executive', 7, 10),
	size('crown-quarto', 'Crown Quarto', 7.44, 9.68),
	size('small-square', 'Small Square', 7.5, 7.5),
	size('a4', 'A4', 8.27, 11.69),
	size('us-letter', 'US Letter', 8.5, 11),
	size('square', 'Square', 8.5, 8.5)
];

export const bindings = ['paperback', 'caseWrap', 'linenWrap', 'coilBound'] as const;
export type Binding = (typeof bindings)[number];

export const inks = ['standardBlackAndWhite', 'premiumBlackAndWhite'] as const;
export type Ink = (typeof inks)[number];

export const papers = ['whiteUncoated', 'creamUncoated'] as const;
export type Paper = (typeof papers)[number];

export const finishes = ['matte', 'gloss'] as const;
export type Finish = (typeof finishes)[number];

export const linenColors = ['navy', 'gray', 'red', 'black', 'tan', 'forest'] as const;
export type LinenColor = (typeof linenColors)[number];

export const foilColors = ['gold', 'black', 'white'] as const;
export type FoilColor = (typeof foilColors)[number];

/** Lulu's shipping levels, slowest first (Print API, "shipping_level"). */
export const shippingLevels = ['MAIL', 'PRIORITY_MAIL', 'GROUND', 'EXPEDITED', 'EXPRESS'] as const;
export type ShippingLevel = (typeof shippingLevels)[number];

export interface Choice<Value extends string> {
	value: Value;
	label: string;
	hint?: string;
}

export const bindingChoices: Choice<Binding>[] = [
	{ value: 'paperback', label: 'Paperback', hint: 'Perfect bound, like most trade books' },
	{ value: 'caseWrap', label: 'Hardcover', hint: 'The cover is printed on the boards' },
	{ value: 'linenWrap', label: 'Hardcover with linen and dust jacket', hint: 'Cloth boards with the title stamped in foil on the spine' },
	{ value: 'coilBound', label: 'Coil bound', hint: 'Lies flat on a desk; not sold in bookstores' }
];

export const inkChoices: Choice<Ink>[] = [
	{ value: 'standardBlackAndWhite', label: 'Standard black and white' },
	{ value: 'premiumBlackAndWhite', label: 'Premium black and white', hint: 'Sharper gray tones; not sold in bookstores' }
];

export const paperChoices: Choice<Paper>[] = [
	{ value: 'whiteUncoated', label: 'White' },
	{ value: 'creamUncoated', label: 'Cream' }
];

export const finishChoices: Choice<Finish>[] = [
	{ value: 'matte', label: 'Matte cover' },
	{ value: 'gloss', label: 'Glossy cover' }
];

export const shippingChoices: Choice<ShippingLevel>[] = [
	{ value: 'MAIL', label: 'Mail', hint: 'Slowest; tracking depends on the country' },
	{ value: 'PRIORITY_MAIL', label: 'Priority mail' },
	{ value: 'GROUND', label: 'Ground', hint: 'Courier, in the United States' },
	{ value: 'EXPEDITED', label: 'Expedited', hint: 'About two days' },
	{ value: 'EXPRESS', label: 'Express', hint: 'Fastest' }
];

/** What a reader chooses for one printed copy. */
export interface PrintChoice {
	size: string;
	binding: Binding;
	ink: Ink;
	paper: Paper;
	finish: Finish;
	/** Only for linenWrap. */
	linenColor?: LinenColor;
	foilColor?: FoilColor;
}

export const defaultPrintChoice: PrintChoice = {
	size: 'us-trade',
	binding: 'paperback',
	ink: 'standardBlackAndWhite',
	paper: 'whiteUncoated',
	finish: 'matte',
	linenColor: 'navy',
	foilColor: 'gold'
};

/** Lulu prints 32 to 800 pages for the bindings offered here (Retail Distribution Eligible Products guide). */
export const fewestPages = 32;
export const mostPages = 800;

const bindingCodes: Record<Binding, string> = { paperback: 'PB', caseWrap: 'CW', linenWrap: 'LW', coilBound: 'CO' };
const inkCodes: Record<Ink, string> = { standardBlackAndWhite: 'BW.STD', premiumBlackAndWhite: 'BW.PRE' };
const paperCodes: Record<Paper, string> = { whiteUncoated: '060UW444', creamUncoated: '060UC444' };
const finishCodes: Record<Finish, string> = { matte: 'M', gloss: 'G' };
const linenCodes: Record<LinenColor, string> = { navy: 'N', gray: 'G', red: 'R', black: 'B', tan: 'T', forest: 'F' };
const foilCodes: Record<FoilColor, string> = { gold: 'G', black: 'B', white: 'W' };

export function sizeOf(identifier: string): BookSize | undefined {
	return bookSizes.find((candidate) => candidate.identifier === identifier);
}

/** Why a choice cannot be printed, or undefined when it can. */
export function choiceProblem(choice: PrintChoice, pages?: number): string | undefined {
	if (!sizeOf(choice.size)) return 'Choose a book size.';
	if (!bindings.includes(choice.binding)) return 'Choose a binding.';
	if (!inks.includes(choice.ink)) return 'Choose an ink.';
	if (!papers.includes(choice.paper)) return 'Choose a paper.';
	if (!finishes.includes(choice.finish)) return 'Choose a cover finish.';
	if (choice.binding === 'linenWrap') {
		if (!choice.linenColor || !linenColors.includes(choice.linenColor)) return 'Choose a linen color.';
		if (!choice.foilColor || !foilColors.includes(choice.foilColor)) return 'Choose a foil color.';
	}
	if (pages !== undefined) {
		if (!Number.isInteger(pages) || pages < fewestPages || pages > mostPages) {
			return `A printed book has ${fewestPages} to ${mostPages} pages. Add or remove parts to fit.`;
		}
	}
	return undefined;
}

/** Lulu's product code for a choice, such as 0600X0900.BW.STD.PB.060UW444.MXX. */
export function podPackageIdentifier(choice: PrintChoice): string {
	const problem = choiceProblem(choice);
	if (problem) throw new Error(problem);
	const trim = sizeOf(choice.size)!.luluCode;
	const linen = choice.binding === 'linenWrap' ? linenCodes[choice.linenColor!] : 'X';
	const foil = choice.binding === 'linenWrap' ? foilCodes[choice.foilColor!] : 'X';
	return [
		trim,
		inkCodes[choice.ink],
		bindingCodes[choice.binding],
		paperCodes[choice.paper],
		`${finishCodes[choice.finish]}${linen}${foil}`
	].join('.');
}

/** Whether Lulu can sell this kind of book through bookstores (retail distribution). */
export function soldInBookstores(choice: PrintChoice): boolean {
	return choice.ink === 'standardBlackAndWhite' && choice.binding !== 'coilBound';
}

/**
 * An estimate of Lulu's print price in US dollars, before shipping and tax,
 * for showing while Lulu's own price is not available. Built from prices read
 * in Lulu's pricing calculator on Nov. 23, 2026 (standard black and white,
 * 60# white paper, matte cover): a US Trade paperback was $9.49 at 300 pages
 * and $14.49 at 500, a US Letter paperback $13.71 and $21.41, so about $1.99
 * plus 2.5 cents a page and $2.16 plus 3.85 cents a page. Executive and A4
 * cost the same as US Letter at 300 pages. Case wrap added $8.69 (US Trade)
 * and $8.82 (US Letter), linen wrap $13.00 (US Trade), coil binding $4.79
 * (US Letter), and premium ink $3.60 (US Trade, 300 pages). Lulu changes its
 * prices each year, so the order always uses the price Lulu returns.
 */
export function estimatedPrintCost(choice: PrintChoice, pages: number): number {
	const bookSize = sizeOf(choice.size);
	if (!bookSize) throw new Error('Unknown size');
	const paperback = bookSize.large ? 2.16 + 0.0385 * pages : 1.99 + 0.025 * pages;
	const binding = {
		paperback: 0,
		caseWrap: bookSize.large ? 8.82 : 8.69,
		linenWrap: 13.0,
		coilBound: 4.79
	}[choice.binding];
	const ink = choice.ink === 'premiumBlackAndWhite' ? 0.012 * pages : 0;
	return Math.round((paperback + binding + ink) * 100) / 100;
}

/** Lulu's fee for each Print API order, in US dollars (Lulu API help, "Per Order Fulfillment Fee"). */
export const fulfillmentFee = 0.75;

/** Lowest US shipping seen in Lulu's calculator for one book (Mail, Nov. 23, 2026). */
export const lowestUnitedStatesShipping = 5.69;

/** The author named on the cover and spine; must match `metadata.author` in pdf/book.yaml (a test checks). */
export const bookAuthor = 'Trevor Goldsmith';

/**
 * The words stamped in foil on a linen hardcover's spine. Lulu allows 42
 * characters for title and author together, in Latin letters only (Print API,
 * "Linen Wrap Foil").
 */
export function foilStampText(title: string): { foil_stamp_title_text: string; foil_stamp_author_text: string } {
	const room = 42 - bookAuthor.length;
	return { foil_stamp_title_text: title.slice(0, room).trimEnd(), foil_stamp_author_text: bookAuthor };
}

export function formatDollars(amount: number): string {
	return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}
