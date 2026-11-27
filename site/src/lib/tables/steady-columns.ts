/**
 * Column widths worked out from a table's data before any row is drawn, so a
 * long table keeps its columns still while the page arrives (Trevor, Nov. 27,
 * 2026: on /nations "the table constantly reforms as it loads more data,
 * columns shift until full load").
 *
 * A browser lays out a table with automatic widths from every cell it has
 * so far, so while a long page streams in it lays the table out again and
 * again: on /nations the columns took three to six different widths in the
 * five seconds before the last row arrived. With `table-layout: fixed` the
 * widths come from the header row alone (CSS 2.1, section 17.5.2.1), so the
 * rows that arrive later cannot move them. The widths here are shares of the
 * table's width, shared out as the browser shares automatic widths: each
 * column gets its longest word, and the rest goes by the line most of its
 * rows fit on (one very long cell wraps rather than widening its column).
 * Below the sum of the longest words the table scrolls in its box instead,
 * as it does on a phone.
 *
 * The lengths are counted in characters and turned into em with an average
 * letter width; they are estimates, not measurements, so a column is never
 * made narrower than its header or the longest word in nearly all its rows.
 */
import type { TableColumn, TableRow } from './table-definition.ts';

/** A table with this many rows or more gets steady widths; a shorter one arrives at once, and sizes itself as before. */
export const steadyRowCount = 50;

/** An average letter of the table's text, in em. */
const letter = 0.5;
/** A header letter, which is bold. */
const headerLetter = 0.56;
/** A cell's padding, left and right, in em of the table's text. */
const padding = 1.6;
/** The sort arrow beside a header, with its gap. */
const sortIcon = 1.4;
/** The funnel beside a filterable header, with its gap. */
const filterIcon = 1.8;
/** A cell drawn by the page (badges, buttons) is wider than its text: an icon and a border. */
const drawnExtra = 2.6;
/** The space between two badges in a cell, in em. */
const badgeGap = 0.4;
/** A word longer than this many letters is broken, so it counts no further. */
const wrapAt = 34;
/** A line longer than this many letters wraps on any screen, so it counts no further. */
const longestLine = 120;
/** A column is never narrower than the longest word in this share of its rows. */
const wordShare = 0.95;
/** The longest words are estimates, a little long for most text, so the table may go this much narrower than their sum before it scrolls. */
const leastShare = 0.85;
/** The table's usual width, in em of its text: the main column on a desktop. The widths are worked out for it, as the browser would, and scale with the table. */
const usualWidth = 64;
/** A column is as wide as the line most of its rows fit on: one long cell wraps rather than widening the whole column. */
const fitShare = 0.9;

export interface SteadyWidths {
	/** Each column's share of the table's width, in percent, in the order given. */
	shares: number[];
	/** The narrowest the table can be, in em, before it scrolls in its box: every header fits, and the columns are close to their longest words. */
	least: number;
}

function longestWord(text: string): number {
	let longest = 0;
	for (const word of text.split(/\s+/)) longest = Math.max(longest, word.length);
	return longest;
}

/** The value that this share of the values are no greater than: the 90th percentile for 0.9. */
function mostOf(values: number[], share: number): number {
	if (values.length === 0) return 0;
	const sorted = [...values].sort((a, b) => a - b);
	return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * share))];
}

/** The share and least width of each column, from its header and every row's text. */
export function steadyColumns(columns: TableColumn[], rows: TableRow[], filtered: ReadonlySet<string> = new Set()): SteadyWidths {
	const ideal: number[] = [];
	const floor: number[] = [];
	const headerFloors: number[] = [];
	for (const column of columns) {
		const header = column.hiddenHeader ? '' : column.header;
		const icons = (column.sortable ? sortIcon : 0) + (filtered.has(column.key) ? filterIcon : 0);
		const headerFloor = longestWord(header) * headerLetter + icons + padding;
		const headerIdeal = Math.min(header.length, wrapAt) * headerLetter + icons + padding;
		// Each row's line and longest unbreakable piece, in em.
		const lines: number[] = [];
		const words: number[] = [];
		for (const row of rows) {
			const cell = row.cells[column.key];
			if (!cell) continue;
			if (column.custom && cell.values && cell.values.length > 0) {
				// A cell the page draws as badges, one for each value; they wrap, so a column wide enough for two side by side is wide enough.
				const badges = cell.values.map((value) => value.length * letter + drawnExtra).sort((a, b) => b - a);
				lines.push(badges.length > 1 ? badges[0] + badges[1] + badgeGap : badges[0]);
				words.push(badges[0]);
				continue;
			}
			const extra = column.custom ? drawnExtra : 0;
			lines.push(Math.min(cell.text.length, longestLine) * letter + extra);
			// A number never wraps.
			words.push(Math.min(column.type === 'number' ? cell.text.length : longestWord(cell.text), wrapAt) * letter + extra);
		}
		const contentIdeal = mostOf(lines, fitShare) + padding;
		// A rare very long word, such as a docket number, breaks rather than widening the column (overflow-wrap in global.css).
		const contentFloor = mostOf(words, wordShare) + padding;
		headerFloors.push(headerFloor);
		floor.push(Math.max(headerFloor, contentFloor));
		ideal.push(Math.max(headerIdeal, contentIdeal, headerFloor, contentFloor));
	}
	// As a browser does with automatic widths (CSS Tables 3, "distributing width to columns"): every column gets its least width, and the rest of the table goes to the columns in proportion to how much more they would take.
	const least = floor.reduce((sum, width) => sum + width, 0);
	const wanted = ideal.reduce((sum, width) => sum + width, 0);
	const room = Math.max(usualWidth, least);
	const widths =
		wanted <= room
			? ideal.map((width) => width * (room / (wanted || 1)))
			: ideal.map((width, index) => floor[index] + ((room - least) * (width - floor[index])) / (wanted - least || 1));
	const shares = widths.map((width) => Math.round((width / room) * 1000) / 10);
	// The table is never so narrow that a header's sort arrow and funnel no longer fit beside its longest word, where the edge to resize the column would cover the funnel.
	const headersFit = Math.max(0, ...headerFloors.map((width, index) => (width * 100) / (shares[index] || 1)));
	return {
		shares,
		least: Math.round(Math.max(least * leastShare, headersFit) * 10) / 10
	};
}
