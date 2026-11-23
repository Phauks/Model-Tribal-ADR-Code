/**
 * Lays out the small map on a nation's page so that it shows only what is
 * relevant to that nation (Trevor, Nov. 22, 2026): the boxes that hold a state
 * or territory where sources record the nation's presence, and no others. The
 * box for the contiguous United States is zoomed to the region around the
 * nation's states, never closer than `closestZoom`, so the reader still sees
 * where in the country they are. Alaska, Hawaiʻi and the territories keep
 * their own boxes and scales; shown without the main box, they are drawn
 * larger, up to `largestInsetScale`.
 *
 * The shapes come already projected from src/lib/map-geometry.ts; this only
 * moves and scales whole boxes, so it runs when each page is built.
 */
import type { StateShape } from './map-geometry.ts';
import type { TileMapData } from '#lib/server/nations-map.ts';

/** A framed box of the full map, in its map units. */
export interface SourceFrame {
	key: string;
	x: number;
	y: number;
	width: number;
	height: number;
}

/** A box as the nation page draws it. */
export interface PresenceBox {
	key: string;
	/** The box's place on the small map. */
	x: number;
	y: number;
	width: number;
	height: number;
	/** SVG transform from the full map's units to the small map's. */
	transform: string;
	/** The part of the full map the box shows, in the full map's units. */
	view: { x: number; y: number; width: number; height: number };
	states: { code: string; path: string; present: boolean }[];
}

/** A state code printed on the map, with a line to the place for small places. */
export interface PresenceLabel {
	code: string;
	x: number;
	y: number;
	align: 'middle' | 'start' | 'end';
	marker?: { fromX: number; fromY: number; x: number; y: number };
}

export interface PresenceMapLayout {
	width: number;
	height: number;
	boxes: PresenceBox[];
	labels: PresenceLabel[];
	/** True when the box for the contiguous United States shows only part of it. */
	zoomed: boolean;
	/** The map's width as a share of the full map's, so boxes keep their size on the page. */
	shareOfFullWidth: number;
}

/**
 * The main box never shows less than this share of the contiguous United
 * States' width, so a nation in one small state still sees its neighbors
 * (project choice, checked by eye).
 */
const defaultClosestZoom = 0.4;

/** What a view of the small map is zoomed to, when it is not the shaded states. */
export interface LayoutOptions {
	/**
	 * Path data of the shapes the view is about, such as a region or the
	 * nation's land areas, in the full map's units. The view shows the boxes
	 * that hold them and zooms the main box to them.
	 */
	focus?: string[];
	/** The smallest share of the main box's width the view may show. */
	closestZoom?: number;
}

/** Room kept around the nation's states inside a zoomed box, as a share of their size. */
const padding = 0.2;

/** How much larger Alaska, Hawaiʻi or a territory may be drawn when it is the whole map. */
const largestInsetScale = 3;

/** Without the main box, the boxes together take about this share of the full map's width. */
const insetsOnlyShare = 0.6;

/** A place at least this many map units across on the small map is labeled on itself, not by a marker. */
const smallestLabeledPlace = 50;

/** Space around and between the boxes, in map units, as on the full map. */
const gap = 12;

interface Rectangle {
	x: number;
	y: number;
	width: number;
	height: number;
}

/** The bounding box of path data made of absolute "x,y" points, as d3-geo writes it. */
export function pathBounds(path: string): Rectangle | undefined {
	let left = Infinity;
	let top = Infinity;
	let right = -Infinity;
	let bottom = -Infinity;
	for (const [, x, y] of path.matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)) {
		const pointX = Number(x);
		const pointY = Number(y);
		left = Math.min(left, pointX);
		right = Math.max(right, pointX);
		top = Math.min(top, pointY);
		bottom = Math.max(bottom, pointY);
	}
	return left === Infinity ? undefined : { x: left, y: top, width: right - left, height: bottom - top };
}

const union = (rectangles: Rectangle[]): Rectangle => {
	const left = Math.min(...rectangles.map((rectangle) => rectangle.x));
	const top = Math.min(...rectangles.map((rectangle) => rectangle.y));
	const right = Math.max(...rectangles.map((rectangle) => rectangle.x + rectangle.width));
	const bottom = Math.max(...rectangles.map((rectangle) => rectangle.y + rectangle.height));
	return { x: left, y: top, width: right - left, height: bottom - top };
};

const contains = (frame: Rectangle, point: { x: number; y: number }) =>
	point.x >= frame.x && point.x <= frame.x + frame.width && point.y >= frame.y && point.y <= frame.y + frame.height;

/**
 * The part of the main box to show: the nation's states with some room
 * around them, widened to the box's own proportions and to at least
 * `closestZoom` of its width, and kept inside the box.
 */
function zoomedView(frame: Rectangle, nationStates: Rectangle, closestZoom: number): Rectangle {
	const aspect = frame.width / frame.height;
	const room = padding * Math.max(nationStates.width, nationStates.height);
	let width = Math.max(nationStates.width + 2 * room, closestZoom * frame.width);
	let height = nationStates.height + 2 * room;
	if (width / height < aspect) width = height * aspect;
	else height = width / aspect;
	if (width >= frame.width || height >= frame.height) return { ...frame };
	const centerX = nationStates.x + nationStates.width / 2;
	const centerY = nationStates.y + nationStates.height / 2;
	const x = Math.min(Math.max(centerX - width / 2, frame.x), frame.x + frame.width - width);
	const y = Math.min(Math.max(centerY - height / 2, frame.y), frame.y + frame.height - height);
	return { x, y, width, height };
}

const tidy = (value: number) => Math.round(value * 100) / 100;

/**
 * The small map for one nation: only the boxes holding its states, the main
 * box zoomed to them, and a code on each of its states.
 *
 * @param frames The full map's boxes, the contiguous United States first.
 * @param states Every state and territory, as the small map draws them.
 * @param present Postal codes of the states where sources record a presence.
 * @param zoomedPaths More detailed outlines, by postal code, for boxes drawn larger than on the full map.
 */
export function layoutPresenceMap(
	frames: SourceFrame[],
	states: StateShape[],
	present: Set<string>,
	zoomedPaths: Map<string, string> = new Map(),
	options: LayoutOptions = {}
): PresenceMapLayout {
	const closestZoom = options.closestZoom ?? defaultClosestZoom;
	const placed = states.map((shape) => {
		const bounds = pathBounds(shape.path);
		const center = shape.center ?? (bounds ? { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 } : { x: 0, y: 0 });
		const frame = frames.find((candidate) => contains(candidate, center));
		return { shape, bounds, frame };
	});
	// What the view is about: the shaded states, or the shapes given as its focus.
	const focus = (options.focus ?? []).flatMap((path) => {
		const bounds = pathBounds(path);
		if (!bounds) return [];
		const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
		return [{ bounds, frame: frames.find((candidate) => contains(candidate, center)) }];
	});
	const subjects: { bounds: Rectangle; frame: SourceFrame | undefined }[] = options.focus
		? focus
		: placed
				.filter((entry) => present.has(entry.shape.code) && entry.bounds)
				.map((entry) => ({ bounds: entry.bounds as Rectangle, frame: entry.frame }));
	const relevant = frames.filter((frame) => subjects.some((entry) => entry.frame === frame));
	const [mainFrame, ...insetFrames] = frames;
	const showsMain = relevant.includes(mainFrame);
	const insets = insetFrames.filter((frame) => relevant.includes(frame));

	const views: { frame: SourceFrame; view: Rectangle; scale: number; x: number; y: number }[] = [];
	let zoomed = false;
	let width: number;
	let top = gap;
	if (showsMain) {
		const nationStates = union(
			subjects.filter((entry) => entry.frame === mainFrame).map((entry) => entry.bounds)
		);
		const view = zoomedView(mainFrame, nationStates, closestZoom);
		const scale = mainFrame.width / view.width;
		zoomed = scale > 1.001;
		views.push({ frame: mainFrame, view, scale, x: mainFrame.x, y: top });
		top += view.height * scale + gap;
		width = mainFrame.x + mainFrame.width + gap;
	} else {
		width = 0;
	}
	const fullWidth = mainFrame.x + mainFrame.width + gap;
	if (insets.length > 0) {
		const rowWidth = insets.reduce((sum, frame) => sum + frame.width, 0) + gap * (insets.length - 1);
		const scale = showsMain ? 1 : Math.min(largestInsetScale, Math.max(1, (insetsOnlyShare * fullWidth) / rowWidth));
		let left = gap;
		for (const frame of insets) {
			views.push({ frame, view: { ...frame }, scale, x: left, y: top });
			left += frame.width * scale + gap;
		}
		top += Math.max(...insets.map((frame) => frame.height)) * scale + gap;
		width = Math.max(width, left);
	}

	const boxes: PresenceBox[] = [];
	const labels: PresenceLabel[] = [];
	for (const { frame, view, scale, x, y } of views) {
		const toBox = (point: { x: number; y: number }) => ({
			x: tidy(x + (point.x - view.x) * scale),
			y: tidy(y + (point.y - view.y) * scale)
		});
		const inBox = placed.filter((entry) => entry.frame === frame);
		boxes.push({
			key: frame.key,
			x,
			y,
			width: tidy(view.width * scale),
			height: tidy(view.height * scale),
			transform: `translate(${tidy(x - view.x * scale)} ${tidy(y - view.y * scale)}) scale(${tidy(scale * 1000) / 1000})`,
			view: { x: tidy(view.x), y: tidy(view.y), width: tidy(view.width), height: tidy(view.height) },
			states: inBox
				// Drawn only if some of the shape is in view, and shaded states
				// last, so their outlines sit on top of their neighbors'.
				.filter((entry) => entry.bounds && rectanglesMeet(entry.bounds, view))
				.map((entry) => ({
					code: entry.shape.code,
					path: (scale > 1.001 && zoomedPaths.get(entry.shape.code)) || entry.shape.path,
					present: present.has(entry.shape.code)
				}))
				.sort((first, second) => Number(first.present) - Number(second.present))
		});
		for (const { shape } of inBox) {
			if (!present.has(shape.code)) continue;
			// A small place keeps its marker unless the zoom makes it big enough to
			// label; islands always keep theirs, since their pieces are spread out.
			const bounds = pathBounds(shape.path);
			const bigEnough =
				!shape.island && bounds !== undefined && Math.min(bounds.width, bounds.height) * scale >= smallestLabeledPlace;
			const marker = bigEnough ? undefined : shape.marker;
			if (marker) {
				// The marker keeps its offset in map units from the place, unscaled,
				// so it stays the same size and distance at any zoom.
				const from = toBox({ x: marker.fromX, y: marker.fromY });
				const dot = { x: tidy(from.x + marker.x - marker.fromX), y: tidy(from.y + marker.y - marker.fromY) };
				labels.push({
					code: shape.code,
					x: marker.labelSide === 'left' ? dot.x - 14 : dot.x + 14,
					y: dot.y + 8,
					align: marker.labelSide === 'left' ? 'end' : 'start',
					marker: { fromX: from.x, fromY: from.y, x: dot.x, y: dot.y }
				});
			} else if (shape.center) {
				const center = toBox(shape.center);
				labels.push({ code: shape.code, x: center.x, y: center.y + 8, align: 'middle' });
			}
		}
	}
	return {
		width: Math.round(width),
		height: Math.round(top),
		boxes,
		labels,
		zoomed,
		shareOfFullWidth: Math.min(1, tidy(width / fullWidth))
	};
}

const rectanglesMeet = (first: Rectangle, second: Rectangle) =>
	first.x <= second.x + second.width &&
	second.x <= first.x + first.width &&
	first.y <= second.y + second.height &&
	second.y <= first.y + first.height;

/** A point of the full map, placed on a box of the small map. */
export function pointInBox(box: PresenceBox, point: { x: number; y: number }): { x: number; y: number } {
	const scale = box.width / box.view.width;
	return { x: tidy(box.x + (point.x - box.view.x) * scale), y: tidy(box.y + (point.y - box.view.y) * scale) };
}

/** True when a shape's outline reaches into the part of the map a box shows. */
export function shapeInBox(box: PresenceBox, path: string): boolean {
	const bounds = pathBounds(path);
	return bounds !== undefined && rectanglesMeet(bounds, box.view);
}

/** A box whose states name their outline by key, so several views can share one copy of each. */
export interface SharedBox extends Omit<PresenceBox, 'states'> {
	states: { code: string; shape: string; present: boolean }[];
}

/**
 * Takes the state outlines out of several layouts of the same page and keeps
 * one copy of each, so a page with three views of its map carries each
 * outline once (the component draws them with <use>).
 */
export function shareStateShapes<Layout extends PresenceMapLayout>(
	layouts: Layout[]
): { shapes: { key: string; path: string }[]; layouts: (Omit<Layout, 'boxes'> & { boxes: SharedBox[] })[] } {
	const keys = new Map<string, string>();
	const shapes: { key: string; path: string }[] = [];
	const keyOf = (code: string, path: string) => {
		let key = keys.get(path);
		if (!key) {
			key = `${code}-${shapes.filter((shape) => shape.key.startsWith(`${code}-`)).length + 1}`;
			keys.set(path, key);
			shapes.push({ key, path });
		}
		return key;
	};
	return {
		shapes,
		layouts: layouts.map((layout) => ({
			...layout,
			boxes: layout.boxes.map((box) => ({
				...box,
				states: box.states.map((state) => ({ code: state.code, shape: keyOf(state.code, state.path), present: state.present }))
			}))
		}))
	};
}

/** What one box of a view draws over the states. */
export interface BoxLayers {
	/** Outlines drawn over the states, in the full map's units. */
	shapes: { path: string; kind: 'region' | 'nation-region' | 'land-area' }[];
	/** Dots for land areas too small to see, already placed on the small map. */
	dots: { x: number; y: number }[];
	labels: { text: string; x: number; y: number }[];
}

/** The small map on a nation's page, with its views (NationMap.svelte). */
export interface NationMapData {
	/** One copy of each state outline, which the views draw by key. */
	shapes: { key: string; path: string }[];
	views: {
		key: 'states' | 'region' | 'lands';
		label: string;
		layout: Omit<PresenceMapLayout, 'boxes'> & { boxes: SharedBox[] };
		layers: Record<string, BoxLayers>;
	}[];
	stateNames: string[];
	region?: { name: string; link: string };
	landAreas: { name: string; kind: string }[];
	/** The Land Areas view drawn with MapLibre over the site's own tiles, at the Census Bureau's full detail (TileMap.svelte). */
	tileMap?: TileMapData;
}
