<script lang="ts">
	import DataTable from '#lib/components/DataTable.svelte';
	import { fileName, verifyLink } from '#lib/checksums.ts';
	import type { TableColumn, TableRow } from '#lib/tables/table-definition.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const columns: TableColumn[] = [
		{ key: 'title', header: 'Document', isRowHeader: true, sortable: true, searchable: true },
		{ key: 'nations', header: 'Nation', sortable: true, searchable: true },
		{ key: 'original', header: 'Published at', sortable: true, searchable: true },
		{ key: 'captured', header: 'Copy made', type: 'date', sortable: true },
		{ key: 'size', header: 'Size', type: 'number', sortable: true },
		{ key: 'verify', header: 'Check', custom: true },
		{ key: 'removal', header: 'Remove', custom: true }
	];

	const rows: TableRow[] = $derived(
		data.copies.map((copy) => ({
			key: copy.key,
			cells: {
				title: { text: `${copy.title} (${copy.kind})`, href: copy.page },
				nations: { text: copy.nations.join('; ') },
				original: { text: new URL(copy.original).hostname, href: copy.original },
				captured: { text: copy.capturedText, sortValue: copy.captured },
				size: { text: copy.size, sortValue: copy.bytes },
				verify: { text: 'SHA-256', href: verifyLink(copy.sha256, fileName(copy.path)) },
				removal: { text: 'Ask to remove', href: copy.removal }
			}
		}))
	);
</script>

<svelte:head>
	<title>{data.title} · Source documents · Model Tribal ADR Code</title>
</svelte:head>

<div class="reading">
	<p class="small"><a href="/copies">Source documents</a></p>
	<h1>{data.title}</h1>
</div>

<DataTable
	identifier="copies"
	label="Table: {data.title}"
	{columns}
	{rows}
	defaultSort={{ key: 'title', direction: 'ascending' }}
	searchLabel="Search this list"
	rowName={['copy', 'copies']}
>
	{#snippet cell(row: TableRow, column: TableColumn)}
		{#if column.key === 'removal'}<a href={row.cells.removal.href}>Ask to remove</a>{/if}
		{#if column.key === 'verify'}<a href={row.cells.verify.href}>SHA-256<span class="visually-hidden">: check a download of {row.cells.title.text}</span></a>{/if}
	{/snippet}
</DataTable>
