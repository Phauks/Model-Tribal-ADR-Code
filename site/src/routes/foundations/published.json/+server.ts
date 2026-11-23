import { json } from '@sveltejs/kit';
import { sectionContents } from '#lib/server/section-contents.ts';
import type { RequestHandler } from './$types';

// The published essays of Foundations, for pages built ahead of time that
// link to one once it is published, such as the timeline's era headings
// (src/lib/components/Timeline.svelte). The essays are published from the
// database, so the Worker answers this when it is asked, not when the site
// is built.
export const prerender = false;

export const GET: RequestHandler = async () => json((await sectionContents('foundations'))?.pages ?? []);
