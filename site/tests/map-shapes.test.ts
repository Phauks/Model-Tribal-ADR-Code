import { describe, expect, it } from 'vitest';
import type { MapGeometry } from '../src/lib/map-geometry.ts';
import { distanceToShape, patternFor, patternImage, patternImageName, patternMarkFor, patternOfImageName, shapeFor, shapeImage, shapePath, type MapShape } from '../src/lib/map-shapes.ts';
import { drawLandAreasMap, drawShadedLandAreasMap, drawShadedStatesMap } from '../src/lib/nations-map-drawing.ts';

const shapes: MapShape[] = ['triangle', 'circle', 'square', 'diamond'];

describe('shapeFor', () => {
	it('gives each category shade its own shape, darkest first as Trevor approved, and none to shade 0', () => {
		expect([4, 3, 2, 1].map(shapeFor)).toEqual(['diamond', 'square', 'circle', 'triangle']);
		expect(shapeFor(0)).toBeUndefined();
	});
});

describe('shapePath', () => {
	it('draws each polygon through its corners, centered on the point', () => {
		expect(shapePath('square', 10, 20, 2)).toBe('M8 18L12 18L12 22L8 22Z');
		expect(shapePath('diamond', 0, 0, 2)).toBe('M0 -2.7L2.7 0L0 2.7L-2.7 0Z');
		expect(shapePath('circle', 5, 5, 1)).toBe('M6 5A1 1 0 1 1 4 5A1 1 0 1 1 6 5Z');
	});
});

describe('distanceToShape', () => {
	it('is negative inside each shape, zero on its edge and positive outside', () => {
		for (const shape of shapes) {
			expect(distanceToShape(shape, 0, 0, 10)).toBeLessThan(0);
			expect(distanceToShape(shape, 30, 30, 10)).toBeGreaterThan(0);
		}
		expect(distanceToShape('square', 10, 0, 10)).toBeCloseTo(0);
		expect(distanceToShape('square', 15, 0, 10)).toBeCloseTo(5);
		expect(distanceToShape('circle', 0, 4, 10)).toBeCloseTo(-6);
		expect(distanceToShape('diamond', 13.5, 0, 10)).toBeCloseTo(0);
		expect(distanceToShape('triangle', 0, -13, 10)).toBeCloseTo(0);
	});
});

describe('shapeImage', () => {
	it('makes a square white image with the edge at 0.75 in the alpha channel, as MapLibre reads a distance field', () => {
		const image = shapeImage('square', 5, 2);
		expect(image.width).toBe(image.height);
		expect(image.data.length).toBe(image.width * image.height * 4);
		const alphaAt = (column: number, row: number) => image.data[(row * image.width + column) * 4 + 3];
		const middle = image.width / 2;
		expect(alphaAt(middle, middle)).toBe(255);
		expect(alphaAt(0, 0)).toBe(0);
		// The square's edge is 10 image pixels from the middle; the pixel straddling it sits at 0.75.
		expect(alphaAt(middle + 9, middle) / 255).toBeCloseTo(0.75 + 0.5 / 8, 1);
		expect(image.data[0]).toBe(255);
	});
});

describe('the drawn category map', () => {
	const geometry = {
		width: 100,
		height: 100,
		frames: [],
		land: 'M0 0Z',
		stateBorders: 'M0 0Z',
		landAreas: [
			{ identifier: 'a', path: '', dot: { x: 10, y: 10 } },
			{ identifier: 'b', path: '', dot: { x: 20, y: 20 } },
			{ identifier: 'c', path: 'M0 0L5 0L5 5Z' }
		],
		offices: [
			{ nation: 'with-category', x: 30, y: 30 },
			{ nation: 'without', x: 40, y: 40 }
		]
	} as unknown as MapGeometry;
	const drawing = drawShadedLandAreasMap(geometry, {
		key: 'courts-and-peacemaking',
		title: 'Courts',
		areas: [
			{ identifier: 'a', shade: 4, description: 'A' },
			{ identifier: 'b', shade: 0, description: 'B' },
			{ identifier: 'c', shade: 2, description: 'C' }
		],
		offices: [
			{ nation: 'with-category', shade: 3, description: 'Office one' },
			{ nation: 'without', shade: 0, description: 'Office two' }
		]
	});

	it('marks a small area with its category shape, and leaves one with no category a plain dot', () => {
		expect(drawing).toContain(`class="land-area count-4 dot shape shape-diamond" d="${shapePath('diamond', 10, 10, 4.2)}"`);
		expect(drawing).toContain('<circle class="land-area count-0 dot" cx="20" cy="20" r="3">');
	});

	it("keeps a large area as its outline, marked for its category's pattern", () => {
		expect(drawing).toContain('<path class="land-area count-2 category-2" d="M0 0L5 0L5 5Z">');
	});

	it("marks each state on the by-state map for its category's pattern", () => {
		const states = drawShadedStatesMap({ ...geometry, states: [{ code: 'AZ', path: 'M0 0L9 0L9 9Z' }] } as unknown as MapGeometry, {
			key: 'courts-and-peacemaking',
			title: 'Courts',
			states: [{ code: 'AZ', shade: 3, description: 'Arizona' }]
		});
		expect(states).toContain('class="state count-3 category-3"');
	});

	it("gives the Land Areas view's small areas their group's shape and large ones their group's pattern", () => {
		const lands = drawLandAreasMap(
			{
				...geometry,
				landAreas: [
					{ identifier: 'a', kind: 'state-reservation', path: '', dot: { x: 10, y: 10 } },
					{ identifier: 'c', kind: 'state-reservation', path: 'M0 0L5 0L5 5Z' }
				]
			} as unknown as MapGeometry,
			[
				{ identifier: 'a', name: 'A', kind: 'state-reservation', count: 1, anchor: 'a' },
				{ identifier: 'c', name: 'C', kind: 'state-reservation', count: 1, anchor: 'c' }
			] as never
		);
		expect(lands).toContain(`class="land-area land-state dot shape shape-square" d="${shapePath('square', 10, 10, 4.2)}"`);
		expect(lands).toContain('class="land-area land-state category-3" d="M0 0L5 0L5 5Z"');
	});

	it("gives an office its nation's category shape, and keeps the ring dot for one with none", () => {
		expect(drawing).toContain(`class="office shape shape-square count-3" d="${shapePath('square', 30, 30, 4.5)}"`);
		expect(drawing).toContain('<circle class="office count-0" cx="40" cy="40" r="4">');
	});
});

describe('area patterns', () => {
	it('follows the shapes: the darkest shade solid, then stripes, dots and a grid', () => {
		expect([4, 3, 2, 1, 0].map(patternFor)).toEqual([undefined, 'stripes', 'dots', 'grid', undefined]);
		expect([3, 2, 1].map(patternMarkFor)).toEqual(['paper', 'ink', 'ink']);
	});

	it('makes a tile of marks in the given color, clear between them', () => {
		for (const pattern of ['stripes', 'dots', 'grid'] as const) {
			const image = patternImage(pattern, '#102030', 2);
			expect(image.width).toBe(12);
			const alphas = Array.from({ length: image.width * image.height }, (_, index) => image.data[index * 4 + 3]);
			expect(alphas.some((alpha) => alpha === 0)).toBe(true);
			expect(alphas.some((alpha) => alpha > 150)).toBe(true);
			expect([image.data[0], image.data[1], image.data[2]]).toEqual([0x10, 0x20, 0x30]);
		}
	});

	it('names each image by its pattern and color, and reads the name back', () => {
		const name = patternImageName('dots', '#A1B2C3');
		expect(name).toBe('area-pattern-dots-a1b2c3');
		expect(patternOfImageName(name)).toEqual({ pattern: 'dots', color: '#a1b2c3' });
		expect(patternOfImageName('category-circle')).toBeUndefined();
	});
});
