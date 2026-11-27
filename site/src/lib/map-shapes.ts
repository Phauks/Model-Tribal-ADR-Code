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
