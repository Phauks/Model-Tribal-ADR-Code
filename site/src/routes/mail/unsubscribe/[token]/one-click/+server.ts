import { error, redirect } from '@sveltejs/kit';
import { mailContext } from '#lib/server/mail/runtime.ts';
import { unsubscribeWithToken } from '#lib/server/mail/outreach.ts';
import type { RequestHandler } from './$types';

// A mail program's one-click unsubscribe (RFC 8058). Mail programs post
// "List-Unsubscribe=One-Click" without an Origin header, which SvelteKit's
// check against forms from other sites would refuse, so the Worker's entry
// (tools/add-mail-handlers.mjs) passes it on with this content type. A
// mail program without one-click support opens the address instead, which
// leads to the page with the button.
export const prerender = false;

export const GET: RequestHandler = ({ params }) => redirect(303, `/mail/unsubscribe/${params.token}`);

export const POST: RequestHandler = async ({ request, params }) => {
	if (request.headers.get('content-type') !== 'application/x-one-click-unsubscribe') error(415, 'Unsupported request.');
	const email = await unsubscribeWithToken(mailContext(), params.token, 'one-click unsubscribe');
	return new Response(email ? 'Unsubscribed.' : 'This unsubscribe link is not valid.', {
		status: email ? 200 : 404,
		headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }
	});
};
