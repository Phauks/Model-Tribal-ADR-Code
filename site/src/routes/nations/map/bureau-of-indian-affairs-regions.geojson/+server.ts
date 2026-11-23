import { regionsGeoJson } from '#lib/server/map-downloads.ts';
import type { RequestHandler } from './$types';

// A layer of the map as GeoJSON, built with the site (src/lib/server/map-downloads.ts).
export const prerender = true;

export const GET: RequestHandler = () =>
	new Response(JSON.stringify(regionsGeoJson()), {
		headers: {
			'content-type': 'application/geo+json',
			'content-disposition': 'attachment; filename="bureau-of-indian-affairs-regions.geojson"'
		}
	});
