/**
 * Projects the map's shapes once, when the site is built, into SVG path data
 * that the map page draws (site/DESIGN.md, section 11; map tool spike, project
 * files spikes/map/REPORT.md). Nothing here runs in the browser or the Worker:
 * vite.config.ts calls it and serves the result as the module
 * "virtual:map-geometry".
 *
 * Two layers share one layout, so they line up:
 *
 * - States, DC and the five inhabited territories, from us-atlas 3.0.1
 *   (the Census Bureau's 2017 cartographic boundary files, 1:10,000,000).
 * - The twelve Bureau of Indian Affairs regions, from the Bureau's own
 *   boundary file (geography/bureau-of-indian-affairs-regions.json; see
 *   geography/README.md). These are federal administrative areas, not the
 *   lands of any nation.
 * - The Census Bureau's 2020 American Indian and Alaska Native areas
 *   (geography/census-land-areas-2020.json): reservations, trust lands and
 *   the Census Bureau's statistical areas, for the "Land areas" view, which
 *   Trevor asked for on 2026-11-22.
 *
 * The layout puts the contiguous United States (the 48 contiguous states and
 * DC) in a framed, labeled box on top. Alaska, Hawaiʻi and the territories sit
 * in a row of smaller framed, labeled boxes underneath. Every box has its own
 * projection, fitted to the box, and its own scale bar, because the boxes are
 * drawn at very different scales and none is in its true place.
 * Every shape is drawn only by the projection of the box it belongs to, so a
 * place can never turn up in another place's box.
 *
 * No nation's land is drawn (decision record 0007). Trevor chose on
 * 2026-11-21 to draw the regions from the Bureau's official outlines even
 * where an outline follows a nation's land, as the Navajo Region's does.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { geoAlbers, geoArea, geoCentroid, geoConicEqualArea, geoDistance, geoPath, type GeoPath, type GeoProjection } from 'd3-geo';
import { feature, merge, mesh } from 'topojson-client';
import { presimplify, quantile, simplify, sphericalTriangleArea } from 'topojson-simplify';
import type { Feature, FeatureCollection, Geometry, MultiPolygon, Polygon, Position } from 'geojson';
import type { GeometryCollection, Topology } from 'topojson-specification';

export const mapWidth = 975;

/** Space around the drawing and between the boxes, in map units. */
const margin = 12;

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
 * The boxes under the main map, from west to east except that Alaska, the
 * largest, comes first. Widths are in map units and add up, with the gaps
 * between boxes, to the width of the main map. The projections are
 * equal-area, like the main map's, with standard parallels for each place:
 * Alaska's and Hawaiʻi's follow the USGS values that d3-composite-projections
 * uses (EPSG:3338 and ESRI:102007); the others are chosen the same way for
 * the islands' latitudes.
 */
const insetPlans: {
	key: string;
	label: string[];
	codes: string[];
	width: number;
	projection: () => GeoProjection;
}[] = [
	{
		key: 'alaska',
		label: ['Alaska'],
		codes: ['AK'],
		width: 296,
		projection: () => geoConicEqualArea().rotate([154, 0]).center([-2, 58.5]).parallels([55, 65])
	},
	{
		key: 'hawaii',
		label: ['Hawaiʻi'],
		codes: ['HI'],
		width: 176,
		projection: () => geoConicEqualArea().rotate([157, 0]).center([-3, 19.9]).parallels([8, 18])
	},
	{
		key: 'guam-and-northern-mariana-islands',
		label: ['Guam and Northern', 'Mariana Islands'],
		codes: ['GU', 'MP'],
		width: 142,
		projection: () => geoConicEqualArea().rotate([-145.5, 0]).center([0, 16]).parallels([8, 18])
	},
	{
		key: 'american-samoa',
		label: ['American Samoa'],
		codes: ['AS'],
		width: 124,
		projection: () => geoConicEqualArea().rotate([170, 0]).center([0, -14.3]).parallels([-8, -18])
	},
	{
		key: 'puerto-rico-and-virgin-islands',
		label: ['Puerto Rico and U.S.', 'Virgin Islands'],
		codes: ['PR', 'VI'],
		width: 165,
		projection: () => geoConicEqualArea().rotate([66, 0]).center([0, 18]).parallels([8, 18])
	}
];

/** Height of each box, in map units. */
const insetHeight = 190;
/** Height of one line of a box's label. */
const insetLabelLine = 16;
/** Room at the foot of a box for its scale bar. */
const scaleBarRoom = 30;

/**
 * Places too small to see or to hit with a pointer get a labeled marker,
 * offset from the place's center by these amounts in map units (map tool
 * spike; the offsets in the boxes were checked by eye so that each marker
 * stays inside its box).
 */
const markerOffsets: Record<string, [number, number]> = {
	DC: [40, 22],
	RI: [28, 10],
	DE: [36, 6],
	VI: [-26, -40],
	GU: [-22, 0],
	MP: [-22, -8],
	AS: [10, 26]
};

/**
 * Markers whose code goes on the left of the dot, so that the line from the
 * place to its marker never runs through the code.
 */
const labelsOnTheLeft = new Set(['GU', 'MP']);

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

/** A bar showing how long a round distance is at one box's scale. */
export interface ScaleBar {
	/** Left end of the bar. */
	x: number;
	y: number;
	/** Length of the bar in map units. */
	length: number;
	/** The distance the bar stands for, such as "200 miles". */
	label: string;
}

/** One of the map's framed boxes: the contiguous United States, or a box under it. */
export interface MapFrame {
	key: string;
	/** The box's label, one entry a line. */
	label: string[];
	x: number;
	y: number;
	width: number;
	height: number;
	scaleBar: ScaleBar;
}

export interface StateShape {
	/** Postal code, such as "NM". */
	code: string;
	path: string;
	/** Where a small place's marker sits, and the line from the place to it. */
	marker?: { x: number; y: number; fromX: number; fromY: number; labelSide: 'left' | 'right' };
	/** Where the state's label sits: the center of its largest piece (small map only). */
	center?: { x: number; y: number };
}

export interface RegionShape {
	name: string;
	path: string;
	label: { x: number; y: number };
	/** False where the box's own label already names the region, as Alaska's does. */
	showLabel: boolean;
}

/** The kinds of Census area the "Land areas" view draws, as the fetch tool names them. */
export type LandAreaKind =
	| 'federal-reservation-or-trust-land'
	| 'state-reservation'
	| 'oklahoma-tribal-statistical-area'
	| 'alaska-native-village-statistical-area'
	| 'tribal-designated-statistical-area'
	| 'state-designated-tribal-statistical-area';

/** A Census American Indian or Alaska Native area, projected. */
export interface LandAreaShape {
	/** The Census Bureau's code for the area (GEOID), as the nation records cite it. */
	identifier: string;
	name: string;
	kind: LandAreaKind;
	path: string;
	/** Where a dot marks an area too small to see at the map's scale. */
	dot?: { x: number; y: number };
}

export interface MapGeometry {
	width: number;
	height: number;
	states: StateShape[];
	/** Lines between states, drawn once. */
	stateBorders: string;
	/** Every state and territory as one shape, for the land under the regions map. */
	land: string;
	regions: RegionShape[];
	/** Lines between regions and around their outer edges. */
	regionBorders: string;
	/** Where the region boundaries came from and when (geography/bureau-of-indian-affairs-regions.json). */
	regionSource: { source: string; retrieved: string };
	landAreas: LandAreaShape[];
	/** Where the land areas came from and when (geography/census-land-areas-2020.json). */
	landAreaSource: { source: string; retrieved: string };
	/**
	 * The framed boxes, each with a label and a scale bar: the contiguous
	 * United States first, then Alaska, Hawaiʻi and the territories.
	 */
	frames: MapFrame[];
	/**
	 * The same states, simplified and rounded to whole map units for the small
	 * map on every nation's page, which is drawn into 980 pages and so must be
	 * light. Shared borders stay shared, so no gaps open between states.
	 */
	smallStates: StateShape[];
}

/**
 * Share of the outline points kept for the small map. A project choice,
 * checked by eye at the size the nation pages draw the map.
 */
const smallMapDetail = 0.05;

const round = (pathData: string | null): string =>
	(pathData ?? '').replace(/(\d+\.\d{1})\d+/g, '$1');

/** Earth's mean radius in miles, for the scale bars. */
const earthRadiusMiles = 3958.8;

/** Round distances a scale bar may stand for, in miles. */
const roundDistances = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];

/**
 * A scale bar for a projection, measured across the middle of its box. An
 * equal-area projection's scale changes a little across a box, so the bar is
 * true at the box's center and close elsewhere.
 */
function scaleBar(
	projection: GeoProjection,
	center: [number, number],
	at: [number, number],
	longest: number
): ScaleBar {
	const step = 20;
	const west = projection.invert?.([center[0] - step / 2, center[1]]);
	const east = projection.invert?.([center[0] + step / 2, center[1]]);
	if (!west || !east) throw new Error('A map box has no inverse projection for its scale bar.');
	const unitsPerMile = step / (geoDistance(west, east) * earthRadiusMiles);
	const miles = roundDistances.filter((distance) => distance * unitsPerMile <= longest).at(-1) ?? 1;
	return {
		x: at[0],
		y: at[1],
		length: Math.round(miles * unitsPerMile * 10) / 10,
		label: `${miles} ${miles === 1 ? 'mile' : 'miles'}`
	};
}

/** The largest piece of a shape, by area on the map, so a label lands on land. */
function largestPiece(
	shape: Feature<Polygon | MultiPolygon>,
	area: (piece: Feature<Geometry>) => number
): Feature<Geometry> {
	if (shape.geometry.type === 'Polygon') return shape;
	const pieces = shape.geometry.coordinates.map(
		(coordinates): Feature<Geometry> => ({
			type: 'Feature',
			properties: {},
			geometry: { type: 'Polygon', coordinates }
		})
	);
	return pieces.reduce((largest, piece) => (area(piece) > area(largest) ? piece : largest));
}

/**
 * Simplifying a very small ring can leave it wound the wrong way, which
 * d3-geo reads as "the whole globe except this speck" (measured: three
 * pieces of the Navajo Nation and Pascua Pueblo Yaqui areas). Such rings are
 * turned back.
 */
function windSmallRings(area: Feature<Polygon | MultiPolygon>): Feature<Polygon | MultiPolygon> {
	const fix = (polygon: Position[][]) =>
		geoArea({ type: 'Polygon', coordinates: polygon }) > 2 * Math.PI
			? polygon.map((ring) => [...ring].reverse())
			: polygon;
	const geometry: Polygon | MultiPolygon =
		area.geometry.type === 'Polygon'
			? { type: 'Polygon', coordinates: fix(area.geometry.coordinates) }
			: { type: 'MultiPolygon', coordinates: area.geometry.coordinates.map(fix) };
	return { ...area, geometry };
}

/** Where each part of the map is drawn, and with which projection. */
interface Panel {
	key: string;
	codes: Set<string>;
	path: GeoPath;
	/** The same projection, with coordinates rounded to whole map units. */
	wholeUnits: GeoPath;
}

/**
 * Census areas a nation has asked the project to leave off the map, by
 * Census code (charter commitment 6: the nation's request wins). None yet.
 */
const withdrawnLandAreas = new Set<string>([]);

/**
 * An area whose outline covers less than this many square map units gets a
 * dot, so that small reservations and trust lands can be seen and selected
 * (project choice, checked by eye).
 */
const smallestVisibleArea = 6;

export async function buildMapGeometry(regionsFile: string, landAreasFile: string): Promise<MapGeometry> {
	const require = createRequire(import.meta.url);
	const atlas = JSON.parse(
		readFileSync(require.resolve('us-atlas/states-10m.json'), 'utf8')
	) as Topology<{ states: GeometryCollection }>;
	const regionsTopology = JSON.parse(readFileSync(regionsFile, 'utf8')) as Topology<{
		regions: GeometryCollection<{ name: string }>;
	}> & { metadata: { source: string; retrieved: string } };
	const landTopology = JSON.parse(readFileSync(landAreasFile, 'utf8')) as Topology<{
		areas: GeometryCollection<{ geographic_identifier: string; name: string; kind: LandAreaKind }>;
	}> & { metadata: { source: string; retrieved: string } };

	const codeOf = (shape: { id?: string | number }) => postalCodeByCensusCode[String(shape.id)];
	const states = (feature(atlas, atlas.objects.states) as FeatureCollection<Polygon | MultiPolygon>)
		.features;
	const insetCodes = new Set(insetPlans.flatMap((plan) => plan.codes));
	const statesWith = (codes: Set<string>): FeatureCollection => ({
		type: 'FeatureCollection',
		features: states.filter((state) => codes.has(codeOf(state)))
	});

	// The main box: the 48 contiguous states and DC, in the Albers projection
	// the Census Bureau and USGS use for them, fitted to the full width.
	const mainCodes = new Set(Object.values(postalCodeByCensusCode).filter((code) => !insetCodes.has(code)));
	const mainLabel = ['Contiguous United States'];
	const mainContentTop = margin + mainLabel.length * insetLabelLine + 16;
	const mainProjection = geoAlbers().fitWidth(mapWidth - 2 * margin - 20, statesWith(mainCodes));
	const [[mainLeft, mainTop], [, mainBottom]] = geoPath(mainProjection).bounds(statesWith(mainCodes));
	const [translateX, translateY] = mainProjection.translate();
	mainProjection.translate([translateX + margin + 10 - mainLeft, translateY + mainContentTop - mainTop]);
	const mainFrameHeight = Math.round(mainContentTop - margin + (mainBottom - mainTop) + scaleBarRoom + 6);
	const frames: MapFrame[] = [
		{
			key: 'main',
			label: mainLabel,
			x: margin,
			y: margin,
			width: mapWidth - 2 * margin,
			height: mainFrameHeight,
			scaleBar: scaleBar(
				mainProjection,
				[mapWidth / 2, mainContentTop + (mainBottom - mainTop) / 2],
				[margin + 10, margin + mainFrameHeight - 12],
				160
			)
		}
	];

	const panels: Panel[] = [
		{
			key: 'main',
			codes: mainCodes,
			path: geoPath(mainProjection),
			wholeUnits: geoPath(mainProjection).digits(0)
		}
	];
	const insetTop = margin + mainFrameHeight + margin;
	let left = margin;
	for (const plan of insetPlans) {
		const labelHeight = plan.label.length * insetLabelLine + 10;
		const projection = plan.projection().fitExtent(
			[
				[left + 10, insetTop + labelHeight + 6],
				[left + plan.width - 10, insetTop + insetHeight - scaleBarRoom]
			],
			statesWith(new Set(plan.codes))
		);
		frames.push({
			key: plan.key,
			label: plan.label,
			x: left,
			y: insetTop,
			width: plan.width,
			height: insetHeight,
			scaleBar: scaleBar(
				projection,
				[left + plan.width / 2, insetTop + (labelHeight + insetHeight - scaleBarRoom) / 2],
				[left + 10, insetTop + insetHeight - 12],
				plan.width * 0.45
			)
		});
		panels.push({
			key: plan.key,
			codes: new Set(plan.codes),
			path: geoPath(projection),
			wholeUnits: geoPath(projection).digits(0)
		});
		left += plan.width + margin;
	}
	const height = insetTop + insetHeight + margin;

	const panelOf = (code: string): Panel => {
		const panel = panels.find((candidate) => candidate.codes.has(code));
		if (!panel) throw new Error(`No part of the map draws ${code}.`);
		return panel;
	};

	const shapeOf = (state: Feature, draw: (panel: Panel) => string): StateShape => {
		const code = codeOf(state);
		const panel = panelOf(code);
		const shape: StateShape = { code, path: draw(panel) };
		const offset = markerOffsets[code];
		if (offset) {
			const [fromX, fromY] = panel.path.centroid(state).map(Math.round);
			shape.marker = {
				x: fromX + offset[0],
				y: fromY + offset[1],
				fromX,
				fromY,
				labelSide: labelsOnTheLeft.has(code) ? 'left' : 'right'
			};
		}
		return shape;
	};
	const stateShapes = states.map((state) => shapeOf(state, (panel) => round(panel.path(state))));

	const weighted = presimplify(atlas, sphericalTriangleArea);
	const simplified = simplify(weighted, quantile(weighted, smallMapDetail)) as typeof atlas;
	// Simplifying the whole atlas wipes out the smallest islands, which left the
	// boxes for Guam, the Northern Mariana Islands, American Samoa and the
	// Virgin Islands empty, so those four keep their full detail.
	const keptWhole = new Set(['GU', 'MP', 'AS', 'VI']);
	const fullDetail = new Map(states.map((state) => [codeOf(state), state]));
	const smallStates = (
		feature(simplified, simplified.objects.states) as FeatureCollection<Polygon | MultiPolygon>
	).features.map((simplifiedState) => {
		const code = codeOf(simplifiedState);
		const state = keptWhole.has(code) ? (fullDetail.get(code) ?? simplifiedState) : simplifiedState;
		const shape = shapeOf(state, (panel) => panel.wholeUnits(state) ?? '');
		const path = panelOf(shape.code).path;
		const [x, y] = path.centroid(largestPiece(state, (piece) => path.area(piece))).map(Math.round);
		return { ...shape, center: { x, y } };
	});

	// Lines between states and the merged land, each drawn by its own part of the map.
	const geometriesIn = (panel: Panel) =>
		atlas.objects.states.geometries.filter((geometry) => panel.codes.has(codeOf(geometry)));
	const stateBorders = round(
		panels[0].path(
			mesh(
				atlas,
				atlas.objects.states,
				(first, second) => first !== second && mainCodes.has(codeOf(first)) && mainCodes.has(codeOf(second))
			)
		)
	);
	const land = panels
		.map((panel) => round(panel.path(merge(atlas, geometriesIn(panel) as Parameters<typeof merge>[1]))))
		.join('');

	// The Alaska Region is drawn in Alaska's box; the other eleven regions are on the main map.
	const regionPanel = (name: string) => (name === 'Alaska' ? panelOf('AK') : panels[0]);
	const regions = (
		feature(regionsTopology, regionsTopology.objects.regions) as FeatureCollection<
			Polygon | MultiPolygon,
			{ name: string }
		>
	).features;
	const regionShapes: RegionShape[] = regions.map((region) => {
		const name = region.properties.name;
		const panel = regionPanel(name);
		const [x, y] = panel.path.centroid(largestPiece(region, (piece) => panel.path.area(piece)));
		const [shiftX, shiftY] = regionLabelShifts[name] ?? [0, 0];
		const frame = frames.find((candidate) => candidate.key === panel.key);
		return {
			name,
			path: round(panel.path(region)),
			label: { x: x + shiftX, y: y + shiftY },
			showLabel: !frame?.label.includes(name)
		};
	});
	const regionBorders = [...new Set(regions.map((region) => regionPanel(region.properties.name)))]
		.map((panel) =>
			round(
				panel.path(
					mesh(
						regionsTopology,
						regionsTopology.objects.regions,
						(first) => regionPanel((first.properties as { name: string }).name) === panel
					)
				)
			)
		)
		.join('');

	// Land areas: those in Alaska go in Alaska's box, the rest on the main map.
	// None lies in Hawaiʻi or a territory once Hawaiian home lands are left out.
	const alaska = states.find((state) => codeOf(state) === 'AK');
	const landAreas: LandAreaShape[] = (
		feature(landTopology, landTopology.objects.areas) as FeatureCollection<
			Polygon | MultiPolygon,
			{ geographic_identifier: string; name: string; kind: LandAreaKind }
		>
	).features
		.filter((drawn) => !withdrawnLandAreas.has(drawn.properties.geographic_identifier))
		.map((drawn) => {
			const area = windSmallRings(drawn) as typeof drawn;
			const [longitude, latitude] = geoCentroid(area);
			const inAlaska = latitude > 51 && (longitude < -129 || longitude > 170);
			const panel = inAlaska && alaska ? panelOf('AK') : panels[0];
			const shape: LandAreaShape = {
				identifier: area.properties.geographic_identifier,
				name: area.properties.name,
				kind: area.properties.kind,
				path: round(panel.path(area))
			};
			if (panel.path.area(area) < smallestVisibleArea) {
				const [x, y] = panel.path.centroid(area);
				shape.dot = { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
			}
			return shape;
		});

	return {
		width: mapWidth,
		height,
		states: stateShapes,
		stateBorders,
		land,
		regions: regionShapes,
		regionBorders,
		regionSource: {
			source: regionsTopology.metadata.source,
			retrieved: regionsTopology.metadata.retrieved
		},
		landAreas,
		landAreaSource: {
			source: landTopology.metadata.source,
			retrieved: landTopology.metadata.retrieved
		},
		frames,
		smallStates
	};
}
