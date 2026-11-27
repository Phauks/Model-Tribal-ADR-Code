/**
 * The map's picture base maps (Trevor, 2026-11-24, mockup 1A in the project files' design/map-controls): aerial photos, shaded relief and contour lines from the U.S. Geological Survey's National Map, all public domain works of the United States government.
 *
 * The site fetches each picture for the reader and passes it on (Trevor chose this on 2026-11-24), so no one outside the site sees which places a reader looks at, as with the site's own tiles (decision record 0039). Cloudflare keeps a copy of each picture for a month, so a place viewed often is fetched from the survey once. Only the services below are reached, at zoom levels 0 to 16, so the route cannot be used to fetch anything else.
 *
 * None of these pictures carries place names. The survey's own topographic map (USGSTopo) has names drawn into it, so countries and towns showed under the site's names, in other languages abroad (Trevor, 2026-11-24). The Topographic base map is instead the site's own map with the survey's shaded relief and contour lines over it (src/lib/components/TileMap.svelte), and its names are the site's, which the reader can turn off.
 */

/** A picture service that is already cut into tiles. */
type TiledService = { kind: 'tiles'; service: string; credit: string; minimumZoom: number };
/** A service that draws a picture of any box, asked for one tile's box at a time. */
type DrawnService = { kind: 'drawn'; address: string; layers: string; credit: string; minimumZoom: number };

/** The picture base maps, by the name in their address. */
export const mapImagery = {
	satellite: { kind: 'tiles', service: 'USGSImageryOnly', credit: 'USGS The National Map: Orthoimagery', minimumZoom: 0 },
	terrain: { kind: 'tiles', service: 'USGSShadedReliefOnly', credit: 'USGS The National Map: Shaded Relief', minimumZoom: 0 },
	/** The contour lines alone, without the layers that label them. The survey draws them slowly over a wide area (85 seconds for a zoom 8 tile, 2 to 4 seconds from zoom 11), and they are too dense to read further out, so they start at zoom 10. */
	contours: {
		kind: 'drawn',
		address: 'https://carto.nationalmap.gov/arcgis/rest/services/contours/MapServer/export',
		layers: 'show:2,4,6,8,11,13,16,18,25,26,27,33,34,35',
		credit: 'USGS The National Map: Contours',
		minimumZoom: 10
	}
} as const satisfies Record<string, TiledService | DrawnService>;

export type MapImageryName = keyof typeof mapImagery;

export const imageryMaximumZoom = 16;

export function isMapImageryName(name: string): name is MapImageryName {
	return Object.hasOwn(mapImagery, name);
}

/** Half the width of the web map's square world, in meters (EPSG:3857). */
const halfWorld = 20037508.342789244;

/** The survey's address for one picture. Its tile services name the row (y) before the column (x); a drawn picture is asked for by the tile's box in web map meters. */
export function imageryAddress(name: MapImageryName, z: number, x: number, y: number): string {
	const source: TiledService | DrawnService = mapImagery[name];
	if (source.kind === 'tiles') return `https://basemap.nationalmap.gov/arcgis/rest/services/${source.service}/MapServer/tile/${z}/${y}/${x}`;
	const size = (2 * halfWorld) / 2 ** z;
	const west = -halfWorld + x * size;
	const north = halfWorld - y * size;
	const box = [west, north - size, west + size, north].map((meters) => meters.toFixed(2)).join(',');
	const query = new URLSearchParams({ bbox: box, bboxSR: '3857', imageSR: '3857', size: '256,256', format: 'png32', transparent: 'true', layers: source.layers, f: 'image' });
	return `${source.address}?${query}`;
}

const day = 60 * 60 * 24;
const month = day * 30;
const pictureTypes = new Set(['image/jpeg', 'image/png']);

function failed(): Response {
	return new Response('The map picture could not be fetched.', { status: 502, headers: { 'Cache-Control': 'no-store' } });
}

/**
 * The response for /map-tiles/imagery/<name>/<z>/<x>/<y>. A place the survey has no picture for (outside the United States past zoom 8) is an empty answer (204), kept for a day, which the map draws as nothing, so the lower zoom picture under it shows. Any other failure is not kept, so the next reader asks again.
 */
export async function serveMapImagery(name: string, z: number, x: number, y: number, fetcher: typeof fetch = fetch): Promise<Response> {
	const size = 2 ** z;
	if (!isMapImageryName(name) || ![z, x, y].every(Number.isInteger) || z < 0 || z > imageryMaximumZoom || x < 0 || y < 0 || x >= size || y >= size) {
		return new Response('No such map picture.', { status: 404, headers: { 'Cache-Control': 'no-store' } });
	}
	if (z < mapImagery[name].minimumZoom) return new Response(null, { status: 204, headers: { 'Cache-Control': `public, max-age=${month}` } });
	let upstream: Response;
	try {
		upstream = await fetcher(imageryAddress(name, z, x, y), { cf: { cacheEverything: true, cacheTtl: month } } as RequestInit);
	} catch {
		// expected: the picture service did not answer; failed() answers 502 and the map shows a gap.
		return failed();
	}
	if (upstream.status === 404) return new Response(null, { status: 204, headers: { 'Cache-Control': `public, max-age=${day}` } });
	const type = (upstream.headers.get('content-type') ?? '').split(';')[0].trim();
	if (!upstream.ok || !pictureTypes.has(type)) return failed();
	return new Response(upstream.body, {
		status: 200,
		headers: {
			'Content-Type': type,
			'Cache-Control': `public, max-age=${month}`,
			'X-Content-Type-Options': 'nosniff',
			'Cross-Origin-Resource-Policy': 'same-origin'
		}
	});
}
