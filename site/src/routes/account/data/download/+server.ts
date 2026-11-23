import { accountDataExport } from '#lib/server/account-pages.ts';
import { requireAccount, storage } from '#lib/server/workspace.ts';
import type { RequestHandler } from './$types';

/** "Download my data": everything kept with the account, as one JSON file (src/lib/server/account-pages.ts). */
export const prerender = false;

export const GET: RequestHandler = async (event) => {
	const account = requireAccount(event);
	const data = await accountDataExport(storage(event).database, account);
	const day = new Date().toISOString().slice(0, 10);
	return new Response(`${JSON.stringify(data, null, '\t')}\n`, {
		headers: {
			'content-type': 'application/json; charset=utf-8',
			'content-disposition': `attachment; filename="model-tribal-adr-code-account-${day}.json"`,
			'cache-control': 'no-store'
		}
	});
};
