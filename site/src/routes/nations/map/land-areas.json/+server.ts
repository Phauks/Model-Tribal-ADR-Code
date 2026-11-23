import geometry from 'virtual:map-geometry';
import { json } from '@sveltejs/kit';
import { drawLandAreasMap } from '#lib/nations-map-drawing.ts';
import { landAreasView, landAreaOffices } from '#lib/server/nations-map.ts';
import type { RequestHandler } from './$types';

export const prerender = true;

// The "Land areas" view of the map on /nations/map: its drawing and its table
// rows, fetched only when a reader opens the view, because the Census
// Bureau's outlines would otherwise more than double the page's size.
export const GET: RequestHandler = () => {
	const view = landAreasView();
	return json({ drawing: drawLandAreasMap(geometry, view.counts, landAreaOffices()), rows: view.rows });
};
