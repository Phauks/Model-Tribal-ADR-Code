<script lang="ts">
	// Find recourse (site/DESIGN.md, section 6): the dispute resolution
	// provisions in Native nations' own laws, with the site's shared filter
	// panel (the same one as the advanced search). The page is built with the
	// first rows; in the browser it loads every row and reads the words and
	// filters from the address.
	import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
	import { onMount } from 'svelte';
	import Download from '@lucide/svelte/icons/download';
	import Link from '@lucide/svelte/icons/link';
	import ListFilter from '@lucide/svelte/icons/list-filter';
	import X from '@lucide/svelte/icons/x';
	import FilterPanel from '#lib/components/FilterPanel.svelte';
	import { newTabNoteId, outsideLinksOpenInNewTab } from '#lib/new-tab-links.ts';
	import {
		entryLabels,
		outcomeLabels,
		recourseAddress,
		recourseCsv,
		recourseFacets,
		recoursePageSize,
		recourseQueryFromAddress,
		rowsWithWords,
		settingLabels,
		type RecourseRow
	} from '#lib/recourse.ts';
	import {
		activeChoices,
		facetCounts,
		filterRows,
		toggleChoice,
		type ActiveChoice,
		type FilterChoices
	} from '#lib/search-filters.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let allRows = $state<RecourseRow[] | undefined>(undefined);
	let loadFailed = $state(false);
	let text = $state('');
	let choices = $state<FilterChoices>({});
	let shown = $state(recoursePageSize);
	let filtersOpen = $state(false);
	let copyStatus = $state('');

	const facets = $derived(allRows ? recourseFacets(allRows) : []);
	const withWords = $derived(allRows ? rowsWithWords(allRows, text) : undefined);
	const counts = $derived(withWords ? facetCounts(withWords, facets, choices) : {});
	const matched = $derived(withWords ? filterRows(withWords, facets, choices) : undefined);
	const rows = $derived(matched ? matched.slice(0, shown) : data.firstRows);
	const matchedNations = $derived(matched ? new Set(matched.map((row) => row.nation.id)).size : data.nationCount);
	const chips = $derived(activeChoices(facets, choices));
	const narrowed = $derived(chips.length > 0 || text.trim() !== '');
	const count = $derived(
		`${(matched?.length ?? data.total).toLocaleString('en-US')} ${(matched?.length ?? data.total) === 1 ? 'provision' : 'provisions'} in ${matchedNations.toLocaleString('en-US')} ${matchedNations === 1 ? 'nation' : 'nations'}`
	);

	function choose(next: FilterChoices) {
		choices = next;
		shown = recoursePageSize;
	}

	function removeChip(chip: ActiveChoice) {
		choose(toggleChoice(choices, chip.key, chip.value, false));
	}

	function clearAll() {
		text = '';
		choose({});
	}

	function saveCsv() {
		if (!matched) return;
		const address = URL.createObjectURL(
			new Blob([recourseCsv(matched, location.origin)], { type: 'text/csv;charset=utf-8' })
		);
		const link = document.createElement('a');
		link.href = address;
		link.download = 'dispute-resolution-provisions.csv';
		link.click();
		setTimeout(() => URL.revokeObjectURL(address), 0);
	}

	async function copyLink() {
		try {
			await navigator.clipboard.writeText(location.href);
			copyStatus = 'Link copied.';
		} catch {
			copyStatus = `Copy this link: ${location.href}`;
		}
	}

	// The choices go into the page address as the reader makes them, so a copied link opens the same list.
	$effect(() => {
		if (!allRows) return;
		const search = recourseAddress({ text, choices }, facets).toString();
		const next = `${location.pathname}${search ? `?${search}` : ''}${location.hash}`;
		if (next !== `${location.pathname}${location.search}${location.hash}`) {
			history.replaceState(history.state, '', next);
		}
		copyStatus = '';
	});

	onMount(() => {
		fetch('/nations/recourse/provisions.json')
			.then((response) => {
				if (!response.ok) throw new Error(String(response.status));
				return response.json() as Promise<RecourseRow[]>;
			})
			.then((body) => {
				const query = recourseQueryFromAddress(new URLSearchParams(location.search), recourseFacets(body));
				text = query.text;
				choices = query.choices;
				allRows = body;
			})
			.catch(() => {
				loadFailed = true;
			});
	});
</script>

<!--
	Each tag on a provision narrows the list to the provisions that share it
	(Trevor, Nov. 23, 2026: every table opens to the data behind it). Without
	scripts the tags are plain words, since filtering needs the full list.
-->
{#snippet tag(key: string, value: string, label: string)}
	{#if allRows && !(choices[key] ?? []).includes(value)}
		<button type="button" class="tag-button" aria-label="{label}: show only these" onclick={() => choose(toggleChoice(choices, key, value, true))}>{label}</button>
	{:else}
		{label}
	{/if}
{/snippet}

<svelte:head>
	<title>Find recourse · Model Tribal ADR Code</title>
	<meta
		name="description"
		content="Search the dispute resolution provisions in Native nations' own laws by method, kind of dispute and state."
	/>
</svelte:head>

<span id={newTabNoteId} hidden>Opens in a new tab</span>

<div class="recourse" {@attach outsideLinksOpenInNewTab}>
	<Breadcrumbs trail={[{ label: 'Nations', href: '/nations' }]} />
	<h1>Find recourse</h1>
	<p class="lead">
		The dispute resolution provisions in Native nations’ own law codes, court rules and ordinances: {data.total.toLocaleString(
			'en-US'
		)} provisions from {data.nationCount.toLocaleString('en-US')} nations. Pick a kind of dispute and a method to see which nations provide it and what their law says.
	</p>

	{#if allRows}
		<div class="phone-tools no-print">
			<button
				type="button"
				class="button button-quiet small-button"
				aria-expanded={filtersOpen}
				aria-controls="recourse-filters"
				onclick={() => (filtersOpen = !filtersOpen)}
			>
				<ListFilter aria-hidden="true" size="1.1em" strokeWidth={1.75} />Filters{chips.length > 0 ? ` (${chips.length})` : ''}
			</button>
		</div>
	{/if}

	<div class="layout" class:interactive={Boolean(allRows)}>
		{#if allRows}
			<aside id="recourse-filters" class="filters no-print" class:open={filtersOpen} aria-label="Filters">
				<div class="field search-field">
					<label for="recourse-search">Search the text</label>
					<input
						id="recourse-search"
						type="search"
						autocomplete="off"
						bind:value={text}
						oninput={() => (shown = recoursePageSize)}
					/>
				</div>
				<FilterPanel identifier="recourse" {facets} {choices} {counts} onchange={choose} />
			</aside>
		{/if}

		<section class="results" aria-labelledby="results-heading">
			<h2 id="results-heading" class="visually-hidden">Provisions</h2>
			{#if allRows}
				{#if chips.length > 0}
					<ul class="chips no-print" aria-label="Filters in use">
						{#each chips as chip (`${chip.key}=${chip.value}`)}
							<li>
								<button type="button" class="chip-button" aria-label="Remove filter {chip.label}" onclick={() => removeChip(chip)}>
									{chip.label}
									<X aria-hidden="true" size="1em" />
								</button>
							</li>
						{/each}
					</ul>
				{/if}
				<div class="result-tools no-print">
					<p class="result-count" role="status">{count}</p>
					{#if narrowed}
						<button type="button" class="button button-quiet small-button" onclick={clearAll}>Show all</button>
					{/if}
					<button type="button" class="button button-quiet small-button" onclick={copyLink}>
						<Link aria-hidden="true" size="1.1em" strokeWidth={1.75} />Copy link
					</button>
					<button type="button" class="button button-quiet small-button" onclick={saveCsv}>
						<Download aria-hidden="true" size="1.1em" strokeWidth={1.75} />Download CSV
					</button>
					{#if copyStatus}<p class="small copied" role="status">{copyStatus}</p>{/if}
				</div>
			{:else}
				<p class="small muted">
					{#if loadFailed}
						The full list could not be loaded, so the filters are not available. The first {data.firstRows.length} provisions are shown below.
					{:else}
						Showing the first {data.firstRows.length} of {data.total.toLocaleString('en-US')} provisions. Filtering needs scripts in the browser.
					{/if}
					The whole list is also a <a href="/nations/recourse/provisions.csv">CSV file</a> for a spreadsheet, and <a href="/nations/recourse/provisions.json">JSON</a> for programs.
				</p>
			{/if}

			<ol class="result-list">
				{#each rows as row (row.id)}
					<li class="result">
						<p class="nation">
							<a href="/nations/{row.nation.id}">{row.nation.name}</a>
							{#if row.states.length > 0}<span class="muted states">· {#each row.states as state, index (state)}{index > 0 ? ', ' : ''}{@render tag('state', state, state)}{/each}</span>{/if}
						</p>
						<p class="citation small">
							{#if row.link}<a href={row.link}>{row.citation}</a>{:else}{row.citation}{/if}
						</p>
						<p class="summary">{row.summary}</p>
						<ul class="tags small" aria-label="About this provision">
							<li>{@render tag('method', row.method, row.method)}</li>
							<li>{@render tag('subject', row.subject, row.subject)}</li>
							<li>{@render tag('setting', row.setting, settingLabels[row.setting] ?? row.setting)}</li>
							<li>{@render tag('entry', row.entry, `Starts: ${entryLabels[row.entry] ?? row.entry}`)}</li>
							<li>{@render tag('outcome', row.outcome, `Result: ${outcomeLabels[row.outcome] ?? row.outcome}`)}</li>
							{#if !row.checked}<li class="read-once">Read once</li>{/if}
						</ul>
					</li>
				{/each}
			</ol>
			{#if matched && matched.length === 0}
				<p>No provisions match these choices. Try removing a filter.</p>
			{/if}
			{#if matched && matched.length > shown}
				<button type="button" class="button button-quiet no-print" onclick={() => (shown += recoursePageSize)}>
					Show {Math.min(recoursePageSize, matched.length - shown)} more
				</button>
			{/if}
		</section>
	</div>
</div>

<style>
	.layout.interactive {
		display: grid;
		grid-template-columns: minmax(13rem, 16rem) minmax(0, 1fr);
		gap: var(--space-5);
		align-items: start;
	}

	.phone-tools {
		display: none;
		margin-bottom: var(--space-3);
	}

	.search-field {
		margin-bottom: var(--space-3);
	}

	.search-field input {
		width: 100%;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		list-style: none;
		margin: 0 0 var(--space-3);
		padding: 0;
	}

	.chip-button {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		min-height: 2.25rem;
		padding: 0 var(--space-3);
		border: 1px solid var(--color-control-border);
		border-radius: 999px;
		background: var(--color-surface-raised);
		color: var(--color-ink);
		font: inherit;
		font-size: var(--font-size-small);
		cursor: pointer;
	}

	.result-tools {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2) var(--space-3);
		padding-bottom: var(--space-3);
		border-bottom: 1px solid var(--color-line);
	}

	.result-count {
		margin: 0 auto 0 0;
		font-weight: var(--font-weight-semibold);
	}

	.copied {
		flex-basis: 100%;
		margin: 0;
		overflow-wrap: anywhere;
	}

	.small-button {
		gap: var(--space-2);
		padding: var(--space-1) var(--space-3);
		font-size: var(--font-size-small);
	}

	.result-list {
		list-style: none;
		margin: 0 0 var(--space-4);
		padding: 0;
	}

	.result {
		padding: var(--space-4) 0;
		border-bottom: 1px solid var(--color-line);
		max-width: calc(var(--layout-measure) + 8rem);
	}

	.result p {
		margin: 0 0 var(--space-1);
	}

	.nation {
		font-weight: var(--font-weight-semibold);
	}

	.states {
		font-weight: normal;
	}

	.citation {
		color: var(--color-ink-muted);
	}

	.summary {
		margin-top: var(--space-2) !important;
	}

	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1) var(--space-2);
		list-style: none;
		margin: var(--space-2) 0 0;
		padding: 0;
	}

	.tags li {
		padding: 0 var(--space-2);
		border-radius: var(--radius-control);
		background: var(--color-surface);
		color: var(--color-ink-muted);
	}

	.tag-button {
		border: 0;
		padding: 0;
		background: transparent;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.tag-button:hover {
		color: var(--color-link);
		text-decoration: underline;
	}

	.tags li:has(.tag-button:hover) {
		background: var(--color-surface-raised);
	}

	.tags .read-once {
		background: var(--color-placeholder-background);
		border: 1px solid var(--color-placeholder-rule);
		color: var(--color-ink);
	}

	@media (max-width: 52rem) {
		.layout.interactive {
			display: block;
		}

		.phone-tools {
			display: block;
		}

		.filters {
			display: none;
			margin-bottom: var(--space-4);
		}

		.filters.open {
			display: block;
		}
	}

	@media print {
		.layout.interactive {
			display: block;
		}
	}
</style>
