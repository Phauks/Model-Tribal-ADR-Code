/**
 * What the Sponsorship page shows about each thing a gift can fund
 * (docs/sponsorship.md, "The Sponsorship page"), as in mockup A, which
 * Trevor approved on Nov. 23, 2026, with the choices he named on Nov. 24:
 * a paperback for every nation (the initiative), hardcovers for every
 * nation, Accessibility Formats, Research, Digital Infrastructure (the site
 * for a year) and Discretionary.
 * Each cost is set by the lead author on the workspace Sponsors page once it
 * is known, and only totals across every sponsor are used; no sponsor's own
 * amount is ever shown.
 */
import type { D1Database } from '@cloudflare/workers-types/index.ts';
import { costItems, earmarks, isEarmark, type CostItem, type Earmark } from '#lib/sponsorship.ts';
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
export type SponsorshipCosts = Partial<Record<CostItem, number>>;

export async function sponsorshipCosts(database: D1Database): Promise<SponsorshipCosts> {
	const { results } = await database
		.prepare('SELECT item, cost_cents AS cents FROM sponsorship_costs WHERE cost_cents IS NOT NULL')
		.all<{ item: string; cents: number }>();
	const costs: SponsorshipCosts = {};
	for (const row of results) {
		if ((costItems as readonly string[]).includes(row.item)) costs[row.item as CostItem] = row.cents;
	}
	return costs;
}

/** Sets every cost at once, from the workspace form; null takes a cost off the page. */
export async function saveSponsorshipCosts(database: D1Database, costs: Record<CostItem, number | null>, by: string, at = now()): Promise<void> {
	await database.batch(
		costItems.map((item) =>
			database
				.prepare(
					`INSERT INTO sponsorship_costs (item, cost_cents, updated_at, updated_by) VALUES (?, ?, ?, ?)
					 ON CONFLICT (item) DO UPDATE SET cost_cents = excluded.cost_cents, updated_at = excluded.updated_at, updated_by = excluded.updated_by`
				)
				.bind(item, costs[item], at, by)
		)
	);
}

/** Cents given toward each purpose, ever, and toward the site in the last year. */
export interface GivenToward {
	total: Record<Earmark, number>;
	siteLastYear: number;
	/** What monthly gifts bring in each month, and how many sponsors give them. */
	monthly: { cents: number; sponsors: number };
}

/**
 * A monthly gift still running has had an invoice paid within a month; 35
 * days leaves room for the longest month and a late retry. Each sponsor
 * counts once, at their latest invoice, so a changed amount is not added
 * twice. A gift cancelled drops out a month after its last invoice.
 */
const monthlyWindowDays = 35;

export async function givenToward(database: D1Database, mode: GiftMode, at = new Date()): Promise<GivenToward> {
	const day = 24 * 60 * 60 * 1000;
	const yearAgo = new Date(at.getTime() - 365 * day).toISOString();
	const monthAgo = new Date(at.getTime() - monthlyWindowDays * day).toISOString();
	const [byEarmark, site, monthly] = await Promise.all([
		database
			.prepare('SELECT earmark, SUM(amount_cents) AS cents FROM sponsor_gifts WHERE mode = ? GROUP BY earmark')
			.bind(mode)
			.all<{ earmark: string; cents: number }>(),
		database
			.prepare(`SELECT COALESCE(SUM(amount_cents), 0) AS cents FROM sponsor_gifts WHERE mode = ? AND earmark = 'hosting' AND received_at >= ?`)
			.bind(mode, yearAgo)
			.first<{ cents: number }>(),
		database
			.prepare(
				`SELECT COUNT(*) AS sponsors, COALESCE(SUM(amount_cents), 0) AS cents FROM (
					SELECT amount_cents, ROW_NUMBER() OVER (PARTITION BY sponsor_identifier ORDER BY received_at DESC) AS latest
					FROM sponsor_gifts WHERE mode = ? AND kind = 'monthly' AND received_at >= ?
				) WHERE latest = 1`
			)
			.bind(mode, monthAgo)
			.first<{ sponsors: number; cents: number }>()
	]);
	const total = Object.fromEntries(earmarks.map((earmark) => [earmark, 0])) as Record<Earmark, number>;
	for (const row of byEarmark.results) if (isEarmark(row.earmark)) total[row.earmark] = row.cents;
	return { total, siteLastYear: site?.cents ?? 0, monthly: { cents: monthly?.cents ?? 0, sponsors: monthly?.sponsors ?? 0 } };
}

/**
 * Fewest monthly sponsors before the monthly total is shown. With fewer, the
 * total could tell anyone what one sponsor gives, and no sponsor's amount is
 * ever shown in public (docs/sponsorship.md).
 */
export const fewestMonthlySponsorsShown = 3;

/** The monthly total for the public page, or null while too few sponsors give monthly. */
export function publicMonthly(monthly: GivenToward['monthly']): GivenToward['monthly'] | null {
	return monthly.sponsors >= fewestMonthlySponsorsShown ? monthly : null;
}

/** The paperback goal, once the cost of a paperback is set. */
export interface CopyGoal {
	costCents: number;
	paid: number;
}

/** One of the cards under "More you can fund". */
export interface FundingCard {
	key: 'hardcovers' | 'accessibility' | 'research' | 'site' | 'discretionary';
	/** What a gift from this card goes toward. */
	earmark: Earmark;
	/** The figure on the card in cents (a year of the site, or hardcovers for every nation), or null when not set or when there is none. */
	costCents: number | null;
	/** How much of it gifts have paid, from 0 to 1, or null with no cost. */
	share: number | null;
}

export interface SponsorshipGoals {
	nations: number;
	copies: CopyGoal | null;
	cards: FundingCard[];
}

export function sponsorshipGoals(counts: SponsorshipCounts, costs: SponsorshipCosts, given: GivenToward): SponsorshipGoals {
	const nations = counts.federallyRecognized;
	const books = given.total['books-for-nations'];
	const paperback = costs.paperback;
	const copies = paperback && nations > 0 ? { costCents: paperback, paid: Math.min(nations, Math.floor(books / paperback)) } : null;
	const site = costs.website ?? null;
	const hardcovers = costs.hardcover && nations > 0 ? costs.hardcover * nations : null;
	return {
		nations,
		copies,
		cards: [
			// Hardcovers take the place of paperbacks, so every gift toward copies counts toward them.
			{ key: 'hardcovers', earmark: 'books-for-nations', costCents: hardcovers, share: hardcovers ? Math.min(1, books / hardcovers) : null },
			{ key: 'accessibility', earmark: 'large-format', costCents: null, share: null },
			{ key: 'research', earmark: 'research', costCents: null, share: null },
			{ key: 'site', earmark: 'hosting', costCents: site, share: site ? Math.min(1, given.siteLastYear / site) : null },
			{ key: 'discretionary', earmark: 'needed-most', costCents: null, share: null }
		]
	};
}
