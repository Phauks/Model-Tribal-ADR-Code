import { json } from '@sveltejs/kit';
import { recourseRows } from '#lib/server/recourse.ts';
import type { RequestHandler } from './$types';

// Every row of the Find recourse page, which the page loads in the browser to filter. Built with the site.
export const prerender = true;

export const GET: RequestHandler = () => json(recourseRows());
