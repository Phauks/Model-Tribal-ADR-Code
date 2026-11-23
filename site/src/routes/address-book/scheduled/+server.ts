import { error, json } from '@sveltejs/kit';
import { publicNationContacts } from 'virtual:public-contacts';
import { today } from '#lib/address-book.ts';
import { weeklyAddressBookRun } from '#lib/server/address-book.ts';
import { workerEnvironment } from '#lib/server/environment.ts';
import { isScheduledRun } from '#lib/server/scheduled-run.ts';
import type { RequestHandler } from './$types';

// The weekly address book check (wrangler.jsonc, "triggers": Mondays at 09:41
// UTC). The Worker's scheduled handler (tools/add-scheduled-run.mjs) passes
// the run here with a token only that copy of the Worker holds; every other
// request is refused as if the address did not exist. The run rereads the
// federal and Alaska directories and brings in office emails and phones the
// nation pages show; changes are recorded with no person, as the site's own.
export const prerender = false;

export const POST: RequestHandler = async ({ request }) => {
	if (!isScheduledRun(request)) error(404, 'Not found.');
	const { database } = workerEnvironment();
	if (!database) error(503, 'The database is not connected.');
	const summary = await weeklyAddressBookRun(database, (link) => fetch(link), publicNationContacts, null, today());
	return json(summary, { headers: { 'cache-control': 'no-store' } });
};
