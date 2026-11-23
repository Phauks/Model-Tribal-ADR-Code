import geometry from 'virtual:map-geometry';
import { error, json } from '@sveltejs/kit';
import { drawShadedLandAreasMap } from '#lib/nations-map-drawing.ts';
import { mapViews } from '#lib/map-views.ts';
import { shadedView } from '#lib/server/nations-map.ts';
import { isShadedMapView, shadedMapViews } from '#lib/shaded-map-views.ts';
import type { EntryGenerator, RequestHandler } from './$types';

export const prerender = true;

export const entries: EntryGenerator = () => shadedMapViews.map((view) => ({ view }));

// A view of the map on /nations/map that shades the land areas by a fact about their nations, such as Public Law 280 (src/lib/shaded-map-views.ts): its legend, table rows and drawing, fetched when a reader opens the view, as the "Land areas" view's are.
export const GET: RequestHandler = ({ params }) => {
	if (!isShadedMapView(params.view)) error(404, 'No such map view');
	const data = shadedView(params.view);
	const title = mapViews.find((entry) => entry.key === params.view)?.description ?? params.view;
	const { drawn, labels, offices, ...rest } = data;
	const drawnOffices = offices.map((office) => ({ ...office, href: office.anchor ? `#${office.anchor}` : undefined }));
	return json({ ...rest, drawing: drawShadedLandAreasMap(geometry, { key: params.view, title, areas: drawn, offices: drawnOffices, labels }) });
};
