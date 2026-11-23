/**
 * The signed-in person's own place on one nation's team, if they have one,
 * so the nation's page can show them "You can edit this page" and Edit links
 * (design/nation-editors, screen 2). Nation pages are built ahead of time and
 * the same for every reader, so the page asks for this after it loads. It
 * names only the person's own level and parts; every edit page checks the
 * place again.
 */
import { json } from '@sveltejs/kit';
import { reviewSubjects } from 'virtual:review-subjects';
import { displayName } from '#lib/nation-labels.ts';
import { placesOf } from '#lib/server/nation-teams.ts';
import { workerEnvironment } from '#lib/server/environment.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

export const GET: RequestHandler = async ({ locals, url }) => {
	const headers = { 'Cache-Control': 'private, no-store' };
	const nation = reviewSubjects.find((subject) => subject.kind === 'nation' && subject.identifier === url.searchParams.get('nation'));
	const database = workerEnvironment().database;
	if (!nation || !locals.person || !database) return json({ place: null }, { headers });
	const place = (await placesOf(database, locals.person.identifier)).find((found) => found.nationIdentifier === nation.identifier);
	return json(
		{ place: place ? { nation: displayName(nation.title), level: place.level, parts: place.parts } : null },
		{ headers }
	);
};
