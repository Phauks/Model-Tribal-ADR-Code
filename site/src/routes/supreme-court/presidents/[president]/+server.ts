import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// President pages moved to /presidents/<key> on Nov. 27, 2026, when every President got one (src/lib/server/president-documents.ts).
export const prerender = false;

export const GET: RequestHandler = ({ params, url }) => redirect(308, `/presidents/${encodeURIComponent(params.president)}${url.search}`);
