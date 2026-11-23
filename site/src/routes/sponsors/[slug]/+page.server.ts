import { error } from '@sveltejs/kit';
import { workerEnvironment } from '#lib/server/environment.ts';
import { giftState, publicMode, publicSponsor } from '#lib/server/sponsors.ts';
import { storage } from '#lib/server/workspace.ts';
import type { PageServerLoad } from './$types';

export const prerender = false;

// A sponsor's own page (docs/sponsorship.md): only for a sponsor who has
// given and chose to be listed by name. Everyone else is "not found", so
// the page never says whether someone is a sponsor who chose not to be named.
export const load: PageServerLoad = async (event) => {
	const { database } = storage(event);
	const found = await publicSponsor(database, event.params.slug, publicMode(giftState(workerEnvironment())));
	if (!found) error(404, 'There is no sponsor page here.');
	return { sponsor: found.view };
};
