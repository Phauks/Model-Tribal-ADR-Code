<script lang="ts">
	// The site search page (site/DESIGN.md, section 6, "Search"). The page is
	// built ahead of time; in the browser it reads the words from the address
	// (/search?q=…), loads the index built with the site and lists the
	// matches, grouped by kind. Without scripts it says so and offers the
	// ways to browse.
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { replaceState } from '$app/navigation';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import {
		loadSearchIndex,
		searchEntries,
		searchKindLabels,
		type SearchEntry,
		type SearchKind,
		type SearchResult
	} from '#lib/site-search.ts';

	const kinds: SearchKind[] = ['nation', 'story', 'term', 'page'];
	/** Results shown per group before "Show all". */
	const firstShown = 25;

	let entries = $state<SearchEntry[] | undefined>();
	let failed = $state(false);
	let query = $state('');
	let expanded = $state<Partial<Record<SearchKind, boolean>>>({});

	// Follow the address, including a new search from the masthead's box.
	$effect(() => {
		query = page.url.searchParams.get('q') ?? '';
		expanded = {};
	});

	onMount(async () => {
		try {
			entries = await loadSearchIndex();
		} catch {
			failed = true;
		}
	});

	const results = $derived(entries ? searchEntries(entries, query) : []);
	const groups = $derived(
		kinds
			.map((kind) => ({ kind, results: results.filter((result) => result.kind === kind) }))
			.filter((group) => group.results.length > 0)
	);
	const trimmed = $derived(query.trim());
	const status = $derived(
		!entries
			? ''
			: trimmed === ''
				? 'Type a name or a word to search.'
				: `${results.length.toLocaleString('en-US')} ${results.length === 1 ? 'result' : 'results'} for “${trimmed}”`
	);

	function search(event: SubmitEvent) {
		event.preventDefault();
		const url = new URL(page.url.href);
		if (trimmed) url.searchParams.set('q', trimmed);
		else url.searchParams.delete('q');
		replaceState(url, {});
	}

	function shown(kind: SearchKind, list: SearchResult[]): SearchResult[] {
		return expanded[kind] ? list : list.slice(0, firstShown);
	}
</script>

<svelte:head>
	<title>{trimmed ? `“${trimmed}” · ` : ''}Search · Model Tribal ADR Code</title>
</svelte:head>

<div class="reading">
	<h1>Search</h1>

	<form class="search-form needs-scripts" role="search" action="/search" method="get" onsubmit={search}>
		<div class="field">
			<label for="search-page-query">Search nations, glossary terms and pages</label>
			<input id="search-page-query" type="search" name="q" autocomplete="off" bind:value={query} />
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

	<p class="small muted" role="status">{status}</p>

	<!-- Each kind of result is its own group that the reader can fold away (Trevor, Nov. 22, 2026). Groups start open. -->
	{#each groups as group (group.kind)}
		<details class="result-group" open>
			<summary>
				<span class="fold-mark"><ChevronDown size={24} /></span>
				<h2 id="results-{group.kind}">
					{searchKindLabels[group.kind]}
					<span class="muted small">{group.results.length.toLocaleString('en-US')}</span>
				</h2>
			</summary>
			<ol class="results" aria-labelledby="results-{group.kind}">
				{#each shown(group.kind, group.results) as result (result.link)}
					<li>
						<a href={result.link}>{result.title}</a>
						{#if result.matchedName}
							<span class="small muted">(also called {result.matchedName})</span>
						{/if}
						{#if result.detail}<p class="small muted">{result.detail}</p>{/if}
					</li>
				{/each}
			</ol>
			{#if group.results.length > firstShown && !expanded[group.kind]}
				<button class="button button-quiet" type="button" onclick={() => (expanded[group.kind] = true)}>
					Show all {group.results.length.toLocaleString('en-US')}
					{searchKindLabels[group.kind].toLocaleLowerCase('en-US')} results
				</button>
			{/if}
		</details>
	{/each}

	{#if entries && trimmed !== '' && results.length === 0}
		<p>Nothing matches “{trimmed}”. Check the spelling, try fewer words, or browse the <a href="/nations">nations</a> and the <a href="/glossary">glossary</a>.</p>
	{/if}
</div>

<style>
	.result-group {
		margin-top: var(--space-5);
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
		transition: transform 0.15s;
	}

	.result-group:not([open]) .fold-mark {
		transform: rotate(-90deg);
	}

	@media (prefers-reduced-motion: reduce) {
		.fold-mark {
			transition: none;
		}
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
