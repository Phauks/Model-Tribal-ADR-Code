<script lang="ts">
	// A small map on each nation's page that shades the states and territories
	// where the project's sources record the nation's presence. It draws no
	// nation's land (site/DESIGN.md, "Nation pages"). It shows only the boxes
	// that hold the nation's states, the contiguous United States zoomed to
	// them (src/lib/presence-map.ts). The shapes are projected when the site is
	// built, so the browser gets only SVG paths (src/lib/map-geometry.ts). The
	// same states are listed in words under "At a glance", so the map is never
	// the only way to the facts.
	import type { PresenceMapLayout } from '#lib/presence-map.ts';
	import ZoomableMap from './ZoomableMap.svelte';

	let { map, nationName }: { map: PresenceMapLayout & { stateNames: string[] }; nationName: string } = $props();

	const title = $derived(
		`Map. States and territories where sources record a presence of ${nationName}: ${map.stateNames.join(', ')}.`
	);
	const separateBoxes = $derived(map.boxes.length > 1);
</script>

<figure class="presence-map" data-print-part="maps">
	<div class="drawing" style:max-width="{map.shareOfFullWidth * 100}%">
		<ZoomableMap label="Map of {nationName}’s states and territories">
			<svg
				viewBox="0 0 {map.width} {map.height}"
				role="img"
				aria-labelledby="presence-map-title"
			>
				<title id="presence-map-title">{title}</title>
				<defs>
					{#each map.boxes as box (box.key)}
						<clipPath id="presence-box-{box.key}">
							<rect x={box.x} y={box.y} width={box.width} height={box.height} rx="3" />
						</clipPath>
					{/each}
				</defs>
				{#each map.boxes as box (box.key)}
					<g clip-path="url(#presence-box-{box.key})">
						<g transform={box.transform}>
							{#each box.states as state (state.code)}
								<path class={state.present ? 'state present' : 'state'} d={state.path} />
							{/each}
						</g>
					</g>
					<rect class="inset-frame" x={box.x} y={box.y} width={box.width} height={box.height} rx="3" aria-hidden="true" />
				{/each}
				<g aria-hidden="true">
					{#each map.labels as label (label.code)}
						{#if label.marker}
							{@const marker = label.marker}
							<line class="marker-line" x1={marker.fromX} y1={marker.fromY} x2={marker.x} y2={marker.y} />
							<circle class="state present" cx={marker.x} cy={marker.y} r="10" />
						{/if}
						<text class="label" class:on-state={!label.marker} text-anchor={label.align} x={label.x} y={label.y}>{label.code}</text>
					{/each}
				</g>
			</svg>
		</ZoomableMap>
	</div>
	<figcaption>
		<p class="key">
			<span class="swatch" aria-hidden="true"></span>
			States and territories where sources record a presence
		</p>
		<p class="small muted">
			The map shows states, not the nation’s land{#if map.zoomed}, and is zoomed to the part of the country around them{/if}.{#if separateBoxes}
				Each box has its own scale and is not in its true place.{/if}
			<a href="/nations/map">Map of all nations by state</a>.
		</p>
	</figcaption>
</figure>

<style>
	.presence-map {
		margin: 0 0 var(--space-5);
	}

	svg {
		display: block;
		width: 100%;
		height: auto;
	}

	/* Line widths, text and dots are multiplied by --map-unzoom, which zooming
	   sets to 1 divided by the zoom (ZoomableMap.svelte), so they keep their
	   size on screen while the shapes grow. */
	.inset-frame {
		fill: none;
		stroke: var(--color-control-border);
		stroke-width: calc(2px * var(--map-unzoom, 1));
	}

	circle.state {
		r: calc(10px * var(--map-unzoom, 1));
	}

	/* Strokes keep their width when a box is zoomed. */
	.state {
		fill: var(--color-map-class-0);
		stroke: var(--color-control-border);
		stroke-width: 0.75;
		stroke-linejoin: round;
		vector-effect: non-scaling-stroke;
	}

	.state.present,
	.swatch {
		fill: var(--color-map-class-3);
		background: var(--color-map-class-3);
		stroke: var(--color-ink);
		stroke-width: 1.5;
	}

	.marker-line {
		stroke: var(--color-ink-muted);
		stroke-width: calc(1.5px * var(--map-unzoom, 1));
	}

	/* State codes beside the shading, so color is never the only cue (DESIGN.md, section 7). */
	.label {
		fill: var(--color-ink);
		font-family: var(--font-family-reading);
		font-size: calc(24px * var(--map-unzoom, 1));
		font-weight: var(--font-weight-bold);
		paint-order: stroke;
		stroke: var(--color-paper);
		stroke-width: calc(5px * var(--map-unzoom, 1));
		stroke-linejoin: round;
	}

	/*
	 * A code drawn on its shaded state is set in paper with an ink halo, so it
	 * keeps its contrast against the shading at any size the map is drawn
	 * (WCAG 1.4.3); codes beside a marker sit on paper and stay in ink.
	 */
	.label.on-state {
		/* color too: contrast checkers read it, not fill, for SVG text. */
		color: var(--color-paper);
		fill: var(--color-paper);
		stroke: var(--color-ink);
	}

	figcaption {
		margin-top: var(--space-2);
	}

	.key {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin: 0 0 var(--space-1);
		font-size: var(--font-size-small);
	}

	.swatch {
		display: inline-block;
		flex: none;
		width: 1.25rem;
		height: 1.25rem;
		border: 1px solid var(--color-ink);
	}

	figcaption .small {
		margin: 0;
	}
</style>
