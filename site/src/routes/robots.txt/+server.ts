/**
 * robots.txt, made with the site from src/lib/search-engines.ts: closed to
 * every crawler until the first release, then open except for private and
 * signed-in pages, with the sitemap named.
 */
import path from 'node:path';
import { disallowedPrefixes } from '#lib/private-pages.ts';
import { robotsText } from '#lib/search-engines.ts';
import { repositoryRoot } from '#lib/server/content.ts';
import { siteAddress } from '#lib/server/site-text-build.ts';
import type { RequestHandler } from './$types';

export const prerender = true;

export const GET: RequestHandler = () =>
	new Response(robotsText(siteAddress(path.join(repositoryRoot, 'site')), disallowedPrefixes()), { headers: { 'content-type': 'text/plain; charset=utf-8' } });
