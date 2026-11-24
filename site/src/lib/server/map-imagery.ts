/**
 * The map's picture base maps (Trevor, 2026-11-24, mockup 1A in the project files' design/map-controls): aerial photos, shaded relief and topographic maps from the U.S. Geological Survey's National Map, all public domain works of the United States government.
 *
 * The site fetches each picture for the reader and passes it on (Trevor chose this on 2026-11-24), so no one outside the site sees which places a reader looks at, as with the site's own tiles (decision record 0039). Cloudflare keeps a copy of each picture for a month, so a place viewed often is fetched from the survey once. Only the three services below are reached, at zoom levels 0 to 16, so the route cannot be used to fetch anything else.
 */

/** The picture base maps, by the name in their address. */
export const mapImagery = {
	satellite: { service: 'USGSImageryOnly', credit: 'USGS The National Map: Orthoimagery' },
	terrain: { service: 'USGSShadedReliefOnly', credit: 'USGS The National Map: Shaded Relief' },
	topographic: { service: 'USGSTopo', credit: 'USGS The National Map' }
} as const;

export type MapImageryName = keyof typeof mapImagery;

export const imageryMaximumZoom = 16;

export function isMapImageryName(name: string): name is MapImageryName {
	return Object.hasOwn(mapImagery, name);
}

/** The survey's address for one picture. Its services name the row (y) before the column (x). */
export function imageryAddress(name: MapImageryName, z: number, x: number, y: number): string {
	return `https://basemap.nationalmap.gov/arcgis/rest/services/${mapImagery[name].service}/MapServer/tile/${z}/${y}/${x}`;
}

const month = 60 * 60 * 24 * 30;
const pictureTypes = new Set(['image/jpeg', 'image/png']);

/** The response for /map-tiles/imagery/<name>/<z>/<x>/<y>. A place the survey has no picture for is an empty answer (204), which the map draws as nothing. */
export async function serveMapImagery(name: string, z: number, x: number, y: number, fetcher: typeof fetch = fetch): Promise<Response> {
	const size = 2 ** z;
	if (!isMapImageryName(name) || ![z, x, y].every(Number.isInteger) || z < 0 || z > imageryMaximumZoom || x < 0 || y < 0 || x >= size || y >= size) {
		return new Response('No such map picture.', { status: 404, headers: { 'Cache-Control': 'no-store' } });
	}
	let upstream: Response;
	try {
		upstream = await fetcher(imageryAddress(name, z, x, y), { cf: { cacheEverything: true, cacheTtl: month } } as RequestInit);
	} catch {
		return new Response('The map picture could not be fetched.', { status: 502, headers: { 'Cache-Control': 'no-store' } });
	}
	const type = (upstream.headers.get('content-type') ?? '').split(';')[0].trim();
	if (!upstream.ok || !pictureTypes.has(type)) {
		return new Response(null, { status: 204, headers: { 'Cache-Control': `public, max-age=${60 * 60 * 24}` } });
	}
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
