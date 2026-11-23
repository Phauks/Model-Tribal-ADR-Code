import { json } from '@sveltejs/kit';
import { casePreviewList } from '#lib/server/case-previews.ts';
import type { RequestHandler } from './$types';

/**
 * Every case the project has a record of, in short form, built once with the
 * site: the links to cases a court cites inside a quoted paragraph, and the
 * preview that opens when a reader points at one (src/lib/case-links.ts,
 * LinkPreviews.svelte), read it. Each field repeats the case's record or the
 * holding written in its essay box.
 */
export const prerender = true;

export const GET: RequestHandler = () => json(casePreviewList());
