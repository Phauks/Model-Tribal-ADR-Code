<script lang="ts">
	import { onMount } from 'svelte';
	import LayoutGrid from '@lucide/svelte/icons/layout-grid';
	import List from '@lucide/svelte/icons/list';
	import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
	import CountBadge from '#lib/components/CountBadge.svelte';
	import DataTable from '#lib/components/DataTable.svelte';
	import { navigationSectionOf } from '#lib/site-navigation.ts';
	import type { TableColumn, TableRow } from '#lib/tables/table-definition.ts';
	import type { Holding } from '#lib/holding.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	// A list that is a page of another section's menu, such as Treaties and Agreements in Federal Law, sits under that section's own page; the rest sit under the Library's Statistics.
	const section = $derived(navigationSectionOf(`/stats/${data.identifier}`));
	const trail = $derived(
		section?.home && section.key !== 'library'
			? [{ label: section.title ?? section.label, href: section.home }]
			: [
					{ label: 'Library', href: '/library' },
					{ label: 'Statistics', href: `/stats#${data.identifier}` }
				]
	);
	const number = (value: number) => value.toLocaleString('en-US');
	// A list with portraits, the U.S. Presidents, opens on them; the table is a switch away (Trevor, Nov. 27, 2026, design/presidents-portraits).
	// A shared link that sets the table's search, sort or filters opens on the table instead.
	let view = $state<'portraits' | 'table'>('portraits');
	const showPortraits = $derived(Boolean(data.portraits) && view === 'portraits');
	onMount(() => {
		if ([...new URLSearchParams(location.search).keys()].some((name) => name.startsWith(`${data.identifier}.`))) view = 'table';
	});
	const hasYears = $derived(data.items.some((item) => item.year));
	// A list whose third column gives each item's years ("1801–1835") needs no Year column too; it still sorts by the first year.
	const yearColumn = $derived(hasYears && data.detailHeader !== 'Years');
	// Copies counted apart (Trevor, Nov. 27, 2026): a list of nations gives each one's documents, pages and saved web pages;
	// a list of documents says what the site keeps of each.
	const holdings = $derived(data.items.map((item) => ('holding' in item ? (item.holding as Holding) : undefined)));
	const copyText = (holding: Holding | undefined) =>
		!holding ? 'Without a copy' : holding.documents ? (holding.pages ? `Document, ${number(holding.pages)} ${holding.pages === 1 ? 'page' : 'pages'}` : 'Document') : 'Saved web page';
	// A list of numbered sections gives each section's citation a column of its own, in the Code's order (Trevor, Nov. 27, 2026).
	const hasCitations = $derived(data.items.some((item) => item.citation));
	// Numbers sort as numbers, so § 13 comes before § 13-1 and § 450f before § 5321.
	const inCodeOrder = (citation: string) => citation.replace(/\d+/g, (digits) => digits.padStart(6, '0'));
	const columns: TableColumn[] = $derived([
		...(hasCitations ? [{ key: 'citation', header: 'Section', sortable: true, searchable: true }] : []),
		{ key: 'title', header: hasCitations ? 'Name' : 'Title', isRowHeader: true, sortable: true, searchable: true },
		...(yearColumn ? [{ key: 'year', header: 'Year', type: 'number' as const, sortable: true, filterable: true }] : []),
		...(data.detailHeader ? [{ key: 'detail', header: data.detailHeader, sortable: true, searchable: true }] : []),
		...(data.copyColumns === 'copy' ? [{ key: 'copy', header: 'Copy', sortable: true, filterable: true }] : []),
		...(data.copyColumns === 'counts'
			? [
					{ key: 'documents', header: 'Documents', type: 'number' as const, sortable: true },
					{ key: 'pages', header: 'Pages', type: 'number' as const, sortable: true },
					{ key: 'webPages', header: 'Saved web pages', type: 'number' as const, sortable: true }
				]
			: [])
	]);
	const count = (value: number | undefined) => ({ text: value ? number(value) : '', sortValue: value ?? 0 });
	const rows: TableRow[] = $derived(
		data.items.map((item, index) => ({
			key: String(index),
			cells: {
				citation: { text: item.citation ?? '', sortValue: inCodeOrder(item.citation ?? '') },
				title: { text: item.title, href: item.href },
				year: { text: item.year ? String(item.year) : '', sortValue: item.year ?? 0 },
				detail: { text: item.detail ?? '', sortValue: data.detailHeader === 'Years' ? (item.year ?? 0) : (item.detail ?? '') },
				documents: count(holdings[index]?.documents),
				pages: count(holdings[index]?.pages),
				webPages: count(holdings[index]?.webPages),
				copy: { text: copyText(holdings[index]), sortValue: holdings[index]?.documents ? 2 + (holdings[index]?.pages ?? 0) : holdings[index] ? 1 : 0 }
			}
		}))
	);
</script>

<svelte:head>
	<title>{data.title} · Statistics</title>
	<meta name="description" content="Every item counted under {data.title} on the Statistics page." />
</svelte:head>

<div class="collection-page">
	<Breadcrumbs {trail} current={data.title} />
	<h1 class:alone={!data.years && !data.breakdown && !data.heldBack}>{data.title}</h1>
	<!-- No count here: the table's "Showing N of N items" already gives it (Trevor, Nov. 27, 2026). The parts of the number follow the years. -->
	{#if data.years || data.breakdown || data.heldBack}
		<p class="summary">
			{#if data.years}<span class="years">{data.years}</span>{/if}{#if data.years && data.breakdown}{' · '}{/if}{data.breakdown?.join(' · ') ?? ''}{#if (data.years || data.breakdown) && data.heldBack}{'. '}{/if}{#if data.heldBack}<span class="held">{number(data.heldBack)} more {data.heldBackReason}.</span>{/if}
		</p>
	{/if}
	{#if data.related}<p class="related"><a href={data.related.href}>{data.related.label}</a></p>{/if}
	{#if data.portraits}
		<div class="view-switch no-print" role="group" aria-label="View">
			<button type="button" aria-pressed={view === 'portraits'} onclick={() => (view = 'portraits')}><LayoutGrid size={16} aria-hidden="true" />Portraits</button>
			<button type="button" aria-pressed={view === 'table'} onclick={() => (view = 'table')}><List size={16} aria-hidden="true" />Table</button>
		</div>
		{#if showPortraits}
			{#each data.portraits as era (era.id)}
				<section class="era" aria-labelledby={era.id}>
					<h2 id={era.id}>{era.title} <span class="era-years">{era.years}</span><CountBadge count={era.presidents.length} /></h2>
					<ul class="portraits">
						{#each era.presidents as president (president.key)}
							<li>
								<a href={president.link}>
									{#if president.portrait}
										<img src={president.portrait.src} alt="" width={president.portrait.width} height={president.portrait.height} loading="lazy" decoding="async" />
									{:else}
										<span class="no-portrait" aria-hidden="true"></span>
									{/if}
									<span class="name">{president.name}</span>
									<span class="line">{president.years}{#if president.justices}{' · '}{president.justices} {president.justices === 1 ? 'Justice' : 'Justices'}{/if}</span>
								</a>
							</li>
						{/each}
					</ul>
				</section>
			{/each}
		{/if}
	{/if}
	<div class="table-view" hidden={showPortraits}>
	<DataTable
		identifier={data.identifier}
		label="Table: {data.title}"
		{columns}
		{rows}
		filters
		shareable
		download={data.identifier}
		defaultSort={hasCitations ? { key: 'citation', direction: 'ascending' } : yearColumn ? { key: 'year', direction: 'ascending' } : hasYears ? { key: 'detail', direction: 'ascending' } : { key: 'title', direction: 'ascending' }}
		rowName={['item', 'items']}
	/>
	</div>
</div>

<style>
	.collection-page {
		max-width: var(--layout-measure);
	}

	h1 {
		margin-bottom: 0;
	}

	h1.alone {
		margin-bottom: var(--space-4);
	}

	.view-switch {
		display: inline-flex;
		margin-bottom: var(--space-5);
		border: 1px solid var(--color-control-border);
		border-radius: 999px;
		overflow: hidden;
	}

	.view-switch button {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		min-height: 2rem;
		padding: 0 var(--space-3);
		border: 0;
		background: var(--color-paper);
		color: var(--color-ink);
		font: inherit;
		font-weight: var(--font-weight-semibold);
		cursor: pointer;
	}

	.view-switch button + button {
		border-left: 1px solid var(--color-control-border);
	}

	.view-switch button[aria-pressed='true'] {
		background: var(--color-action);
		color: var(--color-action-text);
	}

	.era {
		margin-bottom: var(--space-6);
	}

	.era h2 {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--space-2);
		margin: 0 0 var(--space-3);
		padding-bottom: var(--space-2);
		border-bottom: 1px solid var(--color-line);
		font-size: 1.125rem;
	}

	.era-years {
		color: var(--color-ink-muted);
		font-size: 0.875rem;
		font-weight: normal;
	}

	.portraits {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: var(--space-5) var(--space-4);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.portraits a {
		display: block;
		color: inherit;
		text-decoration: none;
	}

	.portraits img,
	.no-portrait {
		display: block;
		width: 100%;
		height: auto;
		aspect-ratio: 4 / 5;
		object-fit: cover;
		object-position: 50% 20%;
		border: 1px solid var(--color-line);
		border-radius: var(--radius-panel);
		background: var(--color-surface);
	}

	.name {
		display: block;
		margin-top: var(--space-2);
		font-weight: var(--font-weight-semibold);
		line-height: 1.25;
	}

	.portraits a:hover .name,
	.portraits a:focus-visible .name {
		text-decoration: underline;
	}

	.line {
		display: block;
		margin-top: 2px;
		color: var(--color-ink-muted);
		font-size: 0.8125rem;
		font-variant-numeric: tabular-nums;
	}

	@media (max-width: 600px) {
		.portraits {
			grid-template-columns: repeat(2, 1fr);
			gap: var(--space-4) var(--space-3);
		}
	}

	.summary {
		margin: var(--space-1) 0 var(--space-4);
		color: var(--color-ink-muted);
	}
</style>
