/**
 * Projects the map's shapes once, when the site is built, into SVG path data
 * that the map page draws (site/DESIGN.md, section 11; map tool spike, project
 * files spikes/map/REPORT.md). Nothing here runs in the browser or the Worker:
 * vite.config.ts calls it and serves the result as the module
 * "virtual:map-geometry".
 *
 * Two layers share one projection, so they line up:
 *
 * - States, DC and the five inhabited territories, from us-atlas 3.0.1
 *   (the Census Bureau's 2017 cartographic boundary files, 1:10,000,000).
 * - The twelve Bureau of Indian Affairs regions, from the Bureau's own
 *   boundary file (geography/bureau-of-indian-affairs-regions.json; see
 *   geography/README.md). These are federal administrative areas, not the
 *   lands of any nation.
 *
 * No nation's land is drawn (decision record 0007). Trevor chose on
 * 2026-11-21 to draw the regions from the Bureau's official outlines even
 * where an outline follows a nation's land, as the Navajo Region's does.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { geoPath, type GeoProjection } from 'd3-geo';
import { feature, mesh } from 'topojson-client';
import type { Feature, FeatureCollection, Geometry, MultiPolygon, Polygon } from 'geojson';
import type { GeometryCollection, Topology } from 'topojson-specification';

export const mapWidth = 975;
export const mapHeight = 610;

/** Census Bureau state codes (the ids in us-atlas) and the postal codes the records use. */
const postalCodeByCensusCode: Record<string, string> = {
	'01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA', '08': 'CO', '09': 'CT',
	'10': 'DE', '11': 'DC', '12': 'FL', '13': 'GA', '15': 'HI', '16': 'ID', '17': 'IL',
	'18': 'IN', '19': 'IA', '20': 'KS', '21': 'KY', '22': 'LA', '23': 'ME', '24': 'MD',
	'25': 'MA', '26': 'MI', '27': 'MN', '28': 'MS', '29': 'MO', '30': 'MT', '31': 'NE',
	'32': 'NV', '33': 'NH', '34': 'NJ', '35': 'NM', '36': 'NY', '37': 'NC', '38': 'ND',
	'39': 'OH', '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI', '45': 'SC', '46': 'SD',
	'47': 'TN', '48': 'TX', '49': 'UT', '50': 'VT', '51': 'VA', '53': 'WA', '54': 'WV',
	'55': 'WI', '56': 'WY', '60': 'AS', '66': 'GU', '69': 'MP', '72': 'PR', '78': 'VI'
};

/**
 * Places too small to see or to hit with a pointer get a labeled marker,
 * offset from the place's center by these amounts in map units (map tool spike).
 */
const markerOffsets: Record<string, [number, number]> = {
	PR: [-30, -26],
	DC: [40, 22],
	RI: [28, 10],
	DE: [36, 6],
	VI: [-34, -16],
	GU: [0, 18],
	MP: [16, 0],
	AS: [0, 18]
};

/**
 * Where a region's label sits, as a shift in map units from the center of the
 * region's largest piece, where the center alone would put the label on top
 * of a neighbor's (checked by eye).
 */
const regionLabelShifts: Record<string, [number, number]> = {
	Western: [-35, -38],
	Southwest: [22, 45],
	'Southern Plains': [-10, 65],
	Eastern: [60, 40],
	'Rocky Mountain': [0, -10]
};

export interface StateShape {
	/** Postal code, such as "NM". */
	code: string;
	path: string;
	/** Where a small place's marker sits, and the line from the place to it. */
	marker?: { x: number; y: number; fromX: number; fromY: number };
}

export interface RegionShape {
	name: string;
	path: string;
	label: { x: number; y: number };
}

export interface MapGeometry {
	width: number;
	height: number;
	states: StateShape[];
	/** Lines between states, drawn once. */
	stateBorders: string;
	regions: RegionShape[];
	/** Lines between regions and around their outer edges. */
	regionBorders: string;
	/** Where the region boundaries came from and when (geography/bureau-of-indian-affairs-regions.json). */
	regionSource: { source: string; retrieved: string };
}

const round = (pathData: string | null): string =>
	(pathData ?? '').replace(/(\d+\.\d{1})\d+/g, '$1');

/**
 * d3-composite-projections 2.0.0 cannot be imported by plain Node: its "main"
 * is a browser bundle and its module entry imports files without extensions.
 * As the map tool spike found, the bundle's browser path works when d3 is
 * provided as a global, so it is loaded that way here.
 */
async function albersUsaTerritories(): Promise<() => GeoProjection> {
	const geo = await import('d3-geo');
	const path = await import('d3-path');
	const globals = globalThis as { d3?: Record<string, unknown> };
	globals.d3 = { ...geo, ...path };
	try {
		const bundle = createRequire(import.meta.url).resolve(
			'd3-composite-projections/d3-composite-projections.js'
		);
		await import(/* @vite-ignore */ bundle);
		return globals.d3?.geoAlbersUsaTerritories as () => GeoProjection;
	} finally {
		delete globals.d3;
	}
}

/** The largest piece of a region, by area on the map, so its label lands on land. */
function largestPiece(
	region: Feature<Polygon | MultiPolygon>,
	area: (shape: Feature<Geometry>) => number
): Feature<Geometry> {
	if (region.geometry.type === 'Polygon') return region;
	const pieces = region.geometry.coordinates.map(
		(coordinates): Feature<Geometry> => ({
			type: 'Feature',
			properties: {},
			geometry: { type: 'Polygon', coordinates }
		})
	);
	return pieces.reduce((largest, piece) => (area(piece) > area(largest) ? piece : largest));
}

export async function buildMapGeometry(regionsFile: string): Promise<MapGeometry> {
	const require = createRequire(import.meta.url);
	const atlas = JSON.parse(
		readFileSync(require.resolve('us-atlas/states-10m.json'), 'utf8')
	) as Topology<{ states: GeometryCollection }>;
	const regionsTopology = JSON.parse(readFileSync(regionsFile, 'utf8')) as Topology<{
		regions: GeometryCollection<{ name: string }>;
	}> & { metadata: { source: string; retrieved: string } };

	const states = (feature(atlas, atlas.objects.states) as FeatureCollection).features;
	const projection = (await albersUsaTerritories())().fitExtent(
		[
			[12, 12],
			[mapWidth - 12, mapHeight - 12]
		],
		{ type: 'FeatureCollection', features: states }
	);
	const path = geoPath(projection);

	const stateShapes: StateShape[] = states.map((state) => {
		const code = postalCodeByCensusCode[String(state.id)];
		const shape: StateShape = { code, path: round(path(state)) };
		const offset = markerOffsets[code];
		if (offset) {
			const [fromX, fromY] = path.centroid(state);
			shape.marker = { x: fromX + offset[0], y: fromY + offset[1], fromX, fromY };
		}
		return shape;
	});

	const regions = (
		feature(regionsTopology, regionsTopology.objects.regions) as FeatureCollection<
			Polygon | MultiPolygon,
			{ name: string }
		>
	).features;
	const regionShapes: RegionShape[] = regions.map((region) => {
		const name = region.properties.name;
		const [x, y] = path.centroid(largestPiece(region, (piece) => path.area(piece)));
		const [shiftX, shiftY] = regionLabelShifts[name] ?? [0, 0];
		return { name, path: round(path(region)), label: { x: x + shiftX, y: y + shiftY } };
	});

	return {
		width: mapWidth,
		height: mapHeight,
		states: stateShapes,
		stateBorders: round(path(mesh(atlas, atlas.objects.states, (first, second) => first !== second))),
		regions: regionShapes,
		regionBorders: round(path(mesh(regionsTopology, regionsTopology.objects.regions))),
		regionSource: {
			source: regionsTopology.metadata.source,
			retrieved: regionsTopology.metadata.retrieved
		}
	};
}
