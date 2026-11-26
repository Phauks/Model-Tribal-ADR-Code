import { json } from '@sveltejs/kit';
import { mapPageCessions } from '#lib/server/land-cessions.ts';
import type { RequestHandler } from './$types';

export const prerender = true;

// Royce's land cessions as the Map page's details show them (historic maps mockup 2A), fetched the first time the reader turns the cessions on or chooses one.
export const GET: RequestHandler = () => json(mapPageCessions());
