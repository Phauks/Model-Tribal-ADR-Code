import geometry from 'virtual:map-geometry';
import type { FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import regionsTopology from '../../../geography/bureau-of-indian-affairs-regions.json';
import landAreaPoints from '../../../geography/census-land-area-points-2020.json';
import tileManifest from '../../../geography/map-tiles.json';
import officeList from '../../../geography/nation-office-points.json';
import withdrawnList from '../../../geography/withdrawn-land-areas.json';
import { nations } from '#lib/server/content.ts';
import { SourceUses } from '#lib/server/source-uses.ts';
import { displayName, regionAnchor, stateName } from '#lib/nation-labels.ts';
import {
	agreementCategories,
	courtCategories,
	otherJurisdictionLawCategories,
	healthServiceAreaShades,
	publicLaw280Categories,
	shadedMapViews,
	shadedRowAnchor,
	unrecordedLabels,
	violenceAgainstWomenActCategories,
	type ShadeCategory,
	type ShadedMapView
} from '#lib/shaded-map-views.ts';
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
	addShadedViewSources(records, sources);

	const counts: NationsMapCounts = { states, regions };
	const landless = records.filter((record) => !(record.census_areas ?? []).some((area) => !area.vintage || area.vintage === '2020')).length;
	const placed = placedOffices().length;

	return {
		counts,
		countClasses: countClasses.map(({ key, label }) => ({ key, label })),
		stateRows,
		regionRows,
		landAreaGroups: landAreaGroups.map(({ key, label }) => ({ key, label })),
		offices: { placed, unplaced: landless - placed },
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
	sources.add('census-geocoder', {
		section: 'Offices of nations with no land area',
		text: 'where the office address in each nation’s entry lies',
		where: `matched ${officeList.retrieved}`
	});
	sources.add('census-gazetteer-zcta-2020', {
		section: 'Offices of nations with no land area',
		text: 'the middle of the ZIP Code area, for an address the geocoder could not match, such as a post office box'
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

/** The "Land areas" view's office dots: nations with no Census land area, each going to its own page, since the view's table lists areas. */
export function landAreaOffices() {
	return placedOffices().map((office) => ({
		nation: office.nation,
		shade: 0,
		href: `/nations/${office.nation}`,
		description: `${office.name}: office of a nation with no Census land area${office.approximate ? ' (placed by ZIP code)' : ''}`
	}));
}

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
		areas: tileMapAreas(byArea, () => true),
		offices: placedOffices().map((office) => ({ ...office, anchor: `/nations/${office.nation}` })),
		shading: tileMapShading() as ReturnType<typeof tileMapShading> | undefined
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
		areas: tileMapAreas(new Map(), (code) => wanted.has(code)),
		offices: [],
		shading: undefined
	};
}

export type TileMapData = ReturnType<typeof tileMapData>;

type NationRecord = ReturnType<typeof nations>[number];

/** The record's facts on one jurisdiction topic. */
const factsOn = (record: NationRecord, topic: string) => (record.jurisdiction ?? []).filter((fact) => fact.topic === topic);

const publicLaw280Topic = 'public-law-280';
const violenceAgainstWomenActTopic = 'violence-against-women-act-special-tribal-criminal-jurisdiction';

/** The nation's Public Law 280 category (src/lib/shaded-map-views.ts gives the order of precedence), or none if no fact is recorded. */
function publicLaw280Category(record: NationRecord): string | undefined {
	const values = new Set(factsOn(record, publicLaw280Topic).map((fact) => fact.value ?? ''));
	if (values.size === 0) return undefined;
	if (values.has('retroceded')) return 'returned';
	if (values.has('mandatory-state')) return 'mandatory';
	if (values.has('optional-state') && !values.has('repealed')) return 'optional';
	return 'none';
}

function violenceAgainstWomenActCategory(record: NationRecord): string | undefined {
	const values = new Set(factsOn(record, violenceAgainstWomenActTopic).map((fact) => fact.value));
	if (values.has('exercising')) return 'exercising';
	if (values.has('implementation-grant')) return 'implementation-grant';
	return undefined;
}

/** Forums the courts view counts as peacemaking or traditional (dispute_resolution.forums kinds). */
const traditionalForumKinds = new Set(['peacemaking', 'elders-council', 'customary-dispute-resolution', 'circle-process', 'family-group-conference', 'restorative-justice']);

/** What a record says about its courts and forums, as the courts view's table columns give it. */
function courtsOf(record: NationRecord) {
	const institutions = record.justice_institutions ?? [];
	const kinds = new Set(institutions.map((institution) => institution.kind));
	const forums = record.dispute_resolution?.forums ?? [];
	const peacemaking = kinds.has('peacemaking-program') || kinds.has('traditional-forum') || forums.some((forum) => traditionalForumKinds.has(forum.kind));
	const wellness = kinds.has('healing-to-wellness-court');
	const federal = kinds.has('court-of-indian-offenses');
	const tribal = institutions.some((institution) => !['peacemaking-program', 'traditional-forum', 'healing-to-wellness-court', 'court-of-indian-offenses', 'other'].includes(institution.kind));
	return { peacemaking, wellness, federal, tribal, count: institutions.length + forums.length };
}

/**
 * Views whose table shows every kind a nation has, one Yes column each, since the map can shade only one. Each kind is one of the view's categories (src/lib/shaded-map-views.ts), and a nation is shaded by the first it has. `section` is the part of the nation's page that cites the facts.
 */
const kindViews: Partial<Record<ShadedMapView, { categories: ShadeCategory[]; headers: Record<string, string>; section: string; has: (record: NationRecord) => Record<string, boolean> }>> = {
	'courts-and-peacemaking': {
		categories: courtCategories,
		headers: { peacemaking: 'Peacemaking or traditional forum', wellness: 'Wellness court', court: 'Tribal court', federal: 'Court of Indian Offenses' },
		section: 'courts-heading',
		has: (record) => {
			const courts = courtsOf(record);
			return { peacemaking: courts.peacemaking, wellness: courts.wellness, court: courts.tribal, federal: courts.federal };
		}
	},
	'other-jurisdiction-laws': {
		categories: otherJurisdictionLawCategories,
		headers: { 'state-statute': 'State jurisdiction under another law', 'child-welfare-reassumed': 'Child welfare jurisdiction reassumed', 'enhanced-sentencing': 'Enhanced sentencing' },
		section: 'jurisdiction-heading',
		has: (record) => ({
			'state-statute': factsOn(record, 'state-jurisdiction-statute').some((fact) => (fact.value ?? '').startsWith('state-')),
			'child-welfare-reassumed': factsOn(record, 'indian-child-welfare-act').some((fact) => fact.value === 'reassumed-jurisdiction'),
			'enhanced-sentencing': factsOn(record, 'tribal-law-and-order-act-enhanced-sentencing').some((fact) => fact.value === 'implementing')
		})
	},
	'agreements-with-states': {
		categories: agreementCategories,
		headers: { 'cross-deputization': 'Cross-deputization', 'child-welfare-agreement': 'Child welfare', 'tax-agreement': 'Tax', other: 'Other' },
		section: 'jurisdiction-heading',
		has: (record) => {
			const kinds = new Set((record.jurisdiction_agreements ?? []).map((agreement) => agreement.kind));
			return Object.fromEntries(agreementCategories.map((category) => [category.key, kinds.has(category.key)]));
		}
	}
};

/** The first kind the record has, in the view's order. */
function firstKind(view: ShadedMapView) {
	const entry = kindViews[view];
	return (record: NationRecord): string | undefined => {
		if (!entry) return undefined;
		const has = entry.has(record);
		return entry.categories.find((category) => has[category.key])?.key;
	};
}

const healthServiceArea = (record: NationRecord): string | undefined => record.indian_health_service?.find((fact) => fact.area)?.area;

/** One land area as a shaded view draws it: its shade, the table row it goes to, and what its tooltip says. */
export interface ShadedArea {
	code: string;
	shade: number;
	anchor?: string;
	category?: string;
}

/** A shaded view's legend, its land areas and its table rows. */
function buildShadedView(view: ShadedMapView) {
	const records = nations();
	const byArea = new Map<string, NationRecord[]>();
	for (const record of records) {
		for (const area of record.census_areas ?? []) {
			if (area.vintage && area.vintage !== '2020') continue;
			const list = byArea.get(area.geographic_identifier) ?? [];
			if (!list.includes(record)) list.push(record);
			byArea.set(area.geographic_identifier, list);
		}
	}

	let categories: ShadeCategory[];
	let categoryOf: (record: NationRecord) => string | undefined;
	/** The row a nation's area goes to. */
	let rowOf: (record: NationRecord, category: string) => string;
	if (view === 'indian-health-service') {
		const names = [...new Set(records.map(healthServiceArea).filter((name): name is string => Boolean(name)))].sort((first, second) => first.localeCompare(second, 'en'));
		categories = names.map((name) => ({ key: name, label: `${name} Area`, shade: healthServiceAreaShades[name] ?? 2 }));
		categoryOf = healthServiceArea;
		rowOf = (_record, category) => shadedRowAnchor(view, category);
	} else {
		const kinds = kindViews[view];
		if (kinds) {
			categories = kinds.categories;
			categoryOf = firstKind(view);
		} else if (view === 'public-law-280') {
			categories = publicLaw280Categories;
			categoryOf = publicLaw280Category;
		} else {
			categories = violenceAgainstWomenActCategories;
			categoryOf = violenceAgainstWomenActCategory;
		}
		rowOf = (record) => shadedRowAnchor(view, record.id);
	}
	const order = categories.map((category) => category.key);
	const rank = (category: string) => order.indexOf(category);

	// An area named by several nations takes the category that comes first in the legend's order of precedence.
	const areas: ShadedArea[] = (landAreaPoints.areas as LandAreaPoint[])
		.filter((area) => !withdrawnLandAreas.has(area.code))
		.map((area) => {
			const found = (byArea.get(area.code) ?? [])
				.map((record) => ({ record, category: categoryOf(record) }))
				.filter((entry): entry is { record: NationRecord; category: string } => entry.category !== undefined && rank(entry.category) >= 0)
				.sort((first, second) => rank(first.category) - rank(second.category))[0];
			if (!found) return { code: area.code, shade: 0 };
			const category = categories[rank(found.category)];
			return { code: area.code, shade: category.shade, anchor: rowOf(found.record, found.category), category: category.key };
		});

	// Each placed office takes its own nation's category.
	const byId = new Map(records.map((record) => [record.id, record]));
	const offices: ShadedOffice[] = placedOffices().flatMap((office) => {
		const record = byId.get(office.nation);
		if (!record) return [];
		const key = categoryOf(record);
		const category = key === undefined ? undefined : categories[rank(key)];
		return [{ nation: office.nation, name: office.name, shade: category?.shade ?? 0, anchor: category && key ? rowOf(record, key) : undefined, category: category?.key }];
	});

	return { categories, categoryOf, areas, offices, records };
}

/** A nation with no Census land area, marked at its office, as a shaded view draws it. */
interface ShadedOffice {
	nation: string;
	name: string;
	shade: number;
	anchor?: string;
	category?: string;
}

/**
 * The offices of nations with no Census land area that are on the site, each with the nation's name and how precisely it is placed: at the address, or only in the address's ZIP Code area (scripts/maps/geocode_nation_offices.py).
 */
function placedOffices() {
	const published = new Map(nations().map((record) => [record.id, record]));
	return (officeList.offices as unknown as { nation: string; point: [number, number]; precision: string }[]).flatMap((office) => {
		const record = published.get(office.nation);
		if (!record || (record.census_areas ?? []).some((area) => !area.vintage || area.vintage === '2020')) return [];
		return [{ nation: office.nation, name: displayName(record.names.official), point: office.point, approximate: office.precision !== 'address' }];
	});
}

/** Where to write each Indian Health Service Area's name: the middle (median) of its land areas' label points, in degrees. */
function healthServiceAreaLabels(areas: ShadedArea[]): { name: string; point: [number, number] }[] {
	const points = new Map((landAreaPoints.areas as LandAreaPoint[]).map((area) => [area.code, area.point]));
	const byCategory = new Map<string, [number, number][]>();
	for (const area of areas) {
		const point = points.get(area.code);
		if (!area.category || !point) continue;
		const list = byCategory.get(area.category) ?? [];
		list.push(point);
		byCategory.set(area.category, list);
	}
	const median = (values: number[]) => {
		const sorted = [...values].sort((first, second) => first - second);
		return sorted[Math.floor(sorted.length / 2)];
	};
	return [...byCategory.entries()].map(([name, list]) => ({ name, point: [median(list.map((point) => point[0])), median(list.map((point) => point[1]))] }));
}

/** What the tiled map needs for each shaded view: each area's shade and row, and for the Indian Health Service view where to write each Area's name. */
function tileMapShading() {
	return Object.fromEntries(
		shadedMapViews.map((view) => {
			const built = buildShadedView(view);
			const areas = Object.fromEntries(built.areas.filter((area) => area.anchor).map((area) => [area.code, { shade: area.shade, anchor: area.anchor as string }]));
			const offices = Object.fromEntries(built.offices.filter((office) => office.anchor).map((office) => [office.nation, { shade: office.shade, anchor: office.anchor as string }]));
			return [view, { areas, offices, labels: view === 'indian-health-service' ? healthServiceAreaLabels(built.areas) : [] }];
		})
	) as Record<
		ShadedMapView,
		{ areas: Record<string, { shade: number; anchor: string }>; offices: Record<string, { shade: number; anchor: string }>; labels: { name: string; point: [number, number] }[] }
	>;
}

/** The states a nation's entry places it in, by name. */
const statesOf = (record: NationRecord) => [...new Set((record.states ?? []).map((fact) => stateName(fact.state)))].sort((first, second) => first.localeCompare(second, 'en'));

/**
 * A shaded view's legend and table, and the shades its drawing is drawn with, served from /nations/map/views/<view>.json when a reader opens the view. Public Law 280 and the Violence Against Women Act list nations; the Indian Health Service view lists its Areas, each opening to its nations.
 */
export function shadedView(view: ShadedMapView) {
	const built = buildShadedView(view);
	const labelOf = new Map(built.categories.map((category) => [category.key, category.label]));
	const names = new Map((landAreaPoints.areas as LandAreaPoint[]).map((area) => [area.code, area.name]));
	const unrecorded = unrecordedLabels[view];
	const drawn = built.areas.map((area) => ({
		identifier: area.code,
		shade: area.shade,
		anchor: area.anchor,
		description: `${names.get(area.code) ?? area.code}: ${area.category ? (labelOf.get(area.category) ?? area.category) : unrecorded}`
	}));
	const legend = [...built.categories.map(({ key, label, shade }) => ({ key, label, shade })), { key: 'unrecorded', label: unrecorded, shade: 0 }];
	const offices = built.offices.map((office) => ({
		nation: office.nation,
		shade: office.shade,
		anchor: office.anchor,
		description: `${office.name} (office; no Census land area): ${office.category ? (labelOf.get(office.category) ?? office.category) : unrecorded}`
	}));

	if (view === 'indian-health-service') {
		const rows = built.categories.map((category) => {
			const members = built.records.filter((record) => healthServiceArea(record) === category.key);
			return {
				anchor: shadedRowAnchor(view, category.key),
				name: category.label,
				nations: members.map(listed).sort(byName),
				states: [...new Set(members.flatMap(statesOf))].sort((first, second) => first.localeCompare(second, 'en'))
			};
		});
		return { view, legend, drawn, offices, kindColumns: [], section: 'ties-heading', labels: built.categories.map((category) => ({ name: category.key, identifiers: built.areas.filter((area) => area.category === category.key).map((area) => area.code) })), nationRows: [], areaRows: rows };
	}

	const kinds = kindViews[view];
	const nationRows = built.records
		.map((record) => ({ record, category: built.categoryOf(record) }))
		.filter((entry): entry is { record: NationRecord; category: string } => entry.category !== undefined)
		.map(({ record, category }) => ({
			anchor: shadedRowAnchor(view, record.id),
			id: record.id,
			name: displayName(record.names.official),
			states: statesOf(record),
			category: labelOf.get(category) ?? category,
			kinds: kinds ? kinds.has(record) : {}
		}))
		.sort((first, second) => first.name.localeCompare(second.name, 'en', { sensitivity: 'base' }));
	// A table that shows every kind has one Yes column per kind, in the map's order.
	const kindColumns = kinds ? kinds.categories.map((category) => ({ key: category.key, header: kinds.headers[category.key] ?? category.label })) : [];
	return { view, legend, drawn, offices, labels: [], nationRows, areaRows: [], kindColumns, section: kinds?.section ?? 'jurisdiction-heading' };
}

export type ShadedViewData = ReturnType<typeof shadedView>;

/** The sources of the shaded views, listed with the page's other sources. */
function addShadedViewSources(records: NationRecord[], sources: SourceUses): void {
	for (const record of records) {
		for (const fact of factsOn(record, publicLaw280Topic)) {
			if (fact.source) sources.add(fact.source, { section: 'Public Law 280', text: 'each nation’s Public Law 280 facts, summed up in one category' });
		}
		for (const fact of factsOn(record, violenceAgainstWomenActTopic)) {
			if (fact.source) sources.add(fact.source, { section: 'Violence Against Women Act jurisdiction', text: 'nations exercising special Tribal criminal jurisdiction, and implementation grants' });
		}
		for (const fact of record.jurisdiction ?? []) {
			if (fact.source && ['state-jurisdiction-statute', 'tribal-law-and-order-act-enhanced-sentencing'].includes(fact.topic)) sources.add(fact.source, { section: 'Other jurisdiction laws', text: 'each nation’s facts on state jurisdiction under other federal laws and on enhanced sentencing' });
			if (fact.source && fact.topic === 'indian-child-welfare-act' && fact.value === 'reassumed-jurisdiction') sources.add(fact.source, { section: 'Other jurisdiction laws', text: 'nations that reassumed jurisdiction under the Indian Child Welfare Act' });
		}
		for (const fact of record.jurisdiction_agreements ?? []) {
			if (fact.source) sources.add(fact.source, { section: 'Agreements with states', text: 'each nation’s agreements with a state, county, city or federal agency' });
		}
		for (const fact of record.indian_health_service ?? []) {
			if (fact.source) sources.add(fact.source, { section: 'Indian Health Service Areas', text: 'the Area that serves each nation' });
		}
	}
}
