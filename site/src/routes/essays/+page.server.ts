import { essayIndex } from '#lib/server/essay-pages.ts';
import type { PageServerLoad } from './$types';

// Rendered on request: essays live in the private bucket (docs/editing.md).
export const prerender = false;

// The sidebar lists the essays from the section's own list (src/lib/sidebar-outline.ts),
// so the index gives no outline of its own.
export const load: PageServerLoad = async () => {
	const { essays } = await essayIndex('essays');
	return { essays };
};
