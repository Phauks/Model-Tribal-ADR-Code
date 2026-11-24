<!--
	@component
	One Court of the Supreme Court of the United States, named for its Chief
	Justice (Trevor, Nov. 23, 2026: the Court named in a case box, such as
	"Marshall Court", opens a page with the Court's make-up and history and the
	cases on this site it decided). Facts come from the Court's own list of
	Justices, the Federal Judicial Center and the Supreme Court Historical
	Society, each with its marker.
-->
<script lang="ts">
	import BenchChart from '#lib/components/BenchChart.svelte';
	import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
	import CitationMarks from '#lib/components/CitationMarks.svelte';
	import CountBadge from '#lib/components/CountBadge.svelte';
	import DataTable from '#lib/components/DataTable.svelte';
	import SourceList from '#lib/components/SourceList.svelte';
	import { readableDate } from '#lib/readable-date.ts';
	import type { TableColumn, TableRow } from '#lib/tables/table-definition.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const justiceColumns: TableColumn[] = [
		{ key: 'name', header: 'Justice', isRowHeader: true, sortable: true, searchable: true },
		{ key: 'role', header: 'Role', sortable: true, filterable: true },
		{ key: 'appointedBy', header: 'Appointed by', sortable: true, filterable: true },
		{ key: 'joined', header: 'Joined the Court', type: 'date', sortable: true, searchable: true },
		{ key: 'left', header: 'Left the Court', type: 'date', sortable: true, searchable: true },
		{ key: 'ending', header: 'How service ended', sortable: true, filterable: true },
		{ key: 'seat', header: 'Seat held before by', sortable: true, filterable: true }
	];

	const justiceRows: TableRow[] = $derived(
		data.bench.map((justice) => ({
			key: `${justice.name}-${justice.role}`,
			cells: {
				name: { text: justice.name, href: justice.link },
				role: { text: justice.role },
				appointedBy: { text: justice.appointedBy, href: justice.appointedByLink },
				joined: { text: readableDate(justice.joined), sortValue: justice.joined },
				left: { text: justice.left ? readableDate(justice.left) : 'Serving', sortValue: justice.left ?? '9999' },
				ending: { text: justice.ending ? justice.ending[0].toUpperCase() + justice.ending.slice(1) : '' },
				seat: { text: justice.seat }
			}
		}))
	);

	const caseColumns: TableColumn[] = [
		{ key: 'name', header: 'Case', isRowHeader: true, sortable: true, custom: true, searchable: true },
		{ key: 'decided', header: 'Decided', type: 'date', sortable: true, searchable: true },
		{ key: 'vote', header: 'Vote', sortable: true, filterable: true },
		{ key: 'opinions', header: 'Opinions', type: 'number', sortable: true },
		{ key: 'court', header: 'Opinion of the Court', sortable: true, custom: true, filterable: true },
		{ key: 'concurring', header: 'Concurring', sortable: true, custom: true, searchable: true },
		{ key: 'dissenting', header: 'Dissenting', sortable: true, custom: true, searchable: true }
	];

	/** The opinions the Justices wrote, leaving out votes noted without one. */
	const writtenCount = (item: (typeof data.cases)[number]) => item.opinions.filter((opinion) => !opinion.unwritten).length;

	/** "Brown (announcing the judgment)", for the download and for sorting. */
	const opinionText = (item: (typeof data.cases)[number], column: string) =>
		item.opinions
			.filter((opinion) => opinion.column === column)
			.map((opinion) => (opinion.qualifier ? `${opinion.justice} (${opinion.qualifier})` : opinion.justice))
			.join('; ');

	const caseRows: TableRow[] = $derived(
		data.cases.map((item) => ({
			key: item.key,
			cells: {
				name: { text: `${item.name}, ${item.citation}`, href: item.link, sortValue: item.name },
				decided: { text: item.decidedText ?? '', sortValue: item.decided ?? '' },
				vote: { text: item.vote ?? '' },
				opinions: { text: String(writtenCount(item)), sortValue: writtenCount(item) },
				court: { text: opinionText(item, 'court') },
				concurring: { text: opinionText(item, 'concurring') },
				dissenting: { text: opinionText(item, 'dissenting') }
			}
		}))
	);
	const caseByKey = $derived(new Map(data.cases.map((item) => [item.key, item])));
</script>

<svelte:head>
	<title>{data.name} · Supreme Court · Model Tribal ADR Code</title>
	<meta name="description" content="{data.name} of the Supreme Court of the United States, {data.years}: its Justices, its history and the cases on this site it decided." />
</svelte:head>

<Breadcrumbs
	trail={[
		{ label: 'Library', href: '/library' },
		{ label: 'Supreme Court', href: '/supreme-court' }
	]}
/>

<div class="reading">
	<h1>{data.name}</h1>
	<dl class="summary-list">
		{#each data.facts as fact (fact.label)}
			<div>
				<dt>{fact.label}</dt>
				<dd>{fact.text}<CitationMarks marks={fact.marks} /></dd>
			</div>
		{/each}
	</dl>

	<!-- eslint-disable-next-line svelte/no-at-html-tags -- built from the repository's own Markdown -->
	{@html data.historyHtml}
</div>

<section aria-labelledby="justices">
	<h2 id="justices">Justices <CountBadge count={data.bench.length} /></h2>
	<BenchChart rows={data.bench} start={data.start} end={data.end} cases={data.cases} />
	<DataTable
		identifier="justices-{data.key}"
		label="Table: Justices of the {data.name}"
		columns={justiceColumns}
		rows={justiceRows}
		rowName={['Justice', 'Justices']}
		download="{data.key}-justices"
		filters
	/>
	<p class="small muted source-line">Source<CitationMarks marks={data.benchMarks} /></p>
</section>

{#if data.changes.length > 0}
	<section aria-labelledby="changes" class="reading">
		<h2 id="changes">Changes <CountBadge count={data.changes.length} /></h2>
		<ol class="changes">
			{#each data.changes as change (change.date)}
				<li>
					<time datetime={change.date}>{change.dateText}</time>
					<span>{change.events.join(' ')}</span>
				</li>
			{/each}
		</ol>
		<p class="small muted source-line">Source<CitationMarks marks={data.changeMarks} /></p>
	</section>
{/if}

<section aria-labelledby="cases">
	<h2 id="cases">Cases on this site <CountBadge count={data.cases.length} /></h2>
	<DataTable identifier="cases-{data.key}" label="Table: cases decided by the {data.name}" columns={caseColumns} rows={caseRows} rowName={['case', 'cases']} download="{data.key}-cases" filters>
		{#snippet cell(row, column)}
			{@const item = caseByKey.get(row.key)}
			{#if item && column.key === 'name'}
				{#if item.link}<a href={item.link}><i>{item.name}</i></a>{:else}<i>{item.name}</i>{/if}, {item.citation}
			{:else if item}
				<ul class="opinions">
					{#each item.opinions.filter((opinion) => opinion.column === column.key) as opinion (opinion.fullName)}
						<li>{#if opinion.link}<a href={opinion.link}>{opinion.justice}</a>{:else}{opinion.justice}{/if}{#if opinion.qualifier}{' '}<span class="muted">({opinion.qualifier})</span>{/if}</li>
					{/each}
				</ul>
			{/if}
		{/snippet}
	</DataTable>
</section>

<SourceList sources={data.sources} />

<style>
	.changes {
		padding: 0;
		list-style: none;
	}

	.changes li {
		display: grid;
		grid-template-columns: 8.5rem 1fr;
		gap: var(--space-3);
		padding: var(--space-2) 0;
		border-bottom: 1px solid var(--color-line);
	}

	.changes time {
		color: var(--color-ink-muted);
		font-variant-numeric: tabular-nums;
	}

	.opinions {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.source-line {
		margin-top: var(--space-2);
	}

	@media (max-width: 40rem) {
		.changes li {
			grid-template-columns: 1fr;
			gap: 0;
		}
	}
</style>
