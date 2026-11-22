<script lang="ts">
	// A small map on each nation's page that shades the states and territories
	// where the project's sources record the nation's presence. It draws no
	// nation's land (decision record 0007; site/DESIGN.md, "Nation pages").
	// The shapes are projected when the site is built, so the browser gets only
	// SVG paths (src/lib/map-geometry.ts). The same states are listed in words
	// under "At a glance", so the map is never the only way to the facts.
	import type { MapFrame, StateShape } from '#lib/map-geometry.ts';

	interface PresenceMap {
		width: number;
		height: number;
		/** The framed boxes: the contiguous United States, then Alaska, Hawaiʻi and the territories, each at its own scale. */
		frames: Pick<MapFrame, 'key' | 'x' | 'y' | 'width' | 'height'>[];
		stateNames: string[];
		states: (StateShape & { name: string; present: boolean })[];
	}

	let { map, nationName }: { map: PresenceMap; nationName: string } = $props();

	const title = $derived(
		`Map. States and territories where sources record a presence of ${nationName}: ${map.stateNames.join(', ')}.`
	);
</script>

<figure class="presence-map" data-print-part="maps">
	<svg viewBox="0 0 {map.width} {map.height}" role="img" aria-labelledby="presence-map-title">
		<title id="presence-map-title">{title}</title>
		<g aria-hidden="true">
			{#each map.frames as frame (frame.key)}
				<rect class="inset-frame" x={frame.x} y={frame.y} width={frame.width} height={frame.height} rx="3" />
			{/each}
		</g>
		{#each map.states as state (state.code)}
			<path class={state.present ? 'state present' : 'state'} d={state.path} />
		{/each}
		<g aria-hidden="true">
			{#each map.states as state (state.code)}
				{#if state.present}
					{#if state.marker}
						{@const marker = state.marker}
						<line class="marker-line" x1={marker.fromX} y1={marker.fromY} x2={marker.x} y2={marker.y} />
						<circle class="state present" cx={marker.x} cy={marker.y} r="10" />
						{#if marker.labelSide === 'left'}
							<text class="label on-left" x={marker.x - 14} y={marker.y + 8}>{state.code}</text>
						{:else}
							<text class="label" x={marker.x + 14} y={marker.y + 8}>{state.code}</text>
						{/if}
					{:else if state.center}
						<text class="label centered" x={state.center.x} y={state.center.y + 8}>{state.code}</text>
					{/if}
				{/if}
			{/each}
		</g>
	</svg>
	<figcaption>
		<p class="key">
			<span class="swatch" aria-hidden="true"></span>
			States and territories where sources record a presence
		</p>
		<p class="small muted">
			The map shows states, not the nation’s land. Alaska, Hawaiʻi and the territories are in the boxes at the bottom, each at its own scale. <a href="/nations/map">Map of all nations by state</a>.
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

	.inset-frame {
		fill: none;
		stroke: var(--color-control-border);
		stroke-width: 2;
	}

	.state {
		fill: var(--color-map-class-0);
		stroke: var(--color-control-border);
		stroke-width: 1;
		stroke-linejoin: round;
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
		stroke-width: 1.5;
	}

	/* State codes beside the shading, so color is never the only cue (DESIGN.md, section 7). */
	.label {
		fill: var(--color-ink);
		font-family: var(--font-family-reading);
		font-size: 24px;
		font-weight: var(--font-weight-bold);
		paint-order: stroke;
		stroke: var(--color-paper);
		stroke-width: 5px;
		stroke-linejoin: round;
	}

	/*
	 * A code drawn on its shaded state is set in paper with an ink halo, so it
	 * keeps its contrast against the shading at any size the map is drawn
	 * (WCAG 1.4.3); codes beside a marker sit on paper and stay in ink.
	 */
	.label.centered {
		text-anchor: middle;
		/* color too: contrast checkers read it, not fill, for SVG text. */
		color: var(--color-paper);
		fill: var(--color-paper);
		stroke: var(--color-ink);
	}

	.label.on-left {
		text-anchor: end;
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
