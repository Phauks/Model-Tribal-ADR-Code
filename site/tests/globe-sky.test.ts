import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { globeOutline, placeStars, siderealDegrees, type GlobeSkyView, type Star } from '#lib/globe-sky.ts';

const view = (overrides: Partial<GlobeSkyView> = {}): GlobeSkyView => ({
	width: 1000,
	height: 700,
	longitude: -98,
	latitude: 39,
	zoom: 1,
	fieldOfView: 36.87,
	time: new Date(Date.UTC(2000, 0, 1, 12)),
	...overrides
});

describe('the sky behind the globe', () => {
	it('turns the sky by sidereal time', () => {
		// At J2000.0, Greenwich mean sidereal time is 280.46 degrees (U.S. Naval Observatory, Approximate Sidereal Time).
		expect(siderealDegrees(new Date(Date.UTC(2000, 0, 1, 12)))).toBeCloseTo(280.46, 2);
		// A sidereal day is about 3 minutes 56 seconds shorter than a solar day, so the sky turns about 0.9856 degrees more each day.
		const nextDay = siderealDegrees(new Date(Date.UTC(2000, 0, 2, 12)));
		expect(nextDay - siderealDegrees(new Date(Date.UTC(2000, 0, 1, 12)))).toBeCloseTo(0.9856, 3);
	});

	it('sees a smaller earth edge than the globe radius, and a larger one closer in', () => {
		const far = globeOutline(view({ zoom: 1 }));
		const near = globeOutline(view({ zoom: 2 }));
		const radius = (512 * 2) / (2 * Math.PI) / Math.cos((39 * Math.PI) / 180);
		expect(far.radius).toBeLessThan(radius);
		expect(near.radius).toBeGreaterThan(far.radius);
		expect(far.x).toBe(500);
		expect(far.y).toBe(350);
	});

	it('shows the stars on the far side of the earth', () => {
		const polaris: Star = [37.95, 89.26, 1.97, 0.64];
		const sigmaOctantis: Star = [317.2, -88.96, 5.45, 0.41];
		// Looking down on the North Pole, the sky behind the earth is around the south celestial pole.
		const placed = placeStars([polaris, sigmaOctantis], view({ latitude: 89.9, longitude: 0 }));
		expect(placed.map((entry) => entry.star)).toEqual([sigmaOctantis]);
		expect(Math.hypot(placed[0].x - 500, placed[0].y - 350)).toBeLessThan(40);
	});

	it('keeps east on the right as the globe draws it', () => {
		// Over the equator at longitude 0, at sidereal time 0, a star at right ascension 170 degrees is a little west of straight behind the earth (180), so it shows a little right of center: seen from outside, the far side's west is on the right.
		const time = new Date(Date.UTC(2000, 0, 1, 12));
		const turned = siderealDegrees(time);
		const star: Star = [170 + turned, 0, 1, 0.5];
		const [placed] = placeStars([star], view({ latitude: 0, longitude: 0, time }));
		expect(placed.x).toBeGreaterThan(500);
		expect(placed.y).toBeCloseTo(350, 5);
	});

	it('has the stars file the map fetches', () => {
		const file = JSON.parse(readFileSync('static/map-sky/stars.json', 'utf8')) as { license: string; stars: Star[] };
		expect(file.license).toContain('ESA');
		expect(file.stars.length).toBeGreaterThan(5000);
		expect(file.stars.every((star) => star.length === 4 && star[2] < 6.2)).toBe(true);
	});
});
