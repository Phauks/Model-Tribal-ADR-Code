<!--
	A language's page (src/lib/server/languages.ts): its other names, Key facts,
	the nations whose records name it, a map of them, its dialects, related
	languages and the grammars and dictionaries Glottolog lists. Mockup v2,
	approved by Trevor on Nov. 27, 2026.
-->
<script lang="ts">
	import CitationMarks from '#lib/components/CitationMarks.svelte';
	import Collapsible from '#lib/components/Collapsible.svelte';
	import DataTable from '#lib/components/DataTable.svelte';
	import FactGroups from '#lib/components/FactGroups.svelte';
	import InfoPage from '#lib/components/InfoPage.svelte';
	import NationMap from '#lib/components/NationMap.svelte';
	import { noneIdentified } from '#lib/search-status.ts';
	import type { TableColumn, TableRow } from '#lib/tables/table-definition.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const columns: TableColumn[] = [
		{ key: 'nation', header: 'Nation', isRowHeader: true, sortable: true, searchable: true, custom: true },
		{ key: 'name', header: 'Name in the record', sortable: true, searchable: true, custom: true },
		{ key: 'program', header: 'Language program', sortable: true, custom: true }
	];
	const rows: TableRow[] = $derived(
		data.rows.map((row) => ({
			key: row.key,
			cells: {
				nation: { text: row.nation, href: `/nations/${row.id}` },
				name: { text: row.name },
				program: { text: row.program?.name ?? noneIdentified.text, href: row.program?.link }
			}
		}))
	);
	const marks = $derived(new Map(data.rows.map((row) => [row.key, row.citations])));
	const programs = $derived(new Map(data.rows.map((row) => [row.key, row.program])));
	const workColumns: TableColumn[] = [
		{ key: 'year', header: 'Year', sortable: true },
		{ key: 'work', header: 'Work', isRowHeader: true, sortable: true, searchable: true, custom: true },
		{ key: 'kind', header: 'Kind', sortable: true, filterable: true },
		{ key: 'pages', header: 'Pages', sortable: true }
	];
	const workRows: TableRow[] = $derived(
		data.works.map((work) => ({
			key: work.glottolog_reference,
			cells: {
				year: { text: work.year ? String(work.year) : '' },
				work: { text: work.title, href: `https://glottolog.org/resource/reference/id/${work.glottolog_reference}` },
				kind: { text: work.kind },
				pages: { text: work.pages ? String(work.pages) : '' }
			}
		}))
	);
	const works = $derived(new Map(data.works.map((work) => [work.glottolog_reference, work])));
	const relatedColumns: TableColumn[] = [
		{ key: 'language', header: 'Language', isRowHeader: true, sortable: true, searchable: true, custom: true },
		{ key: 'nations', header: 'Nations', sortable: true }
	];
	const relatedRows: TableRow[] = $derived(
		data.related.map((language) => ({ key: language.tag, cells: { language: { text: language.name, href: `/languages/${language.tag}` }, nations: { text: String(language.nations) } } }))
	);
</script>

<svelte:head>
	<title>{data.title} · Languages · Tribal Law Project</title>
</svelte:head>

<InfoPage
	title={data.title}
	names={data.names}
	glance={data.glance}
	sources={data.sources}
	trail={[{ label: 'Nations', href: '/nations' }, { label: 'Languages', href: '/languages' }]}
>
	<Collapsible heading="Nations that name this language" identifier="nations-naming" count={data.count} class="past-glance">
		<DataTable identifier="language-nations" label="Table: nations that name this language" {columns} {rows} defaultSort={{ key: 'nation', direction: 'ascending' }} rowName={['nation', 'nations']} searchLabel="Search nations">
			{#snippet cell(row: TableRow, column: TableColumn)}
				{#if column.key === 'nation'}
					<a href={row.cells.nation.href}>{row.cells.nation.text}</a>
				{:else if column.key === 'name'}
					<span class="marked">{row.cells.name.text}<CitationMarks marks={marks.get(row.key)} /></span>
				{:else if column.key === 'program'}
					{@const program = programs.get(row.key)}
					{#if program}<span class="marked"><a href={program.link}>{program.name}</a><CitationMarks marks={program.citations} /></span>{:else}<span class="muted">{noneIdentified.text}</span>{/if}
				{/if}
			{/snippet}
		</DataTable>
	</Collapsible>
	{#if data.map}
		<Collapsible heading="Map" identifier="language-map">
			<NationMap map={data.map} nationName="the nations that name {data.title}" />
		</Collapsible>
	{/if}
	<Collapsible heading={data.dialectsHeading} identifier="dialects" count={data.dialects.length}>
		{#if data.dialects.length > 0}
			<FactGroups groups={data.dialects.map((dialect) => ({ field: dialect.glottocode, label: dialect.name, items: [{ text: dialect.glottocode, link: `https://glottolog.org/resource/languoid/id/${dialect.glottocode}`, citations: dialect.citations }] }))} />
		{:else}
			<p class="muted">{noneIdentified.text}</p>
		{/if}
	</Collapsible>
	<Collapsible heading="Related languages" identifier="related" count={data.related.length}>
		{#if data.languageFamily}<p>Other languages of the <a href={data.languageFamily.href}>{data.languageFamily.name}</a> family that nations’ records name.</p>{/if}
		{#if data.related.length > 0}
			<DataTable identifier="related-languages" label="Table: related languages" columns={relatedColumns} rows={relatedRows} defaultSort={{ key: 'language', direction: 'ascending' }} rowName={['language', 'languages']} searchLabel="Search languages">
				{#snippet cell(row: TableRow, column: TableColumn)}
					{#if column.key === 'language'}<a href={row.cells.language.href}>{row.cells.language.text}</a>{/if}
				{/snippet}
			</DataTable>
		{:else}
			<p class="muted">{noneIdentified.text}</p>
		{/if}
	</Collapsible>
	<Collapsible heading="Grammars and dictionaries" identifier="grammars" count={data.works.length}>
		{#if data.works.length === 0}
			<p class="muted">{noneIdentified.text}</p>
		{:else}
		<DataTable identifier="language-works" label="Table: grammars and dictionaries" columns={workColumns} rows={workRows} defaultSort={{ key: 'year', direction: 'descending' }} rowName={['work', 'works']} searchLabel="Search works">
			{#snippet cell(row: TableRow, column: TableColumn)}
				{#if column.key === 'work'}
					{@const work = works.get(row.key)}
					<span class="marked"><a href={row.cells.work.href}>{row.cells.work.text}</a><CitationMarks marks={work?.citations} /></span>{#if work?.author || work?.publisher}<br /><span class="muted small">{[work.author, work.publisher].filter(Boolean).join(', ')}</span>{/if}
				{/if}
			{/snippet}
		</DataTable>
		{/if}
	</Collapsible>
</InfoPage>

<style>
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
