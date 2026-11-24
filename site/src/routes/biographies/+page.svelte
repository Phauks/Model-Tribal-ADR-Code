<!--
	@component
	Every Native person with a page on this site: people in the cases and
	leaders in nations' histories (Trevor, Nov. 24, 2026).
-->
<script lang="ts">
	import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
	import CountBadge from '#lib/components/CountBadge.svelte';
	import DataTable from '#lib/components/DataTable.svelte';
	import type { TableColumn, TableRow } from '#lib/tables/table-definition.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const columns: TableColumn[] = [
		{ key: 'name', header: 'Name', isRowHeader: true, sortable: true, searchable: true },
		{ key: 'nation', header: 'Nation', sortable: true, filterable: true },
		{ key: 'lead', header: 'Known for', searchable: true },
		{ key: 'cases', header: 'Cases', type: 'number', sortable: true }
	];
	const rows: TableRow[] = $derived(
		data.people.map((person) => ({
			key: person.key,
			cells: {
				name: { text: person.name, href: `/biographies/${person.key}` },
				nation: { text: person.nations.map((nation) => nation.name).join('; '), href: person.nations.length === 1 ? `/nations/${person.nations[0].id}` : undefined },
				lead: { text: person.lead },
				cases: { text: String(person.cases), sortValue: person.cases }
			}
		}))
	);
</script>

<svelte:head>
	<title>Biographies · Model Tribal ADR Code</title>
	<meta name="description" content="Native people in the cases on this site and leaders in nations' histories, each fact with its source." />
</svelte:head>

<Breadcrumbs trail={[{ label: 'Library', href: '/library' }]} />

<h1>Biographies <CountBadge count={data.people.length} /></h1>
<DataTable identifier="biographies" label="Table: Native people with a page on this site" {columns} {rows} rowName={['person', 'people']} download="biographies" filters />
