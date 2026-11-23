/**
 * The rules for the project's review of what nations publish on their own
 * pages (decision record 0041, "Stage 3"). A nation's change goes live without
 * waiting for the project; the project reads it afterwards, within seven
 * days. The storage is in src/lib/server/nation-page-review.ts.
 */
import type { ChangeKind } from './nation-page-changes.ts';

/** Days the project gives itself to read a nation's published change. */
export const reviewDays = 7;

export const reviewOutcomes = ['read', 'undone'] as const;
export type ReviewOutcome = (typeof reviewOutcomes)[number];

export const reviewOutcomeLabels: Record<ReviewOutcome, string> = {
	read: 'Read, left as it is',
	undone: 'Undone by the project'
};

/** The longest question or answer about a pause. */
export const longestPauseText = 2000;

const day = 24 * 60 * 60 * 1000;

/** When the project should have read a change published at this time. */
export function reviewDue(publishedAt: string): string {
	return new Date(new Date(publishedAt).getTime() + reviewDays * day).toISOString();
}

export function isOverdue(publishedAt: string, time: Date = new Date()): boolean {
	return reviewDue(publishedAt) <= time.toISOString();
}

/**
 * Why a team cannot publish this part while the project has paused its
 * publishing, or undefined. Hiding stays open, so a nation can always take
 * something off its page at once.
 */
export function pauseProblem(paused: boolean, kind: ChangeKind): string | undefined {
	if (!paused || kind === 'hidden') return undefined;
	return 'The project has paused publishing for this page while it asks your team a question. You can still save drafts and hide parts of the page.';
}
