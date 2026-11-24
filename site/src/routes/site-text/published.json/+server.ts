import { error, json } from '@sveltejs/kit';
import { workerEnvironment } from '#lib/server/environment.ts';
import { publishedSiteText } from '#lib/server/site-text.ts';
import type { RequestHandler } from './$types';

// The site's published wording (docs/site-text.md), which Cloudflare's build
// reads to build it into the pages (src/lib/server/site-text-build.ts). Only
// what readers already see once a build has run, so it is public.
export const prerender = false;

export const GET: RequestHandler = async () => {
	const { database } = workerEnvironment();
	if (!database) error(503, 'The database is not connected.');
	return json(await publishedSiteText(database), { headers: { 'cache-control': 'no-store' } });
};
