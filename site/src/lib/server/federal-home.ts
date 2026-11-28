/**
 * What the Federal Law section's own page (/laws) adds to its menu's cards
 * (Home A in picture cards, which Trevor approved on Nov. 27, 2026,
 * design/federal-navigation/mockups/home-A2-*.png): the years each group's
 * documents cover, and a chart of how many each group issued in each decade.
 * The groups are the Federal Law menu's own (src/lib/site-navigation.ts):
 * Treaties, Congress, President and Agencies, by who made the law. Worked
 * out while the site is built, from the Statistics page's registry
 * (src/lib/server/collections.ts).
 */
import type { ColumnChartData } from '../column-chart.ts';
import { navigationSections } from '../site-navigation.ts';
import { collections } from './collections.ts';

/**
 * Collections left out of the years and the decade chart: a code's sections
 * are dated by its edition, not by when each was made, and a land cession is
 * dated by the treaty already counted.
 */
const undatedByMaking = new Set(['united-states-code-sections', 'regulation-sections', 'land-cessions']);

/** Where one group's part of a decade's column leads, when a list of that decade's documents exists. */
const decadeLists: Record<string, (decade: number) => string> = {
	'executive-orders': (decade) => `/laws/executive-orders?decade=${decade}s`
};

export interface FederalHome {
	/** "1778–2026": the years the section's documents cover. */
	years?: string;
	/** Each menu group's years, by the group's name, such as "1778–1954". */
	groupYears: Record<string, string>;
	chart: ColumnChartData;
}

let worked: FederalHome | undefined;

export function federalHome(): FederalHome {
	if (worked) return worked;
	const section = navigationSections.find((candidate) => candidate.key === 'federal-law');
	const groups = section?.groups ?? [];
	const byDecade = new Map<number, Record<string, number>>();
	const links = new Map<number, Record<string, string>>();
	const groupYears: Record<string, string> = {};
	let first = Infinity;
	let last = -Infinity;
	for (const group of groups) {
		let groupFirst = Infinity;
		let groupLast = -Infinity;
		for (const link of group.links) {
			if (!link.count || undatedByMaking.has(link.count)) continue;
			const collection = collections.find((candidate) => candidate.identifier === link.count);
			for (const item of collection?.items() ?? []) {
				if (!item.year) continue;
				groupFirst = Math.min(groupFirst, item.year);
				groupLast = Math.max(groupLast, item.year);
				const decade = Math.floor(item.year / 10) * 10;
				const row = byDecade.get(decade) ?? {};
				row[group.title] = (row[group.title] ?? 0) + 1;
				byDecade.set(decade, row);
				const list = decadeLists[link.count];
				if (list) links.set(decade, { ...links.get(decade), [group.title]: list(decade) });
			}
		}
		if (Number.isFinite(groupFirst)) groupYears[group.title] = `${groupFirst}–${groupLast}`;
		first = Math.min(first, groupFirst);
		last = Math.max(last, groupLast);
	}
	const columns: ColumnChartData['columns'] = [];
	if (Number.isFinite(first)) {
		for (let decade = Math.floor(first / 10) * 10; decade <= last; decade += 10) {
			const values = Object.fromEntries(groups.map((group) => [group.title, byDecade.get(decade)?.[group.title] ?? 0]));
			columns.push({ label: `${decade}s`, axisLabel: decade % 50 === 0 ? `${decade}s` : undefined, values, links: links.get(decade) });
		}
	}
	worked = {
		years: Number.isFinite(first) ? `${first}–${last}` : undefined,
		groupYears,
		chart: {
			identifier: 'federal-law-by-decade',
			title: 'By decade',
			labelHeader: 'Decade',
			series: groups.map((group) => ({ key: group.title, label: group.title })),
			columns,
			source: 'The documents in the Federal Law collections, by the year each was made',
			sourceHref: '/stats'
		}
	};
	return worked;
}
