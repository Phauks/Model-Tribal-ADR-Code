// Downloads the Census Bureau's 2020 cartographic boundary file of American
// Indian, Alaska Native and Native Hawaiian areas and writes a simplified copy
// for the map's "Land areas" view at geography/census-land-areas-2020.json.
//
// Source: U.S. Census Bureau, 2020 Cartographic Boundary File, American
// Indian/Alaska Native/Native Hawaiian Areas, 1:500,000 (source record
// content/sources/c/census-cartographic-boundary-aiannh-2020.yaml). The 2020
// vintage matches the Census area codes the nation records cite. Run again to
// refresh the copy; the website build reads only the file this writes.
//
// Run from site/:  node tools/fetch-census-land-areas.mjs

import { writeFileSync } from 'node:fs';
import { geoArea } from 'd3-geo';
import { unzipSync } from 'fflate';
import * as shapefile from 'shapefile';
import { topology } from 'topojson-server';
import { presimplify, quantile, simplify } from 'topojson-simplify';

const fileUrl = 'https://www2.census.gov/geo/tiger/GENZ2020/shp/cb_2020_us_aiannh_500k.zip';

// Keeps this share of the points, by visual importance. About 3 percent keeps
// the large areas recognizable on a national map while keeping the file small
// (project choice, checked by eye). Small areas keep at least their outline.
const shareOfPointsKept = 0.03;

/**
 * What kind of area each Census code range is, from the Census Bureau's code
 * ranges for American Indian, Alaska Native and Native Hawaiian areas (source
 * record census-aian-geography-definitions; ranges confirmed against this
 * file's LSAD codes). Hawaiian home lands are left out: they are lands of the
 * State of Hawaiʻi's Hawaiian home lands program, not of any nation, and Native
 * Hawaiians are not a tribe (project rule).
 */
function kindOf(code) {
	const number = Number(code);
	if (number < 5000) return 'federal-reservation-or-trust-land';
	if (number < 6000) return null; // Hawaiian home lands, and the Oklahoma tribal statistical areas below
	if (number < 8000) return 'alaska-native-village-statistical-area';
	if (number < 9000) return 'tribal-designated-statistical-area';
	if (number < 9500) return 'state-reservation';
	return 'state-designated-tribal-statistical-area';
}

const response = await fetch(fileUrl);
if (!response.ok) throw new Error(`The Census Bureau answered ${response.status} ${response.statusText}`);
const files = unzipSync(new Uint8Array(await response.arrayBuffer()));
const shp = files['cb_2020_us_aiannh_500k.shp'];
const dbf = files['cb_2020_us_aiannh_500k.dbf'];
if (!shp || !dbf) throw new Error('The download has no cb_2020_us_aiannh_500k.shp and .dbf');
const collection = await shapefile.read(shp.buffer, dbf.buffer, { encoding: 'utf-8' });

/** Square kilometers in one steradian of the Earth's surface (mean radius 6,371.0 km). */
const squareKilometers = 6371.0 ** 2;

/**
 * Pieces smaller than this are left out, except an area's largest piece, so
 * that every area keeps at least one shape. On a national map one map unit is
 * about 4.5 kilometers, so a piece of 5 square kilometers is a fraction of a
 * unit and cannot be seen (project choice). Dropping them, most of them small
 * islands in Alaska, keeps the file and the drawing small.
 */
const smallestPiece = 5;

function withoutSpecks(geometry) {
	if (geometry.type !== 'MultiPolygon') return geometry;
	const sized = geometry.coordinates.map((polygon) => ({
		polygon,
		area: geoArea({ type: 'Polygon', coordinates: polygon }) * squareKilometers
	}));
	const largest = Math.max(...sized.map((piece) => piece.area));
	const kept = sized.filter((piece) => piece.area >= smallestPiece || piece.area === largest);
	return { type: 'MultiPolygon', coordinates: kept.map((piece) => piece.polygon) };
}

const features = [];
for (const area of collection.features) {
	const { GEOID, NAMELSAD, LSAD, AIANNHCE } = area.properties;
	// LSAD 88 and 90 are Oklahoma tribal statistical areas, which share the
	// 5000 to 5999 range with Hawaiian home lands (LSAD 78).
	const kind = LSAD === '88' || LSAD === '90' ? 'oklahoma-tribal-statistical-area' : kindOf(AIANNHCE);
	if (!kind) continue;
	// Shapefiles store outer rings clockwise, the order d3-geo expects, so the
	// rings are kept as they are (unlike the Bureau of Indian Affairs regions).
	features.push({ type: 'Feature', properties: { geographic_identifier: GEOID, name: NAMELSAD, kind }, geometry: withoutSpecks(area.geometry) });
}
features.sort((first, second) => first.properties.geographic_identifier.localeCompare(second.properties.geographic_identifier));

// A grid of 100,000 steps a side (about 400 meters at these longitudes) is finer than a national map can show.
const fullDetail = topology({ areas: { type: 'FeatureCollection', features } }, 1e5);
const prepared = presimplify(fullDetail);
const simplified = simplify(prepared, quantile(prepared, shareOfPointsKept));

const retrieved = new Date().toISOString().slice(0, 10);
const output = {
	...simplified,
	metadata: {
		source: 'census-cartographic-boundary-aiannh-2020',
		file: fileUrl,
		retrieved,
		left_out: `Hawaiian home lands; pieces of an area under ${smallestPiece} square kilometers, except its largest`,
		simplification: `topojson-simplify, ${shareOfPointsKept * 100} percent of points kept by visual importance`
	}
};
const text = JSON.stringify(output, (key, value) =>
	typeof value === 'number' && !Number.isInteger(value) ? Math.round(value * 1e6) / 1e6 : value
);
writeFileSync(new URL('../geography/census-land-areas-2020.json', import.meta.url), `${text}\n`);
console.log(`Wrote ${features.length} areas (${text.length.toLocaleString('en-US')} bytes), retrieved ${retrieved}.`);
