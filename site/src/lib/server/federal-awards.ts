/**
 * The federal awards to each nation's government in the latest complete
 * fiscal year, for the "Federal awards" group in Key facts (Trevor asked for
 * federal awards on Nov. 27, 2026, and chose mockup A, the government only,
 * broken down by agency; project files design/federal-awards/).
 *
 * The figures are USAspending.gov's: the amounts federal agencies obligated to
 * each recipient the nation's government reports under, on every transaction
 * in the fiscal year, as the site's own search totals them
 * (research/federal-awards/, from scripts/tribes/federal_awards.py). Health
 * boards, housing authorities, schools, businesses, consortia and other
 * separate bodies are left out, even when their names name the nation. An
 * amount can be negative where an agency took back more than it awarded in
 * the year.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseCsv } from '../csv.ts';
import { repositoryRoot } from './content.ts';

/** The fiscal year the figures cover, and how the date line under the total says it. */
export const awardsFiscalYear = 2026;
export const awardsDates = `Fiscal year ${awardsFiscalYear} (Oct. ${awardsFiscalYear - 1} to Sept. ${awardsFiscalYear})`;

/** The figures file and its References entry. */
export const awardsFile = `research/federal-awards/2026-11-27/fy${awardsFiscalYear}-by-agency.csv`;
export const awardsSource = `usaspending-fy${awardsFiscalYear}-awards-to-tribal-governments`;

/** The agencies shown one by one; the rest share one row, so the rows add up to the total. */
export const agenciesShown = 5;

export interface AgencyAmount {
	agency: string;
	amount: number;
}

export interface NationAwards {
	total: number;
	/** The recipients the nation's government reports under, by UEI number. */
	recipients: { uei: string; recipientId: string; name: string; amount: number }[];
	/** Every agency's amount to all of the nation's recipients, largest first. */
	agencies: AgencyAmount[];
}

let cache: Map<string, NationAwards> | undefined;

/** Each nation's awards, by its profile id. */
export function nationAwards(): Map<string, NationAwards> {
	if (cache) return cache;
	cache = new Map();
	const rows = parseCsv(readFileSync(path.join(repositoryRoot, awardsFile), 'utf8').normalize('NFC'));
	for (const row of rows) {
		const amount = Number(row.amount);
		if (!Number.isFinite(amount)) continue;
		let entry = cache.get(row.profile);
		if (!entry) cache.set(row.profile, (entry = { total: 0, recipients: [], agencies: [] }));
		entry.total += amount;
		let recipient = entry.recipients.find((item) => item.recipientId === row.recipient_id);
		if (!recipient) entry.recipients.push((recipient = { uei: row.uei, recipientId: row.recipient_id, name: row.recipient_name, amount: 0 }));
		recipient.amount += amount;
		const agency = entry.agencies.find((item) => item.agency === row.agency);
		if (agency) agency.amount += amount;
		else entry.agencies.push({ agency: row.agency, amount });
	}
	for (const entry of cache.values()) {
		entry.agencies.sort((a, b) => b.amount - a.amount);
		entry.recipients.sort((a, b) => b.amount - a.amount);
	}
	return cache;
}

/** An agency's name as the breakdown says it: "Interior", not "Department of the Interior". */
export function agencyName(agency: string): string {
	return agency.replace(/^Department of (the )?/, '');
}

/** An amount in dollars: "$13.8 million" from a million up, "$455,099" below, "−$216,899" when negative. */
export function dollars(amount: number): string {
	const sign = amount < 0 ? '−' : '';
	const size = Math.abs(amount);
	if (size >= 1e9) return `${sign}$${(size / 1e9).toFixed(1)} billion`;
	if (size >= 1e6) return `${sign}$${(size / 1e6).toFixed(1)} million`;
	return `${sign}$${Math.round(size).toLocaleString('en-US')}`;
}

/**
 * The breakdown rows: the largest agencies one by one, then "N other
 * agencies" with the sum of the rest, so the rows add up to the total. An
 * agency whose amount nets to nothing is not counted.
 */
export function agencyRows(agencies: AgencyAmount[]): { label: string; text: string }[] {
	const counted = agencies.filter((item) => Math.round(item.amount) !== 0);
	const shown = counted.length <= agenciesShown + 1 ? counted : counted.slice(0, agenciesShown);
	const rest = counted.slice(shown.length);
	const rows = shown.map((item) => ({ label: agencyName(item.agency), text: dollars(item.amount) }));
	if (rest.length > 0) {
		rows.push({ label: `${rest.length} other agencies`, text: dollars(rest.reduce((sum, item) => sum + item.amount, 0)) });
	}
	return rows;
}

/** The recipient's page on USAspending.gov, which lists its awards. */
export function recipientPage(recipientId: string): string {
	return `https://www.usaspending.gov/recipient/${recipientId}/latest`;
}
