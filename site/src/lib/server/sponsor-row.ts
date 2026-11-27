/**
 * The rolling row of sponsors on the home page (docs/sponsorship.md, "The home
 * page row"). Trevor asked for it on Nov. 27, 2026 and chose that Patrons
 * appear by name and Benefactors by logo. Being in the row shows a sponsor
 * gives at least a Patron's amount, so a sponsor reaches it by level only if
 * their managers choose it. The lead author can also place any sponsor shown
 * in public there, or keep one off it. Amounts and levels are never sent.
 */
import type { D1Database } from '@cloudflare/workers-types/index.ts';
import { levelFor, levels, type Level, type LevelAmounts } from '#lib/sponsorship-levels.ts';
import { levelAmounts } from './sponsorship-levels.ts';
import { logosReady, publicStatus, sponsorFrom, type GiftMode, type Sponsor, type SponsorRow } from './sponsors.ts';

/** One tile in the row: the sponsor's name, and whether their logo shows in its place. */
export interface RowTile {
	name: string;
	/** Their own page is /sponsors/<slug>, and their logo /sponsors/<slug>/logo. */
	slug: string;
	logo: boolean;
}

const day = 24 * 60 * 60 * 1000;
/** A monthly gift still running has had an invoice paid within 35 days, as for the monthly total (src/lib/server/sponsorship-goals.ts). */
const monthlyWindowDays = 35;
/** A yearly gift still running has had an invoice paid within a year and the same 35 days' grace. */
const yearlyWindowDays = 365 + monthlyWindowDays;

export interface RecentGift {
	kind: 'one-time' | 'monthly' | 'yearly';
	amountCents: number;
	receivedAt: string;
}

/**
 * The level a sponsor gives at now: the higher of their latest monthly gift
 * within 35 days and their latest yearly gift within a year and 35 days.
 * One-time gifts reach no level (docs/sponsorship.md, "Levels").
 */
export function currentLevel(gifts: readonly RecentGift[], amounts: LevelAmounts, at = new Date()): Level | null {
	let reached: Level | null = null;
	for (const [kind, windowDays] of [
		['monthly', monthlyWindowDays],
		['yearly', yearlyWindowDays]
	] as const) {
		const since = new Date(at.getTime() - windowDays * day).toISOString();
		const latest = gifts
			.filter((gift) => gift.kind === kind && gift.receivedAt >= since)
			.sort((one, other) => other.receivedAt.localeCompare(one.receivedAt))[0];
		if (!latest) continue;
		const level = levelFor(amounts, latest.amountCents, kind);
		if (level && (!reached || levels.indexOf(level) > levels.indexOf(reached))) reached = level;
	}
	return reached;
}

/**
 * Where one sponsor stands in the row, or null if they are not in it. Only
 * sponsors shown in public by name can be in it; anonymous and unlisted ones
 * never are. A logo shows only if the sponsor's listing includes it and the
 * virus check has passed.
 */
export function rowTile(sponsor: Sponsor, hasGift: boolean, level: Level | null, logoReady: boolean): RowTile | null {
	if (!publicStatus(sponsor, hasGift).shown) return null;
	if (sponsor.listing !== 'name' && sponsor.listing !== 'name-logo-link') return null;
	if (sponsor.homeRowPlacement === 'never') return null;
	const canShowLogo = sponsor.listing === 'name-logo-link' && Boolean(sponsor.logoKey) && logoReady;
	if (sponsor.homeRowPlacement === 'always') return { name: sponsor.name, slug: sponsor.slug, logo: canShowLogo };
	if (!sponsor.homeRowChosen) return null;
	if (level === 'benefactor') return { name: sponsor.name, slug: sponsor.slug, logo: canShowLogo };
	if (level === 'patron') return { name: sponsor.name, slug: sponsor.slug, logo: false };
	return null;
}

/**
 * Every sponsor in the home page row, counting gifts in the mode the public
 * pages use, the longest-standing first, so logos and names mix as in the
 * approved mockup.
 */
export async function homeRow(database: D1Database, mode: GiftMode, at = new Date()): Promise<RowTile[]> {
	const { results } = await database
		.prepare(
			`SELECT sponsors.*, MIN(sponsor_gifts.received_at) AS since FROM sponsors
			 JOIN sponsor_gifts ON sponsor_gifts.sponsor_identifier = sponsors.identifier AND sponsor_gifts.mode = ?
			 WHERE sponsors.hidden_by_project = 0 AND sponsors.listing IN ('name', 'name-logo-link') AND sponsors.home_row_placement != 'never'
			   AND (sponsors.home_row_placement = 'always' OR sponsors.home_row_chosen = 1)
			 GROUP BY sponsors.identifier
			 ORDER BY since`
		)
		.bind(mode)
		.all<SponsorRow & { since: string }>();
	if (results.length === 0) return [];
	const sponsors = results.map(sponsorFrom);
	const yearAgo = new Date(at.getTime() - yearlyWindowDays * day).toISOString();
	const [amounts, ready, recent] = await Promise.all([
		levelAmounts(database),
		logosReady(database, sponsors),
		database
			.prepare(
				`SELECT sponsor_identifier AS sponsor, kind, amount_cents AS amountCents, received_at AS receivedAt FROM sponsor_gifts
				 WHERE mode = ? AND kind IN ('monthly', 'yearly') AND received_at >= ?`
			)
			.bind(mode, yearAgo)
			.all<RecentGift & { sponsor: string }>()
	]);
	const tiles = sponsors
		.map((sponsor) => {
			const gifts = recent.results.filter((gift) => gift.sponsor === sponsor.identifier);
			const logoReady = Boolean(sponsor.logoKey && ready.has(sponsor.logoKey));
			return rowTile(sponsor, true, currentLevel(gifts, amounts, at), logoReady);
		})
		.filter((tile): tile is RowTile => tile !== null);
	return tiles;
}
