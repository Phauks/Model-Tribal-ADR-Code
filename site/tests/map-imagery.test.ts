import { describe, expect, it } from 'vitest';
import { imageryAddress, serveMapImagery } from '../src/lib/server/map-imagery.ts';

/** A stand-in for the survey that records what was asked and answers with the given picture. */
function survey(answer: () => Response) {
	const asked: string[] = [];
	const fetcher = (async (input: RequestInfo | URL) => {
		asked.push(String(input));
		return answer();
	}) as typeof fetch;
	return { fetcher, asked };
}

describe('map pictures', () => {
	it("asks the survey's service for the row before the column", () => {
		expect(imageryAddress('satellite', 6, 12, 24)).toBe('https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/6/24/12');
	});

	it('passes a picture on, for a month', async () => {
		const { fetcher, asked } = survey(() => new Response(new Uint8Array([255, 216, 255]), { headers: { 'content-type': 'image/jpeg' } }));
		const response = await serveMapImagery('terrain', 3, 1, 2, fetcher);
		expect(asked).toEqual(['https://basemap.nationalmap.gov/arcgis/rest/services/USGSShadedReliefOnly/MapServer/tile/3/2/1']);
		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toBe('image/jpeg');
		expect(response.headers.get('cache-control')).toBe('public, max-age=2592000');
	});

	it('reaches nothing for an unknown base map or an address outside the grid', async () => {
		const { fetcher, asked } = survey(() => new Response('x'));
		for (const [name, z, x, y] of [['street', 3, 1, 1], ['satellite', 17, 0, 0], ['satellite', 2, 4, 0], ['satellite', 2, 0, -1], ['satellite', 1.5, 0, 0]] as const) {
			expect((await serveMapImagery(name, z, x, y, fetcher)).status).toBe(404);
		}
		expect(asked).toEqual([]);
	});

	it('answers a place the survey has no picture for with nothing to draw, for a day', async () => {
		const { fetcher } = survey(() => new Response('missing', { status: 404, headers: { 'content-type': 'text/html' } }));
		const response = await serveMapImagery('satellite', 10, 474, 512, fetcher);
		expect(response.status).toBe(204);
		expect(response.headers.get('cache-control')).toBe('public, max-age=86400');
	});

	it('keeps no failure, so the next reader asks again', async () => {
		for (const answer of [() => new Response('busy', { status: 503 }), () => new Response('<html>', { headers: { 'content-type': 'text/html' } })]) {
			const { fetcher } = survey(answer);
			const response = await serveMapImagery('terrain', 5, 3, 3, fetcher);
			expect(response.status).toBe(502);
			expect(response.headers.get('cache-control')).toBe('no-store');
		}
	});

	it('asks for contour lines without their labels by the tile box, and not far out', async () => {
		const address = new URL(imageryAddress('contours', 1, 1, 0));
		expect(address.origin + address.pathname).toBe('https://carto.nationalmap.gov/arcgis/rest/services/contours/MapServer/export');
		expect(address.searchParams.get('bbox')).toBe('0.00,0.00,20037508.34,20037508.34');
		expect(address.searchParams.get('transparent')).toBe('true');
		expect(address.searchParams.get('layers')).toBe('show:2,4,6,8,11,13,16,18,25,26,27,33,34,35');
		const { fetcher, asked } = survey(() => new Response(new Uint8Array([137, 80]), { headers: { 'content-type': 'image/png' } }));
		expect((await serveMapImagery('contours', 9, 0, 0, fetcher)).status).toBe(204);
		expect(asked).toEqual([]);
		expect((await serveMapImagery('contours', 12, 700, 1600, fetcher)).status).toBe(200);
		expect(asked).toHaveLength(1);
	});

	it('no longer offers the survey topographic map, which has place names drawn in', async () => {
		const { fetcher } = survey(() => new Response('x'));
		expect((await serveMapImagery('topographic', 5, 3, 3, fetcher)).status).toBe(404);
	});
});
