/**
 * The nation restrictions' stamp (SiteRestrictions.stamp): it changes
 * whenever a nation saves its restrictions. site-restrictions.ts reads it
 * before gathering the restrictions again, and the search on the server reads
 * it in the same trip to the database as its search (search-tables.ts).
 */

/** What changes whenever a nation saves its restrictions: how many saves there are and when the newest was made. */
export const restrictionStampSql = 'SELECT COUNT(*) AS saves, MAX(made_at) AS latest FROM nation_restriction_changes';

export interface RestrictionStampRow {
	saves: number;
	latest: string | null;
}

/** The restrictions' stamp from that row (SiteRestrictions.stamp); none while no nation has saved any. */
export function restrictionStamp(row: RestrictionStampRow | null | undefined): string | undefined {
	return row && row.saves ? `${row.saves}-${row.latest ?? ''}` : undefined;
}
