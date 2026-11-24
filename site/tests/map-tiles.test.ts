import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { forgetMapTileFiles, isTileAddress, mapAssetKey, serveMapAsset, serveMapTile, tileSets } from '../src/lib/server/map-tile-serving.ts';

/** A one-area PMTiles file (Blue Lake Rancheria's bounding box, zooms 0 to 4), made with tippecanoe. */
const fixture = readFileSync(new URL('./fixtures/map-tiles.pmtiles', import.meta.url));
const landAreas = [...tileSets.values()].find((tileSet) => tileSet.set.startsWith('land-areas-'));
if (!landAreas) throw new Error('geography/map-tiles.json names no land areas tile set');

/** A bucket that answers ranged reads from memory, with only what the tile route uses. */
function memoryBucket(objects: Record<string, Uint8Array>) {
	const reads: string[] = [];
	const bucket = {
		async get(key: string, options?: { range?: { offset: number; length: number } }) {
			const bytes = objects[key];
			if (!bytes) return null;
			const offset = options?.range?.offset ?? 0;
			const length = options?.range?.length ?? bytes.byteLength;
			reads.push(`${key}@${offset}`);
			const slice = bytes.slice(offset, offset + length);
			return { etag: 'etag-1', arrayBuffer: async () => slice.buffer.slice(slice.byteOffset, slice.byteOffset + slice.byteLength) };
		}
	};
	return { bucket: bucket as never, reads };
}

afterEach(() => forgetMapTileFiles());

describe('map tile addresses', () => {
	it('accepts tiles inside the grid of their zoom level', () => {
		expect(isTileAddress(0, 0, 0)).toBe(true);
		expect(isTileAddress(4, 15, 15)).toBe(true);
	});

	it('refuses tiles outside the grid, fractions and impossible zooms', () => {
		expect(isTileAddress(4, 16, 0)).toBe(false);
		expect(isTileAddress(2, -1, 0)).toBe(false);
		expect(isTileAddress(1.5, 0, 0)).toBe(false);
		expect(isTileAddress(Number.NaN, 0, 0)).toBe(false);
		expect(isTileAddress(30, 0, 0)).toBe(false);
	});
});

describe('serving map tiles from the bucket', () => {
	it('serves a tile the file holds, as a vector tile the browser may keep', async () => {
		const { bucket } = memoryBucket({ [landAreas.key]: fixture });
		const response = await serveMapTile(bucket, landAreas.set, 4, 2, 6);
		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toBe('application/x-protobuf');
		expect(response.headers.get('cache-control')).toContain('immutable');
		expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(0);
	});

	it('reads the directory once and then one range a tile', async () => {
		const { bucket, reads } = memoryBucket({ [landAreas.key]: fixture });
		await serveMapTile(bucket, landAreas.set, 4, 2, 6);
		const afterFirst = reads.length;
		await serveMapTile(bucket, landAreas.set, 3, 1, 3);
		expect(reads.slice(afterFirst), JSON.stringify(reads)).toHaveLength(1);
	});

	it('answers an empty tile for a place or zoom the file does not hold', async () => {
		const { bucket } = memoryBucket({ [landAreas.key]: fixture });
		expect((await serveMapTile(bucket, landAreas.set, 4, 0, 0)).status).toBe(204);
		expect((await serveMapTile(bucket, landAreas.set, 25, 0, 0)).status).toBe(404);
	});

	it('looks in the world basemap where the basemap has no tile', async () => {
		const basemap = [...tileSets.values()].find((tileSet) => tileSet.set.startsWith('basemap-'));
		const world = [...tileSets.values()].find((tileSet) => tileSet.set.startsWith('world-basemap-'));
		if (!basemap || !world) throw new Error('geography/map-tiles.json names no basemap or world basemap');
		// The fixture stands in for both files. A tile the basemap holds is served from it alone.
		const { bucket, reads } = memoryBucket({ [basemap.key]: fixture, [world.key]: fixture });
		expect((await serveMapTile(bucket, basemap.set, 4, 2, 6)).status).toBe(200);
		expect(reads.some((read) => read.startsWith(world.key))).toBe(false);
		// A tile the basemap lacks is looked for in the world basemap.
		expect((await serveMapTile(bucket, basemap.set, 4, 0, 0)).status).toBe(204);
		expect(reads.some((read) => read.startsWith(world.key))).toBe(true);
	});

	it('serves only the tile sets the site names', async () => {
		const { bucket, reads } = memoryBucket({ 'map-tiles/other.pmtiles': fixture });
		expect((await serveMapTile(bucket, 'other', 0, 0, 0)).status).toBe(404);
		expect((await serveMapTile(bucket, landAreas.set, 0, 1, 0)).status).toBe(404);
		expect(reads).toEqual([]);
	});
});

describe('serving the map fonts and icons', () => {
	it('names only the fonts and icon sheets the basemap uses', () => {
		expect(mapAssetKey('glyphs/Noto Sans Regular/0-255.pbf')).toBe('map-tiles/assets/glyphs/Noto Sans Regular/0-255.pbf');
		expect(mapAssetKey('sprites/black@2x.png')).toBe('map-tiles/assets/sprites/black@2x.png');
		expect(mapAssetKey('glyphs/Comic Sans/0-255.pbf')).toBeUndefined();
		expect(mapAssetKey('../land-areas-fe4ab6eac717.pmtiles')).toBeUndefined();
		expect(mapAssetKey('sprites/white.json/../../secret')).toBeUndefined();
	});

	it('serves a font range with its type, and refuses anything else', async () => {
		const glyphs = new Uint8Array([1, 2, 3]);
		const { bucket } = memoryBucket({ 'map-tiles/assets/glyphs/Noto Sans Medium/256-511.pbf': glyphs });
		const response = await serveMapAsset(bucket, 'glyphs/Noto Sans Medium/256-511.pbf');
		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toBe('application/x-protobuf');
		expect(new Uint8Array(await response.arrayBuffer())).toEqual(glyphs);
		expect((await serveMapAsset(bucket, 'glyphs/Noto Sans Medium/512-767.pbf')).status).toBe(404);
		expect((await serveMapAsset(bucket, 'other/file.txt')).status).toBe(404);
	});
});
