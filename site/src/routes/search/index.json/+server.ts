import { json } from '@sveltejs/kit';
import { searchIndex } from '#lib/server/search-index.ts';
import type { RequestHandler } from './$types';

// The site search's index (src/lib/site-search.ts, built by src/lib/server/search-index.ts), built with the site.
export const prerender = true;

export const GET: RequestHandler = () => json(searchIndex());
