/**
 * What a nation's page shows above its text, for the page's Changes view
 * (src/lib/server/page-changes.ts): the nation's name, its recognition
 * badges and what each one opens, and how many court opinions its side
 * column counts. Written when the site is built, since the records are not
 * in the Worker; the view reads it through the ASSETS binding.
 */
import { error, json } from '@sveltejs/kit';
import { displayName } from '#lib/nation-labels.ts';
import type { NationHeading } from '#lib/page-history.ts';
import { recognitionBadges } from '#lib/recognition-badges.ts';
import { nations } from '#lib/server/content.ts';
import { recognitionExplanations } from '#lib/server/recognition.ts';
import { opinionsOf } from '#lib/server/tribal-court-opinions.ts';
import type { EntryGenerator, RequestHandler } from './$types';

export const prerender = true;

export const entries: EntryGenerator = () => nations().map((record) => ({ id: record.id }));

export const GET: RequestHandler = ({ params }) => {
	const record = nations().find((candidate) => candidate.id === params.id);
	if (!record) error(404, 'No nation page has this address.');
	const withdrawn = record.review?.status === 'withdrawn-at-request';
	const heading: NationHeading = {
		name: displayName(record.names.official),
		withdrawn,
		// A withdrawn page shows only its name and status, so its heading holds no more.
		badges: withdrawn ? [] : recognitionBadges(record.recognition ?? []),
		badgeExplanations: withdrawn ? {} : recognitionExplanations(record),
		opinions: withdrawn ? 0 : opinionsOf(record.id).length
	};
	return json(heading);
};
