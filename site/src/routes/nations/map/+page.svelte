<script lang="ts">
	import { keyboardScroll } from '#lib/keyboard-scroll.ts';
	import { repositoryLink } from '#lib';
	import SourceList from '#lib/components/SourceList.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// The small states and territories drawn as markers show only their
	// two-letter code, so their names start with it: what is seen is what can
	// be spoken to select it (WCAG 2.5.3, label in name).
	const describeState = (state: { name: string; code: string; count: number; marker?: unknown }) => {
		const name = state.marker ? `${state.code}, ${state.name}` : state.name;
		return state.count === 0
			? `${name}: no nations recorded`
			: `${name}: ${state.count} ${state.count === 1 ? 'nation' : 'nations'}`;
	};

	const describeRegion = (region: { name: string; count: number }) =>
		`${region.name} Region: ${region.count} ${region.count === 1 ? 'nation' : 'nations'}`;

	// Lines of a region's label; two-word names that sit in narrow regions wrap.
	const labelLines = (name: string) => (name === 'Eastern Oklahoma' ? ['Eastern', 'Oklahoma'] : [name]);
</script>

<svelte:head>
	<title>Map · Nations · Model Tribal ADR Code</title>
</svelte:head>

<nav aria-label="Breadcrumb" class="small">
	<a href="/nations">Nations</a> › Map
</nav>

<div class="reading">
	<h1>Map of Native nations</h1>
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
	<figure class="map-figure">
		<svg
			class="map"
			viewBox="0 0 {data.width} {data.height}"
			role="group"
			aria-labelledby="by-state-title"
		>
			<title id="by-state-title">Number of nations with a recorded presence in each state and territory</title>
			<g class="states">
				{#each data.states as state (state.code)}
					{#if state.marker}
						<path class="state count-{state.countClass}" d={state.path}><title>{describeState(state)}</title></path>
					{:else if state.count > 0}
						<a href="#state-{state.code}" aria-label={describeState(state)}>
							<path class="state count-{state.countClass}" d={state.path}><title>{describeState(state)}</title></path>
						</a>
					{:else}
						<path class="state count-0" d={state.path}><title>{describeState(state)}</title></path>
					{/if}
				{/each}
			</g>
			<path class="state-borders" d={data.stateBorders} />
			<g class="markers">
				{#each data.states as state (state.code)}
					{#if state.marker}
						{@const marker = state.marker}
						<line class="marker-line" x1={marker.fromX} y1={marker.fromY} x2={marker.x} y2={marker.y} />
						{#if state.count > 0}
							<a href="#state-{state.code}" aria-label={describeState(state)}>
								<circle class="state count-{state.countClass}" cx={marker.x} cy={marker.y} r="9"><title>{describeState(state)}</title></circle>
								<text class="map-label marker-label" x={marker.x + 12} y={marker.y + 5}>{state.code}</text>
							</a>
						{:else}
							<circle class="state count-0" cx={marker.x} cy={marker.y} r="9"><title>{describeState(state)}</title></circle>
							<text class="map-label marker-label" x={marker.x + 12} y={marker.y + 5}>{state.code}</text>
						{/if}
					{/if}
				{/each}
			</g>
		</svg>
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

	<div class="table-scroll" role="region" aria-label="Table: nations by state" {@attach keyboardScroll}>
		<table>
			<caption>Nations with a recorded presence, by state and territory</caption>
			<thead>
				<tr>
					<th scope="col">State or territory</th>
					<th scope="col">Nations</th>
					<th scope="col">Names</th>
				</tr>
			</thead>
			<tbody>
				{#each data.stateRows as row (row.code)}
					<tr id="state-{row.code}">
						<th scope="row">{row.name}</th>
						<td>{row.nations.length.toLocaleString('en-US')}</td>
						<td>
							<details>
								<summary>Show {row.nations.length === 1 ? 'the nation' : `all ${row.nations.length}`}</summary>
								<ul>
									{#each row.nations as nation (nation.id)}
										<li><a href="/nations/{nation.id}">{nation.name}</a></li>
									{/each}
								</ul>
							</details>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</section>

<section aria-labelledby="bureau-of-indian-affairs-regions">
	<h2 id="bureau-of-indian-affairs-regions">Bureau of Indian Affairs regions</h2>
	<figure class="map-figure">
		<svg
			class="map"
			viewBox="0 0 {data.width} {data.height}"
			role="group"
			aria-labelledby="regions-title"
		>
			<title id="regions-title">The twelve regions of the Bureau of Indian Affairs</title>
			<g class="states">
				{#each data.states as state (state.code)}
					<path class="state-background" d={state.path} />
				{/each}
			</g>
			<g class="regions">
				{#each data.regions as region (region.name)}
					<a href="#{region.anchor}" aria-label={describeRegion(region)}>
						<path class="region" d={region.path}><title>{describeRegion(region)}</title></path>
					</a>
				{/each}
			</g>
			<path class="state-borders faint" d={data.stateBorders} />
			<path class="region-borders" d={data.regionBorders} />
			<g class="region-labels" aria-hidden="true">
				{#each data.regions as region (region.name)}
					<text class="map-label region-label" x={region.label.x} y={region.label.y}>
						{#each labelLines(region.name) as line, index (index)}
							<tspan x={region.label.x} dy={index === 0 ? 0 : '1.1em'}>{line}</tspan>
						{/each}
					</text>
				{/each}
			</g>
		</svg>
		<figcaption class="small muted">
			Select a region to go to its row in the table. Hawaiʻi and the territories are in no region.
			Lines are simplified for a national map.
		</figcaption>
	</figure>

	<div class="table-scroll" role="region" aria-label="Table: regions" {@attach keyboardScroll}>
		<table>
			<caption>Nations each region serves, as the Bureau’s Tribal Leaders Directory lists them</caption>
			<thead>
				<tr>
					<th scope="col">Region</th>
					<th scope="col">Nations</th>
					<th scope="col">States where those nations have a presence</th>
					<th scope="col">Names</th>
				</tr>
			</thead>
			<tbody>
				{#each data.regionRows as row (row.name)}
					<tr id={row.anchor}>
						<th scope="row">{row.name}</th>
						<td>{row.nations.length.toLocaleString('en-US')}</td>
						<td>{row.states.join(', ')}</td>
						<td>
							<details>
								<summary>Show {row.nations.length === 1 ? 'the nation' : `all ${row.nations.length}`}</summary>
								<ul>
									{#each row.nations as nation (nation.id)}
										<li><a href="/nations/{nation.id}">{nation.name}</a></li>
									{/each}
								</ul>
							</details>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
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

	.map {
		display: block;
		width: 100%;
		height: auto;
		max-width: 975px;
	}

	.state,
	.swatch {
		stroke: var(--color-control-border);
		stroke-width: 0.5;
	}

	.count-0 {
		fill: var(--color-map-class-0);
		background: var(--color-map-class-0);
	}
	.count-1 {
		fill: var(--color-map-class-1);
		background: var(--color-map-class-1);
	}
	.count-2 {
		fill: var(--color-map-class-2);
		background: var(--color-map-class-2);
	}
	.count-3 {
		fill: var(--color-map-class-3);
		background: var(--color-map-class-3);
	}
	.count-4 {
		fill: var(--color-map-class-4);
		background: var(--color-map-class-4);
	}

	.state-background {
		fill: var(--color-map-class-0);
	}

	.region {
		fill: var(--color-map-class-1);
	}

	a:hover .state,
	a:focus .state,
	a:hover .region,
	a:focus .region {
		fill: var(--color-focus);
	}

	.state-borders {
		fill: none;
		stroke: var(--color-control-border);
		stroke-width: 0.6;
		stroke-linejoin: round;
	}

	.state-borders.faint {
		stroke: var(--color-line);
	}

	.region-borders {
		fill: none;
		stroke: var(--color-ink);
		stroke-width: 1.6;
		stroke-linejoin: round;
	}

	.marker-line {
		stroke: var(--color-ink-muted);
		stroke-width: 0.8;
	}

	.map-label {
		fill: var(--color-ink);
		font-family: var(--font-family-reading);
		paint-order: stroke;
		stroke: var(--color-paper);
		stroke-width: 3px;
		stroke-linejoin: round;
	}

	.marker-label {
		font-size: 16px;
	}

	.region-label {
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

	table caption {
		text-align: left;
		font-weight: var(--font-weight-semibold);
		padding-bottom: var(--space-2);
	}
</style>
