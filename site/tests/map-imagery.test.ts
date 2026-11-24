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

	it('answers an empty place or a page that is not a picture with nothing to draw', async () => {
		for (const answer of [() => new Response('missing', { status: 404 }), () => new Response('<html>', { headers: { 'content-type': 'text/html' } })]) {
			const { fetcher } = survey(answer);
			const response = await serveMapImagery('topographic', 5, 3, 3, fetcher);
			expect(response.status).toBe(204);
		}
	});
});
