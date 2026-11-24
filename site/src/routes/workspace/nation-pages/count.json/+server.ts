/**
 * How many changes nations published that the project has not read yet, for
 * the count beside "Nations’ changes" in the left sidebar
 * (design/nation-editors, screen 5). Only people who review nations' changes
 * may ask.
 */
import { json } from '@sveltejs/kit';
import { reviewDays } from '#lib/nation-page-review.ts';
import { reviewCounts } from '#lib/server/nation-page-review.ts';
import { requirePermission, storage } from '#lib/server/workspace.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

export const GET: RequestHandler = async (event) => {
	requirePermission(event, 'review-nation-pages');
	const { database } = storage(event);
	const counts = await reviewCounts(database, new Date(Date.now() - reviewDays * 24 * 60 * 60 * 1000).toISOString());
	return json(counts, { headers: { 'Cache-Control': 'private, no-store' } });
};
