<!--
	@component
	One court the site names (src/lib/server/courts.ts; Trevor approved the
	mockup on Nov. 24, 2026, design/stub-pages/), on the site's one item
	layout: its nation, opinions and cases At a glance, its newest opinions,
	the cases it decided, and the pages that name it. Each court's page is a
	stub until someone writes about the court (src/lib/stubs.ts). A nation's
	choice to hide its opinions, or to have them only cited, is applied when
	the page is served (src/lib/restricted-pages.ts, "court").
-->
<script lang="ts">
	import Collapsible from '#lib/components/Collapsible.svelte';
	import DataTable from '#lib/components/DataTable.svelte';
	import InfoPage from '#lib/components/InfoPage.svelte';
	import ReviewStatus from '#lib/components/ReviewStatus.svelte';
	import StubBadge from '#lib/components/StubBadge.svelte';
	import { readableDate } from '#lib/readable-date.ts';
	import { nationVerification } from '#lib/review-status.ts';
	import type { TableColumn, TableRow } from '#lib/tables/table-definition.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const opinionCount = $derived(data.opinionKeys.length);
	// "the Navajo Nation", as a nation's name reads in a sentence.
	const nationNames = $derived(data.nations.map((nation) => (/^the /i.test(nation.name) ? nation.name : `the ${nation.name}`)).join(' and '));
	const lead = $derived.by(() => {
		// Each count with its years, which At a glance no longer repeats (src/lib/server/courts.ts).
		const years = (span: { from: string; to: string } | undefined) => (span ? ` (${span.from === span.to ? span.from : `${span.from}–${span.to}`})` : '');
		const counts = [
			opinionCount > 0 ? `${opinionCount.toLocaleString('en-US')} ${opinionCount === 1 ? 'opinion' : 'opinions'}${years(data.opinionYears)}` : '',
			data.caseCount > 0 ? `${data.caseCount.toLocaleString('en-US')} ${data.caseCount === 1 ? 'case' : 'cases'}${years(data.caseYears)}` : ''
		].filter(Boolean);
		const named = counts.length > 0 ? `, named in ${counts.join(' and ')} on this site` : '';
		const what = data.nations.length > 0 ? `A Tribal court of ${nationNames}` : `A ${data.kind.toLocaleLowerCase('en-US')}`;
		return `${what}${named}.`;
	});

	const opinionColumns: TableColumn[] = [
		{ key: 'name', header: 'Opinion', isRowHeader: true, custom: true },
		{ key: 'citation', header: 'Citation' },
		{ key: 'decided', header: 'Decided' }
	];
	const opinionRows: TableRow[] = $derived(
		data.opinions.map((opinion) => ({
			key: opinion.key,
			cells: {
				name: { text: opinion.name, href: opinion.path || undefined },
				citation: { text: opinion.citation },
				decided: { text: readableDate(opinion.decided), sortValue: opinion.decided }
			}
		}))
	);
	const opinionByKey = $derived(new Map(data.opinions.map((opinion) => [opinion.key, opinion])));

	const caseColumns: TableColumn[] = [
		{ key: 'name', header: 'Case', isRowHeader: true, custom: true },
		{ key: 'citation', header: 'Citation' },
		{ key: 'decided', header: 'Decided' }
	];
	const caseRows: TableRow[] = $derived(
		data.cases.map((entry) => ({
			key: entry.key,
			cells: {
				name: { text: entry.name, href: entry.link },
				citation: { text: entry.citation },
				decided: { text: readableDate(entry.decided), sortValue: entry.decided }
			}
		}))
	);
	const caseByKey = $derived(new Map(data.cases.map((entry) => [entry.key, entry])));
</script>

<svelte:head>
	<title>{data.name} · Courts · Tribal Law Project</title>
	<meta name="description" content={lead} />
</svelte:head>

<InfoPage
	title={data.name}
	{lead}
	glance={data.glance}
	sources={data.sources}
	trail={[
		{ label: 'Library', href: '/library' },
		{ label: 'Courts', href: '/courts' }
	]}
	{status}
>
	{#if data.opinions.length > 0}
		<Collapsible heading="Opinions" identifier="opinions" count={opinionCount}>
			<DataTable identifier="opinions-{data.key}" label="Table: the newest opinions of the {data.name}" columns={opinionColumns} rows={opinionRows} rowName={['opinion', 'opinions']} count={false} tools={false}>
				{#snippet cell(row: TableRow, column: TableColumn)}
					{@const opinion = opinionByKey.get(row.key)}
					{#if opinion && column.key === 'name'}{#if opinion.path}<a href={opinion.path}><i>{opinion.name}</i></a>{:else}<i>{opinion.name}</i>{/if}{/if}
				{/snippet}
			</DataTable>
			{#each data.opinionLists as list (list.link)}
				<p><a href={list.link}>{data.opinionLists.length === 1 ? `All ${opinionCount.toLocaleString('en-US')} opinions` : `All opinions of ${list.name}’s courts`}</a></p>
			{/each}
		</Collapsible>
	{/if}

	{#if data.cases.length > 0}
		<Collapsible heading="Cases" identifier="cases" count={data.caseCount}>
			<DataTable identifier="cases-{data.key}" label={data.cases.length < data.caseCount ? `Table: the newest cases the ${data.name} decided` : `Table: cases the ${data.name} decided`} columns={caseColumns} rows={caseRows} rowName={['case', 'cases']} count={false} tools={false}>
				{#snippet cell(row: TableRow, column: TableColumn)}
					{@const entry = caseByKey.get(row.key)}
					{#if entry && column.key === 'name'}<a href={entry.link}><i>{entry.name}</i></a>{/if}
				{/snippet}
			</DataTable>
			{#if data.caseList}<p><a href={data.caseList}>All {data.caseCount.toLocaleString('en-US')} cases</a></p>{/if}
		</Collapsible>
	{/if}

	{#if data.mentions.length > 0}
		<Collapsible heading="Mentioned on" identifier="mentioned-on" count={data.mentions.length}>
			<ul class="mentions">
				{#each data.mentions as mention (mention.link)}
					<li><a href={mention.link}>{mention.title}</a><span class="muted small">{mention.where}</span></li>
				{/each}
			</ul>
		</Collapsible>
	{/if}
</InfoPage>

{#snippet status()}
	<div class="status-badges">
		<StubBadge stub={data.stub} />
		{#if data.nations.length > 0}
			<ReviewStatus status={nationVerification(undefined)} description="Review by the nation:">
				<p><strong>Unverified.</strong> {nationNames.charAt(0).toLocaleUpperCase('en-US')}{nationNames.slice(1)} {data.nations.length === 1 ? 'has' : 'have'} not reviewed this page yet.</p>
			</ReviewStatus>
		{/if}
	</div>
{/snippet}

<style>
	.mentions {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.mentions li {
		padding: var(--space-2) 0;
		border-bottom: 1px solid var(--color-line);
	}

	.mentions a {
		display: block;
	}
</style>
