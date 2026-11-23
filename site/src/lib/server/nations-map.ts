import geometry from 'virtual:map-geometry';
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
