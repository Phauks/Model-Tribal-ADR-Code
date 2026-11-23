import geometry from 'virtual:map-geometry';
import type { FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import regionsTopology from '../../../geography/bureau-of-indian-affairs-regions.json';
import landAreaPoints from '../../../geography/census-land-area-points-2020.json';
import tileManifest from '../../../geography/map-tiles.json';
import withdrawnList from '../../../geography/withdrawn-land-areas.json';
import { nations } from '#lib/server/content.ts';
import { SourceUses } from '#lib/server/source-uses.ts';
import { displayName, regionAnchor, stateName } from '#lib/nation-labels.ts';
import { recognitionBadges, type RecognitionBadge } from '#lib/recognition-badges.ts';
import {
	landAreaAnchor,
	landAreaGroups,
	landAreaKindLabels,
	type LandAreaCount,
	type NationsMapCounts
} from '#lib/nations-map-drawing.ts';
import type { LandAreaKind } from '#lib/map-geometry.ts';

/** A nation as a map table lists it, with its recognition badges (none for no federal recognition). */
interface ListedNation {
	id: string;
	name: string;
	badges?: RecognitionBadge[];
}

function listed(record: ReturnType<typeof nations>[number]): ListedNation {
	const badges = recognitionBadges(record.recognition ?? []);
	return { id: record.id, name: displayName(record.names.official), ...(badges.length > 0 ? { badges } : {}) };
}

/**
 * Count classes for shading states, drawn with the map-class tokens. The
 * steps are a project choice that spreads today's counts (1 to 230 nations a
 * state) over four shades; the legend and the table always give the counts.
 */
const countClasses = [
	{ key: 0, label: 'None recorded', from: 0, to: 0 },
	{ key: 1, label: '1 to 4 nations', from: 1, to: 4 },
	{ key: 2, label: '5 to 14 nations', from: 5, to: 14 },
	{ key: 3, label: '15 to 49 nations', from: 15, to: 49 },
	{ key: 4, label: '50 or more nations', from: 50, to: Infinity }
];

function countClass(count: number): number {
	return countClasses.find((entry) => count >= entry.from && count <= entry.to)?.key ?? 0;
}

const byName = (first: ListedNation, second: ListedNation) =>
	first.name.localeCompare(second.name, 'en', { sensitivity: 'base' });

/**
 * Everything /nations/map shows except the map outlines: the counts the map's
 * views are shaded by, the tables and the sources. The outlines are drawn from
 * these counts by src/lib/nations-map-drawing.ts. Used by the page and by
 * /nations/map/drawings.json.
 */
export function nationsMapPage() {
	const records = nations();

	// Nations with a presence in each state, from each record's cited `states` facts.
	const nationsByState = new Map<string, ListedNation[]>();
	for (const record of records) {
		for (const state of new Set((record.states ?? []).map((fact) => fact.state))) {
			const list = nationsByState.get(state) ?? [];
			list.push(listed(record));
			nationsByState.set(state, list);
		}
	}

	const states = geometry.states.map((shape) => {
		const count = nationsByState.get(shape.code)?.length ?? 0;
		return { code: shape.code, name: stateName(shape.code), count, countClass: countClass(count) };
	});

	const stateRows = [...nationsByState.entries()]
		.map(([code, list]) => ({ code, name: stateName(code), nations: list.sort(byName) }))
		.sort((first, second) => first.name.localeCompare(second.name, 'en'));

	// Nations served by each Bureau of Indian Affairs region, as the Bureau's
	// Tribal Leaders Directory assigns them (each record's federal_administration).
	const sources = new SourceUses();
	const nationsByRegion = new Map<string, ListedNation[]>();
	const statesByRegion = new Map<string, Set<string>>();
	for (const record of records) {
		const administration = record.federal_administration;
		const region = administration?.bureau_of_indian_affairs_region;
		if (!region) continue;
		const list = nationsByRegion.get(region) ?? [];
		list.push(listed(record));
		nationsByRegion.set(region, list);
		const regionStates = statesByRegion.get(region) ?? new Set<string>();
		for (const fact of record.states ?? []) regionStates.add(fact.state);
		statesByRegion.set(region, regionStates);
		if (administration.source) {
			sources.add(administration.source, {
				section: 'Which region serves each nation',
				text: 'the region named in each nation’s entry',
				where: administration.as_of ? `as of ${administration.as_of}` : undefined
			});
		}
	}

	sources.add(geometry.regionSource.source, {
		section: 'Region outlines',
		text: 'the twelve regions, simplified for a national map',
		where: `retrieved ${geometry.regionSource.retrieved}`
	});
	sources.add('census-cartographic-boundary-states-2017', {
		section: 'State and territory outlines',
		text: 'every state, DC, American Samoa, Guam, the Northern Mariana Islands, Puerto Rico and the U.S. Virgin Islands, through us-atlas 3.0.1'
	});

	const regions = geometry.regions.map((shape) => ({
		name: shape.name,
		anchor: regionAnchor(shape.name),
		count: nationsByRegion.get(shape.name)?.length ?? 0
	}));

	const regionRows = regions
		.map((region) => ({
			name: region.name,
			anchor: region.anchor,
			nations: (nationsByRegion.get(region.name) ?? []).sort(byName),
			states: [...(statesByRegion.get(region.name) ?? [])].map(stateName).sort()
		}))
		.sort((first, second) => first.name.localeCompare(second.name, 'en'));

	addLandAreaSources(records, sources);

	const counts: NationsMapCounts = { states, regions };

	return {
		counts,
		countClasses: countClasses.map(({ key, label }) => ({ key, label })),
		stateRows,
		regionRows,
		landAreaGroups: landAreaGroups.map(({ key, label }) => ({ key, label })),
		sources: sources.list
	};
}

/** Nations linked to each Census area, from each record's cited `census_areas` facts (2020 codes, the vintage the map draws). */
function nationsByLandArea(records: ReturnType<typeof nations>): Map<string, ListedNation[]> {
	const byArea = new Map<string, ListedNation[]>();
	for (const record of records) {
		for (const area of record.census_areas ?? []) {
			if (area.vintage && area.vintage !== '2020') continue;
			const list = byArea.get(area.geographic_identifier) ?? [];
			if (!list.some((nation) => nation.id === record.id)) list.push(listed(record));
			byArea.set(area.geographic_identifier, list);
		}
	}
	return byArea;
}

/** The sources of the "Land areas" view, listed with the page's other sources. */
function addLandAreaSources(records: ReturnType<typeof nations>, sources: SourceUses): void {
	for (const record of records) {
		for (const area of record.census_areas ?? []) {
			if (!area.source || (area.vintage && area.vintage !== '2020')) continue;
			sources.add(area.source, {
				section: 'Which nations each land area is linked to',
				text: 'the Census areas named in each nation’s entry'
			});
		}
	}
	sources.add(geometry.landAreaSource.source, {
		section: 'Land area outlines',
		text: 'reservations, trust lands and statistical areas, simplified for a national map',
		where: `retrieved ${geometry.landAreaSource.retrieved}`
	});
	sources.add('protomaps-basemap-openstreetmap', {
		section: 'Basemap',
		text: 'the map of places, roads and water under each view, where the browser can draw it'
	});
	sources.add('census-cartographic-boundary-states-2020', {
		section: 'State and territory outlines',
		text: 'state and territory outlines on the zoomable map'
	});
}

/**
 * The "Land areas" view's table rows and the counts its drawing is shaded
 * by, served from /nations/map/land-areas.json when a reader opens the view.
 */
export function landAreasView() {
	const byArea = nationsByLandArea(nations());
	const areas = geometry.landAreas.map((shape) => ({
		identifier: shape.identifier,
		name: shape.name,
		kind: shape.kind,
		anchor: landAreaAnchor(shape.identifier),
		nations: (byArea.get(shape.identifier) ?? []).sort(byName)
	}));
	const counts: LandAreaCount[] = areas.map(({ identifier, name, kind, anchor, nations: linked }) => ({
		identifier,
		name,
		kind,
		anchor,
		count: linked.length
	}));
	const rows = areas
		.map((area) => ({ ...area, kindLabel: landAreaKindLabels[area.kind] }))
		.sort((first, second) => first.name.localeCompare(second.name, 'en'));
	return { counts, rows };
}

export type LandAreaRow = ReturnType<typeof landAreasView>['rows'][number];

/** Each land area's label point, bounds and size (written by tools/build-map-tiles.mjs). */
interface LandAreaPoint {
	code: string;
	name: string;
	kind: LandAreaKind;
	square_kilometers: number;
	point: [number, number];
	bounds: [number, number, number, number];
}

const withdrawnLandAreas = new Set<string>(withdrawnList.codes);

/**
 * What the map drawn with MapLibre needs besides its tiles (decision record 0039), served from /nations/map/tile-map.json: the tile sets' names, each state's shade and table row, the regions' outlines and rows, and each land area's label, dot, bounds and row. Names come from the nation records, so they are never baked into the tiles.
 */
export function tileMapData() {
	const page = nationsMapPage();
	const rowStates = new Set(page.stateRows.map((row) => row.code));
	const states = Object.fromEntries(
		page.counts.states.map((state) => [state.code, { countClass: state.countClass, anchor: rowStates.has(state.code) ? `state-${state.code}` : undefined }])
	);
	const topology = regionsTopology as unknown as Topology<{ regions: GeometryCollection<{ name: string }> }>;
	const regions = feature(topology, topology.objects.regions) as FeatureCollection<Polygon | MultiPolygon, { name: string }>;
	const regionAnchors = new Map(page.regionRows.map((row) => [row.name, row.anchor]));
	const byArea = nationsByLandArea(nations());
	return {
		tiles: tileSetNames,
		states,
		regions: {
			type: 'FeatureCollection' as const,
			features: regions.features.map((region) => ({
				type: 'Feature' as const,
				properties: { name: region.properties.name, anchor: regionAnchors.get(region.properties.name) ?? regionAnchor(region.properties.name) },
				geometry: region.geometry
			}))
		},
		areas: tileMapAreas(byArea, () => true)
	};
}

/** The tile sets' names, which change whenever their files do. */
const tileSetNames = { landAreas: tileManifest.landAreas.set, basemap: tileManifest.basemap.set, maximumZoom: tileManifest.basemap.maxZoom };

/** Each land area's dot, box and label for the tiled map, for the areas the test keeps. */
function tileMapAreas(byArea: Map<string, ListedNation[]>, keep: (code: string) => boolean) {
	const groups = new Map<string, string>(landAreaGroups.flatMap((group) => group.kinds.map((kind) => [kind, group.key] as [string, string])));
	return (landAreaPoints.areas as LandAreaPoint[])
		.filter((area) => !withdrawnLandAreas.has(area.code) && keep(area.code))
		.map((area) => {
			const linked = byArea.get(area.code) ?? [];
			return {
				code: area.code,
				// One nation: its name, which readers know; several or none: the Census Bureau's name for the area.
				label: linked.length === 1 ? linked[0].name : area.name,
				group: groups.get(area.kind) ?? 'statistical',
				squareKilometers: area.square_kilometers,
				point: area.point,
				bounds: area.bounds,
				anchor: landAreaAnchor(area.code),
				nations: linked.length
			};
		});
}

/**
 * The tiled map's data for one nation's page: only the land areas its entry names, labeled with the Census Bureau's names, since the page is already about the nation. No states or regions: the page's other views stay drawn.
 */
export function nationTileMapData(codes: string[]): TileMapData {
	const wanted = new Set(codes);
	return {
		tiles: tileSetNames,
		states: {},
		regions: { type: 'FeatureCollection', features: [] },
		areas: tileMapAreas(new Map(), (code) => wanted.has(code))
	};
}

export type TileMapData = ReturnType<typeof tileMapData>;
