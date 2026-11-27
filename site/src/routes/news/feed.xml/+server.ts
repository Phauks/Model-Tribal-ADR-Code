import { workerEnvironment } from '#lib/server/environment.ts';
import { siteAddress } from '#lib/server/following-email.ts';
import { newsFeedEntries } from '#lib/server/news-pages.ts';
import { atomFeed } from '#lib/news-feed.ts';
import type { RequestHandler } from './$types';

// Posts live in the database, so the Worker writes the feed on request.
export const prerender = false;

/** The newest 50 posts as an Atom feed (src/lib/news-feed.ts). */
export const GET: RequestHandler = async ({ url }) => {
	const site = siteAddress(workerEnvironment()) ?? url.origin;
	const posts = await newsFeedEntries();
	return new Response(atomFeed({ site, posts, builtAt: new Date().toISOString() }), {
		headers: { 'content-type': 'application/atom+xml; charset=utf-8', 'cache-control': 'public, max-age=300' }
	});
};
