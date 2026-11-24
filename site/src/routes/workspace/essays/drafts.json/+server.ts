/**
 * What a part's index page (?part=foundations, essays or back-matter) shows
 * the people working on its essays (EssayIndex.svelte): the essays not
 * published yet that this person can open, where each essay they can open
 * stands (a draft newer than the published version, sections in review), and
 * whether they may start a new essay there. Readers never see any of this.
 * Workspace › Essays, which listed the same, was removed (lead author,
 * Nov. 23, 2026).
 */
import { error, json } from '@sveltejs/kit';
import { atLeast } from '#lib/permissions.ts';
import { essayParts, essayPath, listEssays, startableEssayParts, type EssayPart } from '#lib/server/essays.ts';
import { canStartEssays, essayLevels } from '#lib/server/essay-workspace.ts';
import { openReviewCounts } from '#lib/server/essay-review-requests.ts';
import { requirePersonForData, storage } from '#lib/server/workspace.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

/** Where an essay stands, for its badges on the index page. */
export interface EssayStanding {
	/** A saved version newer than the published one. */
	draft: boolean;
	/** Open review requests. */
	inReview: number;
}

export const GET: RequestHandler = async (event) => {
	const person = requirePersonForData(event);
	const part = event.url.searchParams.get('part') as EssayPart | null;
	if (!part || !(essayParts as readonly string[]).includes(part)) error(400, 'Say which part.');
	const { database } = storage(event);
	const [essays, reviews, canStart, levelFor] = await Promise.all([listEssays(database), openReviewCounts(database), canStartEssays(database, person), essayLevels(database, person)]);
	const drafts = [];
	const standing: Record<string, EssayStanding> = {};
	for (const essay of essays.filter((candidate) => candidate.part === part)) {
		const level = levelFor(essay.identifier);
		if (!atLeast(level, 'comment')) continue;
		if (!essay.published) drafts.push({ identifier: essay.identifier, title: essay.title, link: essayPath(essay.identifier, essay.part), canEdit: atLeast(level, 'contribute') });
		standing[essay.identifier] = {
			draft: essay.published !== null && essay.latestVersion !== null && essay.latestVersion > essay.published.versionNumber,
			inReview: reviews.get(essay.identifier) ?? 0
		};
	}
	return json(
		{ drafts, standing, canStart: canStart && startableEssayParts.includes(part) },
		{ headers: { 'Cache-Control': 'private, no-store' } }
	);
};
