<script lang="ts">
	import DataTable from '#lib/components/DataTable.svelte';
	import type { TableColumn, TableRow } from '#lib/tables/table-definition.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const columns: TableColumn[] = [
		{ key: 'title', header: 'Document', isRowHeader: true, sortable: true, searchable: true },
		{ key: 'original', header: 'Published at', sortable: true, searchable: true },
		{ key: 'captured', header: 'Copy made', type: 'date', sortable: true },
		{ key: 'size', header: 'Size', type: 'number', sortable: true },
		{ key: 'sha256', header: 'SHA-256', custom: true }
	];

	const rows: TableRow[] = $derived(
		data.copies.map((copy) => ({
			key: copy.key,
			cells: {
				title: { text: copy.title, href: copy.path },
				original: { text: new URL(copy.original).hostname, href: copy.original },
				captured: { text: copy.capturedText, sortValue: copy.captured },
				size: { text: copy.size, sortValue: copy.bytes },
				sha256: { text: copy.sha256 }
			}
		}))
	);
</script>

<svelte:head>
	<title>Copies of public documents · Model Tribal ADR Code</title>
</svelte:head>

<div class="reading">
	<h1>Copies of public documents</h1>
	<p class="lead">
		Some sources this site cites are works of the United States government, such as federal statutes and Federal Register notices, which anyone may share (17 U.S.C. § 105). This site keeps its own copy of each one, so it opens quickly and stays available if the government site moves or goes down.
	</p>
	<p>
		The address it was published at is still the source cited, and each copy is byte for byte the file published there on the date shown. The SHA-256 lets anyone check that. Nations’ own laws and constitutions, and anything under copyright, are never copied here; the site links to them where they are published.
	</p>
</div>

{#if data.copies.length > 0}
	<DataTable
		identifier="copies"
		label="Table: copies of public documents"
		{columns}
		{rows}
		defaultSort={{ key: 'title', direction: 'ascending' }}
		searchLabel="Search copies"
		rowName={['copy', 'copies']}
	>
		{#snippet cell(row: TableRow, column: TableColumn)}
			{#if column.key === 'sha256'}<code class="digest">{row.cells.sha256.text}</code>{/if}
		{/snippet}
	</DataTable>
{:else}
	<div class="reading">
		<p>No copies are listed yet.</p>
	</div>
{/if}

<style>
	.digest {
		font-size: 0.8em;
		overflow-wrap: anywhere;
	}
</style>
