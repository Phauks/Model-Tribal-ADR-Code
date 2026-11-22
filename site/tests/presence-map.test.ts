import { describe, expect, it } from 'vitest';
import {
	layoutPresenceMap,
	pathBounds,
	pointInBox,
	shapeInBox,
	shareStateShapes,
	type SourceFrame
} from '../src/lib/presence-map.ts';
import type { StateShape } from '../src/lib/map-geometry.ts';

// A made-up map: a main box 951 by 600 units, and two boxes underneath.
const frames: SourceFrame[] = [
	{ key: 'main', x: 12, y: 12, width: 951, height: 600 },
	{ key: 'alaska', x: 12, y: 624, width: 296, height: 190 },
	{ key: 'hawaii', x: 320, y: 624, width: 176, height: 190 }
];
const square = (x: number, y: number, size: number) => `M${x},${y}L${x + size},${y}L${x + size},${y + size}L${x},${y + size}Z`;
const states: StateShape[] = [
	{ code: 'WA', path: square(40, 40, 100), center: { x: 90, y: 90 } },
	{ code: 'OR', path: square(40, 140, 100), center: { x: 90, y: 190 } },
	{ code: 'ME', path: square(860, 40, 80), center: { x: 900, y: 80 } },
	{ code: 'AK', path: square(60, 660, 120), center: { x: 120, y: 720 } },
	{ code: 'HI', path: square(380, 700, 40), center: { x: 400, y: 720 } }
];

describe('pathBounds', () => {
	it('finds the box around path data', () => {
		expect(pathBounds('M1,2L5,-3L4,9Z')).toEqual({ x: 1, y: -3, width: 4, height: 12 });
	});
});

describe('layoutPresenceMap', () => {
	it('shows only the boxes that hold the nation’s states', () => {
		const map = layoutPresenceMap(frames, states, new Set(['AK']));
		expect(map.boxes.map((box) => box.key)).toEqual(['alaska']);
		expect(map.zoomed).toBe(false);
		expect(map.labels.map((label) => label.code)).toEqual(['AK']);
		expect(map.shareOfFullWidth).toBeLessThan(1);
	});

	it('zooms the main box to the nation’s states and drops the others', () => {
		const map = layoutPresenceMap(frames, states, new Set(['WA', 'OR']));
		expect(map.boxes.map((box) => box.key)).toEqual(['main']);
		expect(map.zoomed).toBe(true);
		const [main] = map.boxes;
		expect(main.states.map((state) => state.code)).not.toContain('ME');
		expect(main.states.at(-1)?.present).toBe(true);
		// Never closer than 40 percent of the main box's width: a scale of 2.5 at most.
		const scale = Number(main.transform.match(/scale\(([\d.]+)\)/)?.[1]);
		expect(scale).toBeGreaterThan(1);
		expect(scale).toBeLessThanOrEqual(2.5);
		expect(main.width).toBe(951);
	});

	it('uses the more detailed outlines when a box is drawn larger', () => {
		const map = layoutPresenceMap(frames, states, new Set(['HI']), new Map([['HI', 'M1,1Z']]));
		expect(map.boxes[0].states[0].path).toBe('M1,1Z');
	});

	it('keeps the main box whole when the nation’s states span it', () => {
		const map = layoutPresenceMap(frames, states, new Set(['WA', 'ME', 'HI']));
		expect(map.boxes.map((box) => box.key)).toEqual(['main', 'hawaii']);
		expect(map.zoomed).toBe(false);
	});
});

describe('layoutPresenceMap with a focus', () => {
	it('zooms to the focus shape rather than to the nation’s states', () => {
		const focus = square(40, 40, 60);
		const map = layoutPresenceMap(frames, states, new Set(['WA']), new Map(), { focus: [focus], closestZoom: 0.25 });
		expect(map.boxes.map((box) => box.key)).toEqual(['main']);
		const [main] = map.boxes;
		// A quarter of the main box's width at the closest: a scale of 4 at most.
		const scale = Number(main.transform.match(/scale\(([\d.]+)\)/)?.[1]);
		expect(scale).toBeGreaterThan(2.5);
		expect(scale).toBeLessThanOrEqual(4);
		expect(shapeInBox(main, focus)).toBe(true);
		expect(shapeInBox(main, square(860, 40, 80))).toBe(false);
	});

	it('places a point of the full map on the drawn box', () => {
		const map = layoutPresenceMap(frames, states, new Set(['WA', 'OR']));
		const [main] = map.boxes;
		const placed = pointInBox(main, { x: main.view.x, y: main.view.y });
		expect(placed).toEqual({ x: main.x, y: main.y });
	});
});

describe('shareStateShapes', () => {
	it('keeps one copy of each outline that several views draw', () => {
		const statesView = layoutPresenceMap(frames, states, new Set(['WA', 'OR']));
		const regionView = layoutPresenceMap(frames, states, new Set(['WA']), new Map(), { focus: [square(40, 40, 200)] });
		const shared = shareStateShapes([statesView, regionView]);
		const keys = shared.shapes.map((shape) => shape.key);
		expect(new Set(keys).size).toBe(keys.length);
		expect(shared.shapes.length).toBeLessThan(
			statesView.boxes.flatMap((box) => box.states).length + regionView.boxes.flatMap((box) => box.states).length
		);
		const washington = shared.layouts[0].boxes[0].states.find((state) => state.code === 'WA');
		expect(washington?.shape).toBe('WA-1');
		expect(shared.layouts[1].boxes[0].states.find((state) => state.code === 'WA')?.shape).toBe('WA-1');
	});
});
