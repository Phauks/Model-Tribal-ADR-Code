/**
 * Every stub on the site, most mentioned first (src/lib/server/stub-list.ts),
 * for Workspace › Stubs. Built with the site; it names only public pages.
 */
import { json } from '@sveltejs/kit';
import { stubList } from '#lib/server/stub-list.ts';

export const prerender = true;

export const GET = () => json(stubList());
