<script lang="ts">
	// Lets a reader zoom into and move around a map that was drawn when the
	// site was built (src/lib/map-zoom.ts does the arithmetic). Trevor asked for
	// it on 2026-11-22. It changes only the SVG's viewBox, so it adds no map
	// tiles, fetches nothing, tracks no one and works offline. Without scripts
	// the map stays as it was drawn, and the buttons are not shown.
	//
	// Ways to zoom and move, so no reader depends on one of them:
	// - the zoom in, zoom out and reset buttons;
	// - the keys + and - to zoom, the arrow keys to move, 0 to reset, whenever
	//   focus is anywhere in the map;
	// - the scroll wheel over the map, or a trackpad pinch, to zoom around the
	//   pointer (Trevor, 2026-11-23: the wheel over the map zooms the map; once
	//   the map is back at its whole size, the wheel scrolls the page again);
	// - a two-finger pinch on a touch screen, and dragging once zoomed in.
	//
	// The drawing's text, dots and lines are sized with --map-unzoom, so they
	// keep their size on screen while the shapes grow (see the map styles).
	// Printing always prints the whole map.
	import type { Snippet } from 'svelte';
	import { onMount } from 'svelte';
	import Minus from '@lucide/svelte/icons/minus';
	import Plus from '@lucide/svelte/icons/plus';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import {
		centerOn,
		formatViewBox,
		moveBy,
		parseViewBox,
		screenToMap,
		zoomBy,
		zoomOf,
		type MapView
	} from '#lib/map-zoom.ts';
	import { glide } from '#lib/motion.ts';

	let {
		label,
		maximum = 8,
		children
	}: {
		/** What the map is, for the controls' group name, such as "Map of nations by state". */
		label: string;
		/** The most the map can be enlarged, as a multiple of its full size. */
		maximum?: number;
		children: Snippet;
	} = $props();

	/** Each press of a zoom button or key. */
	const step = 1.6;

	let surface: HTMLDivElement | undefined = $state();
	let hasMap = $state(false);
	let zoom = $state(1);
	const hintId = `map-keys-${Math.random().toString(36).slice(2, 8)}`;

	/** The drawing, and the whole of it as it was built, read once from its viewBox. */
	function drawing(): { svg: SVGSVGElement; full: MapView; view: MapView } | undefined {
		const svg = surface?.querySelector('svg');
		if (!svg) return undefined;
		svg.dataset.fullView ??= svg.getAttribute('viewBox') ?? '';
		const full = parseViewBox(svg.dataset.fullView);
		if (!full) return undefined;
		return { svg, full, view: parseViewBox(svg.getAttribute('viewBox')) ?? full };
	}

	/** Where a glide under way is going, and how to stop it. */
	let heading: { view: MapView; stop: () => void } | undefined;

	function draw(svg: SVGSVGElement, full: MapView, view: MapView): void {
		svg.setAttribute('viewBox', formatViewBox(view));
		svg.style.setProperty('--map-unzoom', String(1 / zoomOf(full, view)));
	}

	/**
	 * Shows part of the map. A button, key or tab glides there, so the reader
	 * sees where the map went (site/DESIGN.md, section 6, "Motion"); a drag,
	 * pinch or scroll follows the hand at once. A new movement stops a glide
	 * where it is.
	 */
	function show(next: MapView, { glides = false } = {}): void {
		const map = drawing();
		if (!map) return;
		heading?.stop();
		heading = undefined;
		zoom = zoomOf(map.full, next);
		if (!glides) {
			draw(map.svg, map.full, next);
			return;
		}
		const from = map.view;
		const stop = glide(
			[from.x, from.y, from.width, from.height],
			[next.x, next.y, next.width, next.height],
			([x, y, width, height]) => draw(map.svg, map.full, { x, y, width, height })
		);
		heading = { view: next, stop };
	}

	const zoomIn = () => change((full, view) => zoomBy(full, view, step, maximum));
	const zoomOut = () => change((full, view) => zoomBy(full, view, 1 / step, maximum));
	const reset = () => change((full) => full);

	/** A button or key press: it starts from where any glide under way is going. */
	function change(how: (full: MapView, view: MapView) => MapView): void {
		const map = drawing();
		if (map) show(how(map.full, heading?.view ?? map.view), { glides: true });
	}

	function onKey(event: KeyboardEvent): void {
		if (event.ctrlKey || event.metaKey || event.altKey) return;
		const moves: Record<string, [number, number]> = {
			ArrowLeft: [-1, 0],
			ArrowRight: [1, 0],
			ArrowUp: [0, -1],
			ArrowDown: [0, 1]
		};
		if (event.key === '+' || event.key === '=') zoomIn();
		else if (event.key === '-' || event.key === '_') zoomOut();
		else if (event.key === '0') reset();
		// When the map is not zoomed there is nothing to move, so the arrows
		// keep scrolling the page.
		else if (event.key in moves && zoom > 1) {
			const [across, down] = moves[event.key];
			change((full, view) => moveBy(full, view, across * view.width * 0.15, down * view.height * 0.15));
		} else return;
		event.preventDefault();
	}

	/** Brings a place the reader tabbed to into view when the map is zoomed. */
	function onFocusIn(event: FocusEvent): void {
		const map = drawing();
		const target = event.target as Element | null;
		if (!map || zoom <= 1 || !target || !map.svg.contains(target)) return;
		const place = target.getBoundingClientRect();
		const box = map.svg.getBoundingClientRect();
		const inside =
			place.left >= box.left && place.right <= box.right && place.top >= box.top && place.bottom <= box.bottom;
		if (inside) return;
		const middle = screenToMap(map.view, box, place.left + place.width / 2, place.top + place.height / 2);
		show(centerOn(map.full, map.view, middle), { glides: true });
	}

	function onWheel(event: WheelEvent): void {
		const map = drawing();
		if (!map) return;
		const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 400 : 1;
		const delta = event.deltaY * unit;
		// Scrolling out of a map already at its whole size scrolls the page, so the map never traps a reader moving down the page.
		if (delta > 0 && map.view.width >= map.full.width - 0.001 && !event.ctrlKey) return;
		event.preventDefault();
		// A wheel click is about 100 units; a pinch sends many small steps.
		const amount = Math.max(-0.5, Math.min(0.5, delta * (Math.abs(delta) >= 40 ? 0.002 : 0.01)));
		const point = screenToMap(map.view, map.svg.getBoundingClientRect(), event.clientX, event.clientY);
		show(zoomBy(map.full, map.view, Math.exp(-amount), maximum, point));
	}

	// Pointers that are down on the map, by id, at their last position.
	const pointers = new Map<number, { x: number; y: number }>();
	let start: { x: number; y: number } | undefined;
	let dragging = false;
	let swallowClick = false;

	function onPointerDown(event: PointerEvent): void {
		if (event.pointerType === 'mouse' && event.button !== 0) return;
		swallowClick = false;
		pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
		start = { x: event.clientX, y: event.clientY };
		if (pointers.size === 1) dragging = false;
	}

	function onPointerMove(event: PointerEvent): void {
		const last = pointers.get(event.pointerId);
		const map = drawing();
		if (!last || !map || !surface) return;
		const box = map.svg.getBoundingClientRect();
		const here = { x: event.clientX, y: event.clientY };
		if (pointers.size === 1) {
			if (zoom <= 1) return;
			// A press that barely moves is still a click on a place.
			if (!dragging && start && Math.hypot(here.x - start.x, here.y - start.y) < 5) return;
			if (!dragging) {
				dragging = true;
				surface.setPointerCapture(event.pointerId);
			}
			const scale = map.view.width / box.width;
			show(moveBy(map.full, map.view, (last.x - here.x) * scale, (last.y - here.y) * scale));
		} else if (pointers.size === 2) {
			const other = [...pointers.entries()].find(([id]) => id !== event.pointerId)?.[1];
			if (!other) return;
			if (!dragging) {
				dragging = true;
				for (const id of pointers.keys()) surface.setPointerCapture(id);
			}
			const before = { x: (last.x + other.x) / 2, y: (last.y + other.y) / 2 };
			const after = { x: (here.x + other.x) / 2, y: (here.y + other.y) / 2 };
			const spread = Math.hypot(last.x - other.x, last.y - other.y);
			const factor = spread > 0 ? Math.hypot(here.x - other.x, here.y - other.y) / spread : 1;
			const zoomed = zoomBy(map.full, map.view, factor, maximum, screenToMap(map.view, box, before.x, before.y));
			const scale = zoomed.width / box.width;
			show(moveBy(map.full, zoomed, (before.x - after.x) * scale, (before.y - after.y) * scale));
		}
		pointers.set(event.pointerId, here);
	}

	function onPointerUp(event: PointerEvent): void {
		pointers.delete(event.pointerId);
		if (pointers.size === 0) {
			// The click that ends a drag must not follow the link under it.
			swallowClick = dragging;
			dragging = false;
		}
	}

	function onClickCapture(event: MouseEvent): void {
		if (!swallowClick) return;
		swallowClick = false;
		event.preventDefault();
		event.stopPropagation();
	}

	// Safari sends trackpad pinches as gesture events. On phones and tablets
	// the pointer events above already handle the pinch.
	let gestureScale = 1;
	function onGesture(event: Event & { scale?: number; clientX?: number; clientY?: number }): void {
		event.preventDefault();
		const map = drawing();
		if (event.type === 'gesturestart') gestureScale = 1;
		if (!map || event.type !== 'gesturechange' || pointers.size >= 2 || !event.scale) return;
		const point =
			event.clientX === undefined || event.clientY === undefined
				? undefined
				: screenToMap(map.view, map.svg.getBoundingClientRect(), event.clientX, event.clientY);
		show(zoomBy(map.full, map.view, event.scale / gestureScale, maximum, point));
		gestureScale = event.scale;
	}

	onMount(() => {
		const element = surface;
		if (!element) return;
		let current = drawing()?.svg;
		hasMap = Boolean(current);
		// A drawing fetched later, such as the land areas, starts at full size.
		const observer = new MutationObserver(() => {
			const svg = drawing()?.svg;
			if (svg === current) return;
			current = svg;
			hasMap = Boolean(svg);
			zoom = 1;
		});
		observer.observe(element, { childList: true, subtree: true });
		element.addEventListener('wheel', onWheel, { passive: false });
		for (const type of ['gesturestart', 'gesturechange', 'gestureend']) element.addEventListener(type, onGesture);
		// Printing shows the whole map, then the reader's view comes back.
		let kept: MapView | undefined;
		const beforePrint = () => {
			const map = drawing();
			kept = map?.view;
			if (map) show(map.full);
		};
		const afterPrint = () => {
			if (kept) show(kept);
			kept = undefined;
		};
		window.addEventListener('beforeprint', beforePrint);
		window.addEventListener('afterprint', afterPrint);
		return () => {
			observer.disconnect();
			element.removeEventListener('wheel', onWheel);
			for (const type of ['gesturestart', 'gesturechange', 'gestureend']) element.removeEventListener(type, onGesture);
			window.removeEventListener('beforeprint', beforePrint);
			window.removeEventListener('afterprint', afterPrint);
		};
	});
</script>

<!-- The keys work from anywhere in the map, including its links and buttons. -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="zoomable-map" onkeydown={onKey} onfocusin={onFocusIn}>
	{#if hasMap}
		<div class="map-zoom-controls needs-scripts no-print" role="group" aria-label="Zoom: {label}" aria-describedby={hintId}>
			<button class="icon-button" type="button" aria-label="Zoom in" title="Zoom in (+)" disabled={zoom >= maximum - 0.001} onclick={zoomIn}>
				<Plus aria-hidden="true" />
			</button>
			<button class="icon-button" type="button" aria-label="Zoom out" title="Zoom out (−)" disabled={zoom <= 1.001} onclick={zoomOut}>
				<Minus aria-hidden="true" />
			</button>
			<button class="icon-button" type="button" aria-label="Show the whole map" title="Show the whole map (0)" disabled={zoom <= 1.001} onclick={reset}>
				<RotateCcw aria-hidden="true" />
			</button>
		</div>
		<p id={hintId} class="visually-hidden">
			Plus and minus zoom the map, the arrow keys move it once zoomed in, and 0 shows the whole map.
		</p>
	{/if}
	<!-- Once zoomed in, the map itself takes focus, so a keyboard user can move it without tabbing to a place. -->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<div
		class="map-surface"
		class:zoomed={zoom > 1.001}
		bind:this={surface}
		role={zoom > 1.001 ? 'group' : undefined}
		aria-label={zoom > 1.001 ? `${label}, zoomed in` : undefined}
		aria-describedby={zoom > 1.001 ? hintId : undefined}
		tabindex={zoom > 1.001 ? 0 : undefined}
		onpointerdown={onPointerDown}
		onpointermove={onPointerMove}
		onpointerup={onPointerUp}
		onpointercancel={onPointerUp}
		onclickcapture={onClickCapture}
	>
		{@render children()}
	</div>
</div>

<style>
	.zoomable-map {
		position: relative;
	}

	.map-zoom-controls {
		display: flex;
		justify-content: flex-end;
		gap: var(--space-1);
		margin-bottom: var(--space-1);
	}

	.map-zoom-controls button:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.map-zoom-controls button:disabled:hover {
		background: transparent;
	}

	.map-surface {
		position: relative;
		/* One finger still scrolls the page; two fingers zoom the map. */
		touch-action: pan-x pan-y;
		user-select: none;
		-webkit-user-select: none;
		overflow: hidden;
	}

	/* Zoomed in, one finger or the mouse moves the map, and a thin line marks
	   where the map is cut off. */
	.map-surface.zoomed {
		touch-action: none;
		cursor: grab;
		box-shadow: 0 0 0 1px var(--color-line);
	}

	.map-surface.zoomed:active {
		cursor: grabbing;
	}

	.map-surface:focus-visible {
		outline: 3px solid var(--color-focus);
		outline-offset: 2px;
	}


	@media print {
		.map-surface {
			overflow: visible;
		}
	}
</style>
