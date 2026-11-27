<script lang="ts">
	import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
	import DataTable from '#lib/components/DataTable.svelte';
	import type { TableColumn, TableRow } from '#lib/tables/table-definition.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const number = (value: number) => value.toLocaleString('en-US');
	const hasYears = $derived(data.items.some((item) => item.year));
	// A list whose third column gives each item's years ("1801–1835") needs no Year column too; it still sorts by the first year.
	const yearColumn = $derived(hasYears && data.detailHeader !== 'Years');
	const columns: TableColumn[] = $derived([
		{ key: 'title', header: 'Title', isRowHeader: true, sortable: true, searchable: true },
		...(yearColumn ? [{ key: 'year', header: 'Year', type: 'number' as const, sortable: true, filterable: true }] : []),
		...(data.detailHeader ? [{ key: 'detail', header: data.detailHeader, sortable: true, searchable: true }] : [])
	]);
	const rows: TableRow[] = $derived(
		data.items.map((item, index) => ({
			key: String(index),
			cells: {
				title: { text: item.title, href: item.href },
				year: { text: item.year ? String(item.year) : '', sortValue: item.year ?? 0 },
				detail: { text: item.detail ?? '', sortValue: data.detailHeader === 'Years' ? (item.year ?? 0) : (item.detail ?? '') }
			}
		}))
	);
</script>

<svelte:head>
	<title>{data.title} · Statistics</title>
	<meta name="description" content="Every item counted under {data.title} on the Statistics page." />
</svelte:head>

<div class="collection-page">
	<Breadcrumbs trail={[{ label: 'Library', href: '/library' }, { label: 'Statistics', href: `/stats#${data.identifier}` }]} current={data.title} />
	<h1>{data.title}</h1>
	<p class="summary">
		{number(data.items.length)}{#if data.years}{" · "}<span class="years">{data.years}</span>{/if}{#if data.heldBack}<span class="held">. {number(data.heldBack)} more {data.heldBackReason}.</span>{/if}
	</p>
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

	.summary {
		margin: var(--space-1) 0 var(--space-4);
		color: var(--color-ink-muted);
	}
</style>
