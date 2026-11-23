/**
 * Motion on the site (site/DESIGN.md, section 6, "Motion"). Trevor asked on
 * Nov. 22, 2026 for one shared framework for animation, so that every
 * component moves with the same timing and stops moving for the same reasons.
 * This module is that framework. It adds no animation library: Svelte's own
 * transitions, the browser's Web Animations and View Transitions, and CSS do
 * the work.
 *
 * Rules every use follows:
 * - Timing comes from the motion tokens in site/design-tokens.json, which the
 *   build turns into --motion-duration-* and --motion-easing-* custom
 *   properties. CSS uses those properties; scripts use the helpers below,
 *   which read the same properties. tools/check-motion-comes-from-tokens.mjs
 *   fails the build on a timing written anywhere else.
 * - Motion happens only in answer to something the reader does.
 * - Nothing moves when the reader picks Reduce motion in Settings
 *   (data-motion="reduce" on the root element) or the device asks for less
 *   motion. CSS durations become 0 in global.css, and every helper here
 *   returns a duration of 0, so script animations end at once.
 * - Printing finishes every animation first, so paper shows the end state.
 *
 * This module must load in Node (for tests and prerendering); anything that
 * needs a browser checks for it first.
 */
import { flip } from 'svelte/animate';
import type { AnimationConfig } from 'svelte/animate';
import { fade as svelteFade, fly, slide as svelteSlide } from 'svelte/transition';
import type { TransitionConfig } from 'svelte/transition';
import type { onNavigate } from '$app/navigation';

/** What SvelteKit's onNavigate passes to its callback. */
type OnNavigate = Parameters<Parameters<typeof onNavigate>[0]>[0];

export const motionSpeeds = ['short', 'medium', 'long', 'highlight'] as const;
export const motionEasings = ['standard', 'enter', 'exit'] as const;

/** A duration token's name, such as "medium" for --motion-duration-medium. */
export type MotionSpeed = (typeof motionSpeeds)[number];
/** An easing token's name, such as "enter" for --motion-easing-enter. */
export type MotionEasing = (typeof motionEasings)[number];

export const reducedMotionQuery = '(prefers-reduced-motion: reduce)';

/** Reads a CSS time such as "200ms" or "0.2s" as milliseconds; anything else is 0. */
export function parseDuration(value: string): number {
	const match = /^\s*(-?[\d.]+)(ms|s)\s*$/.exec(value);
	if (!match) return 0;
	const amount = Number(match[1]) * (match[2] === 's' ? 1000 : 1);
	return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

/** Reads "cubic-bezier(0.2, 0, 0, 1)" as its four numbers, or undefined. */
export function parseCubicBezier(value: string): [number, number, number, number] | undefined {
	const match = /^\s*cubic-bezier\(([^)]*)\)\s*$/.exec(value);
	if (!match) return undefined;
	const numbers = match[1].split(',').map((part) => Number(part.trim()));
	if (numbers.length !== 4 || numbers.some((number) => !Number.isFinite(number))) return undefined;
	return numbers as [number, number, number, number];
}

/**
 * The easing function a CSS cubic-bezier() curve describes, for script
 * animations and Svelte transitions: given how far along in time (0 to 1), it
 * returns how far along the movement is.
 */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (time: number) => number {
	const cx = 3 * x1;
	const bx = 3 * (x2 - x1) - cx;
	const ax = 1 - cx - bx;
	const cy = 3 * y1;
	const by = 3 * (y2 - y1) - cy;
	const ay = 1 - cy - by;
	const curveX = (t: number) => ((ax * t + bx) * t + cx) * t;
	const curveY = (t: number) => ((ay * t + by) * t + cy) * t;
	const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;

	return (time: number) => {
		if (time <= 0) return 0;
		if (time >= 1) return 1;
		// Newton's method finds the curve's t for this time; halving the range
		// takes over where the slope is too flat for it.
		let t = time;
		for (let step = 0; step < 8; step += 1) {
			const error = curveX(t) - time;
			if (Math.abs(error) < 1e-6) return curveY(t);
			const slope = slopeX(t);
			if (Math.abs(slope) < 1e-6) break;
			t -= error / slope;
		}
		let low = 0;
		let high = 1;
		t = time;
		while (high - low > 1e-6) {
			if (curveX(t) < time) low = t;
			else high = t;
			t = (low + high) / 2;
		}
		return curveY(t);
	};
}

/** The point the given share of the way from one list of numbers to another. */
export function between(from: readonly number[], to: readonly number[], share: number): number[] {
	return to.map((end, index) => {
		const start = from[index] ?? end;
		return start + (end - start) * share;
	});
}

function inBrowser(): boolean {
	return typeof window !== 'undefined' && typeof document !== 'undefined';
}

/** True when nothing should move: the reader's setting, the device's setting, or no browser at all. */
export function motionReduced(): boolean {
	if (!inBrowser()) return true;
	if (document.documentElement.dataset.motion === 'reduce') return true;
	return typeof window.matchMedia === 'function' && window.matchMedia(reducedMotionQuery).matches;
}

function tokenValue(name: string): string {
	return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** How long a movement of this speed takes, in milliseconds; 0 when motion is reduced. */
export function motionDuration(speed: MotionSpeed = 'medium'): number {
	if (motionReduced()) return 0;
	return parseDuration(tokenValue(`--motion-duration-${speed}`));
}

/** The easing token as CSS text, for Web Animations. */
export function motionEasingText(easing: MotionEasing = 'standard'): string {
	if (!inBrowser()) return 'linear';
	return tokenValue(`--motion-easing-${easing}`) || 'linear';
}

const easingFunctions = new Map<string, (time: number) => number>();

/** The easing token as a function, for Svelte transitions and glides. */
export function motionEasing(easing: MotionEasing = 'standard'): (time: number) => number {
	const text = motionEasingText(easing);
	let found = easingFunctions.get(text);
	if (!found) {
		const curve = parseCubicBezier(text);
		found = curve ? cubicBezier(...curve) : (time: number) => time;
		easingFunctions.set(text, found);
	}
	return found;
}

export interface MotionOptions {
	speed?: MotionSpeed;
	easing?: MotionEasing;
}

/* Svelte transitions. Use them as transition:fade, in:rise, and so on. */

/** Fades in or out. */
export function fade(node: Element, { speed = 'medium', easing = 'enter' }: MotionOptions = {}): TransitionConfig {
	return svelteFade(node, { duration: motionDuration(speed), easing: motionEasing(easing) });
}

/** Fades in while rising a few pixels into place, for small windows such as a citation's. */
export function rise(
	node: Element,
	{ speed = 'medium', easing = 'enter', distance = 4 }: MotionOptions & { distance?: number } = {}
): TransitionConfig {
	return fly(node, { y: distance, opacity: 0, duration: motionDuration(speed), easing: motionEasing(easing) });
}

/** Opens or closes by its height (or width, with axis "x"). */
export function slide(
	node: Element,
	{ speed = 'medium', easing = 'standard', axis = 'y' }: MotionOptions & { axis?: 'x' | 'y' } = {}
): TransitionConfig {
	return svelteSlide(node, { axis, duration: motionDuration(speed), easing: motionEasing(easing) });
}

/**
 * Moves an item in a keyed {#each} list from its old place to its new one,
 * as animate:move, so a reader sees what moved when a list is filtered or
 * sorted.
 */
export function move(
	node: Element,
	places: { from: DOMRect; to: DOMRect },
	{ speed = 'medium', easing = 'standard' }: MotionOptions = {}
): AnimationConfig {
	return flip(node, places, { duration: motionDuration(speed), easing: motionEasing(easing) });
}

/* Script animations. */

/** Runs Web Animations keyframes with the site's timing; nothing runs when motion is reduced. */
export function animate(
	element: Element,
	keyframes: Keyframe[],
	{ speed = 'medium', easing = 'standard' }: MotionOptions = {}
): Animation | undefined {
	const duration = motionDuration(speed);
	if (!duration || typeof element.animate !== 'function') return undefined;
	return element.animate(keyframes, { duration, easing: motionEasingText(easing) });
}

/** Glides that are still moving, each with the function that ends it at its destination. */
const glides = new Set<() => void>();

/**
 * Moves a list of numbers, such as a map's viewBox, from one value to
 * another, calling draw on each frame. CSS cannot animate an SVG's viewBox,
 * which is why this exists. With motion reduced, draw is called once with
 * the destination. Returns a function that stops the glide where it is, for
 * when the reader starts a new movement before it ends.
 */
export function glide(
	from: readonly number[],
	to: readonly number[],
	draw: (values: number[]) => void,
	{ speed = 'medium', easing = 'standard' }: MotionOptions = {}
): () => void {
	const duration = motionDuration(speed);
	if (!duration || typeof requestAnimationFrame !== 'function') {
		draw([...to]);
		return () => {};
	}
	const ease = motionEasing(easing);
	const start = performance.now();
	let frame = 0;
	let ended = false;
	const end = (atDestination: boolean) => {
		if (ended) return;
		ended = true;
		cancelAnimationFrame(frame);
		glides.delete(finish);
		if (atDestination) draw([...to]);
	};
	const finish = () => end(true);
	const step = (now: number) => {
		const time = (now - start) / duration;
		if (time >= 1) return finish();
		draw(between(from, to, ease(time)));
		frame = requestAnimationFrame(step);
	};
	glides.add(finish);
	frame = requestAnimationFrame(step);
	return () => end(false);
}

/** Ends every glide and Web Animation at its end state, as before printing. */
export function finishMotion(): void {
	for (const finish of [...glides]) finish();
	if (!inBrowser() || typeof document.getAnimations !== 'function') return;
	for (const animation of document.getAnimations()) {
		try {
			animation.finish();
		} catch {
			// An animation with no end, such as a looping one, cannot finish; it stops on paper anyway.
		}
	}
}

/**
 * Cross-fades from one page to the next, through the browser's View
 * Transitions, for SvelteKit's onNavigate. Changes within one page, such as
 * a new search or another map view, do not fade. Browsers without View
 * Transitions change pages as before.
 */
export function crossFadePages(navigation: OnNavigate): Promise<void> | undefined {
	if (!inBrowser() || typeof document.startViewTransition !== 'function' || motionReduced()) return undefined;
	if (!navigation.to || navigation.from?.url.pathname === navigation.to.url.pathname) return undefined;
	return new Promise((resolve) => {
		document.startViewTransition(async () => {
			resolve();
			await navigation.complete;
		});
	});
}

/** Starts the site-wide parts of motion: finishing everything before printing. Returns a function that stops them. */
export function startMotion(): () => void {
	if (!inBrowser()) return () => {};
	window.addEventListener('beforeprint', finishMotion);
	return () => window.removeEventListener('beforeprint', finishMotion);
}
