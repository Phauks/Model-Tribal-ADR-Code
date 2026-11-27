import { essayIndex } from '#lib/server/essay-pages.ts';
import type { PageServerLoad } from './$types';

// Rendered on request: essays live in the private bucket (docs/editing.md).
export const prerender = false;

// Its outline lists the back matter pages, which the side column shows under
// the Library's pages (SiteSidebar.svelte).
export const load: PageServerLoad = () => essayIndex('back-matter');
