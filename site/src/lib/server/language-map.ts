/**
 * The map on a language page: the nation page's map (src/routes/nations/[id]),
 * drawn for every nation whose record names the language. The States view
 * shades the states where any of them has a presence; the Land Areas view
 * outlines all their land areas (mockup v2, approved Nov. 27, 2026).
 *
 * Trevor called this map "meh" when approving the mockup and set it aside for
 * a general revision of maps on pages, so it stays as mocked until then.
 */
import geometry from 'virtual:map-geometry';
import { layoutPresenceMap, pointInBox, shapeInBox, shareStateShapes, type BoxLayers, type NationMapData, type PresenceMapLayout } from '../presence-map.ts';
import { landAreaKindLabels } from '../nations-map-drawing.ts';
import { stateName } from '../nation-labels.ts';
import { nationTileMapData } from './nations-map.ts';
import type { NationRecord } from './content.ts';
import type { SourceUses } from './source-uses.ts';

const zoomedPaths = new Map(geometry.zoomedStates.map((state) => [state.code, state.path]));

/** Land areas are small, so their view may zoom closer than the states view (as on nation pages). */
const landAreaClosestZoom = 0.1;

export function languageMap(records: NationRecord[], sources: SourceUses): NationMapData | undefined {
	const present = new Set(records.flatMap((record) => (record.states ?? []).map((fact) => fact.state)));
	if (present.size === 0) return undefined;
	const states = geometry.smallStates;
	const views: { key: 'states' | 'region' | 'lands'; label: string; layout: PresenceMapLayout; layers: Record<string, BoxLayers> }[] = [];
	const emptyLayers = (layout: PresenceMapLayout) => Object.fromEntries(layout.boxes.map((box) => [box.key, { shapes: [], dots: [], labels: [] } as BoxLayers]));

	sources.add('census-cartographic-boundary-states-2017', { section: 'Map', text: 'state and territory outlines, through us-atlas 3.0.1' });
	const statesLayout = layoutPresenceMap(geometry.frames, states, present, zoomedPaths);
	views.push({ key: 'states', label: 'States', layout: statesLayout, layers: emptyLayers(statesLayout) });

	const areaFacts = records.flatMap((record) => (record.census_areas ?? []).filter((fact) => !fact.vintage || fact.vintage === '2020'));
	const ids = new Set(areaFacts.map((fact) => fact.geographic_identifier));
	const areas = geometry.landAreas.filter((shape) => ids.has(shape.identifier));
	if (areas.length > 0) {
		for (const fact of areaFacts) {
			if (fact.source) sources.add(fact.source, { section: 'Map', text: `land area: ${fact.name}` });
		}
		sources.add(geometry.landAreaSource.source, { section: 'Map', text: 'land area outlines, simplified for a national map', where: `retrieved ${geometry.landAreaSource.retrieved}` });
		sources.add('protomaps-basemap-openstreetmap', { section: 'Map', text: 'the map of places, roads and water under the land areas, where the browser can draw it' });
		const layout = layoutPresenceMap(geometry.frames, states, new Set(), zoomedPaths, { focus: areas.map((area) => area.path), closestZoom: landAreaClosestZoom });
		const layers = emptyLayers(layout);
		for (const box of layout.boxes) {
			for (const area of areas) {
				if (!shapeInBox(box, area.path)) continue;
				layers[box.key].shapes.push({ path: area.path, kind: 'land-area' });
				if (area.dot) layers[box.key].dots.push(pointInBox(box, area.dot));
			}
		}
		views.push({ key: 'lands', label: 'Land Areas', layout, layers });
	}

	const shared = shareStateShapes(views.map((view) => view.layout));
	return {
		shapes: shared.shapes,
		views: views.map((view, index) => ({ key: view.key, label: view.label, layout: shared.layouts[index], layers: view.layers })),
		stateNames: [...present].map(stateName).sort((first, second) => first.localeCompare(second, 'en')),
		region: undefined,
		landAreas: areas.map((area) => ({ code: area.identifier, name: area.name, kind: landAreaKindLabels[area.kind] })),
		tileMap: areas.length > 0 ? nationTileMapData(areas.map((area) => area.identifier)) : undefined
	};
}
