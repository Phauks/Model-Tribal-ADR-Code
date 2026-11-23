/**
 * One status line for every page about a nation: its own page and its
 * stories. A short badge says where the page stands, a clock while the nation
 * has not taken it up and a check once it has, and the working links follow
 * it. There is no notice under it: the links already say what a reader can
 * do (Trevor, Nov. 23, 2026). The badge is drawn by
 * src/lib/components/ReviewStatus.svelte and, for a claimed nation page, by
 * the Worker (src/lib/server/nation-page-overlay.ts).
 */

export interface ReviewStatus {
	/** The badge's words, such as "Unclaimed". */
	label: string;
	/** Whether the nation has taken the page up: a check, not a clock. */
	verified: boolean;
}

/** A nation's page until people the nation chose keep it. */
export const unclaimedPage: ReviewStatus = { label: 'Unclaimed', verified: false };

/** A nation's page once people the nation chose keep it. */
export const claimedPage: ReviewStatus = { label: 'Claimed by the nation', verified: true };

/** A story's status, from its record's review_status (schemas/common.schema.json, reviewStatus). */
export function storyReviewStatus(reviewStatus: string | undefined): ReviewStatus {
	if (reviewStatus === 'approved-by-nation') return { label: 'Approved by the nation', verified: true };
	if (reviewStatus === 'reviewed-by-nation') return { label: 'Reviewed by the nation', verified: true };
	return { label: 'Unreviewed', verified: false };
}
