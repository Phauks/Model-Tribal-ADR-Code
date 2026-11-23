import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Orders moved to /orders/<order> when the Store opened (docs/store.md). Links
// in receipts sent before then still arrive here.
export const prerender = false;

export const GET: RequestHandler = ({ params, url }) => redirect(308, `/orders/${encodeURIComponent(params.identifier)}${url.search}`);
