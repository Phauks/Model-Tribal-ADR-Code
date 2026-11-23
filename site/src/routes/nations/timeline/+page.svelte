<script lang="ts">
	// The full timeline (site/DESIGN.md, section 6, "Timeline"): every dated
	// record on one line, filtered by nation, state, kind and era. The filters
	// are kept in the address (?nation=, ?state=, ?kind=, ?from=, ?to=), so a
	// view can be shared, and a nation's page opens it with ?nation=.
	import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
	import { onMount } from 'svelte';
	import { replaceState } from '$app/navigation';
	import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';
	import X from '@lucide/svelte/icons/x';
	import Timeline from '#lib/components/Timeline.svelte';
	import { eras, extentOf, timelineKinds, yearOf, type OpinionYear, type TimelineEntry, type TimelineKind, type TimelineRange } from '#lib/timeline.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const kinds = timelineKinds.map(({ kind }) => kind);
	const allEntries = $derived(
		data.entries.map(
			([kind, date, title, citation, detail, link, nations, italic], index): TimelineEntry => ({
				id: String(index + 1),
				kind: kinds[kind],
				date,
				title,
				citation: citation || undefined,
				detail: detail || undefined,
				link: link || undefined,
				nations: nations.length > 0 ? nations.map((place) => data.nations[place].id) : undefined,
				italic: italic === 1 || undefined
			})
		)
	);
	const allOpinions = $derived(
		data.opinions.map(([year, count, peacemaking, place]): OpinionYear => ({ year, count, peacemaking, nation: place >= 0 ? data.nations[place].id : undefined }))
	);
	const nationsById = $derived(Object.fromEntries(data.nations.map((nation) => [nation.id, nation])));
	const extent = $derived(extentOf(allEntries, allOpinions));

	let nation = $state('');
	let stateCode = $state('');
	let shown = $state<TimelineKind[] | undefined>();
	let range = $state<TimelineRange | undefined>();
	let nationText = $state('');
	let ready = $state(false);
	let filtersOpen = $state(false);

	const filtered = $derived(nation !== '' || stateCode !== '');
	const belongs = (ids: string[] | undefined) =>
		!!ids?.some((id) => (nation === '' || id === nation) && (stateCode === '' || nationsById[id]?.states.includes(stateCode)));

	// Under a nation or state filter, federal laws about no nation in particular stay, drawn faintly for context.
	const entries = $derived(
		filtered
			? allEntries.flatMap((entry) => (belongs(entry.nations) ? [entry] : entry.kind === 'federal' && !entry.nations ? [{ ...entry, context: true }] : []))
			: allEntries
	);
	const opinions = $derived(filtered ? allOpinions.filter((year) => belongs(year.nation ? [year.nation] : undefined)) : allOpinions);

	const counts = $derived(
		Object.fromEntries(
			kinds.map((kind) => [
				kind,
				kind === 'opinion' ? opinions.reduce((total, year) => total + year.count, 0) : entries.filter((entry) => entry.kind === kind).length
			])
		) as Record<TimelineKind, number>
	);
	const visible = $derived(shown ?? kinds);
	const era = $derived(eras.find((each) => range && Math.abs(range.from - Math.max(each.start, extent.from)) < 0.01 && Math.abs(range.to - Math.min(each.end, extent.to)) < 0.01));

	function chooseEra(name: string) {
		const chosen = eras.find((each) => each.name === name);
		range = chosen ? { from: Math.max(chosen.start, extent.from), to: Math.min(chosen.end, extent.to) } : undefined;
	}

	function toggleKind(kind: TimelineKind) {
		shown = visible.includes(kind) ? visible.filter((each) => each !== kind) : kinds.filter((each) => visible.includes(each) || each === kind);
	}

	function chooseNation() {
		const typed = nationText.trim().toLocaleLowerCase('en-US');
		const match = data.nations.find((each) => each.name.toLocaleLowerCase('en-US') === typed);
		if (match) nation = match.id;
	}

	onMount(() => {
		const params = new URLSearchParams(location.search);
		const asked = params.get('nation') ?? '';
		if (nationsById[asked]) {
			nation = asked;
			nationText = nationsById[asked].name;
		}
		const askedState = params.get('state') ?? '';
		if (data.states.some((state) => state.code === askedState)) stateCode = askedState;
		const askedKinds = (params.get('kind') ?? '').split(',').filter((kind): kind is TimelineKind => kinds.includes(kind as TimelineKind));
		if (askedKinds.length > 0) shown = askedKinds;
		const from = Number(params.get('from'));
		const to = Number(params.get('to'));
		if (params.has('from') && params.has('to') && Number.isFinite(from) && Number.isFinite(to) && to > from) range = { from, to };
		ready = true;
	});

	// The view in the address, so it can be shared.
	$effect(() => {
		if (!ready) return;
		const params = new URLSearchParams();
		if (nation) params.set('nation', nation);
		if (stateCode) params.set('state', stateCode);
		if (shown && shown.length < kinds.length) params.set('kind', shown.join(','));
		if (range) {
			params.set('from', String(Math.round(range.from)));
			params.set('to', String(Math.round(range.to)));
		}
		const search = params.toString();
		const url = new URL(location.href);
		url.search = search;
		if (url.href !== location.href) replaceState(url, {});
	});

	const filterCount = $derived([nation, stateCode, shown && shown.length < kinds.length, range].filter(Boolean).length);

	const firstYear = $derived(Math.min(...allEntries.map((entry) => Math.floor(yearOf(entry.date)))));
</script>

<svelte:head>
	<title>Timeline · Nations · Model Tribal ADR Code</title>
	<meta
		name="description"
		content="Treaties, land, laws and agreements, court decisions, Tribal court opinions and federal law on one timeline, from {firstYear} to the present, for every Native nation."
	/>
</svelte:head>

<Breadcrumbs trail={[{ label: 'Nations', href: '/nations' }]} />
<h1>Timeline</h1>

<div class="layout">
	<div class="filters-toggle no-print">
		<button class="button button-quiet" type="button" aria-expanded={filtersOpen} aria-controls="timeline-filters" onclick={() => (filtersOpen = !filtersOpen)}>
			<SlidersHorizontal size={20} aria-hidden="true" />
			<span>Filters{filterCount > 0 ? ` (${filterCount})` : ''}</span>
		</button>
	</div>

	<form class="filters no-print" class:open={filtersOpen} id="timeline-filters" onsubmit={(event) => event.preventDefault()} aria-label="Filters">
		<div class="filter">
			<label for="timeline-nation" class="visually-hidden">Find a nation</label>
			{#if nation}
				<p class="chosen">
					<strong>{nationsById[nation]?.name}</strong>
					<button type="button" class="icon-button" aria-label="Show every nation" title="Show every nation" onclick={() => ((nation = ''), (nationText = ''))}>
						<X size={18} aria-hidden="true" />
					</button>
				</p>
			{:else}
				<input id="timeline-nation" type="search" list="timeline-nations" placeholder="Find a nation" bind:value={nationText} oninput={chooseNation} onchange={chooseNation} />
				<datalist id="timeline-nations">
					{#each data.nations as each (each.id)}
						<option value={each.name}></option>
					{/each}
				</datalist>
			{/if}
		</div>

		<fieldset class="filter">
			<legend>Kind</legend>
			{#each timelineKinds as { kind, label } (kind)}
				<label class="option kind-{kind}">
					<input type="checkbox" checked={visible.includes(kind)} onchange={() => toggleKind(kind)} />
					<span class="swatch" aria-hidden="true"></span>
					<span class="name">{label}</span>
					<span class="count">{counts[kind].toLocaleString('en-US')}</span>
				</label>
			{/each}
		</fieldset>

		<fieldset class="filter">
			<legend>Era</legend>
			<label class="option"><input type="radio" name="era" checked={!range} onchange={() => chooseEra('')} /> <span class="name">Every year</span></label>
			{#each eras as each (each.name)}
				<label class="option">
					<input type="radio" name="era" checked={era?.name === each.name} onchange={() => chooseEra(each.name)} />
					<span class="name">{each.name}</span>
				</label>
			{/each}
		</fieldset>

		<div class="filter">
			<label for="timeline-state">State</label>
			<select id="timeline-state" bind:value={stateCode}>
				<option value="">All states</option>
				{#each data.states as state (state.code)}
					<option value={state.code}>{state.name}</option>
				{/each}
			</select>
		</div>
	</form>

	<div class="results">
		<Timeline
			{entries}
			{opinions}
			nations={nationsById}
			bind:shown
			bind:range
			{extent}
			headingLevel={2}
			aggregate={nation ? [] : ['document']}
			chips={false}
			overview
			summary
		/>
	</div>
</div>

<style>
	.layout {
		display: grid;
		grid-template-columns: 15rem minmax(0, 1fr);
		gap: var(--space-6);
		align-items: start;
	}

	.filters {
		font-size: var(--font-size-small);
	}

	.filters-toggle {
		display: none;
	}

	.filters-toggle .button {
		gap: var(--space-2);
	}

	.filter {
		margin: 0 0 var(--space-3);
		padding: var(--space-3) 0 0;
		border: 0;
		border-top: 1px solid var(--color-line);
		min-width: 0;
	}

	.filter:first-child {
		border-top: 0;
		padding-top: 0;
	}

	legend,
	label[for='timeline-state'] {
		display: block;
		font-weight: var(--font-weight-bold);
		margin-bottom: var(--space-1);
		padding: var(--space-3) 0 0;
	}

	input[type='search'] {
		width: 100%;
		min-height: var(--layout-target-minimum);
		padding: 0 var(--space-3);
		border: 2px solid var(--color-control-border);
		border-radius: var(--radius-control);
		background: var(--color-paper);
		color: var(--color-ink);
		font: inherit;
	}

	select {
		width: 100%;
	}

	.chosen {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		margin: 0;
	}

	.option {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-height: 2rem;
	}

	.option .name {
		flex: 1;
	}

	.count {
		color: var(--color-ink-muted);
		font-variant-numeric: tabular-nums;
	}

	.swatch {
		width: 0.7rem;
		height: 0.7rem;
		border-radius: 50%;
		background: var(--kind-color);
	}

	.kind-treaty {
		--kind-color: var(--color-timeline-treaty);
	}
	.kind-document {
		--kind-color: var(--color-timeline-document);
	}
	.kind-case {
		--kind-color: var(--color-timeline-case);
	}
	.kind-opinion {
		--kind-color: var(--color-timeline-opinion);
	}
	.kind-federal {
		--kind-color: var(--color-timeline-federal);
	}

	/* Filters beside the timeline when there is room, above it behind a button when there is not, as on the search page. */
	@media (max-width: 52rem) {
		.layout {
			grid-template-columns: minmax(0, 1fr);
			gap: var(--space-3);
		}

		.filters-toggle {
			display: block;
		}

		.filters {
			display: none;
		}

		.filters.open {
			display: block;
			border: 1px solid var(--color-line);
			border-radius: var(--radius-panel);
			padding: var(--space-3) var(--space-4);
		}
	}
</style>
