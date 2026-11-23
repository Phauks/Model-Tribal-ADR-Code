import { nationsPages } from '#lib/server/section-contents.ts';
import type { PageOutline } from '#lib/site-sections.ts';
import type { LayoutServerLoad } from './$types';

// The sidebar's outline for the Nations section (src/lib/server/section-contents.ts).
// A nation's own page adds itself and its headings under Directory.
export const load: LayoutServerLoad = () => ({
	outline: { items: nationsPages } satisfies PageOutline as PageOutline
});
