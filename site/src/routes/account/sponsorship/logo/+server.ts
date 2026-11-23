import { error } from '@sveltejs/kit';
import { can } from '#lib/permissions.ts';
import { logoResponse } from '#lib/server/sponsor-logos.ts';
import { isManager, sponsorByIdentifier } from '#lib/server/sponsors.ts';
import { requireAccount, storage } from '#lib/server/workspace.ts';
import type { RequestHandler } from './$types';

// A sponsor's logo for the preview on their Account page, before it is
// public: for the people who manage the sponsorship and the lead author.
export const GET: RequestHandler = async (event) => {
	const account = requireAccount(event);
	const { database, bucket } = storage(event);
	const sponsor = await sponsorByIdentifier(database, event.url.searchParams.get('sponsor') ?? '');
	const allowed =
		sponsor &&
		((await isManager(database, sponsor.identifier, account.subject)) || Boolean(event.locals.person && can(event.locals.person, 'manage-sponsors')));
	if (!sponsor || !allowed) error(404, 'No logo.');
	return logoResponse(database, bucket, sponsor, 'private');
};
