import { trackVersions } from '#lib/server/content.ts';
import { colorsOf } from '#lib/server/design-tokens.ts';
import type { LayoutServerLoad } from './$types';

// Every page is built ahead of time; the Worker only serves files.
export const prerender = true;
export const trailingSlash = 'never';

export const load: LayoutServerLoad = () => ({
	versions: trackVersions(),
	themeColor: {
		light: colorsOf('light').paper,
		dark: colorsOf('dark').paper
	}
});
