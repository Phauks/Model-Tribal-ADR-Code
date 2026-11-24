/**
 * Workspace › Essays was removed (lead author, Nov. 23, 2026: "do we still
 * need an essays page if all changes are done on the actual page?" and "yes,
 * remove it"). Essays are started, edited, commented on and reviewed on their
 * own pages; the old address goes to the Essays section. A new essay is
 * started from the "New essay" button there (essays/new/+server.ts).
 */
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const prerender = false;

export const GET: RequestHandler = () => redirect(308, '/essays');
