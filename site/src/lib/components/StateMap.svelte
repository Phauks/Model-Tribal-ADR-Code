<!--
	@component
	The map on a state's page: the Map page's Land Areas map, with its Layers button and corner buttons, opened on the state (Trevor, 2026-11-24: "if you go to the alaska tribe map, or any state, generate the map and zoom into that state"). Choosing a land area or an office opens it on the Map page, where its details are. Without a device that can draw it, the page has its table of nations alone.
-->
<script lang="ts">
	import TileMap from './TileMap.svelte';
	import { landAreaGroups } from '#lib/nations-map-drawing.ts';

	let { name, bounds }: { name: string; bounds: [number, number, number, number] } = $props();

	let wanted = $state(true);
	let ready = $state(false);
</script>

{#if wanted}
	<figure class="state-map" class:ready data-print-part="maps">
		<TileMap
			view="lands"
			label="Land areas in {name}"
			opening={bounds}
			onselect={(anchor) => location.assign(anchor.startsWith('/') ? anchor : `/nations/map#${anchor}`)}
			onready={() => (ready = true)}
			onfail={() => (wanted = false)}
		/>
		<figcaption>
			<ul class="legend" aria-label="Key">
				{#each landAreaGroups as group (group.key)}
					<li><span class="swatch land-{group.key}" aria-hidden="true"></span>{group.label}</li>
				{/each}
				<li><span class="swatch office" aria-hidden="true"></span>Office of a nation with no Census land area</li>
			</ul>
		</figcaption>
	</figure>
{/if}

<style>
	/* The map fits in the window with its key, so its buttons are always in sight. */
	.state-map {
		max-width: min(975px, calc((100vh - 10rem) * 975 / 883));
		margin: var(--space-4) 0 var(--space-5);
	}

	/* The key waits for the map, so a device that cannot draw it never shows a key alone. */
	.state-map:not(.ready) figcaption {
		visibility: hidden;
	}

	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1) var(--space-4);
		margin: var(--space-2) 0 0;
		padding: 0;
		list-style: none;
		font-size: var(--font-size-small);
	}

	.legend li {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.swatch {
		display: inline-block;
		flex: none;
		width: 1.25rem;
		height: 1.25rem;
		border: 1px solid var(--color-control-border);
	}

	.swatch.land-federal {
		background: var(--color-map-class-4);
	}

	.swatch.land-state {
		background: var(--color-map-class-3);
	}

	.swatch.land-statistical {
		background: var(--color-map-class-2);
	}

	.swatch.office {
		border: 2px solid var(--color-ink);
		border-radius: 50%;
		background: var(--color-map-class-0);
	}

	@media print {
		.state-map {
			display: none;
		}
	}
</style>
