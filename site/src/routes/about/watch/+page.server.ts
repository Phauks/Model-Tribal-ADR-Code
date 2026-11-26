import { aboutPage } from '#lib/server/about-pages.ts';
import type { PageServerLoad } from './$types';

// The page the source watch's User-Agent names (site/watch/README.md), edited on the website like the essays (content/about/README.md).
export const prerender = false;

export const load: PageServerLoad = () => aboutPage('watch');
