/**
 * The data a bar chart draws, shared by the build and the browser
 * (BarChart.svelte). The essay editor's planned Chart block is meant to use
 * the same shape, so a chart reads the same on a data page and in an essay.
 */
import type { TableColumn, TableRow } from './tables/table-definition.ts';

export interface ChartBar {
	label: string;
	value: number;
	/** Where the bar leads, such as the filtered list of the rows it counts. */
	href?: string;
}

export interface BarChartData {
	/** Unique on the page; used for element ids and the CSV file name. */
	identifier: string;
	title: string;
	/** A sentence under the title saying what is counted. */
	description: string;
	/** Header of the label column in the table view, such as "Method". */
	labelHeader: string;
	/** Header of the number column, such as "Provisions". */
	valueHeader: string;
	/** Where the numbers come from, shown under the chart. */
	source: string;
	/** The bars, in the order drawn. */
	bars: ChartBar[];
	/** Draws only this many bars, largest first, with the rest in the table view. */
	shown?: number;
	/**
	 * True when the bars are parts of one whole, each item counted under one
	 * bar only, so the chart can also be shown as a pie (Trevor, Nov. 23,
	 * 2026). Left out where an item can count under several bars, such as a
	 * nation in several states.
	 */
	partsOfWhole?: boolean;
	/** Where the chart's table is published as a CSV file; without it the browser makes the file. */
	csvHref?: string;
}

/** The most slices a pie draws: one per color of the chart palette (chart-series-1 to 7). */
export const pieSliceLimit = 7;

export interface PieSlice {
	label: string;
	value: number;
	href?: string;
	/** Its share of the whole, from 0 to 1. */
	share: number;
	/** Where it starts and ends, in turns from the top, clockwise. */
	start: number;
	end: number;
	/** Its color: chart-series-1 to 7, in the bars' order. */
	series: number;
	/** How many bars an "Other" slice folds together; 1 for a plain slice. */
	folded: number;
}

/**
 * The bars as slices of a pie, largest first, in the chart's fixed color
 * order. Past the palette's seven colors, the smallest bars fold into one
 * "Other" slice rather than reusing a color; the table still lists each.
 */
export function pieSlices(bars: ChartBar[], limit = pieSliceLimit): PieSlice[] {
	const sorted = [...bars].filter((bar) => bar.value > 0).sort((first, second) => second.value - first.value);
	const total = sorted.reduce((sum, bar) => sum + bar.value, 0);
	if (total === 0) return [];
	const kept = sorted.length > limit ? sorted.slice(0, limit - 1) : sorted;
	const rest = sorted.slice(kept.length);
	const parts: Omit<PieSlice, 'share' | 'start' | 'end' | 'series'>[] = kept.map((bar) => ({ label: bar.label, value: bar.value, href: bar.href, folded: 1 }));
	if (rest.length > 0) parts.push({ label: `Other (${rest.length})`, value: rest.reduce((sum, bar) => sum + bar.value, 0), folded: rest.length });
	let start = 0;
	return parts.map((part, index) => {
		const share = part.value / total;
		const slice = { ...part, share, start, end: start + share, series: index + 1 };
		start += share;
		return slice;
	});
}

/** The SVG path of a slice on a circle of radius `radius` centered on (radius, radius). */
export function slicePath(slice: Pick<PieSlice, 'start' | 'end'>, radius: number): string {
	const point = (turn: number) => {
		const angle = turn * 2 * Math.PI;
		return `${(radius + radius * Math.sin(angle)).toFixed(2)} ${(radius - radius * Math.cos(angle)).toFixed(2)}`;
	};
	if (slice.end - slice.start >= 0.9999) {
		// A whole circle, drawn as two half arcs, since one arc cannot end where it starts.
		return `M ${point(0)} A ${radius} ${radius} 0 1 1 ${point(0.5)} A ${radius} ${radius} 0 1 1 ${point(0)} Z`;
	}
	const large = slice.end - slice.start > 0.5 ? 1 : 0;
	return `M ${radius} ${radius} L ${point(slice.start)} A ${radius} ${radius} 0 ${large} 1 ${point(slice.end)} Z`;
}

/** A share as a percent for people: whole numbers, with "<1%" for a sliver. */
export function shareText(share: number): string {
	if (share > 0 && share < 0.005) return '<1%';
	return `${Math.round(share * 100)}%`;
}

/**
 * The scale's top: the largest value rounded up to a step of 1, 2 or 5 times
 * a power of ten, so the gridlines fall on round numbers.
 */
export function scaleTop(largest: number): { top: number; step: number } {
	if (largest <= 0) return { top: 1, step: 1 };
	const roughStep = largest / 5;
	const power = 10 ** Math.floor(Math.log10(roughStep));
	const step = [1, 2, 5, 10].map((factor) => factor * power).find((candidate) => candidate >= roughStep) ?? 10 * power;
	return { top: Math.ceil(largest / step) * step, step };
}

/**
 * The chart as a table definition, for the table view and its CSV download. A bar's address
 * links its name; on the page the number links to it too (the column is drawn by BarChart.svelte),
 * while the CSV keeps one link column.
 */
export function chartTable(chart: BarChartData): { columns: TableColumn[]; rows: TableRow[] } {
	return {
		columns: [
			{ key: 'label', header: chart.labelHeader, isRowHeader: true, sortable: true },
			{ key: 'value', header: chart.valueHeader, type: 'number', sortable: true, custom: true }
		],
		rows: chart.bars.map((bar) => ({
			key: bar.label,
			cells: {
				label: { text: bar.label, href: bar.href },
				value: { text: bar.value.toLocaleString('en-US'), sortValue: bar.value }
			}
		}))
	};
}
