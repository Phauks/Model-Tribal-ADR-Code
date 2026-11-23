<script lang="ts">
	import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
	import DataTable from '#lib/components/DataTable.svelte';
	import { readableDate } from '#lib/readable-date.ts';
	import type { TableColumn, TableRow } from '#lib/tables/table-definition.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const columns: TableColumn[] = [
		{ key: 'name', header: 'Case', isRowHeader: true, sortable: true, searchable: true },
		{ key: 'court', header: 'Court', sortable: true, searchable: true, filterable: true },
		{ key: 'decided', header: 'Decided', type: 'date', sortable: true },
		{ key: 'citation', header: 'Citation', sortable: true, searchable: true },
		{ key: 'topics', header: 'Mentions', sortable: true, searchable: true },
		{ key: 'removal', header: 'Remove', custom: true }
	];

	const rows: TableRow[] = $derived(
		data.opinions.map((opinion) => ({
			key: opinion.path,
			cells: {
				name: { text: opinion.name, href: opinion.path },
				court: { text: opinion.court },
				decided: { text: readableDate(opinion.decided), sortValue: opinion.decided },
				citation: { text: opinion.docket ? `${opinion.citation} (${opinion.docket})` : opinion.citation },
				topics: { text: opinion.topics.join(', ') },
				removal: { text: 'Ask to remove', href: opinion.removal }
			}
		}))
	);
</script>

<svelte:head>
	<title>Court opinions · {data.nation.name} · Model Tribal ADR Code</title>
</svelte:head>

<div class="reading">
	<Breadcrumbs
		trail={[
			{ label: 'Nations', href: '/nations' },
			{ label: data.nation.name, href: `/nations/${data.nation.id}` }
		]}
	/>
	<h1>Court opinions: {data.nation.name}</h1>
	<p>
		These are the opinions of courts serving the nation that are published in the American Tribal Law Reporter or the Navajo Reporter, as the Caselaw Access Project at Harvard Law School Library released them in 2024. Each opens as its own page, with the publisher’s headnotes removed.
	</p>
	<p>
		“Mentions” lists words the opinion uses, such as peacemaking, mediation or custom and tradition. It does not say what the court decided about them.
	</p>
</div>

<DataTable
	identifier="opinions"
	label="Table: court opinions, {data.nation.name}"
	{columns}
	{rows}
	defaultSort={{ key: 'decided', direction: 'descending' }}
	searchLabel="Search these opinions"
	rowName={['opinion', 'opinions']}
>
	{#snippet cell(row: TableRow, column: TableColumn)}
		{#if column.key === 'removal'}<a href={row.cells.removal.href}>Ask to remove</a>{/if}
	{/snippet}
</DataTable>
