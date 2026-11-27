<script lang="ts">
	import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
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
	const hasYears = $derived(data.items.some((item) => item.year));
	// A list whose third column gives each item's years ("1801–1835") needs no Year column too; it still sorts by the first year.
	const yearColumn = $derived(hasYears && data.detailHeader !== 'Years');
	// Copies counted apart (Trevor, Nov. 27, 2026): a list of nations gives each one's documents, pages and saved web pages;
	// a list of documents says what the site keeps of each.
	const holdings = $derived(data.items.map((item) => ('holding' in item ? (item.holding as Holding) : undefined)));
	const copyText = (holding: Holding | undefined) =>
		!holding ? 'Without a copy' : holding.documents ? (holding.pages ? `Document, ${number(holding.pages)} ${holding.pages === 1 ? 'page' : 'pages'}` : 'Document') : 'Saved web page';
	const columns: TableColumn[] = $derived([
		{ key: 'title', header: 'Title', isRowHeader: true, sortable: true, searchable: true },
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
	<DataTable
		identifier={data.identifier}
		label="Table: {data.title}"
		{columns}
		{rows}
		filters
		shareable
		download={data.identifier}
		defaultSort={yearColumn ? { key: 'year', direction: 'ascending' } : hasYears ? { key: 'detail', direction: 'ascending' } : { key: 'title', direction: 'ascending' }}
		rowName={['item', 'items']}
	/>
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

	.summary {
		margin: var(--space-1) 0 var(--space-4);
		color: var(--color-ink-muted);
	}
</style>
