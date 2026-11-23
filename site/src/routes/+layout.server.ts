import { trackVersions } from '#lib/server/versions.ts';
import { colorsOf } from '#lib/server/design-tokens.ts';
import { sectionContents } from '#lib/server/section-contents.ts';
import { sectionOf } from '#lib/site-sections.ts';
import type { LayoutServerLoad } from './$types';

// Every page is built ahead of time; the Worker only serves files.
export const prerender = true;
export const trailingSlash = 'never';

export const load: LayoutServerLoad = async ({ url }) => ({
	versions: trackVersions(),
	// The pages of the section being read, which the sidebar always lists
	// (src/lib/sidebar-outline.ts). Pages give only their own outline.
	sectionPages: await currentSectionPages(url.pathname),
	themeColor: {
		light: colorsOf('light').paper,
		dark: colorsOf('dark').paper
	}
});

async function currentSectionPages(path: string) {
	const section = sectionOf(path);
	if (!section?.opens) return undefined;
	try {
		return await sectionContents(section.link.slice(1));
	} catch (problem) {
		// The essays' lists come from the database; the page still shows without them.
		console.error('Could not list the section’s pages', problem);
		return undefined;
	}
}
