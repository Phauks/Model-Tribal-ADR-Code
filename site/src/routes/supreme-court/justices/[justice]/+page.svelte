<!--
	@component
	One Justice of the Supreme Court of the United States (Trevor, Nov. 24,
	2026: "sub-pages for each justice ... to show their relationship to cases
	and such", "want pictures"). A record page: the portrait and key facts At a
	glance, then the Justice's time on the Court with each case on this site
	marked, the cases with the Justice's vote and opinion, and the Justice's
	career, each fact with its source.
-->
<script lang="ts">
	import BenchChart from '#lib/components/BenchChart.svelte';
	import CitationMarks from '#lib/components/CitationMarks.svelte';
	import CountBadge from '#lib/components/CountBadge.svelte';
	import DataTable from '#lib/components/DataTable.svelte';
	import InfoPage from '#lib/components/InfoPage.svelte';
	import type { TableColumn, TableRow } from '#lib/tables/table-definition.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const caseColumns: TableColumn[] = [
		{ key: 'name', header: 'Case', isRowHeader: true, sortable: true, custom: true },
		{ key: 'decided', header: 'Decided', type: 'date', sortable: true },
		{ key: 'court', header: 'Court', sortable: true },
		{ key: 'vote', header: 'Vote', sortable: true },
		{ key: 'part', header: 'Opinion or vote', sortable: true }
	];

	const caseRows: TableRow[] = $derived(
		data.cases.map((item) => ({
			key: item.key,
			cells: {
				name: { text: `${item.name}, ${item.citation}`, href: item.link, sortValue: item.name },
				decided: { text: item.decidedText ?? '', sortValue: item.decided ?? '' },
				court: { text: item.court, href: item.courtLink },
				vote: { text: item.vote ?? '' },
				part: { text: item.parts.map((part) => part.part).join('; ') }
			}
		}))
	);
	const caseByKey = $derived(new Map(data.cases.map((item) => [item.key, item])));
</script>

<svelte:head>
	<title>{data.name} · Supreme Court · Model Tribal ADR Code</title>
	<meta name="description" content="{data.name}, {data.summary}: votes and opinions in the cases on this site." />
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
	<section aria-labelledby="service">
		<h2 id="service">On the Court</h2>
		<BenchChart rows={data.rows} start={data.start} end={data.end} cases={data.cases} width={560} labelWidth={110} />
	</section>

	<section aria-labelledby="cases">
		<h2 id="cases">Cases on this site <CountBadge count={data.cases.length} /></h2>
		{#if data.cases.length > 0}
			<DataTable
				identifier="cases-{data.key}"
				label="Table: cases on this site in which {data.name} took part"
				columns={caseColumns}
				rows={caseRows}
				rowName={['case', 'cases']}
				download="{data.key}-cases"
			>
				{#snippet cell(row)}
					{@const item = caseByKey.get(row.key)}
					{#if item}{#if item.link}<a href={item.link}><i>{item.name}</i></a>{:else}<i>{item.name}</i>{/if}, {item.citation}{/if}
				{/snippet}
			</DataTable>
		{/if}
	</section>

	{#if data.career.length > 0}
		<section aria-labelledby="career">
			<h2 id="career">Career</h2>
			<ul class="career">
				{#each data.career as line, index (index)}
					<li><span class="years">{line.years}</span><span>{line.text}</span></li>
				{/each}
			</ul>
			<p class="small muted source-line">Source<CitationMarks marks={data.careerMarks} /></p>
		</section>
	{/if}
</InfoPage>

<style>
	/* One line each, with a thin rule between, as At a glance stacks values: no bullets (Trevor, Nov. 23, 2026). The years stand first, in their own column ("segment by year"). */
	.career {
		display: flow-root;
		padding: 0;
		list-style: none;
	}

	.career li {
		display: grid;
		grid-template-columns: 9rem 1fr;
		gap: var(--space-3);
		padding: var(--space-2) 0;
		border-bottom: 1px solid var(--color-line);
	}

	.years {
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}

	@media (max-width: 30rem) {
		.career li {
			grid-template-columns: 1fr;
			gap: var(--space-1);
		}
	}

	.source-line {
		margin-top: var(--space-2);
	}

</style>
