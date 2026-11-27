<!--
	@component
	One President who appointed a Justice of the Supreme Court of the United
	States (Trevor, Nov. 24, 2026: "sub-pages for each justice and appointed by
	person to show their relationship to cases and such", "want pictures"). A
	record page: the portrait and key facts At a glance, then the Justices the
	President appointed, drawn as bars with each case on this site marked, and
	the cases on this site in which they sat, with what each did.
-->
<script lang="ts">
	import BenchChart from '#lib/components/BenchChart.svelte';
	import CitationMarks from '#lib/components/CitationMarks.svelte';
	import Collapsible from '#lib/components/Collapsible.svelte';
	import DataTable from '#lib/components/DataTable.svelte';
	import InfoPage from '#lib/components/InfoPage.svelte';
	import { readableDate } from '#lib/readable-date.ts';
	import type { TableColumn, TableRow } from '#lib/tables/table-definition.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const justiceColumns: TableColumn[] = [
		{ key: 'name', header: 'Justice', isRowHeader: true, sortable: true },
		{ key: 'role', header: 'Role', sortable: true },
		{ key: 'joined', header: 'Joined the Court', type: 'date', sortable: true },
		{ key: 'left', header: 'Left the Court', type: 'date', sortable: true },
		{ key: 'cases', header: 'Cases on this site', type: 'number', sortable: true }
	];

	const justiceRows: TableRow[] = $derived(
		data.appointees.map((justice) => ({
			key: justice.key,
			cells: {
				name: { text: justice.name, href: justice.link },
				role: { text: justice.role },
				joined: { text: readableDate(justice.joined), sortValue: justice.joined },
				left: { text: justice.left ? readableDate(justice.left) : 'Serving', sortValue: justice.left ?? '9999' },
				cases: { text: String(justice.cases), sortValue: justice.cases }
			}
		}))
	);

	const caseColumns: TableColumn[] = [
		{ key: 'name', header: 'Case', isRowHeader: true, sortable: true, custom: true },
		{ key: 'decided', header: 'Decided', type: 'date', sortable: true },
		{ key: 'court', header: 'Court', sortable: true },
		{ key: 'vote', header: 'Vote', sortable: true },
		{ key: 'parts', header: 'Appointees', sortable: true, custom: true }
	];

	const caseRows: TableRow[] = $derived(
		data.cases.map((item) => ({
			key: item.key,
			cells: {
				name: { text: `${item.name}, ${item.citation}`, href: item.link, sortValue: item.name },
				decided: { text: item.decidedText ?? '', sortValue: item.decided ?? '' },
				court: { text: item.court, href: item.courtLink },
				vote: { text: item.vote ?? '' },
				parts: { text: item.parts.map((part) => `${part.name}: ${part.part}`).join('; ') }
			}
		}))
	);
	const caseByKey = $derived(new Map(data.cases.map((item) => [item.key, item])));
</script>

<svelte:head>
	<title>{data.name} · Supreme Court · Tribal Law Project</title>
	<meta name="description" content="{data.name}, {data.summary}: the Justices appointed and their part in the cases on this site." />
</svelte:head>

<InfoPage
	title={data.name}
	lead={data.summary}
	picture={data.portrait}
	glance={data.glance}
	sources={data.sources}
	trail={[
		{ label: 'Library', href: '/library' },
		{ label: 'Supreme Court', href: '/supreme-court' }
	]}
>
	<Collapsible heading="Justices appointed" identifier="justices" count={data.appointees.length}>
		<BenchChart rows={data.rows} start={data.start} end={data.end} cases={data.chartCases} width={560} labelWidth={110} allLink />
		<DataTable
			identifier="justices-{data.key}"
			label="Table: Justices appointed by {data.name}"
			columns={justiceColumns}
			rows={justiceRows}
			rowName={['Justice', 'Justices']}
			download="{data.key}-justices"
		/>
		<p class="small muted source-line">Source<CitationMarks marks={data.appointeeMarks} /></p>
	</Collapsible>

	<Collapsible heading="Cases on this site" identifier="cases" count={data.cases.length}>
		{#if data.cases.length > 0}
			<DataTable
				identifier="cases-{data.key}"
				label="Table: cases on this site in which Justices appointed by {data.name} took part"
				columns={caseColumns}
				rows={caseRows}
				rowName={['case', 'cases']}
				download="{data.key}-cases"
			>
				{#snippet cell(row, column)}
					{@const item = caseByKey.get(row.key)}
					{#if item && column.key === 'name'}
						{#if item.link}<a href={item.link}><i>{item.name}</i></a>{:else}<i>{item.name}</i>{/if}, {item.citation}
					{:else if item}
						<ul class="parts">
							{#each item.parts as part (part.link)}
								<li><a href={part.link}>{part.name}</a>{' '}<span class="muted">({part.part[0].toLowerCase() + part.part.slice(1)})</span></li>
							{/each}
						</ul>
					{/if}
				{/snippet}
			</DataTable>
		{/if}
	</Collapsible>
</InfoPage>

<style>
	.parts {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	/* Stacked names a full touch target apart. */
	.parts li + li {
		margin-top: var(--space-1);
	}

	.source-line {
		margin-top: var(--space-2);
	}
</style>
