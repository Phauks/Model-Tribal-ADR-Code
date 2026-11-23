import geometry from 'virtual:map-geometry';
import { error, json } from '@sveltejs/kit';
import { drawLandAreasMap, drawShadedLandAreasMap, drawShadedStatesMap } from '#lib/nations-map-drawing.ts';
import { mapViews } from '#lib/map-views.ts';
import { landAreaOffices, landAreasView, shadedView } from '#lib/server/nations-map.ts';
import { isShadedMapView, shadedMapViews } from '#lib/shaded-map-views.ts';
import type { EntryGenerator, RequestHandler } from './$types';

export const prerender = true;

export const entries: EntryGenerator = () => ['lands', ...shadedMapViews].map((view) => ({ view }));

/**
 * The drawn copy of a fetched view of the map on /nations/map: the "Land areas" view and each shaded view (src/lib/shaded-map-views.ts), with the by-state copy where the view has one.
 *
 * It is apart from the view's table (./land-areas.json and ./views/<view>.json), because the tiled map is what a reader sees: the drawn copy is fetched only for printing, or when the tiled map cannot start, so choosing a view waits for its table alone.
 */
export const GET: RequestHandler = ({ params }) => {
	if (params.view === 'lands') {
		return json({ drawing: drawLandAreasMap(geometry, landAreasView().counts, landAreaOffices()) });
	}
	if (!isShadedMapView(params.view)) error(404, 'No such map view');
	const { drawn, labels, offices, drawnStates } = shadedView(params.view);
	const title = mapViews.find((entry) => entry.key === params.view)?.description ?? params.view;
	const drawnOffices = offices.map((office) => ({ ...office, href: office.anchor ? `#${office.anchor}` : undefined }));
	const stateDrawing = drawnStates.length > 0 ? drawShadedStatesMap(geometry, { key: params.view, title, states: drawnStates }) : undefined;
	return json({ drawing: drawShadedLandAreasMap(geometry, { key: params.view, title, areas: drawn, offices: drawnOffices, labels }), stateDrawing });
};
