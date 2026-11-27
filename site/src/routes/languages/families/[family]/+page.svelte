<!--
	A language family's page (src/lib/server/languages.ts): the family's
	Glottolog entry and the languages in it that nations' records name.
	Mockup v2, approved by Trevor on Nov. 27, 2026.
-->
<script lang="ts">
	import CitationMarks from '#lib/components/CitationMarks.svelte';
	import Collapsible from '#lib/components/Collapsible.svelte';
	import DataTable from '#lib/components/DataTable.svelte';
	import InfoPage from '#lib/components/InfoPage.svelte';
	import type { TableColumn, TableRow } from '#lib/tables/table-definition.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const columns: TableColumn[] = [
		{ key: 'language', header: 'Language', isRowHeader: true, sortable: true, searchable: true, custom: true },
		{ key: 'code', header: 'ISO 639-3', sortable: true },
		{ key: 'nations', header: 'Nations', sortable: true }
	];
	const rows: TableRow[] = $derived(data.rows.map((row) => ({ key: row.tag, cells: { language: { text: row.name, href: `/languages/${row.tag}` }, code: { text: row.code }, nations: { text: String(row.nations) } } })));
	const marks = $derived(new Map(data.rows.map((row) => [row.tag, row.citations])));
</script>

<svelte:head><title>{data.title} · Languages · Tribal Law Project</title></svelte:head>

<InfoPage title={data.title} glance={data.glance} sources={data.sources} trail={[{ label: 'Nations', href: '/nations' }, { label: 'Languages', href: '/languages' }]}>
	<Collapsible heading="Languages" identifier="family-languages" count={data.rows.length} class="past-glance">
		<DataTable identifier="family-languages" label="Table: languages in this family" {columns} {rows} defaultSort={{ key: 'language', direction: 'ascending' }} rowName={['language', 'languages']} searchLabel="Search languages">
			{#snippet cell(row: TableRow, column: TableColumn)}
				{#if column.key === 'language'}<span class="marked"><a href={row.cells.language.href}>{row.cells.language.text}</a><CitationMarks marks={marks.get(row.key)} /></span>{/if}
			{/snippet}
		</DataTable>
	</Collapsible>
</InfoPage>

<style>
	/* The table starts under Key facts, at the full width, as mocked. */
	:global(.collapsible.past-glance) {
		clear: both;
	}

	/*
	 * A row can cite several sources, so its markers sit side by side; each is
	 * a full 24 pixel target (WCAG 2.2, 2.5.8), as in the program cell on
	 * nation pages, so neighbors never crowd each other.
	 */
	.marked :global(.note-marker) {
		display: inline-block;
		min-width: 24px;
		min-height: 24px;
		line-height: 24px;
		text-align: center;
		vertical-align: top;
	}

	.marked > a {
		padding-block: 2px;
	}
</style>
