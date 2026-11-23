import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { designTokensToCss, type TokenGroup } from '#lib/design-tokens.ts';
import {
	between,
	cubicBezier,
	glide,
	motionDuration,
	motionEasings,
	motionReduced,
	motionSpeeds,
	parseCubicBezier,
	parseDuration
} from '#lib/motion.ts';

const tokens = JSON.parse(readFileSync('design-tokens.json', 'utf8')) as TokenGroup;

describe('motion tokens', () => {
	const css = designTokensToCss(tokens);

	it('gives every speed and easing the module names a custom property', () => {
		for (const speed of motionSpeeds) expect(css).toMatch(new RegExp(`--motion-duration-${speed}: \\d+ms;`));
		for (const easing of motionEasings) {
			expect(css).toMatch(new RegExp(`--motion-easing-${easing}: cubic-bezier\\([^)]*\\);`));
		}
	});

	it('writes easing curves as cubic-bezier() that the module can read back', () => {
		const match = /--motion-easing-standard: (cubic-bezier\([^)]*\));/.exec(css);
		expect(match).not.toBeNull();
		expect(parseCubicBezier(match![1])).toEqual([0.2, 0, 0, 1]);
	});

	it('sets every duration to 0 when the reader or the device asks for less motion', () => {
		const global = readFileSync('src/lib/styles/global.css', 'utf8');
		for (const block of [/:root\[data-motion='reduce'\] \{([^}]*)\}/, /:root:root \{([^}]*)\}/]) {
			const body = block.exec(global)?.[1] ?? '';
			for (const speed of motionSpeeds) expect(body).toContain(`--motion-duration-${speed}: 0ms;`);
		}
	});
});

describe('motion helpers', () => {
	it('reads CSS times as milliseconds', () => {
		expect(parseDuration('200ms')).toBe(200);
		expect(parseDuration(' 0.32s ')).toBe(320);
		expect(parseDuration('0ms')).toBe(0);
		expect(parseDuration('')).toBe(0);
		expect(parseDuration('fast')).toBe(0);
	});

	it('rejects anything but four numbers in cubic-bezier()', () => {
		expect(parseCubicBezier('cubic-bezier(0, 0, 0, 1)')).toEqual([0, 0, 0, 1]);
		expect(parseCubicBezier('ease-in')).toBeUndefined();
		expect(parseCubicBezier('cubic-bezier(0, 0, 1)')).toBeUndefined();
	});

	it('follows a cubic-bezier curve from start to end', () => {
		const linear = cubicBezier(0, 0, 1, 1);
		const standard = cubicBezier(0.2, 0, 0, 1);
		expect(linear(0.3)).toBeCloseTo(0.3, 4);
		expect(standard(0)).toBe(0);
		expect(standard(1)).toBe(1);
		// The standard curve is well past halfway by the middle of its time.
		expect(standard(0.5)).toBeGreaterThan(0.8);
		let last = 0;
		for (let time = 0.05; time < 1; time += 0.05) {
			const now = standard(time);
			expect(now).toBeGreaterThanOrEqual(last);
			last = now;
		}
	});

	it('finds points between two lists of numbers', () => {
		expect(between([0, 10], [10, 20], 0.5)).toEqual([5, 15]);
		expect(between([0, 0], [4, 8], 1)).toEqual([4, 8]);
	});

	it('moves nothing outside a browser, so a glide goes straight to its end', () => {
		expect(motionReduced()).toBe(true);
		expect(motionDuration('medium')).toBe(0);
		const drawn: number[][] = [];
		glide([0, 0], [3, 4], (values) => drawn.push(values));
		expect(drawn).toEqual([[3, 4]]);
	});
});
