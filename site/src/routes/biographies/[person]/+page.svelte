<!--
	@component
	One Native person in the cases or in a nation's history (Trevor, Nov. 24,
	2026), or one who signed treaties for the United States (Nov. 26), on the site's one item layout (InfoPage): the picture and key facts
	Key facts, the cases the person took part in or is named in, the
	treaties the person signed, each linked to its page and to the copy of its
	text the site keeps, and the events of the person's life the sources
	record, each with its source.
-->
<script lang="ts">
	import FileText from '@lucide/svelte/icons/file-text';
	import CitationMarks from '#lib/components/CitationMarks.svelte';
	import Collapsible from '#lib/components/Collapsible.svelte';
	import DataTable from '#lib/components/DataTable.svelte';
	import InfoPage from '#lib/components/InfoPage.svelte';
	import ReviewStatus from '#lib/components/ReviewStatus.svelte';
	import StubBadge from '#lib/components/StubBadge.svelte';
	import { nationVerification } from '#lib/review-status.ts';
	import type { TableColumn, TableRow } from '#lib/tables/table-definition.ts';
	import type { PageProps } from './$types';
	import { requestLink } from '#lib/report-request.ts';

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
	const treatyColumns: TableColumn[] = [
		{ key: 'name', header: 'Treaty', isRowHeader: true, sortable: true, custom: true },
		{ key: 'signed', header: 'Signed', sortable: true },
		{ key: 'for', header: 'Signed for', sortable: true, custom: true },
		{ key: 'listed', header: 'Listed as', sortable: true },
		{ key: 'text', header: 'Text', custom: true }
	];
	const treatyRows: TableRow[] = $derived(
		data.treaties.map((item) => ({
			key: item.key,
			cells: {
				name: { text: [item.name, item.citation].filter(Boolean).join(', '), href: item.link, sortValue: item.name },
				signed: { text: item.signed },
				for: { text: item.signedFor ?? '' },
				listed: { text: item.listedAs ?? '' },
				text: { text: item.document?.format ?? '', href: item.document?.href }
			}
		}))
	);
	const treatyByKey = $derived(new Map(data.treaties.map((item) => [item.key, item])));
	const caseByKey = $derived(new Map(data.cases.map((item) => [item.key, item])));
	const nationNames = $derived(data.nations.map((nation) => nation.name).join(' and '));
	const request = $derived(requestLink({ kind: 'correct', record: `biographies/${data.key}` }));
</script>

<svelte:head>
	<title>{data.name} · Biographies · Tribal Law Project</title>
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
		<div class="status-badges">
		{#if data.stub}<StubBadge stub={data.stub} />{/if}
		<ReviewStatus status={nationVerification(undefined)} description="Review by the nation:">
			{#if data.nations.length > 0}
				<p><strong>Unverified.</strong> {nationNames} {data.nations.length === 1 ? 'has' : 'have'} not reviewed this page yet.</p>
			{:else}
				<p><strong>Unverified.</strong> No nation has reviewed this page yet.</p>
			{/if}
			<p class="no-print"><a href={request}>Request a change or removal</a></p>
		</ReviewStatus>
		</div>
	{/snippet}

	{#if data.cases.length > 0}
		<Collapsible heading="Cases" identifier="cases" count={data.cases.length}>
			<DataTable identifier="cases-{data.key}" label="Table: cases {data.name} took part in or is named in" columns={caseColumns} rows={caseRows} rowName={['case', 'cases']} count={false} download="{data.key}-cases">
				{#snippet cell(row: TableRow, column: TableColumn)}
					{@const item = caseByKey.get(row.key)}
					{#if item && column.key === 'name'}<a href={item.link}><i>{item.name}</i></a>, {item.citation}{/if}
					{#if item && column.key === 'role'}{item.role}{#if item.result}<span class="result small muted">{item.result}</span>{/if}<CitationMarks marks={item.citations} />{/if}
				{/snippet}
			</DataTable>
		</Collapsible>
	{/if}

	{#if data.treaties.length > 0}
		<Collapsible heading="Treaties" identifier="treaties" count={data.treaties.length}>
			<DataTable identifier="treaties-{data.key}" label="Table: treaties {data.name} signed" columns={treatyColumns} rows={treatyRows} rowName={['treaty', 'treaties']} count={false} download="{data.key}-treaties">
				{#snippet cell(row: TableRow, column: TableColumn)}
					{@const item = treatyByKey.get(row.key)}
					{#if item && column.key === 'name'}<a href={item.link}>{item.name}</a>{#if item.citation}, {item.citation}{/if}{/if}
					{#if item && column.key === 'for'}{item.signedFor}<CitationMarks marks={item.citations} />{/if}
					{#if item?.document && column.key === 'text'}<a class="treaty-text" href={item.document.href}><FileText size={16} strokeWidth={1.75} aria-hidden="true" />{item.document.format}<span class="visually-hidden"> copy of the {item.name}</span></a>{/if}
				{/snippet}
			</DataTable>
		</Collapsible>
	{/if}

	{#if data.events.length > 0}
		<Collapsible heading="Life and events" identifier="events">
			<ul class="events">
				{#each data.events as event, index (index)}
					<li>
						<span class="when">{event.when}</span>
						<!-- One line, so no space comes between the text and its marker. -->
						<span>{#if event.link}{@const [before, ...after] = event.text.split(event.link.text)}{before}<a href={event.link.href}>{event.link.text}</a>{after.join(event.link.text)}{:else}{event.text}{/if}<CitationMarks marks={event.citations} /></span>
					</li>
				{/each}
			</ul>
		</Collapsible>
	{/if}
</InfoPage>

<style>
	.result {
		display: block;
	}

	.treaty-text {
		display: inline-flex;
		gap: var(--space-1);
		align-items: center;
		white-space: nowrap;
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
