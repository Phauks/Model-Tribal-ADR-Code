/**
 * Lists the pages built with the site that readers can follow, with a
 * fingerprint of what each shows readers (src/lib/server/following.ts). Runs
 * in Node when the site is built (vite.config.ts, "followable-pages").
 *
 * A nation page's fingerprint covers its published record, as its JSON
 * download gives it (only the name and status for a page withdrawn at the
 * nation's request), and the version histories of its documents. Changes to
 * the site's design or wording elsewhere do not change it, so they are not
 * reported as updates. The model code joins the list once its pages are
 * built.
 */
import { createHash } from 'node:crypto';
import { displayName } from '#lib/nation-labels.ts';
import type { FollowableBuild, FollowablePage } from './following.ts';
import { documentHistories, nations, type NationRecord } from './content.ts';

/** Raise this when the fingerprints below are worked out differently. */
export const fingerprintVersion = 1;

function hash(value: unknown): string {
	return createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 32);
}

/** What a nation's page shows, as its record download gives it. */
export function shownRecord(record: NationRecord): unknown {
	const withdrawn = record.review?.status === 'withdrawn-at-request';
	return withdrawn ? { id: record.id, names: { official: record.names.official }, review: record.review } : record;
}

export function nationPages(): FollowablePage[] {
	const histories = documentHistories();
	return nations().map((record) => ({
		address: `/nations/${record.id}`,
		kind: 'nation' as const,
		title: displayName(record.names.official),
		fingerprint: hash({
			record: shownRecord(record),
			documents: histories.filter((history) => history.nations?.includes(record.id))
		})
	}));
}

export function followableBuild(builtAt = new Date()): FollowableBuild {
	const pages = nationPages();
	return {
		builtAt: builtAt.toISOString(),
		buildHash: hash(pages.map((page) => [page.address, page.fingerprint])),
		fingerprintVersion,
		pages
	};
}
