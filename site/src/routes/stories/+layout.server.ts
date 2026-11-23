import { storiesPages } from '#lib/server/section-contents.ts';
import type { PageOutline } from '#lib/site-sections.ts';
import type { LayoutServerLoad } from './$types';

// The sidebar's outline for the stories: every published story, by title (src/lib/server/section-contents.ts).
export const load: LayoutServerLoad = () => ({
	outline: { items: storiesPages() } satisfies PageOutline as PageOutline
});
