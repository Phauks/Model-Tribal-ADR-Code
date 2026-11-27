<!--
	@component
	One federal program: what the nation takes over, its law, rules and the
	agency's own page, and every nation whose record lists it, with the dates,
	the organization that holds it for the nation and the latest amount
	(Trevor, Nov. 26, 2026). Which nations take part comes from the nations'
	records, so References lists the lists those records cite. A program with
	no list yet says None Identified. An info page (site/DESIGN.md, "Info pages").
-->
<script lang="ts">
	import CitationMarks from '#lib/components/CitationMarks.svelte';
	import Collapsible from '#lib/components/Collapsible.svelte';
	import DataTable from '#lib/components/DataTable.svelte';
	import InfoPage from '#lib/components/InfoPage.svelte';
	import { noneIdentified } from '#lib/search-status.ts';
	import type { TableColumn, TableRow } from '#lib/tables/table-definition.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const program = $derived(data.program);
	const glance = $derived(
		[
			{ field: 'agency', label: 'Agency', items: [{ text: program.agency }] },
			{ field: 'department', label: 'Department', items: [{ text: program.department }] },
			{ field: 'law', label: 'Law', items: [{ text: program.law.text, link: program.law.link }] },
			{ field: 'rules', label: 'Rules', items: program.rules ? [{ text: program.rules.text, link: program.rules.link }] : [] },
			{ field: 'nations', label: 'Nations', items: data.count > 0 ? [{ text: data.count.toLocaleString('en-US') }] : [] },
			{ field: 'official', label: 'Official page', items: [{ text: program.official.text, link: program.official.link }] }
		].filter((group) => group.items.length > 0)
	);
	const columns: TableColumn[] = $derived([
		{ key: 'nation', header: 'Nation', isRowHeader: true, sortable: true, searchable: true, custom: true },
		...(data.hasAgency ? [{ key: 'agency', header: 'Agency', sortable: true, searchable: true, filterable: true }] : []),
		{ key: 'dates', header: 'Dates', type: 'date' as const, sortable: true },
		...(data.hasThrough ? [{ key: 'through', header: 'Through', sortable: true, searchable: true }] : []),
		...(data.hasAmount ? [{ key: 'amount', header: 'Latest amount', sortable: true }] : [])
	]);
	const rows: TableRow[] = $derived(
		data.rows.map((row) => ({
			key: row.key,
			cells: {
				nation: { text: row.nation, href: `/nations/${row.id}` },
				agency: { text: row.agency ?? '' },
				dates: { text: row.dates, sortValue: row.datesSort },
				through: { text: row.through ?? '' },
				amount: { text: row.amount ?? '', sortValue: row.amountSort === undefined ? undefined : String(row.amountSort) }
			}
		}))
	);
	const marks = $derived(new Map(data.rows.map((row) => [row.key, row.citations])));
</script>

<svelte:head>
	<title>{program.title} · Nations · Tribal Law Project</title>
</svelte:head>

<InfoPage
	title={program.title}
	lead={program.lead}
	{glance}
	sources={data.sources}
	trail={[
		{ label: 'Nations', href: '/nations' },
		{ label: 'Self-governance and federal programs', href: '/nations/federal-programs' }
	]}
>
	<Collapsible heading="Nations taking part" identifier="nations-taking-part" count={data.count} class="past-glance">
		{#if data.rows.length > 0}
			<DataTable
				identifier="program-{program.key}"
				label="Table: nations taking part"
				{columns}
				{rows}
				defaultSort={{ key: 'nation', direction: 'ascending' }}
				rowName={['nation', 'nations']}
				searchLabel="Search nations"
				download={program.key}
			>
				{#snippet cell(row: TableRow, column: TableColumn)}
					{#if column.key === 'nation'}
						<a href={row.cells.nation.href}>{row.cells.nation.text}</a><CitationMarks marks={marks.get(row.key)} />
					{/if}
				{/snippet}
			</DataTable>
		{:else}
			<p class="muted">{noneIdentified.text}</p>
		{/if}
	</Collapsible>
</InfoPage>

<style>
	/* The table of nations is wide, so it starts under At a glance rather than squeezed beside it. */
	:global(.collapsible.past-glance) {
		clear: both;
	}
</style>
