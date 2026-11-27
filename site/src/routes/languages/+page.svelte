<!--
	@component
	Every language that nations' records name, each with its own page
	(src/lib/server/languages.ts). The language pages' breadcrumbs lead here.
-->
<script lang="ts">
	import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
	import CountBadge from '#lib/components/CountBadge.svelte';
	import DataTable from '#lib/components/DataTable.svelte';
	import type { TableColumn, TableRow } from '#lib/tables/table-definition.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const columns: TableColumn[] = [
		{ key: 'language', header: 'Language', isRowHeader: true, sortable: true, searchable: true },
		{ key: 'code', header: 'ISO 639-3', sortable: true, searchable: true },
		{ key: 'family', header: 'Language family', sortable: true, filterable: true },
		{ key: 'nations', header: 'Nations', type: 'number', sortable: true }
	];
	const rows: TableRow[] = $derived(
		data.languages.map((language) => ({
			key: language.tag,
			cells: {
				language: { text: language.name, href: `/languages/${language.tag}` },
				code: { text: language.code },
				family: language.family ? { text: language.family.name, href: language.family.href } : { text: 'Isolate' },
				nations: { text: String(language.nations), sortValue: language.nations }
			}
		}))
	);
</script>

<svelte:head>
	<title>Languages · Tribal Law Project</title>
	<meta name="description" content="The languages nations' records name, each with its ISO 639-3 code, its Glottolog entry and the nations that name it." />
</svelte:head>

<Breadcrumbs trail={[{ label: 'Nations', href: '/nations' }]} current="Languages" />

<h1>Languages <CountBadge count={data.languages.length} /></h1>
<DataTable identifier="languages" label="Table: languages nations' records name" {columns} {rows} defaultSort={{ key: 'language', direction: 'ascending' }} rowName={['language', 'languages']} download="languages" filters />
