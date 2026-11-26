// Builds the historic map layers and uploads them, with their sources, to the private bucket (Trevor, 2026-11-26: "Definitely grab the useful map core"; research/analyses/2026-11-26-historic-maps-of-indian-lands.md).
//
// Three things, all works of the United States government:
//
// - Land cessions: the U.S. Forest Service's tracing of the 718 cessions on Charles C. Royce's maps in Indian Land Cessions in the United States (1899). One PMTiles file, layer "cessions", each shape carrying Royce's number and the year of its first cession date. The facts shown for each cession (treaties, nations, map sheets) are in geography/land-cessions.json, written by scripts/maps/land_cessions.py, which also downloads the shapes (`fetch`).
// - Land areas by year: the Census Bureau's American Indian, Alaska Native and Native Hawaiian areas for 1990, 2000 and every year 2007 to 2026, in one PMTiles file, layer "land-areas". Each shape carries its Census code, its kind, and the first and last years ("from", "to") in which the Bureau drew it exactly so; a shape the Bureau redrew is a new shape from that year. The map shows a year by keeping the shapes whose years include the latest Census year at or before it. Hawaiian home lands are left out, as on the 2020 map, and so is every area in geography/withdrawn-land-areas.json.
// - Royce's 67 map sheets, the Library of Congress's scans (g3701em.gct00002), each as the Library's JPEG 2000 file and as a JPEG the site's image viewer can show, with the full volume as one PDF. geography/royce-sheets.json lists them with their bucket keys, sizes and SHA-256.
//
// The tiles are cut with geojson-vt and written with tools/pmtiles-writer.mjs, so no tippecanoe is needed. Turning the JPEG 2000 scans into JPEGs needs ImageMagick (`magick` or `convert`) with OpenJPEG.
//
// Run from site/:
//   python3 ../scripts/maps/land_cessions.py fetch --work /tmp/historic-maps
//   node tools/build-historic-maps.mjs fetch [--work /tmp/historic-maps]
//   node --max-old-space-size=8192 tools/build-historic-maps.mjs build [--work /tmp/historic-maps]
//   node tools/build-historic-maps.mjs upload [--work /tmp/historic-maps]
//   node tools/build-historic-maps.mjs index [--work /tmp/historic-maps]
//
// "index" adds a row for each file it uploaded (not the tiles) to research/capture-index.csv, replacing rows with the same key, so the site serves the sheets and the volume as copies (/copies/historic-maps/...) and every file in the bucket is accounted for.
//
// "build" records each tile set's key, size and SHA-256 in geography/map-tiles.json. "upload" puts the tiles, the sheets, the volume and every downloaded source file in the bucket (skipping a file already there with the same SHA-256), with credentials from the environment: R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and CLOUDFLARE_ACCOUNT_ID (or R2_ACCOUNT_ID). Upload before the change to geography/map-tiles.json is merged.

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { GeoJSONVT } from '@maplibre/geojson-vt';
import { fromGeojsonVt } from '@maplibre/vt-pbf';
import { unzipSync } from 'fflate';
import * as shapefile from 'shapefile';
import { writePmtiles } from './pmtiles-writer.mjs';

const geography = new URL('../geography/', import.meta.url);
const manifestPath = new URL('map-tiles.json', geography);
const sheetsPath = new URL('royce-sheets.json', geography);
const cessionsPath = new URL('land-cessions.json', geography);
const withdrawnPath = new URL('withdrawn-land-areas.json', geography);

const tiger = 'https://www2.census.gov/geo/tiger';
/** The Census Bureau's national files of American Indian areas, by year. 1990 is the Bureau's cartographic file; the rest are TIGER/Line files. */
export const censusYears = {
	1990: `${tiger}/PREVGENZ/aianhh/ir/ir99_d90_shp.zip`,
	2000: `${tiger}/TIGER2010/AIANNH/2000/tl_2010_us_aiannh00.zip`,
	2007: `${tiger}/TIGER2007FE/fe_2007_us_aiannh.zip`,
	2008: `${tiger}/TIGER2008/tl_2008_us_aiannh.zip`,
	2009: `${tiger}/TIGER2009/tl_2009_us_aiannh.zip`,
	2010: `${tiger}/TIGER2010/AIANNH/2010/tl_2010_us_aiannh10.zip`,
	...Object.fromEntries(Array.from({ length: 16 }, (_, index) => 2011 + index).map((year) => [year, `${tiger}/TIGER${year}/AIANNH/tl_${year}_us_aiannh.zip`]))
};

const sheetsItem = 'https://www.loc.gov/item/13023487/';
const volumeFile = 'https://tile.loc.gov/storage-services/public/law/llss4015/llss4015.pdf';

const cessionsMaxZoom = 10;
const landAreasMaxZoom = 12;

function option(name, fallback) {
	const index = process.argv.indexOf(`--${name}`);
	return index > 0 ? process.argv[index + 1] : fallback;
}

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

async function download(url, path) {
	if (existsSync(path) && statSync(path).size > 0) return;
	for (let attempt = 1; ; attempt += 1) {
		const response = await fetch(url, { headers: { 'User-Agent': 'model-tribal-code-maps/1.0' } });
		if (response.ok) {
			writeFileSync(path, new Uint8Array(await response.arrayBuffer()));
			return;
		}
		if (attempt === 4) throw new Error(`${url} answered ${response.status}`);
		await new Promise((resolve) => setTimeout(resolve, 3000 * attempt));
	}
}

/** Downloads the Census years and Royce's sheets and volume; the cession shapes come from scripts/maps/land_cessions.py. */
async function fetchSources() {
	const work = option('work', '/tmp/historic-maps');
	for (const folder of ['census', 'royce']) mkdirSync(join(work, folder), { recursive: true });
	for (const [year, url] of Object.entries(censusYears)) await download(url, join(work, 'census', `${year}.zip`));
	const item = await (await fetch(`${sheetsItem}?fo=json`)).json();
	const resource = item.resources.find((entry) => entry.url.includes('g3701em.gct00002'));
	for (const files of resource.files) {
		const jp2 = files.find((file) => file.mimetype === 'image/jp2');
		await download(jp2.url, join(work, 'royce', basename(jp2.url)));
		await new Promise((resolve) => setTimeout(resolve, 500)); // The Library asks robots to go slowly.
	}
	await download(volumeFile, join(work, 'royce', 'llss4015.pdf'));
	console.log(`Downloaded ${Object.keys(censusYears).length} Census years, ${resource.files.length} sheets and the volume to ${work}.`);
}

/** The same kinds as tools/build-map-tiles.mjs, by Census code range; null leaves the area out. */
function kindOf(code, legalStatus) {
	if (legalStatus === '88' || legalStatus === '90') return 'oklahoma-tribal-statistical-area';
	const number = Number(code);
	if (number < 5000) return 'federal-reservation-or-trust-land';
	if (number < 6000) return null; // Hawaiian home lands
	if (number < 8000) return 'alaska-native-village-statistical-area';
	if (number < 9000) return 'tribal-designated-statistical-area';
	if (number < 9500) return 'state-reservation';
	return 'state-designated-tribal-statistical-area';
}

/** A field of a Census record, whose name has a year suffix in some years (AIANNHCE00, AIANNHCE10). */
function field(properties, name) {
	for (const suffix of ['', '00', '10']) if (properties[`${name}${suffix}`] !== undefined) return properties[`${name}${suffix}`];
	return undefined;
}

/** Rounds to about a meter, so a shape the Bureau did not redraw hashes the same from year to year. */
function rounded(coordinates) {
	return typeof coordinates[0] === 'number' ? [Math.round(coordinates[0] * 1e5) / 1e5, Math.round(coordinates[1] * 1e5) / 1e5] : coordinates.map(rounded);
}

async function readCensusYear(path) {
	const files = unzipSync(readFileSync(path));
	const shp = Object.keys(files).find((name) => name.endsWith('.shp'));
	const dbf = shp.replace(/\.shp$/, '.dbf');
	return shapefile.read(files[shp].buffer.slice(files[shp].byteOffset, files[shp].byteOffset + files[shp].byteLength), files[dbf].buffer.slice(files[dbf].byteOffset, files[dbf].byteOffset + files[dbf].byteLength), { encoding: 'latin1' });
}

/** Cuts features into vector tiles, depth first, dropping each tile's working copy once its children are done so memory stays small. */
function cutTiles(features, layer, maxZoom) {
	const index = new GeoJSONVT({ type: 'FeatureCollection', features }, { maxZoom, indexMaxZoom: 4, indexMaxPoints: 0, tolerance: 3, extent: 4096, buffer: 64 });
	const tiles = new Map();
	const visit = (z, x, y) => {
		const tile = index.getTile(z, x, y);
		if (!tile || tile.features.length === 0) return;
		tiles.set(`${z}/${x}/${y}`, fromGeojsonVt({ [layer]: tile }, { version: 2, extent: 4096 }));
		if (z < maxZoom) for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) visit(z + 1, x * 2 + dx, y * 2 + dy);
		if (z > 4) delete index.tileIndex.tiles[((1 << z) * y + x) * 32 + z];
	};
	visit(0, 0, 0);
	return tiles;
}

function boundsOf(features) {
	const bounds = [180, 90, -180, -90];
	const walk = (coordinates) => {
		if (typeof coordinates[0] === 'number') {
			bounds[0] = Math.min(bounds[0], coordinates[0]);
			bounds[1] = Math.min(bounds[1], coordinates[1]);
			bounds[2] = Math.max(bounds[2], coordinates[0]);
			bounds[3] = Math.max(bounds[3], coordinates[1]);
		} else coordinates.forEach(walk);
	};
	for (const feature of features) walk(feature.geometry.coordinates);
	return bounds.map((value) => Math.round(value * 1e4) / 1e4);
}

function describe(path, set, extra) {
	const bytes = readFileSync(path);
	return { set, key: `map-tiles/${set}.pmtiles`, bytes: bytes.length, sha256: sha256(bytes), ...extra };
}

async function buildCessions(work) {
	const source = JSON.parse(readFileSync(join(work, 'cessions.geojson'), 'utf8'));
	const facts = JSON.parse(readFileSync(cessionsPath, 'utf8'));
	const known = new Map(facts.cessions.map((cession) => [cession.royce, cession]));
	const features = [];
	for (const feature of source.features) {
		const royce = Object.entries(feature.properties).find(([name]) => name.endsWith('.cessnum'))?.[1];
		const cession = known.get(royce);
		if (!feature.geometry || !cession || !cession.dates.length) continue;
		features.push({ type: 'Feature', geometry: { type: feature.geometry.type, coordinates: rounded(feature.geometry.coordinates) }, properties: { royce, year: Number(cession.dates[0].slice(0, 4)) } });
	}
	const tiles = cutTiles(features, 'cessions', cessionsMaxZoom);
	const bounds = boundsOf(features);
	const path = join(work, 'land-cessions.pmtiles');
	writePmtiles(path, tiles, { minZoom: 0, maxZoom: cessionsMaxZoom, bounds, metadata: { name: 'Land cessions', attribution: 'U.S. Forest Service, after Royce (1899)', vector_layers: [{ id: 'cessions', fields: { royce: 'String', year: 'Number' }, minzoom: 0, maxzoom: cessionsMaxZoom }] } });
	const described = describe(path, '', {});
	return {
		...describe(path, `land-cessions-${described.sha256.slice(0, 12)}`, {}),
		minZoom: 0,
		maxZoom: cessionsMaxZoom,
		bounds,
		layers: ['cessions'],
		features: features.length,
		sources: [facts.sources.shapes, facts.sources.schedule],
		retrieved: facts.retrieved
	};
}

async function buildLandAreasByYear(work) {
	const withdrawn = new Set(JSON.parse(readFileSync(withdrawnPath, 'utf8')).codes);
	const years = Object.keys(censusYears).map(Number);
	/** Each area's shapes by geometry hash, with the years the Bureau drew each. */
	const shapes = new Map();
	for (const year of years) {
		const collection = await readCensusYear(join(work, 'census', `${year}.zip`));
		for (const feature of collection.features) {
			if (!feature.geometry) continue;
			const properties = feature.properties;
			const code = String(field(properties, 'AIANNHCE') ?? properties.IR ?? '').padStart(4, '0');
			const kind = kindOf(code, field(properties, 'LSAD'));
			if (!kind || withdrawn.has(code)) continue;
			const part = field(properties, 'COMPTYP') ?? '';
			const geometry = { type: feature.geometry.type, coordinates: rounded(feature.geometry.coordinates) };
			const key = `${code}${part}:${sha256(JSON.stringify(geometry.coordinates))}`;
			const shape = shapes.get(key);
			if (shape) shape.years.push(year);
			else shapes.set(key, { code, kind, geometry, years: [year] });
		}
		console.log(`Read ${year}: ${shapes.size} shapes so far.`);
	}
	// A shape drawn in two years with a different shape between them becomes two runs of years.
	const features = [];
	for (const shape of shapes.values()) {
		let run = [shape.years[0]];
		const flush = () => features.push({ type: 'Feature', geometry: shape.geometry, properties: { code: shape.code, kind: shape.kind, from: run[0], to: run[run.length - 1] } });
		for (const year of shape.years.slice(1)) {
			if (years.indexOf(year) === years.indexOf(run[run.length - 1]) + 1) run.push(year);
			else {
				flush();
				run = [year];
			}
		}
		flush();
	}
	console.log(`${features.length} shapes across ${years.length} years.`);
	const tiles = cutTiles(features, 'land-areas', landAreasMaxZoom);
	const bounds = boundsOf(features);
	const path = join(work, 'land-areas-by-year.pmtiles');
	writePmtiles(path, tiles, { minZoom: 0, maxZoom: landAreasMaxZoom, bounds, metadata: { name: 'Land areas by year', attribution: 'U.S. Census Bureau', vector_layers: [{ id: 'land-areas', fields: { code: 'String', kind: 'String', from: 'Number', to: 'Number' }, minzoom: 0, maxzoom: landAreasMaxZoom }] } });
	const described = describe(path, '', {});
	return {
		...describe(path, `land-areas-by-year-${described.sha256.slice(0, 12)}`, {}),
		minZoom: 0,
		maxZoom: landAreasMaxZoom,
		bounds,
		layers: ['land-areas'],
		years,
		features: features.length,
		sources: Object.values(censusYears),
		retrieved: new Date().toISOString().slice(0, 10),
		left_out: 'Hawaiian home lands; areas in geography/withdrawn-land-areas.json'
	};
}

function imageTool() {
	for (const name of ['magick', 'convert']) {
		try {
			execFileSync('which', [name], { stdio: 'ignore' });
			return name;
		} catch {
			// Try the next name.
		}
	}
	throw new Error('Install ImageMagick with OpenJPEG to turn the JPEG 2000 sheets into JPEGs.');
}

function buildSheets(work) {
	const tool = imageTool();
	const facts = JSON.parse(readFileSync(cessionsPath, 'utf8'));
	const names = new Map(facts.sheets.map((sheet) => [sheet.plate, sheet.name]));
	const folder = join(work, 'royce');
	const jpegs = join(work, 'royce-jpeg');
	mkdirSync(jpegs, { recursive: true });
	const sheets = [];
	for (const file of readdirSync(folder).filter((name) => name.endsWith('.jp2')).sort()) {
		const plate = Number(file.match(/(\d+)\.jp2$/)[1]);
		const jpeg = join(jpegs, file.replace(/\.jp2$/, '.jpg'));
		const thumbnail = join(jpegs, file.replace(/\.jp2$/, '-small.jpg'));
		if (!existsSync(jpeg)) execFileSync(tool, [join(folder, file), '-quality', '85', jpeg]);
		if (!existsSync(thumbnail)) execFileSync(tool, [jpeg, '-resize', '240x240', '-quality', '80', thumbnail]);
		const entry = (path, key, mediaType) => {
			const bytes = readFileSync(path);
			return { key, media_type: mediaType, bytes: bytes.length, sha256: sha256(bytes) };
		};
		sheets.push({
			plate,
			name: names.get(plate) ?? null,
			link: `https://www.loc.gov/resource/g3701em.gct00002/?sp=${plate}`,
			original: { ...entry(join(folder, file), `historic-maps/royce-1899/${file}`, 'image/jp2'), link: `https://tile.loc.gov/storage-services/service/gmd/gmd370m/g3701m/g3701em/gct00002/${file}` },
			image: entry(jpeg, `historic-maps/royce-1899/${basename(jpeg)}`, 'image/jpeg'),
			thumbnail: entry(thumbnail, `historic-maps/royce-1899/${basename(thumbnail)}`, 'image/jpeg')
		});
	}
	const volume = readFileSync(join(folder, 'llss4015.pdf'));
	const result = {
		description: "Charles C. Royce's map sheets for Indian Land Cessions in the United States (1899), the Library of Congress's scans, kept in the bucket and shown in the site's image viewer, with the whole volume. Written by tools/build-historic-maps.mjs. Public domain.",
		item: sheetsItem,
		title: 'Indian Land Cessions in the United States',
		author: 'Charles C. Royce',
		published: 'Eighteenth Annual Report of the Bureau of American Ethnology, part 2 (1899); H.R. Doc. No. 56-736, Serial Set 4015',
		rights: 'Public domain: a work of the United States government; the Library of Congress marks it free to use and reuse.',
		volume: { key: 'historic-maps/royce-1899/llss4015.pdf', media_type: 'application/pdf', bytes: volume.length, sha256: sha256(volume), link: volumeFile },
		sheets
	};
	writeFileSync(sheetsPath, `${JSON.stringify(result, null, '\t')}\n`);
	console.log(`Wrote ${sheets.length} sheets to geography/royce-sheets.json.`);
}

async function build() {
	const work = option('work', '/tmp/historic-maps');
	const only = option('only', 'all');
	const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
	if (only === 'all' || only === 'cessions') manifest.landCessions = await buildCessions(work);
	if (only === 'all' || only === 'land-areas') manifest.landAreasByYear = await buildLandAreasByYear(work);
	writeFileSync(manifestPath, `${JSON.stringify(manifest, null, '\t')}\n`);
	if (only === 'all' || only === 'sheets') buildSheets(work);
	console.log('Recorded the tile sets in geography/map-tiles.json.');
}

function bucketClient() {
	return import('aws4fetch').then(({ AwsClient }) => {
		const account = process.env.R2_ACCOUNT_ID ?? process.env.CLOUDFLARE_ACCOUNT_ID;
		if (!account || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) throw new Error('Set R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and CLOUDFLARE_ACCOUNT_ID (or R2_ACCOUNT_ID).');
		const client = new AwsClient({ accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY, service: 's3', region: 'auto' });
		return { client, base: `https://${account}.r2.cloudflarestorage.com/${process.env.R2_BUCKET ?? 'model-tribal-adr-code-sources'}` };
	});
}

/** Puts every file in the bucket, eight at a time, skipping files already there with the same SHA-256. Files here are under 200 MB, so each goes in one request. */
async function upload() {
	const work = option('work', '/tmp/historic-maps');
	const { client, base } = await bucketClient();
	const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
	const sheets = JSON.parse(readFileSync(sheetsPath, 'utf8'));
	const files = [
		[join(work, 'land-cessions.pmtiles'), manifest.landCessions.key, 'application/vnd.pmtiles'],
		[join(work, 'land-areas-by-year.pmtiles'), manifest.landAreasByYear.key, 'application/vnd.pmtiles'],
		[join(work, 'royce', 'llss4015.pdf'), sheets.volume.key, 'application/pdf'],
		[join(work, 'cessions.geojson'), 'historic-maps/forest-service-land-cessions/cessions.geojson', 'application/geo+json'],
		[join(work, 'cessions-table.json'), 'historic-maps/forest-service-land-cessions/cessions-table.json', 'application/json'],
		...Object.keys(censusYears).map((year) => [join(work, 'census', `${year}.zip`), `historic-maps/census-land-areas/${basename(censusYears[year])}`, 'application/zip']),
		...sheets.sheets.flatMap((sheet) => [
			[join(work, 'royce', basename(sheet.original.key)), sheet.original.key, 'image/jp2'],
			[join(work, 'royce-jpeg', basename(sheet.image.key)), sheet.image.key, 'image/jpeg'],
			[join(work, 'royce-jpeg', basename(sheet.thumbnail.key)), sheet.thumbnail.key, 'image/jpeg']
		])
	];
	let sent = 0;
	let skipped = 0;
	const queue = [...files];
	async function worker() {
		for (let next = queue.shift(); next; next = queue.shift()) {
			const [path, key, contentType] = next;
			const bytes = readFileSync(path);
			const hash = sha256(bytes);
			const address = `${base}/${key.split('/').map(encodeURIComponent).join('/')}`;
			const head = await client.fetch(address, { method: 'HEAD' });
			if (head.ok && head.headers.get('x-amz-meta-sha256') === hash) {
				skipped += 1;
				continue;
			}
			let response;
			for (let attempt = 1; attempt <= 4; attempt += 1) {
				response = await client.fetch(address, { method: 'PUT', body: bytes, headers: { 'Content-Type': contentType, 'x-amz-meta-sha256': hash } });
				if (response.ok) break;
				await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
			}
			if (!response.ok) throw new Error(`The bucket refused ${key}: ${response.status}`);
			sent += 1;
		}
	}
	await Promise.all(Array.from({ length: 8 }, worker));
	console.log(`Uploaded ${sent} files; ${skipped} were already in the bucket.`);
}

const roycesRecord = 'royce-1899-indian-land-cessions-in-the-united-states';
const indexPath = new URL('../../research/capture-index.csv', import.meta.url);
const indexColumns = ['key', 'bytes', 'sha256', 'media_type', 'topic', 'title', 'nations', 'obtained', 'link', 'captured', 'records', 'record_kinds', 'listed_in', 'catalog', 'derived_from', 'rights', 'redistribution', 'keep_local', 'orphan'];
const csvField = (value) => (/[",\n]/.test(String(value)) ? `"${String(value).replaceAll('"', '""')}"` : String(value));

/** Adds the uploaded files to the capture index (research/capture-index.csv). */
function index() {
	const work = option('work', '/tmp/historic-maps');
	const sheets = JSON.parse(readFileSync(sheetsPath, 'utf8'));
	const today = new Date().toISOString().slice(0, 10);
	const governmentWork = 'United States government work (17 U.S.C. § 105).';
	const file = (path) => {
		const bytes = readFileSync(path);
		return { bytes: bytes.length, sha256: sha256(bytes) };
	};
	const row = (fields) => ({ topic: 'historic-maps', nations: '', captured: today, record_kinds: 'source', listed_in: '', catalog: '', derived_from: '', rights: governmentWork, redistribution: 'yes', keep_local: 'no', orphan: 'no', ...fields });
	const rows = [
		row({ key: sheets.volume.key, bytes: sheets.volume.bytes, sha256: sheets.volume.sha256, media_type: 'application/pdf', title: `${sheets.author}, ${sheets.title} (1899)`, obtained: `downloaded from the Library of Congress by script, ${today}`, link: sheets.volume.link, records: roycesRecord }),
		...sheets.sheets.flatMap((sheet) => {
			const name = sheet.name ?? `plate ${sheet.plate}`;
			const title = `${sheets.author}, ${sheets.title} (1899), map: ${name}`;
			return [
				row({ key: sheet.original.key, bytes: sheet.original.bytes, sha256: sheet.original.sha256, media_type: 'image/jp2', title, obtained: `downloaded from the Library of Congress by script, ${today}`, link: sheet.link, records: roycesRecord }),
				row({ key: sheet.image.key, bytes: sheet.image.bytes, sha256: sheet.image.sha256, media_type: 'image/jpeg', title, obtained: `made from the Library of Congress's JPEG 2000 scan by tools/build-historic-maps.mjs, ${today}`, link: sheet.link, records: roycesRecord }),
				row({ key: sheet.thumbnail.key, bytes: sheet.thumbnail.bytes, sha256: sheet.thumbnail.sha256, media_type: 'image/jpeg', title: `${title} (small)`, obtained: `made from the Library of Congress's JPEG 2000 scan by tools/build-historic-maps.mjs, ${today}`, link: sheet.link, records: roycesRecord })
			];
		}),
		...['cessions.geojson', 'cessions-table.json'].map((name) => {
			const found = file(join(work, name));
			return row({ key: `historic-maps/forest-service-land-cessions/${name}`, ...found, media_type: name.endsWith('geojson') ? 'application/geo+json' : 'application/json', title: `U.S. Forest Service, Indian Land Cessions in the United States, ${name.endsWith('geojson') ? 'cession shapes' : 'cession table'}`, obtained: `downloaded from the Forest Service's map service by scripts/maps/land_cessions.py, ${today}`, link: 'https://apps.fs.usda.gov/arcx/rest/services/EDW/EDW_TribalCessionLands_01/MapServer', records: 'forest-service-indian-land-cessions' });
		}),
		...Object.entries(censusYears).map(([year, url]) => row({ key: `historic-maps/census-land-areas/${basename(url)}`, ...file(join(work, 'census', `${year}.zip`)), media_type: 'application/zip', title: `U.S. Census Bureau, American Indian/Alaska Native/Native Hawaiian Areas, ${year}`, obtained: `downloaded from the Census Bureau by tools/build-historic-maps.mjs, ${today}`, link: url, records: 'census-tiger-aiannh-1990-2026' }))
	];
	const keys = new Set(rows.map((entry) => entry.key));
	const lines = readFileSync(indexPath, 'utf8').split('\n').filter((line) => line !== '');
	// Rows already in the index keep their place; only the rows for these keys are replaced, at the end.
	const kept = lines.filter((line, number) => number === 0 || !keys.has(line.split(',')[0].replace(/^"|"$/g, '')));
	const added = rows.map((entry) => indexColumns.map((column) => csvField(entry[column] ?? '')).join(','));
	writeFileSync(indexPath, `${[...kept, ...added].join('\n')}\n`);
	console.log(`Indexed ${rows.length} files in research/capture-index.csv.`);
}

const command = process.argv[2];
if (command === 'fetch') await fetchSources();
else if (command === 'build') await build();
else if (command === 'upload') await upload();
else if (command === 'index') index();
else console.log('Usage: node tools/build-historic-maps.mjs fetch|build|upload|index [--work folder] [--only cessions|land-areas|sheets]');
