import { essayIndex } from '#lib/server/essay-pages.ts';
import type { PageServerLoad } from './$types';

// Rendered on request: essays live in the private bucket (docs/editing.md).
export const prerender = false;

// Its outline lists the back matter pages; the sidebar puts them under Back
// matter in the Library's list (src/lib/sidebar-outline.ts).
export const load: PageServerLoad = () => essayIndex('back-matter');
