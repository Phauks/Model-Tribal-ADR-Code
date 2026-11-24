import { error, json } from '@sveltejs/kit';
import { shadedView } from '#lib/server/nations-map.ts';
import { isShadedMapView, shadedMapViews } from '#lib/shaded-map-views.ts';
import type { EntryGenerator, RequestHandler } from './$types';

export const prerender = true;

export const entries: EntryGenerator = () => shadedMapViews.map((view) => ({ view }));

// A view of the map on /nations/map that shades the land areas by a fact about their nations, such as Public Law 280 (src/lib/shaded-map-views.ts): its legend and table rows, fetched when a reader chooses the view. Its drawn copy is apart, in ../view-drawings/<view>.json, since the tiled map is what a reader sees.
export const GET: RequestHandler = ({ params }) => {
	if (!isShadedMapView(params.view)) error(404, 'No such map view');
	const { drawn, labels, offices, drawnStates, ...rest } = shadedView(params.view);
	return json(rest);
};
