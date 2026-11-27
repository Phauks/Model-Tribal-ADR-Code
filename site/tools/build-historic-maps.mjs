// Builds the historic map layers and uploads them, with their sources, to the private bucket (Trevor, 2026-11-26: "Definitely grab the useful map core"; research/analyses/2026-11-26-historic-maps-of-indian-lands.md).
//
// Three things, all works of the United States government:
//
// - Land cessions: the U.S. Forest Service's tracing of the 718 cessions on Charles C. Royce's maps in Indian Land Cessions in the United States (1899). One PMTiles file, layer "cessions", each shape carrying Royce's number and the year of its first cession date. The facts shown for each cession (treaties, nations, map sheets) are in geography/land-cessions.json, written by scripts/maps/land_cessions.py, which also downloads the shapes (`fetch`).
// - Land areas by year: the Census Bureau's American Indian, Alaska Native and Native Hawaiian areas for 1990, 2000 and every year 2007 to 2026, in one PMTiles file, layer "land-areas". Each shape carries its Census code, its kind, and the first and last years ("from", "to") in which the Bureau drew it exactly so; a shape the Bureau redrew is a new shape from that year. The map shows a year by keeping the shapes whose years include the latest Census year at or before it. Hawaiian home lands are left out, as on the 2020 map, and so is every area in geography/withdrawn-land-areas.json.
// - Borders over time: the Newberry Library's Atlas of Historical County Boundaries, US Historical States and Territories (generalized), every state and territory from September 3, 1783 to December 31, 2000 with its start and end dates, the change that made it and the law cited for it. Layer "borders". The Library makes the Atlas's files available for any lawful purpose, commercial or non-commercial, without licensing or permission fees, and says the old Creative Commons notice inside the files can be ignored (https://publications.newberry.org/ahcb/downloads/united_states.html).
// - Removal routes: the National Park Service's lines for the Trail of Tears National Historic Trail (the Cherokee removal routes of 1837 to 1839). Layer "routes", each line carrying the routes it is part of.
// - Forced journeys: the Forest Service's line for the Nez Perce National Historic Trail (the flight of 1877), without its connectors to roads, and one arrow for each stage of a removal in geography/removals.json (written by scripts/maps/removals.py from research/historic-maps/removals/removals.json), from the land the nation was moved from to the land it was sent to. Layer "journeys", each line carrying its kind ("trail" or "removal"), its people and its years; layer "journey-places", the two ends of each arrow. The arrows show where, not the road taken (research/analyses/2026-11-27-removal-routes-for-the-map.md).
// - Homelands found by the Indian Claims Commission: the National Park Service's tracing of the U.S. Geological Survey's 1978 map "Indian Land Areas Judicially Established". Layer "homelands", each area carrying the Commission's area number and the nation or nations it names. The map shows these as findings, dashed and credited, never as borders.
// - Reservations on the 1909 map: the Office of Indian Affairs' "Map showing Indian reservations within the limits of the United States" (1909; National Archives, catalog 655555952), traced by scripts/maps/oia_1909_reservations.py into research/historic-maps/oia-1909/oia-1909-reservations.geojson. Layer "reservations", each shape or point with its name as printed, its status ("Reservation" or "Opened"), the nations suggested for it and its review status; a shape too small to see far out also gets a point ("marker"). With it, the scan itself warped onto web map tiles by that script's `warp` step, as WebP pictures, for the "Show the original map" switch.
// - Royce's 67 map sheets, the Library of Congress's scans (g3701em.gct00002), each as the Library's JPEG 2000 file and as a JPEG the site's image viewer can show, with the full volume as one PDF. geography/royce-sheets.json lists them with their bucket keys, sizes and SHA-256.
//
// The tiles are cut with geojson-vt and written with tools/pmtiles-writer.mjs, so no tippecanoe is needed. Turning the JPEG 2000 scans into JPEGs needs ImageMagick (`magick` or `convert`) with OpenJPEG.
//
// Run from site/:
//   python3 ../scripts/maps/land_cessions.py fetch --work /tmp/historic-maps
//   node tools/build-historic-maps.mjs fetch [--work /tmp/historic-maps] [--only layers]
//   node --max-old-space-size=8192 tools/build-historic-maps.mjs build [--work /tmp/historic-maps]
//   node tools/build-historic-maps.mjs upload [--work /tmp/historic-maps]
//   node tools/build-historic-maps.mjs index [--work /tmp/historic-maps]
//
// The forced journeys alone (after tools/removal-places.mjs): `build --only journeys`, `upload --only journeys` and `index --only journeys`.
//
// The 1909 map alone: `build --only 1909`, `upload --only 1909` and `index --only 1909`, with the scan at <work>/oia-1909/oia-1909.jpg and its warped tiles at <work>/oia-1909/scan-tiles/ (python3 ../scripts/maps/oia_1909_reservations.py warp --work <that folder> --scan <the scan>).
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
import polylabel from 'polylabel';
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

const newberryPage = 'https://publications.newberry.org/ahcb/downloads/united_states.html';
const newberryFile = 'https://publications.newberry.org/ahcb/downloads/gis/US_AtlasHCB_StateTerr_Gen01.zip';
const parkService = 'https://services1.arcgis.com/fBc8EJBxQRMcHlei/ArcGIS/rest/services';
const removalRoutesLayer = `${parkService}/TRTE_NHT/FeatureServer/0`;
const homelandsLayer = `${parkService}/Indian_Land_Areas_Judicially_Established_1978/FeatureServer/5`;
const nezPerceLayer = 'https://services1.arcgis.com/gGHDlz6USftL5Pau/arcgis/rest/services/R01_NezPerceNeeMePoo_NationalHistoricTrail_Centerline/FeatureServer/0';
const removalsPath = new URL('removals.json', geography);

const sheetsItem = 'https://www.loc.gov/item/13023487/';
const volumeFile = 'https://tile.loc.gov/storage-services/public/law/llss4015/llss4015.pdf';

const reservations1909Path = new URL('../../research/historic-maps/oia-1909/oia-1909-reservations.geojson', import.meta.url);
const scan1909Record = 'https://catalog.archives.gov/id/655555952';
const scan1909File = 'https://catalog.archives.gov/medialz/cartographic/rg-075/305482/Batch0017/11/305482_11536_AA%20_01.jpg';
const scan1909Key = 'historic-maps/oia-1909/national-archives-655555952.jpg';
const reservations1909MaxZoom = 11;

const cessionsMaxZoom = 10;
const bordersMaxZoom = 7;
const removalRoutesMaxZoom = 10;
const journeysMaxZoom = 10;
const homelandsMaxZoom = 9;
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

/** Every feature of an ArcGIS layer as GeoJSON in longitude and latitude, a page at a time. */
async function downloadLayer(layer, path) {
	if (existsSync(path) && statSync(path).size > 0) return;
	const features = [];
	for (let offset = 0; ; ) {
		const address = `${layer}/query?where=1%3D1&outFields=*&outSR=4326&f=geojson&resultOffset=${offset}&resultRecordCount=1000`;
		const response = await fetch(address, { headers: { 'User-Agent': 'model-tribal-code-maps/1.0' } });
		if (!response.ok) throw new Error(`${address} answered ${response.status}`);
		const page = await response.json();
		features.push(...page.features);
		offset += page.features.length;
		if (page.features.length === 0 || !(page.exceededTransferLimit || page.properties?.exceededTransferLimit)) break;
	}
	writeFileSync(path, JSON.stringify({ type: 'FeatureCollection', features }));
}

/** The Newberry Library's states and territories, the two National Park Service layers. The Library's site sometimes asks a person to pass a check before a download; then download the file by hand into the work folder's newberry folder. */
async function fetchLayers(work) {
	mkdirSync(join(work, 'newberry'), { recursive: true });
	const newberry = join(work, 'newberry', basename(newberryFile));
	await download(newberryFile, newberry);
	const head = readFileSync(newberry).subarray(0, 2).toString('latin1');
	if (head !== 'PK') throw new Error(`The Newberry Library sent a page, not the file. Download ${newberryFile} by hand (from ${newberryPage}) to ${newberry}.`);
	await downloadLayer(removalRoutesLayer, join(work, 'removal-routes.geojson'));
	await downloadLayer(homelandsLayer, join(work, 'homelands.geojson'));
	await downloadLayer(nezPerceLayer, join(work, 'nez-perce-trail.geojson'));
	console.log(`Downloaded the Newberry Library's states and territories, the two National Park Service layers and the Forest Service's Nez Perce trail to ${work}.`);
}

/** Downloads the Census years and Royce's sheets and volume; the cession shapes come from scripts/maps/land_cessions.py. */
async function fetchSources() {
	const work = option('work', '/tmp/historic-maps');
	if (option('only', 'all') === 'layers') return fetchLayers(work);
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

/** Cuts features into vector tiles, depth first, dropping each tile's working copy once its children are done so memory stays small. Extra layers (such as one label point for each shape) go into the same tiles; their features must lie inside the main layer's shapes. */
function cutTiles(features, layer, maxZoom, extraLayers = {}) {
	const options = { maxZoom, indexMaxZoom: 4, indexMaxPoints: 0, tolerance: 3, extent: 4096, buffer: 64 };
	const index = new GeoJSONVT({ type: 'FeatureCollection', features }, options);
	const extras = Object.entries(extraLayers).map(([name, extra]) => [name, new GeoJSONVT({ type: 'FeatureCollection', features: extra }, options)]);
	const tiles = new Map();
	const visit = (z, x, y) => {
		const tile = index.getTile(z, x, y);
		if (!tile || tile.features.length === 0) return;
		const layers = { [layer]: tile };
		for (const [name, extra] of extras) {
			const extraTile = extra.getTile(z, x, y);
			if (extraTile && extraTile.features.length) layers[name] = extraTile;
		}
		tiles.set(`${z}/${x}/${y}`, fromGeojsonVt(layers, { version: 2, extent: 4096 }));
		if (z < maxZoom) for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) visit(z + 1, x * 2 + dx, y * 2 + dy);
		if (z > 4) delete index.tileIndex.tiles[((1 << z) * y + x) * 32 + z];
	};
	visit(0, 0, 0);
	return tiles;
}

/** The area of a ring in square degrees, enough to pick a shape's largest piece. */
function ringArea(ring) {
	let sum = 0;
	for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) sum += (ring[previous][0] - ring[index][0]) * (ring[previous][1] + ring[index][1]);
	return Math.abs(sum / 2);
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

/** A date as the number the map compares: 1838-05-23 is 18380523. */
const dateNumber = (date) => Number(String(date).slice(0, 10).replaceAll('-', ''));

/** The Newberry Library's file ends on December 31, 2000; a shape still in place then is in place today. */
const newberryEnd = 20001231;
const stillInPlace = 99991231;

async function readZippedShapefile(path, name) {
	const files = unzipSync(readFileSync(path));
	const shp = Object.keys(files).find((entry) => entry.endsWith(`${name}.shp`));
	const dbf = shp.replace(/\.shp$/, '.dbf');
	const slice = (bytes) => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
	return shapefile.read(slice(files[shp]), slice(files[dbf]), { encoding: 'latin1' });
}

const territoryKinds = { State: 'state', Territory: 'territory', 'Unorganized Territory': 'unorganized-territory', 'District of Columbia': 'district', Other: 'other' };

async function buildBorders(work) {
	const collection = await readZippedShapefile(join(work, 'newberry', basename(newberryFile)), 'US_HistStateTerr_Gen01');
	const features = collection.features
		.filter((feature) => feature.geometry)
		.map((feature) => {
			const properties = feature.properties;
			const to = Number(properties.END_N);
			return {
				type: 'Feature',
				geometry: { type: feature.geometry.type, coordinates: rounded(feature.geometry.coordinates) },
				properties: { id: `${properties.ID}-${properties.VERSION}`, name: properties.FULL_NAME, kind: territoryKinds[properties.TERR_TYPE] ?? 'other', from: Number(properties.START_N), to: to === newberryEnd ? stillInPlace : to, change: properties.CHANGE ?? '', citation: properties.CITATION ?? '' }
			};
		});
	// One name for each state or territory, inside its largest piece, so a shape cut across many tiles is named once and not once a tile.
	const labels = features.map((feature) => {
		const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
		const largest = polygons.reduce((best, polygon) => (ringArea(polygon[0]) > ringArea(best[0]) ? polygon : best));
		const point = polylabel(largest, 0.01);
		const { name, from, to } = feature.properties;
		return { type: 'Feature', geometry: { type: 'Point', coordinates: [Number(point[0].toFixed(4)), Number(point[1].toFixed(4))] }, properties: { name, from, to } };
	});
	const tiles = cutTiles(features, 'borders', bordersMaxZoom, { 'border-names': labels });
	const bounds = boundsOf(features);
	const path = join(work, 'borders.pmtiles');
	writePmtiles(path, tiles, { minZoom: 0, maxZoom: bordersMaxZoom, bounds, metadata: { name: 'Borders over time', attribution: 'Newberry Library, Atlas of Historical County Boundaries', vector_layers: [{ id: 'borders', fields: { id: 'String', name: 'String', kind: 'String', from: 'Number', to: 'Number', change: 'String', citation: 'String' }, minzoom: 0, maxzoom: bordersMaxZoom }, { id: 'border-names', fields: { name: 'String', from: 'Number', to: 'Number' }, minzoom: 0, maxzoom: bordersMaxZoom }] } });
	const described = describe(path, '', {});
	return { ...describe(path, `borders-${described.sha256.slice(0, 12)}`, {}), minZoom: 0, maxZoom: bordersMaxZoom, bounds, layers: ['borders', 'border-names'], features: features.length, years: [...new Set(features.flatMap((feature) => [feature.properties.from, feature.properties.to]).filter((date) => date < stillInPlace).map((date) => Math.floor(date / 10000)))].sort((first, second) => first - second), first: 17830903, last: newberryEnd, sources: [newberryFile, newberryPage], retrieved: new Date().toISOString().slice(0, 10) };
}

/** Joins line pieces that meet end to end into longer lines. The Park Service draws the trail as about 2,000 short pieces, and pieces shorter than a pixel would vanish from the national view. */
function joinLines(lines) {
	const key = (point) => `${point[0]},${point[1]}`;
	const remaining = lines.map((line) => [...line]);
	const joined = [];
	while (remaining.length) {
		let line = remaining.pop();
		for (let grown = true; grown; ) {
			grown = false;
			for (let index = remaining.length - 1; index >= 0; index -= 1) {
				const other = remaining[index];
				const [start, end] = [key(line[0]), key(line[line.length - 1])];
				if (key(other[0]) === end) line = [...line, ...other.slice(1)];
				else if (key(other[other.length - 1]) === end) line = [...line, ...other.slice(0, -1).reverse()];
				else if (key(other[other.length - 1]) === start) line = [...other, ...line.slice(1)];
				else if (key(other[0]) === start) line = [...other.slice(1).reverse(), ...line];
				else continue;
				remaining.splice(index, 1);
				grown = true;
			}
		}
		joined.push(line);
	}
	return joined;
}

async function buildRemovalRoutes(work) {
	const source = JSON.parse(readFileSync(join(work, 'removal-routes.geojson'), 'utf8'));
	/** The pieces of each route or set of routes that share a line. */
	const byRoutes = new Map();
	for (const feature of source.features) {
		if (!feature.geometry) continue;
		const routes = String(feature.properties.TRALTNAME ?? '').split('|').filter(Boolean).join(', ');
		const lines = feature.geometry.type === 'LineString' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
		byRoutes.set(routes, [...(byRoutes.get(routes) ?? []), ...lines.map((line) => rounded(line))]);
	}
	const features = [...byRoutes].map(([routes, lines]) => ({ type: 'Feature', geometry: { type: 'MultiLineString', coordinates: joinLines(lines) }, properties: { trail: 'Trail of Tears', routes } }));
	const tiles = cutTiles(features, 'routes', removalRoutesMaxZoom);
	const bounds = boundsOf(features);
	const path = join(work, 'removal-routes.pmtiles');
	writePmtiles(path, tiles, { minZoom: 0, maxZoom: removalRoutesMaxZoom, bounds, metadata: { name: 'Removal routes', attribution: 'National Park Service', vector_layers: [{ id: 'routes', fields: { trail: 'String', routes: 'String' }, minzoom: 0, maxzoom: removalRoutesMaxZoom }] } });
	const described = describe(path, '', {});
	return { ...describe(path, `removal-routes-${described.sha256.slice(0, 12)}`, {}), minZoom: 0, maxZoom: removalRoutesMaxZoom, bounds, layers: ['routes'], features: features.length, years: [1837, 1839], sources: [removalRoutesLayer], retrieved: new Date().toISOString().slice(0, 10) };
}

/** A gentle curve from one point to another, bowed to the left of the way it goes, so two arrows between the same places in opposite directions stay apart. */
function arc(from, to, steps = 32) {
	const [dx, dy] = [to[0] - from[0], to[1] - from[1]];
	const bow = 0.18;
	const control = [(from[0] + to[0]) / 2 - dy * bow, (from[1] + to[1]) / 2 + dx * bow];
	return Array.from({ length: steps + 1 }, (_, step) => {
		const t = step / steps;
		const point = [0, 1].map((axis) => (1 - t) ** 2 * from[axis] + 2 * (1 - t) * t * control[axis] + t ** 2 * to[axis]);
		return point.map((value) => Math.round(value * 1e4) / 1e4);
	});
}

/** The Forest Service marks the short links from the trail to a road or trailhead "Connector"; those, and decommissioned pieces, are not part of the 1877 route. */
const isTrailPiece = (properties) => !String(properties.OverallTrailComposition ?? '').startsWith('Connector') && !String(properties.TRAIL_STATUS ?? '').startsWith('DE');

async function buildJourneys(work) {
	const trail = JSON.parse(readFileSync(join(work, 'nez-perce-trail.geojson'), 'utf8'));
	const pieces = trail.features.filter((feature) => feature.geometry && isTrailPiece(feature.properties)).flatMap((feature) => (feature.geometry.type === 'LineString' ? [feature.geometry.coordinates] : feature.geometry.coordinates).map((line) => rounded(line)));
	const trailFeatures = [{ type: 'Feature', geometry: { type: 'MultiLineString', coordinates: joinLines(pieces) }, properties: { kind: 'trail', id: 'nez-perce-1877', name: 'Nez Perce National Historic Trail', people: 'Nez Perce (Nimiipuu)', from: 1877, to: 1877, source: 'U.S. Forest Service' } }];
	const removals = JSON.parse(readFileSync(removalsPath, 'utf8')).removals.filter((removal) => removal.from.point && removal.to.point);
	const arrows = removals.map((removal) => ({ type: 'Feature', geometry: { type: 'LineString', coordinates: arc(removal.from.point, removal.to.point) }, properties: { kind: 'removal', id: removal.id, journey: removal.journey, stage: removal.stage, people: removal.people, from: removal.years[0], to: removal.years[removal.years.length - 1] } }));
	const places = removals.flatMap((removal) => [
		{ type: 'Feature', geometry: { type: 'Point', coordinates: removal.from.point }, properties: { id: removal.id, end: 'from', name: removal.from.name, people: removal.people, from: removal.years[0], to: removal.years[removal.years.length - 1] } },
		{ type: 'Feature', geometry: { type: 'Point', coordinates: removal.to.point }, properties: { id: removal.id, end: 'to', name: removal.to.name, people: removal.people, from: removal.years[0], to: removal.years[removal.years.length - 1] } }
	]);
	const features = [...trailFeatures, ...arrows];
	const tiles = cutTiles(features, 'journeys', journeysMaxZoom, { 'journey-places': places });
	const bounds = boundsOf([...features, ...places]);
	const path = join(work, 'journeys.pmtiles');
	const fields = { kind: 'String', id: 'String', journey: 'String', stage: 'Number', name: 'String', people: 'String', from: 'Number', to: 'Number', source: 'String' };
	writePmtiles(path, tiles, { minZoom: 0, maxZoom: journeysMaxZoom, bounds, metadata: { name: 'Forced journeys', attribution: 'U.S. Forest Service; Tribal Law Project', vector_layers: [{ id: 'journeys', fields, minzoom: 0, maxzoom: journeysMaxZoom }, { id: 'journey-places', fields: { id: 'String', end: 'String', name: 'String', people: 'String', from: 'Number', to: 'Number' }, minzoom: 0, maxzoom: journeysMaxZoom }] } });
	const described = describe(path, '', {});
	const years = removals.flatMap((removal) => removal.years);
	return { ...describe(path, `journeys-${described.sha256.slice(0, 12)}`, {}), minZoom: 0, maxZoom: journeysMaxZoom, bounds, layers: ['journeys', 'journey-places'], features: features.length, trailPieces: pieces.length, removals: arrows.length, years: [Math.min(1877, ...years), Math.max(1877, ...years)], sources: [nezPerceLayer, 'site/geography/removals.json'], retrieved: new Date().toISOString().slice(0, 10) };
}

async function buildHomelands(work) {
	const source = JSON.parse(readFileSync(join(work, 'homelands.geojson'), 'utf8'));
	const features = source.features
		.filter((feature) => feature.geometry)
		.map((feature) => ({ type: 'Feature', geometry: { type: feature.geometry.type, coordinates: rounded(feature.geometry.coordinates) }, properties: { area: Number(feature.properties.CATNUM), named: String(feature.properties.Affiliatio ?? '').trim() } }));
	const tiles = cutTiles(features, 'homelands', homelandsMaxZoom);
	const bounds = boundsOf(features);
	const path = join(work, 'homelands.pmtiles');
	writePmtiles(path, tiles, { minZoom: 0, maxZoom: homelandsMaxZoom, bounds, metadata: { name: 'Homelands found by the Indian Claims Commission', attribution: 'National Park Service, after the U.S. Geological Survey (1978)', vector_layers: [{ id: 'homelands', fields: { area: 'Number', named: 'String' }, minzoom: 0, maxzoom: homelandsMaxZoom }] } });
	const described = describe(path, '', {});
	return { ...describe(path, `homelands-${described.sha256.slice(0, 12)}`, {}), minZoom: 0, maxZoom: homelandsMaxZoom, bounds, layers: ['homelands'], features: features.length, sources: [homelandsLayer], retrieved: new Date().toISOString().slice(0, 10) };
}

/** Square kilometers of a polygon's outer rings, near enough to tell a speck from a reservation. */
function squareKilometers(geometry) {
	const rings = geometry.type === 'Polygon' ? [geometry.coordinates[0]] : geometry.coordinates.map((polygon) => polygon[0]);
	let total = 0;
	for (const ring of rings) {
		const middle = ring.reduce((sum, point) => sum + point[1], 0) / ring.length;
		let twice = 0;
		for (let index = 0; index < ring.length - 1; index += 1) twice += ring[index][0] * ring[index + 1][1] - ring[index + 1][0] * ring[index][1];
		total += (Math.abs(twice) / 2) * 111.32 * 111.32 * Math.cos((middle * Math.PI) / 180);
	}
	return total;
}

/** The reservations on the Office of Indian Affairs' 1909 map, as traced by scripts/maps/oia_1909_reservations.py. */
function buildReservations1909(work) {
	const source = JSON.parse(readFileSync(reservations1909Path, 'utf8'));
	const features = [];
	source.features.forEach((feature, index) => {
		const p = feature.properties;
		const properties = {
			n: index + 1,
			id: p.id,
			name: p.name,
			status: p.status,
			nations: (p.nations ?? []).join(','),
			label: p.name_source === 'label' ? 1 : 0,
			neighbors: (p.neighbors ?? []).join('|'),
			placed: p.internal_lines ? 1 : 0,
			panel: p.panel ?? '',
			note: p.note ?? '',
			review: p.review
		};
		features.push({ type: 'Feature', geometry: { type: feature.geometry.type, coordinates: rounded(feature.geometry.coordinates) }, properties });
		// A shape smaller than a mid-sized county vanishes far out, so it also gets a point, which the map shows only there.
		if (feature.geometry.type !== 'Point') {
			const size = squareKilometers(feature.geometry);
			if (size < 600) {
				const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
				const largest = polygons.reduce((best, polygon) => (squareKilometers({ type: 'Polygon', coordinates: polygon }) > squareKilometers({ type: 'Polygon', coordinates: best }) ? polygon : best));
				features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: rounded(polylabel(largest, 0.001)) }, properties: { ...properties, marker: 1 } });
			}
		}
	});
	const tiles = cutTiles(features, 'reservations', reservations1909MaxZoom);
	const bounds = boundsOf(features);
	const path = join(work, 'reservations-1909.pmtiles');
	writePmtiles(path, tiles, { minZoom: 0, maxZoom: reservations1909MaxZoom, bounds, metadata: { name: 'Reservations on the 1909 map', attribution: 'Office of Indian Affairs (1909), National Archives', vector_layers: [{ id: 'reservations', fields: { n: 'Number', id: 'String', name: 'String', status: 'String', nations: 'String', label: 'Number', neighbors: 'String', placed: 'Number', panel: 'String', note: 'String', review: 'String', marker: 'Number' }, minzoom: 0, maxzoom: reservations1909MaxZoom }] } });
	const described = describe(path, '', {});
	return { ...describe(path, `reservations-1909-${described.sha256.slice(0, 12)}`, {}), minZoom: 0, maxZoom: reservations1909MaxZoom, bounds, layers: ['reservations'], features: source.features.length, years: [1909], source: 'research/historic-maps/oia-1909/oia-1909-reservations.geojson', sources: [scan1909Record], retrieved: '2026-11-27' };
}

/** The 1909 map itself, warped onto web map tiles by scripts/maps/oia_1909_reservations.py (`warp`): WebP pictures, kept as they are. */
function buildScan1909(work) {
	const root = join(work, 'oia-1909', 'scan-tiles');
	const tiles = new Map();
	let maxZoom = 0;
	for (const z of readdirSync(root)) {
		for (const x of readdirSync(join(root, z))) {
			for (const name of readdirSync(join(root, z, x))) {
				tiles.set(`${z}/${x}/${name.replace(/\.webp$/, '')}`, readFileSync(join(root, z, x, name)));
				maxZoom = Math.max(maxZoom, Number(z));
			}
		}
	}
	// The picture reaches past the reservations (the whole country is printed), so the bounds come from the tiles at zoom 6.
	const atSix = [...tiles.keys()].filter((key) => key.startsWith('6/')).map((key) => key.split('/').map(Number));
	const longitude = (x) => (x / 64) * 360 - 180;
	const latitude = (y) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / 64))) * 180) / Math.PI;
	const bounds = [longitude(Math.min(...atSix.map(([, x]) => x))), latitude(Math.max(...atSix.map(([, , y]) => y)) + 1), longitude(Math.max(...atSix.map(([, x]) => x)) + 1), latitude(Math.min(...atSix.map(([, , y]) => y)))].map((value) => Math.round(value * 1e4) / 1e4);
	const path = join(work, 'scan-1909.pmtiles');
	writePmtiles(path, tiles, { minZoom: 0, maxZoom, bounds, tileType: 'webp', metadata: { name: 'Map showing Indian reservations within the limits of the United States (1909)', attribution: 'Office of Indian Affairs (1909), National Archives' } });
	const described = describe(path, '', {});
	return { ...describe(path, `scan-1909-${described.sha256.slice(0, 12)}`, {}), format: 'webp', minZoom: 0, maxZoom, bounds, tiles: tiles.size, sources: [scan1909File, scan1909Record], retrieved: '2026-11-27' };
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
	if (only === 'all' || only === '1909') {
		manifest.reservations1909 = buildReservations1909(work);
		// The scan changes only when it is warped again: without its warped tiles in the work folder, the scan already in the bucket stays.
		if (existsSync(join(work, 'oia-1909', 'scan-tiles'))) manifest.scan1909 = buildScan1909(work);
		else console.log(`No warped scan in ${join(work, 'oia-1909', 'scan-tiles')}; keeping ${manifest.scan1909.key}.`);
	}
	if (only === 'all' || only === 'layers') {
		manifest.borders = await buildBorders(work);
		manifest.removalRoutes = await buildRemovalRoutes(work);
		manifest.homelands = await buildHomelands(work);
	}
	if (only === 'all' || only === 'layers' || only === 'journeys') manifest.journeys = await buildJourneys(work);
	writeFileSync(manifestPath, `${JSON.stringify(manifest, null, '\t')}\n`);
	if (only === 'all' || only === 'sheets') buildSheets(work);
	console.log('Recorded the tile sets in geography/map-tiles.json.');
}

function bucketClient() {
	return import('aws4fetch').then(({ AwsClient }) => {
		const account = process.env.R2_ACCOUNT_ID ?? process.env.CLOUDFLARE_ACCOUNT_ID;
		if (!account || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) throw new Error('Set R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and CLOUDFLARE_ACCOUNT_ID (or R2_ACCOUNT_ID).');
		const client = new AwsClient({ accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY, service: 's3', region: 'auto' });
		return { client, base: `https://${account}.r2.cloudflarestorage.com/${process.env.R2_BUCKET ?? 'tribal-law-project-files'}` };
	});
}

/** Puts every file in the bucket, eight at a time, skipping files already there with the same SHA-256. Files here are under 200 MB, so each goes in one request. */
async function upload() {
	const work = option('work', '/tmp/historic-maps');
	const { client, base } = await bucketClient();
	const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
	const sheets = JSON.parse(readFileSync(sheetsPath, 'utf8'));
	const layers = [
		[join(work, 'borders.pmtiles'), manifest.borders.key, 'application/vnd.pmtiles'],
		[join(work, 'removal-routes.pmtiles'), manifest.removalRoutes.key, 'application/vnd.pmtiles'],
		[join(work, 'homelands.pmtiles'), manifest.homelands.key, 'application/vnd.pmtiles'],
		[join(work, 'journeys.pmtiles'), manifest.journeys.key, 'application/vnd.pmtiles'],
		...layerSources(work).map((entry) => [entry.path, entry.key, entry.mediaType])
	];
	const journeys = [
		[join(work, 'journeys.pmtiles'), manifest.journeys.key, 'application/vnd.pmtiles'],
		...layerSources(work).filter((entry) => entry.records === 'forest-service-nez-perce-trail').map((entry) => [entry.path, entry.key, entry.mediaType])
	];
	// The scan and its tiles are left out when they are not in the work folder (only the tracing was rebuilt).
	const map1909 = [
		[join(work, 'reservations-1909.pmtiles'), manifest.reservations1909.key, 'application/vnd.pmtiles'],
		...[
			[join(work, 'scan-1909.pmtiles'), manifest.scan1909.key, 'application/vnd.pmtiles'],
			[join(work, 'oia-1909', 'oia-1909.jpg'), scan1909Key, 'image/jpeg']
		].filter(([path]) => existsSync(path))
	];
	const only = option('only', 'all');
	const files = only === '1909' ? map1909 : only === 'layers' ? layers : only === 'journeys' ? journeys : [
		...map1909,
		...layers,
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

/** The downloaded files behind the four newer layers, as kept in the bucket. */
function layerSources(work) {
	return [
		{ path: join(work, 'newberry', basename(newberryFile)), key: `historic-maps/newberry-states-and-territories/${basename(newberryFile)}`, mediaType: 'application/zip', title: 'Newberry Library, Atlas of Historical County Boundaries, US Historical States and Territories (generalized)', link: newberryPage, records: 'newberry-atlas-historical-states-and-territories', rights: 'The Newberry Library makes the Atlas files available for any lawful purpose, commercial or non-commercial, without licensing or permission fees.' },
		{ path: join(work, 'removal-routes.geojson'), key: 'historic-maps/park-service-trail-of-tears/removal-routes.geojson', mediaType: 'application/geo+json', title: 'National Park Service, Trail of Tears National Historic Trail, designated alignment', link: removalRoutesLayer, records: 'park-service-trail-of-tears-routes' },
		{ path: join(work, 'homelands.geojson'), key: 'historic-maps/park-service-indian-land-areas-1978/homelands.geojson', mediaType: 'application/geo+json', title: 'National Park Service, Indian Land Areas Judicially Established 1978', link: homelandsLayer, records: 'indian-land-areas-judicially-established-1978' },
		{ path: join(work, 'nez-perce-trail.geojson'), key: 'historic-maps/forest-service-nez-perce-trail/nez-perce-trail.geojson', mediaType: 'application/geo+json', title: 'U.S. Forest Service, Nez Perce (Nee-Me-Poo) National Historic Trail, centerline', link: nezPerceLayer, records: 'forest-service-nez-perce-trail' }
	];
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
	// Read only when asked for, so `--only 1909` needs none of the other layers' downloads.
	const layerRows = () => layerSources(work).map((entry) => row({ key: entry.key, ...file(entry.path), media_type: entry.mediaType, title: entry.title, obtained: `downloaded by tools/build-historic-maps.mjs, ${today}`, link: entry.link, records: entry.records, ...(entry.rights ? { rights: entry.rights } : {}) }));
	const scanPath = join(work, 'oia-1909', 'oia-1909.jpg');
	const map1909Rows = existsSync(scanPath)
		? [row({ key: scan1909Key, ...file(scanPath), media_type: 'image/jpeg', title: 'Office of Indian Affairs, Map Showing Indian Reservations Within the Limits of the United States (1909)', obtained: `downloaded from the National Archives Catalog, ${today}`, link: scan1909Record, records: 'office-of-indian-affairs-reservations-map-1909' })]
		: [];
	const only = option('only', 'all');
	const rows = only === '1909' ? map1909Rows : only === 'layers' ? layerRows() : only === 'journeys' ? layerRows().filter((entry) => entry.records === 'forest-service-nez-perce-trail') : [
		...layerRows(),
		...map1909Rows,
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
else console.log('Usage: node tools/build-historic-maps.mjs fetch|build|upload|index [--work folder] [--only cessions|land-areas|sheets|layers|journeys|1909]');
