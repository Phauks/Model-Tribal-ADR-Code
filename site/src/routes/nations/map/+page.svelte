<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { replaceState } from '$app/navigation';
	import PageTools from '#lib/components/PageTools.svelte';
	import { repositoryLink } from '#lib';
	import DataTable from '#lib/components/DataTable.svelte';
	import SourceList from '#lib/components/SourceList.svelte';
	import type { NationsMapView } from '#lib/nations-map-drawing.ts';
	import type { TableColumn, TableRow } from '#lib/tables/table-definition.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	/**
	 * The views of the one map, in the order of their buttons. A new view needs
	 * an entry here, a drawing in src/lib/nations-map-drawing.ts and a snippet
	 * below for what goes under the map.
	 */
	const views: { key: NationsMapView; label: string; heading: string }[] = [
		{ key: 'states', label: 'Nations by state', heading: 'by-state-heading' },
		{ key: 'regions', label: 'Bureau of Indian Affairs regions', heading: 'bureau-of-indian-affairs-regions' }
	];
	let current = $state<NationsMapView>('states');
	let tabs: HTMLButtonElement[] = $state([]);

	function choose(index: number, remember = true): void {
		const view = views[(index + views.length) % views.length];
		current = view.key;
		tabs[views.indexOf(view)]?.focus();
		if (remember) replaceState(view.key === views[0].key ? '' : `?view=${view.key}`, {});
	}

	function onTabKey(event: KeyboardEvent, index: number): void {
		const moves: Record<string, number> = {
			ArrowRight: index + 1,
			ArrowLeft: index - 1,
			Home: 0,
			End: views.length - 1
		};
		if (event.key in moves) {
			event.preventDefault();
			choose(moves[event.key]);
		}
	}

	/**
	 * Shows the view that holds the part of the page the address points to,
	 * such as a region's row linked from a nation's page, or the view named in
	 * "?view=" when the reader shared a view.
	 */
	async function showAddressedView(): Promise<void> {
		const target = location.hash ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null;
		const panel = target?.closest<HTMLElement>('[data-map-view]');
		const named = new URLSearchParams(location.search).get('view');
		const view = panel?.dataset.mapView ?? named;
		if (!view || !views.some((entry) => entry.key === view)) return;
		current = view as NationsMapView;
		if (target) {
			await tick();
			target.scrollIntoView();
		}
	}

	onMount(() => {
		void showAddressedView();
		const onHashChange = () => void showAddressedView();
		window.addEventListener('hashchange', onHashChange);
		return () => window.removeEventListener('hashchange', onHashChange);
	});

	type ListedNation = { id: string; name: string };
	const nationsByRow = $derived(
		new Map<string, ListedNation[]>([
			...data.stateRows.map((row) => [`state-${row.code}`, row.nations] as const),
			...data.regionRows.map((row) => [row.anchor, row.nations] as const)
		])
	);

	const stateColumns: TableColumn[] = [
		{ key: 'state', header: 'State or territory', isRowHeader: true, sortable: true },
		{ key: 'count', header: 'Nations', type: 'number', sortable: true },
		{ key: 'names', header: 'Names', custom: true }
	];
	const stateRows: TableRow[] = $derived(
		data.stateRows.map((row) => ({
			key: `state-${row.code}`,
			anchor: `state-${row.code}`,
			cells: {
				state: { text: row.name },
				count: { text: row.nations.length.toLocaleString('en-US'), sortValue: row.nations.length },
				names: { text: row.nations.map((nation) => nation.name).join(', ') }
			}
		}))
	);

	const regionColumns: TableColumn[] = [
		{ key: 'region', header: 'Region', isRowHeader: true, sortable: true },
		{ key: 'count', header: 'Nations', type: 'number', sortable: true },
		{ key: 'states', header: 'States where those nations have a presence' },
		{ key: 'names', header: 'Names', custom: true }
	];
	const regionRows: TableRow[] = $derived(
		data.regionRows.map((row) => ({
			key: row.anchor,
			anchor: row.anchor,
			cells: {
				region: { text: row.name },
				count: { text: row.nations.length.toLocaleString('en-US'), sortValue: row.nations.length },
				states: { text: row.states.join(', ') },
				names: { text: row.nations.map((nation) => nation.name).join(', ') }
			}
		}))
	);
</script>

{#snippet cell(row: TableRow)}
	{@const nations = nationsByRow.get(row.key) ?? []}
	<details>
		<summary>Show {nations.length === 1 ? 'the nation' : `all ${nations.length}`}</summary>
		<ul>
			{#each nations as nation (nation.id)}
				<li><a href="/nations/{nation.id}">{nation.name}</a></li>
			{/each}
		</ul>
	</details>
{/snippet}

<svelte:head>
	<title>Map · Nations · Model Tribal ADR Code</title>
	<!-- Without scripts the view buttons cannot work, so every view is shown, one after another. -->
	<noscript>
		<style>
			.map-view[hidden] {
				display: block !important;
			}
			.map-view-tabs {
				display: none !important;
			}
		</style>
	</noscript>
</svelte:head>

<nav aria-label="Breadcrumb" class="small">
	<a href="/nations">Nations</a> › Map
</nav>

<div class="reading">
	<h1>Map of Native nations</h1>
	<PageTools />
	<div class="notice" role="note">
		<h2 class="notice-heading">What this map shows</h2>
		<p>The map has more than one view. Choose one with the buttons above the map.</p>
		<ul>
			<li>
				<strong>Nations by state</strong> shades each state and territory by how many nations the project’s sources record as having a presence there. It draws no nation’s land. A nation with land or offices in several states is counted in each (<a href="{repositoryLink}/blob/main/docs/decisions/0007-map-shows-state-presence.md">decision record 0007</a>).
			</li>
			<li>
				<strong>Bureau of Indian Affairs regions</strong> shows the Bureau’s twelve regions as the Bureau draws them. They are the areas its regional offices serve, not the lands of any nation. The Navajo Region’s outline follows the Navajo Nation’s land, as the Bureau draws it.
			</li>
		</ul>
		<p>Alaska, Hawaiʻi and the five territories are drawn in boxes below the other states. Each box has its own scale, shown by its scale bar, and no box is in its true place. Each view has a table below the map with the same information.</p>
	</div>
</div>

<div class="map-view-tabs" role="tablist" aria-label="Map views">
	{#each views as view, index (view.key)}
		{@const isCurrent = view.key === current}
		<button
			bind:this={tabs[index]}
			type="button"
			role="tab"
			id="map-tab-{view.key}"
			aria-selected={isCurrent}
			aria-controls="map-view-{view.key}"
			tabindex={isCurrent ? 0 : -1}
			onclick={() => choose(index)}
			onkeydown={(event) => onTabKey(event, index)}
		>
			{view.label}
		</button>
	{/each}
</div>

{#each views as view (view.key)}
	<div
		class="map-view"
		id="map-view-{view.key}"
		data-map-view={view.key}
		role="tabpanel"
		aria-labelledby="map-tab-{view.key}"
		hidden={view.key !== current}
	>
		<h2 id={view.heading} class="view-heading">{view.label}</h2>
		<figure class="map-figure" data-print-part="maps">
			<div class="map-drawing" data-nations-map={view.key === 'states' ? '' : undefined}>
				<!-- svelte-ignore hydration_html_changed -->
				{@html data.drawings[view.key]}
			</div>
			{#if view.key === 'states'}
				<figcaption>
					<ul class="legend" aria-label="Key">
						{#each data.countClasses as entry (entry.key)}
							<li><span class="swatch count-{entry.key}" aria-hidden="true"></span>{entry.label}</li>
						{/each}
					</ul>
					<p class="small muted">
						Select a state to go to its row in the table. Each nation’s states, with their sources, are on the nation’s own page. {@render insetNote()}
					</p>
				</figcaption>
			{:else if view.key === 'regions'}
				<figcaption class="small muted">
					Select a region to go to its row in the table. Hawaiʻi and the territories are in no region. Lines are simplified for a national map. {@render insetNote()}
				</figcaption>
			{/if}
		</figure>
		{#if view.key === 'states'}
			<DataTable
				identifier="nations-by-state"
				label="Table: nations by state"
				caption="Nations with a recorded presence, by state and territory"
				columns={stateColumns}
				rows={stateRows}
				defaultSort={{ key: 'state', direction: 'ascending' }}
				{cell}
			/>
		{:else if view.key === 'regions'}
			<DataTable
				identifier="regions"
				label="Table: regions"
				caption="Nations each region serves, as the Bureau’s Tribal Leaders Directory lists them"
				columns={regionColumns}
				rows={regionRows}
				defaultSort={{ key: 'region', direction: 'ascending' }}
				{cell}
			/>
		{/if}
	</div>
{/each}

{#snippet insetNote()}
	Alaska, Hawaiʻi and the territories are in the boxes below, each drawn at its own scale and not in its true place.
{/snippet}

<div class="reading">
	<SourceList sources={data.sources} />
</div>

<style>
	.map-view-tabs {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin: var(--space-5) 0 var(--space-3);
		border-bottom: 1px solid var(--color-line);
	}

	.map-view-tabs button {
		min-height: var(--layout-target-minimum);
		padding: var(--space-2) var(--space-4);
		border: 0;
		border-bottom: 4px solid transparent;
		background: transparent;
		color: var(--color-ink);
		font: inherit;
		cursor: pointer;
	}

	.map-view-tabs button:hover {
		text-decoration: underline;
	}

	/* The chosen view is marked by weight and a bar, not color alone. */
	.map-view-tabs button[aria-selected='true'] {
		border-bottom-color: var(--color-action);
		font-weight: var(--font-weight-bold);
	}

	/* The buttons already name the view; the heading stays for screen readers, outlines and print. */
	.view-heading {
		position: absolute;
		width: 1px;
		height: 1px;
		margin: -1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}

	@media print {
		.map-view-tabs {
			display: none;
		}

		.map-view[hidden] {
			display: block;
		}

		.view-heading {
			position: static;
			width: auto;
			height: auto;
			margin: var(--space-5) 0 0;
			overflow: visible;
			clip-path: none;
			white-space: normal;
		}
	}

	.notice-heading {
		font-size: var(--font-size-body);
		margin-top: 0;
	}

	.map-figure {
		margin: var(--space-5) 0;
	}

	.map-drawing :global(.map) {
		display: block;
		width: 100%;
		height: auto;
		max-width: 975px;
	}

	.map-drawing :global(.state),
	.swatch {
		stroke: var(--color-control-border);
		stroke-width: 0.5;
	}

	.map-drawing :global(.count-0) {
		fill: var(--color-map-class-0);
	}
	.swatch.count-0 {
		background: var(--color-map-class-0);
	}
	.map-drawing :global(.count-1) {
		fill: var(--color-map-class-1);
	}
	.swatch.count-1 {
		background: var(--color-map-class-1);
	}
	.map-drawing :global(.count-2) {
		fill: var(--color-map-class-2);
	}
	.swatch.count-2 {
		background: var(--color-map-class-2);
	}
	.map-drawing :global(.count-3) {
		fill: var(--color-map-class-3);
	}
	.swatch.count-3 {
		background: var(--color-map-class-3);
	}
	.map-drawing :global(.count-4) {
		fill: var(--color-map-class-4);
	}
	.swatch.count-4 {
		background: var(--color-map-class-4);
	}

	.map-drawing :global(.land) {
		fill: var(--color-map-class-0);
		stroke: var(--color-control-border);
		stroke-width: 0.5;
	}

	.map-drawing :global(.region) {
		fill: var(--color-map-class-1);
	}

	.map-drawing :global(a:hover .state),
	.map-drawing :global(a:focus .state),
	.map-drawing :global(a:hover .region),
	.map-drawing :global(a:focus .region) {
		fill: var(--color-focus);
	}

	.map-drawing :global(.state-borders) {
		fill: none;
		stroke: var(--color-control-border);
		stroke-width: 0.6;
		stroke-linejoin: round;
	}

	.map-drawing :global(.state-borders.faint) {
		stroke: var(--color-line);
	}

	.map-drawing :global(.region-borders) {
		fill: none;
		stroke: var(--color-ink);
		stroke-width: 1.6;
		stroke-linejoin: round;
	}

	.map-drawing :global(.marker-line) {
		stroke: var(--color-ink-muted);
		stroke-width: 0.8;
	}

	.map-drawing :global(.map-label) {
		fill: var(--color-ink);
		font-family: var(--font-family-reading);
		paint-order: stroke;
		stroke: var(--color-paper);
		stroke-width: 3px;
		stroke-linejoin: round;
	}

	.map-drawing :global(.marker-label) {
		font-size: 16px;
	}

	.map-drawing :global(.label-on-left) {
		text-anchor: end;
	}

	.map-drawing :global(.inset-frame) {
		fill: none;
		stroke: var(--color-control-border);
		stroke-width: 1;
	}

	.map-drawing :global(.inset-label) {
		font-size: 14px;
		font-weight: var(--font-weight-semibold);
	}

	.map-drawing :global(.scale-bar) {
		fill: none;
		stroke: var(--color-ink);
		stroke-width: 1.5;
	}

	.map-drawing :global(.scale-label) {
		font-size: 13px;
	}

	.map-drawing :global(.region-label) {
		font-size: 17px;
		font-weight: var(--font-weight-semibold);
		text-anchor: middle;
	}

	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2) var(--space-5);
		list-style: none;
		padding: 0;
		margin: var(--space-3) 0;
	}

	.legend li {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.swatch {
		display: inline-block;
		width: 1.25rem;
		height: 1.25rem;
		border: 1px solid var(--color-control-border);
	}
</style>
