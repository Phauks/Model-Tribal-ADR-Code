import { pageChangesView } from '#lib/server/page-changes.ts';
import type { PageServerLoad } from './$types';

// The Licenses page's own Changes view. Every other page's is
// src/routes/[...address]/changes; this address needs its own route, since
// /licenses/[id] would otherwise take it.
export const prerender = false;

export const load: PageServerLoad = async ({ setHeaders, locals, parent }) =>
	pageChangesView({ address: '/licenses', account: locals.account?.subject, setHeaders, pagesBeside: (await parent()).family });
