import { json } from '@sveltejs/kit';
import { searchSelection } from '#lib/server/search-selection.ts';
import type { RequestHandler } from './$types';

// The file each search result can be downloaded as (src/lib/search-selection.ts), built with the site. Nations' choices are applied when it is served (src/lib/restricted-files.ts, filterSearchFiles).
export const prerender = true;

export const GET: RequestHandler = () => json(searchSelection().files);
