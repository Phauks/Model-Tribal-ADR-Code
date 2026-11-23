import { glossaryPages } from '#lib/server/section-contents.ts';
import type { PageOutline } from '#lib/site-sections.ts';
import type { LayoutServerLoad } from './$types';

// The sidebar's outline for the Glossary: every published term, A to Z (src/lib/server/section-contents.ts).
export const load: LayoutServerLoad = () => ({
	outline: { items: glossaryPages() } satisfies PageOutline as PageOutline
});
