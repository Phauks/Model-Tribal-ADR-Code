<script lang="ts">
	// The site search page (site/DESIGN.md, section 6, "Search"). The page is
	// built ahead of time; in the browser it reads the words and filters from
	// the address (/search?q=…&state=NV), loads the indexes built with the
	// site and lists the matches, grouped by kind. Filters narrow the nations
	// by the facts their records hold, and with them the laws and stories of
	// those nations (Trevor asked for advanced search on Nov. 23, 2026).
	// Without scripts it says so and offers the ways to browse.
	import { onMount } from 'svelte';
	import CountBadge from '#lib/components/CountBadge.svelte';
	import RecognitionBadges from '#lib/components/RecognitionBadges.svelte';
	import { page } from '$app/state';
	import { replaceState } from '$app/navigation';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';
	import X from '@lucide/svelte/icons/x';
	import DataTable from '#lib/components/DataTable.svelte';
	import FilterPanel from '#lib/components/FilterPanel.svelte';
	import {
		activeChoices,
		choicesFromAddress,
		facetCounts,
		filterRows,
		hasChoices,
		writeChoices,
		type ActiveChoice,
		type FilterChoices
	} from '#lib/search-filters.ts';
	import {
		documentFacets,
		loadSearchRecords,
		nationFacets,
		type DocumentSearchRow,
		type NationSearchRow,
		type SearchRecords
	} from '#lib/search-records.ts';
	import { entryGroups, forEntryGroups, matchEverything, resultGroupLabels, resultGroups, type ResultGroup } from '#lib/search-everything.ts';
	import { loadSearchIndex, type SearchEntry, type SearchResult } from '#lib/site-search.ts';
	import type { TableColumn, TableRow } from '#lib/tables/table-definition.ts';

	type Show = 'all' | ResultGroup;
	/** A result listed straight from the index; a story listed without words typed has no name that matched. */
	type ListedResult = SearchEntry & Partial<Pick<SearchResult, 'matchedName' | 'matchedGroup'>>;

	const showLabels: Record<Show, string> = { all: 'Everything', ...resultGroupLabels };
	const showOrder: Show[] = ['all', ...resultGroups];

	/** Results shown per group before "Show all". */
	const firstShown = 25;
	const firstNationsShown = 50;

	let entries = $state<SearchEntry[] | undefined>();
	let records = $state<SearchRecords | undefined>();
	let failed = $state(false);
	let query = $state('');
	/** The words last written into the address, so typing is not undone when the address catches up. */
	let written: string | undefined;
	let expanded = $state<Partial<Record<Show, boolean>>>({});
	let filtersOpen = $state(false);
	let typingTimer: ReturnType<typeof setTimeout> | undefined;

	// Follow the address, including a new search from the masthead's box.
	$effect(() => {
		const fromAddress = page.url.searchParams.get('q') ?? '';
		if (fromAddress !== written) {
			query = fromAddress;
			written = fromAddress;
			expanded = {};
		}
	});

	onMount(async () => {
		try {
			[entries, records] = await Promise.all([loadSearchIndex(), loadSearchRecords()]);
		} catch {
			failed = true;
		}
	});

	const parameters = $derived(page.url.searchParams);
	const show = $derived<Show>(showOrder.find((value) => value === parameters.get('type')) ?? 'all');
	const facets = $derived(records ? nationFacets(records) : []);
	const choices = $derived(choicesFromAddress(parameters, facets));
	const documentChoices = $derived(choicesFromAddress(parameters, documentFacets));
	const filtering = $derived(hasChoices(choices));
	const filterCount = $derived(
		Object.values(choices).flat().length + (show === 'document' ? Object.values(documentChoices).flat().length : 0)
	);

	const trimmed = $derived(query.trim());
	/** What the words find, the same matches the masthead's search panel counts (src/lib/search-everything.ts). */
	const matches = $derived(entries && records && trimmed ? matchEverything(entries, records, trimmed) : undefined);

	const nationsByIdentifier = $derived(new Map((records?.nations ?? []).map((row) => [row.id, row])));
	/** Each nation's recognition badges, from the search index, by the nation's address. */
	const badgesByLink = $derived(
		new Map((entries ?? []).filter((entry) => entry.badges).map((entry) => [entry.link, entry.badges ?? []]))
	);
	/** The nations the words find, best first; every nation when no words are typed. */
	const nationPool = $derived.by<NationSearchRow[]>(() => {
		if (!records) return [];
		if (!trimmed) return records.nations;
		return (matches?.nation ?? []).map((match) => match.row);
	});

	const browsing = $derived(trimmed === '' && (filtering || show === 'nation' || show === 'document' || show === 'story'));
	const nations = $derived(trimmed || browsing ? filterRows(nationPool, facets, choices) : []);
	/** The nations the filters allow, by id; undefined when no filter is ticked. */
	const allowed = $derived(
		records && filtering ? new Set(filterRows(records.nations, facets, choices).map((row) => row.id)) : undefined
	);

	const documentPool = $derived(
		(trimmed ? (matches?.document ?? []) : (records?.documents ?? [])).filter((row) => !allowed || allowed.has(row.nation))
	);
	const documentCounts = $derived(facetCounts(documentPool, documentFacets, documentChoices));
	const documents = $derived<DocumentSearchRow[]>(
		trimmed || browsing ? filterRows(documentPool, documentFacets, documentChoices) : []
	);

	const storyPool = $derived<SearchEntry[]>(
		trimmed
			? (matches?.story ?? [])
			: browsing || show === 'story'
				? (entries ?? []).filter((entry) => entry.kind === 'story')
				: []
	);
	const stories = $derived(
		allowed
			? storyPool.filter((entry) => (records?.storyNations[entry.link] ?? []).some((id) => allowed.has(id)))
			: storyPool
	);
	/**
	 * The nation filters' counts. With only laws or only stories shown, each
	 * answer counts the documents or stories it would show, through their
	 * nations; otherwise it counts nations.
	 */
	const counts = $derived.by(() => {
		if (show === 'document') {
			const pool = trimmed ? (matches?.document ?? []) : (records?.documents ?? []);
			const found = filterRows(pool, documentFacets, documentChoices);
			return facetCounts(throughNations(found.map((row) => [row.nation])), facets, choices);
		}
		if (show === 'story') {
			return facetCounts(throughNations(storyPool.map((entry) => records?.storyNations[entry.link] ?? [])), facets, choices);
		}
		return facetCounts(nationPool, facets, choices);
	});

	/**
	 * One row per document or story, carrying the answers of all its nations,
	 * so a story told by two nations counts once under each of their states.
	 */
	function throughNations(nationLists: string[][]): NationSearchRow[] {
		return nationLists.flatMap((ids) => {
			const rows = ids.map((id) => nationsByIdentifier.get(id)).filter((row): row is NationSearchRow => row !== undefined);
			if (rows.length === 0) return [];
			if (rows.length === 1) return rows;
			const merged = { ...rows[0] };
			for (const key of ['recognition', 'states', 'region', 'courts', 'dispute', 'laws', 'gaming'] as const) {
				merged[key] = [...new Set(rows.flatMap((row) => row[key]))];
			}
			return [merged];
		});
	}

	/**
	 * Each group listed straight from the search index. Stories follow the
	 * nation filters; the rest belong to no nation in the index (federal law,
	 * cases, people, glossary terms, reference material and the site's pages),
	 * so nation filters put them away.
	 */
	const listed = $derived(
		forEntryGroups<ListedResult[]>((group) => (group === 'story' ? stories : filtering ? [] : (matches?.[group] ?? [])))
	);

	const totals = $derived<Record<Show, number>>({
		...forEntryGroups((group) => listed[group].length),
		all: nations.length + documents.length + entryGroups.reduce((total, group) => total + listed[group].length, 0),
		nation: nations.length,
		document: documents.length
	});
	const shows = (kind: Show) => (show === 'all' || show === kind) && totals[kind] > 0;

	const chips = $derived<ActiveChoice[]>([
		...activeChoices(facets, choices),
		...(show === 'document' ? activeChoices(documentFacets, documentChoices) : [])
	]);

	const status = $derived.by(() => {
		if (!entries || !records) return '';
		if (trimmed === '' && !browsing) return 'Type a name or a word, or choose filters.';
		const count = show === 'all' ? totals.all : totals[show];
		const what = `${count.toLocaleString('en-US')} ${count === 1 ? 'result' : 'results'}`;
		const words = trimmed ? ` for “${trimmed}”` : '';
		const filters = filterCount > 0 ? ` with ${filterCount} ${filterCount === 1 ? 'filter' : 'filters'}` : '';
		return `${what}${words}${filters}`;
	});

	/** Writes the words, the kind shown and the filters into the address, replacing the current entry. */
	function writeAddress(next: { show?: Show; choices?: FilterChoices; documentChoices?: FilterChoices } = {}) {
		const url = new URL(page.url.href);
		written = trimmed;
		if (trimmed) url.searchParams.set('q', trimmed);
		else url.searchParams.delete('q');
		const nextShow = next.show ?? show;
		if (nextShow === 'all') url.searchParams.delete('type');
		else url.searchParams.set('type', nextShow);
		writeChoices(url.searchParams, facets, next.choices ?? choices);
		writeChoices(url.searchParams, documentFacets, next.documentChoices ?? documentChoices);
		replaceState(url, {});
	}

	function search(event: SubmitEvent) {
		event.preventDefault();
		clearTimeout(typingTimer);
		writeAddress();
	}

	function typed() {
		expanded = {};
		clearTimeout(typingTimer);
		typingTimer = setTimeout(() => writeAddress(), 300);
	}

	function removeChip(chip: ActiveChoice) {
		const from = facets.some((facet) => facet.key === chip.key) ? choices : documentChoices;
		const values = (from[chip.key] ?? []).filter((value) => value !== chip.value);
		const next = { ...from, [chip.key]: values };
		if (from === choices) writeAddress({ choices: next });
		else writeAddress({ documentChoices: next });
	}

	function shown<Item>(kind: Show, list: Item[], limit = firstShown): Item[] {
		return expanded[kind] ? list : list.slice(0, limit);
	}

	const nationColumns: TableColumn[] = [
		{ key: 'name', header: 'Nation or community', sortable: true, isRowHeader: true },
		{ key: 'states', header: 'State or territory', sortable: true },
		{ key: 'recognition', header: 'Recognition', sortable: true, custom: true },
		{ key: 'found', header: 'Found on record' }
	];

	function nationRow(row: NationSearchRow): TableRow {
		return {
			key: row.id,
			cells: {
				name: { text: row.name, href: row.link },
				states: { text: row.statesText },
				recognition: { text: row.recognitionText },
				found: { text: row.foundText }
			}
		};
	}

	const nationRows = $derived(shown('nation', nations, firstNationsShown).map(nationRow));
</script>

<svelte:head>
	<title>{trimmed ? `“${trimmed}” · ` : ''}Search · Model Tribal ADR Code</title>
</svelte:head>

<div class="reading">
	<h1>Search</h1>

	<form class="search-form needs-scripts" role="search" action="/search" method="get" onsubmit={search}>
		<div class="field">
			<label for="search-page-query">Search nations, laws, cases, people, stories and pages</label>
			<input
				id="search-page-query"
				type="search"
				name="q"
				autocomplete="off"
				bind:value={query}
				oninput={typed}
			/>
		</div>
	</form>

	<noscript>
		<div class="notice" role="note">
			<p>
				Search needs scripts, which are off in this browser. You can still browse the <a href="/nations">nations by first letter or state</a> and the <a href="/glossary">glossary from A to Z</a>.
			</p>
		</div>
	</noscript>

	{#if failed}
		<div class="notice notice-problem" role="note">
			<p>
				The search index could not be loaded. If you are offline, save the site for offline reading in Settings first. You can still browse the <a href="/nations">nations</a>, the <a href="/stories">stories</a> and the <a href="/glossary">glossary</a>.
			</p>
		</div>
	{/if}
</div>

{#if entries && records}
	<fieldset class="show-kinds no-print">
		<legend class="visually-hidden">Show</legend>
		{#each showOrder as kind (kind)}
			<label class="show-kind" class:chosen={show === kind}>
				<input
					type="radio"
					name="show"
					value={kind}
					checked={show === kind}
					onchange={() => {
						expanded = {};
						writeAddress({ show: kind });
					}}
				/>
				{showLabels[kind]}
				{#if trimmed || browsing}<CountBadge count={totals[kind]} />{/if}
			</label>
		{/each}
	</fieldset>

	<div class="search-layout">
		<div class="filters-toggle no-print">
			<button
				class="button button-quiet"
				type="button"
				aria-expanded={filtersOpen}
				aria-controls="search-filters"
				onclick={() => (filtersOpen = !filtersOpen)}
			>
				<SlidersHorizontal size={20} aria-hidden="true" />
				<span>Filters{filterCount > 0 ? ` (${filterCount})` : ''}</span>
			</button>
		</div>

		<section class="filters no-print" class:open={filtersOpen} id="search-filters" aria-labelledby="filters-heading">
			<h2 id="filters-heading" class="filters-heading">Filter nations</h2>
			<p class="hint">Ticking two answers in one group shows nations with either. Filters also narrow the laws and stories to those nations’.</p>
			{#if show === 'document'}
				<FilterPanel
					identifier="search-documents"
					facets={documentFacets}
					choices={documentChoices}
					counts={documentCounts}
					onchange={(next) => writeAddress({ documentChoices: next })}
				/>
			{/if}
			<FilterPanel
				identifier="search-nations"
				{facets}
				{choices}
				{counts}
				onchange={(next) => writeAddress({ choices: next })}
			/>
		</section>

		<div class="results-column">
			<p class="small muted" role="status">{status}</p>

			{#if chips.length > 0}
				<ul class="chips no-print" aria-label="Filters in use">
					{#each chips as chip (`${chip.key}=${chip.value}`)}
						<li>
							<button class="filter-chip" type="button" aria-label="Remove filter {chip.label}" onclick={() => removeChip(chip)}>
								{chip.label}
								<X size={16} aria-hidden="true" />
							</button>
						</li>
					{/each}
					<li>
						<button
							class="button button-quiet clear"
							type="button"
							onclick={() => writeAddress({ choices: {}, documentChoices: {} })}
						>
							Clear all filters
						</button>
					</li>
				</ul>
			{/if}

			{#if shows('nation')}
				<details class="result-group" open>
					<summary>
						<span class="fold-mark"><ChevronDown size={24} /></span>
						<h2 id="results-nation">
							{showLabels.nation}
							<CountBadge count={nations.length} />
						</h2>
					</summary>
					<DataTable
						identifier="search-nations-table"
						label="Table: {showLabels.nation}"
						columns={nationColumns}
						rows={nationRows}
						rowName={['nation', 'nations']}
						total={nations.length}
					>
						{#snippet cell(row, column)}
							{#if column.key === 'recognition'}
								<RecognitionBadges badges={badgesByLink.get(row.cells.name?.href ?? '') ?? []} size="small" />
							{/if}
						{/snippet}
					</DataTable>
					{#if nations.length > firstNationsShown && !expanded.nation}
						<button class="button button-quiet" type="button" onclick={() => (expanded.nation = true)}>
							Show all {nations.length.toLocaleString('en-US')} nations and communities
						</button>
					{/if}
				</details>
			{/if}

			{#if shows('document')}
				<details class="result-group" open>
					<summary>
						<span class="fold-mark"><ChevronDown size={24} /></span>
						<h2 id="results-document">
							{showLabels.document}
							<CountBadge count={documents.length} />
						</h2>
					</summary>
					<ol class="results" aria-labelledby="results-document">
						{#each shown('document', documents) as row (`${row.link} ${row.title}`)}
							<li>
								<a href={row.link}>{row.title}</a>
								<p class="small muted">{[row.kindLabel, row.year, row.nationName].filter(Boolean).join(' · ')}</p>
							</li>
						{/each}
					</ol>
					{#if documents.length > firstShown && !expanded.document}
						<button class="button button-quiet" type="button" onclick={() => (expanded.document = true)}>
							Show all {documents.length.toLocaleString('en-US')} laws and governing documents
						</button>
					{/if}
				</details>
			{/if}

			{#each entryGroups as group (group)}
				{@const items = listed[group]}
				{#if shows(group)}
					<details class="result-group" open>
						<summary>
							<span class="fold-mark"><ChevronDown size={24} /></span>
							<h2 id="results-{group}">
								{showLabels[group]}
								<CountBadge count={items.length} />
							</h2>
						</summary>
						<ol class="results" aria-labelledby="results-{group}">
							{#each shown(group, items) as result (result.link)}
								<li>
									<a href={result.link}>{result.title}</a>
									{#if result.matchedName}
										<span class="small muted">(also called {result.matchedName})</span>
									{:else if result.matchedGroup}
										<span class="small muted">({result.matchedGroup})</span>
									{/if}
									{#if result.detail}<p class="small muted">{result.detail}</p>{/if}
								</li>
							{/each}
						</ol>
						{#if items.length > firstShown && !expanded[group]}
							<button class="button button-quiet" type="button" onclick={() => (expanded[group] = true)}>
								Show all {items.length.toLocaleString('en-US')}
								{showLabels[group].toLocaleLowerCase('en-US')} results
							</button>
						{/if}
					</details>
				{/if}
			{/each}

			{#if (trimmed !== '' || browsing) && (show === 'all' ? totals.all : totals[show]) === 0}
				<p>
					Nothing matches{trimmed ? ` “${trimmed}”` : ''}{filterCount > 0 ? ' with these filters' : ''}.
					{#if filterCount > 0}Try removing a filter, or{:else}Check the spelling, try fewer words, or{/if}
					browse the <a href="/nations">nations</a> and the <a href="/glossary">glossary</a>.
				</p>
			{/if}
		</div>
	</div>
{/if}

<style>
	.show-kinds {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		border: 0;
		margin: 0 0 var(--space-4);
		padding: 0;
	}

	/* On a phone the kinds stay on one line that scrolls sideways, so the results start sooner. */
	@media (max-width: 40rem) {
		.show-kinds {
			flex-wrap: nowrap;
			overflow-x: auto;
			padding: var(--space-1) var(--space-1) var(--space-2);
			margin-inline: calc(-1 * var(--space-1));
		}

		.show-kind {
			flex: none;
		}
	}

	/* Each kind is a radio button drawn as a pill; the circle is hidden but still takes focus. */
	.show-kind {
		position: relative;
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--layout-target-minimum);
		padding: 0 var(--space-3);
		border: 1px solid var(--color-control-border);
		border-radius: 999px;
		font-size: var(--font-size-small);
		cursor: pointer;
	}

	.show-kind input {
		position: absolute;
		inset: 0;
		opacity: 0;
		margin: 0;
		cursor: pointer;
	}

	.show-kind:has(input:focus-visible) {
		outline: 3px solid var(--color-focus-ring);
		outline-offset: 2px;
	}

	.show-kind.chosen {
		background: var(--color-action);
		border-color: var(--color-action);
		color: var(--color-action-text);
		font-weight: var(--font-weight-semibold);
	}

	/* Filters beside the results when there is room, above them behind a button when there is not. */
	.search-layout {
		container-type: inline-size;
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-4) var(--space-6);
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

	.filters-heading {
		font-size: var(--font-size-lead);
		margin: 0 0 var(--space-2);
	}

	.filters-toggle .button {
		gap: var(--space-2);
	}

	@media (min-width: 64rem) {
		.search-layout {
			grid-template-columns: 18rem minmax(0, 1fr);
		}

		.filters,
		.filters.open {
			display: block;
			grid-row: 1;
			grid-column: 1;
			border: 0;
			padding: 0;
		}

		.results-column {
			grid-column: 2;
		}

		.filters-toggle {
			display: none;
		}
	}

	@media print {
		.search-layout {
			display: block;
		}
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
		list-style: none;
		margin: 0 0 var(--space-3);
		padding: 0;
	}

	.filter-chip {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		min-height: var(--layout-target-minimum);
		padding: 0 var(--space-3);
		border: 1px solid var(--color-link);
		border-radius: 999px;
		background: var(--color-notice-background);
		color: var(--color-ink);
		font: inherit;
		font-size: var(--font-size-small);
		cursor: pointer;
	}

	.filter-chip:hover {
		border-width: 2px;
		padding: 0 calc(var(--space-3) - 1px);
	}

	.clear {
		font-size: var(--font-size-small);
	}

	.result-group {
		margin-top: var(--space-4);
		border-top: 1px solid var(--color-line);
	}

	/* The summary is the group's heading; the marker shows it can be folded. */
	.result-group summary {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--layout-target-minimum);
		list-style: none;
		cursor: pointer;
	}

	.result-group summary::-webkit-details-marker {
		display: none;
	}

	.fold-mark {
		display: inline-flex;
		transition: transform var(--motion-duration-short) var(--motion-easing-standard);
	}

	.result-group:not([open]) .fold-mark {
		transform: rotate(-90deg);
	}


	.result-group summary h2 {
		display: inline;
		margin: var(--space-3) 0;
	}

	.results {
		list-style: none;
		padding: 0;
	}

	.results li {
		padding: var(--space-2) 0;
		border-bottom: 1px solid var(--color-line);
	}

	.results li > a {
		font-weight: var(--font-weight-semibold);
	}

	.results p {
		margin: var(--space-1) 0 0;
	}
</style>
