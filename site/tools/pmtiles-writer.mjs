// Writes a PMTiles version 3 file (https://github.com/protomaps/PMTiles/blob/main/spec/v3/spec.md) from tiles held in memory, for map tiles the site builds itself without tippecanoe (tools/build-historic-maps.mjs).
//
// Tiles are gzipped Mapbox Vector Tiles. Identical tiles (such as the many tiles wholly inside one large shape) are stored once and addressed by run length, as the spec allows. The directory is one root directory when it fits in the first 16 KB, as readers expect, and otherwise a root of leaf directories.

import { createHash } from 'node:crypto';
import { closeSync, openSync, writeSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { zxyToTileId } from 'pmtiles';

const headerBytes = 127;
const rootLimit = 16384 - headerBytes;

function varint(out, value) {
	while (value >= 0x80) {
		out.push((value % 0x80) | 0x80);
		value = Math.floor(value / 0x80);
	}
	out.push(value);
}

function directory(entries) {
	const out = [];
	varint(out, entries.length);
	let last = 0;
	for (const entry of entries) {
		varint(out, entry.tileId - last);
		last = entry.tileId;
	}
	for (const entry of entries) varint(out, entry.runLength);
	for (const entry of entries) varint(out, entry.length);
	entries.forEach((entry, index) => {
		const previous = entries[index - 1];
		varint(out, previous && entry.offset === previous.offset + previous.length ? 0 : entry.offset + 1);
	});
	return gzipSync(Buffer.from(out));
}

/** Splits the entries into leaf directories until the root fits in the first 16 KB. */
function directories(entries) {
	const root = directory(entries);
	if (root.length <= rootLimit) return { root, leaves: Buffer.alloc(0) };
	for (let size = 4096; ; size *= 2) {
		const rootEntries = [];
		const leafParts = [];
		let offset = 0;
		for (let start = 0; start < entries.length; start += size) {
			const leaf = directory(entries.slice(start, start + size));
			rootEntries.push({ tileId: entries[start].tileId, offset, length: leaf.length, runLength: 0 });
			leafParts.push(leaf);
			offset += leaf.length;
		}
		const packed = directory(rootEntries);
		if (packed.length <= rootLimit) return { root: packed, leaves: Buffer.concat(leafParts) };
	}
}

function int64(buffer, offset, value) {
	buffer.writeBigUInt64LE(BigInt(value), offset);
}

/**
 * Writes the file.
 * @param {string} path
 * @param {Map<string, Uint8Array>} tiles uncompressed vector tiles keyed "z/x/y"
 * @param {{ minZoom: number, maxZoom: number, bounds: number[], metadata: object }} options
 */
export function writePmtiles(path, tiles, { minZoom, maxZoom, bounds, metadata }) {
	const sorted = [...tiles.entries()]
		.map(([key, data]) => {
			const [z, x, y] = key.split('/').map(Number);
			return { tileId: zxyToTileId(z, x, y), data };
		})
		.sort((a, b) => a.tileId - b.tileId);
	const contents = new Map();
	const chunks = [];
	const entries = [];
	let dataLength = 0;
	for (const { tileId, data } of sorted) {
		const hash = createHash('sha256').update(data).digest('hex');
		let stored = contents.get(hash);
		if (!stored) {
			const packed = gzipSync(data);
			stored = { offset: dataLength, length: packed.length };
			contents.set(hash, stored);
			chunks.push(packed);
			dataLength += packed.length;
		}
		const previous = entries[entries.length - 1];
		if (previous && previous.offset === stored.offset && previous.tileId + previous.runLength === tileId) previous.runLength += 1;
		else entries.push({ tileId, offset: stored.offset, length: stored.length, runLength: 1 });
	}
	const { root, leaves } = directories(entries);
	const meta = gzipSync(Buffer.from(JSON.stringify(metadata)));
	const header = Buffer.alloc(headerBytes);
	header.write('PMTiles', 0, 'ascii');
	header.writeUInt8(3, 7);
	const rootOffset = headerBytes;
	const metaOffset = rootOffset + root.length;
	const leafOffset = metaOffset + meta.length;
	const dataOffset = leafOffset + leaves.length;
	int64(header, 8, rootOffset);
	int64(header, 16, root.length);
	int64(header, 24, metaOffset);
	int64(header, 32, meta.length);
	int64(header, 40, leafOffset);
	int64(header, 48, leaves.length);
	int64(header, 56, dataOffset);
	int64(header, 64, dataLength);
	int64(header, 72, sorted.length);
	int64(header, 80, entries.length);
	int64(header, 88, contents.size);
	header.writeUInt8(1, 96); // clustered: tiles are in tile id order
	header.writeUInt8(2, 97); // directories gzipped
	header.writeUInt8(2, 98); // tiles gzipped
	header.writeUInt8(1, 99); // Mapbox Vector Tiles
	header.writeUInt8(minZoom, 100);
	header.writeUInt8(maxZoom, 101);
	header.writeInt32LE(Math.round(bounds[0] * 1e7), 102);
	header.writeInt32LE(Math.round(bounds[1] * 1e7), 106);
	header.writeInt32LE(Math.round(bounds[2] * 1e7), 110);
	header.writeInt32LE(Math.round(bounds[3] * 1e7), 114);
	header.writeUInt8(minZoom, 118);
	header.writeInt32LE(Math.round(((bounds[0] + bounds[2]) / 2) * 1e7), 119);
	header.writeInt32LE(Math.round(((bounds[1] + bounds[3]) / 2) * 1e7), 123);
	const file = openSync(path, 'w');
	try {
		for (const part of [header, root, meta, leaves, ...chunks]) writeSync(file, part);
	} finally {
		closeSync(file);
	}
	return { tiles: sorted.length, entries: entries.length, contents: contents.size, bytes: dataOffset + dataLength };
}
