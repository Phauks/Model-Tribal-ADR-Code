import geometry from 'virtual:map-geometry';
import type { FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import regionsTopology from '../../../geography/bureau-of-indian-affairs-regions.json';
import landAreaPoints from '../../../geography/census-land-area-points-2020.json';
import tileManifest from '../../../geography/map-tiles.json';
import officeList from '../../../geography/nation-office-points.json';
import withdrawnList from '../../../geography/withdrawn-land-areas.json';
import { documentHistories, nations } from '#lib/server/content.ts';
import { SourceUses } from '#lib/server/source-uses.ts';
import { displayName, regionAnchor, stateName } from '#lib/nation-labels.ts';
import { healthServiceAreaShades, shadedMapViews, shadedRowAnchor, shadedViewDefinitions, type ShadeCategory, type ShadedMapView } from '#lib/shaded-map-views.ts';
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
		page.counts.states.map((state) => [
			state.code,
			{ countClass: state.countClass, anchor: rowStates.has(state.code) ? `state-${state.code}` : undefined, name: state.name, count: state.count, point: geometry.statePoints[state.code] as [number, number] | undefined, bounds: geometry.stateBounds[state.code] as [number, number, number, number] | undefined }
		])
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
	const tribal = institutions.some((institution) => !['peacemaking-program', 'traditional-forum', 'healing-to-wellness-court', 'court-of-indian-offenses', 'council-hearing', 'administrative-adjudication', 'other'].includes(institution.kind));
	return { peacemaking, wellness, federal, tribal, count: institutions.length + forums.length };
}

/** The compact statuses the gaming view counts as a compact: approved or let take effect, even if since expired or replaced. */
const compactCounts = new Set(['in-effect', 'approved', 'deemed-approved', 'expired']);

let gamingHistoryCache: Map<string, Set<string>> | undefined;

/** The kinds of gaming document history (compact or Secretarial Procedures) that name each nation, counting only those with a version that was not disapproved. */
function gamingHistoryKinds(): Map<string, Set<string>> {
	if (!gamingHistoryCache) {
		gamingHistoryCache = new Map();
		for (const history of documentHistories()) {
			if (history.kind !== 'gaming-compact' && history.kind !== 'secretarial-procedures') continue;
			if (!history.versions.some((version) => version.status !== 'disapproved')) continue;
			for (const nation of history.nations ?? []) {
				const kinds = gamingHistoryCache.get(nation) ?? new Set<string>();
				kinds.add(history.kind);
				gamingHistoryCache.set(nation, kinds);
			}
		}
	}
	return gamingHistoryCache;
}

/** The Census land area a resident-population fact counts, from its locator ("GEOID 2500000US0325"). */
const censusAreaOf = (fact: { locator?: string }) => /GEOID 2500000US(\w{4})/.exec(fact.locator ?? '')?.[1];

let residentCache: Map<string, { count: number }> | undefined;

/** The 2020 Census count of people living in each land area, from the resident-population facts in the nations' entries. */
function censusResidents(): Map<string, { count: number }> {
	if (!residentCache) {
		residentCache = new Map();
		for (const record of nations()) {
			for (const fact of record.population ?? []) {
				const code = fact.kind === 'resident-population' ? censusAreaOf(fact) : undefined;
				if (code && typeof fact.count === 'number') residentCache.set(code, { count: fact.count });
			}
		}
	}
	return residentCache;
}

let languageCache: Map<string, string> | undefined;

/**
 * Each spelling of a language name in the entries, and the one name the map uses for it: entries from different sources write some names with different punctuation ("Dena'ina" and "Dena’ina", "Ojibwe (Anishinaabemowin)" and "Ojibwe Anishinaabemowin"), and these are one name. The spelling most entries use wins. Different names are kept apart even when they share a language tag, since each is the name a nation gives its language (Ute and Southern Paiute share one tag).
 */
function languageNames(): Map<string, string> {
	if (!languageCache) {
		const sameName = (name: string) => name.toLowerCase().replace(/[’‘`]/g, "'").replace(/[^\p{L}\p{N}']+/gu, ' ').trim();
		const spellings = new Map<string, Map<string, number>>();
		for (const record of nations()) {
			for (const fact of record.languages ?? []) {
				if (!fact.name) continue;
				const counts = spellings.get(sameName(fact.name)) ?? new Map<string, number>();
				counts.set(fact.name, (counts.get(fact.name) ?? 0) + 1);
				spellings.set(sameName(fact.name), counts);
			}
		}
		languageCache = new Map();
		for (const counts of spellings.values()) {
			const chosen = [...counts.entries()].sort((first, second) => second[1] - first[1] || first[0].localeCompare(second[0], 'en'))[0][0];
			for (const spelling of counts.keys()) languageCache.set(spelling, chosen);
		}
	}
	return languageCache;
}

const languageName = (name: string) => languageNames().get(name) ?? name;

let constitutionCache: Set<string> | undefined;

/** The nations named by a constitution's document history (content/documents/). */
function constitutionHistories(): Set<string> {
	constitutionCache ??= new Set(documentHistories().filter((history) => history.kind === 'constitution').flatMap((history) => history.nations ?? []));
	return constitutionCache;
}

const healthServiceArea = (record: NationRecord): string | undefined => record.indian_health_service?.find((fact) => fact.area)?.area;

/**
 * How each shaded view sorts a nation into its categories (src/lib/shaded-map-views.ts has the categories and everything the page says). A view gives `categoryOf` when a nation has one category, or `has` when it can have several kinds at once, in which case the map shades it by the first kind it has and the table shows them all.
 */
interface ShadedViewRule {
	/** The nation's one category, or none if nothing is recorded. */
	categoryOf?: (record: NationRecord) => string | undefined;
	/** Which of the view's categories the nation has, by key. */
	has?: (record: NationRecord) => Record<string, boolean>;
	/** The categories, for a view whose definition leaves them out because they come from the data. */
	categoriesFrom?: (records: NationRecord[]) => ShadeCategory[];
	/** The facts the view reads, whose sources the page lists. Left out with the definition's `sources`. */
	facts?: (record: NationRecord) => { source?: string }[];
	/** For a view of a fact about each land area rather than its nations, such as how many people live there: the area's category. */
	areaCategoryOf?: (code: string) => string | undefined;
	/** For a table of land areas: the number its second column gives for each area. */
	areaValue?: (code: string) => number | undefined;
	/** For the by-state map: the states a nation's category applies in, where its facts name one, such as the state of an agreement or a compact. Left out, or undefined for a category, it applies in every state the nation's entry places it in. */
	statesFor?: (record: NationRecord, category: string) => string[] | undefined;
}

const shadedViewRules: Record<ShadedMapView, ShadedViewRule> = {
	recognition: {
		has: (record) => {
			const types = new Set((record.recognition ?? []).map((fact) => fact.type));
			return { federal: types.has('federal'), state: types.has('state'), petitioning: types.has('petitioning'), other: types.has('territorial-law') || types.has('congressional-special-relationship') };
		},
		facts: (record) => (record.recognition ?? []).filter((fact) => fact.type !== 'unrecognized'),
		// State recognition applies in the state that gives it.
		statesFor: (record, category) => (category === 'state' ? (record.recognition ?? []).flatMap((fact) => (fact.type === 'state' && fact.state ? [fact.state] : [])) : undefined)
	},
	'courts-and-peacemaking': {
		has: (record) => {
			const courts = courtsOf(record);
			return { peacemaking: courts.peacemaking, wellness: courts.wellness, court: courts.tribal, federal: courts.federal };
		}
	},
	'public-law-280': {
		categoryOf: publicLaw280Category,
		facts: (record) => factsOn(record, publicLaw280Topic)
	},
	'violence-against-women-act': {
		categoryOf: violenceAgainstWomenActCategory,
		facts: (record) => factsOn(record, violenceAgainstWomenActTopic)
	},
	'other-jurisdiction-laws': {
		has: (record) => ({
			'state-statute': factsOn(record, 'state-jurisdiction-statute').some((fact) => (fact.value ?? '').startsWith('state-')),
			'child-welfare-reassumed': factsOn(record, 'indian-child-welfare-act').some((fact) => fact.value === 'reassumed-jurisdiction'),
			'enhanced-sentencing': factsOn(record, 'tribal-law-and-order-act-enhanced-sentencing').some((fact) => fact.value === 'implementing')
		}),
		facts: (record) =>
			(record.jurisdiction ?? []).filter(
				(fact) => ['state-jurisdiction-statute', 'tribal-law-and-order-act-enhanced-sentencing'].includes(fact.topic) || (fact.topic === 'indian-child-welfare-act' && fact.value === 'reassumed-jurisdiction')
			)
	},
	'agreements-with-states': {
		has: (record) => {
			const kinds = new Set((record.jurisdiction_agreements ?? []).map((agreement) => agreement.kind));
			return Object.fromEntries((shadedViewDefinitions['agreements-with-states'].categories ?? []).map((category) => [category.key, kinds.has(category.key)]));
		},
		facts: (record) => record.jurisdiction_agreements ?? [],
		// An agreement that names its state counts only there.
		statesFor: (record, category) => {
			const named = (record.jurisdiction_agreements ?? []).filter((agreement) => (category === 'other' ? !['cross-deputization', 'child-welfare-agreement', 'tax-agreement'].includes(agreement.kind) : agreement.kind === category));
			const states = named.flatMap((agreement) => (agreement.state ? [agreement.state] : []));
			return states.length === named.length && states.length > 0 ? [...new Set(states)] : undefined;
		}
	},
	gaming: {
		has: (record) => {
			const gaming = record.gaming ?? {};
			const histories = gamingHistoryKinds().get(record.id) ?? new Set<string>();
			const compact = (gaming.compacts ?? []).some((fact) => compactCounts.has(fact.status)) || histories.has('gaming-compact');
			const procedures = (gaming.compacts ?? []).some((fact) => fact.status === 'secretarial-procedures') || histories.has('secretarial-procedures');
			const ordinance = (gaming.ordinances ?? []).length > 0;
			return { compact, procedures, ordinance, operates: gaming.operates_gaming?.value === true };
		},
		facts: (record) => [...(record.gaming?.compacts ?? []), ...(record.gaming?.ordinances ?? []), ...(record.gaming?.operates_gaming ? [record.gaming.operates_gaming] : [])],
		// A compact, or Secretarial Procedures, is with one state.
		statesFor: (record, category) => {
			const compacts = (record.gaming?.compacts ?? []).filter((fact) => (category === 'compact' ? compactCounts.has(fact.status) : category === 'procedures' ? fact.status === 'secretarial-procedures' : false));
			return compacts.length > 0 ? [...new Set(compacts.map((fact) => fact.state))] : undefined;
		}
	},
	treaties: {
		categoryOf: (record) => {
			const count = new Set((record.treaties ?? []).map((treaty) => `${treaty.title}|${treaty.signed}`)).size;
			if (count === 0) return undefined;
			return count >= 10 ? 'ten-or-more' : count >= 5 ? 'five-to-nine' : count >= 2 ? 'two-to-four' : 'one';
		},
		facts: (record) => record.treaties ?? []
	},
	'land-set-aside': {
		has: (record) => {
			const methods = new Set((record.land_establishment ?? []).map((fact) => fact.method));
			return { treaty: methods.has('treaty'), 'executive-order': methods.has('executive-order'), statute: methods.has('statute'), other: [...methods].some((method) => !['treaty', 'executive-order', 'statute'].includes(method)) };
		},
		facts: (record) => record.land_establishment ?? []
	},
	'governing-documents': {
		has: (record) => {
			const kinds = new Set((record.governing_documents ?? []).map((fact) => fact.kind));
			const constitution = kinds.has('constitution') || kinds.has('articles-of-association') || (constitutionHistories().has(record.id));
			const laws = ['law-code', 'court-rules'].some((kind) => kinds.has(kind)) || (record.dispute_resolution_law ?? []).length > 0;
			return { constitution, laws, charter: kinds.has('corporate-charter') };
		},
		facts: (record) => record.governing_documents ?? []
	},
	'census-residents': {
		areaCategoryOf: (code) => {
			const count = censusResidents().get(code)?.count;
			if (count === undefined) return undefined;
			return count >= 10000 ? 'ten-thousand-or-more' : count >= 1000 ? 'thousand-to-ten-thousand' : count >= 100 ? 'hundred-to-thousand' : 'under-hundred';
		},
		areaValue: (code) => censusResidents().get(code)?.count,
		facts: (record) => (record.population ?? []).filter((fact) => fact.kind === 'resident-population' && censusAreaOf(fact) !== undefined)
	},
	'heritage-languages': {
		has: (record) => Object.fromEntries((record.languages ?? []).flatMap((fact) => (fact.name ? [[languageName(fact.name), true]] : []))),
		// One category per language, all in one shade; the names on the map tell them apart.
		categoriesFrom: () => [...new Set(languageNames().values())].sort((first, second) => first.localeCompare(second, 'en')).map((name) => ({ key: name, label: name, shade: 3 })),
		facts: (record) => record.languages ?? []
	},
	'indian-health-service': {
		categoryOf: healthServiceArea,
		// One category per Area named in the entries, each with the shade that sets it apart from its neighbors.
		categoriesFrom: (records) =>
			[...new Set(records.map(healthServiceArea).filter((name): name is string => Boolean(name)))]
				.sort((first, second) => first.localeCompare(second, 'en'))
				.map((name) => ({ key: name, label: `${name} Area`, shade: healthServiceAreaShades[name] ?? 2 })),
		facts: (record) => record.indian_health_service ?? []
	}
};

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

	const definition = shadedViewDefinitions[view];
	const rule = shadedViewRules[view];
	const categories = definition.categories ?? rule.categoriesFrom?.(records) ?? [];
	// A view of kinds shades a nation by the first kind it has, in the categories' order.
	const categoryOf = (record: NationRecord): string | undefined => {
		if (rule.categoryOf) return rule.categoryOf(record);
		const has = rule.has?.(record) ?? {};
		return categories.find((category) => has[category.key])?.key;
	};
	/** The row a nation's area goes to: the nation's own, or its category's when the table lists categories. */
	const rowOf = (record: NationRecord, category: string) => shadedRowAnchor(view, definition.rows === 'categories' ? category : record.id);
	const areaCategoryOf = rule.areaCategoryOf;
	const order = categories.map((category) => category.key);
	const rank = (category: string) => order.indexOf(category);

	// An area named by several nations takes the category that comes first in the legend's order of precedence.
	const areas: ShadedArea[] = (landAreaPoints.areas as LandAreaPoint[])
		.filter((area) => !withdrawnLandAreas.has(area.code))
		.map((area) => {
			// A fact about the area itself: its own category, and its own row in a table of areas.
			if (areaCategoryOf) {
				const key = areaCategoryOf(area.code);
				const category = key === undefined ? undefined : categories[rank(key)];
				return category ? { code: area.code, shade: category.shade, anchor: shadedRowAnchor(view, area.code), category: category.key } : { code: area.code, shade: 0 };
			}
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

	// By state: how many of each state's nations have each category. A nation in several states counts in each, except where its facts name the state a category applies in.
	const statePresence = (record: NationRecord) => [...new Set((record.states ?? []).map((fact) => fact.state))];
	const kindsOf = (record: NationRecord): string[] => {
		if (rule.has) {
			const has = rule.has(record);
			return categories.filter((category) => has[category.key]).map((category) => category.key);
		}
		const key = categoryOf(record);
		return key === undefined ? [] : [key];
	};
	// The key a nation with no kind recorded in a state counts under, as the legend's last entry is keyed.
	const unrecordedKey = 'unrecorded';
	// For each state, the kinds each of its nations has there. A fact that names its own state counts only in that state.
	const kindsByState = new Map<string, Map<string, Set<string>>>();
	const placeIn = (state: string, record: NationRecord) => {
		const nations = kindsByState.get(state) ?? new Map<string, Set<string>>();
		kindsByState.set(state, nations);
		const kinds = nations.get(record.id) ?? new Set<string>();
		nations.set(record.id, kinds);
		return kinds;
	};
	if (!areaCategoryOf && definition.byState !== false) {
		for (const record of records) {
			for (const state of statePresence(record)) placeIn(state, record);
			for (const key of kindsOf(record)) {
				for (const state of new Set(rule.statesFor?.(record, key) ?? statePresence(record))) placeIn(state, record).add(key);
			}
		}
	}
	// The table counts every kind a nation has in the state. The map counts each nation once, under the first of its kinds in the legend's order (as the by-nation map shades it), or as unrecorded when it has none there; the state takes whichever most of its nations fall under, and a tie goes to the one listed first in the key.
	const states: ShadedState[] = geometry.states.map((shape) => {
		const nations = kindsByState.get(shape.code) ?? new Map<string, Set<string>>();
		const counts = new Map<string, number>();
		const shading = new Map<string, number>();
		// The nations each count is made of, so a count in the table opens to them.
		const members = new Map<string, string[]>();
		for (const [nation, kinds] of nations) {
			for (const key of kinds) counts.set(key, (counts.get(key) ?? 0) + 1);
			for (const key of kinds.size > 0 ? kinds : [unrecordedKey]) members.set(key, [...(members.get(key) ?? []), nation]);
			const first = [...kinds].sort((one, other) => rank(one) - rank(other))[0] ?? unrecordedKey;
			shading.set(first, (shading.get(first) ?? 0) + 1);
		}
		const total = nations.size;
		const unrecordedCount = shading.get(unrecordedKey) ?? 0;
		if (unrecordedCount > 0) counts.set(unrecordedKey, unrecordedCount);
		const keyOrder = [...order, unrecordedKey];
		const top = keyOrder.filter((key) => (shading.get(key) ?? 0) > 0).sort((one, other) => (shading.get(other) ?? 0) - (shading.get(one) ?? 0) || keyOrder.indexOf(one) - keyOrder.indexOf(other))[0];
		const category = top === unrecordedKey ? undefined : top;
		return {
			code: shape.code,
			total,
			counts: Object.fromEntries(counts),
			members: Object.fromEntries(members),
			category,
			shaded: top ? (shading.get(top) ?? 0) : 0,
			shade: category ? (categories[rank(category)]?.shade ?? 0) : 0,
			anchor: total > 0 ? shadedRowAnchor(view, `state-${shape.code}`) : undefined
		};
	});

	return { definition, rule, categories, categoryOf, areas, offices, records, byArea, states };
}

/** A state or territory on a view's by-state map: how many of its nations have each category, and the one most of them have. */
interface ShadedState {
	code: string;
	total: number;
	/** How many of the state's nations have each kind, and under "unrecorded" how many have none there. */
	counts: Record<string, number>;
	/** The ids of the nations each count is made of. */
	members: Record<string, string[]>;
	/** The category most of its nations fall under, left out when most have none recorded. */
	category?: string;
	/** How many nations fall under the state's category, or under unrecorded when it has none. */
	shaded: number;
	shade: number;
	anchor?: string;
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

/** Where to write each category's name, for a view that writes them (the Indian Health Service view names its Areas): the middle (median) of its land areas' label points, in degrees. */
function categoryLabelPoints(areas: ShadedArea[]): { name: string; point: [number, number] }[] {
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

/** What the tiled map needs for each shaded view: each area's shade and row, and, for a view that writes its categories' names, where to write them. */
function tileMapShading() {
	return Object.fromEntries(
		shadedMapViews.map((view) => {
			const built = buildShadedView(view);
			const areas = Object.fromEntries(built.areas.filter((area) => area.anchor).map((area) => [area.code, { shade: area.shade, anchor: area.anchor as string }]));
			const offices = Object.fromEntries(built.offices.filter((office) => office.anchor).map((office) => [office.nation, { shade: office.shade, anchor: office.anchor as string }]));
			const states = Object.fromEntries(built.states.filter((state) => state.anchor).map((state) => [state.code, { shade: state.shade, anchor: state.anchor as string }]));
			return [view, { areas, offices, states, labels: built.definition.labels ? categoryLabelPoints(built.areas) : [] }];
		})
	) as Record<
		ShadedMapView,
		{
			areas: Record<string, { shade: number; anchor: string }>;
			offices: Record<string, { shade: number; anchor: string }>;
			states: Record<string, { shade: number; anchor: string }>;
			labels: { name: string; point: [number, number] }[];
		}
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
	const unrecorded = built.definition.unrecorded;
	const drawn = built.areas.map((area) => ({
		identifier: area.code,
		shade: area.shade,
		anchor: area.anchor,
		description: `${names.get(area.code) ?? area.code}: ${area.category ? (labelOf.get(area.category) ?? area.category) : unrecorded}`
	}));
	// A view with many categories in one shade, such as languages, has one legend entry for them all.
	const legendLabel = built.definition.legendLabel;
	const legend = [
		...(legendLabel ? [{ key: 'recorded', label: legendLabel, shade: built.categories[0]?.shade ?? 2 }] : built.categories.map(({ key, label, shade }) => ({ key, label, shade }))),
		{ key: 'unrecorded', label: unrecorded, shade: 0 }
	];
	const offices = built.offices.map((office) => ({
		nation: office.nation,
		shade: office.shade,
		anchor: office.anchor,
		description: `${office.name} (office; no Census land area): ${office.category ? (labelOf.get(office.category) ?? office.category) : unrecorded}`
	}));

	const labels = built.definition.labels && built.definition.drawnLabels !== false ? built.categories.map((category) => ({ name: category.key, identifiers: built.areas.filter((area) => area.category === category.key).map((area) => area.code) })) : [];
	const section = built.definition.section;

	// The by-state map and table, for views about nations (not about land areas).
	const byState = !built.rule.areaCategoryOf && built.definition.byState !== false;
	const stateColumns = byState ? [...built.categories.map((category) => ({ key: category.key, header: category.label })), { key: 'unrecorded', header: unrecorded }] : [];
	const stateRows = (byState ? built.states : [])
		.filter((state) => state.anchor)
		.map((state) => ({ anchor: state.anchor as string, code: state.code, name: stateName(state.code), total: state.total, counts: state.counts, members: state.members }))
		.sort((first, second) => first.name.localeCompare(second.name, 'en'));
	// The names of the nations the by-state counts are made of, once each, so a count opens to its nations' names and pages.
	const recordsById = new Map(built.records.map((record) => [record.id, record]));
	const stateNations = Object.fromEntries(
		[...new Set(stateRows.flatMap((row) => Object.values(row.members).flat()))].flatMap((id) => {
			const record = recordsById.get(id);
			return record ? [[id, displayName(record.names.official)]] : [];
		})
	);
	const drawnStates = byState
		? built.states.map((state) => {
				const name = stateName(state.code);
				const top = state.category ? labelOf.get(state.category) : undefined;
				const nations = (count: number) => `${count} of ${state.total} ${state.total === 1 ? 'nation' : 'nations'}`;
				const description = state.total === 0 ? `${name}: no nations recorded` : `${name}: most often ${top ?? unrecorded.toLocaleLowerCase('en-US')} (${nations(state.shaded)})`;
				return { code: state.code, shade: state.shade, anchor: state.anchor, description };
			})
		: [];
	const byStateData = { stateColumns, stateRows, stateNations, drawnStates };

	const sortedStates = (members: NationRecord[]) => [...new Set(members.flatMap(statesOf))].sort((first, second) => first.localeCompare(second, 'en'));

	// A table of land areas: each with its value, opening to the nations whose entries name it.
	if (built.definition.rows === 'areas') {
		const areaRows = built.areas
			.filter((area) => area.category)
			.map((area) => {
				const members = built.byArea.get(area.code) ?? [];
				return { anchor: shadedRowAnchor(view, area.code), name: names.get(area.code) ?? area.code, value: built.rule.areaValue?.(area.code), nations: members.map(listed).sort(byName), states: sortedStates(members) };
			});
		return { view, legend, drawn, offices, labels, nationRows: [], areaRows, kindColumns: [], section, ...byStateData };
	}

	// A table of categories: each opens to the nations in it, or with kinds, the nations that have it.
	if (built.definition.rows === 'categories') {
		const has = built.rule.has;
		const areaRows = built.categories.map((category) => {
			const members = built.records.filter((record) => (has ? has(record)[category.key] : built.categoryOf(record) === category.key));
			return { anchor: shadedRowAnchor(view, category.key), name: category.label, value: undefined as number | undefined, nations: members.map(listed).sort(byName), states: sortedStates(members) };
		});
		return { view, legend, drawn, offices, labels, nationRows: [], areaRows, kindColumns: [], section, ...byStateData };
	}

	const has = built.rule.has;
	const nationRows = built.records
		.map((record) => ({ record, category: built.categoryOf(record) }))
		.filter((entry): entry is { record: NationRecord; category: string } => entry.category !== undefined)
		.map(({ record, category }) => ({
			anchor: shadedRowAnchor(view, record.id),
			id: record.id,
			name: displayName(record.names.official),
			states: statesOf(record),
			category: labelOf.get(category) ?? category,
			kinds: has ? has(record) : {}
		}))
		.sort((first, second) => first.name.localeCompare(second.name, 'en', { sensitivity: 'base' }));
	// A table of kinds has one Yes column per kind, in the map's order.
	const kindHeaders = built.definition.kindHeaders;
	const kindColumns = has && kindHeaders ? built.categories.map((category) => ({ key: category.key, header: kindHeaders[category.key] ?? category.label })) : [];
	return { view, legend, drawn, offices, labels, nationRows, areaRows: [], kindColumns, section, ...byStateData };
}

export type ShadedViewData = ReturnType<typeof shadedView>;

/** The sources of the shaded views, listed with the page's other sources, each as its view's definition words it. */
function addShadedViewSources(records: NationRecord[], sources: SourceUses): void {
	for (const record of records) {
		for (const view of shadedMapViews) {
			const facts = shadedViewRules[view].facts;
			const use = shadedViewDefinitions[view].sources;
			if (!facts || !use) continue;
			for (const fact of facts(record)) {
				if (fact.source) sources.add(fact.source, use);
			}
		}
	}
}
