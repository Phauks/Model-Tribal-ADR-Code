/**
 * The Land Buy-Back Program for Tribal Nations' results for the nation's
 * land, for Key facts (Trevor, Nov. 27, 2026: spike 4 of
 * research/analyses/2026-11-27-appeals-audio-land-spectrum-films.md).
 *
 * research/land-buy-back/locations.csv (scripts/tribes/land_buy_back.py) has
 * one row for each of the Program's 53 locations, named as Interior's
 * October 2022 cumulative sales table names the nation. The amount paid,
 * fractional interests and equivalent acres are the final report's (December
 * 2023), the Program's last word; the landowners offered and who sold, the
 * amount offered, the tracts and the years of each round of offers are the
 * October 2022 table's, a month before the Program's money ran out. Six small
 * locations show only rates and acres in that table, to protect their few
 * landowners, and one row of the final report for all six together.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseCsv } from '../csv.ts';
import { repositoryRoot } from './content.ts';

export const locationsFile = 'research/land-buy-back/locations.csv';
export const finalReportSource = 'interior-land-buy-back-final-report-2023';
export const salesTableSource = 'interior-land-buy-back-cumulative-sales-2022-10-12';
/** The Program's legal basis: the Claims Resolution Act of 2010, which carried out the Cobell settlement. */
export const statuteSource = 'public-law-111-291';
export const settlementCaseSource = 'cobell-v-salazar-2012';

export type LocationRow = Record<string, string>;

let cache: Map<string, LocationRow[]> | undefined;

/** The locations of each nation, by nation id (Wind River's row is both of its nations'). */
export function locationsByNation(): Map<string, LocationRow[]> {
	if (!cache) {
		cache = new Map();
		const rows = parseCsv(readFileSync(path.join(repositoryRoot, locationsFile), 'utf8').normalize('NFC'));
		for (const row of rows) {
			for (const nation of row.nations.split(';').filter(Boolean)) {
				cache.set(nation, [...(cache.get(nation) ?? []), row]);
			}
		}
	}
	return cache;
}

const whole = (value: string | number) => Math.round(Number(value)).toLocaleString('en-US');
const dollars = (value: string | number) => `$${whole(value)}`;

/** "2017, 2020 and 2021" from the table's "2017; 2020; 2021" ("2016-2017" reads "2016–2017"). */
export function roundYears(rounds: string): string {
	const years = rounds
		.split(';')
		.map((year) => year.trim().replace('-', '–'))
		.filter(Boolean);
	if (years.length <= 1) return years.join('');
	return `${years.slice(0, -1).join(', ')} and ${years.at(-1)}`;
}

/** One line of the group, as the page shows it, before its markers. */
export interface LandLine {
	label?: string;
	text: string;
	note?: string;
	/** The sources the line's figures come from: the final report, the October 2022 table, or both. */
	from: ('final' | 'table')[];
}

/**
 * The lines for one location, in the order of the approved mockup: the
 * equivalent acres restored (the lead), then the interests bought and the
 * amount paid, each with a line under it that says more about the number
 * (Trevor, Nov. 27, 2026: every number gets a breakdown).
 */
export function landLines(row: LocationRow, sharedWith: string[] = []): LandLine[] {
	const years = roundYears(row.rounds);
	const dates = years
		? `Offers made in ${years}; the Program ended in November 2022.`
		: 'Offers made between 2012 and 2022; the Program ended in November 2022.';
	const shared = sharedWith.length > 0 ? ` For the whole reservation, which the nation shares with the ${sharedWith.join(' and the ')}.` : '';
	if (!row.paid_dollars) {
		// One of the six small locations.
		const [paid, interests, acres] = row.combined_with.split('|');
		return [
			{
				text: `${whole(row.table_equivalent_acres)} equivalent ${Number(row.table_equivalent_acres) === 1 ? 'acre' : 'acres'} restored to tribal trust`,
				note: `${dates} Interior gives no other figures for this land, to protect its few landowners.`,
				from: ['table']
			},
			{ label: 'Landowners offered who sold', text: row.landowner_rate, from: ['table'] },
			{
				label: 'Paid at six locations',
				text: dollars(paid),
				note: `Together, for ${whole(interests)} fractional interests, ${whole(acres)} equivalent acres, at Agua Caliente, Cabazon, Rincon, Stockbridge Munsee, Sycuan and Quapaw.`,
				from: ['final']
			}
		];
	}
	return [
		{ text: `${whole(row.equivalent_acres)} equivalent acres restored to tribal trust`, note: `${dates}${shared}`, from: ['final'] },
		{ label: 'Fractional interests bought', text: whole(row.fractional_interests), note: `In ${whole(row.tracts)} tracts.`, from: ['final', 'table'] },
		{
			label: 'Paid to landowners',
			text: dollars(row.paid_dollars),
			note: `To ${whole(row.landowners_sold)} of the ${whole(row.landowners_offered)} landowners offered (${row.landowner_rate}), for ${row.capture_rate} of the ${dollars(row.offered_dollars)} offered.`,
			from: ['final', 'table']
		}
	];
}
