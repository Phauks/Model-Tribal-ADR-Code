<script lang="ts">
	// Find recourse (site/DESIGN.md, section 6): the dispute resolution
	// provisions in Native nations' own laws, with the site's shared filter
	// panel (the same one as the advanced search). The page is built with the
	// first rows; in the browser it loads every row and reads the words and
	// filters from the address.
	import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
	import { onMount } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import ChartBar from '@lucide/svelte/icons/chart-bar';
	import Check from '@lucide/svelte/icons/check';
	import Columns3 from '@lucide/svelte/icons/columns-3';
	import Link from '@lucide/svelte/icons/link';
	import ListFilter from '@lucide/svelte/icons/list-filter';
	import Search from '@lucide/svelte/icons/search';
	import X from '@lucide/svelte/icons/x';
	import BarChart from '#lib/components/BarChart.svelte';
	import FilterPanel from '#lib/components/FilterPanel.svelte';
	import TableDownload from '#lib/components/TableDownload.svelte';
	import { backlinkLetter, sourceAnchor } from '#lib/citation-marks.ts';
	import { newTabNoteIdentifier, outsideLinksOpenInNewTab } from '#lib/new-tab-links.ts';
	import {
		entryLabels,
		outcomeLabels,
		recourseAddress,
		recourseChart,
		recourseChips,
		recourseFacets,
		recoursePageSize,
		recourseParts,
		recourseQueryFromAddress,
		recourseSources,
		recourseTable,
		rowsWithWords,
		settingLabels,
		type RecourseChip,
		type RecoursePart,
		type RecourseRow
	} from '#lib/recourse.ts';
	import { facetCounts, filterRows, toggleChoice, type FilterChoices } from '#lib/search-filters.ts';
	import type { PageProps } from './$types';
	import { copyPageLink, replaceAddressSearch } from '#lib/clipboard.ts';

	let { data }: PageProps = $props();

	let allRows = $state<RecourseRow[] | undefined>(undefined);
	let loadFailed = $state(false);
	let text = $state('');
	let choices = $state<FilterChoices>({});
	let shown = $state(recoursePageSize);
	let filtersOpen = $state(false);
	let copyStatus = $state('');
	/** Show as chart (approved mockup, design/data-views): the provisions shown, counted as bars, in place of the list. */
	let asChart = $state(false);
	/** The parts of each provision the reader has hidden with Columns. */
	let hiddenParts = $state<RecoursePart[]>([]);

	const facets = $derived(allRows ? recourseFacets(allRows) : []);
	const withWords = $derived(allRows ? rowsWithWords(allRows, text) : undefined);
	const counts = $derived(withWords ? facetCounts(withWords, facets, choices) : {});
	const matched = $derived(withWords ? filterRows(withWords, facets, choices) : undefined);
	const rows = $derived(matched ? matched.slice(0, shown) : data.firstRows);
	const matchedNations = $derived(matched ? new Set(matched.map((row) => row.nation.id)).size : data.nationCount);
	const chips = $derived(recourseChips(facets, choices));
	const narrowed = $derived(chips.length > 0 || text.trim() !== '');
	const shows = (part: RecoursePart) => !hiddenParts.includes(part);
	const shownParts = $derived(recourseParts.map((part) => part.key).filter((key) => !hiddenParts.includes(key)));
	// Each citation's source marker and the Sources list under the results, for the provisions on screen.
	const cited = $derived(recourseSources(rows));
	// A bar leads to the same list narrowed to it.
	const chart = $derived(
		matched
			? recourseChart(matched, facets, (key, value) => {
					const search = recourseAddress({ text, choices: toggleChoice(choices, key, value, true) }, facets).toString();
					return `/nations/recourse${search ? `?${search}` : ''}`;
				})
			: undefined
	);
	const count = $derived(
		`${(matched?.length ?? data.total).toLocaleString('en-US')} ${(matched?.length ?? data.total) === 1 ? 'provision' : 'provisions'} in ${matchedNations.toLocaleString('en-US')} ${matchedNations === 1 ? 'nation' : 'nations'}`
	);

	function choose(next: FilterChoices) {
		choices = next;
		shown = recoursePageSize;
	}

	/** A chip removes every answer ticked in its filter. */
	function removeChip(chip: RecourseChip) {
		const next = { ...choices };
		delete next[chip.key];
		choose(next);
	}

	function clearAll() {
		text = '';
		choose({});
	}

	function togglePart(part: RecoursePart, on: boolean) {
		hiddenParts = on ? hiddenParts.filter((item) => item !== part) : [...hiddenParts, part];
	}

	// A bar of the chart opens the same page narrowed to it: the list is read again from the address and shown.
	afterNavigate(({ type }) => {
		if (!allRows || type === 'enter') return;
		const query = recourseQueryFromAddress(new URLSearchParams(location.search), facets);
		text = query.text;
		choose(query.choices);
		asChart = false;
	});

	async function copyLink() {
		copyStatus = await copyPageLink();
	}

	// The choices go into the page address as the reader makes them, so a copied link opens the same list.
	$effect(() => {
		if (!allRows) return;
		replaceAddressSearch(recourseAddress({ text, choices }, facets).toString());
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

<span id={newTabNoteIdentifier} hidden>Opens in a new tab</span>

<div class="recourse" {@attach outsideLinksOpenInNewTab}>
	<Breadcrumbs trail={[{ label: 'Nations', href: '/nations' }]} />
	<h1>Find recourse</h1>
	<!-- The approved mockup's lead (design/data-views); the count above the results gives the numbers. -->
	<p class="lead">Search the dispute resolution provisions in Native nations’ own laws. Pick a kind of dispute and a method to see which nations provide it and what their law says.</p>

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
				<!-- The icon and the words inside the box, as the approved mockup has it. -->
				<div class="search-field">
					<label for="recourse-search" class="visually-hidden">Search the text</label>
					<Search aria-hidden="true" class="search-icon" size="1.1em" strokeWidth={1.75} />
					<input
						id="recourse-search"
						type="search"
						autocomplete="off"
						placeholder="Search the text"
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
				{#if narrowed}
					<!-- One chip a filter, its answers together, and Clear all (approved mockup, design/data-views). -->
					<ul class="chips no-print" aria-label="Filters in use">
						{#each chips as chip (chip.key)}
							<li>
								<button type="button" class="chip-button" aria-label="Remove filter {chip.label}: {chip.answers.join(', ')}" onclick={() => removeChip(chip)}>
									<span>{chip.label}: <strong>{chip.answers.join(', ')}</strong></span>
									<X aria-hidden="true" size="1em" />
								</button>
							</li>
						{/each}
						<li><button type="button" class="chip-button clear-all" onclick={clearAll}>Clear all</button></li>
					</ul>
				{/if}
				<div class="result-tools no-print">
					<p class="result-count" role="status">{count}</p>
					<button type="button" class="button button-quiet small-button" aria-pressed={asChart} onclick={() => (asChart = !asChart)}>
						<ChartBar aria-hidden="true" size="1.1em" strokeWidth={1.75} />Show as chart
					</button>
					<details class="columns">
						<summary class="button button-quiet small-button"><Columns3 aria-hidden="true" size="1.1em" strokeWidth={1.75} />Columns</summary>
						<fieldset class="columns-list">
							<legend class="visually-hidden">Show on each provision</legend>
							{#each recourseParts as part (part.key)}
								<label><input type="checkbox" checked={shows(part.key)} onchange={(event) => togglePart(part.key, event.currentTarget.checked)} />{part.label}</label>
							{/each}
						</fieldset>
					</details>
					<!-- Icon only (Trevor, Nov. 23, 2026), as in the data tables. -->
					<button
						type="button"
						class="icon-button"
						aria-label={copyStatus === 'Link copied.' ? 'Link copied' : 'Copy link'}
						title="Copy a link to this list as it is now"
						onclick={copyLink}
					>
						{#if copyStatus === 'Link copied.'}<Check aria-hidden="true" size="1.25em" strokeWidth={1.75} />{:else}<Link
								aria-hidden="true"
								size="1.25em"
								strokeWidth={1.75}
							/>{/if}
					</button>
					<!-- .csv or .xlsx of the provisions found, with the columns shown, as every data table offers (Trevor, Nov. 23, 2026). -->
					<TableDownload name="dispute-resolution-provisions" title="Provisions" table={() => recourseTable(matched ?? [], shownParts)} label="Download the provisions found" />
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

			{#if asChart && chart}
				<div class="result-chart">
					<BarChart {chart} headingLevel={3} />
				</div>
			{:else}
			<ol class="result-list">
				{#each rows as row (row.id)}
					{@const mark = cited.marks.get(row.id)}
					<li class="result">
						<p class="nation">
							<a href="/nations/{row.nation.id}">{row.nation.name}</a>
							{#if shows('states') && row.states.length > 0}<span class="muted states">· {#each row.states as state, index (state)}{index > 0 ? ', ' : ''}{@render tag('state', state, state)}{/each}</span>{/if}
						</p>
						{#if shows('citation')}
							<!-- The citation in italics with its source marker, which leads to the law in Sources below (approved mockup, design/data-views). -->
							<p class="citation small"><i>{row.citation}</i>{#if mark}<sup class="citation"><a id={mark.anchor} class="note-marker" href="#{sourceAnchor(mark.number)}" aria-label="Source {mark.number}">{mark.number}</a></sup>{/if}</p>
						{/if}
						{#if shows('summary')}<p class="summary">{row.summary}</p>{/if}
						<ul class="tags small" aria-label="About this provision">
							{#if shows('method')}<li>{@render tag('method', row.method, row.method)}</li>{/if}
							{#if shows('subject')}<li>{@render tag('subject', row.subject, row.subject)}</li>{/if}
							{#if shows('setting')}<li>{@render tag('setting', row.setting, settingLabels[row.setting] ?? row.setting)}</li>{/if}
							{#if shows('entry')}<li>{@render tag('entry', row.entry, `Starts: ${entryLabels[row.entry] ?? row.entry}`)}</li>{/if}
							{#if shows('outcome')}<li>{@render tag('outcome', row.outcome, `Result: ${outcomeLabels[row.outcome] ?? row.outcome}`)}</li>{/if}
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
			{#if shows('citation') && cited.sources.length > 0}
				<section class="recourse-sources" id="recourse-sources" aria-labelledby="recourse-sources-heading">
					<h2 id="recourse-sources-heading">Sources</h2>
					<ol class="small">
						{#each cited.sources as source (source.number)}
							<li id={sourceAnchor(source.number)} value={source.number}>
								<span class="source-backlinks">{#if source.backlinks.length === 1}<a href="#{source.backlinks[0]}" aria-label="Back to the citation">^</a>{:else}^{#each source.backlinks as backlink, index (backlink)}{' '}<a href="#{backlink}" aria-label="Back to citation {backlinkLetter(index)}">{backlinkLetter(index)}</a>{/each}{/if}</span>
								{source.nation}, {#if source.href}<a href={source.href}><i>{source.title}</i></a>{:else}<i>{source.title}</i>{/if}
							</li>
						{/each}
					</ol>
				</section>
			{/if}
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
		position: relative;
		margin-bottom: var(--space-3);
	}

	.search-field :global(.search-icon) {
		position: absolute;
		top: 50%;
		left: var(--space-3);
		transform: translateY(-50%);
		color: var(--color-ink-muted);
		pointer-events: none;
	}

	.search-field input {
		width: 100%;
		padding-left: calc(var(--space-3) + 1.1em + var(--space-2));
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

	/* Clear all is drawn dashed, set apart from the filters' chips. */
	.chip-button.clear-all {
		border-style: dashed;
		background: transparent;
	}

	.chip-button strong {
		font-weight: var(--font-weight-semibold);
	}

	/* Columns: a short list of checkboxes under its button, over the results. */
	.columns {
		position: relative;
	}

	.columns summary {
		list-style: none;
		cursor: pointer;
	}

	.columns summary::-webkit-details-marker {
		display: none;
	}

	.columns-list {
		position: absolute;
		top: calc(100% + var(--space-1));
		right: 0;
		z-index: 5;
		display: grid;
		gap: var(--space-1);
		min-width: 13rem;
		margin: 0;
		padding: var(--space-3);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-control);
		background: var(--color-paper);
	}

	.columns-list label {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-height: 2rem;
	}

	.button[aria-pressed='true'] {
		color: var(--color-link);
		box-shadow: inset 0 -2px 0 var(--color-link);
	}

	.result-chart {
		margin-top: var(--space-4);
	}

	/* The results column is narrower than the Data and charts page, so the names get less room and the bars more. */
	.result-chart :global(.chart) {
		--label-width: minmax(6rem, 9rem);
	}

	.recourse-sources {
		margin-top: var(--space-5);
		padding-top: var(--space-3);
		border-top: 1px solid var(--color-line);
	}

	.recourse-sources h2 {
		margin: 0 0 var(--space-2);
		font-size: var(--font-size-heading-3);
	}

	.recourse-sources ol {
		margin: 0;
		padding-left: 2.5em;
	}

	.recourse-sources li {
		margin-bottom: var(--space-1);
	}

	.source-backlinks {
		margin-right: var(--space-1);
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
