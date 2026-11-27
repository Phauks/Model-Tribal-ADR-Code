<!--
	@component
	Every court the site names, other than the Supreme Court of the United
	States, which has its own pages (src/lib/server/courts.ts).
-->
<script lang="ts">
	import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
	import CountBadge from '#lib/components/CountBadge.svelte';
	import DataTable from '#lib/components/DataTable.svelte';
	import type { TableColumn, TableRow } from '#lib/tables/table-definition.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const columns: TableColumn[] = [
		{ key: 'name', header: 'Court', isRowHeader: true, sortable: true, searchable: true },
		{ key: 'kind', header: 'Kind', sortable: true, filterable: true },
		{ key: 'nations', header: 'Nation', sortable: true, searchable: true },
		{ key: 'opinions', header: 'Opinions', type: 'number', sortable: true },
		{ key: 'cases', header: 'Cases', type: 'number', sortable: true }
	];
	const rows: TableRow[] = $derived(
		data.courts.map((court) => ({
			key: court.key,
			cells: {
				name: { text: court.name, href: `/courts/${court.key}` },
				kind: { text: court.kind },
				nations: { text: court.nations },
				opinions: { text: court.opinions ? court.opinions.toLocaleString('en-US') : '', sortValue: court.opinions },
				cases: { text: court.cases ? String(court.cases) : '', sortValue: court.cases }
			}
		}))
	);
</script>

<svelte:head>
	<title>Courts · Tribal Law Project</title>
	<meta name="description" content="The Tribal, federal, state and territorial courts whose opinions or cases are on this site." />
</svelte:head>

<Breadcrumbs trail={[{ label: 'Library', href: '/library' }]} current="Courts" />

<h1>Courts <CountBadge count={data.courts.length} /></h1>
<p>The Supreme Court of the United States has <a href="/supreme-court">its own pages</a>.</p>
<DataTable identifier="courts" label="Table: courts named on this site" {columns} {rows} rowName={['court', 'courts']} download="courts" filters />
