import { newsIndex } from '#lib/server/news-pages.ts';
import type { PageServerLoad } from './$types';

// Rendered on request: posts live in the private bucket like the essays (docs/editing.md, "News").
export const prerender = false;

export const load: PageServerLoad = () => newsIndex();
