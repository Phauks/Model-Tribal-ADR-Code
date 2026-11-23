/**
 * What the "Hide part of this change" dialog on a change's page needs
 * (src/routes/changes/[id]/+page.svelte): the change with nothing taken out,
 * what is hidden now, and the open requests it may answer. The dialog posts
 * to this route's page, /workspace/changes/<change>, which also works by
 * itself without scripts. The lead author only.
 */
import { error, json } from '@sveltejs/kit';
import { can } from '#lib/permissions.ts';
import { changeForHiding, requestsToAnswer } from '#lib/server/page-history.ts';
import { builtPages } from '#lib/server/page-history-run.ts';
import { requirePersonForData, storage } from '#lib/server/workspace.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

export const GET: RequestHandler = async (event) => {
	const person = requirePersonForData(event);
	if (!can(person, 'hide-changes')) error(403, 'Only the lead author can hide changes.');
	const { database } = storage(event);
	const found = await changeForHiding(database, event.params.id, await builtPages());
	if (!found) error(404, 'No change has this address.');
	return json({ ...found, requests: await requestsToAnswer(database) }, { headers: { 'Cache-Control': 'private, no-store' } });
};
