import type { NationsMapDrawings } from '#lib/nations-map-drawing.ts';
import type { PageLoad } from './$types';

/**
 * Sends the map outlines once (site/DESIGN.md, section 11).
 *
 * The outlines are drawn here, while the page is built, and the page shows
 * them with {@html}. A universal load's result is not copied into the page
 * for hydration, unlike a server load's, so the outlines are in the page's
 * markup only. In the browser:
 *
 * - When the page has just loaded, its maps are already drawn. The load
 *   returns a stand-in, and Svelte keeps the markup from the server, as it
 *   does whenever an {@html} value differs between server and browser.
 * - When the reader comes from another page of the site without reloading,
 *   the maps are fetched once from /nations/map/drawings.json.
 */
const drawnOnServer: NationsMapDrawings = { states: ' ', regions: ' ' };
let fetched: NationsMapDrawings | undefined;

export const load: PageLoad = async ({ data, fetch }) => {
	if (import.meta.env.SSR) {
		const [{ default: geometry }, { drawNationsMaps }] = await Promise.all([
			import('virtual:map-geometry'),
			import('#lib/nations-map-drawing.ts')
		]);
		return { ...data, drawings: drawNationsMaps(geometry, data.counts) };
	}
	if (fetched) return { ...data, drawings: fetched };
	if (document.querySelector('[data-nations-map]')) return { ...data, drawings: drawnOnServer };
	const response = await fetch('/nations/map/drawings.json');
	fetched = (await response.json()) as NationsMapDrawings;
	return { ...data, drawings: fetched };
};
