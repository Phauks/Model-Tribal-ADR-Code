import { json } from '@sveltejs/kit';
import { siteTimelineCitationItems } from '#lib/server/timeline.ts';
import type { RequestHandler } from './$types';

// The sources of the full timeline's entries as Citation Style Language JSON, which Zotero and
// other citation managers import (the "Sources of the entries" row of the approved mockup).
export const prerender = true;

export const GET: RequestHandler = () =>
	json(siteTimelineCitationItems(), { headers: { 'content-disposition': 'attachment; filename="timeline-sources.json"' } });
