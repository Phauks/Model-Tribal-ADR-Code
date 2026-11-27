/**
 * Serves one map tile from a PMTiles file in the private bucket (decision record 0039). Kept apart from the route so the tests can give it a bucket of their own.
 *
 * A PMTiles file holds every tile of a tile set with a directory of where each one starts. The pmtiles library reads the file's header and directories with ranged reads and keeps them in memory, so after the first request a tile costs one ranged read from the bucket. Only the tile sets named in geography/map-tiles.json are served; any other name is "not found", whatever the bucket holds.
 *
 * Tiles are served as plain vector tiles (the library unzips them), and Cloudflare compresses them on the way out. Each set's name changes whenever its file does, so a tile never changes under its address and the browser may keep it for a year.
 */
import type { R2Bucket } from '@cloudflare/workers-types/index.ts';
import { PMTiles, SharedPromiseCache, type RangeResponse, type Source } from 'pmtiles';
import manifest from '../../../geography/map-tiles.json';

export interface TileSet {
	set: string;
	key: string;
	minZoom: number;
	maxZoom: number;
}

/** The tile sets the website serves, by the name in their address. */
export const tileSets: ReadonlyMap<string, TileSet> = new Map(
	[manifest.landAreas, manifest.basemap, manifest.worldBasemap, manifest.landCessions, manifest.landAreasByYear].map((entry) => [entry.set, entry])
);

/**
 * Where a tile is kept in a Cloudflare location's own cache across deploys
 * (src/lib/server/kept-answers.ts), or undefined for a tile set not served.
 * The key names every tile set served, since a basemap tile can come from the
 * world basemap: a new tile set, such as land areas rebuilt after a nation
 * withdraws one, changes every key, so no kept tile outlives its set.
 */
export function keptTileKey(origin: string, setName: string, z: number, x: number, y: number): string | undefined {
	if (!tileSets.has(setName) || !isTileAddress(z, x, y)) return undefined;
	const sets = [...tileSets.keys()].sort().join('+');
	return `${origin}/map-tiles/${setName}/${z}/${x}/${y}.mvt?sets=${encodeURIComponent(sets)}`;
}

/** The world basemap, served in place of a basemap tile outside the United States and its territories (tools/build-map-tiles.mjs). */
const worldFallback: ReadonlyMap<string, TileSet> = new Map([[manifest.basemap.set, manifest.worldBasemap]]);

/** Reads byte ranges of one file in the bucket. */
export class BucketSource implements Source {
	constructor(
		private readonly bucket: R2Bucket,
		private readonly key: string
	) {}

	getKey(): string {
		return this.key;
	}

	async getBytes(offset: number, length: number): Promise<RangeResponse> {
		const object = await this.bucket.get(this.key, { range: { offset, length } });
		if (!object || !('arrayBuffer' in object)) throw new Error(`The bucket has no ${this.key}`);
		return { data: await object.arrayBuffer(), etag: object.etag };
	}
}

const directories = new SharedPromiseCache(200);
const archives = new Map<string, PMTiles>();

/** Forgets the files read so far; for the tests, which give each case its own bucket. */
export function forgetMapTileFiles(): void {
	archives.clear();
}

function archiveFor(bucket: R2Bucket, tileSet: TileSet): PMTiles {
	let archive = archives.get(tileSet.key);
	if (!archive) {
		archive = new PMTiles(new BucketSource(bucket, tileSet.key), directories);
		archives.set(tileSet.key, archive);
	}
	return archive;
}

const tileHeaders = {
	'Content-Type': 'application/x-protobuf',
	'Cache-Control': 'public, max-age=31536000, immutable',
	'X-Content-Type-Options': 'nosniff',
	'Cross-Origin-Resource-Policy': 'same-origin'
};

/** Whether a tile address is one a map could ask for: whole numbers, and x and y inside the zoom level's grid. */
export function isTileAddress(z: number, x: number, y: number): boolean {
	if (![z, x, y].every(Number.isInteger) || z < 0 || z > 24) return false;
	const size = 2 ** z;
	return x >= 0 && y >= 0 && x < size && y < size;
}

/**
 * The response for /map-tiles/<set>/<z>/<x>/<y>.mvt. A tile the file does not hold (open sea, or beyond the set's zoom levels) is an empty answer (204), which MapLibre reads as "nothing to draw here", so a map never shows an error for it.
 */
export async function serveMapTile(bucket: R2Bucket, setName: string, z: number, x: number, y: number): Promise<Response> {
	const tileSet = tileSets.get(setName);
	if (!tileSet || !isTileAddress(z, x, y)) return new Response('No such map tile.', { status: 404, headers: { 'Cache-Control': 'no-store' } });
	if (z < tileSet.minZoom || z > tileSet.maxZoom) return new Response(null, { status: 204, headers: tileHeaders });
	let tile = await archiveFor(bucket, tileSet).getZxy(z, x, y);
	// The basemap holds only the tiles around the United States and its territories; elsewhere the world basemap, cut from the same build, has the tile, so a reader can move the map anywhere without a blank (Trevor, 2026-11-24).
	const world = worldFallback.get(setName);
	if ((!tile || tile.data.byteLength === 0) && world && z <= world.maxZoom) tile = await archiveFor(bucket, world).getZxy(z, x, y);
	if (!tile || tile.data.byteLength === 0) return new Response(null, { status: 204, headers: tileHeaders });
	return new Response(tile.data, { status: 200, headers: tileHeaders });
}

/**
 * The basemap's fonts and icons, from the Protomaps basemaps-assets repository (fonts under the SIL Open Font License, icons MIT), kept in the bucket under map-tiles/assets/ by tools/build-map-tiles.mjs. Only these files are served: label glyphs of the three Noto Sans fonts the basemap uses, and the light and dark icon sheets.
 */
const assetPattern = /^(glyphs\/Noto Sans (Regular|Medium|Italic)\/\d{1,5}-\d{1,5}\.pbf|sprites\/(white|black)(@2x)?\.(json|png))$/;

const assetTypes: Record<string, string> = {
	pbf: 'application/x-protobuf',
	json: 'application/json',
	png: 'image/png'
};

/** The bucket key of a map asset, or undefined for any path the map does not use. */
export function mapAssetKey(path: string): string | undefined {
	return assetPattern.test(path) ? `map-tiles/assets/${path}` : undefined;
}

/** The response for /map-tiles/assets/<path>. */
export async function serveMapAsset(bucket: R2Bucket, path: string): Promise<Response> {
	const key = mapAssetKey(path);
	const object = key ? await bucket.get(key) : null;
	if (!object || !('arrayBuffer' in object)) return new Response('No such map file.', { status: 404, headers: { 'Cache-Control': 'no-store' } });
	return new Response(await object.arrayBuffer(), {
		status: 200,
		headers: {
			'Content-Type': assetTypes[path.split('.').at(-1) ?? ''] ?? 'application/octet-stream',
			// A week: the files change only when the basemap's style does.
			'Cache-Control': 'public, max-age=604800',
			'X-Content-Type-Options': 'nosniff',
			'Cross-Origin-Resource-Policy': 'same-origin'
		}
	});
}
