/**
 * What the Sponsorship page shows about each thing a gift can fund
 * (docs/sponsorship.md, "The Sponsorship page"): its cost, which the lead
 * author sets on the workspace Sponsors page once it is known, and how much
 * of it gifts have paid. Only totals across every sponsor are used; no
 * sponsor's own amount is ever shown.
 */
import type { D1Database } from '@cloudflare/workers-types/index.ts';
import { costedEarmarks, earmarkCostUnits, earmarks, isEarmark, type CostedEarmark, type Earmark } from '#lib/sponsorship.ts';
import { now } from './identifiers.ts';
import type { GiftMode } from './sponsors.ts';

/** Counts taken when the site is built (vite.config.ts, "virtual:sponsorship-counts"). */
export interface SponsorshipCounts {
	/** Native nations with a page on the site. */
	nationPages: number;
	/** The nations the printed-copy goal counts: one copy for each federally recognized nation. */
	federallyRecognized: number;
	/** Source records in the repository. */
	sources: number;
}

/** Each cost the lead author has set, in cents. A cost not set is left out. */
export type SponsorshipCosts = Partial<Record<CostedEarmark, number>>;

export async function sponsorshipCosts(database: D1Database): Promise<SponsorshipCosts> {
	const { results } = await database
		.prepare('SELECT earmark, cost_cents AS cents FROM sponsorship_costs WHERE cost_cents IS NOT NULL')
		.all<{ earmark: string; cents: number }>();
	const costs: SponsorshipCosts = {};
	for (const row of results) {
		if ((costedEarmarks as readonly string[]).includes(row.earmark)) costs[row.earmark as CostedEarmark] = row.cents;
	}
	return costs;
}

/** Sets every cost at once, from the workspace form; null takes a cost off the page. */
export async function saveSponsorshipCosts(
	database: D1Database,
	costs: Record<CostedEarmark, number | null>,
	by: string,
	at = now()
): Promise<void> {
	await database.batch(
		costedEarmarks.map((earmark) =>
			database
				.prepare(
					`INSERT INTO sponsorship_costs (earmark, cost_cents, updated_at, updated_by) VALUES (?, ?, ?, ?)
					 ON CONFLICT (earmark) DO UPDATE SET cost_cents = excluded.cost_cents, updated_at = excluded.updated_at, updated_by = excluded.updated_by`
				)
				.bind(earmark, costs[earmark], at, by)
		)
	);
}

/** Cents given toward each purpose, ever, and toward the site in the last year. */
export interface GivenToward {
	total: Record<Earmark, number>;
	siteLastYear: number;
}

export async function givenToward(database: D1Database, mode: GiftMode, at = new Date()): Promise<GivenToward> {
	const yearAgo = new Date(at.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString();
	const [byEarmark, site] = await Promise.all([
		database
			.prepare('SELECT earmark, SUM(amount_cents) AS cents FROM sponsor_gifts WHERE mode = ? GROUP BY earmark')
			.bind(mode)
			.all<{ earmark: string; cents: number }>(),
		database
			.prepare(`SELECT COALESCE(SUM(amount_cents), 0) AS cents FROM sponsor_gifts WHERE mode = ? AND earmark = 'hosting' AND received_at >= ?`)
			.bind(mode, yearAgo)
			.first<{ cents: number }>()
	]);
	const total = Object.fromEntries(earmarks.map((earmark) => [earmark, 0])) as Record<Earmark, number>;
	for (const row of byEarmark.results) if (isEarmark(row.earmark)) total[row.earmark] = row.cents;
	return { total, siteLastYear: site?.cents ?? 0 };
}

/** The printed-copy goal, once the cost of a copy is set. */
export interface CopyGoal {
	costCents: number;
	paid: number;
}

/** One of the other things a gift can fund. */
export interface FundingCard {
	earmark: Exclude<Earmark, 'books-for-nations'>;
	/** The cost of one copy or one year, or null when not set (or when the purpose has none). */
	costCents: number | null;
	unit: 'copy' | 'year' | null;
	/** How much of the whole is paid, from 0 to 1: this year's site, or a copy for every nation. Null with no cost. */
	share: number | null;
}

export interface SponsorshipGoals {
	nations: number;
	copies: CopyGoal | null;
	cards: FundingCard[];
}

export function sponsorshipGoals(counts: SponsorshipCounts, costs: SponsorshipCosts, given: GivenToward): SponsorshipGoals {
	const nations = counts.federallyRecognized;
	const copyCost = costs['books-for-nations'];
	const copies =
		copyCost && nations > 0
			? { costCents: copyCost, paid: Math.min(nations, Math.floor(given.total['books-for-nations'] / copyCost)) }
			: null;
	const site = costs.hosting ?? null;
	const largeFormat = costs['large-format'] ?? null;
	return {
		nations,
		copies,
		cards: [
			{
				earmark: 'hosting',
				costCents: site,
				unit: earmarkCostUnits.hosting,
				share: site ? Math.min(1, given.siteLastYear / site) : null
			},
			{
				earmark: 'large-format',
				costCents: largeFormat,
				unit: earmarkCostUnits['large-format'],
				share: largeFormat && nations > 0 ? Math.min(1, given.total['large-format'] / (largeFormat * nations)) : null
			},
			{ earmark: 'needed-most', costCents: null, unit: null, share: null }
		]
	};
}
