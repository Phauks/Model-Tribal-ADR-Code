// polylabel ships no types. It finds the point inside a polygon farthest from its edges, used for where a state's name goes on the tiled map (src/lib/map-geometry.ts).
declare module 'polylabel' {
	export default function polylabel(polygon: number[][][], precision?: number, debug?: boolean): [number, number] & { distance: number };
}
