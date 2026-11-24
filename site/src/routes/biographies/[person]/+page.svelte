<!--
	@component
	One Native person in the cases or in a nation's history (Trevor, Nov. 24,
	2026), on the site's one item layout (InfoPage): the picture and key facts
	At a glance, the cases the person took part in or is named in, and the
	events of the person's life the sources record, each with its source.
-->
<script lang="ts">
	import CitationMarks from '#lib/components/CitationMarks.svelte';
	import CountBadge from '#lib/components/CountBadge.svelte';
	import DataTable from '#lib/components/DataTable.svelte';
	import InfoPage from '#lib/components/InfoPage.svelte';
	import ReviewStatus from '#lib/components/ReviewStatus.svelte';
	import { nationVerification } from '#lib/review-status.ts';
	import type { TableColumn, TableRow } from '#lib/tables/table-definition.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const caseColumns: TableColumn[] = [
		{ key: 'name', header: 'Case', isRowHeader: true, sortable: true, custom: true },
		{ key: 'decided', header: 'Decided', sortable: true },
		{ key: 'court', header: 'Court', sortable: true },
		{ key: 'role', header: 'Role', sortable: true, custom: true }
	];
	const caseRows: TableRow[] = $derived(
		data.cases.map((item) => ({
			key: item.key,
			cells: {
				name: { text: `${item.name}, ${item.citation}`, href: item.link, sortValue: item.name },
				decided: { text: item.decided },
				court: { text: item.court },
				role: { text: [item.role, item.result].filter(Boolean).join('. ') }
			}
		}))
	);
	const caseByKey = $derived(new Map(data.cases.map((item) => [item.key, item])));
	const nationNames = $derived(data.nations.map((nation) => nation.name).join(' and '));
	const request = $derived(`/requests?${new URLSearchParams({ kind: 'correct', record: `biographies/${data.key}` }).toString().replaceAll('%2F', '/')}`);
</script>

<svelte:head>
	<title>{data.name} · Biographies · Model Tribal ADR Code</title>
	<meta name="description" content="{data.name}: {data.lead}" />
</svelte:head>

<InfoPage
	title={data.name}
	lead={data.lead}
	names={data.names}
	picture={data.picture}
	glance={data.glance}
	sources={data.sources}
	trail={[
		{ label: 'Library', href: '/library' },
		{ label: 'Biographies', href: '/biographies' }
	]}
>
	{#snippet status()}
		<ReviewStatus status={nationVerification(undefined)} description="Review by the nation:">
			{#if data.nations.length > 0}
				<p><strong>Unverified.</strong> {nationNames} {data.nations.length === 1 ? 'has' : 'have'} not reviewed this page yet.</p>
			{:else}
				<p><strong>Unverified.</strong> No nation has reviewed this page yet.</p>
			{/if}
			<p class="no-print"><a href={request}>Request a change or removal</a></p>
		</ReviewStatus>
	{/snippet}

	{#if data.cases.length > 0}
		<section aria-labelledby="cases">
			<h2 id="cases">Cases <CountBadge count={data.cases.length} /></h2>
			<DataTable identifier="cases-{data.key}" label="Table: cases {data.name} took part in or is named in" columns={caseColumns} rows={caseRows} rowName={['case', 'cases']} count={false} download="{data.key}-cases">
				{#snippet cell(row: TableRow, column: TableColumn)}
					{@const item = caseByKey.get(row.key)}
					{#if item && column.key === 'name'}<a href={item.link}><i>{item.name}</i></a>, {item.citation}{/if}
					{#if item && column.key === 'role'}{item.role}{#if item.result}<span class="result small muted">{item.result}</span>{/if}<CitationMarks marks={item.citations} />{/if}
				{/snippet}
			</DataTable>
		</section>
	{/if}

	{#if data.events.length > 0}
		<section aria-labelledby="events">
			<h2 id="events">Life and events</h2>
			<ul class="events">
				{#each data.events as event, index (index)}
					<li><span class="when">{event.when}</span><span>{event.text}<CitationMarks marks={event.citations} /></span></li>
				{/each}
			</ul>
		</section>
	{/if}
</InfoPage>

<style>
	.result {
		display: block;
	}

	/* The same rows as a Justice's career: the date first, in its own column. */
	.events {
		display: flow-root;
		padding: 0;
		list-style: none;
	}

	.events li {
		display: grid;
		grid-template-columns: 9rem 1fr;
		gap: var(--space-3);
		padding: var(--space-2) 0;
		border-bottom: 1px solid var(--color-line);
	}

	.when {
		font-weight: 700;
	}

	@media (max-width: 30rem) {
		.events li {
			grid-template-columns: 1fr;
			gap: var(--space-1);
		}
	}
</style>
