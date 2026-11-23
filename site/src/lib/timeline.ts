/**
 * The shared timeline (site/DESIGN.md, section 6, "Timeline"). Trevor asked on
 * Nov. 23, 2026 for one consolidated timeline, better than the line of a
 * document's versions on a nation's page, used on nation pages and anywhere
 * else dates matter. Every entry is a recorded date from a record in the
 * repository: a treaty, a land base set aside, a version of a nation's law or
 * agreement, a court decision, a federal statute or order, or a count of a
 * nation's published court opinions in a year. Nothing on it is generated
 * text.
 *
 * This module holds what the browser needs as well as the build: the kinds of
 * entry, the eras, and the arithmetic that places a date on the line
 * (src/lib/components/Timeline.svelte draws it; src/lib/server/timeline.ts
 * gathers the entries). It must work in the browser and in Node (for tests).
 */
import type { CitationMark } from './citation-marks.ts';
import { readableDate } from './readable-date.ts';
import { rowsToCsv, type TableColumn, type TableRow } from './tables/table-definition.ts';

/** The rows of the timeline, top to bottom. */
export type TimelineKind = 'treaty' | 'document' | 'case' | 'opinion' | 'federal';

export const timelineKinds: { kind: TimelineKind; label: string }[] = [
	{ kind: 'treaty', label: 'Treaties and land' },
	{ kind: 'document', label: 'Laws and agreements' },
	{ kind: 'case', label: 'Court decisions' },
	{ kind: 'opinion', label: 'Tribal court opinions' },
	{ kind: 'federal', label: 'Federal law' }
];

export const kindLabels = Object.fromEntries(timelineKinds.map(({ kind, label }) => [kind, label])) as Record<TimelineKind, string>;

/** One dated record on the timeline. */
export interface TimelineEntry {
	/** Unique on the page; the entry's list row has the id `timeline-<id>`. */
	id: string;
	kind: TimelineKind;
	/** YYYY, YYYY-MM or YYYY-MM-DD, as the record gives it. */
	date: string;
	title: string;
	/** A case name, set in italics (Indigo Book R10.1). */
	italic?: boolean;
	/** The citation after the title, such as "358 U.S. 217 (1959)" or "68 Fed. Reg. 5912 (Feb. 5, 2003)". */
	citation?: string;
	/** A short line under the entry, such as the court or "In effect". */
	detail?: string;
	/** The record: the opinion, the statute, the document's text or the nation's page. */
	link?: string;
	/** The nations the record is about, by id (the full timeline names them). */
	nations?: string[];
	/** A federal law that applies to every nation, shown for context on a nation's timeline. */
	context?: boolean;
	/** The markers of the entry's sources on a page with a References list. */
	citations?: CitationMark[];
}

/** How many of a nation's published court opinions were decided in one year. */
export interface OpinionYear {
	year: number;
	count: number;
	/** How many of them mention peacemaking. */
	peacemaking: number;
	/** The nation, on the full timeline. */
	nation?: string;
}

/**
 * The eras of federal Indian policy, named and bounded as the legal history
 * timeline in Foundations sets them out (content/essays/i-legal-history-timeline.md,
 * "Eras and Where the Boundaries Come From"): the National Congress of American
 * Indians' period names, with boundaries the essay moves so related laws sit
 * together. The essay calls the boundaries editorial choices, not legal facts.
 * Removal (1830 to about 1850) overlaps the treaty era, so it is not a band of
 * its own. `end` is the first year of the next era.
 */
export interface Era {
	name: string;
	start: number;
	end: number;
	/** The years as the essay's heading gives them. */
	years: string;
	/** The era's heading in the legal history essay. */
	anchor: string;
}

export const eras: Era[] = [
	{ name: 'Treaty era', start: 1492, end: 1871, years: '1492 to 1871', anchor: 'treaty-era-1492-to-1871' },
	{ name: 'Reservations and allotment', start: 1871, end: 1934, years: '1871 to 1934', anchor: 'reservations-and-allotment-1871-to-1934' },
	{ name: 'Reorganization', start: 1934, end: 1946, years: '1934 to 1946', anchor: 'reorganization-1934-to-1946' },
	{ name: 'Termination', start: 1946, end: 1968, years: '1946 to 1968', anchor: 'termination-1946-to-1968' },
	{ name: 'Self-determination', start: 1968, end: 1988, years: '1968 to 1987', anchor: 'self-determination-1968-to-1987' },
	{ name: 'Modern era', start: 1988, end: 10000, years: '1988 to the present', anchor: 'modern-era-1988-to-the-present' }
];

/** The legal history essay, whose era headings the timeline links to once it is published. */
export const historyEssayPath = '/foundations/legal-history-timeline';

/** The era a year falls in. */
export function eraOf(year: number): Era {
	return eras.find((era) => year >= era.start && year < era.end) ?? eras[0];
}

const datePattern = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/;

/** Whether a record's date can go on the timeline: YYYY, YYYY-MM or YYYY-MM-DD. */
export function isTimelineDate(date: unknown): date is string {
	return typeof date === 'string' && datePattern.test(date);
}

/**
 * A date as a year with a fraction, so 2021-07-01 sits halfway through 2021.
 * A year alone sits in the middle of its year, and a month alone in the
 * middle of its month, so neither looks more exact than the record is.
 */
export function yearOf(date: string): number {
	const match = datePattern.exec(date);
	if (!match) return Number.NaN;
	const year = Number(match[1]);
	if (!match[2]) return year + 0.5;
	const month = Number(match[2]) - 1;
	if (!match[3]) return year + (month + 0.5) / 12;
	return year + month / 12 + (Number(match[3]) - 1) / 365;
}

/** Whether the record gives only a year or a month, which the timeline draws as a dashed ring. */
export function isPartialDate(date: string): boolean {
	return date.length < 10;
}

/** A date in the style guide's form: "June 1, 1868", "Jan. 2007" or "1997". */
export function timelineDate(date: string): string {
	return readableDate(date);
}

/** Entries in date order, oldest first; on the same day, in the order of the rows. */
export function byDate(first: TimelineEntry, second: TimelineEntry): number {
	const order = (kind: TimelineKind) => timelineKinds.findIndex((entry) => entry.kind === kind);
	return yearOf(first.date) - yearOf(second.date) || order(first.kind) - order(second.kind) || first.title.localeCompare(second.title, 'en');
}

/** The span of years a set of entries and opinion counts covers, widened a little so the ends are not on the edge. */
export function extentOf(entries: TimelineEntry[], opinions: OpinionYear[] = []): { from: number; to: number } {
	const years = [...entries.map((entry) => yearOf(entry.date)), ...opinions.flatMap((year) => [year.year, year.year + 1])].filter(
		(year) => Number.isFinite(year)
	);
	if (years.length === 0) return { from: 1900, to: 2030 };
	const first = Math.min(...years);
	const last = Math.max(...years);
	const pad = Math.max(2, (last - first) * 0.03);
	return { from: Math.floor(first - pad), to: Math.ceil(last + pad) };
}

/** A view of the timeline: the years shown. */
export interface TimelineRange {
	from: number;
	to: number;
}

/** The narrowest view the zoom buttons reach, in years. */
export const narrowestSpan = 4;

/** The view zoomed in or out by a factor around its middle, kept inside the full extent. */
export function zoomRange(range: TimelineRange, factor: number, extent: TimelineRange): TimelineRange {
	const middle = (range.from + range.to) / 2;
	const fullSpan = extent.to - extent.from;
	const span = Math.min(fullSpan, Math.max(narrowestSpan, (range.to - range.from) * factor));
	return clampRange({ from: middle - span / 2, to: middle + span / 2 }, extent);
}

/** The view moved so it stays inside the full extent, keeping its width. */
export function clampRange(range: TimelineRange, extent: TimelineRange): TimelineRange {
	const span = Math.min(range.to - range.from, extent.to - extent.from);
	let from = Math.max(extent.from, range.from);
	if (from + span > extent.to) from = extent.to - span;
	return { from, to: from + span };
}

/** Whether a year falls in the view. */
export function inRange(year: number, range: TimelineRange): boolean {
	return year >= range.from && year <= range.to;
}

/** Round, readable years for the axis: about `count` of them, on 1, 2, 5, 10, 20, 25, 50 or 100 year steps. */
export function axisYears(range: TimelineRange, count = 8): number[] {
	const span = range.to - range.from;
	const steps = [1, 2, 5, 10, 20, 25, 50, 100];
	const step = steps.find((candidate) => span / candidate <= count) ?? 100;
	const years: number[] = [];
	for (let year = Math.ceil(range.from / step) * step; year <= range.to; year += step) years.push(year);
	return years;
}

/** The width of the bars that count records, in years: one year in a close view, five or ten in a wide one. */
export function barYears(range: TimelineRange): number {
	const span = range.to - range.from;
	return span <= 40 ? 1 : span <= 120 ? 5 : 10;
}

/** Counts grouped into bars of `width` years, by the bar's first year. */
export function countsByBar(points: { year: number; count: number; peacemaking?: number }[], width: number): Map<number, { count: number; peacemaking: number }> {
	const bars = new Map<number, { count: number; peacemaking: number }>();
	for (const point of points) {
		const start = Math.floor(point.year / width) * width;
		const bar = bars.get(start) ?? { count: 0, peacemaking: 0 };
		bar.count += point.count;
		bar.peacemaking += point.peacemaking ?? 0;
		bars.set(start, bar);
	}
	return bars;
}

/** A row with more marks than this in the view is drawn as bars that count them. */
export const mostMarks = 60;

/** The citation a reader copies from an entry: its title, then its citation. */
export function entryCitation(entry: TimelineEntry): string {
	return [entry.title, entry.citation].filter(Boolean).join(', ');
}

/** One row of the timeline downloads. */
export interface TimelineRow {
	date: string;
	kind: string;
	title: string;
	citation: string;
	detail: string;
	nations: string;
	link: string;
}

/**
 * The entries and the opinion counts as rows of a table, oldest first, for
 * the CSV and JSON downloads. A year of opinions is one row. Addresses on
 * this site are written from `origin`, since the files are built before the
 * site has a domain.
 */
export function timelineRows(
	entries: TimelineEntry[],
	opinions: OpinionYear[] = [],
	nationNames: Record<string, string> = {},
	origin = ''
): TimelineRow[] {
	const names = (ids: string[] | undefined) => (ids ?? []).map((id) => nationNames[id] ?? id).join('; ');
	const address = (link: string | undefined) => (link?.startsWith('/') ? `${origin}${link}` : (link ?? ''));
	const rows = [...entries].sort(byDate).map((entry) => ({
		date: entry.date,
		kind: kindLabels[entry.kind],
		title: entry.title,
		citation: entry.citation ?? '',
		detail: entry.detail ?? (entry.context ? 'Applies to every nation' : ''),
		nations: names(entry.nations),
		link: address(entry.link)
	}));
	const counted = opinions.map((year) => ({
		date: String(year.year),
		kind: kindLabels.opinion,
		title: `${year.count} published ${year.count === 1 ? 'opinion' : 'opinions'}`,
		citation: '',
		detail: year.peacemaking > 0 ? `${year.peacemaking} ${year.peacemaking === 1 ? 'mentions' : 'mention'} peacemaking` : '',
		nations: names(year.nation ? [year.nation] : undefined),
		link: year.nation ? address(`/nations/${year.nation}/opinions`) : ''
	}));
	return [...rows, ...counted].sort((first, second) => yearOf(first.date) - yearOf(second.date));
}

const csvColumns: TableColumn[] = [
	{ key: 'date', header: 'Date' },
	{ key: 'kind', header: 'Kind' },
	{ key: 'title', header: 'Title' },
	{ key: 'citation', header: 'Citation' },
	{ key: 'detail', header: 'Detail' },
	{ key: 'nations', header: 'Nations' }
];

/** The rows as CSV, with the title's link in a column of its own (src/lib/tables/table-definition.ts). */
export function timelineCsv(rows: TimelineRow[]): string {
	const tableRows: TableRow[] = rows.map((row, index) => ({
		key: String(index),
		cells: {
			date: { text: row.date },
			kind: { text: row.kind },
			title: { text: row.title, href: row.link || undefined },
			citation: { text: row.citation },
			detail: { text: row.detail },
			nations: { text: row.nations }
		}
	}));
	return rowsToCsv(csvColumns, tableRows);
}
