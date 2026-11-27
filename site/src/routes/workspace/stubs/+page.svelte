<!--
	@component
	Workspace › Stubs (Trevor approved the mockup on Nov. 24, 2026,
	design/stub-pages/): every stub on the site, most mentioned first, as
	Wikipedia lists its stubs and wanted pages for editors. A court's page is
	made from the opinions and cases that name it; a case's or law's page is
	short when its record has no box yet, and a person's page when it holds
	only the treaties the person signed. Expand opens the request form for
	that page (src/lib/stubs.ts).
-->
<script lang="ts">
	import Pencil from '@lucide/svelte/icons/pencil';
	import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
	import CountBadge from '#lib/components/CountBadge.svelte';
	import DataTable from '#lib/components/DataTable.svelte';
	import { stubRequestLink } from '#lib/stubs.ts';
	import type { TableColumn, TableRow } from '#lib/tables/table-definition.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const kindLabels = { court: 'Court', case: 'Case', law: 'Law', person: 'Person' } as const;
	const madeLabels = { references: 'Made from references', short: 'Short page' } as const;

	const columns: TableColumn[] = [
		{ key: 'name', header: 'Page', isRowHeader: true, sortable: true, searchable: true },
		{ key: 'kind', header: 'Kind', sortable: true, filterable: true },
		{ key: 'made', header: 'Stub', sortable: true, filterable: true },
		{ key: 'mentions', header: 'Mentioned by', type: 'number', sortable: true },
		{ key: 'expand', header: 'Expand', custom: true, hiddenHeader: true }
	];
	const rows: TableRow[] = $derived(
		data.stubs.map((stub) => ({
			key: stub.link,
			cells: {
				name: { text: stub.name, href: stub.link },
				kind: { text: kindLabels[stub.kind] },
				made: { text: madeLabels[stub.made] },
				mentions: { text: stub.mentionsText, sortValue: stub.mentions },
				expand: { text: 'Expand', href: stubRequestLink(stub, 'write-up') }
			}
		}))
	);
	const byLink = $derived(new Map(data.stubs.map((stub) => [stub.link, stub])));
</script>

<svelte:head>
	<title>Stubs · Workspace · Tribal Law Project</title>
</svelte:head>

<Breadcrumbs trail={[{ label: 'Workspace', href: '/workspace' }]} current="Stubs" />

<h1>Stubs <CountBadge count={data.stubs.length} /></h1>
<p class="lead">Pages made from references, and pages too short to stand alone, most mentioned first.</p>

<DataTable identifier="stubs" label="Table: stubs on this site" {columns} {rows} rowName={['stub', 'stubs']} download="stubs" filters>
	{#snippet cell(row: TableRow, column: TableColumn)}
		{@const stub = byLink.get(row.key)}
		{#if stub && column.key === 'expand'}<a class="icon-button" href={stubRequestLink(stub, 'write-up')} aria-label="Expand {stub.name}" title="Expand"><Pencil size={18} aria-hidden="true" /></a>{/if}
	{/snippet}
</DataTable>
