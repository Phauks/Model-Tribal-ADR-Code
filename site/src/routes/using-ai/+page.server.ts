import { aboutPage } from '#lib/server/about-pages.ts';
import type { PageServerLoad } from './$types';

// Edited on the website like the essays (content/about/README.md), so the Worker renders it.
export const prerender = false;

export const load: PageServerLoad = () => aboutPage('using-ai');
