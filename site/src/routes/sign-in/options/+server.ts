import { json } from '@sveltejs/kit';
import { workerEnvironment } from '#lib/server/environment.ts';
import { emailDelivery } from '#lib/server/sign-in-email.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

/**
 * What the masthead's sign-in panel needs to know before it shows its forms
 * (src/lib/components/AccountLink.svelte): whether this copy of the site can
 * send codes by email, which Email me a code and Create an account need. The
 * pages that open the panel are built ahead of time, so they ask here.
 */
export const GET: RequestHandler = ({ url }) => {
	return json(
		{ codesAvailable: emailDelivery(workerEnvironment(), url).kind !== 'none' },
		{ headers: { 'cache-control': 'no-store' } }
	);
};
