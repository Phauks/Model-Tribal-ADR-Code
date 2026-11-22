<!--
	@component
	The site search box in the masthead (site/DESIGN.md, section 6,
	"Search"). It is a plain form that opens /search?q=…, so it works as a
	link even before the page's scripts run; the search page then finds the
	matches in the index built with the site (src/lib/site-search.ts). On the
	search page the box shows what was searched for.
-->
<script lang="ts">
	import { page } from '$app/state';
	import Search from '@lucide/svelte/icons/search';

	let { identifier = 'site-search' }: { identifier?: string } = $props();

	let query = $state('');

	// Prerendered pages cannot read the address's query while they are built,
	// so the box is filled in the browser only.
	$effect(() => {
		if (page.url.pathname === '/search') query = page.url.searchParams.get('q') ?? '';
	});
</script>

<form class="site-search" role="search" action="/search" method="get" data-sveltekit-keepfocus>
	<label class="visually-hidden" for={identifier}>Search nations, glossary and pages</label>
	<input
		id={identifier}
		type="search"
		name="q"
		autocomplete="off"
		enterkeyhint="search"
		placeholder="Search the site"
		bind:value={query}
	/>
	<button type="submit">
		<Search size={20} strokeWidth={1.75} />
		<span>Search</span>
	</button>
</form>

<style>
	.site-search {
		display: flex;
		align-items: stretch;
		width: 100%;
		max-width: 32rem;
	}

	.site-search input {
		flex: 1 1 auto;
		min-width: 0;
		min-height: var(--layout-target-minimum);
		margin: 0;
		border: 2px solid var(--color-band-text);
		border-right: 0;
		border-radius: var(--radius-control) 0 0 var(--radius-control);
		background: var(--color-paper);
		color: var(--color-ink);
	}

	.site-search input::placeholder {
		color: var(--color-ink-muted);
		opacity: 1;
	}

	.site-search button {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--layout-target-minimum);
		padding: 0 var(--space-3);
		border: 2px solid var(--color-band-text);
		border-left: 1px solid var(--color-control-border);
		border-radius: 0 var(--radius-control) var(--radius-control) 0;
		background: var(--color-band-text);
		color: var(--color-band);
		font: inherit;
		font-weight: var(--font-weight-semibold);
		cursor: pointer;
	}
</style>
