/**
 * The shapes that mark each category on the map's category views, so a category never rests on its shade alone (WCAG 1.4.1, Use of Color; DESIGN.md, "Color vision"). Trevor approved them on Nov. 27, 2026, from the color vision mockups: a diamond for the darkest shade (4), a square for 3, a circle for 2 and a triangle for the lightest (1). On the courts view that is peacemaking, healing to wellness court, tribal court and Court of Indian Offenses only.
 *
 * The drawn map (src/lib/nations-map-drawing.ts) and the map's key use `shapePath`; the tiled map (src/lib/components/TileMap.svelte) uses `shapeImage`, a signed distance field, so MapLibre can color a shape by its category, light it on hover and ring it in ink.
 */

export type MapShape = 'triangle' | 'circle' | 'square' | 'diamond';

/** The shape of each shade, from the lightest category to the darkest. A shade of 0, no fact recorded, has no mark. */
export const shapeOfShade: Record<number, MapShape> = { 1: 'triangle', 2: 'circle', 3: 'square', 4: 'diamond' };

/** The shape for a shade, or undefined for shade 0. */
export const shapeFor = (shade: number): MapShape | undefined => shapeOfShade[shade];

type Point = [number, number];

/** Each shape's corners for a mark of the given size, centered on 0, 0 (a circle has none). The proportions are the mockup's, which keep the shapes about the same size to the eye. */
function cornersOf(shape: Exclude<MapShape, 'circle'>, size: number): Point[] {
	if (shape === 'diamond') return [[0, -1.35 * size], [1.35 * size, 0], [0, 1.35 * size], [-1.35 * size, 0]];
	if (shape === 'square') return [[-size, -size], [size, -size], [size, size], [-size, size]];
	return [[0, -1.3 * size], [1.2 * size, 0.85 * size], [-1.2 * size, 0.85 * size]];
}

const rounded = (value: number) => Number(value.toFixed(2));

/** An SVG path for the shape centered on x, y; size is a circle's radius, and the other shapes are sized to match it. */
export function shapePath(shape: MapShape, x: number, y: number, size: number): string {
	if (shape === 'circle') return `M${rounded(x + size)} ${rounded(y)}A${rounded(size)} ${rounded(size)} 0 1 1 ${rounded(x - size)} ${rounded(y)}A${rounded(size)} ${rounded(size)} 0 1 1 ${rounded(x + size)} ${rounded(y)}Z`;
	const corners = cornersOf(shape, size).map(([cornerX, cornerY]) => `${rounded(x + cornerX)} ${rounded(y + cornerY)}`);
	return `M${corners.join('L')}Z`;
}

/** How far a point is from the shape's edge: negative inside, positive outside. */
export function distanceToShape(shape: MapShape, x: number, y: number, size: number): number {
	if (shape === 'circle') return Math.hypot(x, y) - size;
	const corners = cornersOf(shape, size);
	let nearest = Infinity;
	let inside = false;
	for (let index = 0, previous = corners.length - 1; index < corners.length; previous = index++) {
		const [ax, ay] = corners[previous];
		const [bx, by] = corners[index];
		const along = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2)));
		nearest = Math.min(nearest, Math.hypot(x - (ax + along * (bx - ax)), y - (ay + along * (by - ay))));
		if (ay > y !== by > y && x < ((bx - ax) * (y - ay)) / (by - ay) + ax) inside = !inside;
	}
	return inside ? -nearest : nearest;
}

/** Pixels of room round the shape in its image, for the ink ring MapLibre draws as a halo. */
const imageRoom = 6;

/**
 * The shape as a signed distance field image, as MapLibre's `addImage(name, image, { sdf: true })` takes it: white, with the distance from the edge in the alpha channel, 0.75 on the edge and falling by 1/8 for each pixel outward (the encoding of Mapbox's TinySDF, with a radius of 8 and a cutoff of 0.25).
 * @param size the shape's size in screen pixels, as for shapePath
 * @param pixelRatio pixels of the image per screen pixel
 */
export function shapeImage(shape: MapShape, size: number, pixelRatio: number): { width: number; height: number; data: Uint8ClampedArray } {
	const scaled = size * pixelRatio;
	const half = Math.ceil(1.35 * scaled + imageRoom * pixelRatio);
	const width = half * 2;
	const data = new Uint8ClampedArray(width * width * 4);
	for (let row = 0; row < width; row++) {
		for (let column = 0; column < width; column++) {
			const distance = distanceToShape(shape, column + 0.5 - half, row + 0.5 - half, scaled);
			const at = (row * width + column) * 4;
			data[at] = 255;
			data[at + 1] = 255;
			data[at + 2] = 255;
			data[at + 3] = Math.round(255 - 255 * (distance / 8 + 0.25));
		}
	}
	return { width, height: width, data };
}

/** The name the tiled map gives each shape's image. */
export const shapeImageName = (shape: MapShape) => `category-${shape}`;

/**
 * The patterns that mark each category's areas, the states and land areas too big for a shape, in the same order as the shapes: the darkest shade (4) stays solid, then stripes, dots, and a grid for the lightest (1). The marks are paper on the two darkest shades and ink on the lighter ones, so they show on each.
 */
export type MapPattern = 'stripes' | 'dots' | 'grid';

export const patternOfShade: Record<number, MapPattern> = { 1: 'grid', 2: 'dots', 3: 'stripes' };

/** The pattern for a shade, or undefined for the darkest (solid) and for shade 0. */
export const patternFor = (shade: number): MapPattern | undefined => patternOfShade[shade];

/** Whether a shade's marks are paper (on the darker shades) or ink. */
export const patternMarkFor = (shade: number): 'paper' | 'ink' => (shade >= 3 ? 'paper' : 'ink');

/** The side of one tile of a pattern, in screen pixels. */
export const patternTileSize = 6;

/** How much of the pixel at x, y (0 to 6, in tile units) a pattern's mark covers, from 0 to 1, and the opacity its marks are drawn at. */
function patternMark(pattern: MapPattern, x: number, y: number): number {
	const size = patternTileSize;
	if (pattern === 'stripes') {
		// Stripes at 45 degrees, 1.6 wide across a 6 tile, which repeat across tiles.
		const across = (((x + y) % size) + size) % size;
		return Math.min(across, size - across) < 0.8 * Math.SQRT2 ? 0.8 : 0;
	}
	if (pattern === 'dots') return Math.hypot(x - size / 2, y - size / 2) < 1.1 ? 0.75 : 0;
	return Math.abs(x - size / 2) < 0.45 || Math.abs(y - size / 2) < 0.45 ? 0.7 : 0;
}

/**
 * One tile of a pattern's marks, transparent between them, as MapLibre's `addImage` takes it for a `fill-pattern` drawn over an area's shade.
 * @param color the marks' color as "#RRGGBB"
 * @param pixelRatio pixels of the image per screen pixel
 */
export function patternImage(pattern: MapPattern, color: string, pixelRatio: number): { width: number; height: number; data: Uint8ClampedArray } {
	const width = patternTileSize * pixelRatio;
	const [red, green, blue] = [1, 3, 5].map((at) => Number.parseInt(color.slice(at, at + 2), 16));
	const data = new Uint8ClampedArray(width * width * 4);
	for (let row = 0; row < width; row++) {
		for (let column = 0; column < width; column++) {
			const opacity = patternMark(pattern, (column + 0.5) / pixelRatio, (row + 0.5) / pixelRatio);
			const at = (row * width + column) * 4;
			data[at] = red;
			data[at + 1] = green;
			data[at + 2] = blue;
			data[at + 3] = Math.round(255 * opacity);
		}
	}
	return { width, height: width, data };
}

/** The name the tiled map gives a pattern's image in a mark color; the color is part of the name, so each theme has its own. */
export const patternImageName = (pattern: MapPattern, color: string) => `area-pattern-${pattern}-${color.replace('#', '').toLowerCase()}`;

/** The pattern and color a pattern image's name stands for. */
export function patternOfImageName(name: string): { pattern: MapPattern; color: string } | undefined {
	const match = /^area-pattern-(stripes|dots|grid)-([0-9a-f]{6})$/.exec(name);
	return match ? { pattern: match[1] as MapPattern, color: `#${match[2]}` } : undefined;
}

/**
 * SVG pattern definitions for the drawn map and the keys, one per shade that has a pattern, each filling its shade's color and drawing its marks over it. The colors are the theme's tokens, so they follow the theme. Each page draws them once, and its drawings fill with `url(#area-pattern-<shade>)`.
 */
export function patternDefinitions(): string {
	const size = patternTileSize;
	const mark = (shade: number) => `var(--color-${patternMarkFor(shade)})`;
	const background = (shade: number) => `<rect width="${size}" height="${size}" style="fill: var(--color-map-class-${shade})"/>`;
	return (
		`<pattern id="area-pattern-3" patternUnits="userSpaceOnUse" width="${size}" height="${size}" patternTransform="rotate(45)">${background(3)}<rect width="1.6" height="${size}" style="fill: ${mark(3)}; fill-opacity: 0.8"/></pattern>` +
		`<pattern id="area-pattern-2" patternUnits="userSpaceOnUse" width="${size}" height="${size}">${background(2)}<circle cx="${size / 2}" cy="${size / 2}" r="1.1" style="fill: ${mark(2)}; fill-opacity: 0.75"/></pattern>` +
		`<pattern id="area-pattern-1" patternUnits="userSpaceOnUse" width="${size}" height="${size}">${background(1)}<path d="M${size / 2} 0V${size}M0 ${size / 2}H${size}" style="stroke: ${mark(1)}; stroke-width: 0.9; stroke-opacity: 0.7"/></pattern>`
	);
}
