import type { NationsMapDrawings } from '#lib/nations-map-drawing.ts';
import type { SourceEntry } from '#lib/server/source-uses.ts';
import { startTileMapLoading } from '#lib/tile-map-loading.ts';
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
 *
 * The References are sent the same way, for readers without scripts: on the
 * server the list goes into the page's markup inside <noscript>, which a
 * browser running scripts keeps as plain text, never laid out. The browser
 * fetches the list from /nations/map/sources.json when a reader nears it.
 *
 * In the browser the load also starts fetching what the tiled map needs
 * (src/lib/tile-map-loading.ts), since it runs before the page comes to life.
 */
const drawnOnServer: NationsMapDrawings = { states: ' ', regions: ' ' };
let fetched: NationsMapDrawings | undefined;

export const load: PageLoad = async ({ data, fetch }) => {
	if (import.meta.env.SSR) {
		const [{ default: geometry }, { drawNationsMaps }] = await Promise.all([
			import('virtual:map-geometry'),
			import('#lib/nations-map-drawing.ts')
		]);
		const { nationsMapPage } = await import('#lib/server/nations-map.ts');
		const sources: SourceEntry[] = nationsMapPage().sources;
		return { ...data, drawings: drawNationsMaps(geometry, data.counts), sources };
	}
	startTileMapLoading();
	if (fetched) return { ...data, drawings: fetched };
	if (document.querySelector('[data-nations-map]')) return { ...data, drawings: drawnOnServer };
	const response = await fetch('/nations/map/drawings.json');
	fetched = (await response.json()) as NationsMapDrawings;
	return { ...data, drawings: fetched };
};
