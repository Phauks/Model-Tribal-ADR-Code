<script lang="ts">
	import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
	import CopyHash from '#lib/components/CopyHash.svelte';
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
				// A redacted opinion has no link to its original, which still has the names in it.
				original: copy.original ? { text: new URL(copy.original).hostname, href: copy.original } : { text: 'Caselaw Access Project' },
				captured: { text: copy.capturedText, sortValue: copy.captured },
				size: { text: copy.size, sortValue: copy.bytes },
				verify: { text: 'SHA-256', href: verifyLink(copy.sha256, fileName(copy.path)) },
				removal: { text: 'Ask to remove', href: copy.removal }
			}
		}))
	);

	// Each copy's SHA-256, copied from the icon after its Verify link (src/lib/copy-hash.ts).
	const hashes = $derived(new Map(data.copies.map((copy) => [copy.key, copy.sha256])));
</script>

<svelte:head>
	<title>{data.title} · Source documents · Model Tribal ADR Code</title>
</svelte:head>

<div class="reading">
	<Breadcrumbs trail={[{ label: 'Source documents', href: '/copies' }]} />
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
		{#if column.key === 'verify'}<a href={row.cells.verify.href}>SHA-256<span class="visually-hidden">: check a download of {row.cells.title.text}</span></a> <CopyHash sha256={hashes.get(row.key) ?? ''} label={row.cells.title.text} iconOnly />{/if}
	{/snippet}
</DataTable>
