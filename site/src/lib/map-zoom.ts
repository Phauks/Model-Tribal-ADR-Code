/**
 * The arithmetic of zooming and moving a map that is drawn as one SVG
 * (src/lib/components/ZoomableMap.svelte). The drawing itself is made when the
 * site is built; zooming only changes which part of it the SVG's viewBox
 * shows, so nothing is fetched and it works offline.
 *
 * A view is the rectangle of map units on screen. Every function here returns
 * a new view and keeps it inside the full drawing, so a reader can never move
 * the map off the screen.
 */

export interface MapView {
	x: number;
	y: number;
	width: number;
	height: number;
}

/** A point in map units. */
export interface MapPoint {
	x: number;
	y: number;
}

/** How much larger than the full map a view is drawn. 1 is the full map. */
export const zoomOf = (full: MapView, view: MapView): number => full.width / view.width;

const clamp = (value: number, low: number, high: number): number => Math.min(Math.max(value, low), high);

/** Keeps a view inside the full drawing, moving it back in where it sticks out. */
export function keepInside(full: MapView, view: MapView): MapView {
	return {
		width: view.width,
		height: view.height,
		x: clamp(view.x, full.x, full.x + full.width - view.width),
		y: clamp(view.y, full.y, full.y + full.height - view.height)
	};
}

/**
 * Zooms to `zoom` times the full map, keeping `point` where it is on screen,
 * as a map does when a reader zooms with the pointer over a place. Without a
 * point, it zooms around the middle of the view, as the buttons do.
 */
export function zoomTo(full: MapView, view: MapView, zoom: number, maximum: number, point?: MapPoint): MapView {
	const next = clamp(zoom, 1, maximum);
	const width = full.width / next;
	const height = full.height / next;
	const anchor = point ?? { x: view.x + view.width / 2, y: view.y + view.height / 2 };
	const shrink = width / view.width;
	return keepInside(full, {
		width,
		height,
		x: anchor.x - (anchor.x - view.x) * shrink,
		y: anchor.y - (anchor.y - view.y) * shrink
	});
}

/** Zooms by a factor, such as 1.5 for the zoom-in button or 1 / 1.5 to zoom out. */
export const zoomBy = (full: MapView, view: MapView, factor: number, maximum: number, point?: MapPoint): MapView =>
	zoomTo(full, view, zoomOf(full, view) * factor, maximum, point);

/** Moves the view by a distance in map units. */
export const moveBy = (full: MapView, view: MapView, dx: number, dy: number): MapView =>
	keepInside(full, { ...view, x: view.x + dx, y: view.y + dy });

/** Moves the view so that `point` is in its middle, as when a keyboard user tabs to a place off screen. */
export const centerOn = (full: MapView, view: MapView, point: MapPoint): MapView =>
	keepInside(full, { ...view, x: point.x - view.width / 2, y: point.y - view.height / 2 });

/** Reads an SVG viewBox attribute, such as "0 0 975 812". */
export function parseViewBox(text: string | null): MapView | undefined {
	const numbers = (text ?? '').trim().split(/[\s,]+/).map(Number);
	if (numbers.length !== 4 || numbers.some((number) => !Number.isFinite(number))) return undefined;
	const [x, y, width, height] = numbers;
	return width > 0 && height > 0 ? { x, y, width, height } : undefined;
}

/** Writes a view as an SVG viewBox attribute, rounded so the markup stays short. */
export const formatViewBox = (view: MapView): string =>
	[view.x, view.y, view.width, view.height].map((number) => Math.round(number * 100) / 100).join(' ');

/**
 * Turns a point on screen into map units, given where the SVG sits on screen.
 * The map's SVGs keep the shape of their viewBox (their height follows their
 * width), so one scale serves both directions.
 */
export function screenToMap(
	view: MapView,
	box: { left: number; top: number; width: number; height: number },
	clientX: number,
	clientY: number
): MapPoint {
	return {
		x: view.x + ((clientX - box.left) / box.width) * view.width,
		y: view.y + ((clientY - box.top) / box.height) * view.height
	};
}
