import { error } from '@sveltejs/kit';
import { workerEnvironment } from '#lib/server/environment.ts';
import { logoResponse } from '#lib/server/sponsor-logos.ts';
import { giftState, publicMode, publicSponsor } from '#lib/server/sponsors.ts';
import { storage } from '#lib/server/workspace.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

// A sponsor's logo, shown only while the sponsor is listed with their logo (docs/sponsorship.md).
export const GET: RequestHandler = async (event) => {
	const { database, bucket } = storage(event);
	const found = await publicSponsor(database, event.params.slug, publicMode(giftState(workerEnvironment())));
	if (!found || !found.view.hasLogo) error(404, 'No logo.');
	return logoResponse(database, bucket, found.sponsor, 'public');
};
