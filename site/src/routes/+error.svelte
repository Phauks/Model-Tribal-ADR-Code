<script lang="ts">
	// The Page not found and Something went wrong pages (site/ERRORS.md; mockups 8 to 11 in
	// project files design/error-framework/, approved by Trevor on Nov. 27, 2026). Both name
	// the address, offer the home page, Try again and Report, and keep the site's frame.
	// Page not found lists pages with a similar address and has no search box.
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Copy from '@lucide/svelte/icons/copy';
	import Flag from '@lucide/svelte/icons/flag';
	import House from '@lucide/svelte/icons/house';
	import RotateCw from '@lucide/svelte/icons/rotate-cw';
	import Search from '@lucide/svelte/icons/search';
	import { copyText } from '#lib/clipboard.ts';
	import { openReport, reportedAddress, reportLink, type ReportPreset } from '#lib/report-request.ts';
	import type { PanelAnswer } from '#lib/search-everything.ts';
	import { similarCount, similarPages, similarQuery, type SimilarPage } from '#lib/similar-pages.ts';

	const notFound = $derived(page.status === 404);
	const shownAddress = $derived(`${page.url.host}${page.url.pathname}`);
	const here = $derived(`${page.url.pathname}${page.url.search}`);
	const reference = $derived(page.error?.reference);
	const report: ReportPreset = $derived({
		kind: 'broken-page',
		material: reportedAddress(page.url),
		details: [
			notFound ? 'This address did not open a page.' : 'The page could not be shown.',
			reference ? `Reference ${reference}` : ''
		]
			.filter(Boolean)
			.join('\n')
	});

	let similar: SimilarPage[] = $state([]);
	let copied = $state(false);

	/** Searches as the masthead does: the server first, and the search files when the server cannot answer yet. */
	async function search(query: string): Promise<PanelAnswer | undefined> {
		const response = await fetch(`/search/query?q=${encodeURIComponent(query)}`);
		if (response.ok) return (await response.json()) as PanelAnswer;
		const [{ loadSearchIndex, prepareSearchIndex }, { loadSearchRecords }, { matchEverything, panelAnswer }] = await Promise.all([
			import('#lib/site-search.ts'),
			import('#lib/search-records.ts'),
			import('#lib/search-everything.ts')
		]);
		const [index, records] = await Promise.all([loadSearchIndex(), loadSearchRecords()]);
		await prepareSearchIndex(index);
		return panelAnswer(matchEverything(index, records, query), similarCount);
	}

	onMount(async () => {
		if (page.status !== 404) return;
		const query = similarQuery(page.url.pathname);
		if (!query) return;
		try {
			const answer = await search(query);
			if (answer) similar = similarPages(answer, page.url.pathname);
		} catch {
			// expected: offline, or the search files would not load; the list is left out and the page still offers the home page and Report.
		}
	});

	function reportClicked(event: MouseEvent): void {
		event.preventDefault();
		openReport(report);
	}

	async function copyReference(): Promise<void> {
		if (!reference) return;
		try {
			await copyText(reference);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			// expected: the reference stays on screen to copy by hand when the browser refuses.
		}
	}
</script>

<svelte:head>
	<title>{notFound ? 'Page not found' : page.status === 403 ? 'Not allowed' : 'Something went wrong'} · Tribal Law Project</title>
</svelte:head>

{#snippet homeButton(primary: boolean)}
	<a class="button {primary ? '' : 'button-quiet'}" href="/"><House size={18} aria-hidden="true" />Home page</a>
{/snippet}
{#snippet tryAgainButton(primary: boolean)}
	<a class="button {primary ? '' : 'button-quiet'}" href={here} data-sveltekit-reload><RotateCw size={18} aria-hidden="true" />Try again</a>
{/snippet}
{#snippet reportButton()}
	<a class="button button-quiet" href={reportLink(report)} onclick={reportClicked}><Flag size={18} aria-hidden="true" />Report</a>
{/snippet}

<div class="reading error-page">
	{#if notFound}
		<h1>Page not found</h1>
		<p>No page has this address:</p>
		<p class="address">{shownAddress}</p>
		{#if similar.length > 0}
			<h2>Pages with a similar address</h2>
			<ul class="similar">
				{#each similar as result (result.link)}
					<li>
						<a href={result.link}>
							<span>{result.title}</span>
							{#if result.detail}<span class="kind">{result.detail}</span>{/if}
							<ChevronRight size={18} aria-hidden="true" />
						</a>
					</li>
				{/each}
			</ul>
		{/if}
		<div class="actions">
			{@render homeButton(true)}
			{@render tryAgainButton(false)}
			{@render reportButton()}
		</div>
	{:else if page.status === 403}
		<h1>Not allowed</h1>
		<p>{page.error?.message}</p>
		<p>If you think you should have access, ask the lead author.</p>
		<div class="actions">{@render homeButton(true)}</div>
	{:else}
		<div role="alert">
			<h1>Something went wrong</h1>
			<!-- Messages the site wrote itself, such as "Sign-in is not available right now", are shown; others are not. -->
			<p>{page.status === 500 ? 'The page could not be shown. Try again in a moment.' : page.error?.message}</p>
			<p class="address">{shownAddress}</p>
			<div class="actions">
				{@render tryAgainButton(true)}
				{@render homeButton(false)}
				{@render reportButton()}
			</div>
			{#if reference}
				<div class="reference">
					Reference <code>{reference}</code>
					<button class="icon-button" type="button" aria-label={copied ? 'Reference copied' : 'Copy the reference'} title={copied ? 'Copied' : 'Copy the reference'} onclick={copyReference}><Copy size={16} aria-hidden="true" /></button>
				</div>
			{/if}
		</div>
		<label class="search-label" for="error-search">Search the site</label>
		<form class="search" action="/search" method="get" role="search">
			<input id="error-search" type="search" name="q" />
			<button class="button" type="submit"><Search size={18} aria-hidden="true" />Search</button>
		</form>
	{/if}
</div>

<style>
	.error-page h1 {
		margin: 0 0 1rem;
	}

	.error-page p {
		margin: 0 0 0.5rem;
	}

	.address {
		display: inline-block;
		margin: 0.25rem 0 1.25rem;
		padding: 0.35rem 0.6rem;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 0.95rem;
		word-break: break-all;
		background: var(--color-surface);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-control);
	}

	h2 {
		margin: 1.5rem 0 0.25rem;
		font-size: 1.125rem;
	}

	.similar {
		margin: 0.25rem 0 1.5rem;
		padding: 0;
		list-style: none;
		border-top: 1px solid var(--color-line);
	}

	.similar li {
		border-bottom: 1px solid var(--color-line);
	}

	.similar a {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.6rem 0.25rem;
		color: var(--color-link);
		text-decoration: none;
	}

	.similar .kind {
		margin-left: auto;
		font-size: 0.875rem;
		color: var(--color-ink-muted);
		text-align: right;
	}

	.similar a :global(svg) {
		flex: none;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem;
	}

	.actions .button {
		gap: 0.5rem;
	}

	.reference {
		display: inline-flex;
		align-items: center;
		gap: 0.15rem;
		margin-top: 1rem;
		font-size: 0.875rem;
		color: var(--color-ink-muted);
	}

	.reference code {
		font-family: inherit;
		font-variant-numeric: tabular-nums;
		letter-spacing: 0.02em;
	}

	.reference .icon-button {
		min-width: 32px;
		min-height: 32px;
	}

	.search-label {
		display: block;
		margin-top: 1.5rem;
		font-weight: 700;
	}

	.search {
		display: flex;
		gap: 0.5rem;
		max-width: 36rem;
		margin: 0.5rem 0 1.5rem;
	}

	.search input {
		flex: 1;
		min-width: 0;
		min-height: 44px;
		padding: 0.4rem 0.75rem;
		font: inherit;
		color: var(--color-ink);
		background: var(--color-paper);
		border: 2px solid var(--color-control-border);
		border-radius: var(--radius-control);
	}

	.search .button {
		gap: 0.5rem;
	}
</style>
