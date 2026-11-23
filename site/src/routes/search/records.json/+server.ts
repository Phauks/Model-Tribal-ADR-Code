import { json } from '@sveltejs/kit';
import { searchRecords } from '#lib/server/search-records.ts';
import type { RequestHandler } from './$types';

// What the advanced search filters on (src/lib/search-records.ts), built with the site.
export const prerender = true;

export const GET: RequestHandler = () => json(searchRecords());
