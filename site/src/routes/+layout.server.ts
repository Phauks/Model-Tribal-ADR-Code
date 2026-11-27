import { building } from '$app/env';
import { trackVersions } from '#lib/server/versions.ts';
import { colorsOf } from '#lib/server/design-tokens.ts';
import { navigationCounts } from '#lib/server/navigation-counts.ts';
import { familyContents, familyOf } from '#lib/server/section-contents.ts';
import type { LayoutServerLoad } from './$types';

// Every page is built ahead of time; the Worker only serves files.
export const prerender = true;
export const trailingSlash = 'never';

export const load: LayoutServerLoad = async ({ url }) => ({
	versions: trackVersions(),
	// The pages a page belongs with, such as the essays of Foundations, for the
	// side column (src/lib/server/section-contents.ts). Pages give only their
	// own outline; a nation's pages give their family themselves.
	family: await currentFamily(url.pathname),
	// The counts beside the section menus' links, counted only while the site
	// is built (src/lib/server/navigation-counts.ts).
	navigationCounts: building ? navigationCounts() : undefined,
	themeColor: {
		light: colorsOf('light').paper,
		dark: colorsOf('dark').paper
	}
});

async function currentFamily(path: string) {
	const family = familyOf(path);
	if (!family) return undefined;
	try {
		return await familyContents(family);
	} catch (problem) {
		// The essays come from the database; the page still shows without them.
		console.error('Could not list the pages beside this one', problem);
		return undefined;
	}
}
