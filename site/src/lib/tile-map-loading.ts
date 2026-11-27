import type { TileMapData } from '#lib/server/nations-map.ts';

/**
 * What the tiled map (TileMap.svelte) needs before it can draw: the MapLibre library, its stylesheet, the Protomaps basemap styles and, for the map of all nations, /nations/map/tile-map.json. Each is fetched once a page and shared, so a page can start them early and the map picks up what is already on its way.
 *
 * The Map page starts them from its load function (src/routes/nations/map/+page.ts), which in the browser runs before the page's markup comes to life, rather than waiting for the map to mount after it. On that page this saves the whole time the page takes to start.
 */
const importLibrary = () => Promise.all([import('maplibre-gl'), import('maplibre-gl/dist/maplibre-gl.css'), import('@protomaps/basemaps')]);
let library: ReturnType<typeof importLibrary> | undefined;
let allNations: Promise<TileMapData> | undefined;

/** The MapLibre library, its stylesheet and the basemap styles. */
export function loadTileMapLibrary() {
	library ??= importLibrary().catch((error: unknown) => {
		library = undefined;
		throw error;
	});
	return library;
}

/** The data of the map of all nations, fetched once a page. A failed fetch is forgotten, so the next try asks again. */
export function loadAllNationsTileMapData(): Promise<TileMapData> {
	allNations ??= fetch('/nations/map/tile-map.json')
		.then((response) => {
			if (!response.ok) throw new Error(`The map data answered ${response.status}`);
			return response.json() as Promise<TileMapData>;
		})
		.catch((error: unknown) => {
			allNations = undefined;
			throw error;
		});
	return allNations;
}

/** Starts everything the map of all nations needs, where the device can draw it. */
export function startTileMapLoading(): void {
	if (typeof window === 'undefined' || !navigator.onLine) return;
	void loadTileMapLibrary().catch(() => undefined);
	void loadAllNationsTileMapData().catch(() => undefined);
}
