<script lang="ts">
	import PageTools from '#lib/components/PageTools.svelte';
	import { repositoryLink } from '#lib';
	import DataTable from '#lib/components/DataTable.svelte';
	import SourceList from '#lib/components/SourceList.svelte';
	import type { TableColumn, TableRow } from '#lib/tables/table-definition.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

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
</svelte:head>

<nav aria-label="Breadcrumb" class="small">
	<a href="/nations">Nations</a> › Map
</nav>

<div class="reading">
	<h1>Map of Native nations</h1>
	<PageTools />
	<div class="notice" role="note">
		<h2 class="notice-heading">What this map shows</h2>
		<p>
			The first map shades each state and territory by how many nations the project’s sources
			record as having a presence there. It draws no nation’s land: a nation with land or offices in
			several states is counted in each
			(<a href="{repositoryLink}/blob/main/docs/decisions/0007-map-shows-state-presence.md"
				>decision record 0007</a
			>).
		</p>
		<p>
			The second map shows the twelve regions of the Bureau of Indian Affairs, as the Bureau draws
			them. They are the areas its regional offices serve, not the lands of any nation. The Navajo
			Region’s outline follows the Navajo Nation’s land, as the Bureau draws it.
		</p>
		<p>Each map has a table below it with the same information.</p>
	</div>
</div>

<section aria-labelledby="by-state-heading">
	<h2 id="by-state-heading">Nations by state</h2>
	<figure class="map-figure" data-print-part="maps">
		<div class="map-drawing" data-nations-map>
			<!-- svelte-ignore hydration_html_changed -->
			{@html data.drawings.states}
		</div>
		<figcaption>
			<ul class="legend" aria-label="Key">
				{#each data.countClasses as entry (entry.key)}
					<li><span class="swatch count-{entry.key}" aria-hidden="true"></span>{entry.label}</li>
				{/each}
			</ul>
			<p class="small muted">
				Select a state to go to its row in the table. Each nation’s states, with their sources, are on
				the nation’s own page.
			</p>
		</figcaption>
	</figure>

	<DataTable
		identifier="nations-by-state"
		label="Table: nations by state"
		caption="Nations with a recorded presence, by state and territory"
		columns={stateColumns}
		rows={stateRows}
		defaultSort={{ key: 'state', direction: 'ascending' }}
		{cell}
	/>
</section>

<section aria-labelledby="bureau-of-indian-affairs-regions">
	<h2 id="bureau-of-indian-affairs-regions">Bureau of Indian Affairs regions</h2>
	<figure class="map-figure" data-print-part="maps">
		<div class="map-drawing">
			<!-- svelte-ignore hydration_html_changed -->
			{@html data.drawings.regions}
		</div>
		<figcaption class="small muted">
			Select a region to go to its row in the table. Hawaiʻi and the territories are in no region.
			Lines are simplified for a national map.
		</figcaption>
	</figure>

	<DataTable
		identifier="regions"
		label="Table: regions"
		caption="Nations each region serves, as the Bureau’s Tribal Leaders Directory lists them"
		columns={regionColumns}
		rows={regionRows}
		defaultSort={{ key: 'region', direction: 'ascending' }}
		{cell}
	/>
</section>

<div class="reading">
	<SourceList sources={data.sources} />
</div>

<style>
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
