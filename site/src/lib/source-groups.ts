/**
 * Folds a long Sources list into groups that follow the page (Trevor chose
 * this on Nov. 23, 2026, from mockups of a shorter Sources list). Each source
 * goes under the part of the page that first cites it, such as "Courts and
 * dispute resolution" (SourceUses.part(), src/lib/server/source-uses.ts).
 * Each group shows how many sources it holds and their numbers, and starts
 * folded. Within a group that covers several documents, such as two gaming
 * compacts, a small label names each document before its sources.
 *
 * A short list, or one whose sources all sit in one part, stays a single list:
 * folding it would only add a step.
 */
import type { SourceEntry } from './server/source-uses.ts';

/** Lists of this many sources or fewer are not folded into groups. */
export const groupingThreshold = 8;

/** Sources under one document or heading within a group. */
export interface SourceSubgroup {
	/** The document or heading, or undefined when the group has no labels within it. */
	label?: string;
	sources: SourceEntry[];
}

export interface SourceGroup {
	/** The part of the page, such as "Laws and agreements". */
	part: string;
	/** The group's source numbers as ranges, such as [[15, 26]] or [[1, 4], [9, 9]]. */
	ranges: [number, number][];
	subgroups: SourceSubgroup[];
	sources: SourceEntry[];
}

/** Consecutive numbers joined into ranges: 1, 2, 3, 9 gives [[1, 3], [9, 9]]. */
export function numberRanges(numbers: number[]): [number, number][] {
	const ranges: [number, number][] = [];
	for (const number of [...numbers].sort((a, b) => a - b)) {
		const last = ranges.at(-1);
		if (last && number === last[1] + 1) last[1] = number;
		else ranges.push([number, number]);
	}
	return ranges;
}

/** Ranges as text, with an en dash, as "1–4, 9". */
export function rangesText(ranges: [number, number][], dash = '–'): string {
	return ranges.map(([first, last]) => (first === last ? `${first}` : `${first}${dash}${last}`)).join(', ');
}

/**
 * The groups a Sources list folds into, in the order the page first cites
 * them, or undefined when the list should stay one list: it has no more than
 * groupingThreshold sources, or fewer than two parts. A source with no part
 * goes under "Other".
 */
export function sourceGroups(sources: SourceEntry[]): SourceGroup[] | undefined {
	if (sources.length <= groupingThreshold) return undefined;
	const byPart = new Map<string, SourceEntry[]>();
	for (const source of sources) {
		const part = source.part ?? 'Other';
		byPart.set(part, [...(byPart.get(part) ?? []), source]);
	}
	if (byPart.size < 2) return undefined;
	return [...byPart].map(([part, members]) => {
		const labels = new Set(members.map((source) => source.subpart));
		// Labels inside a group only help when they tell several documents apart.
		const labelled = labels.size > 1;
		const subgroups: SourceSubgroup[] = [];
		for (const source of members) {
			const label = labelled ? source.subpart : undefined;
			const last = subgroups.at(-1);
			if (last && last.label === label) last.sources.push(source);
			else subgroups.push({ label, sources: [source] });
		}
		return {
			part,
			ranges: numberRanges(members.map((source) => source.number)),
			subgroups,
			sources: members
		};
	});
}
