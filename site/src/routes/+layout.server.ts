import { building } from '$app/env';
import { trackVersions } from '#lib/server/versions.ts';
import { colorsOf } from '#lib/server/design-tokens.ts';
import { allSectionLists } from '#lib/server/section-contents.ts';
import type { LayoutServerLoad } from './$types';

// Every page is built ahead of time; the Worker only serves files.
export const prerender = true;
export const trailingSlash = 'never';

export const load: LayoutServerLoad = async () => ({
	versions: trackVersions(),
	// Every section's pages, so the sidebar has them all from the first paint
	// (Trevor, Nov. 23, 2026). Pages give only their own outline, which the
	// sidebar nests into their section's list (src/lib/sidebar-outline.ts).
	sidebarLists: await allSectionLists(building),
	themeColor: {
		light: colorsOf('light').paper,
		dark: colorsOf('dark').paper
	}
});

