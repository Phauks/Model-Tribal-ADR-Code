import { describe, expect, it } from 'vitest';
import {
	centerOn,
	formatViewBox,
	keepInside,
	moveBy,
	parseViewBox,
	screenToMap,
	zoomBy,
	zoomOf,
	zoomTo
} from '../src/lib/map-zoom.ts';

const full = { x: 0, y: 0, width: 1000, height: 800 };

describe('zoomTo', () => {
	it('zooms around the middle of the view when no point is given', () => {
		const view = zoomTo(full, full, 2, 8);
		expect(view).toEqual({ x: 250, y: 200, width: 500, height: 400 });
		expect(zoomOf(full, view)).toBe(2);
	});

	it('keeps the point under the pointer in the same place on screen', () => {
		const point = { x: 200, y: 100 };
		const view = zoomTo(full, full, 4, 8, point);
		// The point was a fifth of the way across and an eighth of the way down.
		expect((point.x - view.x) / view.width).toBeCloseTo(0.2);
		expect((point.y - view.y) / view.height).toBeCloseTo(0.125);
	});

	it('never zooms out past the whole map or in past the most allowed', () => {
		expect(zoomTo(full, full, 0.5, 8)).toEqual(full);
		expect(zoomOf(full, zoomTo(full, full, 50, 8))).toBe(8);
	});
});

describe('zoomBy and moveBy', () => {
	it('zooming in then out by the same step returns to the whole map', () => {
		const inward = zoomBy(full, full, 1.6, 8);
		expect(zoomBy(full, inward, 1 / 1.6, 8)).toEqual(full);
	});

	it('keeps the view inside the drawing when moved past an edge', () => {
		const view = zoomTo(full, full, 2, 8);
		expect(moveBy(full, view, -900, 0).x).toBe(0);
		expect(moveBy(full, view, 900, 900)).toEqual({ x: 500, y: 400, width: 500, height: 400 });
	});

	it('cannot move the whole map at all', () => {
		expect(moveBy(full, full, 100, 100)).toEqual(full);
	});
});

describe('centerOn', () => {
	it('puts a place in the middle of the view, as far as the edges allow', () => {
		const view = zoomTo(full, full, 4, 8);
		expect(centerOn(full, view, { x: 600, y: 500 })).toEqual({ x: 475, y: 400, width: 250, height: 200 });
		expect(centerOn(full, view, { x: 990, y: 10 })).toEqual({ x: 750, y: 0, width: 250, height: 200 });
	});
});

describe('viewBox text', () => {
	it('reads and writes the attribute', () => {
		expect(parseViewBox('0 0 975 812')).toEqual({ x: 0, y: 0, width: 975, height: 812 });
		expect(parseViewBox('0,0,10,10')).toEqual({ x: 0, y: 0, width: 10, height: 10 });
		expect(formatViewBox({ x: 1 / 3, y: 2, width: 100.456, height: 50 })).toBe('0.33 2 100.46 50');
	});

	it('refuses a missing or broken attribute', () => {
		expect(parseViewBox(null)).toBeUndefined();
		expect(parseViewBox('0 0 0 10')).toBeUndefined();
		expect(parseViewBox('0 0 ten 10')).toBeUndefined();
	});
});

describe('screenToMap', () => {
	it('turns a point on screen into map units', () => {
		const view = { x: 100, y: 100, width: 500, height: 400 };
		const box = { left: 20, top: 40, width: 250, height: 200 };
		expect(screenToMap(view, box, 145, 90)).toEqual({ x: 350, y: 200 });
	});
});

describe('keepInside', () => {
	it('leaves a view that already fits alone', () => {
		const view = { x: 10, y: 10, width: 100, height: 80 };
		expect(keepInside(full, view)).toEqual(view);
	});
});
