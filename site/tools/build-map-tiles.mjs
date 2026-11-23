// Builds the map tiles that the website's map draws with MapLibre (decision record 0039), and uploads them to the private bucket.
//
// Two tile sets, each one PMTiles file:
//
// - Land areas and states: the U.S. Census Bureau's 2020 cartographic boundary files (1:500,000) of American Indian and Alaska Native areas and of states and territories, at full detail, built with tippecanoe. Hawaiian home lands are left out, as on the drawn map, and so is every area in geography/withdrawn-land-areas.json. Each area carries only its Census code and kind; names and the nations linked to each area come from the nation records when the site is built, so a renamed nation needs no new tiles.
// - Basemap: towns, roads, water and borders from OpenStreetMap, in the Protomaps basemap's daily build, cut to the United States and its territories (geography/map-tile-region.json) up to zoom 12 with the pmtiles tool.
//
// It also writes geography/census-land-area-points-2020.json: for each area, the point to label it at (inside its largest piece), its bounding box and its size, which the map uses for the dots of small areas and to fit a nation's areas on its page.
//
// Needs tippecanoe (https://github.com/felt/tippecanoe) and the pmtiles tool (https://github.com/protomaps/go-pmtiles, `go install github.com/protomaps/go-pmtiles@latest`, installed as `go-pmtiles` or `pmtiles`) on the PATH.
//
// Run from site/:
//   node tools/build-map-tiles.mjs build [--basemap-build 20261122] [--work /tmp/map-tiles]
//   node tools/build-map-tiles.mjs upload [--work /tmp/map-tiles]
//   node tools/build-map-tiles.mjs upload-assets --assets path/to/basemaps-assets
//
// "build" writes the two files to the work folder and records their bucket keys, sizes and SHA-256 in geography/map-tiles.json. "upload" puts them in the bucket (skipping a file already there with the same SHA-256), with credentials from the environment: R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and CLOUDFLARE_ACCOUNT_ID (or R2_ACCOUNT_ID); R2_BUCKET changes the bucket. Upload before the change to geography/map-tiles.json is merged, so the live site never names a file the bucket lacks.
//
// "upload-assets" puts the basemap's label fonts (Noto Sans Regular, Medium and Italic, SIL Open Font License) and its light and dark icon sheets (MIT) in the bucket under map-tiles/assets/, from a checkout of https://github.com/protomaps/basemaps-assets (`git clone --depth 1 --filter=blob:none --sparse https://github.com/protomaps/basemaps-assets`, then `git sparse-checkout set "fonts/Noto Sans Regular" "fonts/Noto Sans Medium" "fonts/Noto Sans Italic" sprites/v4`), and records the checkout's commit in geography/map-tiles.json.

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { closeSync, createReadStream, existsSync, mkdirSync, openSync, readdirSync, readFileSync, readSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { geoArea, geoBounds } from 'd3-geo';
import { unzipSync } from 'fflate';
import { bytesToHeader } from 'pmtiles';
import polylabel from 'polylabel';
import * as shapefile from 'shapefile';

const geography = new URL('../geography/', import.meta.url);
const manifestPath = new URL('map-tiles.json', geography);
const pointsPath = new URL('census-land-area-points-2020.json', geography);
const regionPath = new URL('map-tile-region.json', geography);
const withdrawnPath = new URL('withdrawn-land-areas.json', geography);

const landAreasFile = 'https://www2.census.gov/geo/tiger/GENZ2020/shp/cb_2020_us_aiannh_500k.zip';
const statesFile = 'https://www2.census.gov/geo/tiger/GENZ2020/shp/cb_2020_us_state_500k.zip';
const basemapBuilds = 'https://build-metadata.protomaps.dev/builds.json';
const basemapBuild = (name) => `https://build.protomaps.com/${name}.pmtiles`;

/** The basemap's deepest zoom: about 38 meters a pixel, enough to see streets around the smallest rancheria (project choice; zoom 12 for the region is about 2.2 GB). MapLibre enlarges zoom 12 tiles for closer views. */
const basemapMaxZoom = 12;
/** The land areas' deepest zoom. Tippecanoe keeps full detail at its deepest zoom, which MapLibre enlarges for closer views. */
const landAreasMaxZoom = 12;

const squareKilometers = 6371.0 ** 2;

function option(name, fallback) {
	const index = process.argv.indexOf(`--${name}`);
	return index > 0 ? process.argv[index + 1] : fallback;
}

function tool(...names) {
	for (const name of names) {
		try {
			execFileSync('which', [name], { stdio: 'ignore' });
			return name;
		} catch {
			// Try the next name.
		}
	}
	throw new Error(`Install ${names[0]} first (see the comment at the top of this file).`);
}

async function download(url) {
	const response = await fetch(url);
	if (!response.ok) throw new Error(`${url} answered ${response.status} ${response.statusText}`);
	return new Uint8Array(await response.arrayBuffer());
}

async function readShapefile(url, name) {
	const files = unzipSync(await download(url));
	const shp = files[`${name}.shp`];
	const dbf = files[`${name}.dbf`];
	if (!shp || !dbf) throw new Error(`${url} has no ${name}.shp and .dbf`);
	return shapefile.read(shp.buffer, dbf.buffer, { encoding: 'utf-8' });
}

/** The same kinds as tools/fetch-census-land-areas.mjs, by Census code range; null leaves the area out. */
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

const rounded = (value, places) => Math.round(value * 10 ** places) / 10 ** places;

/** Where to put an area's label: the point deepest inside its largest piece, so it never falls in a hole or outside a crescent. */
function labelPoint(geometry) {
	const pieces = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
	let largest = pieces[0];
	let largestArea = -1;
	for (const piece of pieces) {
		const area = geoArea({ type: 'Polygon', coordinates: piece });
		if (area > largestArea) {
			largestArea = area;
			largest = piece;
		}
	}
	const point = polylabel(largest, 0.0005);
	return [rounded(point[0], 5), rounded(point[1], 5)];
}

function sha256Of(path) {
	return new Promise((resolve, reject) => {
		const hash = createHash('sha256');
		createReadStream(path)
			.on('data', (chunk) => hash.update(chunk))
			.on('end', () => resolve(hash.digest('hex')))
			.on('error', reject);
	});
}

function headerOf(path) {
	const handle = openSync(path, 'r');
	const bytes = Buffer.alloc(127);
	readSync(handle, bytes, 0, 127, 0);
	closeSync(handle);
	return bytesToHeader(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + 127), undefined);
}

async function describe(path, set, extra) {
	const header = headerOf(path);
	return {
		set,
		key: `map-tiles/${set}.pmtiles`,
		bytes: statSync(path).size,
		sha256: await sha256Of(path),
		minZoom: header.minZoom,
		maxZoom: header.maxZoom,
		bounds: [header.minLon, header.minLat, header.maxLon, header.maxLat].map((value) => rounded(value, 4)),
		...extra
	};
}

async function build() {
	const work = option('work', '/tmp/map-tiles');
	mkdirSync(work, { recursive: true });
	const tippecanoe = tool('tippecanoe');
	const pmtiles = tool('go-pmtiles', 'pmtiles');
	const withdrawn = new Set(JSON.parse(readFileSync(withdrawnPath, 'utf8')).codes);
	const retrieved = new Date().toISOString().slice(0, 10);

	const landAreas = await readShapefile(landAreasFile, 'cb_2020_us_aiannh_500k');
	const areaLines = [];
	const points = [];
	for (const area of landAreas.features) {
		const { AIANNHCE: code, NAMELSAD: name, LSAD: legalStatus } = area.properties;
		const kind = kindOf(code, legalStatus);
		if (!kind || withdrawn.has(code)) continue;
		areaLines.push(JSON.stringify({ type: 'Feature', id: Number(code), properties: { code, kind }, geometry: area.geometry }));
		const [[west, south], [east, north]] = geoBounds(area);
		points.push({
			code,
			name,
			kind,
			square_kilometers: rounded(geoArea(area) * squareKilometers, 2),
			point: labelPoint(area.geometry),
			bounds: [west, south, east, north].map((value) => rounded(value, 4))
		});
	}
	points.sort((first, second) => first.code.localeCompare(second.code));

	const states = await readShapefile(statesFile, 'cb_2020_us_state_500k');
	const stateLines = states.features.map((state) =>
		JSON.stringify({ type: 'Feature', properties: { code: state.properties.STUSPS }, geometry: state.geometry })
	);

	const areasPath = join(work, 'land-areas.geojsonl');
	const statesPath = join(work, 'states.geojsonl');
	writeFileSync(areasPath, `${areaLines.join('\n')}\n`);
	writeFileSync(statesPath, `${stateLines.join('\n')}\n`);
	const landTiles = join(work, 'land-areas.pmtiles');
	// -r1 keeps every area at every zoom (no thinning of crowded places), and --no-tiny-polygon-reduction keeps small areas as shapes rather than specks.
	execFileSync(
		tippecanoe,
		[
			'--quiet', '--force', '--output', landTiles,
			'--minimum-zoom=0', `--maximum-zoom=${landAreasMaxZoom}`, '--drop-rate=1',
			'--no-tiny-polygon-reduction', '--no-feature-limit', '--no-tile-size-limit', '--detect-shared-borders',
			'--name=Land areas and states', '--attribution=U.S. Census Bureau',
			'--named-layer', `land-areas:${areasPath}`, '--named-layer', `states:${statesPath}`
		],
		{ stdio: 'inherit' }
	);

	const builds = JSON.parse(new TextDecoder().decode(await download(basemapBuilds)));
	const build = option('basemap-build', builds.at(-1).key.replace('.pmtiles', ''));
	const basemapTiles = join(work, 'basemap.pmtiles');
	execFileSync(pmtiles, ['extract', basemapBuild(build), basemapTiles, `--region=${regionPath.pathname}`, `--maxzoom=${basemapMaxZoom}`], { stdio: 'inherit' });

	const landSha = await sha256Of(landTiles);
	const manifest = {
		description: 'The map tiles the website serves from the private bucket at /map-tiles/<set>/<z>/<x>/<y>.mvt. Written by tools/build-map-tiles.mjs; upload the files before merging a change here.',
		landAreas: await describe(landTiles, `land-areas-${landSha.slice(0, 12)}`, {
			layers: ['land-areas', 'states'],
			sources: [landAreasFile, statesFile],
			source_records: ['census-cartographic-boundary-aiannh-2020', 'census-cartographic-boundary-states-2020'],
			retrieved,
			left_out: 'Hawaiian home lands; areas in geography/withdrawn-land-areas.json'
		}),
		basemap: await describe(basemapTiles, `basemap-${build}`, {
			source: basemapBuild(build),
			license: 'Open Database License produced work; OpenStreetMap attribution required',
			attribution: '© OpenStreetMap contributors',
			region: 'geography/map-tile-region.json',
			retrieved
		})
	};
	// The fonts and icon sheets are uploaded on their own (upload-assets), so their entry is kept.
	if (existsSync(manifestPath)) manifest.assets = JSON.parse(readFileSync(manifestPath, 'utf8')).assets;
	writeFileSync(manifestPath, `${JSON.stringify(manifest, null, '\t')}\n`);
	const pointsFile = {
		metadata: {
			source: 'census-cartographic-boundary-aiannh-2020',
			file: landAreasFile,
			retrieved,
			left_out: manifest.landAreas.left_out,
			point: 'inside the largest piece (polylabel, about 50 meters)',
			bounds: '[west, south, east, north] in degrees'
		},
		areas: points
	};
	writeFileSync(pointsPath, `${JSON.stringify(pointsFile)}\n`);
	console.log(`Built ${points.length} land areas (${manifest.landAreas.bytes.toLocaleString('en-US')} bytes) and basemap ${build} (${manifest.basemap.bytes.toLocaleString('en-US')} bytes) in ${work}.`);
}

function bucketClient() {
	return import('aws4fetch').then(({ AwsClient }) => {
		const account = process.env.R2_ACCOUNT_ID ?? process.env.CLOUDFLARE_ACCOUNT_ID;
		if (!account || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
			throw new Error('Set R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and CLOUDFLARE_ACCOUNT_ID (or R2_ACCOUNT_ID).');
		}
		const client = new AwsClient({ accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY, service: 's3', region: 'auto' });
		const bucket = process.env.R2_BUCKET ?? 'model-tribal-adr-code-sources';
		return { client, base: `https://${account}.r2.cloudflarestorage.com/${bucket}` };
	});
}

const assetFonts = ['Noto Sans Regular', 'Noto Sans Medium', 'Noto Sans Italic'];
const assetSprites = ['white', 'black'].flatMap((name) => [`${name}.json`, `${name}.png`, `${name}@2x.json`, `${name}@2x.png`]);

/** Uploads the basemap's fonts and icon sheets, sixteen at a time, skipping files already there with the same SHA-256. */
async function uploadAssets() {
	const folder = option('assets');
	if (!folder || !existsSync(join(folder, 'fonts'))) throw new Error('Give --assets, a checkout of protomaps/basemaps-assets (see the comment at the top of this file).');
	const { client, base } = await bucketClient();
	const files = [];
	for (const font of assetFonts) {
		for (const name of readdirSync(join(folder, 'fonts', font))) {
			if (name.endsWith('.pbf')) files.push([join(folder, 'fonts', font, name), `glyphs/${font}/${name}`]);
		}
	}
	for (const name of assetSprites) files.push([join(folder, 'sprites', 'v4', name), `sprites/${name}`]);
	let sent = 0;
	let skipped = 0;
	const queue = [...files];
	async function worker() {
		for (let next = queue.shift(); next; next = queue.shift()) {
			const [path, name] = next;
			const bytes = readFileSync(path);
			const sha256 = createHash('sha256').update(bytes).digest('hex');
			const address = `${base}/map-tiles/assets/${name.split('/').map(encodeURIComponent).join('/')}`;
			const head = await client.fetch(address, { method: 'HEAD' });
			if (head.ok && head.headers.get('x-amz-meta-sha256') === sha256) {
				skipped += 1;
				continue;
			}
			const response = await client.fetch(address, { method: 'PUT', body: bytes, headers: { 'x-amz-meta-sha256': sha256 } });
			if (!response.ok) throw new Error(`The bucket refused ${name}: ${response.status}`);
			sent += 1;
		}
	}
	await Promise.all(Array.from({ length: 16 }, worker));
	const commit = execFileSync('git', ['-C', folder, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
	const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
	manifest.assets = {
		prefix: 'map-tiles/assets/',
		source: `https://github.com/protomaps/basemaps-assets/tree/${commit}`,
		fonts: assetFonts,
		font_license: 'SIL Open Font License 1.1',
		sprites: assetSprites,
		sprite_license: 'MIT (derived from tangrams/icons)',
		files: files.length
	};
	writeFileSync(manifestPath, `${JSON.stringify(manifest, null, '\t')}\n`);
	console.log(`Uploaded ${sent} map files; ${skipped} were already in the bucket.`);
}

/** Uploads one file to R2 through its S3 interface, in 64 MB parts, recording its SHA-256 as metadata. */
async function upload() {
	const { client, base } = await bucketClient();
	const work = option('work', '/tmp/map-tiles');
	const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
	const files = [
		[manifest.landAreas, join(work, 'land-areas.pmtiles')],
		[manifest.basemap, join(work, 'basemap.pmtiles')]
	];
	for (const [entry, path] of files) {
		const address = `${base}/${entry.key}`;
		const head = await client.fetch(address, { method: 'HEAD' });
		if (head.ok && head.headers.get('x-amz-meta-sha256') === entry.sha256) {
			console.log(`${entry.key} is already in the bucket.`);
			continue;
		}
		if (!existsSync(path) || (await sha256Of(path)) !== entry.sha256) throw new Error(`${path} is not the file in geography/map-tiles.json; run "build" again.`);
		const started = await client.fetch(`${address}?uploads`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/vnd.pmtiles', 'x-amz-meta-sha256': entry.sha256 }
		});
		const uploadId = (await started.text()).match(/<UploadId>([^<]+)<\/UploadId>/)?.[1];
		if (!started.ok || !uploadId) throw new Error(`The bucket refused to start ${entry.key}: ${started.status}`);
		const partSize = 64 * 1024 * 1024;
		const parts = [];
		const handle = openSync(path, 'r');
		try {
			for (let offset = 0, number = 1; offset < entry.bytes; offset += partSize, number += 1) {
				const length = Math.min(partSize, entry.bytes - offset);
				const chunk = Buffer.alloc(length);
				readSync(handle, chunk, 0, length, offset);
				let response;
				for (let attempt = 1; attempt <= 4; attempt += 1) {
					response = await client.fetch(`${address}?partNumber=${number}&uploadId=${encodeURIComponent(uploadId)}`, { method: 'PUT', body: chunk });
					if (response.ok) break;
					await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
				}
				if (!response.ok) throw new Error(`Part ${number} of ${entry.key} failed: ${response.status}`);
				parts.push(`<Part><PartNumber>${number}</PartNumber><ETag>${response.headers.get('etag')}</ETag></Part>`);
				process.stdout.write(`\r${entry.key}: ${Math.round(((offset + length) / entry.bytes) * 100)}%`);
			}
		} finally {
			closeSync(handle);
		}
		const finished = await client.fetch(`${address}?uploadId=${encodeURIComponent(uploadId)}`, {
			method: 'POST',
			body: `<CompleteMultipartUpload>${parts.join('')}</CompleteMultipartUpload>`
		});
		if (!finished.ok) throw new Error(`The bucket refused to finish ${entry.key}: ${finished.status} ${await finished.text()}`);
		console.log(`\nUploaded ${entry.key}.`);
	}
}

const command = process.argv[2];
if (command === 'build') await build();
else if (command === 'upload') await upload();
else if (command === 'upload-assets') await uploadAssets();
else console.log('Usage: node tools/build-map-tiles.mjs build|upload|upload-assets [--work folder] [--basemap-build YYYYMMDD] [--assets folder]');
